export interface PartyClaims {v:1;partyId:string;roomCode:string;matchId:string;role:"host"|"player"|"display";seatId:string|null;memberId:string|null;name:string;expiresAt:number;nonce:string}
const encoder=new TextEncoder(),decoder=new TextDecoder("utf-8",{fatal:true}),ttl=30_000;
function b64(bytes:Uint8Array):string{let binary="";for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/u,"")}
function unb64(value:string):Uint8Array{if(!/^[A-Za-z0-9_-]+$/u.test(value))throw new Error("PARTY_TICKET_MALFORMED");const p=value.replaceAll("-","+").replaceAll("_","/");return Uint8Array.from(atob(p+"=".repeat((4-p.length%4)%4)),c=>c.charCodeAt(0))}
function validate(value:unknown):PartyClaims{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("PARTY_TICKET_MALFORMED");
  const x=value as Record<string,unknown>,keys=["v","partyId","roomCode","matchId","role","seatId","memberId","name","expiresAt","nonce"];
  if(Object.keys(x).length!==keys.length||Object.keys(x).some(k=>!keys.includes(k))||x.v!==1||typeof x.partyId!=="string"||!/^[-\w]{1,80}$/u.test(x.partyId)||typeof x.roomCode!=="string"||!/^[A-Z0-9]{4,8}$/u.test(x.roomCode)||typeof x.matchId!=="string"||!x.matchId||x.matchId.length>120||!["host","player","display"].includes(String(x.role))||(x.role==="player"?typeof x.seatId!=="string"||typeof x.memberId!=="string":x.seatId!==null||x.memberId!==null)||typeof x.name!=="string"||x.name.length>40||!Number.isSafeInteger(x.expiresAt)||typeof x.nonce!=="string"||!/^[A-Za-z0-9_-]{16,80}$/u.test(x.nonce))throw new Error("PARTY_TICKET_MALFORMED");
  return x as unknown as PartyClaims;
}
async function mac(value:string,secret:string):Promise<Uint8Array>{if(!secret)throw new Error("PARTY_SECRET_MISSING");const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(value)))}
function equal(a:Uint8Array,b:Uint8Array):boolean{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]!^b[i]!;return x===0}
export async function signPartyTicket(claims:PartyClaims,secret:string):Promise<string>{const valid=validate(claims),payload=b64(encoder.encode(JSON.stringify(valid)));return `${payload}.${b64(await mac(payload,secret))}`}
export async function verifyPartyTicket(ticket:string,secret:string,now=Date.now()):Promise<PartyClaims>{
  if(typeof ticket!=="string"||ticket.length>2048)throw new Error("PARTY_TICKET_MALFORMED");const parts=ticket.split(".");if(parts.length!==2)throw new Error("PARTY_TICKET_MALFORMED");
  let expected:Uint8Array,supplied:Uint8Array,claims:PartyClaims;try{expected=await mac(parts[0]!,secret);supplied=unb64(parts[1]!);claims=validate(JSON.parse(decoder.decode(unb64(parts[0]!))));}catch(error){if(error instanceof Error&&error.message.startsWith("PARTY_TICKET_"))throw error;throw new Error("PARTY_TICKET_MALFORMED")}
  if(!equal(expected,supplied))throw new Error("PARTY_TICKET_SIGNATURE");if(claims.expiresAt<=now)throw new Error("PARTY_TICKET_EXPIRED");if(claims.expiresAt>now+ttl+5_000)throw new Error("PARTY_TICKET_MALFORMED");return claims;
}
