import { SCRATCH_MATCH_CONFIG as C } from "./scratch-match-config";
import { cappedScore, judgeAtOffset, laneFromInput, makeChart, type RhythmNote } from "./rhythm-engine";
import type { ArcadeGameModule, ArcadeInput } from "./types";

export interface ScratchPlayer { lives: number; score: number; alive: boolean; lastSequence: number; lastLane: number | null; lastJudgment: string | null; combo: number; resolvedNoteId: number; }
export interface ScratchMatchState { seed: number; tick: number; notes: RhythmNote[]; players: Record<string, ScratchPlayer>; finished: boolean; winnerId: string | null; draw: boolean; }
export function createScratchMatchState(playerIds: readonly string[], seed: number): ScratchMatchState {
  const ids = [...new Set(playerIds)].sort().slice(0, C.maxPlayers);
  const interval = Math.round((60 / C.bpm) * C.fixedStepHz);
  return { seed: seed | 0, tick: 0, notes: makeChart(seed, C.notesPerPlayer, C.leadInTicks, interval),
    players: Object.fromEntries(ids.map((id) => [id, { lives: C.lives, score: 0, alive: true, lastSequence: -1, lastLane: null, lastJudgment: null, combo: 0, resolvedNoteId: -1 }])),
    finished: false, winnerId: null, draw: false };
}
function settle(state: ScratchMatchState): void {
  const alive = Object.entries(state.players).filter(([, p]) => p.alive);
  const solo = Object.keys(state.players).length === 1;
  if (alive.length === 0 || (!solo && alive.length === 1) || state.tick > state.notes.at(-1)!.tick + C.goodTicks || state.tick >= C.maxRoundTicks) {
    state.finished = true;
    const best = Math.max(-1, ...Object.values(state.players).map((p) => p.alive ? p.score : -1));
    const leaders = Object.entries(state.players).filter(([, p]) => p.alive && p.score === best);
    state.winnerId = leaders.length === 1 ? leaders[0]![0] : null;
    state.draw = state.winnerId === null;
  }
}
export function stepScratchMatch(state: ScratchMatchState, inputs: Readonly<Record<string, ArcadeInput>>): ScratchMatchState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state); const tick = next.tick;
  for (const [id, p] of Object.entries(next.players)) {
    if (!p.alive) continue;
    const input = inputs[id];
    if (input && Number.isSafeInteger(input.sequence) && input.sequence > p.lastSequence && input.action && input.action !== "none") {
      p.lastSequence = input.sequence; p.lastLane = laneFromInput(input.x, input.y);
      const due = next.notes.filter((n) => Math.abs(n.tick - tick) <= C.goodTicks && n.id > p.resolvedNoteId);
      const note = due.sort((a, b) => Math.abs(a.tick - tick) - Math.abs(b.tick - tick))[0];
      if (note) {
        p.resolvedNoteId = note.id;
        const judgment = judgeAtOffset(tick - note.tick, C.perfectTicks, C.goodTicks);
        p.lastJudgment = p.lastLane === note.lane ? judgment : "miss";
        if (p.lastJudgment === "perfect") { p.score = cappedScore(p.score + C.perfectPoints, C.maxScore); p.combo++; }
        else if (p.lastJudgment === "good") { p.score = cappedScore(p.score + C.goodPoints, C.maxScore); p.combo++; }
        else { p.lives = Math.max(0, p.lives - 1); p.combo = 0; if (!p.lives) p.alive = false; }
      } else { p.lastJudgment = "miss"; p.combo = 0; }
    }
    const unjudged = next.notes.find((n) => n.tick + C.goodTicks < tick && n.id > p.resolvedNoteId);
    if (unjudged) { p.resolvedNoteId = unjudged.id; p.lives = Math.max(0, p.lives - 1); p.combo = 0; if (!p.lives) p.alive = false; p.lastJudgment = "miss"; }
  }
  next.tick++; settle(next); return next;
}
export const scratchMatchModule: ArcadeGameModule<ScratchMatchState> = { id: "scratch-match", minPlayers: 2, maxPlayers: 8, createState: createScratchMatchState, step: stepScratchMatch,
  snapshot: (s) => ({ tick: s.tick, bpm: C.bpm, players: s.players, upcoming: s.notes.filter((n) => n.tick >= s.tick - C.goodTicks).slice(0, 8), finished: s.finished, winnerId: s.winnerId, draw: s.draw }),
  result: (s) => s.finished ? { winnerId: s.winnerId, draw: s.draw, players: s.players } : null };
import { createPracticeAdapter, laneInput } from "./practice-adapter";

const practiceScratchMatchModule = createPracticeAdapter(scratchMatchModule, { mapInput: laneInput,
  terminal: (state: ScratchMatchState) => state.finished || Object.values(state.players).every((player) => !player.alive) });
export default practiceScratchMatchModule;
