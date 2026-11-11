import { SUMO_CONFIG as C } from "./sumo-config";
import type { ArcadeInput } from "./types";

export interface SumoPlayer {
  x: number; y: number; vx: number; vy: number; alive: boolean; lastInputSequence: number;
}
export interface SumoState {
  seed: number; tick: number; arenaRadius: number; collapseWarningTicks: number; nextCollapseTick: number;
  suddenDeath: boolean; players: Record<string, SumoPlayer>; finished: boolean; winnerId: string | null;
}

export function createSumoState(playerIds: readonly string[], seed: number): SumoState {
  const ids = [...new Set(playerIds)].sort();
  const players: Record<string, SumoPlayer> = {};
  const rotation = ((seed >>> 0) % 65_536) / 65_536 * Math.PI * 2;
  ids.forEach((id, index) => {
    const angle = rotation + (index / Math.max(1, ids.length)) * Math.PI * 2;
    const startRadius = C.initialArenaRadius * 0.58;
    players[id] = { x: Math.cos(angle) * startRadius, y: Math.sin(angle) * startRadius, vx: 0, vy: 0, alive: true, lastInputSequence: -1 };
  });
  return { seed: seed | 0, tick: 0, arenaRadius: C.initialArenaRadius, collapseWarningTicks: 0, nextCollapseTick: C.firstCollapseTick,
    suddenDeath: false, players, finished: false, winnerId: null };
}

function eliminateOutsideRing(state: SumoState): void {
  for (const player of Object.values(state.players)) {
    if (player.alive && Math.hypot(player.x, player.y) > state.arenaRadius - C.playerRadius * 0.12) player.alive = false;
  }
}

function stepCollapse(state: SumoState): void {
  if (state.collapseWarningTicks > 0) {
    state.collapseWarningTicks--;
    if (state.collapseWarningTicks === 0) {
      state.arenaRadius = Math.max(C.minimumArenaRadius, state.arenaRadius - C.collapseAmount);
      state.nextCollapseTick = state.tick + (state.arenaRadius <= C.fastCollapseRadius ? C.fastCollapseIntervalTicks : C.collapseIntervalTicks);
      eliminateOutsideRing(state);
    }
  } else if (state.arenaRadius > C.minimumArenaRadius && state.tick + 1 >= state.nextCollapseTick) {
    state.collapseWarningTicks = state.suddenDeath ? Math.min(C.collapseWarningTicks, C.suddenDeathCollapseTicks) : C.collapseWarningTicks;
  }
}

function resolveCollisions(state: SumoState): void {
  const players = Object.values(state.players).filter((player) => player.alive);
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i]!, b = players[j]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-6 || distance >= C.playerRadius * 2) continue;
    const nx = dx / distance, ny = dy / distance;
    const overlap = C.playerRadius * 2 - distance;
    a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
    b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
    const relativeNormalSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (relativeNormalSpeed < 0) {
      const impulse = Math.min(C.maxImpactSpeed, -(1 + C.collisionRestitution) * relativeNormalSpeed * C.playerMass * 0.5);
      a.vx -= nx * impulse / C.playerMass; a.vy -= ny * impulse / C.playerMass;
      b.vx += nx * impulse / C.playerMass; b.vy += ny * impulse / C.playerMass;
      for (const player of [a, b]) {
        const speed = Math.hypot(player.vx, player.vy);
        if (speed > C.maxImpactSpeed) { player.vx *= C.maxImpactSpeed / speed; player.vy *= C.maxImpactSpeed / speed; }
      }
    }
  }
}

export function stepSumo(state: SumoState, inputs: Readonly<Record<string, ArcadeInput>>): SumoState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state), dt = C.fixedStepSeconds;
  if (next.tick >= C.roundDurationSeconds / dt) next.suddenDeath = true;
  stepCollapse(next);
  for (const [id, player] of Object.entries(next.players)) {
    if (!player.alive) continue;
    const input = inputs[id];
    if (input && input.sequence > player.lastInputSequence) {
      player.lastInputSequence = input.sequence;
      const x = Math.max(-1, Math.min(1, Number.isFinite(input.x) ? input.x : 0));
      const y = Math.max(-1, Math.min(1, Number.isFinite(input.y) ? input.y : 0));
      const magnitude = Math.hypot(x, y);
      const nx = magnitude > 1 ? x / magnitude : x, ny = magnitude > 1 ? y / magnitude : y;
      player.vx += nx * C.acceleration * dt;
      player.vy += ny * C.acceleration * dt;
    }
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > C.maxSpeed) { player.vx *= C.maxSpeed / speed; player.vy *= C.maxSpeed / speed; }
    player.x += player.vx * dt; player.y += player.vy * dt;
    player.vx *= C.rollDamping; player.vy *= C.rollDamping;
  }
  eliminateOutsideRing(next);
  resolveCollisions(next);
  eliminateOutsideRing(next);
  next.tick++;
  const survivors = Object.entries(next.players).filter(([, player]) => player.alive);
  const solo = Object.keys(next.players).length === 1;
  if (survivors.length === 0 || (!solo && survivors.length === 1)) { next.finished = true; next.winnerId = survivors[0]?.[0] ?? null; }
  else if (solo && next.tick >= C.roundDurationSeconds / dt) { next.finished = true; next.winnerId = survivors[0]?.[0] ?? null; }
  return next;
}

import { practiceModule } from "./types";
import type { PracticeInput } from "../types";
export const practiceSumoModule = practiceModule("sumo", (id: string, seed: number) => createSumoState([id], seed),
  (state, input: PracticeInput) => { const id = Object.keys(state.players)[0]!; return stepSumo(state, { [id]: { sequence: input.sequence, x: input.x, y: input.y } }); },
  (state) => ({ seed: state.seed, tick: state.tick, arenaRadius: state.arenaRadius, collapseWarningTicks: state.collapseWarningTicks, nextCollapseTick: state.nextCollapseTick, suddenDeath: state.suddenDeath, players: structuredClone(state.players), finished: state.finished }),
  (state) => state.finished || Object.values(state.players).every((p) => !p.alive));
export default practiceSumoModule;
