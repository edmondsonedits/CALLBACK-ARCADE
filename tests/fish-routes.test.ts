import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { advanceState, applyHostAction, createRoomState } from "../server/engine";
import { applyFishRequest } from "../server/fish-service";
import { applyFishFinaleAction, markUnavailableFish, submitFish, tickFishFinale } from "../server/arcade/fish_finale";
import { createSketchRelayMatch } from "../server/arcade/sketch_relay";
import { issueNativeArcadeSocketTicket } from "../lib/arcade/native-socket-ticket";
import type { FishFinaleAction, FishFinaleSnapshot, FishFinaleState } from "../lib/arcade/fish-finale";
import type { HostSnapshot } from "../lib/contracts";
import type { RoomState } from "../server/types";

// Exercise real route authentication, version suppression, serialization and room CAS against bounded SQL fakes.
interface Statement {
  sql: string; values: unknown[]; bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
let room: RoomState, clock = 1000000, commits = 0, hostHash = "";
let mediaAsset: { id: string; room_id: string; object_key: string; content_type: string; kind: string } | undefined;
const seatIdsByHash = new Map<string, string>();
const seatTokens = new Map<string, string>();
let contention: { expected: number; actionChecks: number; roomReads: number; actionGate: Promise<void>; releaseActions: () => void; roomGate: Promise<void>; releaseRooms: () => void } | undefined;
const actions = new Map<string, { actor_id: string; action_type: string; response_json: string }>();
function statement(sql: string): Statement {
  return { sql, values: [], bind(...values) { this.values = values; return this; },
    async first<T>() {
      let value: unknown = null;
      if (sql.startsWith("SELECT id, code, host_token_hash")) {
        value = { id: room.id, code: room.code, host_token_hash: hostHash, version: room.version, state_json: JSON.stringify(room), expires_at: clock + 3600000 };
        const active = contention;
        if (active && active.actionChecks === active.expected && active.roomReads < active.expected) {
          active.roomReads++;
          if (active.roomReads === active.expected) active.releaseRooms();
          await active.roomGate;
        }
      }
      else if (sql.startsWith("SELECT id, role, token_hash")) { const hash = String(this.values[1]); const id = this.values[0] === room.id ? seatIdsByHash.get(hash) : undefined; value = id ? { id, role: "player", token_hash: hash, removed_at: null } : null; }
      else if (sql.startsWith("SELECT object_key, content_type, kind FROM jobs")) { const candidate = mediaAsset; value = candidate && candidate.id === this.values[0] && candidate.room_id === this.values[1] ? candidate : null; }
      else if (sql.includes("FROM processed_actions")) {
        value = actions.get(String(this.values[1])) ?? null;
        const active = contention;
        if (active && active.actionChecks < active.expected) {
          active.actionChecks++;
          if (active.actionChecks === active.expected) active.releaseActions();
          await active.actionGate;
        }
      }
      else if (sql.startsWith("SELECT count FROM rate_limits")) value = { count: 1 };
      else if (sql.startsWith("SELECT 1 AS found FROM history_matches")) value = { found: 1 };
      return value as T | null;
    },
    async all<T>() { return { results: [] as T[] }; }, async run() { return { meta: { changes: 1 } }; },
  };
}
const db = { prepare: statement, async batch(statements: Statement[]) {
  let committed = false;
  return statements.map(s => {
    const v = s.values;
    if (s.sql.startsWith("UPDATE rooms SET phase")) {
      committed = room.id === v[10] && room.version === v[11];
      if (committed) { room = JSON.parse(String(v[3])) as RoomState; commits++; }
      return { meta: { changes: committed ? 1 : 0 } };
    }
    if (s.sql.startsWith("INSERT INTO processed_actions") && committed) actions.set(String(v[1]), { actor_id: String(v[2]), action_type: String(v[3]), response_json: String(v[4]) });
    return { meta: { changes: 1 } };
  });
} };
const mediaBytes = new Uint8Array([137, 80, 78, 71]);
const media = { async get(key: string) { const asset = mediaAsset; return asset?.object_key === key ? { body: new Blob([mediaBytes]).stream(), writeHttpMetadata(headers: Headers) { headers.set("Content-Type", asset.content_type); } } : null; } };
const env = { DB: db, MEDIA: media, PARTY_SECRET: "fish-route-test-secret-with-sufficient-length" };
(globalThis as unknown as { __fishRouteEnv: unknown }).__fishRouteEnv = env;
const hook = registerHooks({ resolve(specifier, context, nextResolve) { return specifier === "cloudflare:workers" ? { url: "data:text/javascript,export const env=globalThis.__fishRouteEnv;", shortCircuit: true } : nextResolve(specifier, context); } });
const { POST: fishPOST } = await import("../app/api/rooms/[code]/fish/route");
const { POST: hostActionPOST } = await import("../app/api/rooms/[code]/host-actions/route");
const { POST: syncPOST } = await import("../app/api/rooms/[code]/sync/route");
const { POST: nativePOST } = await import("../app/api/arcade/native-relay/route");
const { GET: fishMediaGET } = await import("../app/api/rooms/[code]/media/[assetId]/route");
const { sha256Hex } = await import("../server/crypto");
hook.deregister();

function act(s: FishFinaleState, type: FishFinaleAction["type"], fields: Record<string, unknown> = {}, id?: string) {
  clock = Math.max(clock + 1, s.updatedAt + 1);
  return applyFishFinaleAction(s, { host: !id, id }, { type, payload: { matchId: s.matchId, finaleId: s.finaleId, phase: s.phase, ...fields } } as FishFinaleAction, clock);
}
async function reset(phase: "configure" | "reveal" | "voting" | "cinematic" | "aquarium", playerCount = 3) {
  commits = 0; actions.clear(); clock = 1000000; contention = undefined;
  hostHash = await sha256Hex("host-token");
  mediaAsset = undefined;
  seatIdsByHash.clear(); seatTokens.clear();
  room = createRoomState("FISH", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false }, clock);
  for (let i = 1; i <= playerCount; i++) {
    const id = `p${i}`, token = playerCount === 3 && i === 1 ? "seat-token" : `seat-token-${id}`;
    room.participants.push({ id, nickname: `Artist ${i}`, nicknameNormalized: `artist ${i}`, role: "player", seat: i, lobbySlot: i, avatar: (i - 1) % 8, color: "#46DBDC", active: true, pendingActivation: false, bot: false, lastSeenAt: clock, removedAt: null });
    const hash = await sha256Hex(token); seatIdsByHash.set(hash, id); seatTokens.set(id, token);
  }
  room = applyHostAction(room, { type: "START_GAME", actionId: "main-start", expectedPhase: "LOBBY", roundId: "lobby", payload: {} }, ++clock).next;
  // These route tests exercise legacy encore compatibility; create the legacy v3 match explicitly.
  room.sketchRelay = createSketchRelayMatch({ matchId: room.arcadeMatch!.id, players: room.participants.map(player => player.id), now: ++clock, rulesVersion: 3 });
  room.deadlineAt = room.sketchRelay.deadline;
  for (let step = 0; room.phase === "ARCADE_ACTIVE" && step < 100; step++) { clock = room.deadlineAt!; room = (await advanceState(room, clock)).next; }
  assert.equal(room.phase, "ARCADE_RESULTS");
  room = applyFishRequest(room, { id: "host", host: true }, { type: "FISH_OPEN", actionId: "open", payload: { matchId: room.sketchRelay!.matchId } }, ++clock);
  if (phase === "configure") return;
  let s = act(room.sketchRelay!.finale!, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90 }); s = act(act(s, "FISH_START"), "FISH_ADVANCE");
  for (const player of room.participants) s = submitFish(s, player.id, `asset-${player.id}`, ++clock);
  for (let step = 0; s.phase !== "reveal" && step < 5; step++) { clock = s.deadline; if (s.phase === "readiness") s = markUnavailableFish(s, [], clock); s = tickFishFinale(s, clock); }
  if (phase !== "reveal") { clock = s.deadline; s = tickFishFinale(s, clock); }
  if (["cinematic", "aquarium"].includes(phase)) { s = act(s, "FISH_BALLOT", { ranking: [s.entries.find(e => e.playerId === "p2")!.id] }, "p1"); clock = s.deadline; s = tickFishFinale(s, clock); }
  if (phase === "aquarium") { s = act(s, "FISH_SKIP"); s = act(s, "FISH_ADVANCE"); }
  room.sketchRelay!.finale = s; assert.equal(s.phase, phase); clock = s.updatedAt;
}
async function resetFishTestLobby(playerCount = 3) {
  commits = 0; actions.clear(); clock = 1000000; contention = undefined;
  hostHash = await sha256Hex("host-token");
  mediaAsset = undefined; seatIdsByHash.clear(); seatTokens.clear();
  room = createRoomState("FISH", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false }, clock);
  for (let i = 1; i <= playerCount; i++) {
    const id = `p${i}`, token = playerCount === 3 && i === 1 ? "seat-token" : `seat-token-${id}`;
    room.participants.push({ id, nickname: `Artist ${i}`, nicknameNormalized: `artist ${i}`, role: "player", seat: i, lobbySlot: i, avatar: (i - 1) % 8, color: "#46DBDC", active: true, pendingActivation: false, bot: false, lastSeenAt: clock, removedAt: null });
    const hash = await sha256Hex(token); seatIdsByHash.set(hash, id); seatTokens.set(id, token);
  }
}
function fishRequest(type: string, cookies: string, fields: Record<string, unknown> = {}) {
  const f = room.sketchRelay!.finale!;
  return new Request("https://game.test/api/rooms/FISH/fish", { method: "POST", headers: { Origin: "https://game.test", Cookie: cookies, "Content-Type": "application/json" }, body: JSON.stringify({ actionId: crypto.randomUUID(), type, payload: { matchId: f.matchId, finaleId: f.finaleId, phase: f.phase, ...fields } }) });
}
function startFishTestRequest(cookies: string, actionId = crypto.randomUUID()) {
  return new Request("https://game.test/api/rooms/FISH/host-actions", { method: "POST", headers: { Origin: "https://game.test", Cookie: cookies, "Content-Type": "application/json" }, body: JSON.stringify({ actionId, type: "START_FISH_TEST", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }) });
}
const context = { params: Promise.resolve({ code: "FISH" }) };
const dualCookies = "callback_host_FISH=host-token; callback_seat_FISH=seat-token";
async function nativeTicket() { return issueNativeArcadeSocketTicket({ roomId: room.id, roomCode: room.code, gameId: "sketch-relay", matchId: room.arcadeMatch!.id, generationId: room.id, partyKey: `native-${room.id}`, actorId: "host", tokenHash: hostHash, role: "host" }, env.PARTY_SECRET, clock); }
async function poll(transport: "http" | "native", version: number, ticket?: Awaited<ReturnType<typeof nativeTicket>>) {
  if (transport === "http") {
    const response = await syncPOST(new Request("https://game.test/api/rooms/FISH/sync", { method: "POST", headers: { Origin: "https://game.test", Cookie: "callback_host_FISH=host-token", "Content-Type": "application/json" }, body: JSON.stringify({ version }) }), context);
    return { status: response.status, snapshot: response.status === 204 ? null : await response.json() as HostSnapshot };
  }
  assert.ok(ticket);
  const response = await nativePOST(new Request("https://game.test/api/arcade/native-relay", { method: "POST", headers: { Authorization: `Bearer ${env.PARTY_SECRET}`, "Content-Type": "application/json" }, body: JSON.stringify({ operation: "sync", entries: [{ ticket: ticket.ticket, nonce: ticket.claims.nonce, version }] }) }));
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json() as { projections: Array<{ snapshot: HostSnapshot | null; revoked?: boolean }> };
  assert.equal(body.projections[0]!.revoked, undefined);
  return { status: response.status, snapshot: body.projections[0]!.snapshot };
}
function playerCookies(playerId: string) { return `callback_host_FISH=host-token; callback_seat_FISH=${seatTokens.get(playerId)}`; }
function armContention(expected: number) {
  let releaseActions!: () => void, releaseRooms!: () => void;
  const actionGate = new Promise<void>(resolve => { releaseActions = resolve; });
  const roomGate = new Promise<void>(resolve => { releaseRooms = resolve; });
  contention = { expected, actionChecks: 0, roomReads: 0, actionGate, releaseActions, roomGate, releaseRooms };
}
function finale(snapshot: HostSnapshot | null): FishFinaleSnapshot { assert.ok(snapshot?.sketchRelay?.finale); return snapshot.sketchRelay.finale; }

for (const transport of ["http", "native"] as const) {
  test(`${transport} unchanged versions stay quiet, then publish each introduction boundary`, async t => {
    t.mock.method(Date, "now", () => clock); await reset("reveal"); const ticket = await nativeTicket(); const start = clock;
    const first = await poll(transport, 0, ticket); const initial = finale(first.snapshot), version = room.version;
    clock = start + 2999; const quiet = await poll(transport, version, ticket); assert.equal(quiet.snapshot, null); assert.equal(quiet.status, transport === "http" ? 204 : 200); assert.equal(commits, 0);
    clock = start + 3000; const next = await poll(transport, version, ticket); assert.equal(next.status, 200); const shown = finale(next.snapshot);
    assert.notEqual(shown.revealEntryId, initial.revealEntryId); assert.equal(shown.revealedEntryIds.length, 2); assert.equal(room.version, version + 1); assert.equal(commits, 1);
    assert.equal(shown.result, undefined); assert.equal(shown.entries.some(e => e.artistName || e.playerId), false);
    clock++; assert.equal((await poll(transport, room.version, ticket)).snapshot, null); assert.equal(commits, 1);
  });
  test(`${transport} cinematic shot and bite checkpoints publish without revealing future results`, async t => {
    t.mock.method(Date, "now", () => clock); await reset("cinematic"); const ticket = await nativeTicket(), start = clock;
    assert.equal((await poll(transport, room.version, ticket)).snapshot, null);
    clock = start + 4000; assert.equal(finale((await poll(transport, room.version, ticket)).snapshot).cinematic!.event!.kind, "shark-entry");
    clock = start + 8000; assert.equal(finale((await poll(transport, room.version, ticket)).snapshot).cinematic!.event!.kind, "hunt");
    clock = start + 10999; assert.equal((await poll(transport, room.version, ticket)).snapshot, null);
    clock = start + 11000; const bite = finale((await poll(transport, room.version, ticket)).snapshot);
    assert.equal(bite.cinematic!.eliminatedEntryIds.length, 1); assert.equal(bite.result, undefined); assert.equal(bite.champion, undefined); assert.equal(commits, 3);
  });
  test(`${transport} publishes the untimed aquarium's four-second revival-banner boundary once`, async t => {
    t.mock.method(Date, "now", () => clock); await reset("aquarium"); const ticket = await nativeTicket(), start = clock;
    clock = start + 3999; assert.equal((await poll(transport, room.version, ticket)).snapshot, null);
    clock = start + 4000; assert.equal(finale((await poll(transport, room.version, ticket)).snapshot).elapsedMs, 4000); assert.equal(commits, 1);
    clock = start + 9000; assert.equal((await poll(transport, room.version, ticket)).snapshot, null); assert.equal(commits, 1);
  });
}
test("fish route binds a dual-cookie ballot to its player seat and rejects a host-only ballot", async t => {
  t.mock.method(Date, "now", () => clock); await reset("voting"); const target = room.sketchRelay!.finale!.entries.find(e => e.playerId === "p2")!.id;
  const hostOnly = await fishPOST(fishRequest("FISH_BALLOT", "callback_host_FISH=host-token", { ranking: [target] }), context); assert.equal(hostOnly.status, 401);
  const dual = await fishPOST(fishRequest("FISH_BALLOT", dualCookies, { ranking: [target] }), context); assert.equal(dual.status, 200, await dual.clone().text());
  assert.deepEqual(room.sketchRelay!.finale!.ballots, [{ playerId: "p1", ranking: [target], lockedAt: clock }]);
  assert.equal([...actions.values()][0]!.actor_id, "p1");
});

test("ten simultaneous authenticated ballots all commit and identical action retry replays without a second commit", async t => {
  t.mock.method(Date, "now", () => clock); await reset("voting", 10);
  armContention(10);
  const mainResult = structuredClone(room.arcadeMatch);
  const mainScores = structuredClone(room.scoreEvents);
  const matchNumber = room.matchNumber;
  const finale = room.sketchRelay!.finale!;
  const requests = room.participants.map((player, index) => {
    const target = finale.entries.find(entry => entry.playerId === room.participants[(index + 1) % room.participants.length]!.id)!.id;
    return fishRequest("FISH_BALLOT", playerCookies(player.id), { ranking: [target] });
  });
  const retry = new Request(requests[0]!.url, { method: "POST", headers: requests[0]!.headers, body: await requests[0]!.clone().text() });
  const responses = await Promise.all(requests.map(request => fishPOST(request, context)));
  assert.deepEqual(responses.map(response => response.status), Array(10).fill(200), (await Promise.all(responses.map(response => response.clone().text()))).join("\n"));
  const saved = room.sketchRelay!.finale!;
  assert.equal(saved.ballots.length, 10);
  assert.deepEqual(new Set(saved.ballots.map(ballot => ballot.playerId)), new Set(room.participants.map(player => player.id)));
  assert.deepEqual(room.arcadeMatch, mainResult); assert.deepEqual(room.scoreEvents, mainScores); assert.equal(room.matchNumber, matchNumber);
  assert.equal(actions.size, 10); assert.equal(commits, 10);
  const beforeRetry = commits; const replay = await fishPOST(retry, context);
  assert.equal(replay.status, 200); assert.equal(commits, beforeRetry); assert.equal(room.sketchRelay!.finale!.ballots.length, 10);
});
test("host actions use only the host cookie and configure Back restores a reopenable offer", async t => {
  t.mock.method(Date, "now", () => clock); await reset("configure"); const main = structuredClone(room); delete main.sketchRelay!.finale;
  assert.equal((await fishPOST(fishRequest("FISH_CONFIGURE", "callback_seat_FISH=seat-token", { mode: "peaceful", drawingSeconds: 120 }), context)).status, 401);
  assert.equal((await fishPOST(fishRequest("FISH_BACK", dualCookies), context)).status, 200); assert.equal(room.sketchRelay!.finale, undefined);
  const after = structuredClone(room); delete after.sketchRelay!.finale;
  assert.deepEqual(after.arcadeMatch, main.arcadeMatch); assert.deepEqual(after.scoreEvents, main.scoreEvents); assert.deepEqual(after.sketchRelay, main.sketchRelay); assert.equal(after.matchNumber, main.matchNumber);
  const reopen = new Request("https://game.test/api/rooms/FISH/fish", { method: "POST", headers: { Origin: "https://game.test", Cookie: dualCookies, "Content-Type": "application/json" }, body: JSON.stringify({ actionId: "reopen-after-back", type: "FISH_OPEN", payload: { matchId: room.sketchRelay!.matchId } }) });
  assert.equal((await fishPOST(reopen, context)).status, 200); assert.equal(room.sketchRelay!.finale!.phase, "configure");
  assert.equal((await fishPOST(fishRequest("FISH_START", dualCookies), context)).status, 200);
  assert.equal((await fishPOST(fishRequest("FISH_BACK", dualCookies), context)).status, 409); assert.equal(room.sketchRelay!.finale!.phase, "tutorial");
});

test("fish route rejects an unknown action type before choosing cookie authorization", async t => {
  t.mock.method(Date, "now", () => clock); await reset("configure");
  const response = await fishPOST(fishRequest("FORGED_FISH_ACTION", ""), context);
  assert.equal(response.status, 422); assert.equal((await response.json() as { error: { code: string } }).error.code, "INVALID_FISH_ACTION");
});

test("fish test media allows trusted host previews but keeps player-only artwork access private", async t => {
  t.mock.method(Date, "now", () => clock); await resetFishTestLobby();
  room.soloMode = true;
  const started = await hostActionPOST(startFishTestRequest("callback_host_FISH=host-token"), context);
  assert.equal(started.status, 200);
  const f = room.sketchRelay!.finale!;
  room.sketchRelay!.finale = submitFish(f, "p1", "fish_asset_p1", ++clock);
  mediaAsset = { id: "fish_asset_p1", room_id: room.id, object_key: "rooms/FISH/fish/p1.png", content_type: "image/png", kind: "FISH_UPLOAD" };
  const params = { params: Promise.resolve({ code: "FISH", assetId: "fish_asset_p1" }) };
  const dual = await fishMediaGET(new Request("https://game.test/api/rooms/FISH/media/fish_asset_p1", { headers: { Cookie: playerCookies("p1") } }), params);
  assert.equal(dual.status, 200, await dual.clone().text());
  assert.deepEqual(new Uint8Array(await dual.arrayBuffer()), mediaBytes);
  const otherPlayer = await fishMediaGET(new Request("https://game.test/api/rooms/FISH/media/fish_asset_p1", { headers: { Cookie: `callback_seat_FISH=${seatTokens.get("p2")}` } }), params);
  assert.equal(otherPlayer.status, 404);
  room.participants[0]!.active = false;
  const inactiveSeat = await fishMediaGET(new Request("https://game.test/api/rooms/FISH/media/fish_asset_p1", { headers: { Cookie: playerCookies("p1") } }), params);
  assert.equal(inactiveSeat.status, 200, "the independently valid host cookie permits test previews");
  room.participants[0]!.active = true;
  const wrongRoomSeat = await fishMediaGET(new Request("https://game.test/api/rooms/FISH/media/fish_asset_p1", { headers: { Cookie: "callback_host_FISH=host-token; callback_seat_FISH=wrong-room-seat-token" } }), params);
  assert.equal(wrongRoomSeat.status, 200, "an invalid seat does not revoke the independently authenticated test host");
  const hostOnly = await fishMediaGET(new Request("https://game.test/api/rooms/FISH/media/fish_asset_p1", { headers: { Cookie: "callback_host_FISH=host-token" } }), params);
  assert.equal(hostOnly.status, 200, "test host can display accepted anonymous art immediately");
});
test("temporary fish shortcut is host-only, bound to its fish match, and exits back to lobby without a main result", async t => {
  t.mock.method(Date, "now", () => clock); await resetFishTestLobby();
  const player = await hostActionPOST(startFishTestRequest("callback_seat_FISH=seat-token"), context);
  assert.equal(player.status, 401);
  assert.equal(room.sketchRelay, null);

  const started = await hostActionPOST(startFishTestRequest("callback_host_FISH=host-token"), context);
  assert.equal(started.status, 200, await started.clone().text());
  assert.equal(room.phase, "LOBBY"); assert.equal(room.status, "LOBBY"); assert.equal(room.arcadeMatch, null);
  assert.equal(room.sketchRelay!.fishTest, true); assert.equal(room.sketchRelay!.finale!.phase, "drawing");
  assert.equal(room.deadlineAt, null); assert.deepEqual(room.scoreEvents, []);
  assert.equal(room.sketchRelay!.finale!.entries.length, 0); assert.equal(room.sketchRelay!.showdown!.promptSubmissions.length, 0);

  const wrongMatch = await fishPOST(fishRequest("FISH_EXIT", "callback_host_FISH=host-token", { matchId: "another-room-match" }), context);
  assert.equal(wrongMatch.status, 409); assert.equal(room.sketchRelay!.fishTest, true);
  const back = await fishPOST(fishRequest("FISH_BACK", "callback_host_FISH=host-token"), context);
  assert.equal(back.status, 200, await back.clone().text());
  assert.equal(room.phase, "LOBBY"); assert.equal(room.status, "LOBBY"); assert.equal(room.arcadeMatch, null);
  assert.equal(room.sketchRelay, null); assert.equal(room.joiningLocked, false); assert.equal(room.matchNumber, 1);
});


test("normal bonus host cannot fetch a drawing before the staged reveal", async t=>{
 t.mock.method(Date,"now",()=>clock);await reset("configure");
 room.sketchRelay!.finale=act(act(room.sketchRelay!.finale!,"FISH_START"),"FISH_ADVANCE");
 room.sketchRelay!.finale=submitFish(room.sketchRelay!.finale!,"p1","fish_asset_p1",++clock);
 mediaAsset={id:"fish_asset_p1",room_id:room.id,object_key:"rooms/FISH/fish/p1.png",content_type:"image/png",kind:"FISH_UPLOAD"};
 const response=await fishMediaGET(new Request("https://game.test/api/rooms/FISH/media/fish_asset_p1",{headers:{Cookie:"callback_host_FISH=host-token"}}),{params:Promise.resolve({code:"FISH",assetId:"fish_asset_p1"})});
 assert.equal(response.status,404);
});
