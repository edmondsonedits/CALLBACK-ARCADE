import { z } from 'zod';
import { partyResultEventKey } from '../../lib/party/protocol';
import { signPartyTicket } from '../../lib/party/security';
import { sha256Hex, timingSafeStringEqual } from '../crypto';
import { getCookie, noStoreHeaders, readJson, requireSameOrigin } from '../http';
import type { SessionMember } from '../sessions/service';

export interface PartyConfig {PARTY_SECRET?:string;PARTY_WORKER_URL?:string}
interface PartyRow {code:string;game_id:string;host_token_hash:string;version:number;state_json:string;expires_at:number}
interface Binding {id:string;session_code:string;active:number;stage:string;active_id:string|null;expires_at:number}
const issueSchema=z.object({role:z.enum(['host','player','display'])}).strict();
const seats=z.string().regex(/^0[0-9]$/);
const resultSchema=z.object({v:z.literal(1),partyId:z.string().min(1).max(80),roomCode:z.string().regex(/^[A-HJ-KM-NP-Z2-9]{4}$/),matchId:z.string().min(1).max(120),epoch:z.number().int().nonnegative(),eventKey:z.string().min(1).max(240),winners:z.array(seats).max(10),scores:z.record(seats,z.number().finite().min(0).max(100000)),round:z.number().int().nonnegative().max(10000)}).strict();
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:noStoreHeaders({'content-type':'application/json'})});
const fail=(message:string,status=409)=>json({error:{message}},status);
export class PartyBroker {
  constructor(private db:D1Database,private config:PartyConfig,private send:typeof fetch=fetch,private clock=Date.now){}
  private url(){const raw=this.config.PARTY_WORKER_URL;if(!raw||!this.config.PARTY_SECRET||this.config.PARTY_SECRET.length<32)throw new Error('Choose again after the Sumo pilot is configured.');const url=new URL(raw);if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))throw new Error('Choose again after the Sumo pilot is configured.');return url;}
  async prepare(partyId:string,roomCode:string,matchId:string,members:SessionMember[],options:Record<string,unknown>){
    const url=this.url();url.pathname=`/parties/${encodeURIComponent(partyId)}/control`;
    const response=await this.send(url,{method:'POST',headers:{authorization:'Bearer '+this.config.PARTY_SECRET,'content-type':'application/json'},body:JSON.stringify({operation:'prepare',partyId,roomCode,matchId,roster:members.map(m=>({id:String(m.seat).padStart(2,'0'),memberId:m.id,name:m.nickname})),options}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(response.status===409?'Choose again when the other Sumo pilot party has finished.':'Choose again. The Sumo pilot server could not connect.');
  }
  async retire(roomCode:string){const row=await this.db.prepare('SELECT * FROM online_arcade_rooms WHERE code=?').bind(roomCode).first<PartyRow>();if(!row)return;const state=JSON.parse(row.state_json);if(!state.options?.realtimePilot)return;const url=this.url();url.pathname=`/parties/${encodeURIComponent(state.options.partyId)}/control`;const response=await this.send(url,{method:'POST',headers:{authorization:'Bearer '+this.config.PARTY_SECRET,'content-type':'application/json'},body:JSON.stringify({operation:'retire',partyId:state.options.partyId,roomCode,matchId:state.matchId}),signal:AbortSignal.timeout(10000)});if(!response.ok&&response.status!==409)throw new Error('Sumo server could not retire the game.');}
  async ticket(request:Request,code:string){
    const blocked=requireSameOrigin(request);if(blocked)return blocked;const body=await readJson(request);if(body instanceof Response)return body;const parsed=issueSchema.safeParse(body);if(!parsed.success)return fail('Choose a valid controller role.',422);
    const row=await this.db.prepare('SELECT * FROM online_arcade_rooms WHERE code=?').bind(code).first<PartyRow>();if(!row||row.expires_at<=this.clock())return fail('That Sumo game expired.',404);
    const state=JSON.parse(row.state_json);if(row.game_id!=='sumo'||state.options?.realtimePilot!==true)return fail('This game uses its existing connection.');
    const binding=await this.db.prepare('SELECT g.id,g.session_code,g.active,s.stage,s.active_id,s.expires_at FROM callback_session_games g JOIN callback_sessions s ON s.code=g.session_code WHERE g.child_code=? AND g.child_kind=\'online\' AND g.id=?').bind(code,state.matchId).first<Binding>();
    if(!binding||!binding.active||binding.active_id!==binding.id||binding.stage!=='PLAYING'||binding.expires_at<=this.clock())return fail('The party has moved to another game.');
    const role=parsed.data.role,raw=getCookie(request,role==='display'?`callback_lobby_mirror_${binding.session_code}`:`callback_arcade_${role==='host'?'host':'seat'}_${code}`);if(!raw)return fail('Rejoin your party to connect.',401);const hash=await sha256Hex(raw);let member:SessionMember|null=null;
    if(role==='host'){if(!timingSafeStringEqual(row.host_token_hash,hash))return fail('Only the host can start this game.',401);}else if(role==='display'){const display=await this.db.prepare('SELECT token_hash FROM callback_session_mirrors WHERE session_code=? AND token_hash=?').bind(binding.session_code,hash).first();if(!display)return fail('Open a valid mirror invitation.',401);}else{member=await this.db.prepare('SELECT m.* FROM callback_session_members m JOIN online_arcade_seats a ON a.token_hash=m.token_hash AND a.seat_id=printf(\'%02d\',m.seat) WHERE m.session_code=? AND a.room_code=? AND m.token_hash=?').bind(binding.session_code,code,hash).first<SessionMember>();if(!member)return fail('Rejoin your party to connect.',401);}
    let url:URL;try{url=this.url();}catch{return fail('The Sumo pilot is unavailable.',503);}url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname=`/parties/${encodeURIComponent(state.options.partyId)}/socket`;
    const ticket=await signPartyTicket({v:1,partyId:state.options.partyId,roomCode:code,matchId:state.matchId,role,seatId:member?String(member.seat).padStart(2,'0'):null,memberId:member?.id??null,name:member?.nickname??'Host',expiresAt:this.clock()+30000,nonce:crypto.randomUUID()},this.config.PARTY_SECRET!);
    return json({ticket,socketUrl:url.href});
  }
  async result(request:Request){
    if(!this.config.PARTY_SECRET||!timingSafeStringEqual(request.headers.get('authorization')??'','Bearer '+this.config.PARTY_SECRET))return fail('Unauthorized result.',401);
    const body=await readJson(request);if(body instanceof Response)return body;const parsed=resultSchema.safeParse(body);if(!parsed.success)return fail('Invalid result.',422);const event=parsed.data;
    if(event.eventKey!==partyResultEventKey(event.partyId,event.matchId,event.epoch))return fail('Invalid result key.',422);
    for(let attempt=0;attempt<4;attempt++){
      const prior=await this.db.prepare('SELECT result_json FROM online_arcade_results WHERE event_key=?').bind(event.eventKey).first<{result_json:string}>();if(prior)return prior.result_json===JSON.stringify(event)?json({accepted:true,duplicate:true}):fail('Result key already has different contents.');
      const row=await this.db.prepare('SELECT * FROM online_arcade_rooms WHERE code=?').bind(event.roomCode).first<PartyRow>();if(!row)return fail('Unknown result room.');const state=JSON.parse(row.state_json);
      if(row.game_id!=='sumo'||state.options?.realtimePilot!==true||state.options.partyId!==event.partyId||state.matchId!==event.matchId)return fail('Result belongs to another game.');
      const binding=await this.db.prepare('SELECT active FROM callback_session_games WHERE id=? AND child_code=? AND child_kind=\'online\'').bind(event.matchId,event.roomCode).first<{active:number}>();if(!binding)return fail('Unknown party match.');
      const now=this.clock(),active=binding.active===1&&row.expires_at>now&&event.epoch>=(state.lastResult?.epoch??-1);
      if(active){state.lastResult=event;state.round=event.round;state.status='RESULT';state.cupComplete=true;state.wins={...state.wins};for(const winner of event.winners)state.wins[winner]=(state.wins[winner]??0)+1;state.version=row.version+1;}
      const result=await this.db.batch([
        this.db.prepare('INSERT OR IGNORE INTO online_arcade_results(event_key,room_code,match_id,result_json,occurred_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM online_arcade_rooms WHERE code=? AND version=?)').bind(event.eventKey,event.roomCode,event.matchId,JSON.stringify(event),now,event.roomCode,row.version),
        this.db.prepare('UPDATE online_arcade_rooms SET version=version+1,status=?,state_json=?,updated_at=? WHERE code=? AND version=? AND EXISTS(SELECT 1 FROM online_arcade_results WHERE event_key=? AND occurred_at=?) AND ?=1 AND EXISTS(SELECT 1 FROM callback_session_games WHERE id=? AND active=1)').bind(active?'RESULT':'LOBBY',JSON.stringify(state),now,event.roomCode,row.version,event.eventKey,now,active?1:0,event.matchId),
      ]);
      if(Number(result[0]?.meta.changes)===1)return json({accepted:true});
    }
    return fail('Result storage is busy. Retry.');
  }
}
