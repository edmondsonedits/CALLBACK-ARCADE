import type {BrowserContext} from '@playwright/test';

/** Release only this test's standalone party rooms; preserve the real one-party admission cap. */
export class OwnedPartyRooms {
  private rooms = new Map<string,{base:string;cookie:string}>();
  async track(context:BrowserContext,code:string,base:string) {
    const cookies=await context.cookies(base);
    const host=cookies.find(c=>c.name===`callback_host_${code}`);
    if(!host)throw Error('Test room has no host credential');
    this.rooms.set(code,{base,cookie:`${host.name}=${host.value}`});
  }
  async closeAll() {
    for(const [code,{base,cookie}]of this.rooms){
      try{
        const headers={Origin:base,Cookie:cookie,'Content-Type':'application/json','X-Callback-Test-Mode':'deterministic-matrix','X-Callback-Role':'host'};
        const response=await fetch(`${base}/api/rooms/${code}/sync`,{method:'POST',headers,body:'{"version":0}'});
        if(!response.ok)continue;
        const snapshot=await response.json() as {phase:string;roundId:string};
        const ended=await fetch(`${base}/api/rooms/${code}/host-actions`,{method:'POST',headers,body:JSON.stringify({type:'END_GAME',actionId:crypto.randomUUID(),roundId:snapshot.roundId,expectedPhase:snapshot.phase,payload:{}})});
        if(!ended.ok)console.warn(`Test-owned party room ${code} cleanup returned ${ended.status}`);
      }catch{console.warn(`Test-owned party room ${code} cleanup was unavailable`);}
    }
    this.rooms.clear();
  }
}
