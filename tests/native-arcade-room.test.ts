import assert from "node:assert/strict";
import test from "node:test";
import { NativeArcadeRoom, routeNativeArcade, type NativeArcadeEnv } from "../party-worker/src/native-room";

test("unchanged room sync emits a liveness heartbeat and bounds relay requests", async () => {
  const originalFetch = globalThis.fetch;
  const messages: Array<{type:string}> = [];
  let signal: AbortSignal | null | undefined;
  const attachment = {ticket:'ticket',claims:{nonce:'nonce'},version:2};
  const sockets=[{deserializeAttachment:()=>attachment,serializeAttachment:()=>{},send:(raw:string)=>messages.push(JSON.parse(raw)),close:()=>{}}];
  let ready:Promise<void>=Promise.resolve();
  const state={blockConcurrencyWhile:(fn:()=>Promise<void>)=>(ready=fn()),storage:{get:async()=>({expiresAt:Date.now()+60000}),delete:async()=>{},deleteAlarm:async()=>{}},getWebSockets:()=>sockets};
  globalThis.fetch=async (_url,init)=>{signal=init?.signal;return Response.json({projections:[{nonce:'nonce',version:2,snapshot:null}]});};
  const room=new NativeArcadeRoom(state as unknown as DurableObjectState,{SITE_ORIGIN:'https://site.example',PARTY_SECRET:'secret'} as NativeArcadeEnv);
  try {
    await ready;
    await (room as unknown as {sync():Promise<void>}).sync();
    assert.ok(signal,'each relay must have a timeout signal');
    assert.equal(messages[0]?.type,'heartbeat','quiet rooms must remain distinguishable from a stalled relay');
  } finally {sockets.length=0;await room.webSocketClose();globalThis.fetch=originalFetch;}
});

function admissionRecorder() {
  const releases: string[] = [];
  const namespace = { idFromName: () => "global", get: () => ({ fetch: async (_url: string, init?: RequestInit) => { if (String(_url).endsWith("/release")) releases.push((JSON.parse(String(init?.body)) as { partyId: string }).partyId); return Response.json({ ok: true }); } }) };
  return { namespace, releases };
}

function roomWith(saved: { roomId: string; generationId: string; partyKey: string; matchId: string; expiresAt: number }, release: (partyId: string) => void) {
  let initialized: Promise<void> = Promise.resolve();
  const state = {
    blockConcurrencyWhile(callback: () => Promise<void>) { initialized = callback(); return initialized; },
    storage: {
      get: async () => saved,
      put: async () => undefined,
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
      delete: async () => undefined,
    },
    getWebSockets: () => [],
  };
  const admission = { idFromName: () => "global", get: () => ({ fetch: async (_url: string, init?: RequestInit) => { release((JSON.parse(String(init?.body)) as { partyId: string }).partyId); return Response.json({ ok: true }); } }) };
  const env = { PARTY_SECRET: "s".repeat(40), SITE_ORIGIN: "https://site.example", NATIVE_ARCADE_ROOM: {} as DurableObjectNamespace, PARTY_ADMISSION: admission as unknown as DurableObjectNamespace } satisfies NativeArcadeEnv;
  return { room: new NativeArcadeRoom(state as unknown as DurableObjectState, env), initialized };
}

for (const partyKey of ["session-PARENT", "native-ROOM"] as const) {
  test(`native Arcade expiry ${partyKey.startsWith("session-") ? "leaves shared admission to the parent" : "releases standalone admission"}`, async () => {
    const released: string[] = [];
    const { room, initialized } = roomWith({ roomId: "room", generationId: "generation", partyKey, matchId: "match", expiresAt: Date.now() - 1 }, (value) => released.push(value));
    await initialized;
    await room.alarm();
    assert.deepEqual(released, partyKey.startsWith("session-") ? [] : [partyKey]);
  });
}

test("native socket message rate limit persists its counter across serialized attachments", async () => {
  let attachment = { ticket: "", claims: {} as never, version: 0, rateAt: 0, rateCount: 0 };
  let serializations = 0;
  const closes: number[] = [];
  const ws = {
    deserializeAttachment: () => ({ ...attachment }),
    serializeAttachment: (next: typeof attachment) => { attachment = { ...next }; serializations += 1; },
    close: (code: number) => { closes.push(code); },
  } as unknown as WebSocket;
  const state = { blockConcurrencyWhile: async (callback: () => Promise<void>) => callback(), storage: { get: async () => null, deleteAlarm: async () => undefined, delete: async () => undefined }, getWebSockets: () => [] };
  const env = { PARTY_SECRET: "s".repeat(40), SITE_ORIGIN: "https://site.example", NATIVE_ARCADE_ROOM: {} as DurableObjectNamespace, PARTY_ADMISSION: {} as DurableObjectNamespace } satisfies NativeArcadeEnv;
  const room = new NativeArcadeRoom(state as unknown as DurableObjectState, env);
  for (let i = 0; i < 20; i += 1) await room.webSocketMessage(ws, "{");
  assert.equal(attachment.rateCount, 20);
  await room.webSocketMessage(ws, "{");
  assert.equal(attachment.rateCount, 21);
  assert.equal(serializations, 21);
  assert.equal(closes.at(-1), 1008);
});

test("native child retirement never releases parent-owned shared admission", async () => {
  const released: string[] = [];
  const admission = admissionRecorder();
  const env = {
    PARTY_SECRET: "s".repeat(40), SITE_ORIGIN: "https://site.example", PARTY_ADMISSION: admission.namespace,
    NATIVE_ARCADE_ROOM: { idFromName: () => "room", get: () => ({ fetch: async () => Response.json({ ok: true }) }) },
  } as unknown as NativeArcadeEnv;
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("room:generation"));
  const key = Array.from(new Uint8Array(keyBytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const response = await routeNativeArcade(new Request(`https://party.example/native-arcade/${key}/retire`, { method: "POST", headers: { authorization: `Bearer ${env.PARTY_SECRET}`, "content-type": "application/json" }, body: JSON.stringify({ operation: "retire", roomId: "room", generationId: "generation", partyKey: "session-PARENT" }) }), env);
  assert.equal(response?.status, 200);
  assert.deepEqual(released, []);
  assert.deepEqual(admission.releases, []);
});

