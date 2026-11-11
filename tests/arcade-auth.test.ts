import assert from "node:assert/strict";
import test from "node:test";
import {
  createArcadeTicket,
  verifyArcadeTicket,
  signArcadeCallback,
  verifyArcadeCallback,
  processArcadeCallback,
  selectArcadeControllerIds,
} from "../server/arcade/tickets.js";
import { ArcadeRoom } from "../arcade-worker/src/ArcadeRoom.js";
import { registerArcadeGame } from "../arcade-worker/src/games/registry.js";
import { airHockeyGame, AIR_HOCKEY_STEP_MS, type AirHockeyState } from "../arcade-worker/src/games/air-hockey.js";
import { lightTrailsGame } from "../arcade-worker/src/games/light-trails.js";

const secret = "unit-test-only-secret-with-enough-entropy";
const now = 1_800_000_000_000;
const claims = { v: 1 as const, roomCode: "ABCD", gameId: "air-hockey" as const, matchId: "match-1", role: "player" as const, playerId: "p-1", exp: now + 30_000, nonce: "nonce-001-123456" };
const liveClaims = () => ({ ...claims, exp: Date.now() + 30_000 });

function fakeSocket(attachment: unknown) {
  return {
    attachment, messages: [] as unknown[], closed: false,
    serializeAttachment(value: unknown) { this.attachment = structuredClone(value); },
    deserializeAttachment() { return structuredClone(this.attachment); },
    send(value: string) { this.messages.push(JSON.parse(value) as unknown); },
    close() { this.closed = true; },
  };
}

interface FakeStorage { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void>; delete(key: string | string[]): Promise<number | boolean>; list<T>(options?: { prefix?: string }): Promise<Map<string, T>>; transaction<T>(callback: (transaction: { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void> }) => Promise<T>): Promise<T>; getAlarm(): Promise<number | null>; setAlarm(value: number): Promise<void> }
function fakeDurableState() {
  const values = new Map<string, unknown>();
  let alarm: number | null = null;
  let failRuntimeCommit = false;
  let failAlarmRead = 0;
  let failAlarmWrite = 0;
  const storage: FakeStorage = {
    async get<T>(key: string) { return values.get(key) as T | undefined; },
    async put(key: string, value: unknown) { if (key === "runtime:v1" && failRuntimeCommit) { failRuntimeCommit = false; throw new Error("INJECTED_RUNTIME_COMMIT_FAILURE"); } values.set(key, structuredClone(value)); },
    async delete(key: string | string[]) { if (Array.isArray(key)) { for (const item of key) values.delete(item); return key.length; } return values.delete(key); },
    async list<T>(options: { prefix?: string } = {}) { return new Map([...values].filter(([key]) => key.startsWith(options.prefix ?? "")) as Array<[string, T]>); },
    async transaction<T>(callback: (transaction: FakeStorage) => Promise<T>) {
      const working = new Map([...values].map(([key, value]) => [key, structuredClone(value)]));
      const transaction: FakeStorage = {
        ...storage,
        async get<K>(key: string) { return working.get(key) as K | undefined; },
        async put(key: string, value: unknown) { if (key === "runtime:v1" && failRuntimeCommit) { failRuntimeCommit = false; throw new Error("INJECTED_RUNTIME_COMMIT_FAILURE"); } working.set(key, structuredClone(value)); },
      };
      const result = await callback(transaction);
      values.clear(); for (const [key, value] of working) values.set(key, value);
      return result;
    },
    async getAlarm() { if (failAlarmRead > 0) { failAlarmRead -= 1; throw new Error("INJECTED_ALARM_READ_FAILURE"); } return alarm; },
    async setAlarm(value: number) { if (failAlarmWrite > 0) { failAlarmWrite -= 1; throw new Error("INJECTED_ALARM_WRITE_FAILURE"); } alarm = value; },
  };
  const state = {
    storage, sockets: [] as unknown[],
    acceptWebSocket(socket: unknown) { this.sockets.push(socket); },
    getWebSockets() { return this.sockets.filter((socket) => !(socket as ReturnType<typeof fakeSocket>).closed) as never[]; },
    failNextRuntimeCommit() { failRuntimeCommit = true; },
    failNextAlarmRead(count = 1) { failAlarmRead = count; },
    failNextAlarmWrite(count = 1) { failAlarmWrite = count; },
    clearAlarm() { alarm = null; },
  };
  return state;
}

async function sendControl(room: ArcadeRoom, controlSecret: string, body: Record<string, unknown>, nonce?: string) {
  const raw = JSON.stringify({ controllerIds: ["p1", "p2"], ...body });
  const headers = await signArcadeCallback(raw, controlSecret, Date.now(), nonce);
  return room.fetch(new Request(`https://worker.invalid/control/${String(body.roomCode)}`, { method: "POST", headers: { "x-arcade-timestamp": headers.timestamp, "x-arcade-nonce": headers.nonce, "x-arcade-signature": headers.signature }, body: raw }));
}

test("host and player tickets verify against their exact room, game, and role", async () => {
  for (const role of ["host", "player"] as const) {
    const ticket = await createArcadeTicket({ ...claims, role, playerId: role === "host" ? null : "p-1" }, secret);
    assert.deepEqual(await verifyArcadeTicket(ticket, secret, { roomCode: "ABCD", gameId: "air-hockey", role }, now), { ...claims, role, playerId: role === "host" ? null : "p-1" });
  }
});

test("expired, malformed, wrong-room, wrong-game, bad-signature, and wrong-role tickets are rejected", async () => {
  const ticket = await createArcadeTicket(claims, secret);
  await assert.rejects(verifyArcadeTicket(ticket, secret, { roomCode: "ABCD", gameId: "air-hockey", role: "player" }, now + 30_001), /EXPIRED/);
  await assert.rejects(verifyArcadeTicket("not.a.ticket.extra", secret, {}, now), /MALFORMED/);
  await assert.rejects(verifyArcadeTicket(ticket, secret, { roomCode: "WXYZ" }, now), /BINDING/);
  await assert.rejects(verifyArcadeTicket(ticket, secret, { gameId: "tap-race" }, now), /BINDING/);
  await assert.rejects(verifyArcadeTicket(`${ticket.slice(0, -1)}x`, secret, {}, now), /SIGNATURE/);
  await assert.rejects(verifyArcadeTicket(ticket, secret, { role: "host" }, now), /BINDING/);
});

test("Air Hockey selects eligible active controllers including bots in stable seat order", () => {
  assert.deepEqual(selectArcadeControllerIds("air-hockey", [
    { id: "p3", role: "player", seat: 3, active: true, removedAt: null, bot: false },
    { id: "bot", role: "player", seat: 1, active: true, removedAt: null, bot: true },
    { id: "p2", role: "player", seat: 2, active: true, removedAt: null, bot: false },
    { id: "aud", role: "audience", seat: 0, active: true, removedAt: null, bot: false },
    { id: "p1", role: "player", seat: 4, active: true, removedAt: null, bot: false },
  ]), ["bot", "p2", "p3", "p1"]);
});

test("the Durable Object persists match state across eviction and rejects ticket replay or an unassigned seat", async () => {
  registerArcadeGame({ id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"], inputCooldownMs: 34, createState: () => ({ seen: [] as string[] }), applyInput: (state, input) => ({ seen: [...(state as { seen: string[] }).seen, `${input.playerId}:${input.seq}`] }), snapshot: (state, tick) => ({ v: 1, gameId: "air-hockey", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: "callback-secret-with-enough-length", SITE_CALLBACK_URL: "https://site.invalid/api/arcade/events" };
  const firstRoom = new ArcadeRoom(durable as never, env);
  assert.equal((await sendControl(firstRoom, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", roomVersion: 1, action: "start", controllerIds: ["p1", "p2"] })).status, 200);

  const assignedTicket = await createArcadeTicket({ ...liveClaims(), playerId: "p1" }, secret);
  const assignedSocket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await firstRoom.webSocketMessage(assignedSocket as never, assignedTicket);
  assert.deepEqual(assignedSocket.messages[0], { v: 1, type: "connected", roomCode: "ABCD", gameId: "air-hockey", role: "player", matchId: "match-1", lastSeq: -1 });
  await firstRoom.webSocketMessage(assignedSocket as never, JSON.stringify({ v: 1, type: "input", seq: 1, x: 0.25, y: 0.5 }));

  const recreatedRoom = new ArcadeRoom(durable as never, env);
  const reconnectTicket = await createArcadeTicket({ ...liveClaims(), nonce: "reconnect-nonce-001", playerId: "p1" }, secret);
  const reconnectSocket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await recreatedRoom.webSocketMessage(reconnectSocket as never, reconnectTicket);
  assert.deepEqual(reconnectSocket.messages[0], { v: 1, type: "connected", roomCode: "ABCD", gameId: "air-hockey", role: "player", matchId: "match-1", lastSeq: 1 });
  const restored = reconnectSocket.messages.find((message) => (message as { type?: string }).type === "snapshot") as { snapshot: { state: { seen: string[] } } };
  assert.deepEqual(restored.snapshot.state.seen, ["p1:1"]);

  const replayRoom = new ArcadeRoom(durable as never, env);
  const replaySocket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await replayRoom.webSocketMessage(replaySocket as never, assignedTicket);
  assert.equal(replaySocket.closed, true);
  assert.equal((replaySocket.messages.at(-1) as { code: string }).code, "UNAUTHORIZED");

  const unassignedTicket = await createArcadeTicket({ ...liveClaims(), nonce: "unassigned-nonce-01", playerId: "p3" }, secret);
  const unassignedSocket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await recreatedRoom.webSocketMessage(unassignedSocket as never, unassignedTicket);
  assert.equal(unassignedSocket.closed, true);
});

test("runtime callbacks retain their room code after hibernation", async () => {
  registerArcadeGame({ id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"], inputCooldownMs: 1, createState: () => ({ seen: 0 }), applyInput: (state, input, context) => { context.emit({ eventId: `evict-${input.seq}`, type: "goal", playerId: input.playerId, points: 1, occurredAt: input.receivedAt }); return { seen: (state as { seen: number }).seen + 1 }; }, snapshot: (state, tick) => ({ v: 1, gameId: "air-hockey", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/callback" };
  await sendControl(new ArcadeRoom(durable as never, env), env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "room-code-restore", roomVersion: 1, action: "start" });
  const restoredRoom = new ArcadeRoom(durable as never, env);
  const socket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await restoredRoom.webSocketMessage(socket as never, await createArcadeTicket({ ...liveClaims(), matchId: "room-code-restore", nonce: "room-code-restored-1", playerId: "p1" }, secret));
  await restoredRoom.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", seq: 1, x: 0.25, y: 0.5 }));
  const entries = await durable.storage.list<{ roomCode: string }>({ prefix: "outbox:" });
  assert.equal([...entries.values()][0]?.roomCode, "ABCD");
});

test("alarms resume active simulations and schedule a subsequent wake", async () => {
  registerArcadeGame({ id: "tap-race", minPlayers: 2, maxPlayers: 2, inputKinds: ["tap"], inputCooldownMs: 1, createState: () => ({ steps: 0 }), applyInput: (state) => state, step: (state) => { (state as { steps: number }).steps += 1; return state; }, snapshot: (state, tick) => ({ v: 1, gameId: "tap-race", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/callback" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "tap-race", matchId: "alarm-resume", roomVersion: 1, action: "start" });
  (room as unknown as { stopSimulationLoop(): void }).stopSimulationLoop();
  durable.clearAlarm();
  try {
    await room.alarm();
    await new Promise((resolve) => setTimeout(resolve, 60));
    const current = room as unknown as { gameState: { steps: number }; stopSimulationLoop(): void };
    assert.ok(current.gameState.steps > 0, "the alarm must restart the simulation loop");
    assert.notEqual(await durable.storage.getAlarm(), null, "the alarm must keep scheduling active matches after each wake");
  } finally { (room as unknown as { stopSimulationLoop(): void }).stopSimulationLoop(); }
});

test("pending goal callbacks are delivered before final result events", async () => {
  const durable = fakeDurableState();
  await durable.storage.put("outbox:match-order:goal-1", { roomCode: "ABCD", events: [{ eventId: "goal-1", matchId: "match-order", type: "goal", playerId: "p1", points: 1, occurredAt: 10 }], attempts: 0 });
  await durable.storage.put("outbox:match-order:result", { roomCode: "ABCD", events: [{ eventId: "result", matchId: "match-order", type: "result", playerId: null, points: 0, occurredAt: 11 }], attempts: 0 });
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/callback" };
  const originalFetch = globalThis.fetch;
  const callbacks: Array<{ roomCode: string; events: Array<{ type: string; eventId: string }> }> = [];
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => { callbacks.push(JSON.parse(String(init?.body)) as typeof callbacks[number]); return new Response("ok", { status: 200 }); }) as typeof fetch;
  try {
    await new ArcadeRoom(durable as never, env).alarm();
    assert.equal(callbacks.length, 1, "all pending events for a match must share one callback");
    assert.deepEqual(callbacks[0]?.events.map(({ type }) => type), ["goal", "result"]);
    assert.equal((await durable.storage.list({ prefix: "outbox:" })).size, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("signed sync reconciles active pause state, starts a new match, and cannot manufacture results", async () => {
  registerArcadeGame({ id: "tap-race", minPlayers: 2, maxPlayers: 2, inputKinds: ["tap"], inputCooldownMs: 1, createState: () => ({ pausedAt: null as number | null, complete: false }), applyInput: (state) => state, snapshot: (state, tick) => ({ v: 1, gameId: "tap-race", tick, state }), finalResult: (state) => (state as { complete: boolean }).complete ? { winners: ["p1"] } : null, pause: (state, now) => { (state as { pausedAt: number | null }).pausedAt = now; return state; }, resume: (state) => { (state as { pausedAt: number | null }).pausedAt = null; return state; } });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/callback" };
  const room = new ArcadeRoom(durable as never, env);
  const sync = (roomVersion: number, matchId: string, phase: "ARCADE_ACTIVE" | "ARCADE_RESULTS", paused: boolean, revokedControllerIds?: string[]) => sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "tap-race", matchId, roomVersion, action: "sync", phase, paused, ...(revokedControllerIds ? { revokedControllerIds } : {}) });
  assert.equal((await sync(1, "sync-match-1", "ARCADE_ACTIVE", false)).status, 200);
  assert.equal((await sync(2, "sync-match-1", "ARCADE_ACTIVE", true)).status, 200);
  assert.equal((await durable.storage.get<{ paused: boolean; gameState: { pausedAt: number | null } }>("runtime:v1"))?.paused, true);
  assert.notEqual((await durable.storage.get<{ gameState: { pausedAt: number | null } }>("runtime:v1"))?.gameState.pausedAt, null);
  assert.equal((await sync(3, "sync-match-2", "ARCADE_ACTIVE", false)).status, 409, "an active match cannot be replaced");
  assert.equal((await sync(3, "sync-match-1", "ARCADE_RESULTS", true)).status, 409, "D1 cannot turn an unfinished Worker match into results");
  const internals = room as unknown as { phase: "ARCADE_ACTIVE" | "ARCADE_RESULTS"; gameState: { complete: boolean }; stopSimulationLoop(): void };
  internals.stopSimulationLoop();
  internals.phase = "ARCADE_RESULTS";
  internals.gameState.complete = true;
  await durable.storage.put("runtime:v1", { ...await durable.storage.get<Record<string, unknown>>("runtime:v1"), phase: "ARCADE_RESULTS", paused: true, gameState: internals.gameState });
  assert.equal((await sync(3, "sync-match-1", "ARCADE_RESULTS", true)).status, 200, "D1 results can reconcile only after the Worker result exists");
  assert.equal((await sync(4, "sync-match-2", "ARCADE_ACTIVE", false)).status, 200, "a finished Worker match may initialize the next D1-active match");
  assert.equal((await durable.storage.get<{ matchId: string }>("runtime:v1"))?.matchId, "sync-match-2");
  (room as unknown as { stopSimulationLoop(): void }).stopSimulationLoop();
});

test("signed sync revokes a controller without changing seats and persists the revocation", async () => {
  registerArcadeGame({ id: "tap-race", minPlayers: 2, maxPlayers: 2, inputKinds: ["tap"], inputCooldownMs: 1, createState: () => ({ taps: 0 }), applyInput: (state) => ({ taps: (state as { taps: number }).taps + 1 }), snapshot: (state, tick) => ({ v: 1, gameId: "tap-race", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/callback" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "tap-race", matchId: "seat-revocation", roomVersion: 1, action: "start", controllerIds: ["p1", "p2"] });
  const sockets = [fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() }), fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() })];
  durable.sockets.push(...sockets as never[]);
  for (let index = 0; index < sockets.length; index += 1) {
    const playerId = `p${index + 1}`;
    await room.webSocketMessage(sockets[index] as never, await createArcadeTicket({ ...liveClaims(), gameId: "tap-race", matchId: "seat-revocation", nonce: `revoke-ticket-${index}-0001`, playerId }, secret));
  }
  const synced = await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "tap-race", matchId: "seat-revocation", roomVersion: 2, action: "sync", phase: "ARCADE_ACTIVE", paused: false, controllerIds: ["p1", "p2"], revokedControllerIds: ["p1"] });
  assert.equal(synced.status, 200);
  assert.equal((sockets[0] as unknown as ReturnType<typeof fakeSocket>).closed, true);
  assert.equal((sockets[1] as unknown as ReturnType<typeof fakeSocket>).closed, false);
  const persisted = await durable.storage.get<{ controllerIds: string[]; revokedControllerIds: string[]; gameState: { taps: number } }>("runtime:v1");
  assert.deepEqual(persisted?.controllerIds, ["p1", "p2"], "the fixed seat list is unchanged");
  assert.deepEqual(persisted?.revokedControllerIds, ["p1"]);
  const restored = new ArcadeRoom(durable as never, env);
  const revivedSocket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await restored.webSocketMessage(revivedSocket as never, await createArcadeTicket({ ...liveClaims(), gameId: "tap-race", matchId: "seat-revocation", nonce: "revoked-reconnect-01", playerId: "p1" }, secret));
  assert.equal(revivedSocket.closed, true, "a revoked seat cannot reconnect after hibernation");
  await restored.webSocketMessage(sockets[0] as never, JSON.stringify({ v: 1, type: "input", kind: "tap", seq: 1 }));
  assert.equal((await durable.storage.get<{ gameState: { taps: number } }>("runtime:v1"))?.gameState.taps, 0, "revoked input is not applied");
});

test("quarantines persisted controller capacity incompatible with its game without dispatch or rewrite", async () => {
  registerArcadeGame(airHockeyGame);
  const durable = fakeDurableState();
  const corrupted = { v: 1, gameId: "air-hockey", matchId: "corrupt-match", phase: "ARCADE_ACTIVE", paused: false, tick: 4, roomVersion: 7, controllerIds: Array.from({length:11},(_,i)=>`p${i+1}`), gameState: { unsafe: true } };
  await durable.storage.put("runtime:v1", corrupted);
  await durable.storage.put("room-version", 7);
  await durable.storage.put("outbox:corrupt-match:score-1", { roomCode: "ABCD", events: [{ eventId: "score-1", type: "goal", points: 7 }], attempts: 0 });
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/callback" };
  const room = new ArcadeRoom(durable as never, env);
  const originalFetch = globalThis.fetch;
  let callbackRequests = 0;
  globalThis.fetch = (async () => { callbackRequests += 1; return new Response("ok"); }) as typeof fetch;
  try {
    const response = await room.fetch(new Request("https://worker.invalid/control/ABCD", { method: "POST" }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { v: 1, type: "error", code: "ROOM_QUARANTINED" });

    await room.alarm();
    await room.alarm();
    const socket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
    await room.webSocketMessage(socket as never, "ignored");
    assert.equal((socket.messages[0] as { code: string }).code, "ROOM_QUARANTINED");
    assert.equal(socket.closed, true);
    assert.equal(callbackRequests, 0);
    assert.deepEqual(await durable.storage.get("runtime:v1"), corrupted);
    assert.equal(await durable.storage.get("room-version"), 7);
    assert.equal((await durable.storage.list({ prefix: "outbox:" })).size, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("quarantines null or non-object game state and mismatched persisted room versions", async () => {
  registerArcadeGame(airHockeyGame);
  const base = { v: 1, gameId: "air-hockey", matchId: "corrupt-match", phase: "ARCADE_ACTIVE", paused: false, tick: 4, roomVersion: 7, controllerIds: ["p1", "p2"] };
  const scenarios = [
    { name: "null game state", runtime: { ...base, gameState: null }, storedVersion: 7 },
    { name: "primitive game state", runtime: { ...base, gameState: "not-an-object" }, storedVersion: 7 },
    { name: "runtime and room version mismatch", runtime: { ...base, roomVersion: 8, gameState: { safe: true } }, storedVersion: 7 },
  ];
  const originalFetch = globalThis.fetch;
  let callbackRequests = 0;
  globalThis.fetch = (async () => { callbackRequests += 1; return new Response("ok"); }) as typeof fetch;
  try {
    for (const [index, scenario] of scenarios.entries()) {
      const durable = fakeDurableState();
      await durable.storage.put("runtime:v1", scenario.runtime);
      await durable.storage.put("room-version", scenario.storedVersion);
      const outboxEntry = { roomCode: "ABCD", events: [{ eventId: `queued-${index}`, type: "goal", points: 5 }], attempts: 2 };
      await durable.storage.put(`outbox:corrupt-match:${index}`, outboxEntry);
      const room = new ArcadeRoom(durable as never, { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/callback" });

      const response = await room.fetch(new Request("https://worker.invalid/control/ABCD", { method: "POST" }));
      assert.equal(response.status, 503, scenario.name);
      assert.deepEqual(await response.json(), { v: 1, type: "error", code: "ROOM_QUARANTINED" }, scenario.name);
      await room.alarm();
      assert.deepEqual(await durable.storage.get("runtime:v1"), scenario.runtime, `${scenario.name}: runtime must remain untouched`);
      assert.equal(await durable.storage.get("room-version"), scenario.storedVersion, `${scenario.name}: room version must remain untouched`);
      assert.deepEqual(await durable.storage.get(`outbox:corrupt-match:${index}`), outboxEntry, `${scenario.name}: pending callback must remain queued`);
    }
    assert.equal(callbackRequests, 0, "quarantined rooms must not dispatch score callbacks");
  } finally { globalThis.fetch = originalFetch; }
});

test("an authenticated spectator gets public snapshots but cannot control a paddle", async () => {
  registerArcadeGame({ id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"], inputCooldownMs: 34, createState: () => ({ inputs: 0 }), applyInput: (state) => ({ inputs: (state as { inputs: number }).inputs + 1 }), snapshot: (state, tick) => ({ v: 1, gameId: "air-hockey", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "spectator-match", roomVersion: 1, action: "start", controllerIds: ["p1", "p2"] });
  const ticket = await createArcadeTicket({ ...liveClaims(), matchId: "spectator-match", role: "spectator", playerId: "p3", nonce: "spectator-nonce-001" }, secret);
  const spectator = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await room.webSocketMessage(spectator as never, ticket);
  const spectatorConnected = spectator.messages[0] as { role: string; matchId: string; lastSeq?: number };
  assert.equal(spectatorConnected.role, "spectator");
  assert.equal(spectatorConnected.matchId, "spectator-match");
  assert.equal(Object.hasOwn(spectatorConnected, "lastSeq"), false, "spectator handshakes do not expose a player sequence");
  assert.ok(spectator.messages.some((message) => (message as { type?: string }).type === "snapshot"));
  await room.webSocketMessage(spectator as never, JSON.stringify({ v: 1, type: "input", seq: 1, x: 0.5, y: 0.5 }));
  assert.equal((spectator.messages.at(-1) as { code?: string }).code, "INVALID_INPUT");
  const saved = await durable.storage.get<{ gameState: { inputs: number } }>("runtime:v1");
  assert.equal(saved?.gameState.inputs, 0);
  (room as unknown as { stopSimulationLoop(): void }).stopSimulationLoop();
});

test("a signed lobby return resets the Worker before the next D1 match starts", async () => {
  registerArcadeGame(airHockeyGame);
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "old-match", roomVersion: 1, action: "start" });
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "old-match", roomVersion: 2, action: "finish" });
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "old-match", roomVersion: 3, action: "lobby" })).status, 200);
  assert.equal((await durable.storage.get<{ phase: string }>("runtime:v1"))?.phase, "LOBBY");
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "new-match", roomVersion: 4, action: "start" })).status, 200);
  const next = await durable.storage.get<{ phase: string; matchId: string; gameState: AirHockeyState }>("runtime:v1");
  assert.equal(next?.phase, "ARCADE_ACTIVE");
  assert.equal(next?.matchId, "new-match");
  assert.equal(next?.gameState.seed, "new-match");
  (room as unknown as { stopSimulationLoop(): void }).stopSimulationLoop();
});

test("signed seat changes close removed controllers and rematches revoke every old player socket", async () => {
  registerArcadeGame(airHockeyGame);
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", roomVersion: 1, action: "start" });
  const removedSeat = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  const retainedSeat = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  durable.sockets.push(removedSeat as never, retainedSeat as never);
  await room.webSocketMessage(removedSeat as never, await createArcadeTicket({ ...liveClaims(), playerId: "p1" }, secret));
  await room.webSocketMessage(retainedSeat as never, await createArcadeTicket({ ...liveClaims(), nonce: "retained-seat-nonce", playerId: "p2" }, secret));

  const activeSeatChange = await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", roomVersion: 2, action: "update_seats", controllerIds: ["p2", "p3"] });
  assert.equal(activeSeatChange.status, 409);
  assert.equal(removedSeat.closed, false);
  assert.equal(retainedSeat.closed, false);
  const beforeRematch = await durable.storage.get<{ gameState: AirHockeyState; controllerIds: string[] }>("runtime:v1");
  assert.deepEqual(beforeRematch?.controllerIds, ["p1", "p2"]);
  assert.deepEqual(beforeRematch?.gameState.playerIds, ["p1", "p2"]);

  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", roomVersion: 3, action: "finish", controllerIds: ["p1", "p2"] });
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", nextMatchId: "match-2", roomVersion: 4, action: "rematch", controllerIds: ["p2", "p3"] });
  assert.equal(retainedSeat.closed, true);
  assert.equal(removedSeat.closed, true);
  const rematchRuntime = await durable.storage.get<{ gameState: AirHockeyState }>("runtime:v1");
  assert.equal(rematchRuntime?.gameState.seed, "match-2");
  assert.deepEqual(rematchRuntime?.gameState.playerIds, ["p2", "p3"]);
  const staleMatch = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await room.webSocketMessage(staleMatch as never, await createArcadeTicket({ ...liveClaims(), nonce: "stale-match-nonce", playerId: "p2" }, secret));
  assert.equal(staleMatch.closed, true);
});

test("signed pause and resume extend the deadline by the full pause duration", async () => {
  const realNow = Date.now;
  let currentTime = 1_800_000_000_000;
  Date.now = () => currentTime;
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  try {
    await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "pause-match", roomVersion: 1, action: "start", controllerIds: ["p1", "p2"] });
    const active = await durable.storage.get<{ gameState: AirHockeyState }>("runtime:v1");
    const mismatchedPause = await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "pause-match", roomVersion: 2, action: "pause", controllerIds: ["p2", "p3"] });
    assert.equal(mismatchedPause.status, 409);
    assert.deepEqual((await durable.storage.get<{ controllerIds: string[] }>("runtime:v1"))?.controllerIds, ["p1", "p2"]);
    currentTime = 1_800_000_020_000;
    const pauseResponse = await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "pause-match", roomVersion: 2, action: "pause", controllerIds: ["p1", "p2"] });
    assert.equal(pauseResponse.status, 200);
    const paused = await durable.storage.get<{ gameState: AirHockeyState; paused: boolean }>("runtime:v1");
    assert.equal(paused?.paused, true);
    assert.equal(paused?.gameState.deadlineAt, active!.gameState.deadlineAt);
    currentTime = 1_800_000_620_000;
    await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "pause-match", roomVersion: 3, action: "resume", controllerIds: ["p1", "p2"] });
    const resumed = await durable.storage.get<{ gameState: AirHockeyState; paused: boolean }>("runtime:v1");
    assert.equal(resumed?.paused, false);
    assert.equal(resumed?.gameState.deadlineAt - currentTime, active!.gameState.deadlineAt - 1_800_000_020_000);
    assert.equal(resumed?.gameState.pausedAt, null);
  } finally {
    (room as unknown as { stopSimulationLoop(): void }).stopSimulationLoop();
    Date.now = realNow;
  }
});

test("a winning goal commits and delivers goal then result together; failed commit is safe across recreation", async () => {
  registerArcadeGame(airHockeyGame);
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/api/arcade/events" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-final", roomVersion: 1, action: "start", controllerIds: ["p1", "p2"] });
  const internals = room as unknown as { gameState: AirHockeyState; tick: number; simulationAccumulatorMs: number; stopSimulationLoop(): void; simulateFrame(): Promise<void> };
  internals.stopSimulationLoop();
  internals.gameState.score.p2 = 6;
  internals.gameState.puck = { x: 2, y: 300, vx: -240, vy: 0, serveTicks: 0 };
  internals.tick = 2;
  internals.simulationAccumulatorMs = AIR_HOCKEY_STEP_MS;
  const savedBefore = { ...await durable.storage.get<Record<string, unknown>>("runtime:v1"), tick: 2, gameState: structuredClone(internals.gameState) };
  await durable.storage.put("runtime:v1", savedBefore);

  const hostSocket = fakeSocket({ authenticated: true, roomCode: "ABCD", role: "host", gameId: "air-hockey", matchId: "match-final" });
  durable.sockets.push(hostSocket as never);
  durable.failNextRuntimeCommit();
  await internals.simulateFrame();
  assert.equal((await durable.storage.list({ prefix: "outbox:" })).size, 0);
  assert.equal(hostSocket.messages.some((message) => (message as { type?: string }).type === "snapshot"), false);
  const afterFailure = await durable.storage.get<{ gameState: AirHockeyState; tick: number }>("runtime:v1");
  assert.equal(afterFailure?.gameState.score.p2, 6);
  assert.equal(afterFailure?.tick, 2);

  const recreated = new ArcadeRoom(durable as never, env);
  await recreated.fetch(new Request("https://worker.invalid/control/ABCD"));
  const resumed = recreated as unknown as { gameState: AirHockeyState; tick: number; simulationAccumulatorMs: number; stopSimulationLoop(): void; simulateFrame(): Promise<void> };
  resumed.stopSimulationLoop();
  resumed.simulationAccumulatorMs = AIR_HOCKEY_STEP_MS;
  durable.failNextAlarmRead(5);
  durable.failNextAlarmWrite(5);
  await resumed.simulateFrame();
  assert.equal((await durable.storage.list({ prefix: "outbox:" })).size, 1);
  assert.notEqual(await durable.storage.getAlarm(), null, "ten transient alarm failures are retried until the final event has a wakeup, without an external wakeup");
  assert.equal(hostSocket.messages.some((message) => (message as { type?: string }).type === "snapshot"), true);

  const originalFetch = globalThis.fetch;
  let deliveredTypes: string[] = [];
  globalThis.fetch = (async (_input, init) => {
    const body = String(init?.body);
    const parsed = JSON.parse(body) as { events: Array<{ type: string; eventId: string }> };
    const requestHeaders = new Headers(init?.headers);
    const { processArcadeCallback } = await import("../server/arcade/tickets.js");
    await processArcadeCallback(body, {
      timestamp: requestHeaders.get("x-arcade-timestamp") ?? undefined,
      nonce: requestHeaders.get("x-arcade-nonce") ?? undefined,
      signature: requestHeaders.get("x-arcade-signature") ?? undefined,
    }, secret, Date.now(), async (_roomCode, events) => {
      deliveredTypes = (events as Array<{ type: string }>).map((event) => event.type);
    });
    assert.deepEqual(parsed.events.map((event) => event.type), ["goal", "result"]);
    assert.deepEqual(parsed.events.map((event) => event.eventId), ["match-final:goal:1", "match-final:final"]);
    return new Response("ok", { status: 200 });
  }) as typeof fetch;
  try {
    durable.clearAlarm();
    await recreated.fetch(new Request("https://worker.invalid/control/ABCD"));
    assert.notEqual(await durable.storage.getAlarm(), null, "a DO fetch wakeup re-arms recovery for a durable outbox entry");
    await recreated.alarm();
    assert.deepEqual(deliveredTypes, ["goal", "result"]);
    assert.equal((await durable.storage.list({ prefix: "outbox:" })).size, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("signed control atomically commits runtime and room version before acknowledgement", async () => {
  registerArcadeGame({ id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"], inputCooldownMs: 34, createState: () => ({ ready: true }), applyInput: (state) => state, snapshot: (state, tick) => ({ v: 1, gameId: "air-hockey", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const firstRoom = new ArcadeRoom(durable as never, env);
  const control = { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", roomVersion: 1, action: "start" };
  const nonce = "failed-control-commit-nonce";
  durable.failNextRuntimeCommit();
  assert.equal((await sendControl(firstRoom, env.ARCADE_CONTROL_SECRET, control, nonce)).status, 503);
  assert.equal(await durable.storage.get("runtime:v1"), undefined);
  assert.equal(await durable.storage.get("room-version"), undefined);
  assert.equal(await durable.storage.get(`control:${nonce}`), undefined);

  const recreated = new ArcadeRoom(durable as never, env);
  assert.equal((await sendControl(recreated, env.ARCADE_CONTROL_SECRET, control, nonce)).status, 200);
  const saved = await durable.storage.get<{ matchId: string; roomVersion: number }>("runtime:v1");
  assert.deepEqual({ matchId: saved?.matchId, roomVersion: saved?.roomVersion }, { matchId: "match-1", roomVersion: 1 });
});

test("signed controls acknowledge only identical retries at an already committed version", async () => {
  let stateCreations = 0;
  registerArcadeGame({ id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"], inputCooldownMs: 34, createState: () => { stateCreations += 1; return { ready: true }; }, applyInput: (state) => state, snapshot: (state, tick) => ({ v: 1, gameId: "air-hockey", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const control = { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-idempotent", roomVersion: 1, action: "start" };
  const room = new ArcadeRoom(durable as never, env);
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, control)).status, 200);

  const recreated = new ArcadeRoom(durable as never, env);
  const retry = await sendControl(recreated, env.ARCADE_CONTROL_SECRET, control);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { ok: true, roomVersion: 1, idempotent: true });

  const conflicting = await sendControl(recreated, env.ARCADE_CONTROL_SECRET, { ...control, controllerIds: ["p2", "p3"] });
  assert.equal(conflicting.status, 409);
  const superseded = await sendControl(recreated, env.ARCADE_CONTROL_SECRET, { ...control, roomVersion: 0 });
  assert.equal(superseded.status, 200);
  assert.deepEqual(await superseded.json(), { ok: true, roomVersion: 1, superseded: true });
  assert.equal(stateCreations, 1, "an identical retry must not reinitialize the game");
});

test("signed start and rematch enforce Air Hockey capacity and generic seat bounds", async () => {
  registerArcadeGame(airHockeyGame);
  assert.equal(airHockeyGame.minPlayers, 2);
  assert.equal(airHockeyGame.maxPlayers, 10);
  const ten = Array.from({ length: 10 }, (_, i) => `p${i}`);
  const eleven = [...ten, "p10"];
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  const start = { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "capacity-match", roomVersion: 1, action: "start" };
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { ...start, controllerIds: ["p1"] })).status, 400);
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { ...start, controllerIds: Array.from({ length: 17 }, (_, i) => `p${i}`) })).status, 400);
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { ...start, controllerIds: ["p1", "p1"] })).status, 400);
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { ...start, controllerIds: eleven })).status, 409);
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { ...start, controllerIds: ["p1", "p2"] })).status, 200);
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "capacity-match", roomVersion: 2, action: "finish", controllerIds: ["p1", "p2"] })).status, 200);
  const rematch = { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "capacity-match", nextMatchId: "capacity-rematch", roomVersion: 3, action: "rematch" };
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { ...rematch, controllerIds: eleven })).status, 409);
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { ...rematch, controllerIds: ten })).status, 200);
  const saved = await durable.storage.get<{ controllerIds: string[]; gameState: { paddles: Array<{ playerId: string }> } }>("runtime:v1");
  assert.deepEqual(saved?.controllerIds, ten);
  assert.deepEqual(saved?.gameState.paddles.map((paddle) => paddle.playerId), ten);
  assert.equal((await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "capacity-rematch", roomVersion: 4, action: "finish", controllerIds: ten })).status, 200);
});

test("registered multiplayer games restore three assigned controller seats", async () => {
  registerArcadeGame({ id: "tap-race", minPlayers: 3, maxPlayers: 4, inputKinds: ["tap"], inputCooldownMs: 100, createState: (_seed, _now, playerIds) => ({ playerIds: [...(playerIds ?? [])] }), applyInput: (state) => state, snapshot: (state, tick) => ({ v: 1, gameId: "tap-race", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const started = await sendControl(new ArcadeRoom(durable as never, env), env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "tap-race", matchId: "three-player-match", roomVersion: 1, action: "start", controllerIds: ["p1", "p2", "p3"] });
  assert.equal(started.status, 200);
  const saved = await durable.storage.get<{ controllerIds: string[]; gameState: { playerIds: string[] } }>("runtime:v1");
  assert.deepEqual(saved?.controllerIds, ["p1", "p2", "p3"]);
  assert.deepEqual(saved?.gameState.playerIds, ["p1", "p2", "p3"]);

  const restoredRoom = new ArcadeRoom(durable as never, env);
  const socket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await restoredRoom.webSocketMessage(socket as never, await createArcadeTicket({ ...liveClaims(), gameId: "tap-race", matchId: "three-player-match", nonce: "third-seat-ticket-001", playerId: "p3" }, secret));
  assert.equal((socket.messages[0] as { type: string }).type, "connected");
});

test("Worker accepts discrete taps once and renders snapshots for each socket role", async () => {
  registerArcadeGame({ id: "tap-race", minPlayers: 2, maxPlayers: 16, inputKinds: ["tap"], inputCooldownMs: 100, createState: () => ({ taps: 0 }), applyInput: (state: unknown) => ({ taps: (state as { taps: number }).taps + 1 }), snapshot: (state: unknown, tick: number, viewer: { role: string; playerId: string | null }) => ({ v: 1, gameId: "tap-race", tick, state: { ...state as object, viewer } }) } as never);
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "tap-race", matchId: "tap-protocol-match", roomVersion: 1, action: "start", controllerIds: ["p1", "p2"] });

  const viewers = [
    { role: "host" as const, playerId: null, nonce: "tap-host-viewer-001" },
    { role: "player" as const, playerId: "p1", nonce: "tap-player-viewer-01" },
    { role: "player" as const, playerId: "p2", nonce: "tap-player-viewer-02" },
  ];
  const sockets = viewers.map(() => fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now(), authenticated: false }));
  durable.sockets.push(...sockets as never[]);
  for (let index = 0; index < viewers.length; index += 1) {
    const viewer = viewers[index]!;
    const ticket = await createArcadeTicket({ ...liveClaims(), gameId: "tap-race", matchId: "tap-protocol-match", role: viewer.role, playerId: viewer.playerId, nonce: viewer.nonce }, secret);
    await room.webSocketMessage(sockets[index] as never, ticket);
  }
  assert.equal(Object.hasOwn(sockets[0]!.messages[0] as object, "lastSeq"), false, "host handshakes do not expose a player sequence");
  assert.equal((sockets[1]!.messages[0] as { lastSeq?: number }).lastSeq, -1);

  await room.webSocketMessage(sockets[1] as never, JSON.stringify({ v: 1, type: "input", kind: "tap", seq: 1 }));
  assert.equal((await durable.storage.get<{ gameState: { taps: number } }>("runtime:v1"))?.gameState.taps, 1);
  await room.webSocketMessage(sockets[1] as never, JSON.stringify({ v: 1, type: "input", kind: "tap", seq: 2 }));
  assert.equal((sockets[1]!.messages.at(-1) as { code: string }).code, "RATE_LIMITED");
  await new Promise((resolve) => setTimeout(resolve, 110));
  await room.webSocketMessage(sockets[1] as never, JSON.stringify({ v: 1, type: "input", kind: "tap", seq: 2 }));
  assert.equal((await durable.storage.get<{ gameState: { taps: number } }>("runtime:v1"))?.gameState.taps, 2);
  await room.webSocketMessage(sockets[1] as never, JSON.stringify({ v: 1, type: "input", kind: "tap", seq: 2 }));
  assert.equal((sockets[1]!.messages.at(-1) as { code: string }).code, "STALE_SEQUENCE");
  assert.equal((await durable.storage.get<{ gameState: { taps: number } }>("runtime:v1"))?.gameState.taps, 2);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "tap-race", matchId: "tap-protocol-match", roomVersion: 2, action: "pause", controllerIds: ["p1", "p2"] });
  for (let index = 0; index < viewers.length; index += 1) {
    const snapshots = sockets[index]!.messages.filter((message) => (message as { type?: string }).type === "snapshot");
    assert.deepEqual((snapshots.at(-1) as { snapshot: { state: { viewer: unknown } } }).snapshot.state.viewer, { role: viewers[index]!.role, playerId: viewers[index]!.playerId });
  }
});

test("Worker maps legacy coordinates to strict positions and coalesces identical positions", async () => {
  registerArcadeGame({ id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"], inputCooldownMs: 34, createState: () => ({ inputs: 0 }), applyInput: (state: unknown) => ({ inputs: (state as { inputs: number }).inputs + 1 }), snapshot: (state: unknown, tick: number) => ({ v: 1, gameId: "air-hockey", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "position-match", roomVersion: 1, action: "start", controllerIds: ["p1", "p2"] });
  const socket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  durable.sockets.push(socket as never);
  await room.webSocketMessage(socket as never, await createArcadeTicket({ ...liveClaims(), matchId: "position-match", playerId: "p1", nonce: "position-ticket-nonce" }, secret));
  await room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", seq: 1, x: 0.2, y: 0.3 }));
  await room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", kind: "position", seq: 2, x: 0.2, y: 0.3 }));
  assert.equal((await durable.storage.get<{ gameState: { inputs: number } }>("runtime:v1"))?.gameState.inputs, 1);
  assert.equal((await durable.storage.get<{ seq: number }>("seq:position-match:p1"))?.seq, 2);
  await room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", kind: "position", seq: 3, x: 0.25, y: 0.3, extra: true }));
  assert.equal((socket.messages.at(-1) as { code: string }).code, "INVALID_INPUT");
  await new Promise((resolve) => setTimeout(resolve, 36));
  await room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", kind: "position", seq: 3, x: 0.25, y: 0.3 }));
  assert.equal((await durable.storage.get<{ gameState: { inputs: number } }>("runtime:v1"))?.gameState.inputs, 2);
});

test("Light Trails runs through the authenticated Worker room with bounded phone steering and public snapshots", async () => {
  registerArcadeGame(lightTrailsGame);
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  const started = await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "light-trails", matchId: "trails-match", roomVersion: 1, action: "start", controllerIds: ["p1", "p2", "p3"] });
  assert.equal(started.status, 200);
  const socket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  durable.sockets.push(socket as never);
  const ticket = await createArcadeTicket({ ...liveClaims(), gameId: "light-trails", matchId: "trails-match", playerId: "p1", nonce: "trails-ticket-nonce" }, secret);
  await room.webSocketMessage(socket as never, ticket);
  await room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", kind: "position", seq: 1, x: 0.5, y: 0.1 }));
  const saved = await durable.storage.get<{ tick: number; gameState: { riders: Array<{ playerId: string; x: number; y: number; direction: string }> } }>("runtime:v1");
  assert.equal(saved?.gameState.riders.find((rider) => rider.playerId === "p1")?.direction, "right", "hot steering stays in memory until the 10 Hz checkpoint");
  assert.equal((await durable.storage.get<{ seq: number }>("seq:trails-match:p1"))?.seq, 1, "input replay guard is durable immediately");
  assert.ok(socket.messages.some((message) => (message as { snapshot?: { gameId?: string } }).snapshot?.gameId === "light-trails"));
  const recreated = new ArcadeRoom(durable as never, env);
  const reconnectSocket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await recreated.webSocketMessage(reconnectSocket as never, await createArcadeTicket({ ...liveClaims(), gameId: "light-trails", matchId: "trails-match", playerId: "p1", nonce: "trails-reconnect-nonce" }, secret));
  const restoredSnapshot = reconnectSocket.messages.find((message) => (message as { type?: string }).type === "snapshot") as { snapshot: { state: { riders: Array<{ playerId: string; direction: string }> } } };
  assert.equal(restoredSnapshot.snapshot.state.riders.find((rider) => rider.playerId === "p1")?.direction, "up", "the latest accepted steering is reconstructed after eviction");
  const internals = recreated as unknown as { tick: number; gameState: { riders: Array<{ playerId: string; x: number; y: number; direction: string }> }; lastSimulationAt: number; simulationAccumulatorMs: number; stopSimulationLoop(): void; simulateFrame(): Promise<void> };
  internals.stopSimulationLoop();
  for (let tick = 0; tick < 6; tick += 1) {
    internals.lastSimulationAt = performance.now();
    internals.simulationAccumulatorMs = AIR_HOCKEY_STEP_MS;
    await internals.simulateFrame();
  }
  const checkpoint = await durable.storage.get<{ tick: number; gameState: { riders: Array<{ playerId: string; x: number; y: number; direction: string }> } }>("runtime:v1");
  const persistedRider = checkpoint?.gameState.riders.find((rider) => rider.playerId === "p1");
  assert.equal(checkpoint?.tick, 6);
  assert.equal(persistedRider?.direction, "up");
  assert.equal(persistedRider?.y, 3);
  await room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", kind: "position", seq: 2, x: 2, y: 0 }));
  assert.equal((socket.messages.at(-1) as { code: string }).code, "INVALID_INPUT");
});

test("eight Light Trails riders keep per-turn durable writes compact and checkpoint the board at 10 Hz", async () => {
  registerArcadeGame(lightTrailsGame);
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  const playerIds = Array.from({ length: 8 }, (_, index) => `rider-${index + 1}`);
  const internals = room as unknown as { tick: number; lastSimulationAt: number; simulationAccumulatorMs: number; stopSimulationLoop(): void; simulateFrame(): Promise<void> };
  const startResponse = await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "EFGH", gameId: "light-trails", matchId: "eight-rider-match", roomVersion: 1, action: "start", controllerIds: playerIds });
  internals.stopSimulationLoop();
  assert.equal(startResponse.status, 200);
  const sockets = playerIds.map((playerId) => fakeSocket({ pendingRoom: "EFGH", pendingSince: Date.now(), authenticated: false, playerId }));
  durable.sockets.push(...sockets as never[]);
  for (let index = 0; index < playerIds.length; index += 1) {
    const playerId = playerIds[index]!;
    const ticket = await createArcadeTicket({ ...liveClaims(), roomCode: "EFGH", gameId: "light-trails", matchId: "eight-rider-match", playerId, nonce: `light-trails-load-ticket-${index}` }, secret);
    await room.webSocketMessage(sockets[index] as never, ticket);
    await room.webSocketMessage(sockets[index] as never, JSON.stringify({ v: 1, type: "input", kind: "position", seq: 1, x: index === 0 ? 0.5 : 0.5, y: index === 0 ? 0.1 : 0.5 }));
  }
  const beforeCheckpoint = await durable.storage.get<{ tick: number; gameState: { riders: Array<{ playerId: string; direction: string }> } }>("runtime:v1");
  assert.equal(beforeCheckpoint?.tick, 0);
  assert.equal(beforeCheckpoint?.gameState.riders.find((rider) => rider.playerId === playerIds[0])?.direction, "right");
  for (const playerId of playerIds) assert.equal((await durable.storage.get<{ seq: number }>(`seq:eight-rider-match:${playerId}`))?.seq, 1);
  const board = (lightTrailsGame.snapshot((room as unknown as { gameState: unknown }).gameState, 0, { role: "host", playerId: null }).state as { trail: string }).trail;
  assert.ok(board.length < JSON.stringify(Array.from(board, Number)).length, "wire trail encoding is materially smaller than JSON integer arrays");

  for (let tick = 0; tick < 6; tick += 1) {
    internals.lastSimulationAt = performance.now();
    internals.simulationAccumulatorMs = AIR_HOCKEY_STEP_MS;
    await internals.simulateFrame();
  }
  const checkpoint = await durable.storage.get<{ tick: number; gameState: { riders: Array<{ playerId: string; y: number; direction: string }> } }>("runtime:v1");
  const firstRider = checkpoint?.gameState.riders.find((rider) => rider.playerId === playerIds[0]);
  assert.equal(checkpoint?.tick, 6);
  assert.equal(firstRider?.direction, "up");
  assert.equal(firstRider?.y, 3);
});

test("non-start signed controls reject stale game or match bindings", async () => {
  const game = { id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"] as const, inputCooldownMs: 34, createState: () => ({ ready: true }), applyInput: (state: unknown) => state, snapshot: (state: unknown, tick: number) => ({ v: 1 as const, gameId: "air-hockey", tick, state }) };
  registerArcadeGame(game);
  registerArcadeGame({ ...game, id: "tap-race" });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: "control-secret-with-enough-length", ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", roomVersion: 1, action: "start" });
  const staleMatch = await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "older-match", roomVersion: 2, action: "pause" });
  const staleGame = await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "tap-race", matchId: "match-1", roomVersion: 3, action: "pause" });
  assert.equal(staleMatch.status, 409);
  assert.equal(staleGame.status, 409);
  assert.equal((await durable.storage.get<{ paused: boolean }>("runtime:v1"))?.paused, false);
});

test("pending unauthenticated sockets are capped and expire after the auth deadline", async () => {
  const durable = fakeDurableState();
  durable.sockets = Array.from({ length: 16 }, () => fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() }) as never);
  const room = new ArcadeRoom(durable as never, { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" });
  const refused = await room.fetch(new Request("https://arcade.invalid/room/ABCD", { headers: { Upgrade: "websocket" } }));
  assert.equal(refused.status, 429);

  durable.sockets = [fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() - 6_000 }) as never];
  await room.alarm();
  assert.equal((durable.sockets[0] as unknown as ReturnType<typeof fakeSocket>).closed, true);
});

test("callback outbox keeps retrying through capped backoff and clears only on acknowledgement", async () => {
  registerArcadeGame({ id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"], inputCooldownMs: 34, createState: () => ({ seen: [] as string[] }), applyInput: (state, input, context) => { context.emit({ eventId: "goal-outbox", type: "goal", playerId: input.playerId, points: 1, occurredAt: input.receivedAt }); return { seen: [...(state as { seen: string[] }).seen, input.playerId] }; }, snapshot: (state, tick) => ({ v: 1, gameId: "air-hockey", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid/api/arcade/events" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", roomVersion: 1, action: "start", controllerIds: ["p1", "p2"] });
  const socket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() });
  await room.webSocketMessage(socket as never, await createArcadeTicket({ ...liveClaims(), playerId: "p1" }, secret));
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = (async () => { attempts += 1; return attempts < 12 ? new Response("retry", { status: 503 }) : new Response("ok", { status: 200 }); }) as typeof fetch;
  try {
    await room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", seq: 1, x: 0.3, y: 0.4 }));
    const outbox = async () => await durable.storage.list({ prefix: "outbox:" });
    assert.equal((await outbox()).size, 1);
    const afterEviction = new ArcadeRoom(durable as never, env);
    for (let i = 0; i < 12; i += 1) await afterEviction.alarm();
    assert.equal(attempts, 12);
    assert.equal((await outbox()).size, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("a slow callback fetch does not delay an input acknowledgement", async () => {
  registerArcadeGame({ id: "air-hockey", minPlayers: 2, maxPlayers: 2, inputKinds: ["position"], inputCooldownMs: 34, createState: () => ({ seen: [] as number[] }), applyInput: (state, input, context) => { context.emit({ eventId: `slow-${input.seq}`, type: "goal", playerId: input.playerId, points: 1, occurredAt: input.receivedAt }); return { seen: [...(state as { seen: number[] }).seen, input.seq] }; }, snapshot: (state, tick) => ({ v: 1, gameId: "air-hockey", tick, state }) });
  const durable = fakeDurableState();
  const env = { ARCADE_TICKET_SECRET: secret, ARCADE_CONTROL_SECRET: secret, ARCADE_CALLBACK_SECRET: secret, SITE_CALLBACK_URL: "https://site.invalid" };
  const room = new ArcadeRoom(durable as never, env);
  await sendControl(room, env.ARCADE_CONTROL_SECRET, { v: 1, roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", roomVersion: 1, action: "start" });
  const socket = fakeSocket({ pendingRoom: "ABCD", pendingSince: Date.now() }); durable.sockets.push(socket as never);
  await room.webSocketMessage(socket as never, await createArcadeTicket({ ...liveClaims(), playerId: "p1" }, secret));
  const originalFetch = globalThis.fetch;
  let releaseFetch!: (response: Response) => void;
  let fetchStarted!: () => void;
  const started = new Promise<void>((resolve) => { fetchStarted = resolve; });
  globalThis.fetch = (() => { fetchStarted(); return new Promise<Response>((resolve) => { releaseFetch = resolve; }); }) as typeof fetch;
  try {
    await room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", seq: 1, x: 0.2, y: 0.4 }));
    assert.equal((await durable.storage.list({ prefix: "outbox:" })).size, 1);
    const alarm = room.alarm();
    await started;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await Promise.race([room.webSocketMessage(socket as never, JSON.stringify({ v: 1, type: "input", seq: 2, x: 0.4, y: 0.6 })), new Promise((_, reject) => setTimeout(() => reject(new Error("input acknowledgement waited on callback")), 100))]);
    releaseFetch(new Response("ok", { status: 200 }));
    await alarm;
  } finally { globalThis.fetch = originalFetch; }
});

test("signed callbacks verify the exact raw body and forged callbacks are rejected", async () => {
  const rawBody = JSON.stringify({ roomCode: "ABCD", events: [{ eventId: "g-1", matchId: "m-1", type: "goal", playerId: "p-1", points: 1, occurredAt: now }] });
  const headers = await signArcadeCallback(rawBody, secret, now, "callback-nonce-1234");
  assert.deepEqual(await verifyArcadeCallback(rawBody, headers, secret, now), { timestamp: now, nonce: "callback-nonce-1234" });
  await assert.rejects(verifyArcadeCallback(`${rawBody} `, headers, secret, now), /SIGNATURE/);
  await assert.rejects(verifyArcadeCallback(rawBody, { ...headers, signature: "00" }, secret, now), /SIGNATURE/);
});

test("duplicate valid callbacks are safely idempotent", async () => {
  const rawBody = JSON.stringify({ roomCode: "ABCD", events: [{ eventId: "g-1", matchId: "m-1", type: "goal", playerId: "p-1", points: 1, occurredAt: now }] });
  const headers = await signArcadeCallback(rawBody, secret, now, "retry-nonce-123456");
  const seen = new Set<string>();
  let writes = 0;
  const persist = async (roomId: string, events: unknown) => {
    assert.equal(roomId, "ABCD");
    const eventId = (events as Array<{ eventId: string }>)[0]!.eventId;
    if (!seen.has(eventId)) { seen.add(eventId); writes += 1; return { accepted: 1, completed: false }; }
    return { accepted: 0, completed: false };
  };
  assert.deepEqual(await processArcadeCallback(rawBody, headers, secret, now, persist), { accepted: 1, completed: false });
  assert.deepEqual(await processArcadeCallback(rawBody, await signArcadeCallback(rawBody, secret, now, "retry-nonce-200000"), secret, now, persist), { accepted: 0, completed: false });
  assert.equal(writes, 1);
});
