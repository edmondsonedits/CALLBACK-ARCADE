import { authorizePhotoFace } from "../profile-faces/authorize";
import { z } from 'zod';
import { SessionGameSchema, SessionJoinSchema, SessionPresentationSchema, type SessionGame, type SessionView, type SessionRole, type SessionActiveGame } from '../../lib/session-contracts';
import { randomRoomCode, randomToken } from '../../lib/game/random';
import { normalizeNickname, validateNickname } from '../../lib/game/validators';
import { sha256Hex, timingSafeStringEqual } from '../crypto';
import { getCookie, noStoreHeaders, readJson, requireSameOrigin, sessionCookie } from '../http';
import { signSessionSocketTicket, verifySessionSocketTicket, type SessionSocketClaims } from '../../lib/session-socket-ticket';

const DAY = 24*60*60*1000;
export const sessionHostCookie = (code:string) => `callback_lobby_host_${code}`;
export const sessionSeatCookie = (code:string) => `callback_lobby_seat_${code}`;
export const sessionMirrorCookie = (code:string) => `callback_lobby_mirror_${code}`;
export interface SessionMember {id:string;session_code:string;seat:number;token_hash:string;nickname:string;nickname_normalized:string;avatar_json:string|null;avatar_preset:string|null;last_seen_at:number}
interface SessionRow {code:string;host_token_hash:string;version:number;stage:SessionView['stage'];active_id:string|null;expires_at:number}
export interface SessionAdapter {
  ticketLimit?(request:Request,scope:string):Promise<Response|null>;
  launch(request:Request,game:SessionGame,members:SessionMember[],id:string,hostHash:string):Promise<{code:string;kind:'main'|'online';title:string;hostPath:string;playPath:string;members?:string[]}>;
  credentials(request:Request,game:SessionActiveGame,member:SessionMember|null,role:SessionRole,sessionCode:string):Promise<string[]>;
  retire(game:SessionActiveGame):Promise<void>;
  close?(code:string):Promise<void>;
  reserveCode?(code:string,owner:string,expires:number):Promise<boolean>;
  socketConfig?():{secret:string;workerUrl:string};
  notify?(code:string,version:number,generation:string,revokedActors?:string[]):Promise<void>;
}
const fail = (code:string,message:string,status=409) => Response.json({error:{code,message}},{status,headers:noStoreHeaders()});
const hostAction = z.object({operation:z.enum(['launch','lobby','close','presentation','kick','reset']),version:z.number().int().positive(),game:SessionGameSchema.optional(),presentation:SessionPresentationSchema.optional(),playerId:z.string().uuid().optional()}).strict();
export class SessionService {
  constructor(private db:D1Database,private adapter:SessionAdapter,private clock:()=>number=Date.now) {}
  private async room(code:string) { if(!/^[A-HJ-KM-NP-Z2-9]{4}$/.test(code))return null;return this.db.prepare("SELECT * FROM callback_sessions WHERE code=? AND expires_at>? AND stage!='CLOSED'").bind(code,this.clock()).first<SessionRow>(); }
  private async members(code:string) {return (await this.db.prepare('SELECT * FROM callback_session_members WHERE session_code=? ORDER BY seat').bind(code).all<SessionMember>()).results;}
  private async identity(request:Request,row:SessionRow,preferPlayer=false) {
    if(new URL(request.url).searchParams.get('role')==='mirror') {
      const token=getCookie(request,sessionMirrorCookie(row.code));
      const mirror=token?await this.db.prepare('SELECT token_hash FROM callback_session_mirrors WHERE session_code=? AND token_hash=? AND last_seen_at>?').bind(row.code,await sha256Hex(token),this.clock()-DAY).first():null;
      return mirror?{role:'mirror' as const,member:null}:null;
    }
    const seat=getCookie(request,sessionSeatCookie(row.code));
    const member=seat?await this.db.prepare('SELECT * FROM callback_session_members WHERE session_code=? AND token_hash=?').bind(row.code,await sha256Hex(seat)).first<SessionMember>():null;
    if(preferPlayer&&member)return {role:'player' as const,member};
    const host=getCookie(request,sessionHostCookie(row.code));
    if(host&&timingSafeStringEqual(await sha256Hex(host),row.host_token_hash))return {role:'host' as const,member:null};
    return member?{role:'player' as const,member}:null;
  }
  private async mirrorCode(row:SessionRow):Promise<string> {
    const existing=await this.db.prepare('SELECT code FROM callback_session_mirror_codes WHERE session_code=?').bind(row.code).first<{code:string}>();
    if(existing){await this.db.prepare('UPDATE callback_session_mirror_codes SET expires_at=? WHERE session_code=?').bind(this.clock()+DAY,row.code).run();return existing.code;}
    await this.db.prepare('DELETE FROM callback_session_mirror_codes WHERE expires_at<=? AND NOT EXISTS(SELECT 1 FROM callback_sessions WHERE callback_sessions.code=callback_session_mirror_codes.session_code AND expires_at>? AND stage!=\'CLOSED\')').bind(this.clock(),this.clock()).run();
    for(let i=0;i<32;i++){
      const code=String(1000+crypto.getRandomValues(new Uint32Array(1))[0]!%9000);
      await this.db.prepare('INSERT OR IGNORE INTO callback_session_mirror_codes(code,session_code,expires_at) VALUES(?,?,?)').bind(code,row.code,this.clock()+DAY).run();
      const allocated=await this.db.prepare('SELECT code FROM callback_session_mirror_codes WHERE session_code=?').bind(row.code).first<{code:string}>();
      if(allocated)return allocated.code;
    }
    throw new Error('Could not reserve a mirror code. Try again.');
  }
  private async view(request:Request,row:SessionRow,identity:{role:SessionRole;member:SessionMember|null},status=200,extra:string[]=[]) {
    const game=row.active_id&&row.stage==='PLAYING'?await this.db.prepare('SELECT game_json FROM callback_session_games WHERE id=? AND active=1').bind(row.active_id).first<{game_json:string}>():null;
    const activeGame=game?JSON.parse(game.game_json) as SessionActiveGame:null;
    const cookies=[...extra];let frameUrl:string|null=null;
    if(activeGame){const prepared=await this.adapter.credentials(request,activeGame,identity.member,identity.role,row.code);cookies.push(...prepared);if(prepared.length)frameUrl=(identity.role==='host'?activeGame.hostPath:identity.role==='mirror'?(activeGame.kind==='main'?`/display/${activeGame.code}`:`/arcade/online/display/${activeGame.code}`):activeGame.playPath)+`?session=${row.code}`;}
    const now=this.clock();const members=await this.members(row.code);
    const stored=await this.db.prepare('SELECT presentation_json FROM callback_session_presentations WHERE session_code=?').bind(row.code).first<{presentation_json:string}>();
    const presentation=stored?SessionPresentationSchema.parse(JSON.parse(stored.presentation_json)):{category:null,extended:false,birthdayName:''};
    const value:SessionView={code:row.code,version:row.version,stage:row.stage,role:identity.role,selfId:identity.member?.id??null,activeGame,frameUrl,presentation,...(identity.role==='host'?{mirrorCode:await this.mirrorCode(row)}:{}),players:members.map(m=>({id:m.id,seat:m.seat,nickname:m.nickname,avatarConfig:m.avatar_json?JSON.parse(m.avatar_json):undefined,avatarPreset:m.avatar_preset,connected:now-m.last_seen_at<15000}))};
    const headers=noStoreHeaders();for(const c of cookies)headers.append('Set-Cookie',c);
    return Response.json(value,{status,headers});
  }
  async create(request:Request) {
    const blocked=requireSameOrigin(request);if(blocked)return blocked;
    const payload=await readJson(request);if(payload instanceof Response)return payload;
    if(!z.object({}).strict().safeParse(payload).success)return fail('INVALID_REQUEST','Create an empty lobby.',422);
    const token=randomToken(),hash=await sha256Hex(token),expires=this.clock()+DAY;
    for(let i=0;i<16;i++){const code=randomRoomCode();
      const reserve=this.adapter.reserveCode?await this.adapter.reserveCode(code,'session',expires):Number((await this.db.prepare('INSERT OR IGNORE INTO callback_code_registry(code,owner,expires_at) VALUES(?,?,?)').bind(code,'session',expires).run()).meta.changes)===1;
      if(!reserve)continue;
      await this.db.prepare("INSERT INTO callback_sessions(code,host_token_hash,version,stage,expires_at) VALUES(?,?,1,'SELECTING',?)").bind(code,hash,expires).run();
      return this.view(request,(await this.room(code))!,{role:'host',member:null},201,[sessionCookie(sessionHostCookie(code),token,86400)]);
    }return fail('CODE_EXHAUSTED','Could not create a lobby. Try again.',503);
  }
  async joinMirror(request:Request) {
    const blocked=requireSameOrigin(request);if(blocked)return blocked;
    const payload=await readJson(request);if(payload instanceof Response)return payload;
    const parsed=z.object({code:z.string().regex(/^\d{4}$/)}).strict().safeParse(payload);
    if(!parsed.success)return fail('INVALID_MIRROR_CODE','Enter the four-digit mirror code.',422);
    const codeRow=await this.db.prepare('SELECT session_code FROM callback_session_mirror_codes WHERE code=? AND expires_at>?').bind(parsed.data.code,this.clock()).first<{session_code:string}>();
    const row=codeRow?await this.room(codeRow.session_code):null;if(!row)return fail('MIRROR_NOT_FOUND','That mirror code is unavailable or expired.',404);
    const current=getCookie(request,sessionMirrorCookie(row.code));
    const existing=current?await this.db.prepare('SELECT token_hash FROM callback_session_mirrors WHERE session_code=? AND token_hash=? AND last_seen_at>?').bind(row.code,await sha256Hex(current),this.clock()-DAY).first():null;
    const token=existing?current!:randomToken(),hash=await sha256Hex(token);
    await this.db.prepare('INSERT INTO callback_session_mirrors(token_hash,session_code,last_seen_at) VALUES(?,?,?) ON CONFLICT(token_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at').bind(hash,row.code,this.clock()).run();
    const headers=new Headers(request.headers);headers.set('Cookie',(headers.get('Cookie')??'')+'; '+sessionMirrorCookie(row.code)+'='+token);
    return this.view(new Request(request.url,{headers}),row,{role:'mirror',member:null},existing?200:201,[sessionCookie(sessionMirrorCookie(row.code),token,86400)]);
  }
  async lookup(code:string){return await this.room(code)?Response.json({exists:true},{headers:noStoreHeaders()}):fail('SESSION_NOT_FOUND','That lobby has expired.',404);}
  async socketTicket(request:Request,code:string) {
    const row=await this.room(code);if(!row)return fail('SESSION_NOT_FOUND','That lobby has expired.',404);
    const requested=new URL(request.url).searchParams.get('role');
    const identity=await this.identity(request,row,requested==='player');
    if(!identity||identity.role!==requested||!['host','player','mirror'].includes(requested??''))return fail('UNAUTHORIZED','Join this lobby first.',401);

    const name=identity.role==='host'?sessionHostCookie(code):identity.role==='player'?sessionSeatCookie(code):sessionMirrorCookie(code);
    const token=getCookie(request,name);if(!token)return fail('UNAUTHORIZED','Join this lobby first.',401);
    const tokenHash=await sha256Hex(token);
    const limitActor=identity.role==='mirror'?tokenHash:identity.member?.id??identity.role;
    const limited=await this.adapter.ticketLimit?.(request,`session-ticket:${code}:${identity.role}:${limitActor}`);if(limited)return limited;
    const config=this.adapter.socketConfig?.();if(!config?.secret||!config.workerUrl)return fail('REALTIME_UNAVAILABLE','Lobby realtime is unavailable.',503);
    const claims={code,generation:row.host_token_hash,role:identity.role,actor:identity.member?.id??identity.role,tokenHash,expiresAt:this.clock()+20_000};
    const ticket=await signSessionSocketTicket(claims,config.secret,this.clock());
    const wsUrl=new URL('/sessions/'+code+'/socket',config.workerUrl);wsUrl.protocol=wsUrl.protocol==='https:'?'wss:':'ws:';
    return Response.json({ticket,url:wsUrl.toString(),expiresAt:claims.expiresAt},{headers:noStoreHeaders()});
  }
  async validateSocketTicket(request:Request,secret:string) {
    if(!secret||!timingSafeStringEqual(request.headers.get('authorization')??'','Bearer '+secret))return fail('UNAUTHORIZED','Unauthorized.',401);
    const payload=await readJson(request);if(payload instanceof Response)return payload;
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length!==1||typeof (payload as {ticket?:unknown}).ticket!=='string')return fail('INVALID_TICKET','Invalid ticket.',422);
    let claims:SessionSocketClaims;try{claims=await verifySessionSocketTicket((payload as {ticket:string}).ticket,secret,this.clock())}catch{return fail('INVALID_TICKET','Invalid ticket.',401)}
    const row=await this.room(claims.code);if(!row||row.host_token_hash!==claims.generation)return fail('UNAUTHORIZED','Ticket is no longer valid.',401);
    const tokenHash=claims.tokenHash;
    if(claims.role==='host') {if(!timingSafeStringEqual(tokenHash,row.host_token_hash))return fail('UNAUTHORIZED','Ticket is no longer valid.',401);}
    else if(claims.role==='player') {const m=await this.db.prepare('SELECT token_hash FROM callback_session_members WHERE session_code=? AND id=?').bind(claims.code,claims.actor).first<{token_hash:string}>();if(!m||m.token_hash!==tokenHash)return fail('UNAUTHORIZED','Ticket is no longer valid.',401);}
    else {const m=await this.db.prepare('SELECT token_hash FROM callback_session_mirrors WHERE session_code=? AND token_hash=? AND last_seen_at>?').bind(claims.code,tokenHash,this.clock()-DAY).first();if(!m)return fail('UNAUTHORIZED','Ticket is no longer valid.',401);}
    return Response.json({valid:true},{headers:noStoreHeaders()});
  }
  private async notify(code:string,version:number,generation:string,revokedActors:string[] = []) {const task=this.adapter.notify?.(code,version,generation,revokedActors);if(task)await Promise.race([task.catch(()=>{}),new Promise<void>(resolve=>setTimeout(resolve,500))]);}
  async avatarIdentity(request:Request,code:string,write=false) {
    const row=await this.room(code);if(!row)return null;
    const auth=await this.identity(request,row,write);
    if(!auth||(write&&!auth.member))return null;
    return {scope:`session:${row.code}`,actorId:auth.member?.id??'host',playerIds:(await this.members(code)).map(m=>m.id)};
  }
  async snapshot(request:Request,code:string){const row=await this.room(code);if(!row)return fail('SESSION_NOT_FOUND','That lobby has expired.',404);const identity=await this.identity(request,row,new URL(request.url).searchParams.get('role')==='player');if(!identity)return fail('UNAUTHORIZED','Join this lobby first.',401);const now=this.clock();await this.db.prepare('UPDATE callback_sessions SET expires_at=? WHERE code=?').bind(now+DAY,code).run();if(identity.member)await this.db.prepare('UPDATE callback_session_members SET last_seen_at=? WHERE id=?').bind(now,identity.member.id).run();if(identity.role==='mirror'){const raw=getCookie(request,sessionMirrorCookie(row.code))!;await this.db.prepare('UPDATE callback_session_mirrors SET last_seen_at=? WHERE token_hash=? AND session_code=?').bind(now,await sha256Hex(raw),code).run();}return this.view(request,row,identity);}
  async removeSessionMemberForChild(childCode:string,childPlayerId:string){
    const match=await this.db.prepare("SELECT p.token_hash FROM callback_session_games g JOIN players p ON p.room_id=(SELECT id FROM rooms WHERE code=g.child_code) WHERE g.child_code=? AND p.id=? AND p.removed_at IS NOT NULL ORDER BY g.created_at DESC LIMIT 1").bind(childCode,childPlayerId).first<{token_hash:string}>();
    if(match)await this.removeSessionMemberForToken(childCode,match.token_hash);
  }
  async removeSessionMemberForToken(childCode:string,tokenHash:string){
    for(let attempt=0;attempt<8;attempt++){
      const match=await this.db.prepare("SELECT g.session_code,m.id,s.host_token_hash,s.version FROM callback_session_games g JOIN callback_sessions s ON s.code=g.session_code JOIN callback_session_members m ON m.session_code=g.session_code AND m.token_hash=? WHERE g.child_code=? AND s.stage!='CLOSED' ORDER BY g.created_at DESC LIMIT 1").bind(tokenHash,childCode).first<{session_code:string;id:string;host_token_hash:string;version:number}>();
      if(!match)return;
      const next=match.version+1,actionId=crypto.randomUUID();
      const result=await this.db.batch([
        this.db.prepare("UPDATE callback_sessions SET version=?,last_action_id=? WHERE code=? AND version=? AND stage!='CLOSED'").bind(next,actionId,match.session_code,match.version),
        this.db.prepare('DELETE FROM callback_session_members WHERE session_code=? AND id=? AND EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND last_action_id=?)').bind(match.session_code,match.id,match.session_code,actionId),
      ]);
      if(Number(result[0]?.meta.changes)===1){await this.notify(match.session_code,next,match.host_token_hash,[match.id]);return;}
    }
    throw new Error('SESSION_MEMBERSHIP_BUSY');
  }
  async join(request:Request,code:string){const blocked=requireSameOrigin(request);if(blocked)return blocked;const payload=await readJson(request);if(payload instanceof Response)return payload;const parsed=SessionJoinSchema.safeParse(payload);if(!parsed.success)return fail('INVALID_PLAYER','Enter a valid name and character.',422);const row=await this.room(code);if(!row)return fail('SESSION_NOT_FOUND','That lobby has expired.',404);
    const faceError=await authorizePhotoFace(request,parsed.data.avatarConfig?.photoFaceId,this.db);if(faceError)return faceError;
    let nickname:string;try{nickname=validateNickname(parsed.data.nickname);}catch{return fail('INVALID_NICKNAME','Use a name with 1–20 characters.',422);}
    const existing=await this.identity(request,row,true);const avatar=parsed.data.avatarConfig?JSON.stringify(parsed.data.avatarConfig):null;
    if(existing?.member){if(row.stage==='SELECTING'){await this.db.prepare('UPDATE callback_session_members SET avatar_json=COALESCE(?,avatar_json),avatar_preset=?,last_seen_at=? WHERE id=?').bind(avatar,parsed.data.avatarPreset??existing.member.avatar_preset,this.clock(),existing.member.id).run();await this.notify(code,row.version,row.host_token_hash);}return this.view(request,row,{role:'player',member:existing.member});}
    const token=randomToken(),hash=await sha256Hex(token),id=crypto.randomUUID();
    try {const added=await this.db.prepare(`WITH slots(seat) AS(VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) INSERT INTO callback_session_members(id,session_code,seat,token_hash,nickname,nickname_normalized,avatar_json,avatar_preset,last_seen_at) SELECT ?,?,slots.seat,?,?,?,?,?,? FROM slots WHERE NOT EXISTS(SELECT 1 FROM callback_session_members WHERE session_code=? AND seat=slots.seat) AND EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND stage!='CLOSED' AND expires_at>?) ORDER BY slots.seat LIMIT 1`).bind(id,code,hash,nickname,normalizeNickname(nickname),avatar,parsed.data.avatarPreset??null,this.clock(),code,code,this.clock()).run();if(Number(added.meta.changes)!==1)return fail('ROOM_FULL','This lobby already has ten players.');}
    catch(e){if(/unique|constraint/i.test(String(e)))return fail('DUPLICATE_NICKNAME','That name is already in the lobby.');throw e;}
    const member=(await this.db.prepare('SELECT * FROM callback_session_members WHERE id=?').bind(id).first<SessionMember>())!;
    await this.notify(code,row.version,row.host_token_hash);
    return this.view(request,row,{role:'player',member},201,[sessionCookie(sessionSeatCookie(code),token,86400)]);
  }
  async host(request:Request,code:string){const blocked=requireSameOrigin(request);if(blocked)return blocked;const payload=await readJson(request);if(payload instanceof Response)return payload;const parsed=hostAction.safeParse(payload);if(!parsed.success)return fail('INVALID_ACTION','Choose a valid lobby action.',422);const row=await this.room(code);if(!row)return fail('SESSION_NOT_FOUND','That lobby has expired.',404);const identity=await this.identity(request,row);if(identity?.role!=='host')return fail('UNAUTHORIZED','Only the host can choose a game.',401);if(parsed.data.version!==row.version)return fail('LOBBY_CHANGED','The lobby changed. Try once more.');
    if(parsed.data.operation==='kick'){
      if(row.stage!=='SELECTING')return fail('GAME_ACTIVE','Players can be removed from the lobby between games.');
      if(!parsed.data.playerId)return fail('PLAYER_REQUIRED','Choose a player to remove.',422);
      const member=await this.db.prepare('SELECT id FROM callback_session_members WHERE session_code=? AND id=?').bind(code,parsed.data.playerId).first<{id:string}>();
      if(!member)return fail('PLAYER_NOT_FOUND','That player is no longer in the lobby.',404);
      const version=row.version+1,actionId=crypto.randomUUID();
      const result=await this.db.batch([
        this.db.prepare("UPDATE callback_sessions SET version=?,last_action_id=? WHERE code=? AND version=? AND stage='SELECTING'").bind(version,actionId,code,row.version),
        this.db.prepare('DELETE FROM callback_session_members WHERE session_code=? AND id=? AND EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND last_action_id=?)').bind(code,member.id,code,actionId),
      ]);
      if(Number(result[0]?.meta.changes)!==1)return fail('LOBBY_CHANGED','The lobby changed. Try once more.');
      await this.notify(code,version,row.host_token_hash,[member.id]);
      return this.view(request,{...row,version},identity);
    }
    if(parsed.data.operation==='presentation'){
      if(!parsed.data.presentation)return fail('INVALID_PRESENTATION','Choose valid menu options.',422);
      if(row.stage!=='SELECTING')return fail('GAME_ACTIVE','Return to the lobby before changing the menu.');
      const actionId=crypto.randomUUID(),nextVersion=row.version+1;
      const result=await this.db.batch([
        this.db.prepare("UPDATE callback_sessions SET version=?,last_action_id=? WHERE code=? AND version=? AND stage='SELECTING'").bind(nextVersion,actionId,code,row.version),
        this.db.prepare('INSERT INTO callback_session_presentations(session_code,presentation_json) SELECT ?,? WHERE EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND last_action_id=?) ON CONFLICT(session_code) DO UPDATE SET presentation_json=excluded.presentation_json').bind(code,JSON.stringify(parsed.data.presentation),code,actionId),
      ]);
      if(Number(result[0]?.meta.changes)!==1)return fail('LOBBY_CHANGED','The menu changed. Try once more.');
      await this.notify(code,nextVersion,row.host_token_hash);
      return this.view(request,{...row,version:nextVersion},identity);
    }
    const previous=row.active_id?await this.db.prepare('SELECT game_json FROM callback_session_games WHERE id=?').bind(row.active_id).first<{game_json:string}>():null;
    const launch=parsed.data.operation==='launch';if(launch&&!parsed.data.game)return fail('GAME_REQUIRED','Choose a game.',422);
    const id=crypto.randomUUID(),version=row.version+1,stage=launch?'PREPARING':parsed.data.operation==='close'?'CLOSED':'SELECTING';
    const result=await this.db.batch([
      this.db.prepare('UPDATE callback_sessions SET version=?,stage=?,active_id=?,last_action_id=?,expires_at=? WHERE code=? AND version=?').bind(version,stage,launch?id:null,id,this.clock()+DAY,code,row.version),
      this.db.prepare('UPDATE callback_session_games SET active=0 WHERE session_code=? AND active=1 AND EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND last_action_id=?)').bind(code,code,id),
      ...(['lobby','reset'].includes(parsed.data.operation)?[this.db.prepare("UPDATE callback_session_presentations SET presentation_json=json_set(presentation_json,'$.category',NULL) WHERE session_code=? AND EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND last_action_id=?)").bind(code,code,id)]:[]),
    ]);if(Number(result[0]?.meta.changes)!==1)return fail('LOBBY_CHANGED','Another host action arrived first.');
    if(previous?.game_json&&previous.game_json!=='{}'){try{await this.adapter.retire(JSON.parse(previous.game_json));}catch{await this.db.batch([this.db.prepare('UPDATE callback_sessions SET stage=?,active_id=?,version=version+1 WHERE code=? AND last_action_id=?').bind(row.stage,row.active_id,code,id),this.db.prepare('UPDATE callback_session_games SET active=1 WHERE id=? AND EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND last_action_id=?)').bind(row.active_id,code,id)]);await this.notify(code,row.version+2,row.host_token_hash);return fail('GAME_UNAVAILABLE','The previous game is still closing. Try New Game again.');}}
    if(parsed.data.operation==='reset'){
      const revokedActors=(await this.members(code)).map(member=>member.id),resetVersion=version+1,resetId=crypto.randomUUID();
      const cleared=await this.db.batch([
        this.db.prepare("UPDATE callback_sessions SET version=?,last_action_id=? WHERE code=? AND version=? AND stage='SELECTING' AND active_id IS NULL").bind(resetVersion,resetId,code,version),
        this.db.prepare('DELETE FROM callback_session_members WHERE session_code=? AND EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND last_action_id=?)').bind(code,code,resetId),
      ]);
      if(Number(cleared[0]?.meta.changes)!==1)return fail('LOBBY_CHANGED','The lobby changed. Try once more.');
      await this.notify(code,resetVersion,row.host_token_hash,revokedActors);
      return this.view(request,{...row,version:resetVersion,stage:'SELECTING',active_id:null},identity);
    }
    if(!launch){if(stage==='CLOSED'){try{await this.adapter.close?.(code);}catch{await this.db.prepare("UPDATE callback_sessions SET stage='SELECTING',version=version+1 WHERE code=? AND last_action_id=?").bind(code,id).run();await this.notify(code,row.version+2,row.host_token_hash);return fail('GAME_UNAVAILABLE','The lobby is still closing. Try again.');}}await this.notify(code,version,row.host_token_hash);return this.view(request,{...row,version,stage,active_id:null},identity);}
    await this.db.prepare('INSERT INTO callback_session_games(id,session_code,child_kind,game_json,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND active_id=?)').bind(id,code,parsed.data.game!.kind,'{}',this.clock(),code,id).run();
    try{const child=await this.adapter.launch(request,parsed.data.game!,await this.members(code),id,row.host_token_hash);const game:SessionActiveGame={id,...child};
      const saved=await this.db.batch([this.db.prepare('UPDATE callback_sessions SET stage=\'PLAYING\',version=version+1 WHERE code=? AND active_id=? AND stage=\'PREPARING\' AND version=? AND last_action_id=?').bind(code,id,version,id),this.db.prepare("UPDATE callback_session_games SET child_code=?,game_json=? WHERE id=? AND active=1 AND EXISTS(SELECT 1 FROM callback_sessions WHERE code=? AND active_id=? AND stage='PLAYING' AND version=? AND last_action_id=?)").bind(child.code,JSON.stringify(game),id,code,id,version+1,id)]);
      if(Number(saved[0]?.meta.changes)!==1||Number(saved[1]?.meta.changes)!==1){await this.adapter.retire(game);const cleaned=await this.db.batch([this.db.prepare("UPDATE callback_sessions SET stage='SELECTING',active_id=NULL,version=version+1 WHERE code=? AND active_id=? AND stage IN('PREPARING','PLAYING')").bind(code,id),this.db.prepare('UPDATE callback_session_games SET active=0 WHERE id=?').bind(id)]);if(Number(cleaned[0]?.meta.changes)===1){const current=await this.db.prepare('SELECT version FROM callback_sessions WHERE code=?').bind(code).first<{version:number}>();if(current)await this.notify(code,current.version,row.host_token_hash);}return fail('LOBBY_CHANGED','Game selection changed while loading.');}
      await this.notify(code,version+1,row.host_token_hash);return this.view(request,(await this.room(code))!,identity);
    }catch(e){await this.db.prepare("UPDATE callback_sessions SET stage='SELECTING',active_id=NULL,version=version+1 WHERE code=? AND active_id=?").bind(code,id).run();await this.db.prepare('UPDATE callback_session_games SET active=0 WHERE id=?').bind(id).run();await this.notify(code,row.version+2,row.host_token_hash);return fail('GAME_UNAVAILABLE',e instanceof Error&&/Choose|requires|players|birthday/.test(e.message)?e.message:'That game could not load. Choose again.');}
  }
}
