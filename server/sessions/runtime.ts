import {sha256Hex} from '../crypto';
import {enforceRateLimit} from '../security';
import { ensureDatabase, getD1, addParticipant, authenticateSeat, insertRoom, loadRoom, loadFeedbackTallies, persistMutation, registerDisplaySession } from '../database';
import { createRoomState } from '../engine';
import { GameLengthSchema, AvatarConfigSchema } from '../../lib/contracts';
import { ARCADE_GAMES } from '../../lib/arcade/catalog';
import { isArchivedArcadeGame } from '../../lib/arcade/archived-games';
import { getOnlineEngine } from '../../lib/arcade/online/engines';
import { displayCookieName, getCookie, hostCookieName, seatCookieName, sessionCookie } from '../http';
import { randomRoomCode } from '../../lib/game/random';
import { reserveCallbackCode } from './codes';
import { SessionService,sessionHostCookie,sessionSeatCookie,sessionMirrorCookie,type SessionAdapter,type SessionMember } from './service';
import { partyBroker } from '../party/runtime';
import {retireNativeArcadeRoom} from '../arcade-native/control';
import {retireOnlineSocketRoom} from '../arcade/online/socket-broker';
import {runtimeEnv} from '../database';
import type { SessionActiveGame } from '../../lib/session-contracts';

async function attachMain(code:string,m:SessionMember){
  const loaded=await loadRoom(code);if(!loaded)return false;
  const existing=await getD1().prepare('SELECT id,removed_at FROM players WHERE room_id=? AND token_hash=? ORDER BY removed_at DESC LIMIT 1').bind(loaded.state.id,m.token_hash).first<{id:string;removed_at:number|null}>();
  // A removed token may not silently reattach while parent revocation finishes.
  // Deliberate joining obtains a fresh parent token. The write guard also checks this.
  if(existing)return existing.removed_at===null;
  if(loaded.state.phase!=='LOBBY')return false;
  for(let i=0;i<5;i++){const result=await addParticipant(code,{nickname:m.nickname,nicknameNormalized:m.nickname_normalized,role:'player',active:true,pendingActivation:false,bot:false,avatarConfig:m.avatar_json?AvatarConfigSchema.parse(JSON.parse(m.avatar_json)):undefined,avatarPreset:m.avatar_preset},m.token_hash,m.id);if(result!=='RACE')return true;}
  throw new Error('The players could not be added. Try again.');
}
async function attachOnline(code:string,m:SessionMember){
  const db=getD1(),now=Date.now(),seat=String(m.seat).padStart(2,'0');
  const room=await db.prepare('SELECT version,status,state_json FROM online_arcade_rooms WHERE code=? AND expires_at>? AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind=\'online\' AND child_code=online_arcade_rooms.code AND active=0)').bind(code,now).first<{version:number;status:string;state_json:string}>();
  if(!room)return false;
  const existing=await db.prepare('SELECT seat_id FROM online_arcade_seats WHERE room_code=? AND token_hash=?').bind(code,m.token_hash).first();
  if(room.status==='PLAYING'){const state=JSON.parse(room.state_json) as {activeIds?:string[]};return Boolean(existing&&(!state.activeIds||state.activeIds.includes(seat)));}
  if(existing)return true;
  const result=await db.batch([
    db.prepare(`INSERT OR IGNORE INTO online_arcade_seats(room_code,seat_id,token_hash,nickname,nickname_normalized,sequence,input_json,last_seen_at) SELECT ?,?,?,?,?,0,'{}',? WHERE EXISTS(SELECT 1 FROM online_arcade_rooms WHERE code=? AND version=? AND status IN('LOBBY','RESULT') AND expires_at>?) AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='online' AND child_code=? AND active=0)`).bind(code,seat,m.token_hash,m.nickname,m.nickname_normalized,now,code,room.version,now,code),
    db.prepare("UPDATE online_arcade_rooms SET version=version+1,state_json=json_set(state_json,'$.version',version+1,?,0) WHERE code=? AND version=? AND EXISTS(SELECT 1 FROM online_arcade_seats WHERE room_code=? AND seat_id=? AND token_hash=?)").bind(`$.wins.${seat}`,code,room.version,code,seat,m.token_hash),
  ]);
  return Number(result[0]?.meta.changes)===1&&Number(result[1]?.meta.changes)===1;
}
const adapter:SessionAdapter={
  ticketLimit:(request,scope)=>enforceRateLimit(request,scope,30),
  reserveCode:(code,owner,expires)=>reserveCallbackCode(getD1(),code,owner,expires),
  socketConfig(){const env=runtimeEnv();return {secret:env.PARTY_SECRET??'',workerUrl:env.PARTY_WORKER_URL??''};},
  async notify(code,version,generation){const env=runtimeEnv();if(!env.PARTY_WORKER_URL||!env.PARTY_SECRET)return;const url=new URL(`/sessions/${encodeURIComponent(code)}/notify`,env.PARTY_WORKER_URL);const response=await fetch(url,{method:'POST',headers:{authorization:'Bearer '+env.PARTY_SECRET,'content-type':'application/json'},body:JSON.stringify({version,generation}),signal:AbortSignal.timeout(450)});if(!response.ok)throw Error('SESSION_NOTIFY_FAILED');},
  async launch(_request,game,members,id,hostHash){
    const realtimeSumo=game.kind==='online'&&game.gameId==='sumo';
    let code='';for(let i=0;i<16;i++){const candidate=randomRoomCode();if(await reserveCallbackCode(getD1(),candidate,game.kind,Date.now()+86400000)){code=candidate;break;}}if(!code)throw new Error('Choose again. Could not reserve a game.');
    if(game.kind==='main'){
      const gameLength=GameLengthSchema.parse(game.gameId);
      if(gameLength==='arcade'&&(isArchivedArcadeGame(game.arcadeGameId)||!ARCADE_GAMES.some(g=>g.id===game.arcadeGameId&&g.status==='playable')))throw new Error('Choose a playable Arcade game.');
      const state=createRoomState(code,{gameLength,arcadeGameId:game.arcadeGameId,contentMode:game.contentMode,timerAccessibility:game.timerAccessibility,sorceryLength:game.sorceryLength,birthdayName:game.birthdayName,feedbackTallies:await loadFeedbackTallies()});
      await insertRoom(state,hostHash);for(const m of members)await attachMain(code,m);
      if(gameLength==='bowl-of-fools'&&members.length){const loaded=(await loadRoom(code))!;const first=await getD1().prepare('SELECT id FROM players WHERE room_id=? AND token_hash=?').bind(loaded.state.id,members[0]!.token_hash).first<{id:string}>();if(first){const next=structuredClone(loaded.state);next.foolHostPlayerId=first.id;await persistMutation({base:loaded.state,next,actionId:`session-bowl:${id}`,actorId:'system',actionType:'SESSION_BOWL_HOST',effects:[]});}}
      const titles:Record<string,string>={pictures:'King Prompter',standard:'Legacy Standard',comic:'Let’s Make a Comic',birthday:'Birthday', 'king-mystery':'Royal Frame-Up','royal-rumours':'Royal Rumours','royal-war-room':'Royal War Room','bowl-of-fools':'Bowl of Fools',bowl:'Bowl of Fools'};
      return {code,kind:'main',title:gameLength==='arcade'?ARCADE_GAMES.find(g=>g.id===game.arcadeGameId)!.title:titles[gameLength]??gameLength,hostPath:`/host/${code}`,playPath:`/play/${code}`};
    }
    const engine=getOnlineEngine(game.gameId);if(!engine)throw new Error('Choose a supported Arcade game.');const now=Date.now();
    const parent=new URL(_request.url).pathname.split('/')[3];
    const partyId=`session-${parent}`;
    const options:Record<string,unknown>={players:10,...(realtimeSumo?{realtimePilot:true,partyId,parentCode:parent}:{})};
    if(realtimeSumo&&!members.length)throw new Error('At least one phone requires joining before the pilot loads.');
    const state={gameId:game.gameId,version:1,status:'LOBBY',options,matchId:realtimeSumo?id:'',round:0,engineState:null,paused:false,inputEpoch:0,runAt:0,lastTickAt:now,accumulator:0,simTick:0,consumed:{},wins:Object.fromEntries(Array.from({length:10},(_,i)=>[String(i).padStart(2,'0'),0])),cupComplete:false,lastResult:null};
    await getD1().prepare('INSERT INTO online_arcade_rooms(code,game_id,host_token_hash,version,status,state_json,updated_at,expires_at) VALUES(?,?,?,1,\'LOBBY\',?,?,?)').bind(code,game.gameId,hostHash,JSON.stringify(state),now,now+86400000).run();for(const m of members)await attachOnline(code,m);
    if(realtimeSumo){try{await (await partyBroker()).prepare(partyId,code,id,members,game.sumoPilotOptions??{});}catch(error){await getD1().prepare('UPDATE online_arcade_rooms SET expires_at=0 WHERE code=?').bind(code).run();throw error;}}
    return {code,kind:'online',title:engine.title,hostPath:`/arcade/online/host/${code}`,playPath:`/arcade/online/join/${code}`};
  },
  async credentials(request,game,member,role,parent){
    if(role==='mirror'){const raw=getCookie(request,sessionMirrorCookie(parent));if(!raw)return [];if(game.kind==='main'){const loaded=await loadRoom(game.code);if(!loaded)return [];const childToken=await sha256Hex(raw+':display:'+game.id);await registerDisplaySession(loaded.state.id,await sha256Hex(childToken));return [sessionCookie(displayCookieName(game.code),childToken)];}return [sessionCookie(sessionMirrorCookie(parent),raw,86400)];}

    if(role==='host'){const raw=getCookie(request,sessionHostCookie(parent));if(!raw)return [];return [sessionCookie(game.kind==='main'?hostCookieName(game.code):`callback_arcade_host_${game.code}`,raw)];}
    if(!member)return [];const raw=getCookie(request,sessionSeatCookie(member.session_code));if(!raw)return [];
    const attached=game.kind==='main'?await attachMain(game.code,member):await attachOnline(game.code,member);if(!attached)return [];
    if(game.kind==='main'){const loaded=await loadRoom(game.code);if(!loaded||!await authenticateSeat(loaded.state.id,raw))return [];}
    return [sessionCookie(game.kind==='main'?seatCookieName(game.code):`callback_arcade_seat_${game.code}`,raw)];
  },
  async close(code:string){const env=runtimeEnv();if(!env.PARTY_WORKER_URL||!env.PARTY_SECRET)return;const response=await fetch(new URL('/admission/release',env.PARTY_WORKER_URL),{method:'POST',headers:{authorization:'Bearer '+env.PARTY_SECRET,'content-type':'application/json'},body:JSON.stringify({partyId:'session-'+code}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('PARTY_RELEASE_FAILED');},
  async retire(game:SessionActiveGame){if(game.kind==='main'){await retireNativeArcadeRoom(game.code);await getD1().prepare('UPDATE rooms SET expires_at=0 WHERE code=?').bind(game.code).run();}else {await retireOnlineSocketRoom(getD1(),runtimeEnv(),game.code);await (await partyBroker()).retire(game.code);await getD1().prepare('UPDATE online_arcade_rooms SET expires_at=0 WHERE code=?').bind(game.code).run();}},
};
export async function sessionService(){await ensureDatabase();return new SessionService(getD1(),adapter);}
