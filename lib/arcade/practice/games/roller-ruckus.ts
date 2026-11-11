import { ROLLER_RUCKUS_CONFIG as C } from "./roller-ruckus-config";
import type { ArcadeInput } from "./types";

export interface RollerRuckusPlayer {
  x: number; y: number; vx: number; vy: number; lastInputSequence: number; angle: number; startAngle: number; progressTurns: number;
  laps: number; nextCheckpoint: number; lastCheckpoint: number; falling: boolean; respawnTicks: number; finishedAtTick: number | null;
}
export interface RollerRuckusState {
  seed: number; tick: number; players: Record<string, RollerRuckusPlayer>; finishers: string[]; finished: boolean; winnerId: string | null;
  targetLaps: number; trackRadiusX: number; trackRadiusY: number;
}

function pointAt(angle: number, lane = 0): [number, number] {
  const scale = 1 + lane;
  return [C.trackRadiusX * scale * Math.cos(angle), C.trackRadiusY * scale * Math.sin(angle)];
}

export function createRollerRuckusState(playerIds: readonly string[], seed: number): RollerRuckusState {
  const ids = [...new Set(playerIds)].sort();
  const players: Record<string, RollerRuckusPlayer> = {};
  const rotation = ((seed >>> 0) % 65_536) / 65_536 * Math.PI * 2;
  ids.forEach((id, index) => {
    const startAngle = Math.atan2(Math.sin(rotation - index * 0.055), Math.cos(rotation - index * 0.055));
    const [x, y] = pointAt(startAngle, index % 2 ? 0.025 : -0.025);
    players[id] = { x, y, vx: 0, vy: 0, lastInputSequence: -1, angle: startAngle, startAngle, progressTurns: 0, laps: 0,
      nextCheckpoint: 1, lastCheckpoint: 0, falling: false, respawnTicks: 0, finishedAtTick: null };
  });
  return { seed: seed | 0, tick: 0, players, finishers: [], finished: false, winnerId: null,
    targetLaps: C.targetLaps, trackRadiusX: C.trackRadiusX, trackRadiusY: C.trackRadiusY };
}

function advanceFallenPlayer(player: RollerRuckusPlayer): void {
  player.respawnTicks--;
  if (player.respawnTicks > 0) return;
  const checkpointAngle = player.startAngle + player.lastCheckpoint * (Math.PI / 2);
  const [x, y] = pointAt(checkpointAngle);
  player.x = x; player.y = y; player.vx = 0; player.vy = 0; player.falling = false; player.respawnTicks = 0;
  player.angle = checkpointAngle;
}

function fall(player: RollerRuckusPlayer): void {
  if (player.falling || player.finishedAtTick !== null) return;
  player.falling = true; player.respawnTicks = C.respawnTicks;
  player.vx *= -C.fallImpulse; player.vy *= -C.fallImpulse;
}

function trackPosition(x: number, y: number): number { return Math.hypot(x / C.trackRadiusX, y / C.trackRadiusY); }
function wrappedDelta(angle: number, prior: number): number { return Math.atan2(Math.sin(angle - prior), Math.cos(angle - prior)); }

function updateProgress(state: RollerRuckusState, playerId: string, player: RollerRuckusPlayer): void {
  const angle = Math.atan2(player.y / C.trackRadiusY, player.x / C.trackRadiusX);
  const delta = wrappedDelta(angle, player.angle);
  player.angle = angle;
  if (delta <= 0) return;
  player.progressTurns += delta / (Math.PI * 2);
  player.laps = Math.floor(player.progressTurns);
  const checkpointCrossings = Math.floor(player.progressTurns * C.checkpointCount);
  player.lastCheckpoint = checkpointCrossings % C.checkpointCount;
  player.nextCheckpoint = (player.lastCheckpoint + 1) % C.checkpointCount;
  if (player.laps >= C.targetLaps && player.finishedAtTick === null) {
    player.finishedAtTick = state.tick;
    state.finishers.push(playerId);
    state.finished = true;
    state.winnerId = state.finishers[0] ?? playerId;
  }
}

function resolveBumps(state: RollerRuckusState): void {
  const players = Object.values(state.players).filter((player) => !player.falling && player.finishedAtTick === null);
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i]!, b = players[j]!, dx = b.x - a.x, dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-6 || distance >= C.playerRadius * 2) continue;
    const nx = dx / distance, ny = dy / distance, overlap = C.playerRadius * 2 - distance;
    a.x -= nx * overlap * .5; a.y -= ny * overlap * .5; b.x += nx * overlap * .5; b.y += ny * overlap * .5;
    const relativeSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (relativeSpeed >= 0) continue;
    const impulse = -(1 + C.collisionRestitution) * relativeSpeed * .5;
    a.vx -= nx * impulse; a.vy -= ny * impulse; b.vx += nx * impulse; b.vy += ny * impulse;
  }
}

export function stepRollerRuckus(state: RollerRuckusState, inputs: Readonly<Record<string, ArcadeInput>>): RollerRuckusState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state), dt = C.fixedStepSeconds;
  const alreadyFinished = Object.entries(next.players).filter(([, player]) => player.laps >= C.targetLaps && player.finishedAtTick === null);
  if (alreadyFinished.length) {
    alreadyFinished.forEach(([id, player]) => { player.finishedAtTick = next.tick; next.finishers.push(id); });
    next.finished = true; next.winnerId = next.finishers[0] ?? null;
    return next;
  }
  for (const [id, player] of Object.entries(next.players)) {
    if (player.falling) { advanceFallenPlayer(player); continue; }
    if (player.finishedAtTick !== null) continue;
    const input = inputs[id];
    if (input && input.sequence > player.lastInputSequence) {
      player.lastInputSequence = input.sequence;
      let x = Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0;
      let y = Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0;
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) { x /= magnitude; y /= magnitude; }
      player.vx += x * C.acceleration * dt; player.vy += y * C.acceleration * dt;
    }
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > C.maxSpeed) { player.vx *= C.maxSpeed / speed; player.vy *= C.maxSpeed / speed; }
    player.x += player.vx * dt; player.y += player.vy * dt;
    player.vx *= C.rollDamping; player.vy *= C.rollDamping;
  }
  resolveBumps(next);
  for (const [id, player] of Object.entries(next.players)) {
    if (player.falling || player.finishedAtTick !== null) continue;
    const radial = trackPosition(player.x, player.y);
    if (radial < C.innerTrackFactor || radial > C.outerTrackFactor) { fall(player); continue; }
    updateProgress(next, id, player);
  }
  next.tick++;
  if (!next.finished && next.tick >= C.roundDurationSeconds / dt) {
    const ranked = Object.entries(next.players).filter(([, player]) => !player.falling)
      .sort((a, b) => b[1].progressTurns - a[1].progressTurns || a[0].localeCompare(b[0]));
    next.finished = true; next.winnerId = ranked[0]?.[0] ?? null;
  }
  return next;
}

import { practiceModule } from "./types";
import type { PracticeInput } from "../types";
export const practiceRollerRuckusModule = practiceModule("roller-ruckus", (id: string, seed: number) => createRollerRuckusState([id], seed),
  (state, input: PracticeInput) => { const id = Object.keys(state.players)[0]!; return stepRollerRuckus(state, { [id]: { sequence: input.sequence, x: input.x, y: input.y } }); },
  (state) => ({ seed: state.seed, tick: state.tick, players: structuredClone(state.players), finished: state.finished, targetLaps: state.targetLaps, trackRadiusX: state.trackRadiusX, trackRadiusY: state.trackRadiusY }),
  (state) => state.finished);
export default practiceRollerRuckusModule;
