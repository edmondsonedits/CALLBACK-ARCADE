import { TWISTED_SYSTEM_CONFIG as C } from "./twisted-system-config";
import type { ArcadeInput } from "./types";

export type TwistedAction = "jump" | "duck";
export interface TwistedObstacle { id: number; requiredAction: TwistedAction; cueTick: number; hitTick: number }
export interface TwistedPlayer {
  laneIndex: number;
  progressTicks: number;
  alive: boolean;
  lives: number;
  eliminatedAtTick: number | null;
  lastInputSequence: number;
  lastAction: TwistedAction | null;
  lastActionTick: number;
}
export interface TwistedSystemState {
  seed: number;
  tick: number;
  course: TwistedObstacle[];
  players: Record<string, TwistedPlayer>;
  courseSpeedTier: number;
  courseSpeed: number;
  finished: boolean;
  winnerId: string | null;
  draw: boolean;
}

// Curated action motifs avoid random runs of identical reactions. The seed only
// selects a rotation/motif order; every player in a room faces the same course.
const MOTIFS: readonly (readonly TwistedAction[])[] = [
  ["jump", "duck", "jump", "duck", "duck", "jump", "duck", "jump"],
  ["duck", "jump", "duck", "jump", "jump", "duck", "jump", "duck"],
  ["jump", "duck", "duck", "jump", "duck", "jump", "jump", "duck"],
  ["duck", "jump", "jump", "duck", "jump", "duck", "duck", "jump"],
];

function hashSeed(seed: number): number {
  let value = seed | 0;
  value ^= value >>> 16; value = Math.imul(value, 0x7feb352d); value ^= value >>> 15;
  return value >>> 0;
}

function createCourse(seed: number): TwistedObstacle[] {
  const variant = hashSeed(seed) % MOTIFS.length;
  const course: TwistedObstacle[] = [];
  let hitTick = C.firstImpactTick;
  for (let id = 0; id < C.courseObstacleCount; id++) {
    const motif = MOTIFS[(variant + Math.floor(id / 8)) % MOTIFS.length]!;
    let requiredAction = motif[id % motif.length]!;
    if (course.length > 0 && requiredAction === course[course.length - 1]!.requiredAction) {
      requiredAction = requiredAction === "jump" ? "duck" : "jump";
    }
    const interval = Math.max(C.minimumObstacleIntervalTicks, C.initialObstacleIntervalTicks - id * C.intervalReductionPerObstacle);
    const cueLead = Math.max(C.minimumCueTicks, Math.min(C.initialCueLeadTicks, Math.floor(interval * 0.45)));
    course.push({ id, requiredAction, cueTick: hitTick - cueLead, hitTick });
    hitTick += interval;
  }
  return course;
}

function speedAt(tick: number, course: readonly TwistedObstacle[]): { tier: number; speed: number } {
  let index = 0;
  while (index < course.length && course[index]!.hitTick <= tick) index++;
  const interval = index === 0
    ? C.initialObstacleIntervalTicks
    : Math.max(C.minimumObstacleIntervalTicks, C.initialObstacleIntervalTicks - (index - 1) * C.intervalReductionPerObstacle);
  return { tier: Math.min(Math.floor(index / C.tierSize), Math.ceil(course.length / C.tierSize) - 1), speed: C.initialObstacleIntervalTicks / interval };
}

export function createTwistedSystemState(playerIds: readonly string[], seed: number): TwistedSystemState {
  const ids = [...new Set(playerIds)].sort().slice(0, C.maxPlayers);
  const players: Record<string, TwistedPlayer> = {};
  ids.forEach((id, laneIndex) => {
    players[id] = {
      laneIndex, progressTicks: 0, alive: true, lives: C.livesPerPlayer, eliminatedAtTick: null,
      lastInputSequence: -1, lastAction: null, lastActionTick: -C.hitWindowTicks * 2,
    };
  });
  const course = createCourse(seed);
  const speed = speedAt(0, course);
  return { seed: seed | 0, tick: 0, course, players, courseSpeedTier: speed.tier, courseSpeed: speed.speed,
    finished: false, winnerId: null, draw: false };
}

function decideFinish(state: TwistedSystemState): void {
  const alive = Object.entries(state.players).filter(([, player]) => player.alive);
  const courseFinished = state.course.every((hazard) => hazard.hitTick < state.tick);
  const solo = Object.keys(state.players).length === 1;
  if (alive.length === 0 || (!solo && alive.length === 1) || courseFinished) {
    state.finished = true;
    if (alive.length === 1) state.winnerId = alive[0]![0];
    else if (alive.length > 1) {
      const topProgress = Math.max(...alive.map(([, player]) => player.progressTicks));
      const leaders = alive.filter(([, player]) => player.progressTicks === topProgress);
      state.winnerId = leaders.length === 1 ? leaders[0]![0] : null;
    } else state.winnerId = null;
    state.draw = state.winnerId === null;
  }
}

export function stepTwistedSystem(state: TwistedSystemState, inputs: Readonly<Record<string, ArcadeInput>>): TwistedSystemState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state);
  const currentTick = next.tick;

  for (const [id, player] of Object.entries(next.players)) {
    if (!player.alive) continue;
    const input = inputs[id];
    if (input && Number.isSafeInteger(input.sequence) && input.sequence > player.lastInputSequence) {
      player.lastInputSequence = input.sequence;
      if (input.action === "jump" || input.action === "duck") {
        player.lastAction = input.action;
        player.lastActionTick = currentTick;
      }
    }
    player.progressTicks = currentTick + 1;
  }

  for (const hazard of next.course) {
    if (hazard.hitTick !== currentTick) continue;
    for (const player of Object.values(next.players)) {
      if (!player.alive) continue;
      const timely = Math.abs(player.lastActionTick - hazard.hitTick) <= C.hitWindowTicks;
      if (!timely || player.lastAction !== hazard.requiredAction) {
        player.lives = Math.max(0, player.lives - 1);
        if (player.lives === 0) {
          player.alive = false;
          player.eliminatedAtTick = hazard.hitTick;
        }
      }
      // One press can only answer one rod, even when two cues are close together.
      player.lastAction = null;
      player.lastActionTick = -C.hitWindowTicks * 2;
    }
  }

  next.tick++;
  const speed = speedAt(next.tick, next.course);
  next.courseSpeedTier = speed.tier;
  next.courseSpeed = speed.speed;
  decideFinish(next);
  return next;
}

import { practiceModule } from "./types";
import type { PracticeInput } from "../types";
export const practiceTwistedSystemModule = practiceModule("twisted-system", (id: string, seed: number) => createTwistedSystemState([id], seed),
  (state, input: PracticeInput) => { const id = Object.keys(state.players)[0]!; return stepTwistedSystem(state, { [id]: { sequence: input.sequence, x: 0, y: 0, action: input.pressed?.includes("jump") ? "jump" : input.pressed?.includes("duck") ? "duck" : "none" } }); },
  (state) => ({ tick: state.tick, players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, { laneIndex: p.laneIndex, progressTicks: p.progressTicks, alive: p.alive, lives: p.lives, eliminatedAtTick: p.eliminatedAtTick }])), cueSequence: state.course.filter((h) => h.hitTick >= state.tick).slice(0, C.previewCueCount).map((h) => ({ id: h.id, requiredAction: h.cueTick <= state.tick ? h.requiredAction : null, cueTick: h.cueTick, hitTick: h.hitTick })), courseSpeedTier: state.courseSpeedTier, courseSpeed: state.courseSpeed, finished: state.finished }),
  (state) => state.finished || Object.values(state.players).every((p) => !p.alive));
export default practiceTwistedSystemModule;
