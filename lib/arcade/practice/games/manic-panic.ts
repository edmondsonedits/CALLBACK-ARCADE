import { MANIC_PANIC_CONFIG as C } from "./manic-panic-config";
import type { PracticeGameModule } from "../types";

export interface ManicPanicInput { sequence: number; x: number; y: number; action?: "none" | "pickup" | "throw" | "attack" | "jump" | "special" }
export interface ManicPanicPlayer {
  x: number; y: number; vx: number; vy: number; mounted: boolean; bombHits: number; eliminated: boolean;
  lastInputSequence: number; facingX: number; facingY: number; invulnerableTicks: number; bombCooldownTicks: number; carryingBomb: boolean;
}
export interface ManicPanicBomb { ownerId: string; x: number; y: number; vx: number; vy: number; fuseTicks: number | null }
export interface ManicPanicState {
  tuning?: {durationTicks?:number;blastScale?:number};
  seed: number; tick: number; players: Record<string, ManicPanicPlayer>; bombs: ManicPanicBomb[]; bombRespawnAtTick: number | null;
  winnerId: string | null; finished: boolean;
}

function clampInput(input: ManicPanicInput): ManicPanicInput {
  const finite = (value: number) => Number.isFinite(value) ? value : 0;
  let x = Math.max(-C.inputAxisLimit, Math.min(C.inputAxisLimit, finite(input.x)));
  let y = Math.max(-C.inputAxisLimit, Math.min(C.inputAxisLimit, finite(input.y)));
  const magnitude = Math.hypot(x, y);
  if (magnitude > 1) { x /= magnitude; y /= magnitude; }
  return { sequence: Math.max(0, Math.floor(finite(input.sequence))), x, y,
    action: input.action === "pickup" || input.action === "throw" ? input.action : "none" };
}

function detonate(state: ManicPanicState, bomb: ManicPanicBomb): void {
  for (const player of Object.values(state.players)) {
    if (player.eliminated || player.invulnerableTicks > 0) continue;
    const dx = player.x - bomb.x, dy = player.y - bomb.y, distance = Math.hypot(dx, dy);
    const blastScale = Math.max(.5, Math.min(1.5, state.tuning?.blastScale ?? 1));
    if (distance > C.bombBlastRadius * blastScale) continue;
    player.bombHits++;
    player.mounted = false;
    player.invulnerableTicks = Math.ceil(C.hitInvulnerabilitySeconds / C.fixedStepSeconds);
    const inverseDistance = distance > 1e-5 ? 1 / distance : 1;
    const nx = distance > 1e-5 ? dx * inverseDistance : (player.x - bomb.x || 1);
    const ny = distance > 1e-5 ? dy * inverseDistance : 0;
    player.vx += nx * C.bombKnockback * blastScale;
    player.vy += ny * C.bombKnockback * blastScale;
    if (player.bombHits >= 2) { player.eliminated = true; player.carryingBomb = false; }
  }
}

export function createManicPanicState(playerIds: string[], seed: number, tuning?:ManicPanicState['tuning']): ManicPanicState {
  const ids = [...new Set(playerIds)].sort();
  const players: Record<string, ManicPanicPlayer> = {};
  ids.forEach((id, index) => {
    const angle = (2 * Math.PI * index) / Math.max(1, ids.length);
    players[id] = { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4, vx: 0, vy: 0, mounted: true, bombHits: 0,
      eliminated: false, lastInputSequence: -1, facingX: Math.cos(angle + Math.PI), facingY: Math.sin(angle + Math.PI),
      invulnerableTicks: 0, bombCooldownTicks: 0, carryingBomb: false };
  });
  return { seed: seed | 0, tick: 0, players, bombs: [{ ownerId: "", x: 0, y: 0, vx: 0, vy: 0, fuseTicks: null }],
    bombRespawnAtTick: null, winnerId: null, finished: false, ...(tuning?{tuning}: {}) };
}

export function stepManicPanic(state: ManicPanicState, inputs: Record<string, ManicPanicInput>): ManicPanicState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state), dt = C.fixedStepSeconds;
  for (const [id, player] of Object.entries(next.players)) {
    if (player.eliminated) continue;
    const input = clampInput(inputs[id] ?? { sequence: player.lastInputSequence, x: 0, y: 0 });
    if (input.sequence < player.lastInputSequence) continue;
    const fresh = input.sequence > player.lastInputSequence;
    if (fresh) player.lastInputSequence = input.sequence;
    if (input.x || input.y) { player.facingX = input.x; player.facingY = input.y; }
    player.invulnerableTicks = Math.max(0, player.invulnerableTicks - 1);
    player.bombCooldownTicks = Math.max(0, player.bombCooldownTicks - 1);
    const acceleration = player.mounted ? C.mountedAcceleration : C.onFootAcceleration;
    const maxSpeed = player.mounted ? C.mountedMaxSpeed : C.onFootMaxSpeed;
    player.vx += input.x * acceleration * dt;
    player.vy += input.y * acceleration * dt;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) { player.vx *= maxSpeed / speed; player.vy *= maxSpeed / speed; }
    if (fresh && input.action === "pickup" && !player.carryingBomb) {
      const bombIndex = next.bombs.findIndex((bomb) => bomb.fuseTicks === null && Math.hypot(player.x - bomb.x, player.y - bomb.y) <= C.bombPickupRange);
      if (bombIndex >= 0) { next.bombs.splice(bombIndex, 1); player.carryingBomb = true; }
    } else if (fresh && input.action === "throw" && player.carryingBomb && player.bombCooldownTicks === 0) {
      next.bombs.push({ ownerId: id, x: player.x + player.facingX * (C.playerRadius + 0.15),
        y: player.y + player.facingY * (C.playerRadius + 0.15), vx: player.facingX * C.bombThrowSpeed,
        vy: player.facingY * C.bombThrowSpeed, fuseTicks: Math.ceil(C.bombFuseSeconds / dt) });
      player.carryingBomb = false;
      player.bombCooldownTicks = Math.ceil(C.bombCooldownSeconds / dt);
    }
  }
  for (const player of Object.values(next.players)) {
    if (player.eliminated) continue;
    player.x += player.vx * dt; player.y += player.vy * dt;
    const radius = Math.hypot(player.x, player.y);
    if (radius > C.arenaRadius) { player.eliminated = true; player.mounted = false; player.carryingBomb = false; continue; }
    player.vx *= player.mounted ? C.mountedDamping : C.onFootDamping;
    player.vy *= player.mounted ? C.mountedDamping : C.onFootDamping;
  }
  const active = Object.entries(next.players).filter(([, player]) => !player.eliminated);
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i]![1], b = active[j]![1], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    if (distance === 0 || distance >= C.playerRadius * 2) continue;
    const nx = dx / distance, ny = dy / distance, overlap = C.playerRadius * 2 - distance;
    a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2;
    const impulse = (a.mounted ? C.mountedBumpImpulse : C.onFootBumpImpulse) + (b.mounted ? C.mountedBumpImpulse : C.onFootBumpImpulse);
    a.vx -= nx * impulse / 2; a.vy -= ny * impulse / 2; b.vx += nx * impulse / 2; b.vy += ny * impulse / 2;
  }
  const remaining: ManicPanicBomb[] = [];
  for (const bomb of next.bombs) {
    if (bomb.fuseTicks === null) { remaining.push(bomb); continue; }
    bomb.x += bomb.vx * dt; bomb.y += bomb.vy * dt; bomb.vx *= 0.985; bomb.vy *= 0.985; bomb.fuseTicks--;
    if (bomb.fuseTicks <= 0 || Math.hypot(bomb.x, bomb.y) >= C.arenaRadius) {
      detonate(next, bomb);
      next.bombRespawnAtTick = next.tick + Math.ceil(C.bombRespawnSeconds / dt);
    }
    else remaining.push(bomb);
  }
  next.bombs = remaining;
  next.tick++;
  if (next.bombs.length === 0 && !Object.values(next.players).some(player => !player.eliminated && player.carryingBomb) && next.bombRespawnAtTick === null) {
    next.bombRespawnAtTick = next.tick + Math.ceil(C.bombRespawnSeconds / dt);
  }
  if (!next.bombs.some((bomb) => bomb.fuseTicks === null) && next.bombRespawnAtTick !== null && next.tick >= next.bombRespawnAtTick) {
    next.bombs.push({ ownerId: "", x: 0, y: 0, vx: 0, vy: 0, fuseTicks: null });
    next.bombRespawnAtTick = null;
  }
  const survivors = Object.entries(next.players).filter(([, player]) => !player.eliminated);
  const solo = Object.keys(next.players).length === 1;
  if (survivors.length === 0 || (!solo && survivors.length === 1)) { next.finished = true; next.winnerId = survivors[0]?.[0] ?? null; }
  else if (next.tick >= (next.tuning?.durationTicks ?? C.roundDurationSeconds / dt)) {
    if (solo) { next.finished = true; next.winnerId = survivors[0]?.[0] ?? null; return next; }
    const ranked = survivors.sort((a, b) => a[1].bombHits - b[1].bombHits);
    next.finished = true;
    next.winnerId = ranked[0]![1].bombHits === ranked[1]![1].bombHits ? null : ranked[0]![0];
  }
  return next;
}

export const manicPanicModule: PracticeGameModule<ManicPanicState> = {
  id: "manic-panic",
  createState: (playerId, seed) => createManicPanicState([playerId], seed),
  step: (state, input) => {
    const id = Object.keys(state.players)[0]!;
    const player = state.players[id]!;
    return stepManicPanic(state, { [id]: { sequence: input.sequence, x: input.x, y: input.y,
      action: input.buttons.action ? (player.carryingBomb ? "throw" : "pickup") : "none" } });
  },
  snapshot: (state) => structuredClone(state),
  isTerminal: (state) => state.finished || Object.values(state.players).every((player) => player.eliminated),
};
export default manicPanicModule;
