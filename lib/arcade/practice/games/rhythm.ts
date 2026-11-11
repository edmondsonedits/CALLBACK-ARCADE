import { RHYTHM_CONFIG as C } from "./rhythm-config";
import { cappedScore, judgeAtOffset, laneFromInput, makeChart, type RhythmNote } from "./rhythm-engine";
import type { ArcadeGameModule, ArcadeInput } from "./types";

export interface RhythmPlayer { score: number; combo: number; bestCombo: number; lastSequence: number; resolvedNoteId: number; lastJudgment: string | null; lastLane: number | null; }
export interface RhythmState { seed: number; tick: number; notes: RhythmNote[]; players: Record<string, RhythmPlayer>; finished: boolean; winnerId: string | null; draw: boolean; }
export function createRhythmState(playerIds: readonly string[], seed: number): RhythmState {
  const ids = [...new Set(playerIds)].sort().slice(0, C.maxPlayers);
  const randomNotes = makeChart(seed, C.notesPerPlayer, 0, 1);
  const notes: RhythmNote[] = []; let tick = C.leadInTicks;
  for (let i = 0; i < C.notesPerPlayer; i++) {
    const bpm = Math.min(C.maxBpm, C.startBpm + Math.floor(i / C.bpmIncreaseEveryNotes) * C.bpmStep);
    const interval = Math.max(C.minimumIntervalTicks, Math.round(C.initialIntervalTicks * C.startBpm / bpm));
    if (i) tick += interval;
    notes.push({ id: i, tick, lane: randomNotes[i]!.lane });
  }
  return { seed: seed | 0, tick: 0, notes, players: Object.fromEntries(ids.map((id) => [id, { score: 0, combo: 0, bestCombo: 0, lastSequence: -1, resolvedNoteId: -1, lastJudgment: null, lastLane: null }])),
    finished: false, winnerId: null, draw: false };
}
function finishIfDue(s: RhythmState): void {
  if (s.tick <= s.notes.at(-1)!.tick + C.goodTicks) return;
  s.finished = true; const top = Math.max(...Object.values(s.players).map((p) => p.score));
  const leaders = Object.entries(s.players).filter(([, p]) => p.score === top); s.winnerId = leaders.length === 1 ? leaders[0]![0] : null; s.draw = s.winnerId === null;
}
export function stepRhythm(s: RhythmState, inputs: Readonly<Record<string, ArcadeInput>>): RhythmState {
  if (s.finished) return structuredClone(s);
  const n = structuredClone(s); const tick = n.tick;
  for (const [id, p] of Object.entries(n.players)) {
    const input = inputs[id];
    if (input && Number.isSafeInteger(input.sequence) && input.sequence > p.lastSequence && input.action && input.action !== "none") {
      p.lastSequence = input.sequence; p.lastLane = laneFromInput(input.x, input.y);
      const note = n.notes.filter((x) => x.id > p.resolvedNoteId && Math.abs(x.tick - tick) <= C.goodTicks).sort((a, b) => Math.abs(a.tick - tick) - Math.abs(b.tick - tick))[0];
      if (note) {
        p.resolvedNoteId = note.id; const judgment = p.lastLane === note.lane ? judgeAtOffset(tick - note.tick, C.perfectTicks, C.goodTicks) : "miss";
        p.lastJudgment = judgment;
        if (judgment === "perfect" || judgment === "good") {
          p.combo++; p.bestCombo = Math.max(p.bestCombo, p.combo);
          const base = judgment === "perfect" ? C.perfectPoints : C.goodPoints;
          // Small, capped cadence bonus preserves comeback room after an early miss.
          const bonus = p.combo % C.comboBonusEvery === 0 ? C.comboBonus : 0;
          p.score = cappedScore(p.score + base + bonus, C.maxScore);
        } else { p.combo = 0; }
      } else { p.lastJudgment = "miss"; p.combo = 0; }
    }
    const overdue = n.notes.find((x) => x.id > p.resolvedNoteId && x.tick + C.goodTicks < tick);
    if (overdue) { p.resolvedNoteId = overdue.id; p.lastJudgment = "miss"; p.combo = 0; }
  }
  n.tick++; finishIfDue(n); return n;
}
const bpmAt = (index: number) => Math.min(C.maxBpm, C.startBpm + Math.floor(Math.max(0, index) / C.bpmIncreaseEveryNotes) * C.bpmStep);
export const rhythmModule: ArcadeGameModule<RhythmState> = { id: "rhythm", minPlayers: 2, maxPlayers: 10, createState: createRhythmState, step: stepRhythm,
  snapshot: (s) => ({ tick: s.tick, players: s.players, bpm: bpmAt(s.notes.findIndex((x) => x.tick >= s.tick)), upcoming: s.notes.filter((x) => x.tick >= s.tick - C.goodTicks).slice(0, 8), finished: s.finished, winnerId: s.winnerId, draw: s.draw }),
  result: (s) => s.finished ? { winnerId: s.winnerId, draw: s.draw, players: s.players } : null };
import { createPracticeAdapter, laneInput } from "./practice-adapter";

const practiceRhythmModule = createPracticeAdapter(rhythmModule, { mapInput: laneInput,
  terminal: (state: RhythmState) => state.finished });
export default practiceRhythmModule;
