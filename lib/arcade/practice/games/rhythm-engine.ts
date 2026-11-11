/** Small deterministic, server-clock rhythm primitives shared by the three modes. */
export type RhythmLane = 0 | 1 | 2 | 3;
export interface RhythmNote { id: number; tick: number; lane: RhythmLane }
export type Judgment = "perfect" | "good" | "miss";

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function laneFromInput(x: number, y: number): RhythmLane {
  // Phone adapter can put a discrete pad into the horizontal quarter; y is a
  // fallback for controllers that report a 2x2 pad as normalized coordinates.
  const normalized = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
  if (Math.abs(y) > 0.65 && Math.abs(normalized) < 0.4) return y < 0 ? 0 : 2;
  return Math.min(3, Math.max(0, Math.floor((normalized + 1) * 2))) as RhythmLane;
}

export function judgeAtOffset(offsetTicks: number, perfectTicks: number, goodTicks: number): Judgment {
  const delta = Math.abs(offsetTicks);
  return delta <= perfectTicks ? "perfect" : delta <= goodTicks ? "good" : "miss";
}

export function makeChart(seed: number, count: number, firstTick: number, intervalTicks: number, lanes = 4): RhythmNote[] {
  const random = seededRandom(seed);
  const boundedLanes = Math.max(1, Math.min(4, Math.floor(lanes)));
  let previous = -1;
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, id) => {
    let lane = Math.floor(random() * boundedLanes) as RhythmLane;
    if (boundedLanes > 1 && lane === previous) lane = ((lane + 1 + Math.floor(random() * (boundedLanes - 1))) % boundedLanes) as RhythmLane;
    previous = lane;
    return { id, tick: firstTick + id * intervalTicks, lane };
  });
}

export function cappedScore(score: number, max = 9999): number {
  return Math.max(0, Math.min(max, Math.floor(Number.isFinite(score) ? score : 0)));
}
