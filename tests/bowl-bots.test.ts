import assert from "node:assert/strict";
import test from "node:test";
import { HostActionSchema, PlayerActionSchema } from "../lib/contracts";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { serializeRoomState, deserializeRoomState } from "../server/serialization";

function bowlRoom(code: string, bots: number) {
  const room = createRoomState(code, { gameLength: "bowl-of-fools", contentMode: "party", timerAccessibility: false, foolScrollsPerPlayer: 1, foolPerformance: "DRAWING" }, 50_000);
  room.id = code;
  for (let seat = 1; seat <= 4; seat += 1) room.participants.push({ id: `${bots === 4 ? "fool-bot" : seat <= bots ? "fool-bot" : "human"}-${seat}`, nickname: `Fool ${seat}`, nicknameNormalized: `fool ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: seat <= bots, lastSeenAt: 50_000, removedAt: null });
  return room;
}

function judgeBotTurn(state: Awaited<ReturnType<typeof advanceState>>["next"], now: number, decision: "correct" | "pass" = "correct", guess?: string) {
  const round = state.currentRound;
  assert.ok(round?.kind === "BOWL_OF_FOOLS");
  const bot = state.participants.find((player) => player.id === round.foolClueGiverId);
  assert.equal(bot?.bot, true);
  const secret = round.foolScrolls.find((scroll) => scroll.id === round.foolCurrentScrollId)?.text;
  return applyHostAction(state, { type: "JUDGE_BOT_FOOL", actionId: `judge:${state.version}`, roundId: round.id, expectedPhase: state.phase, payload: { decision, ...(decision === "correct" ? { guess: guess ?? secret } : {}) } } as never, now).next;
}

test("bot judgment schema requires a bounded answer only for correct calls", () => {
  const base = { actionId: "judge-schema", roundId: "round", expectedPhase: "FOOL_TURN" };
  assert.equal(HostActionSchema.safeParse({ ...base, type: "JUDGE_BOT_FOOL", payload: { decision: "correct" } }).success, false);
  assert.equal(HostActionSchema.safeParse({ ...base, type: "JUDGE_BOT_FOOL", payload: { decision: "correct", guess: "  " } }).success, false);
  assert.equal(HostActionSchema.safeParse({ ...base, type: "JUDGE_BOT_FOOL", payload: { decision: "correct", guess: "x".repeat(101) } }).success, false);
  assert.equal(HostActionSchema.safeParse({ ...base, type: "JUDGE_BOT_FOOL", payload: { decision: "pass" } }).success, true);
});

test("bot Bowl clues and performances do not score until the host judges a spoken guess", async () => {
  const room = bowlRoom("FOOLM001", 2);
  let state = applyHostAction(room, { type: "START_GAME", actionId: "start-mixed-bowl", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 50_001).next;
  const humanIds = state.participants.filter((player) => player.role === "player" && !player.bot).map((player) => player.id);
  for (const [index, humanId] of humanIds.entries()) state = applyPlayerAction(state, humanId, PlayerActionSchema.parse({ type: "SET_FOOL_READY", actionId: `human-ready-${index}`, roundId: state.currentRound?.id ?? "lobby", expectedPhase: state.phase, payload: { ready: true } }), 50_002 + index).next;
  state = (await advanceState(state, 50_010)).next;
  for (let step = 0; state.phase !== "FOOL_WRITING" && step < 4; step += 1) state = (await advanceState(state, (state.deadlineAt ?? 50_010) + 1)).next;
  assert.equal(state.phase, "FOOL_WRITING");
  const now = Math.max(60_012, state.phaseStartedAt + 1);
  for (const [index, humanId] of humanIds.entries()) state = applyPlayerAction(state, humanId, PlayerActionSchema.parse({ type: "SUBMIT_FOOL_SCROLLS", actionId: `human-scroll-${index}`, roundId: state.currentRound!.id, expectedPhase: state.phase, payload: { scrolls: [`Human answer ${index + 1}`] } }), now + index).next;
  for (let step = 0; step < 80 && (state.currentRound?.kind !== "BOWL_OF_FOOLS" || !state.currentRound.foolSpokenClue); step += 1) {
    const result = await advanceState(state, now + 10 + step * 1_000);
    if (result.changed) state = deserializeRoomState(serializeRoomState(result.next));
  }
  const round = state.currentRound;
  assert.ok(round?.kind === "BOWL_OF_FOOLS");
  assert.equal(state.phase, "FOOL_TURN");
  assert.equal(state.participants.find((player) => player.id === round.foolClueGiverId)?.bot, true);
  assert.ok(round.foolSpokenClue, "bot submits an answer-relevant public clue");
  assert.equal(state.foolTeamScores[round.foolTurnTeam], 0, "the bot clue never awards its own point");
  const firstScrollId = round.foolCurrentScrollId;
  state = applyHostAction(state, { type: "JUDGE_BOT_FOOL", actionId: `judge-pass:${state.version}`, roundId: round.id, expectedPhase: state.phase, payload: { decision: "pass" } }, 60_000).next;
  assert.equal(state.foolTeamScores[round.foolTurnTeam], 0, "a host-judged pass does not score");
  assert.equal(state.currentRound?.kind === "BOWL_OF_FOOLS" && state.currentRound.foolPassUsed, true);
  assert.notEqual(state.currentRound?.kind === "BOWL_OF_FOOLS" ? state.currentRound.foolCurrentScrollId : null, firstScrollId);
  for (let step = 0; step < 8 && (state.currentRound?.kind !== "BOWL_OF_FOOLS" || !state.currentRound.foolSpokenClue); step += 1) {
    const result = await advanceState(state, 60_010 + step * 1_000);
    if (result.changed) state = deserializeRoomState(serializeRoomState(result.next));
  }
  assert.ok(state.currentRound?.kind === "BOWL_OF_FOOLS" && state.currentRound.foolSpokenClue);
  state = judgeBotTurn(state, 70_000);
  assert.equal(state.foolTeamScores[round.foolTurnTeam], 1, "only the explicit host judgment awards the point");
});

test("bot Bowl correct judgment requires a completed performance and exact bounded spoken guess", async () => {
  const room = bowlRoom("FOOLJ001", 4);
  let state = applyHostAction(room, { type: "START_GAME", actionId: "start-judge-guards", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 50_001).next;
  for (let step = 0; step < 80 && (state.phase !== "FOOL_TURN" || state.currentRound?.kind !== "BOWL_OF_FOOLS" || !state.currentRound.foolSpokenClue); step += 1) {
    const result = await advanceState(state, (state.deadlineAt ?? 50_010) + 1 + step * 1000);
    if (result.changed) state = deserializeRoomState(serializeRoomState(result.next));
  }
  const round = state.currentRound;
  assert.ok(round?.kind === "BOWL_OF_FOOLS");
  const correctGuess = round.foolScrolls.find((scroll) => scroll.id === round.foolCurrentScrollId)?.text;
  assert.ok(correctGuess);
  const team = round.foolTurnTeam;
  const action = (guess: string) => ({ type: "JUDGE_BOT_FOOL" as const, actionId: `judge-guard:${guess}:${state.version}`, roundId: round.id, expectedPhase: state.phase, payload: { decision: "correct" as const, guess } });
  assert.throws(() => applyHostAction(state, action("wrong spoken answer") as never, 70_000), /FOOL_BOT_GUESS_INCORRECT/);
  assert.equal(state.foolTeamScores[team], 0);

  const beforePerformance = structuredClone(state);
  beforePerformance.currentRound!.foolBotClueAt = null;
  beforePerformance.currentRound!.foolSpokenClue = null;
  assert.throws(() => applyHostAction(beforePerformance, action(correctGuess) as never, 70_001), /FOOL_BOT_PERFORMANCE_PENDING/);
  assert.equal(beforePerformance.foolTeamScores[team], 0);

  const scored = applyHostAction(state, action(correctGuess) as never, 70_002).next;
  assert.equal(scored.foolTeamScores[team], 1);
  assert.throws(() => applyHostAction(scored, { ...action(correctGuess), actionId: "repeat-judge" } as never, 70_003), /FOOL_BOT_PERFORMANCE_PENDING/);
  assert.equal(scored.foolTeamScores[team], 1);
});

test("four Bowl bots can play three rounds under explicit host judgment", async () => {
  const room = bowlRoom("FOOLBOT", 4);
  let state = applyHostAction(room, { type: "START_GAME", actionId: "start-bowl-bots", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 50_001).next;
  let now = 50_002;
  for (let step = 0; step < 500 && state.phase !== "FINAL_RESULTS"; step += 1) {
    const result = await advanceState(state, now);
    if (result.changed) state = deserializeRoomState(serializeRoomState(result.next));
    now += 1_000;
    if (["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(state.phase) && state.currentRound?.kind === "BOWL_OF_FOOLS" && state.currentRound.foolBotClueAt !== null) {
      state = judgeBotTurn(state, now);
      now += 1;
    }
  }
  assert.equal(state.phase, "FINAL_RESULTS");
  assert.equal(state.foolWinner !== null, true);
  const scrollTexts = state.currentRound?.kind === "BOWL_OF_FOOLS" ? state.currentRound.foolScrolls.map((scroll) => scroll.text) : [];
  assert.equal(new Set(scrollTexts).size, 4);
  assert.ok(scrollTexts.length >= 4);
});

test("ten Bowl bots produce fifty unique familiar, guessable scrolls without ID suffixes", async () => {
  const room = bowlRoom("FOOLPOOL", 4);
  room.foolScrollsPerPlayer = 5;
  for (let seat = 5; seat <= 10; seat += 1) room.participants.push({ id: `pool-bot-${seat}`, nickname: `Pool Bot ${seat}`, nicknameNormalized: `pool bot ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: true, lastSeenAt: 50_000, removedAt: null });
  let state = applyHostAction(room, { type: "START_GAME", actionId: "start-fifty-scrolls", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 50_001).next;
  for (let step = 0; step < 20 && (state.currentRound?.kind !== "BOWL_OF_FOOLS" || state.currentRound.foolScrolls.length < 50); step += 1) {
    const result = await advanceState(state, (state.deadlineAt ?? 50_010) + 1 + step * 1_000);
    if (result.changed) state = deserializeRoomState(serializeRoomState(result.next));
  }
  const scrolls = state.currentRound?.kind === "BOWL_OF_FOOLS" ? state.currentRound.foolScrolls : [];
  assert.equal(scrolls.length, 50);
  assert.equal(new Set(scrolls.map((scroll) => scroll.text.normalize("NFKC").toLocaleLowerCase())).size, 50);
  assert.ok(scrolls.every(({ text }) => /^[\p{L}]+$/u.test(text) && text.length <= 20), "every bot answer is a short familiar word, without opaque IDs or numeric suffixes");
});
