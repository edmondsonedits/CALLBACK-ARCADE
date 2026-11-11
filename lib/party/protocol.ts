export type PartyRole="host"|"player"|"display";
export type PartyInputMessage={type:"input";v:1;epoch:number;seq:number;x:number;y:number;bashDown:boolean;dash:boolean};
export type PartyControlMessage={type:"control";v:1;epoch:number;seq:number;operation:"start"|"pause"|"resume"|"lobby"|"bot";seatId?:string;enabled?:boolean};
export type PartyPingMessage={type:"ping";at:number};
export type PartyMessage=PartyInputMessage|PartyControlMessage|PartyPingMessage;

const validSeq=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0;
export function validatePartyMessage(raw:unknown,role?:PartyRole):PartyMessage {
  const bytes=typeof raw==="string"?new TextEncoder().encode(raw).byteLength:raw instanceof ArrayBuffer?raw.byteLength:raw instanceof Uint8Array?raw.byteLength:Infinity;
  if(bytes>1024)throw new Error("PARTY_FRAME_TOO_LARGE");
  let value:unknown;
  try{value=typeof raw==="string"?JSON.parse(raw):raw instanceof ArrayBuffer?JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw)):raw instanceof Uint8Array?JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(raw)):raw;}catch{throw new Error("PARTY_MESSAGE_INVALID")}
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("PARTY_MESSAGE_INVALID");
  const v=value as Record<string,unknown>;
  if(v.type==="ping"&&validSeq(v.at)&&Object.keys(v).every(k=>["type","at"].includes(k)))return {type:"ping",at:v.at};
  if(v.type==="input"){
    if(role&&role!=="player")throw new Error("PARTY_ROLE_FORBIDDEN");
    if(v.v!==1||!validSeq(v.epoch)||!validSeq(v.seq)||typeof v.x!=="number"||!Number.isFinite(v.x)||Math.abs(v.x)>1||typeof v.y!=="number"||!Number.isFinite(v.y)||Math.abs(v.y)>1||typeof v.bashDown!=="boolean"||typeof v.dash!=="boolean"||Object.keys(v).some(k=>!["type","v","epoch","seq","x","y","bashDown","dash"].includes(k)))throw new Error("PARTY_INPUT_INVALID");
    return {type:"input",v:1,epoch:v.epoch,seq:v.seq,x:v.x,y:v.y,bashDown:v.bashDown,dash:v.dash};
  }
  if(v.type==="control"){
    if(role&&role!=="host")throw new Error("PARTY_ROLE_FORBIDDEN");
    if(v.v!==1||!validSeq(v.epoch)||!validSeq(v.seq)||!["start","pause","resume","lobby","bot"].includes(String(v.operation))||Object.keys(v).some(k=>!["type","v","epoch","seq","operation","seatId","enabled"].includes(k)))throw new Error("PARTY_CONTROL_INVALID");
    if(v.operation==="bot"?typeof v.seatId!=="string"||!/^0[0-9]$/.test(v.seatId)||typeof v.enabled!=="boolean":v.seatId!==undefined||v.enabled!==undefined)throw new Error("PARTY_CONTROL_INVALID");
    return {type:"control",v:1,epoch:v.epoch,seq:v.seq,operation:v.operation as PartyControlMessage["operation"],...(v.operation==="bot"?{seatId:v.seatId as string,enabled:v.enabled as boolean}:{})};
  }
  throw new Error("PARTY_MESSAGE_INVALID");
}

export const partyResultEventKey=(partyId:string,matchId:string,epoch:number)=>`sumo:${partyId}:${matchId}:${epoch}:result`;
