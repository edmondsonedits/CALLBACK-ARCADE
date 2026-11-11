import type { HostAction, PlayerAction, RoomPhase, RoundKind } from "../lib/contracts";
import { deterministicShuffle, makeId, stableHash } from "../lib/game/random";
import type { BowlState, DbEffect, RoomState, RoundState, ScoreEventState } from "./types";

const clone = <T>(value: T): T => structuredClone(value);
const teams = ["bells", "motley"] as const;
const FALLBACK_SCROLLS = ["A suspicious turnip", "The moon", "Sir Stinky Boots", "A royal rubber duck", "Dancing castle", "The pigeon crown", "Invisible soup", "Haunted trousers", "The tiny dragon", "Queen of snacks", "A loud potato", "Wizard haircut", "Forbidden kazoo", "Nervous knight", "The cheese throne"];

function players(state: RoomState) {
  return state.participants.filter((p) => p.role === "player" && p.active && !p.removedAt && !p.bot).sort((a, b) => a.seat - b.seat);
}

export function createBowlState(options: { playEnvironment?: BowlState["environment"]; bowlRoundTwo?: BowlState["roundTwo"]; scrollsPerPlayer?: number; builtInVoice?: boolean; openingTutorial?: boolean }): BowlState {
  return {
    environment: options.playEnvironment ?? "same_table", roundTwo: options.bowlRoundTwo ?? "drawing", scrollsPerPlayer: options.scrollsPerPlayer ?? 3,
    builtInVoice: (options.playEnvironment ?? "same_table") === "remote_live" && (options.builtInVoice ?? false), openingTutorial: options.openingTutorial ?? true,
    teams: {}, submissions: {}, scrolls: [], remainingIds: [], activeScrollId: null, activeTeam: null, clueGiverId: null,
    teamOrders: { bells: [], motley: [] }, clueIndexes: { bells: 0, motley: 0 }, passUsed: false, scores: { bells: 0, motley: 0 },
    roundNumber: 0, lastEmptyingTeam: null, drawing: [], clueWord: null, suddenDeath: false, suddenDeathOccurred: false, suddenDeathScrollId: null, winnerTeam: null, undo: null,
  };
}

export function rebalanceBowlTeams(state: RoomState): void {
  if (!state.bowl) return;
  const active = players(state);
  const activeIds = new Set(active.map((p) => p.id));
  for (const id of Object.keys(state.bowl.teams)) if (!activeIds.has(id)) delete state.bowl.teams[id];
  for (const player of active) {
    if (state.bowl.teams[player.id]) continue;
    const bells = Object.values(state.bowl.teams).filter((team) => team === "bells").length;
    const motley = Object.values(state.bowl.teams).filter((team) => team === "motley").length;
    state.bowl.teams[player.id] = bells <= motley ? "bells" : "motley";
  }
}

function makeRound(state: RoomState, roundNumber: number, now: number): RoundState {
  const kind: RoundKind = roundNumber === 1 ? "BOWL_SPEAK" : roundNumber === 2 ? "BOWL_DRAW_OR_PERFORM" : roundNumber === 3 ? "BOWL_ONE_WORD" : "BOWL_SUDDEN_DEATH";
  const label = roundNumber === 1 ? "Speak, Fool!" : roundNumber === 2 ? state.bowl?.roundTwo === "drawing" ? "Draw, Fool!" : "Perform, Fool!" : roundNumber === 3 ? "One Word, Fool!" : "Sudden Death";
  return {
    id: makeId("bowl-round"), index: Math.max(0, roundNumber - 1), kind, label, promptId: `bowl-${roundNumber}`, prompt: label,
    instruction: null, catchModifier: null, choiceOptions: [], callbackSourceLoreIds: [], startedAt: now, answers: [], votes: [],
    personalChoices: {}, kingPollEvents: [], predictions: {}, authorAssignments: {}, authorGuesses: {}, authorGuessesScored: false,
    authorGuessResults: {}, wagers: {}, voteStage: null, scored: false, results: null, image: null, featuredAnswerId: null,
    developerScoreCap: null, kingMysteryOrder: [], kingMysteryIndex: 0, kingMysteryDecoys: {}, kingMysterySealUsedByPlayer: {},
    kingMysteryVotes: {}, kingMysteryResults: {}, royalRumourAssignments: {}, royalRumourGuesses: {}, royalRumourRevealOrder: [],
    royalRumourRevealIndex: 0, warRankings: {}, warTrueOrder: [], warTargetRanks: [], warPlacements: {}, warClues: [],
    warTurnTeam: "LION", warTurnNumber: 0, warMaxTurns: 0, warLastMove: null,
    foolScrolls: [], foolRoundNumber: 1, foolPool: [], foolTurnTeam: "BELLS", foolClueGiverId: null,
    foolTeamTurns: { BELLS: 0, MOTLEY: 0 }, foolPassUsed: false, foolCurrentScrollId: null,
    foolOneWord: null, foolSpokenClue: null, foolPerformanceCue: null, foolBotClueAt: null, foolStrokes: [], foolLastResult: null, foolSuddenDeath: false, foolUndo: null,
  };
}

function setPhase(state: RoomState, phase: RoomPhase, now: number, durationMs: number | null): void {
  state.phase = phase; state.phaseStartedAt = now; state.deadlineAt = durationMs ? now + durationMs : null; state.paused = false; state.remainingMs = null;
}

function turnMs(state: RoomState, sudden = false): number { return (sudden ? 30_000 : 60_000) * (state.timerAccessibility ? 1.5 : 1); }

function pickClueGiver(state: RoomState, team: "bells" | "motley"): string {
  const bowl = state.bowl!;
  const order = bowl.teamOrders[team].filter((id) => players(state).some((p) => p.id === id && bowl.teams[id] === team));
  if (!order.length) throw new Error("TEAM_EMPTY");
  bowl.teamOrders[team] = order;
  const index = bowl.clueIndexes[team] % order.length;
  bowl.clueIndexes[team] = (index + 1) % order.length;
  return order[index];
}

function startTurn(state: RoomState, team: "bells" | "motley", now: number, sudden = false): void {
  const bowl = state.bowl!;
  bowl.activeTeam = team; bowl.clueGiverId = pickClueGiver(state, team); bowl.activeScrollId = bowl.remainingIds[0] ?? bowl.suddenDeathScrollId;
  bowl.passUsed = false; bowl.drawing = []; bowl.clueWord = null; bowl.undo = null;
  setPhase(state, sudden ? "BOWL_SUDDEN_DEATH" : "BOWL_TURN", now, turnMs(state, sudden));
}

function fillFallbacks(state: RoomState): void {
  const bowl = state.bowl!;
  const used = new Set(bowl.scrolls.map((s) => s.text.toLocaleLowerCase()));
  for (const player of players(state)) {
    const submitted = bowl.submissions[player.id] ?? [];
    for (let i = submitted.length; i < bowl.scrollsPerPlayer; i++) {
      let offset = stableHash(`${state.id}:${state.matchNumber}:${player.id}:${i}`) % FALLBACK_SCROLLS.length;
      while (used.has(FALLBACK_SCROLLS[offset].toLocaleLowerCase())) offset = (offset + 1) % FALLBACK_SCROLLS.length;
      const text = FALLBACK_SCROLLS[offset]; used.add(text.toLocaleLowerCase()); submitted.push(text);
      bowl.scrolls.push({ id: makeId("scroll"), authorId: player.id, text });
    }
    bowl.submissions[player.id] = submitted;
  }
}

function startRound(state: RoomState, roundNumber: 1 | 2 | 3, now: number, starter?: "bells" | "motley"): void {
  const bowl = state.bowl!;
  bowl.roundNumber = roundNumber; bowl.suddenDeath = false; bowl.activeScrollId = null; bowl.drawing = []; bowl.clueWord = null; bowl.passUsed = false; bowl.undo = null;
  bowl.remainingIds = deterministicShuffle(bowl.scrolls.map((scroll) => scroll.id), `${state.id}:bowl:${state.matchNumber}:round:${roundNumber}`);
  state.roundIndex = roundNumber - 1; state.currentRound = makeRound(state, roundNumber, now);
  const chosen = starter ?? (bowl.scores.bells < bowl.scores.motley ? "bells" : bowl.scores.motley < bowl.scores.bells ? "motley" : bowl.lastEmptyingTeam === "bells" ? "motley" : "bells");
  startTurn(state, chosen, now);
}

export function startBowlGame(state: RoomState, now: number): void {
  if (!state.bowl) throw new Error("BOWL_REQUIRED");
  rebalanceBowlTeams(state);
  const active = players(state);
  if (active.length < 4) throw new Error("NOT_ENOUGH_PLAYERS");
  if (active.length > 10 || state.participants.some((p) => p.bot && !p.removedAt)) throw new Error("BOWL_HUMANS_ONLY");
  if (teams.some((team) => active.filter((p) => state.bowl!.teams[p.id] === team).length < 2)) throw new Error("BOWL_TEAM_MINIMUM");
  state.bowl.teamOrders = { bells: active.filter((p) => state.bowl!.teams[p.id] === "bells").map((p) => p.id), motley: active.filter((p) => state.bowl!.teams[p.id] === "motley").map((p) => p.id) };
  state.bowl.clueIndexes = { bells: 0, motley: 0 }; state.status = "ACTIVE"; state.joiningLocked = true;
  state.currentRound = makeRound(state, 1, now); state.roundIndex = 0;
  setPhase(state, state.bowl.openingTutorial ? "BOWL_TUTORIAL" : "BOWL_SCROLL_WRITING", now, state.bowl.openingTutorial ? 28_000 : (state.timerAccessibility ? 270_000 : 180_000));
}

export function submitBowlScrolls(state: RoomState, playerId: string, action: Extract<PlayerAction, { type: "SUBMIT_BOWL_SCROLLS" }>, now: number): DbEffect[] {
  const bowl = state.bowl;
  if (!bowl || state.phase !== "BOWL_SCROLL_WRITING") throw new Error("WRONG_PHASE");
  if (bowl.submissions[playerId]) throw new Error("ALREADY_SUBMITTED");
  if (action.payload.scrolls.length !== bowl.scrollsPerPlayer) throw new Error("BOWL_SCROLL_COUNT");
  const normalized = action.payload.scrolls.map((text) => text.trim().replace(/\s+/gu, " "));
  if (normalized.some((text) => text.split(/\s+/u).length < 1 || text.split(/\s+/u).length > 5)) throw new Error("BOWL_WORD_LIMIT");
  const all = [...bowl.scrolls.map((s) => s.text), ...normalized].map((text) => text.toLocaleLowerCase());
  if (new Set(all).size !== all.length) throw new Error("BOWL_DUPLICATE_SCROLL");
  bowl.submissions[playerId] = normalized;
  for (const text of normalized) bowl.scrolls.push({ id: makeId("scroll"), authorId: playerId, text });
  if (players(state).every((player) => bowl.submissions[player.id])) startRound(state, 1, now, "bells");
  return [];
}

function captureUndo(state: RoomState, scoreEventKey: string, scoringPlayerId: string) {
  const bowl = state.bowl!;
  const { undo: _discard, ...before } = bowl;
  void _discard;
  return { bowl: clone(before), phase: state.phase, status: state.status, phaseStartedAt: state.phaseStartedAt, deadlineAt: state.deadlineAt, roundIndex: state.roundIndex, currentRound: clone(state.currentRound), scoreEventKey, scoringPlayerId };
}

function finishBowl(state: RoomState, winner: "bells" | "motley", now: number): void {
  const bowl = state.bowl!; bowl.winnerTeam = winner; bowl.activeScrollId = null; bowl.clueGiverId = null; bowl.activeTeam = null; state.status = "COMPLETE";
  if (state.currentRound) state.currentRound.results = { kind: "bowl_final", winnerTeam: winner, scores: clone(bowl.scores), suddenDeathOccurred: bowl.suddenDeathOccurred };
  setPhase(state, "FINAL_RESULTS", now, 9_000);
}

function beginSuddenDeath(state: RoomState, now: number): void {
  const bowl = state.bowl!;
  bowl.suddenDeath = true; bowl.suddenDeathOccurred = true; bowl.roundNumber = 4;
  bowl.suddenDeathScrollId = deterministicShuffle(bowl.scrolls, `${state.id}:bowl:${state.matchNumber}:sudden`)[0]?.id ?? null;
  bowl.remainingIds = bowl.suddenDeathScrollId ? [bowl.suddenDeathScrollId] : [];
  state.roundIndex = 3; state.currentRound = makeRound(state, 4, now);
  startTurn(state, bowl.lastEmptyingTeam === "bells" ? "motley" : "bells", now, true);
}

export function applyBowlPlayerAction(state: RoomState, playerId: string, action: PlayerAction, now: number): DbEffect[] | null {
  if (action.type === "SUBMIT_BOWL_SCROLLS") return submitBowlScrolls(state, playerId, action, now);
  if (!["BOWL_CORRECT", "BOWL_PASS", "BOWL_ONE_WORD", "BOWL_DRAWING_STROKES"].includes(action.type)) return null;
  const bowl = state.bowl;
  if (!bowl || !["BOWL_TURN", "BOWL_SUDDEN_DEATH"].includes(state.phase) || bowl.clueGiverId !== playerId) throw new Error("BOWL_CLUE_GIVER_ONLY");
  if (action.type === "BOWL_ONE_WORD") {
    if (bowl.roundNumber !== 3 || bowl.clueWord) throw new Error("BOWL_ONE_WORD_UNAVAILABLE");
    if (!action.payload.word || /\s/u.test(action.payload.word)) throw new Error("BOWL_ONE_WORD_INVALID");
    bowl.clueWord = action.payload.word; return [];
  }
  if (action.type === "BOWL_DRAWING_STROKES") {
    if (bowl.roundNumber !== 2 || bowl.roundTwo !== "drawing") throw new Error("BOWL_DRAWING_UNAVAILABLE");
    if (action.payload.strokes.some((stroke) => stroke.width < .002 || stroke.width > .04 || stroke.points.length < 2 || stroke.points.length > 160 || stroke.points.some((point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1))) throw new Error("BOWL_DRAWING_INVALID");
    const totalPoints = [...bowl.drawing, ...action.payload.strokes].reduce((sum, stroke) => sum + stroke.points.length, 0);
    if (bowl.drawing.length + action.payload.strokes.length > 160 || totalPoints > 12_000) throw new Error("BOWL_DRAWING_LIMIT");
    bowl.drawing.push(...action.payload.strokes); return [];
  }
  if (action.type === "BOWL_PASS") {
    if (bowl.suddenDeath || bowl.passUsed) throw new Error("BOWL_PASS_UNAVAILABLE");
    if (bowl.remainingIds.length > 1) bowl.remainingIds.push(bowl.remainingIds.shift()!);
    bowl.activeScrollId = bowl.remainingIds[0] ?? null; bowl.passUsed = true; bowl.drawing = []; bowl.clueWord = null; return [];
  }
  if (!bowl.activeScrollId || !bowl.activeTeam) throw new Error("BOWL_SCROLL_REQUIRED");
  const scoreEventKey = `${state.currentRound?.id ?? "bowl"}:bowl-correct:${bowl.activeScrollId}:${state.actionCount + 1}`;
  bowl.undo = captureUndo(state, scoreEventKey, playerId);
  bowl.scores[bowl.activeTeam] += 1;
  const event: ScoreEventState = { id: makeId("score"), eventKey: scoreEventKey, roundId: state.currentRound?.id ?? "bowl", playerId, kind: "bowl_correct", points: 1, detail: { bowl: true, team: bowl.activeTeam, scrollId: bowl.activeScrollId } };
  state.scoreEvents.push(event);
  const effects: DbEffect[] = [{ type: "score", event }];
  if (bowl.suddenDeath) { finishBowl(state, bowl.activeTeam, now); return effects; }
  bowl.remainingIds.shift(); bowl.drawing = []; bowl.clueWord = null;
  if (bowl.remainingIds.length) { bowl.activeScrollId = bowl.remainingIds[0]; return effects; }
  bowl.lastEmptyingTeam = bowl.activeTeam; bowl.activeScrollId = null;
  if (bowl.roundNumber < 3) setPhase(state, "BOWL_INTERMISSION", now, 7_000);
  else if (bowl.scores.bells === bowl.scores.motley) beginSuddenDeath(state, now);
  else finishBowl(state, bowl.scores.bells > bowl.scores.motley ? "bells" : "motley", now);
  return effects;
}

export function applyBowlHostAction(state: RoomState, action: HostAction, now: number): DbEffect[] | null {
  void now;
  const bowl = state.bowl;
  if (!bowl) return null;
  if (action.type === "SET_BOWL_TEAM") {
    if (state.phase !== "LOBBY" || !players(state).some((p) => p.id === action.payload.playerId)) throw new Error("WRONG_PHASE");
    bowl.teams[action.payload.playerId] = action.payload.team; return [];
  }
  if (action.type === "UNDO_BOWL_CORRECT") {
    const undo = bowl.undo;
    if (!undo) throw new Error("BOWL_NOTHING_TO_UNDO");
    const restored = clone(undo.bowl) as BowlState; restored.undo = null; state.bowl = restored; state.phase = undo.phase; state.status = undo.status; state.phaseStartedAt = undo.phaseStartedAt; state.deadlineAt = undo.deadlineAt; state.roundIndex = undo.roundIndex; state.currentRound = clone(undo.currentRound);
    const event: ScoreEventState = { id: makeId("score"), eventKey: `${undo.scoreEventKey}:undo`, roundId: state.currentRound?.id ?? "bowl", playerId: undo.scoringPlayerId, kind: "bowl_undo", points: -1, detail: { bowl: true, undoOf: undo.scoreEventKey } };
    state.scoreEvents.push(event); return [{ type: "score", event }];
  }
  return null;
}

export function advanceBowlState(state: RoomState, now: number): boolean {
  const bowl = state.bowl;
  if (!bowl || !["BOWL_TUTORIAL", "BOWL_SCROLL_WRITING", "BOWL_TURN", "BOWL_INTERMISSION", "BOWL_SUDDEN_DEATH"].includes(state.phase)) return false;
  if (state.phase === "BOWL_TUTORIAL") { setPhase(state, "BOWL_SCROLL_WRITING", now, state.timerAccessibility ? 270_000 : 180_000); return true; }
  if (state.phase === "BOWL_SCROLL_WRITING") { fillFallbacks(state); startRound(state, 1, now, "bells"); return true; }
  if (state.phase === "BOWL_INTERMISSION") { startRound(state, (bowl.roundNumber + 1) as 2 | 3, now); return true; }
  const other = bowl.activeTeam === "bells" ? "motley" : "bells";
  startTurn(state, other, now, state.phase === "BOWL_SUDDEN_DEATH"); return true;
}

export function bowlRoundLabel(state: RoomState): string {
  const bowl = state.bowl;
  if (!bowl) return "";
  if (bowl.suddenDeath) return "Sudden Death";
  if (bowl.roundNumber === 1) return "Speak, Fool!";
  if (bowl.roundNumber === 2) return bowl.roundTwo === "drawing" ? "Draw, Fool!" : "Perform, Fool!";
  return "One Word, Fool!";
}
