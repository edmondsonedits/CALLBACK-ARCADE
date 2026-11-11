export function fishPngCrc(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^(0xedb88320&-(c&1));}return(c^0xffffffff)>>>0;}
export const FISH_MAX_BYTES=3*1024*1024;
export class FishPngError extends Error {}
export async function readFishPng(request:Request){
 if(request.headers.get("content-type")?.split(";")[0]!=="image/png"||!request.body)throw new FishPngError("Send a transparent PNG.");
 const reader=request.body.getReader();let total=0;const chunks:Uint8Array[]=[];let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([(async()=>{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>FISH_MAX_BYTES){void reader.cancel();throw new FishPngError("Fish image exceeds 3 MiB.");}chunks.push(value);}})(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel();reject(new FishPngError("Upload timed out. Retry your fish."));},10000);})]);}finally{if(timer)clearTimeout(timer);reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 return{bytes,...await validateFishPng(bytes)};
}
export async function validateFishPng(bytes:Uint8Array){
 const fail=()=>{throw new FishPngError("Use a complete transparent RGBA PNG, at most 1024 × 768.");};
 if(bytes.length<45||bytes.length>FISH_MAX_BYTES||[137,80,78,71,13,10,26,10].some((n,i)=>bytes[i]!==n))return fail();
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); const width=view.getUint32(16),height=view.getUint32(20);
 if(view.getUint32(8)!==13||String.fromCharCode(...bytes.slice(12,16))!=="IHDR"||!width||width>1024||!height||height>768||bytes[24]!==8||bytes[25]!==6||bytes[26]!==0||bytes[27]!==0||bytes[28]!==0)return fail();
 let offset=8,complete=false,seenData=false,dataEnded=false;const data:Uint8Array[]=[];
 while(offset+12<=bytes.length){const length=view.getUint32(offset),end=offset+length+12;if(end>bytes.length)return fail();const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));if(fishPngCrc(bytes.subarray(offset+4,end-4))!==view.getUint32(end-4))return fail();if(type==="IDAT"){if(dataEnded)return fail();seenData=true;data.push(bytes.slice(offset+8,end-4));}else if(seenData)dataEnded=true;if(!["IHDR","IDAT","IEND"].includes(type)&&type[0]===type[0].toUpperCase())return fail();if(type==="IEND"){complete=length===0&&end===bytes.length;break;}if(type==="acTL"||type==="IHDR"&&offset!==8)return fail();offset=end;}
 if(!complete||!data.length)return fail();
 const packed=new Uint8Array(data.reduce((n,a)=>n+a.length,0));offset=0;for(const a of data){packed.set(a,offset);offset+=a.length;}
 const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate"));const reader=stream.getReader();const expected=(width*4+1)*height;const decoded=new Uint8Array(expected);let read=0;
 try{while(true){const x=await reader.read();if(x.done)break;if(read+x.value.length>expected){await reader.cancel();return fail();}decoded.set(x.value,read);read+=x.value.length;}}catch{return fail();}finally{reader.releaseLock();}
 if(read!==expected)return fail();
 // Undo PNG row filters to confirm the texture has both artwork and transparent water.
 const stride=width*4;let previous=new Uint8Array(stride);let visible=false,transparent=false,minX=width,minY=height,maxX=0,maxY=0;
 for(let y=0;y<height;y++){const start=y*(stride+1),filter=decoded[start];if(filter>4)return fail();const row=decoded.slice(start+1,start+1+stride);for(let x=0;x<stride;x++){const a=x>=4?row[x-4]:0,b=previous[x],c=x>=4?previous[x-4]:0;let p=0;if(filter===1)p=a;else if(filter===2)p=b;else if(filter===3)p=Math.floor((a+b)/2);else if(filter===4){const t=a+b-c,pa=Math.abs(t-a),pb=Math.abs(t-b),pc=Math.abs(t-c);p=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}row[x]=(row[x]+p)&255;if(x%4===3){visible ||= row[x]>0;transparent ||= row[x]===0;if(row[x]>0){const px=(x-3)/4;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}}previous=row;}
 if(!visible||!transparent)throw new FishPngError("Keep the water transparent and add some fish artwork.");
 return{width,height,bounds:{x:minX/width,y:minY/height,width:(maxX-minX+1)/width,height:(maxY-minY+1)/height}};
}
