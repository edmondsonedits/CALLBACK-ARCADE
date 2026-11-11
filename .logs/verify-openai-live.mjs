
import { mkdir, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
const base = process.argv[2] || "https://callback-party-game.dans-host.chatgpt.site";
const host = new Map(), players = [new Map(), new Map(), new Map()];
async function post(path, body, jar) {
  const response = await fetch(base + path, { method:"POST", headers:{"Content-Type":"application/json",Origin:base,Cookie:[...jar].map(([k,v])=>k+"="+v).join("; ")},body:JSON.stringify(body), signal:AbortSignal.timeout(160000) });
  for (const raw of response.headers.getSetCookie()) {const pair=raw.split(";")[0]; const i=pair.indexOf("=");jar.set(pair.slice(0,i),pair.slice(i+1));}
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(path + " returned " + response.status + " " + (data.error?.code || ""));
  return data;
}
let code;
const sync=jar=>post("/api/rooms/"+code+"/sync",{version:0},jar);
async function action(jar,type,payload={},isHost=true) {const s=await sync(jar);return post("/api/rooms/"+code+"/"+(isHost?"host-actions":"player-actions"),{type,actionId:randomUUID(),roundId:s.roundId,expectedPhase:s.phase,payload},jar);}
try {
  const status = await fetch(base+"/api/image-generators").then(r=>r.json());
  if (!status.openaiLow) throw new Error("OpenAI generation remains blocked: "+status.openaiCode);
  const created = await post("/api/rooms",{gameLength:"pictures",imageModel:"openai-low",contentMode:"family",timerAccessibility:false},host); code=created.code;
  for(let i=0;i<3;i++)await post("/api/rooms/"+code+"/join",{nickname:"Image QA "+(i+1)},players[i]);
  await action(host,"START_GAME");
  for(let i=0;i<10;i++){const s=await sync(host);if(s.phase==="ANSWERING")break;await action(host,"SKIP");}
  const before=await sync(players[0]);if(before.phase!=="ANSWERING")throw new Error("Could not reach answering");
  await action(players[0],"SUBMIT_ANSWER",{answer:"A royal pigeon juggling three enormous turnips"},false);
  await action(host,"SKIP");await action(host,"SKIP");
  const queued=await sync(host);
  if(!queued.imageJobsPending)throw new Error("No image job queued after phase refresh: "+queued.phase);
  const started=Date.now();
  const job=await post("/api/rooms/"+code+"/jobs/run",{},host);
  if(job.status!=="READY"||!job.live||!job.assetId)throw new Error("Live generation was not confirmed: "+job.status);
  const media=await fetch(base+"/api/rooms/"+code+"/media/"+job.assetId,{headers:{Cookie:[...host].map(([k,v])=>k+"="+v).join("; ")}});
  if(!media.ok)throw new Error("Confirmed image unavailable: "+media.status);
  const bytes=new Uint8Array(await media.arrayBuffer());if(bytes.length<1024)throw new Error("Image bytes too small");
  const output=".logs/qa-openai-live";
  await mkdir(output,{recursive:true});await writeFile(output+"/verified-low-image.webp",bytes);
  const receipt={verifiedAt:new Date().toISOString(),site:base,roomCode:code,status:job.status,live:job.live,assetId:job.assetId,bytes:bytes.length,contentType:media.headers.get("content-type"),sha256:createHash("sha256").update(bytes).digest("hex"),durationMs:Date.now()-started,outboundJobRuns:1};
  await writeFile(output+"/receipt.json",JSON.stringify(receipt,null,2));
  console.log(JSON.stringify(receipt));
} finally {
  if(code){try{await action(host,"END_GAME");}catch{console.log("QA room cleanup will use normal expiry.");}}
}
