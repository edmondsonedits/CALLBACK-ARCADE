import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { useRoomSync } from "../app/components/useRoomSync";
import * as stateSync from "../lib/game/state-sync";
import * as nativeSocketTickets from "../lib/arcade/native-socket-ticket";

const compiledHook = ts.transpileModule(readFileSync(new URL("../app/components/useRoomSync.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function createHarness(gameLength = "arcade", phase = "LOBBY") {
  const slots: unknown[] = [];
  let cursor = 0;
  let latestEffects: Array<() => void | (() => void)> = [];
  const syncCalls: number[] = [];
  const realtimeCalls: number[] = [];
  const jobCalls: string[] = [];
  const hostActions: string[] = [];
  const sockets: TestSocket[] = [];
  let firstSync = true;
  let firstRealtime = true;
  const exports = {} as { useRoomSync: typeof useRoomSync };

  class TestSocket {
    static OPEN = 1;
    readyState = 0;
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    constructor() { sockets.push(this); }
    open() { this.readyState = TestSocket.OPEN; this.onopen?.(); }
    close() { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.(); }
    send(data?:string) { if(data){const message=JSON.parse(data);if(message.type==='action')this.onmessage?.({data:JSON.stringify({type:'action-result',requestId:message.requestId,ok:true,body:{ok:true}})});} }
  }

  runInNewContext(compiledHook, {
    exports,
    URL,
    AbortSignal,
    WebSocket: TestSocket,
    navigator: { onLine: true },
    window: new EventTarget(),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    require(name: string) {
      if (name === "../../lib/game/state-sync") return stateSync;
      if (name === "../../lib/arcade/native-socket-ticket") return nativeSocketTickets;
      assert.equal(name, "react");
      return {
        useState<T>(initial: T) {
          const index = cursor++;
          if (!(index in slots)) slots[index] = initial;
          return [slots[index], (next: T | ((previous: T) => T)) => {
            slots[index] = typeof next === "function" ? (next as (previous: T) => T)(slots[index] as T) : next;
          }];
        },
        useRef<T>(initial: T) {
          const index = cursor++;
          if (!(index in slots)) slots[index] = { current: initial };
          return slots[index];
        },
        useCallback: <T>(callback: T) => callback,
        useEffect(callback: () => void | (() => void)) { latestEffects.push(callback); },
      };
    },
    async fetch(url: string) {
      if (url.endsWith("/sync")) {
        syncCalls.push(Date.now());
        if (firstSync) {
          firstSync = false;
          return Response.json({ stateVersion: 1, phase, soloMode: false, soloLiveImages: false, imageJobsPending: false, image: null, gameLength, arcadeGameId: "imposter" });
        }
        return new Response(null, { status: 204, headers: { "x-callback-version": "1" } });
      }
      if (url.endsWith("/realtime")) {
        realtimeCalls.push(Date.now());
        if (firstRealtime) {
          firstRealtime = false;
          return Response.json({ ticket: "signed", workerUrl: "https://worker.example", roomKey: "a".repeat(64) });
        }
        return Response.json({ error: { message: "Worker reconnect unavailable" } }, { status: 503 });
      }
      if (url.endsWith('/jobs/run')) { jobCalls.push(url); return Response.json({ok:true}); }
      if (url.endsWith('/host-actions')) { hostActions.push(url); return Response.json({ok:true}); }
      throw new Error(`Unexpected request: ${url}`);
    },
  });

  return {
    syncCalls,
    realtimeCalls,
    jobCalls,
    hostActions,
    sockets,
    render() { cursor = 0; latestEffects = []; const value = exports.useRoomSync("TEST", "host"); return { value, effects: latestEffects }; },
  };
}

async function waitUntil(predicate: () => boolean, message: string, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test("host End Game uses HTTP even with an open socket so retirement can drain safely", async () => {
  const harness=createHarness('standard');await harness.render().value.sync();
  const cleanups=harness.render().effects.map(effect=>effect());
  try{
    await waitUntil(()=>harness.sockets.length===1,'socket should connect');harness.sockets[0]!.open();
    await harness.render().value.send({type:'END_GAME',actionId:crypto.randomUUID(),roundId:'lobby',expectedPhase:'LOBBY',payload:{}});
    assert.equal(harness.hostActions.length,1);
  }finally{for(const cleanup of cleanups)cleanup?.();}
});

test("completed party rooms use HTTP continuation without reconnecting a retired socket", async () => {
  const harness = createHarness('standard', 'POST_GAME');
  await harness.render().value.sync();
  const cleanups = harness.render().effects.map(effect=>effect());
  try { await new Promise(resolve=>setTimeout(resolve,30)); assert.equal(harness.realtimeCalls.length,0); assert.equal(harness.sockets.length,0); }
  finally { for(const cleanup of cleanups)cleanup?.(); }
});

test("native Arcade polling stops on socket open and resumes while socket reconnect is failing", async () => {
  const harness = createHarness();
  const initial = harness.render();
  await initial.value.sync();

  const connectedRender = harness.render();
  const cleanups = connectedRender.effects.map((effect) => effect());
  try {
    await waitUntil(() => harness.sockets.length === 1, "native socket should be created");
    harness.sockets[0]!.open();
    await new Promise((resolve) => setTimeout(resolve, 1400));
    const connectedSyncCount = harness.syncCalls.length;
    await new Promise((resolve) => setTimeout(resolve, 1400));
    assert.equal(harness.syncCalls.length, connectedSyncCount, "an open native socket replaces HTTP polling");

    harness.sockets[0]!.close();
    await waitUntil(() => harness.syncCalls.length >= connectedSyncCount + 1, "socket close should perform a recovery sync");
    await waitUntil(() => harness.realtimeCalls.length >= 2, "the failed socket reconnect should be attempted");
    await waitUntil(() => harness.syncCalls.length >= connectedSyncCount + 3, "HTTP sync polling should resume during socket reconnect failure");
  } finally {
    for (const cleanup of cleanups) cleanup?.();
  }
});

test("Royal Rumours socket snapshots start pending image work without an HTTP gameplay poll", async () => {
  const harness = createHarness('royal-rumours');
  await harness.render().value.sync();
  const cleanups = harness.render().effects.map(effect=>effect());
  try {
    await waitUntil(()=>harness.sockets.length===1,'party socket should connect');
    const socket=harness.sockets[0]!; socket.open();
    socket.onmessage?.({data:JSON.stringify({type:'snapshot',snapshot:{stateVersion:2,phase:'ANSWER_LOCK',soloMode:false,imageJobsPending:true,gameLength:'royal-rumours'}})});
    await waitUntil(()=>harness.jobCalls.length===1,'socket snapshot must kick image work');
    assert.equal(harness.render().value.snapshot?.stateVersion,2);
  } finally {for(const cleanup of cleanups)cleanup?.();}
});

