import { TAILBLAZER_CONFIG as C } from "./tailblazer-config";
import type { ArcadeInput } from "./types";

export interface TailblazerSegment { x: number; y: number; tick: number }
export interface TailblazerTrail { playerId: string; segments: TailblazerSegment[] }
export interface TailblazerPlayer {
  x: number; y: number; heading: number; speed: number; alive: boolean; lastInputSequence: number;
  distanceSinceTrail: number; survivalTicks: number; eliminatedAtTick: number | null; score: number; trailIndex: number;
}
export interface TailblazerCellRef { trailIndex: number; segmentIndex: number }
export interface TailblazerState {
  seed: number; tick: number; roundIndex: number; roundTick: number; roundTransitionTicks: number;
  players: Record<string, TailblazerPlayer>; trails: TailblazerTrail[]; trailIndex: Record<string, TailblazerCellRef[]>;
  eliminationOrder: string[]; roundScores: Record<string, number[]>; finished: boolean; winnerId: string | null; winners: string[];
}

const clamp = (n: number, low: number, high: number): number => Math.max(low, Math.min(high, Number.isFinite(n) ? n : 0));
const cellKey = (x: number, y: number): string => `${Math.floor(x / C.trailCellSize)},${Math.floor(y / C.trailCellSize)}`;

function addTrailSegment(state: TailblazerState, trailIndex: number, segment: TailblazerSegment): void {
  const trail = state.trails[trailIndex]!;
  const segmentIndex = trail.segments.push(segment) - 1;
  const key = cellKey(segment.x, segment.y);
  (state.trailIndex[key] ??= []).push({ trailIndex, segmentIndex });
}

function makeRound(ids: readonly string[], seed: number, roundIndex: number, roundStartTick: number, prior?: Record<string, TailblazerPlayer>): { players: Record<string, TailblazerPlayer>; trails: TailblazerTrail[]; trailIndex: Record<string, TailblazerCellRef[]> } {
  const players: Record<string, TailblazerPlayer> = {};
  const trails = [...ids].sort().slice(0, C.maxPlayers).map((playerId) => ({ playerId, segments: [] as TailblazerSegment[] }));
  const trailIndex: Record<string, TailblazerCellRef[]> = {};
  const turnDirection = ((seed ^ roundIndex) & 1) === 0 ? 1 : -1;
  trails.forEach((trail, index) => {
    const angle = (index / Math.max(trails.length, 1)) * Math.PI * 2;
    const x = Math.cos(angle) * (C.arenaHalfSize * 0.68);
    const y = Math.sin(angle) * (C.arenaHalfSize * 0.68);
    const player: TailblazerPlayer = {
      x, y, heading: angle + turnDirection * Math.PI / 2, speed: C.moveSpeed, alive: true,
      lastInputSequence: -1, distanceSinceTrail: 0, survivalTicks: 0, eliminatedAtTick: null,
      score: prior?.[trail.playerId]?.score ?? 0, trailIndex: index,
    };
    players[trail.playerId] = player;
    addTrailSegment({ trails, trailIndex } as TailblazerState, index, { x, y, tick: roundStartTick });
  });
  return { players, trails, trailIndex };
}

export function createTailblazerState(playerIds: readonly string[], seed: number): TailblazerState {
  const ids = [...new Set(playerIds)].sort().slice(0, C.maxPlayers);
  const round = makeRound(ids, seed | 0, 0, 0);
  return {
    seed: seed | 0, tick: 0, roundIndex: 0, roundTick: 0, roundTransitionTicks: 0,
    ...round, eliminationOrder: [], roundScores: Object.fromEntries(ids.map((id) => [id, []])),
    finished: false, winnerId: null, winners: [],
  };
}

function touchesTrail(state: TailblazerState, playerId: string, x: number, y: number): boolean {
  const minCellX = Math.floor((x - C.collisionRadius) / C.trailCellSize);
  const maxCellX = Math.floor((x + C.collisionRadius) / C.trailCellSize);
  const minCellY = Math.floor((y - C.collisionRadius) / C.trailCellSize);
  const maxCellY = Math.floor((y + C.collisionRadius) / C.trailCellSize);
  const radiusSq = C.collisionRadius * C.collisionRadius;
  for (let cx = minCellX; cx <= maxCellX; cx++) for (let cy = minCellY; cy <= maxCellY; cy++) {
    const refs = state.trailIndex[`${cx},${cy}`];
    if (!refs) continue;
    for (const ref of refs) {
      const segment = state.trails[ref.trailIndex]?.segments[ref.segmentIndex];
      if (!segment) continue;
      const owner = state.trails[ref.trailIndex]!.playerId;
      if (owner === playerId && state.tick - segment.tick < C.selfCollisionGraceTicks) continue;
      const dx = x - segment.x, dy = y - segment.y;
      if (dx * dx + dy * dy <= radiusSq) return true;
    }
  }
  return false;
}

function placementPointsForTies(groupStart: number, groupSize: number): number {
  let sum = 0;
  for (let place = groupStart; place < groupStart + groupSize; place++) sum += C.placementPoints[place] ?? 0;
  return sum / groupSize;
}

function finishRound(state: TailblazerState): void {
  const remaining = Object.entries(state.players).filter(([, p]) => p.alive)
    .sort(([aId, a], [bId, b]) => b.survivalTicks - a.survivalTicks || aId.localeCompare(bId));
  const eliminated = [...state.eliminationOrder].reverse().filter((id) => !remaining.some(([aliveId]) => aliveId === id));
  const order = [...remaining.map(([id]) => id), ...eliminated];
  // Simultaneous survivors share the points for their occupied places.
  for (let start = 0; start < order.length;) {
    const first = state.players[order[start]!]!;
    let end = start + 1;
    while (end < order.length && state.players[order[end]!]!.survivalTicks === first.survivalTicks) end++;
    const points = placementPointsForTies(start, end - start);
    for (let i = start; i < end; i++) {
      const player = state.players[order[i]!]!;
      player.score += points;
      state.roundScores[order[i]!]!.push(points);
    }
    start = end;
  }
  state.roundIndex++;
  if (state.roundIndex >= C.rounds) {
    const highScore = Math.max(...Object.values(state.players).map((player) => player.score));
    state.winners = Object.entries(state.players).filter(([, player]) => player.score === highScore).map(([id]) => id).sort();
    state.winnerId = state.winners.length === 1 ? state.winners[0]! : null;
    state.finished = true;
  } else state.roundTransitionTicks = C.roundTransitionTicks;
}

function beginNextRound(state: TailblazerState): void {
  const round = makeRound(Object.keys(state.players), state.seed, state.roundIndex, state.tick, state.players);
  state.players = round.players;
  state.trails = round.trails;
  state.trailIndex = round.trailIndex;
  state.eliminationOrder = [];
  state.roundTick = 0;
}

export function stepTailblazer(state: TailblazerState, inputs: Readonly<Record<string, ArcadeInput>>): TailblazerState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state);
  next.tick++;
  if (next.roundTransitionTicks > 0) {
    next.roundTransitionTicks--;
    if (next.roundTransitionTicks === 0) beginNextRound(next);
    return next;
  }
  next.roundTick++;
  const dt = C.fixedStepSeconds;
  const moves: Array<{ id: string; fromX: number; fromY: number; toX: number; toY: number }> = [];
  // Turn and movement are calculated before emitting any new trail points, so
  // players cannot gain an update-order advantage by colliding with a fresh trail.
  for (const [id, player] of Object.entries(next.players)) {
    if (!player.alive) continue;
    const input = inputs[id];
    if (input && Number.isSafeInteger(input.sequence) && input.sequence > player.lastInputSequence) {
      player.lastInputSequence = input.sequence;
      const steer = clamp(input.x, -1, 1);
      player.heading = (player.heading + steer * C.turnRateRadiansPerSecond * dt + Math.PI * 2) % (Math.PI * 2);
    }
    const fromX = player.x, fromY = player.y;
    const toX = fromX + Math.cos(player.heading) * player.speed * dt;
    const toY = fromY + Math.sin(player.heading) * player.speed * dt;
    moves.push({ id, fromX, fromY, toX, toY });
  }
  for (const move of moves) {
    const player = next.players[move.id]!;
    if (!player.alive) continue;
    const wallHit = Math.abs(move.toX) >= C.arenaHalfSize || Math.abs(move.toY) >= C.arenaHalfSize;
    const trailHit = touchesTrail(next, move.id, move.toX, move.toY);
    player.x = move.toX;
    player.y = move.toY;
    if (wallHit || trailHit) {
      player.alive = false;
      player.eliminatedAtTick = next.tick;
      next.eliminationOrder.push(move.id);
    } else player.survivalTicks++;
  }
  for (const move of moves) {
    const player = next.players[move.id]!;
    if (!player.alive) continue;
    const dx = move.toX - move.fromX, dy = move.toY - move.fromY;
    const distance = Math.hypot(dx, dy);
    let remaining = distance;
    let travelled = 0;
    while (player.distanceSinceTrail + remaining >= C.trailSpacing) {
      const along = C.trailSpacing - player.distanceSinceTrail;
      travelled += along;
      const ratio = Math.min(1, travelled / Math.max(distance, 1e-9));
      addTrailSegment(next, player.trailIndex, {
        x: move.fromX + dx * ratio, y: move.fromY + dy * ratio, tick: next.tick,
      });
      remaining -= along;
      player.distanceSinceTrail = 0;
    }
    player.distanceSinceTrail += remaining;
  }
  const survivors = Object.values(next.players).filter((player) => player.alive).length;
  const solo = Object.keys(next.players).length === 1;
  if (solo && survivors === 0) { next.finished = true; next.winnerId = null; next.winners = []; }
  else if ((!solo && survivors <= 1) || next.roundTick >= C.roundDurationTicks) finishRound(next);
  return next;
}

import { practiceModule } from "./types";
import type { PracticeInput } from "../types";
export const practiceTailblazerModule = practiceModule("tailblazer", (id: string, seed: number) => createTailblazerState([id], seed),
  (state, input: PracticeInput) => { const id = Object.keys(state.players)[0]!; return stepTailblazer(state, { [id]: { sequence: input.sequence, x: input.x || (input.buttons.right ? 1 : input.buttons.left ? -1 : 0), y: 0 } }); },
  (state) => ({ tick: state.tick, roundIndex: state.roundIndex, roundTick: state.roundTick, roundTransitionTicks: state.roundTransitionTicks, players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, { x: p.x, y: p.y, heading: p.heading, alive: p.alive }])), trails: state.trails.map((t) => ({ playerId: t.playerId, segments: t.segments.map(({ x, y }) => [Math.round(x * 100), Math.round(y * 100)] as const) })), finished: state.finished }),
  (state) => state.finished || Object.values(state.players).every((p) => !p.alive));
export default practiceTailblazerModule;
