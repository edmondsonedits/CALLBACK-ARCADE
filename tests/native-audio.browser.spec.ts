import { expect, test } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };

test("Sketch narrator ducks the shared TV music and releases it when switched off", async ({ browser }) => {
  test.setTimeout(120_000);
  const host = await browser.newContext({baseURL});
  const phone = await browser.newContext({baseURL});
  try {
    const created = await host.request.post("/api/rooms", {headers,data:{gameLength:"arcade",arcadeGameId:"sketch-relay",contentMode:"party",timerAccessibility:false,imageModel:"flux-1-schnell"}});
    expect(created.status(),await created.text()).toBe(201);
    const {code} = await created.json() as {code:string};
    const joined = await phone.request.post(`/api/rooms/${code}/join`,{headers,data:{nickname:"Audio tester"}});
    expect(joined.status()).toBe(201);
    async function act(type:string) {
      const sync=await host.request.post(`/api/rooms/${code}/sync`,{headers,data:{version:0}});
      expect(sync.status(),await sync.text()).toBe(200);
      const snapshot=await sync.json() as {phase:string;roundId?:string};
      const response=await host.request.post(`/api/rooms/${code}/host-actions`,{headers,data:{type,actionId:crypto.randomUUID(),expectedPhase:snapshot.phase,roundId:snapshot.roundId??"lobby",payload:{}}});
      expect(response.status(),await response.text()).toBe(200);
    }
    await act("ADD_BOT");await act("ADD_BOT");await act("START_GAME");
    const page=await host.newPage();
    await page.addInitScript(()=>{
      const observed:boolean[]=[];
      Object.assign(window,{__nativeDuckEvents:observed});
      window.addEventListener("king-prompter:host-music-duck",e=>observed.push(Boolean((e as CustomEvent<{active:boolean}>).detail.active)));
      if("speechSynthesis" in window){
        window.speechSynthesis.speak=line=>{line.onstart?.call(line,new Event("start") as SpeechSynthesisEvent);};
        window.speechSynthesis.cancel=()=>{};
      }
    });
    await page.goto(`/host/${code}`);
    await page.getByRole("button",{name:"Turn narrator on",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as typeof window & {__nativeDuckEvents:boolean[]}).__nativeDuckEvents.includes(true))).toBe(true);
    await page.getByRole("button",{name:"Voice on",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as typeof window & {__nativeDuckEvents:boolean[]}).__nativeDuckEvents.at(-1))).toBe(false);
  } finally {await Promise.allSettled([host.close(),phone.close()]);}
});
