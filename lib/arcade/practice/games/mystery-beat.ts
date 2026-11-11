import { MYSTERY_BEAT_CONFIG as C } from "./mystery-beat-config";
import { cappedScore, judgeAtOffset, laneFromInput, seededRandom, type RhythmLane, type RhythmNote } from "./rhythm-engine";
import type { ArcadeGameModule, ArcadeInput } from "./types";

export type MysteryPhase = "compose" | "preview" | "perform" | "results";
export interface MysteryPlayer { score: number; combo: number; bestCombo: number; lastSequence: number; resolvedNoteId: number; lastJudgment: string | null; contributions: number; }
export interface MysteryBeatState { seed: number; tick: number; phase: MysteryPhase; phaseTick: number; composerIndex: number; chart: RhythmNote[]; players: Record<string, MysteryPlayer>; finished: boolean; winnerId: string | null; draw: boolean; }
function completeComposer(s: MysteryBeatState): void {
  const owner = [...Object.keys(s.players).sort()][s.composerIndex]; if (!owner) { s.phase = "preview"; s.phaseTick = 0; return; }
  const p = s.players[owner]!; const random = seededRandom((s.seed ^ Math.imul(s.composerIndex + 1, 0x9e3779b1)) >>> 0);
  while (p.contributions < C.notesPerComposer && s.chart.length < C.maxNotes) {
    let lane = Math.floor(random() * 4) as RhythmLane;
    const prior = s.chart.at(-1)?.lane;
    if (prior === lane) lane = ((lane + 1) % 4) as RhythmLane;
    s.chart.push({ id: s.chart.length, tick: -1, lane }); p.contributions++;
  }
  s.composerIndex++;
  if (s.composerIndex >= Object.keys(s.players).length || s.chart.length >= C.maxNotes) { s.phase = "preview"; s.phaseTick = 0; }
  else s.phaseTick = 0;
}
export function createMysteryBeatState(playerIds: readonly string[], seed: number): MysteryBeatState {
  const ids = [...new Set(playerIds)].sort().slice(0, C.maxPlayers);
  return { seed: seed | 0, tick: 0, phase: "compose", phaseTick: 0, composerIndex: 0, chart: [],
    players: Object.fromEntries(ids.map((id) => [id, { score: 0, combo: 0, bestCombo: 0, lastSequence: -1, resolvedNoteId: -1, lastJudgment: null, contributions: 0 }])),
    finished: false, winnerId: null, draw: false };
}
function beginPerformance(s: MysteryBeatState): void { s.phase = "perform"; s.phaseTick = 0; s.chart.forEach((note, i) => { note.id = i; note.tick = C.firstPerformanceTick + i * C.intervalTicks; }); }
function scoreNote(s: MysteryBeatState, player: MysteryPlayer, lane: number, atTick: number): void {
  const note = s.chart.filter((x) => x.id > player.resolvedNoteId && Math.abs(x.tick - atTick) <= C.goodTicks).sort((a, b) => Math.abs(a.tick - atTick) - Math.abs(b.tick - atTick))[0];
  if (!note) { player.lastJudgment = "miss"; player.combo = 0; return; }
  player.resolvedNoteId = note.id; const result = lane === note.lane ? judgeAtOffset(atTick - note.tick, C.perfectTicks, C.goodTicks) : "miss";
  player.lastJudgment = result;
  if (result === "miss") { player.combo = 0; return; }
  player.combo++; player.bestCombo = Math.max(player.bestCombo, player.combo);
  player.score = cappedScore(player.score + (result === "perfect" ? C.perfectPoints : C.goodPoints) + (player.combo % C.comboBonusEvery === 0 ? C.comboBonus : 0), C.maxScore);
}
export function stepMysteryBeat(s: MysteryBeatState, inputs: Readonly<Record<string, ArcadeInput>>): MysteryBeatState {
  if (s.finished) return structuredClone(s);
  const n = structuredClone(s); const currentTick = n.tick;
  if (n.phase === "compose") {
    const owner = Object.keys(n.players).sort()[n.composerIndex]; const p = owner ? n.players[owner]! : null;
    const input = owner ? inputs[owner] : undefined;
    if (p && input && input.sequence > p.lastSequence && input.action && input.action !== "none") {
      p.lastSequence = input.sequence;
      if (p.contributions < C.notesPerComposer && n.chart.length < C.maxNotes) {
        let lane = laneFromInput(input.x, input.y); if (n.chart.at(-1)?.lane === lane) lane = ((lane + 1) % 4) as RhythmLane;
        n.chart.push({ id: n.chart.length, tick: -1, lane }); p.contributions++;
      }
      if (p.contributions >= C.notesPerComposer || n.chart.length >= C.maxNotes) completeComposer(n);
    }
    n.phaseTick++;
    if (n.phase === "compose" && n.phaseTick >= C.composeTicksPerPlayer) completeComposer(n);
  } else if (n.phase === "preview") {
    n.phaseTick++; if (n.phaseTick >= C.previewTicks) beginPerformance(n);
  } else if (n.phase === "perform") {
    for (const [id, p] of Object.entries(n.players)) {
      const input = inputs[id];
      if (input && input.sequence > p.lastSequence && input.action && input.action !== "none") { p.lastSequence = input.sequence; scoreNote(n, p, laneFromInput(input.x, input.y), n.phaseTick); }
      const overdue = n.chart.find((x) => x.id > p.resolvedNoteId && x.tick + C.goodTicks < n.phaseTick);
      if (overdue) { p.resolvedNoteId = overdue.id; p.lastJudgment = "miss"; p.combo = 0; }
    }
    n.phaseTick++;
    if (n.chart.length && n.phaseTick > n.chart.at(-1)!.tick + C.goodTicks) {
      n.phase = "results"; n.finished = true; const top = Math.max(...Object.values(n.players).map((p) => p.score));
      const leaders = Object.entries(n.players).filter(([, p]) => p.score === top); n.winnerId = leaders.length === 1 ? leaders[0]![0] : null; n.draw = n.winnerId === null;
    }
  }
  n.tick = currentTick + 1; return n;
}
export const mysteryBeatModule: ArcadeGameModule<MysteryBeatState> = { id: "mystery-beat", minPlayers: 2, maxPlayers: 10, createState: createMysteryBeatState, step: stepMysteryBeat,
  snapshot: (s) => ({ tick: s.tick, phase: s.phase, phaseTick: s.phaseTick, composerId: Object.keys(s.players).sort()[s.composerIndex] ?? null,
    chart: s.phase === "compose" ? s.chart.map(({ id, lane }) => ({ id, lane })) : s.chart, players: s.players, finished: s.finished, winnerId: s.winnerId, draw: s.draw }),
  result: (s) => s.finished ? { winnerId: s.winnerId, draw: s.draw, players: s.players, chart: s.chart } : null };
import { createPracticeAdapter, laneInput } from "./practice-adapter";

const mysteryBeatAdapter = createPracticeAdapter(mysteryBeatModule, {
  mapInput: laneInput,
  terminal: (state: MysteryBeatState) => state.finished,
});
const practiceMysteryBeatModule = {
  ...mysteryBeatAdapter,
  snapshot: (state: MysteryBeatState) => ({
    tick: state.tick,
    phase: state.phase === "results" ? "perform" : state.phase,
    phaseTick: state.phaseTick,
    composerId: Object.keys(state.players).sort()[state.composerIndex] ?? null,
    chart: state.phase === "compose" ? state.chart.map(({ id, lane }) => ({ id, lane })) : structuredClone(state.chart),
    players: structuredClone(state.players),
    finished: state.finished,
  }),
};
export default practiceMysteryBeatModule;
