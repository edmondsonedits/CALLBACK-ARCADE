import { PAINT_PANIC_CONFIG as C } from "./paint-panic-config";
import type { ArcadeGameModule, ArcadeInput } from "./types";

export type PaintPanicSize = "small" | "large";
export interface PaintPanicPlayer {
  x: number; y: number; vx: number; vy: number; aimX: number; aimY: number;
  score: number; lastInputSequence: number; sprayCooldownTicks: number; sprays: number;
}
export interface PaintPanicCreature {
  id: number; x: number; y: number; destinationX: number; destinationY: number;
  size: PaintPanicSize; ownerId: string | null; spawnedAtTick: number;
}
export interface PaintPanicState {
  seed: number; tick: number; nextCreatureId: number; spawnCountdown: number;
  players: Record<string, PaintPanicPlayer>; creatures: PaintPanicCreature[];
  finished: boolean; winnerId: string | null; winners: string[];
}

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
function random(seed: number): number {
  let x = seed | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 0x1_0000_0000;
}
function playerPositions(count: number): Array<[number, number]> {
  // Seats are equally spaced around a centered ring; sorting IDs before use
  // makes a room's assignment deterministic without privileging join order.
  const radius = count > 1 ? 2.25 : 0;
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / Math.max(count, 1);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}
export function createPaintPanicState(playerIds: readonly string[], seed: number): PaintPanicState {
  const ids = [...new Set(playerIds)].sort().slice(0, C.maxPlayers);
  const players: Record<string, PaintPanicPlayer> = {};
  ids.forEach((id, i) => {
    const [x, y] = playerPositions(ids.length)[i]!;
    players[id] = { x, y, vx: 0, vy: 0, aimX: i % 2 ? -1 : 1, aimY: 0, score: 0, lastInputSequence: -1, sprayCooldownTicks: 0, sprays: 0 };
  });
  return { seed: seed | 0, tick: 0, nextCreatureId: 1, spawnCountdown: 1, players, creatures: [], finished: false, winnerId: null, winners: [] };
}

function spawnCreature(state: PaintPanicState): void {
  if (state.creatures.length >= C.maxCreatures) return;
  const id = state.nextCreatureId++;
  // Four mirrored route pairs keep target travel equivalent for every seat.
  // Seed chooses the pair/order and size but cannot place an individual target
  // nearer to one particular player's spawn.
  const lane = Math.floor(random(state.seed ^ (id * 0x45d9f3b)) * 4);
  const side = (id + (state.seed & 1)) % 2 === 0 ? -1 : 1;
  const y = [-3, -1, 1, 3][lane]!;
  const fromLeft = id % 2 === 0;
  const sx = fromLeft ? -C.arenaHalfWidth + C.spawnInset : C.arenaHalfWidth - C.spawnInset;
  const dx = -sx;
  const size: PaintPanicSize = random(state.seed ^ (id * 0x27d4eb2d)) < 0.2 ? "large" : "small";
  state.creatures.push({ id, x: sx, y: clamp(y + side * 0.22, -C.arenaHalfHeight + C.spawnInset, C.arenaHalfHeight - C.spawnInset), destinationX: dx, destinationY: clamp(y, -C.arenaHalfHeight + C.destinationInset, C.arenaHalfHeight - C.destinationInset), size, ownerId: null, spawnedAtTick: state.tick });
}

function movePlayers(state: PaintPanicState, inputs: Readonly<Record<string, ArcadeInput>>): void {
  const dt = C.fixedStepSeconds;
  for (const [id, p] of Object.entries(state.players)) {
    if (p.sprayCooldownTicks > 0) p.sprayCooldownTicks--;
    const input = inputs[id];
    if (input && Number.isSafeInteger(input.sequence) && input.sequence > p.lastInputSequence) {
      p.lastInputSequence = input.sequence;
      let x = clamp(input.x, -1, 1), y = clamp(input.y, -1, 1);
      const mag = Math.hypot(x, y);
      if (mag > 1) { x /= mag; y /= mag; }
      if (mag > 0.12) { p.aimX = x / mag; p.aimY = y / mag; }
      p.vx += x * C.playerAcceleration * dt;
      p.vy += y * C.playerAcceleration * dt;
      if (input.action === "attack" && p.sprayCooldownTicks === 0) {
        sprayAt(state, id, p);
        p.sprayCooldownTicks = C.sprayCooldownTicks;
        p.sprays++;
      }
    }
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > C.playerMaxSpeed) { p.vx *= C.playerMaxSpeed / speed; p.vy *= C.playerMaxSpeed / speed; }
    p.x = clamp(p.x + p.vx * dt, -C.arenaHalfWidth + C.playerRadius, C.arenaHalfWidth - C.playerRadius);
    p.y = clamp(p.y + p.vy * dt, -C.arenaHalfHeight + C.playerRadius, C.arenaHalfHeight - C.playerRadius);
    p.vx *= C.playerDrag; p.vy *= C.playerDrag;
  }
}

function sprayAt(state: PaintPanicState, ownerId: string, p: PaintPanicPlayer): void {
  const cosHalf = Math.cos(C.sprayHalfAngleRadians);
  for (const c of state.creatures) {
    const dx = c.x - p.x, dy = c.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > C.sprayRange || dist < 0.001) continue;
    const facing = (dx * p.aimX + dy * p.aimY) / dist;
    if (facing >= cosHalf) c.ownerId = ownerId;
  }
}

function moveCreatures(state: PaintPanicState): void {
  const dt = C.fixedStepSeconds;
  for (let i = state.creatures.length - 1; i >= 0; i--) {
    const c = state.creatures[i]!;
    const dx = c.destinationX - c.x, dy = c.destinationY - c.y;
    const distance = Math.hypot(dx, dy);
    const speed = c.size === "large" ? C.largeCreatureSpeed : C.smallCreatureSpeed;
    if (distance <= speed * dt) {
      if (c.ownerId && state.players[c.ownerId]) state.players[c.ownerId]!.score += c.size === "large" ? C.largeCreaturePoints : C.smallCreaturePoints;
      state.creatures.splice(i, 1);
      continue;
    }
    c.x += dx / distance * speed * dt;
    c.y += dy / distance * speed * dt;
  }
}

export function stepPaintPanic(state: PaintPanicState, inputs: Readonly<Record<string, ArcadeInput>>): PaintPanicState {
  if (state.finished) return state;
  state.tick++;
  movePlayers(state, inputs);
  moveCreatures(state);
  state.spawnCountdown--;
  if (state.spawnCountdown <= 0) {
    spawnCreature(state);
    state.spawnCountdown = C.creatureSpawnTicks;
  }
  if (state.tick >= C.roundDurationTicks) {
    state.finished = true;
    const high = Math.max(0, ...Object.values(state.players).map((p) => p.score));
    state.winners = Object.entries(state.players).filter(([, p]) => p.score === high).map(([id]) => id).sort();
    state.winnerId = state.winners.length === 1 ? state.winners[0]! : null;
  }
  return state;
}

export const paintPanicModule: ArcadeGameModule<PaintPanicState> = {
  id: "paint-panic",
  minPlayers: 2,
  createState: createPaintPanicState,
  step: stepPaintPanic,
  snapshot: (state) => ({
    tick: state.tick,
    players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, {
      x: player.x, y: player.y, aimX: player.aimX, aimY: player.aimY, score: player.score,
    }])),
    creatures: state.creatures.map(({ id, x, y, destinationX, destinationY, size, ownerId }) => ({ id, x, y, destinationX, destinationY, size, ownerId })),
    finished: state.finished, winnerId: state.winnerId, winners: [...state.winners],
  }),
  result: (state) => state.finished ? { winnerId: state.winnerId, winners: state.winners, scores: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, p.score])) } : null,
};
import { createPracticeAdapter, movementActionInput } from "./practice-adapter";

const practicePaintPanicModule = createPracticeAdapter(paintPanicModule, { mapInput: (input) => movementActionInput(input, "spray"),
  terminal: (state: PaintPanicState) => state.finished });
export default practicePaintPanicModule;
