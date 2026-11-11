import { createDestructibleFloor, markFloorTile, stepDestructibleFloor, tileIndexAt, type DestructibleFloor } from "./destructible-floor";
import { RUBBLE_ALLIANCE_CONFIG as C } from "./rubble-alliance-config";
import type { ArcadeInput } from "./types";

/** `destroyed` is the shared floor helper's internal terminal state; snapshots leave it as `falling` or `gone`. */
export type RubbleTileState = "safe" | "damaged" | "cracking" | "destroyed" | "falling" | "gone";
export interface RubbleTile { state: RubbleTileState; ticksRemaining: number }
export type RubbleFloor = Omit<DestructibleFloor, "tiles"> & { tiles: RubbleTile[] };
export interface RubblePlayer {
  x: number; y: number; vx: number; vy: number; alive: boolean; lastInputSequence: number;
  boostTicks: number; boostCooldownTicks: number; survivalTicks: number; score: number;
}
export interface RubbleAllianceState {
  tuning?: {rounds?:number;durationTicks?:number};
  seed: number; tick: number; roundIndex: number; roundTick: number; roundTransitionTicks: number; floor: RubbleFloor;
  players: Record<string, RubblePlayer>; eliminationOrder: string[]; roundScores: Record<string, number[]>;
  finished: boolean; winnerId: string | null; winners: string[];
}

function makeFloor(): RubbleFloor {
  return createDestructibleFloor(C.floorSize, C.floorHalfExtent, C.warningTicks) as unknown as RubbleFloor;
}

function makePlayers(ids: readonly string[], prior?: Record<string, RubblePlayer>): Record<string, RubblePlayer> {
  const players: Record<string, RubblePlayer> = {};
  const positions: ReadonlyArray<readonly [number, number]> = [[-4.6, -4.6], [4.6, -4.6], [4.6, 4.6], [-4.6, 4.6]];
  [...ids].sort().forEach((id, index) => {
    const [x, y] = ids.length > 4 ? [Math.cos(index * Math.PI * 2 / ids.length) * 6, Math.sin(index * Math.PI * 2 / ids.length) * 6] : positions[index % positions.length]!;
    players[id] = { x, y, vx: 0, vy: 0, alive: true, lastInputSequence: -1, boostTicks: 0, boostCooldownTicks: 0, survivalTicks: 0, score: prior?.[id]?.score ?? 0 };
  });
  return players;
}

export function createRubbleAllianceState(playerIds: readonly string[], seed: number, tuning?:RubbleAllianceState['tuning']): RubbleAllianceState {
  const ids = [...new Set(playerIds)].sort();
  const players = makePlayers(ids);
  return { seed: seed | 0, tick: 0, roundIndex: 0, roundTick: 0, roundTransitionTicks: 0, floor: makeFloor(), players, eliminationOrder: [], roundScores: Object.fromEntries(ids.map((id) => [id, []])),
    finished: false, winnerId: null, winners: [], ...(tuning?{tuning}:{}) };
}

function rankPlayers(state: RubbleAllianceState): string[] {
  const alive = Object.entries(state.players).filter(([, p]) => p.alive)
    .sort(([aId, a], [bId, b]) => b.survivalTicks - a.survivalTicks || aId.localeCompare(bId)).map(([id]) => id);
  return [...alive, ...[...state.eliminationOrder].reverse().filter((id) => !alive.includes(id))];
}

function finishRound(state: RubbleAllianceState): void {
  const soloLost = Object.keys(state.players).length === 1 && !Object.values(state.players).some((player) => player.alive);
  if (soloLost) { state.roundIndex++; state.finished = true; state.winnerId = null; state.winners = []; return; }
  const order = rankPlayers(state);
  for (const [place, id] of order.entries()) {
    const tiedPlace = order.findIndex(candidate => state.players[candidate]!.survivalTicks === state.players[id]!.survivalTicks);
    const points = order.length > 4 ? Math.max(0, order.length - tiedPlace - 1) : C.placementPoints[place] ?? 0;
    state.players[id]!.score += points;
    state.roundScores[id]!.push(points);
  }
  state.roundIndex++;
  if (state.roundIndex >= (state.tuning?.rounds ?? C.rounds)) {
    const highScore = Math.max(...Object.values(state.players).map((player) => player.score));
    state.winners = Object.entries(state.players).filter(([, player]) => player.score === highScore).map(([id]) => id).sort();
    state.winnerId = state.winners.length === 1 ? state.winners[0]! : null;
    state.finished = true;
    return;
  }
  state.roundTransitionTicks = C.roundTransitionTicks;
}

function beginNextRound(state: RubbleAllianceState): void {
  state.players = makePlayers(Object.keys(state.players), state.players);
  state.floor = makeFloor();
  state.roundTick = 0;
  state.eliminationOrder = [];
}

function stepFloor(state: RubbleAllianceState): void {
  const terminalStates = state.floor.tiles.map((tile) => tile.state === "falling" || tile.state === "gone" ? tile.state : null);
  for (let index = 0; index < terminalStates.length; index++) if (terminalStates[index]) state.floor.tiles[index]!.state = "destroyed";
  stepDestructibleFloor(state.floor as unknown as DestructibleFloor);
  for (const [index, tile] of state.floor.tiles.entries()) {
    const terminal = terminalStates[index];
    if (terminal) {
      tile.state = terminal;
      if (terminal === "falling") {
        tile.ticksRemaining = Math.max(0, tile.ticksRemaining - 1);
        if (tile.ticksRemaining === 0) tile.state = "gone";
      }
      continue;
    }
    if (tile.state === "destroyed") {
      tile.state = "falling";
      tile.ticksRemaining = C.fallingTicks;
    } else if (tile.state === "falling") {
      tile.ticksRemaining = Math.max(0, tile.ticksRemaining - 1);
      if (tile.ticksRemaining === 0) tile.state = "gone";
    }
  }
}

function eliminatePlayersOnGaps(state: RubbleAllianceState): boolean {
  for (const [id, player] of Object.entries(state.players)) {
    if (!player.alive) continue;
    const tile = tileIndexAt(state.floor as unknown as DestructibleFloor, player.x, player.y);
    if (tile !== null && state.floor.tiles[tile]?.state === "gone") {
      player.alive = false;
      state.eliminationOrder.push(id);
    }
  }
  const remaining = Object.values(state.players).filter((player) => player.alive).length;
  return remaining === 0 || (Object.keys(state.players).length > 1 && remaining === 1);
}

export function stepRubbleAlliance(state: RubbleAllianceState, inputs: Readonly<Record<string, ArcadeInput>>): RubbleAllianceState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state), dt = C.fixedStepSeconds;
  next.tick++;
  if (next.roundTransitionTicks > 0) {
    next.roundTransitionTicks--;
    if (next.roundTransitionTicks === 0) beginNextRound(next);
    return next;
  }
  next.roundTick++;
  stepFloor(next);
  for (const [id, player] of Object.entries(next.players)) {
    if (!player.alive) continue;
    player.boostCooldownTicks = Math.max(0, player.boostCooldownTicks - 1);
    const input = inputs[id];
    if (input && input.sequence > player.lastInputSequence) {
      player.lastInputSequence = input.sequence;
      if (input.action === "special" && player.boostCooldownTicks === 0) {
        player.boostTicks = C.boostTicks;
        player.boostCooldownTicks = C.boostCooldownTicks;
        player.vx *= C.boostMultiplier;
        player.vy *= C.boostMultiplier;
      }
      const x = Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0;
      const y = Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0;
      const magnitude = Math.hypot(x, y), scale = magnitude > 1 ? 1 / magnitude : 1;
      const acceleration = C.acceleration * (player.boostTicks > 0 ? C.boostMultiplier : 1);
      player.vx += x * scale * acceleration * dt;
      player.vy += y * scale * acceleration * dt;
    }
    const speed = Math.hypot(player.vx, player.vy), maxSpeed = C.maxSpeed * (player.boostTicks > 0 ? C.boostMultiplier : 1);
    if (speed > maxSpeed) { player.vx *= maxSpeed / speed; player.vy *= maxSpeed / speed; }
    player.x = Math.max(-C.floorHalfExtent + C.playerRadius, Math.min(C.floorHalfExtent - C.playerRadius, player.x + player.vx * dt));
    player.y = Math.max(-C.floorHalfExtent + C.playerRadius, Math.min(C.floorHalfExtent - C.playerRadius, player.y + player.vy * dt));
    player.vx *= C.drag;
    player.vy *= C.drag;
    if (player.boostTicks > 0) player.boostTicks--;
    player.survivalTicks++;
    markFloorTile(next.floor as unknown as DestructibleFloor, player.x, player.y);
  }
  const roundOver = eliminatePlayersOnGaps(next) || next.roundTick >= (next.tuning?.durationTicks ?? C.roundDurationSeconds / dt);
  if (roundOver) finishRound(next);
  return next;
}

import { practiceModule } from "./types";
import type { PracticeInput } from "../types";
export const practiceRubbleAllianceModule = practiceModule("rubble-alliance", (id: string, seed: number) => createRubbleAllianceState([id], seed),
  (state, input: PracticeInput) => { const id = Object.keys(state.players)[0]!; return stepRubbleAlliance(state, { [id]: { sequence: input.sequence, x: input.x, y: input.y, action: input.pressed?.includes("special") ? "special" : "none" } }); },
  (state) => ({ seed: state.seed, tick: state.tick, roundIndex: state.roundIndex, roundTick: state.roundTick, roundTransitionTicks: state.roundTransitionTicks, floor: structuredClone(state.floor), players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, alive: p.alive, boostTicks: p.boostTicks, boostCooldownTicks: p.boostCooldownTicks, survivalTicks: p.survivalTicks }])), finished: state.finished }),
  (state) => state.finished || Object.values(state.players).every((p) => !p.alive));
export default practiceRubbleAllianceModule;
