import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";
import type { MagicDuellMatch } from "../server/arcade/magic_duell";

const matchOf = (room: ReturnType<typeof createRoomState>) => room.magicDuell as MagicDuellMatch;
const start = () => {
  const room = createRoomState("DUEL", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "magic-duell" }, 80_000);
  for (const [seat, id] of ["duel-a", "duel-b"].entries()) room.participants.push({ id, nickname: `Duelist ${seat + 1}`, nicknameNormalized: `duelist ${seat + 1}`, role: "player", seat: seat + 1, avatar: seat, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 80_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-duel", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 80_001).next;
};
const player = (room: ReturnType<typeof start>, id: string, type: "SUBMIT_MAGIC_DUELL_LOADOUT" | "SUBMIT_MAGIC_DUELL_CAST", payload: Record<string, unknown>, now: number) => applyPlayerAction(room, id, { type, actionId: `player-${id}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload } as never, now).next;
test("Magic Duell starts two fixed seats, keeps drafts and casts private, and serializes D1 state", () => {
  let room = start();
  assert.equal(matchOf(room).players.length, 2);
  room = player(room, "duel-a", "SUBMIT_MAGIC_DUELL_LOADOUT", { matchId: matchOf(room).matchId, spellIds: ["comet-lance", "spark-bolt", "stillwater"] }, 80_002);
  const own = playerSnapshot(room, room.participants[0]!, 80_002).magicDuell!;
  const rival = playerSnapshot(room, room.participants[1]!, 80_002).magicDuell!;
  const hostView = hostSnapshot(room, 80_002).magicDuell!;
  assert.deepEqual(own.ownLoadout, ["comet-lance", "spark-bolt", "stillwater"]);
  assert.equal("ownLoadout" in rival, false);
  assert.equal("loadouts" in hostView, false);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).magicDuell, matchOf(room));
});

test("Magic Duell pauses and resumes its draft, defaults missing loadouts after the timeout, and reveals private casts only after lock", async () => {
  let room = start();
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-duel", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 80_002).next;
  const resumed = applyHostAction(paused, { type: "RESUME", actionId: "resume-duel", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 80_500).next;
  assert.equal(resumed.paused, false);
  room = resumed;
  const deadline = matchOf(room).deadline;
  const preDeadline = await advanceState(room, deadline + 1_999);
  assert.equal(preDeadline.changed, false);
  const started = await advanceState(room, deadline + 2_000);
  assert.equal(started.changed, true);
  assert.equal(matchOf(started.next).phase, "casting");
  assert.ok(matchOf(started.next).players.every((id) => matchOf(started.next).loadouts[id]?.length === 3));
  room = started.next;
  const target = matchOf(room).players[0]!;
  room = player(room, target, "SUBMIT_MAGIC_DUELL_CAST", { matchId: matchOf(room).matchId, round: 1, spellId: "spark-bolt", stroke: [{ x: .1, y: .5 }, { x: .28, y: .34 }, { x: .45, y: .2 }, { x: .2, y: .8 }, { x: .85, y: .4 }] }, deadline + 2_001);
  assert.equal("choices" in hostSnapshot(room, deadline + 2_001).magicDuell!, false);
  assert.equal("ownSpellId" in playerSnapshot(room, room.participants.find((entry) => entry.id === target)!, deadline + 2_001).magicDuell!, true);
  const castDeadline = matchOf(room).deadline;
  assert.equal((await advanceState(room, castDeadline + 1_999)).changed, false);
  const recovery = await advanceState(room, castDeadline + 2_000);
  assert.equal(recovery.changed, true); room = recovery.next;
  const revealed = hostSnapshot(room, castDeadline + 2_000).magicDuell!;
  assert.equal(revealed.roundResults.length, 1);
  assert.equal(revealed.roundResults[0]?.timedOut, true);
  assert.equal(deserializeRoomState(serializeRoomState(room)).magicDuell?.phase, "revealed");
});
