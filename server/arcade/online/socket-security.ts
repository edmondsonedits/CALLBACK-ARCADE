import { z } from 'zod';

const claimsSchema=z.object({v:z.literal(1),code:z.string().regex(/^[A-HJ-KM-NP-Z2-9]{4}$/),gameId:z.string().regex(/^[a-z-]{1,48}$/),generation:z.string().min(1).max(120),role:z.enum(['host','player','display']),seatId:z.string().regex(/^0[0-9]$/).nullable(),seatTokenHash:z.string().regex(/^[a-f0-9]{64}$/).nullable(),expiresAt:z.number().int().positive(),nonce:z.string().uuid()}).strict();
export type OnlineSocketClaims=z.infer<typeof claimsSchema>;
const enc=new TextEncoder();
function b64(data:Uint8Array){let raw='';for(const b of data)raw+=String.fromCharCode(b);return btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
function unb64(s:string){if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('TICKET_INVALID');const v=s.replaceAll('-','+').replaceAll('_','/');return Uint8Array.from(atob(v+'='.repeat((4-v.length%4)%4)),c=>c.charCodeAt(0))}
async function mac(payload:string,secret:string){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(payload)))}
export async function signOnlineSocketTicket(value:OnlineSocketClaims,secret:string){const claims=claimsSchema.parse(value),payload=b64(enc.encode(JSON.stringify(claims)));return payload+'.'+b64(await mac(payload,secret))}
export async function verifyOnlineSocketTicket(ticket:string,secret:string,now=Date.now()):Promise<OnlineSocketClaims>{if(ticket.length>2048)throw Error('TICKET_INVALID');const parts=ticket.split('.');if(parts.length!==2)throw Error('TICKET_INVALID');const expected=await mac(parts[0]!,secret),actual=unb64(parts[1]!);if(expected.length!==actual.length||expected.some((x,i)=>x!==actual[i]))throw Error('TICKET_INVALID');const claims=claimsSchema.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(unb64(parts[0]!))));if(claims.expiresAt<=now||claims.expiresAt>now+35000)throw Error('TICKET_EXPIRED');return claims}
