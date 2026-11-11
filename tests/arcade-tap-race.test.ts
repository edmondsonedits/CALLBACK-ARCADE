import assert from "node:assert/strict";
import test from "node:test";
import { createRoomState } from "../server/engine.js";
import { createArcadeMatch, recordArcadeEvents } from "../server/arcade/room.js";
import { serializeRoomState } from "../server/serialization.js";

async function loadTapRace() {
  return import("../arcade-worker/src/games/tap-race.js").catch(() => null);
}

test("Tap Race declares a bounded multiplayer tap-only module", async () => {
  const tapRaceModule = await loadTapRace();
  assert.ok(tapRaceModule, "Tap Race engine module must be registered in the Worker source");
  assert.equal(tapRaceModule.tapRaceGame.id, "tap-race");
  assert.equal(tapRaceModule.tapRaceGame.minPlayers, 2);
  assert.equal(tapRaceModule.tapRaceGame.maxPlayers, 10);
  assert.deepEqual(tapRaceModule.tapRaceGame.inputKinds, ["tap"]);
  assert.ok(tapRaceModule.tapRaceGame.inputCooldownMs > 0);
});

test("Tap Race accepts only server-approved taps and resolves one stable final result", async () => {
  const tapRaceModule = await loadTapRace();
  assert.ok(tapRaceModule, "Tap Race engine module must exist");
  const { tapRaceGame, TAP_RACE_FINISH_DISTANCE } = tapRaceModule;
  const state = tapRaceGame.createState("match-deterministic", 1_000, ["p1", "p2"]);
  const events: Record<string, unknown>[] = [];
  const input = { kind: "tap" as const, playerId: "p1", seq: 1, receivedAt: 1_001 };
  tapRaceGame.applyInput(state, input, { now: 1_001, emit: (event) => events.push(event) });
  assert.equal((state as { racers: Array<{ playerId: string; progress: number; tapCount: number }> }).racers[0]?.progress, 1);
  assert.equal((state as { racers: Array<{ playerId: string; progress: number; tapCount: number }> }).racers[0]?.tapCount, 1);

  const mutable = state as { racers: Array<{ playerId: string; progress: number; tapCount: number }> };
  mutable.racers[0]!.progress = TAP_RACE_FINISH_DISTANCE - 1;
  tapRaceGame.applyInput(state, { ...input, seq: 2 }, { now: 1_002, emit: (event) => events.push(event) });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventId, "match-deterministic:final");
  assert.deepEqual(tapRaceGame.finalResult?.(state), { winners: ["p1"], tied: false, progress: { p1: TAP_RACE_FINISH_DISTANCE, p2: 0 } });
  assert.throws(() => tapRaceGame.applyInput(state, { ...input, seq: 3 }, { now: 1_003, emit: (event) => events.push(event) }), /MATCH_COMPLETE/);
  assert.equal(events.length, 1, "the final event must be emitted once");
});

test("Tap Race resolves a deterministic tie at the match deadline and exposes only compact public progress", async () => {
  const tapRaceModule = await loadTapRace();
  assert.ok(tapRaceModule, "Tap Race engine module must exist");
  const state = tapRaceModule.createTapRaceState("match-timeout", 5_000, ["p1", "p2", "p3"]);
  const mutable = state as { racers: Array<{ playerId: string; progress: number }> };
  mutable.racers[0]!.progress = 9;
  mutable.racers[1]!.progress = 9;
  mutable.racers[2]!.progress = 4;
  const events: Record<string, unknown>[] = [];
  tapRaceModule.tapRaceGame.step?.(state, 1000 / 60, { now: (state as { deadlineAt: number }).deadlineAt, emit: (event) => events.push(event) });
  assert.deepEqual(tapRaceModule.tapRaceGame.finalResult?.(state), { winners: ["p1", "p2"], tied: true, progress: { p1: 9, p2: 9, p3: 4 } });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventId, "match-timeout:final");

  const playerView = tapRaceModule.tapRaceGame.snapshot(state, 60, { role: "player", playerId: "p2" });
  assert.deepEqual(Object.keys(playerView.state as object).sort(), ["courseLength", "racers", "status", "viewer"].sort());
  assert.deepEqual((playerView.state as { viewer: unknown }).viewer, { role: "player", playerId: "p2" });
  assert.equal(JSON.stringify(playerView).includes("startedAt"), false);
});

test("Tap Race final event validates and persists through the Site callback event path", async () => {
  const tapRaceModule = await loadTapRace();
  assert.ok(tapRaceModule, "Tap Race engine module must exist");
  const state = tapRaceModule.createTapRaceState("callback-match", 10_000, ["p1", "p2"]);
  const mutable = state as { racers: Array<{ playerId: string; progress: number }>; deadlineAt: number };
  mutable.racers[0]!.progress = 12;
  mutable.racers[1]!.progress = 12;
  let callbackEvent: Record<string, unknown> | undefined;
  tapRaceModule.stepTapRace(state, 1000 / 60, mutable.deadlineAt, (event) => { callbackEvent = event; });

  const room = createRoomState("ABCD", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "tap-race" }, 1_000);
  for (let seat = 1; seat <= 2; seat += 1) room.participants.push({ id: `p${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null });
  const active = createArcadeMatch(room, "tap-race", 2_000).room;
  const persisted: Array<{ event_key: string; event_type: "goal" | "result"; player_id: string | null; points: number; payload_json: string; occurred_at: number }> = [];
  const database = {
    prepare(sql: string) {
      return { bind: (...values: unknown[]) => ({
        first: async () => ({ version: active.version, state_json: serializeRoomState(active) }),
        all: async () => ({ results: persisted }),
        sql,
        values,
      }) };
    },
    batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
      const eventInsert = statements.find((statement) => statement.sql.startsWith("INSERT INTO arcade_score_events"));
      if (eventInsert) persisted.push({ event_key: String(eventInsert.values[0]), event_type: "result", player_id: eventInsert.values[4] as string | null, points: Number(eventInsert.values[5]), payload_json: String(eventInsert.values[6]), occurred_at: Number(eventInsert.values[7]) });
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  } as never;

  assert.ok(callbackEvent);
  assert.equal(callbackEvent.playerId, null);
  assert.equal(callbackEvent.points, 0);
  assert.deepEqual(callbackEvent.payload, { winners: ["p1", "p2"], tied: true, progress: { p1: 12, p2: 12 } });
  const response = await recordArcadeEvents(active.id, [{ ...callbackEvent, matchId: active.arcadeMatch!.id }], database);
  assert.deepEqual(response, { accepted: 1, completed: true });
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]!.player_id, null);
  assert.equal(persisted[0]!.points, 0);
  assert.deepEqual(JSON.parse(persisted[0]!.payload_json), { winners: ["p1", "p2"], tied: true, progress: { p1: 12, p2: 12 } });
});

test("Tap Race deadline continues from remaining time after a pause past the original deadline", async () => {
  const tapRaceModule = await loadTapRace();
  assert.ok(tapRaceModule, "Tap Race engine module must exist");
  const state = tapRaceModule.createTapRaceState("paused-match", 1_000, ["p1", "p2"]);
  const deadlineAt = (state as { deadlineAt: number }).deadlineAt;
  tapRaceModule.tapRaceGame.pause?.(state, deadlineAt - 2_000);
  tapRaceModule.tapRaceGame.step?.(state, 1000 / 60, { now: deadlineAt + 30_000, emit: () => assert.fail("paused race must not finish") });
  assert.equal(tapRaceModule.tapRaceGame.finalResult?.(state), null);

  const resumedAt = deadlineAt + 30_000;
  tapRaceModule.tapRaceGame.resume?.(state, resumedAt);
  assert.equal((state as { deadlineAt: number }).deadlineAt, resumedAt + 2_000);
  tapRaceModule.tapRaceGame.step?.(state, 1000 / 60, { now: resumedAt + 1_999, emit: () => assert.fail("race must retain time after resume") });
  assert.equal(tapRaceModule.tapRaceGame.finalResult?.(state), null);
  tapRaceModule.tapRaceGame.step?.(state, 1000 / 60, { now: resumedAt + 2_000, emit: () => undefined });
  assert.deepEqual(tapRaceModule.tapRaceGame.finalResult?.(state), { winners: ["p1", "p2"], tied: true, progress: { p1: 0, p2: 0 } });
});
