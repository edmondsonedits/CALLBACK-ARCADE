import {onlineService} from '../../../../../../../server/arcade/online/runtime';
import {getD1} from '../../../../../../../server/database';
import {sessionService} from '../../../../../../../server/sessions/runtime';
export async function POST(request:Request,context:{params:Promise<{code:string}>}){
 const code=(await context.params).code.toUpperCase(),service=await onlineService(),body=await request.clone().json().catch(()=>null) as {operation?:unknown;seatId?:unknown}|null;
 const removed=body?.operation==='remove'&&typeof body.seatId==='string'?await getD1().prepare('SELECT token_hash FROM online_arcade_seats WHERE room_code=? AND seat_id=?').bind(code,body.seatId).first<{token_hash:string}>():null;
 const response=await service.host(request,code);
 if(response.ok&&removed)await(await sessionService()).removeSessionMemberForToken(code,removed.token_hash);
 return response;
}
