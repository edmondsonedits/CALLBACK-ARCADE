import assert from "node:assert/strict";
import test from "node:test";
import { createRoomSchema, type HostAction, type PlayerAction } from "../lib/contracts";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { rebalanceBowlTeams } from "../server/bowl";
import { displaySnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import type { ParticipantState, RoomState } from "../server/types";

function participant(index: number): ParticipantState { return { id: `p${index}`, nickname: `Player ${index}`, nicknameNormalized: `player ${index}`, role: "player", seat: index, avatar: index - 1, color: "#46dbdc", active: true, pendingActivation: false, bot: false, lastSeenAt: 1000, removedAt: null }; }
function room(count = 4, options: Partial<Parameters<typeof createRoomState>[1]> = {}): RoomState {
  const state = createRoomState("F00L", { gameLength: "bowl", contentMode: "party", timerAccessibility: false, scrollsPerPlayer: 1, openingTutorial: false, ...options }, 1000);
  state.participants = Array.from({ length: count }, (_, index) => participant(index + 1)); rebalanceBowlTeams(state); return state;
}
function host(state: RoomState, type: HostAction["type"], payload: Record<string, unknown> = {}, now = 1100) { return applyHostAction(state, { type, actionId: `${type}-${now}`, roundId: state.currentRound?.id ?? "lobby", expectedPhase: state.phase, payload } as HostAction, now).next; }
function player(state: RoomState, id: string, type: PlayerAction["type"], payload: Record<string, unknown> = {}, now = 1200) { return applyPlayerAction(state, id, { type, actionId: `${type}-${id}-${now}`, roundId: state.currentRound!.id, expectedPhase: state.phase, payload } as PlayerAction, now).next; }
function started(options: Partial<Parameters<typeof createRoomState>[1]> = {}) { return host(room(4, options), "START_GAME"); }
function submitted(state: RoomState) { for (let index = 1; index <= 4; index += 1) state = player(state, `p${index}`, "SUBMIT_BOWL_SCROLLS", { scrolls: [`Foolish thing ${index}`] }, 1200 + index); return state; }

test("Bowl of Fools requires four humans and excludes solo play and bots", () => {
  assert.throws(() => host(room(3), "START_GAME"), /NOT_ENOUGH_PLAYERS/);
  assert.equal(createRoomSchema.safeParse({ gameLength: "bowl", contentMode: "party", timerAccessibility: false, soloMode: true, soloPlayerName: "Tester" }).success, false);
  const withBot = room(); withBot.participants[3].bot = true; assert.throws(() => host(withBot, "START_GAME"), /NOT_ENOUGH_PLAYERS|BOWL_HUMANS_ONLY/);
  assert.throws(() => host(room(), "ADD_BOT"), /BOTS_UNAVAILABLE/);
});

test("teams auto-balance, remain host-editable, and require two players each", () => {
  let state = room(5); assert.equal(Object.values(state.bowl!.teams).filter((team) => team === "bells").length, 3); assert.equal(Object.values(state.bowl!.teams).filter((team) => team === "motley").length, 2);
  state = host(state, "SET_BOWL_TEAM", { playerId: "p2", team: "bells" }); assert.equal(state.bowl!.teams.p2, "bells"); assert.throws(() => host(state, "START_GAME"), /BOWL_TEAM_MINIMUM/);
});

test("scroll count, word limits, duplicate rejection, fallback, and permanent anonymity are enforced", async () => {
  let state = started({ scrollsPerPlayer: 2 });
  assert.throws(() => player(state, "p1", "SUBMIT_BOWL_SCROLLS", { scrolls: ["Only one"] }), /BOWL_SCROLL_COUNT/);
  assert.throws(() => player(state, "p1", "SUBMIT_BOWL_SCROLLS", { scrolls: ["one two three four five six", "Fine"] }), /BOWL_WORD_LIMIT/);
  assert.throws(() => player(state, "p1", "SUBMIT_BOWL_SCROLLS", { scrolls: ["The Moon", "the moon"] }), /BOWL_DUPLICATE_SCROLL/);
  state = player(state, "p1", "SUBMIT_BOWL_SCROLLS", { scrolls: ["The Moon", "Royal Turnip"] });
  state.deadlineAt = 1300; state = (await advanceState(state, 1300)).next; assert.equal(state.bowl!.scrolls.length, 8);
  const secret = state.bowl!.scrolls.find((scroll) => scroll.authorId === "p1")!.text; const clue = state.bowl!.clueGiverId!;
  for (const snapshot of [hostSnapshot(state), displaySnapshot(state), ...state.participants.filter((p) => p.id !== clue).map((p) => playerSnapshot(state, p))]) { const json = JSON.stringify(snapshot); assert.equal(json.includes(secret), false); assert.equal(json.includes("authorId"), false); }
  const clueSnapshot = playerSnapshot(state, state.participants.find((p) => p.id === clue)!); assert.equal(clueSnapshot.bowl?.activeScroll, state.bowl!.scrolls.find((scroll) => scroll.id === state.bowl!.activeScrollId)?.text); assert.equal(JSON.stringify(clueSnapshot).includes("authorId"), false);
});

test("Correct scores once, Pass returns a scroll once, and timeout alternates teams with fair rotation", async () => {
  let state = submitted(started()); const firstId = state.bowl!.activeScrollId; const giver = state.bowl!.clueGiverId!;
  state = player(state, giver, "BOWL_PASS"); assert.equal(state.bowl!.passUsed, true); assert.notEqual(state.bowl!.activeScrollId, firstId); assert.equal(state.bowl!.remainingIds.at(-1), firstId); assert.throws(() => player(state, giver, "BOWL_PASS"), /BOWL_PASS_UNAVAILABLE/);
  state = player(state, giver, "BOWL_CORRECT", {}, 1400); assert.equal(state.bowl!.scores.bells, 1); assert.equal(state.scoreEvents.filter((event) => event.kind === "bowl_correct").length, 1);
  const previousTeam = state.bowl!.activeTeam; const previousGiver = state.bowl!.clueGiverId; state.deadlineAt = 1500; state = (await advanceState(state, 1500)).next; assert.notEqual(state.bowl!.activeTeam, previousTeam); assert.notEqual(state.bowl!.clueGiverId, previousGiver);
  state.deadlineAt = 1600; state = (await advanceState(state, 1600)).next; assert.equal(state.bowl!.activeTeam, previousTeam); assert.notEqual(state.bowl!.clueGiverId, previousGiver);
});

test("Drawing is bounded and clue-giver-only; one-word clues contain no whitespace", () => {
  let state = submitted(started({ bowlRoundTwo: "drawing" })); state.bowl!.roundNumber = 2; state.currentRound!.kind = "BOWL_DRAW_OR_PERFORM";
  const giver = state.bowl!.clueGiverId!; const other = state.participants.find((p) => p.id !== giver)!.id; const stroke = { id: "stroke-1", color: "ink", width: .01, points: [{ x: .1, y: .1 }, { x: .9, y: .9 }] };
  assert.throws(() => player(state, other, "BOWL_DRAWING_STROKES", { strokes: [stroke] }), /BOWL_CLUE_GIVER_ONLY/);
  state = player(state, giver, "BOWL_DRAWING_STROKES", { strokes: [stroke] }); assert.equal(state.bowl!.drawing.length, 1);
  state.bowl!.roundNumber = 3; state.currentRound!.kind = "BOWL_ONE_WORD";
  assert.throws(() => player(state, giver, "BOWL_ONE_WORD", { word: "two words" }), /BOWL_ONE_WORD|Invalid|Cannot/);
  state = player(state, giver, "BOWL_ONE_WORD", { word: "turnip" }); assert.equal(state.bowl!.clueWord, "turnip");
});

test("the original bowl returns, behind/non-emptying teams start, and undo crosses a round transition", async () => {
  let state = submitted(started()); const original = new Set(state.bowl!.scrolls.map((scroll) => scroll.id)); const giver = state.bowl!.clueGiverId!;
  while (state.phase === "BOWL_TURN") state = player(state, state.bowl!.clueGiverId!, "BOWL_CORRECT", {}, 1400 + state.bowl!.remainingIds.length);
  assert.equal(state.phase, "BOWL_INTERMISSION"); const emptying = state.bowl!.lastEmptyingTeam; state.deadlineAt = 1600; state = (await advanceState(state, 1600)).next;
  assert.deepEqual(new Set(state.bowl!.remainingIds), original); assert.equal(state.bowl!.activeTeam, emptying === "bells" ? "motley" : "bells");
  while (state.bowl!.remainingIds.length > 1) state = player(state, state.bowl!.clueGiverId!, "BOWL_CORRECT", {}, 1700 + state.bowl!.remainingIds.length);
  const scoreBefore = { ...state.bowl!.scores }; const activeBefore = state.bowl!.activeScrollId; state = player(state, state.bowl!.clueGiverId!, "BOWL_CORRECT", {}, 1800); assert.equal(state.phase, "BOWL_INTERMISSION");
  state = host(state, "UNDO_BOWL_CORRECT", {}, 1810); assert.equal(state.phase, "BOWL_TURN"); assert.equal(state.bowl!.activeScrollId, activeBefore); assert.deepEqual(state.bowl!.scores, scoreBefore); assert.equal(state.bowl!.undo, null); assert.equal(state.scoreEvents.at(-1)?.kind, "bowl_undo"); assert.equal(giver.startsWith("p"), true);
});

test("a final tie creates one no-pass sudden-death scroll and first Correct wins with undo available", () => {
  let state = submitted(started()); state.bowl!.roundNumber = 3; state.bowl!.scores = state.bowl!.activeTeam === "bells" ? { bells: 5, motley: 6 } : { bells: 6, motley: 5 }; state.bowl!.remainingIds = [state.bowl!.activeScrollId!]; state.currentRound!.kind = "BOWL_ONE_WORD";
  state = player(state, state.bowl!.clueGiverId!, "BOWL_CORRECT", {}, 2000); assert.equal(state.phase, "BOWL_SUDDEN_DEATH"); assert.equal(state.bowl!.remainingIds.length, 1); assert.equal(state.bowl!.passUsed, false); assert.equal(state.bowl!.suddenDeath, true);
  assert.throws(() => player(state, state.bowl!.clueGiverId!, "BOWL_PASS", {}, 2010), /BOWL_PASS_UNAVAILABLE/);
  const team = state.bowl!.activeTeam; state = player(state, state.bowl!.clueGiverId!, "BOWL_CORRECT", {}, 2020); assert.equal(state.phase, "FINAL_RESULTS"); assert.equal(state.bowl!.winnerTeam, team); assert.equal(Boolean(state.bowl!.undo), true);
  state = host(state, "UNDO_BOWL_CORRECT", {}, 2030); assert.equal(state.phase, "BOWL_SUDDEN_DEATH"); assert.equal(state.bowl!.winnerTeam, null);
});

test("serialization and reconnect preserve Bowl state without widening secret disclosure", () => {
  const state = submitted(started()); const restored = deserializeRoomState(serializeRoomState(state)); assert.deepEqual(restored.bowl, state.bowl);
  const giver = restored.bowl!.clueGiverId!; const clue = playerSnapshot(restored, restored.participants.find((p) => p.id === giver)!); const rival = playerSnapshot(restored, restored.participants.find((p) => p.id !== giver)!);
  assert.ok(clue.bowl?.activeScroll); assert.equal(rival.bowl?.activeScroll, undefined); assert.equal(JSON.stringify(hostSnapshot(restored)).includes(clue.bowl!.activeScroll!), false);
});
