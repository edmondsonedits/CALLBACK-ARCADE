import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createRoomSchema } from "../lib/contracts";
import { applyHostAction, createRoomState } from "../server/engine";
import { arcadeFinalizeRoomCasGuard, createArcadeMatch, recordArcadeEvents } from "../server/arcade/room";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { issueArcadeTicket, resolveArcadeTicketRole, selectArcadeControllerIds, verifyArcadeTicket } from "../server/arcade/tickets";

const base = { contentMode: "party", timerAccessibility: false } as const;

function addTestPlayers(room: ReturnType<typeof createRoomState>) {
  for (let seat = 1; seat <= 2; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null });
}

test("ordinary room payloads retain their legacy defaults", () => {
  const parsed = createRoomSchema.parse({});
  assert.equal(parsed.gameLength, "pictures");
  assert.equal(parsed.arcadeGameId, undefined);
  const room = createRoomState("ABCD", { ...base, gameLength: "standard" });
  assert.equal(room.arcadeGameId, null);
});

test("Arcade room creation requires a catalog game and rejects mismatched game IDs", () => {
  assert.equal(createRoomSchema.safeParse({ ...base, gameLength: "arcade" }).success, false);
  assert.equal(createRoomSchema.safeParse({ ...base, gameLength: "standard", arcadeGameId: "air-hockey" }).success, false);
  assert.equal(createRoomSchema.safeParse({ ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }).success, true);
  assert.throws(() => createRoomState("ABCD", { ...base, gameLength: "arcade" } as never), /ARCADE_GAME_REQUIRED/);
});

test("Arcade controller rotation is deterministic and spectators receive a non-input role ticket", async () => {
  const participants = [1, 2, 3, 4].map((seat) => ({ id: `player-${seat}`, role: "player", seat, active: true, removedAt: null, bot: false }));
  const threePlayerMatch = participants.slice(0, 3);
  assert.deepEqual(selectArcadeControllerIds("air-hockey", participants, 1), ["player-1", "player-2", "player-3", "player-4"]);
  assert.deepEqual(selectArcadeControllerIds("air-hockey", participants, 2), ["player-1", "player-2", "player-3", "player-4"]);
  assert.deepEqual(selectArcadeControllerIds("tap-race", threePlayerMatch, 1), ["player-1", "player-2", "player-3"]);
  assert.equal(resolveArcadeTicketRole("player", "player-3", selectArcadeControllerIds("tap-race", participants, 1)), "player");
  assert.equal(resolveArcadeTicketRole("player", "player-11", selectArcadeControllerIds("air-hockey", participants, 1)), "spectator");
  const manyPlayers = Array.from({ length: 20 }, (_, index) => ({ id: `player-${index + 1}`, role: "player", seat: index + 1, active: true, removedAt: null, bot: false }));
  assert.equal(selectArcadeControllerIds("air-hockey", manyPlayers, 1).length, 10);
  assert.deepEqual(selectArcadeControllerIds("tap-race", manyPlayers, 1), manyPlayers.slice(0, 10).map(({ id }) => id));
  assert.deepEqual(selectArcadeControllerIds("tap-race", manyPlayers, 2), manyPlayers.slice(1, 11).map(({ id }) => id));
  const assigned = selectArcadeControllerIds("tap-race", threePlayerMatch, 1);
  const playerRole = resolveArcadeTicketRole("player", "player-3", assigned);
  const assignedTicket = await issueArcadeTicket({ roomCode: "ABCD", gameId: "tap-race", matchId: "match-2", role: playerRole, playerId: "player-3" }, "test-secret");
  assert.equal((await verifyArcadeTicket(assignedTicket.ticket, "test-secret")).role, "player");
  assert.ok(assigned.includes("player-3"));
  const { ticket } = await issueArcadeTicket({ roomCode: "ABCD", gameId: "air-hockey", matchId: "match-1", role: "spectator", playerId: "player-4" }, "test-secret");
  const claims = await verifyArcadeTicket(ticket, "test-secret", { roomCode: "ABCD", matchId: "match-1", role: "spectator", playerId: "player-4" });
  assert.equal(claims.role, "spectator");
  assert.equal(claims.playerId, "player-4");
  await assert.rejects(verifyArcadeTicket(ticket, "test-secret", { role: "player" }), /ARCADE_TICKET_BINDING/);
});

test("Arcade room state round-trips without inventing creative rounds or scoring", () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  assert.deepEqual(room.roundPlan, []);
  assert.equal(room.arcadeGameId, "air-hockey");
  assert.deepEqual(room.scoreEvents, []);
  const restored = deserializeRoomState(serializeRoomState(room));
  assert.equal(restored.arcadeGameId, "air-hockey");
  assert.equal(restored.phase, "LOBBY");
  const legacy = JSON.parse(serializeRoomState(createRoomState("EFGH", { ...base, gameLength: "standard" }, 1_000))) as Record<string, unknown>;
  delete legacy.arcadeGameId; delete legacy.arcadeMatch;
  const restoredLegacy = deserializeRoomState(JSON.stringify(legacy));
  assert.equal(restoredLegacy.arcadeGameId, null);
  assert.equal(restoredLegacy.arcadeMatch, null);
});

test("starting an Arcade match initializes its D1 lifecycle record", () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  addTestPlayers(room);
  const result = applyHostAction(room, { type: "START_GAME", actionId: "start-arcade", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 2_000);
  assert.equal(result.next.phase, "ARCADE_ACTIVE");
  assert.equal(result.next.status, "ACTIVE");
  assert.equal(result.next.arcadeMatch?.startedAt, 2_000);
  assert.deepEqual(result.next.arcadeMatch?.controllerIds, ["player-1", "player-2"]);
  const removed = structuredClone(result.next);
  removed.participants[0]!.active = false;
  removed.participants[0]!.removedAt = 2_100;
  const restored = deserializeRoomState(serializeRoomState(removed));
  assert.deepEqual(restored.arcadeMatch?.controllerIds, ["player-1", "player-2"]);
  assert.equal(result.effects[0]?.type, "arcade_match");
  assert.deepEqual(result.next.roundPlan, []);
});

test("Arcade pause and resume stay in the D1 active phase without creative timers", () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  addTestPlayers(room);
  const active = createArcadeMatch(room, "air-hockey", 2_000).room;
  const paused = applyHostAction(active, { type: "PAUSE", actionId: "pause-arcade", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 3_000).next;
  assert.equal(paused.phase, "ARCADE_ACTIVE");
  assert.equal(paused.paused, true);
  assert.equal(paused.deadlineAt, null);
  const resumed = applyHostAction(paused, { type: "RESUME", actionId: "resume-arcade", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 4_000).next;
  assert.equal(resumed.phase, "ARCADE_ACTIVE");
  assert.equal(resumed.paused, false);
  assert.equal(resumed.deadlineAt, null);
});

test("duplicate Arcade result events are recorded once", async () => {
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  const persistedEvents: Array<{ event_key: string; event_type: "goal" | "result"; player_id: string | null; points: number; payload_json: string; occurred_at: number }> = [];
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  addTestPlayers(room);
  const active = createArcadeMatch(room, "air-hockey", 2_000).room;
  const database = {
    prepare(sql: string) { return { bind: (...values: unknown[]) => ({ first: async () => ({ version: active.version, state_json: serializeRoomState(active) }), all: async () => ({ results: persistedEvents }), sql, values }) }; },
    batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
      writes.push(...statements);
      const results = statements.map((statement) => {
        const key = String(statement.values[0]);
        if (persistedEvents.some((event) => event.event_key === key)) return { meta: { changes: 0 } };
        persistedEvents.push({ event_key: key, event_type: String(statement.values[3]) as "goal" | "result", player_id: statement.values[4] as string | null, points: Number(statement.values[5]), payload_json: String(statement.values[6]), occurred_at: Number(statement.values[7]) });
        return { meta: { changes: 1 } };
      });
      return results;
    },
  } as never;
  const event = { eventId: "goal-1", matchId: active.arcadeMatch!.id, type: "goal", playerId: "player-1", points: 1, occurredAt: 3_000 } as const;
  await recordArcadeEvents(active.id, [event, event], database);
  await recordArcadeEvents(active.id, [event], database);
  assert.equal(writes.length, 2);
  assert.ok(writes.every((statement) => statement.sql.includes("ON CONFLICT(event_key) DO NOTHING")));
});

test("a validated final Arcade event commits the D1 results phase", async () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  addTestPlayers(room);
  const active = createArcadeMatch(room, "air-hockey", 2_000).room;
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  const persistedEvents: Array<{ event_key: string; event_type: "goal" | "result"; player_id: string | null; points: number; payload_json: string; occurred_at: number }> = [];
  const database = {
    prepare(sql: string) { return { bind: (...values: unknown[]) => ({ first: async () => ({ version: active.version, state_json: serializeRoomState(active) }), all: async () => ({ results: persistedEvents }), sql, values }) }; },
    batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
      writes.push(...statements);
      const eventWrite = statements.find((statement) => statement.sql.startsWith("INSERT INTO arcade_score_events"));
      if (eventWrite) persistedEvents.push({ event_key: String(eventWrite.values[0]), event_type: String(eventWrite.values[3]) as "goal" | "result", player_id: eventWrite.values[4] as string | null, points: Number(eventWrite.values[5]), payload_json: String(eventWrite.values[6]), occurred_at: Number(eventWrite.values[7]) });
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  } as never;
  const result = await recordArcadeEvents(active.id, [{ eventId: "final-1", matchId: active.arcadeMatch!.id, type: "result", playerId: null, points: 0, occurredAt: 3_000, payload: { winners: ["player-1"] } }], database);
  assert.deepEqual(result, { accepted: 1, completed: true });
  const roomUpdate = writes.find((statement) => statement.sql.startsWith("UPDATE rooms SET phase"));
  assert.equal(roomUpdate?.values[0], "ARCADE_RESULTS");
  assert.match(String(roomUpdate?.values[2]), /"phase":"ARCADE_RESULTS"/);
});

test("Light Trails assigns up to ten same-room human rider seats to its realtime match", () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "light-trails" }, 1_000);
  for (let seat = 1; seat <= 10; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null });
  const match = createArcadeMatch(room, "light-trails", 2_000).room.arcadeMatch;
  assert.deepEqual(match?.controllerIds, Array.from({ length: 10 }, (_, index) => `player-${index + 1}`));
});

test("Schaetzorama finalization CAS requires an active arcade_matches row before changing room state", () => {
  const effect = {
    type: "arcade_finalize" as const,
    match: { id: "match-finalize", gameId: "schaetzorama" as const, matchNumber: 1, status: "COMPLETE" as const, startedAt: 1_000, endedAt: 2_000, result: { matchId: "match-finalize", winners: [] } },
    event: { eventId: "match-finalize:schaetzorama:complete", matchId: "match-finalize", type: "result" as const, playerId: null, points: 0, occurredAt: 2_000, payload: { matchId: "match-finalize", winners: [] } },
  };
  const guard = arcadeFinalizeRoomCasGuard([effect], "room-finalize");
  assert.match(guard.sql, /EXISTS \(SELECT 1 FROM arcade_matches WHERE id = \? AND room_id = \? AND status = 'ACTIVE'\)/);
  assert.deepEqual(guard.values, ["match-finalize", "room-finalize"]);
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE rooms (id TEXT PRIMARY KEY, version INTEGER NOT NULL, phase TEXT NOT NULL); CREATE TABLE arcade_matches (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, status TEXT NOT NULL)");
  sqlite.prepare("INSERT INTO rooms (id, version, phase) VALUES (?, ?, ?)").run("room-finalize", 1, "ARCADE_ACTIVE");
  const update = sqlite.prepare(`UPDATE rooms SET version = ?, phase = ? WHERE id = ? AND version = ?${guard.sql}`);
  assert.equal(update.run(2, "ARCADE_RESULTS", "room-finalize", 1, ...guard.values).changes, 0);
  const unchanged = sqlite.prepare("SELECT version, phase FROM rooms WHERE id = ?").get("room-finalize") as { version: number; phase: string };
  assert.equal(unchanged.version, 1);
  assert.equal(unchanged.phase, "ARCADE_ACTIVE");
  sqlite.prepare("INSERT INTO arcade_matches (id, room_id, status) VALUES (?, ?, 'ACTIVE')").run("match-finalize", "room-finalize");
  assert.equal(update.run(2, "ARCADE_RESULTS", "room-finalize", 1, ...guard.values).changes, 1);
  sqlite.close();
});

test("each Arcade title can finalize with its own stable result event key", () => {
  const effect = {
    type: "arcade_finalize" as const,
    match: { id: "imposter-match", gameId: "imposter" as const, matchNumber: 1, status: "COMPLETE" as const, startedAt: 1_000, endedAt: 2_000, result: { matchId: "imposter-match", winners: ["player-1"] } },
    event: { eventId: "imposter-match:imposter:complete", matchId: "imposter-match", type: "result" as const, playerId: null, points: 0, occurredAt: 2_000, payload: { matchId: "imposter-match", winners: ["player-1"] } },
  };
  const guard = arcadeFinalizeRoomCasGuard([effect], "room-imposter");
  assert.match(guard.sql, /status = 'ACTIVE'/);
  assert.deepEqual(guard.values, ["imposter-match", "room-imposter"]);
});

test("a stale Arcade room version cannot persist events or complete the match", async () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  addTestPlayers(room);
  const active = createArcadeMatch(room, "air-hockey", 2_000).room;
  const concurrentRoom = structuredClone(active);
  concurrentRoom.version += 1;
  concurrentRoom.updatedAt += 1;
  let roomReads = 0;
  let batchStatements: Array<{ sql: string; values: unknown[] }> = [];
  const database = {
    prepare(sql: string) {
      return {
        bind: (...values: unknown[]) => ({
          first: async () => {
            roomReads += 1;
            const current = roomReads === 1 ? active : concurrentRoom;
            return { version: current.version, state_json: serializeRoomState(current) };
          },
          all: async () => ({ results: [] }),
          sql,
          values,
        }),
      };
    },
    batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
      batchStatements = statements;
      return statements.map(() => ({ meta: { changes: 0 } }));
    },
  } as never;
  const event = { eventId: "stale-final", matchId: active.arcadeMatch!.id, type: "result", playerId: null, points: 0, occurredAt: 3_000, payload: { winners: ["player-1"] } } as const;

  await assert.rejects(recordArcadeEvents(active.id, [event], database), /ROOM_CHANGED/);
  assert.equal(roomReads, 2);
  assert.match(batchStatements[0]?.sql ?? "", /^UPDATE rooms SET phase/);
  assert.ok(batchStatements.slice(1).every((statement) => statement.sql.includes("version = ?")));
});

test("a goal callback that races with result completion cannot persist after the match closes", async () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  addTestPlayers(room);
  const active = createArcadeMatch(room, "air-hockey", 2_000).room;
  const complete = structuredClone(active);
  complete.phase = "ARCADE_RESULTS";
  complete.status = "COMPLETE";
  complete.version += 1;
  complete.arcadeMatch = { ...complete.arcadeMatch!, status: "COMPLETE", endedAt: 3_000, result: { winners: ["player-1"] } };

  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE rooms (id TEXT PRIMARY KEY, version INTEGER NOT NULL, phase TEXT NOT NULL, state_json TEXT NOT NULL);
    CREATE TABLE arcade_matches (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE arcade_score_events (event_key TEXT PRIMARY KEY, match_id TEXT NOT NULL, room_id TEXT NOT NULL, event_type TEXT NOT NULL, player_id TEXT, points INTEGER NOT NULL, payload_json TEXT NOT NULL, occurred_at INTEGER NOT NULL);
  `);
  sqlite.prepare("INSERT INTO rooms (id, version, phase, state_json) VALUES (?, ?, ?, ?)").run(active.id, active.version, active.phase, serializeRoomState(active));
  sqlite.prepare("INSERT INTO arcade_matches (id, room_id, status) VALUES (?, ?, ?)").run(active.arcadeMatch!.id, active.id, "ACTIVE");
  const database = {
    prepare(sql: string) {
      return {
        bind: (...values: unknown[]) => ({
          first: async () => sqlite.prepare(sql).get(...values as never[]) ?? null,
          all: async () => ({ results: sqlite.prepare(sql).all(...values as never[]) }),
          sql,
          values,
        }),
      };
    },
    batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
      // The result callback wins after the goal request reads ACTIVE but before
      // its guarded INSERT executes.
      sqlite.prepare("UPDATE rooms SET version = ?, phase = ?, state_json = ? WHERE id = ?").run(complete.version, complete.phase, serializeRoomState(complete), active.id);
      sqlite.prepare("UPDATE arcade_matches SET status = 'COMPLETE' WHERE id = ?").run(active.arcadeMatch!.id);
      return statements.map(({ sql, values }) => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values as never[]).changes) } }));
    },
  } as never;
  const goal = { eventId: "late-goal", matchId: active.arcadeMatch!.id, type: "goal", playerId: "player-1", points: 1, occurredAt: 3_100 } as const;

  await assert.rejects(recordArcadeEvents(active.id, [goal], database), /ROOM_CHANGED/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM arcade_score_events").get()?.count, 0);
  sqlite.close();
});

test("a result event cannot finalize with an existing conflicting event key", async () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  addTestPlayers(room);
  const active = createArcadeMatch(room, "air-hockey", 2_000).room;
  let batches = 0;
  const eventId = "shared-key";
  const existingGoal = {
    event_key: `${active.arcadeMatch!.id}:${eventId}`,
    event_type: "goal",
    player_id: "player-1",
    points: 1,
    payload_json: "{}",
    occurred_at: 2_900,
  };
  const database = {
    prepare(sql: string) {
      return {
        bind: (...values: unknown[]) => ({
          first: async () => ({ version: active.version, state_json: serializeRoomState(active) }),
          all: async () => ({ results: sql.includes("FROM arcade_score_events") ? [existingGoal] : [] }),
          sql,
          values,
        }),
      };
    },
    batch: async () => { batches += 1; return []; },
  } as never;
  const event = { eventId, matchId: active.arcadeMatch!.id, type: "result", playerId: null, points: 0, occurredAt: 3_000, payload: { winners: ["player-1"] } } as const;

  await assert.rejects(recordArcadeEvents(active.id, [event], database), /ARCADE_EVENT_CONFLICT/);
  assert.equal(batches, 0);
});

test("an exact final-result callback retry confirms the saved result event", async () => {
  const room = createRoomState("ABCD", { ...base, gameLength: "arcade", arcadeGameId: "air-hockey" }, 1_000);
  addTestPlayers(room);
  const active = createArcadeMatch(room, "air-hockey", 2_000).room;
  const resultEvent = { eventId: "retry-result", matchId: active.arcadeMatch!.id, type: "result" as const, playerId: null, points: 0, occurredAt: 3_000, payload: { winners: ["player-1"] } };
  const complete = structuredClone(active);
  complete.phase = "ARCADE_RESULTS";
  complete.status = "COMPLETE";
  complete.arcadeMatch = { ...complete.arcadeMatch!, status: "COMPLETE", endedAt: resultEvent.occurredAt, result: resultEvent.payload };
  const persisted = {
    event_key: `${complete.arcadeMatch.id}:${resultEvent.eventId}`,
    event_type: "result" as const,
    player_id: null,
    points: 0,
    payload_json: JSON.stringify(resultEvent.payload),
    occurred_at: resultEvent.occurredAt,
  };
  const database = {
    prepare(sql: string) {
      return {
        bind: (...values: unknown[]) => ({
          first: async () => ({ version: complete.version, state_json: serializeRoomState(complete) }),
          all: async () => ({ results: sql.includes("FROM arcade_score_events") ? [persisted] : [] }),
          sql,
          values,
        }),
      };
    },
    batch: async () => { throw new Error("RETRY_MUST_NOT_WRITE"); },
  } as never;

  assert.deepEqual(await recordArcadeEvents(active.id, [resultEvent], database), { accepted: 0, completed: true });
});
