import { DRAIN_BASH_CONFIG as C } from "./drain-bash-config";
import { JUNGLE_BASH_CONFIG as J } from "./jungle-bash-config";
import { createJungleBashState, stepJungleBash, type JungleBashPlayer, type JungleBashState, type JungleBashInput } from "./jungle-bash-simulation";
import type { PracticeGameModule, PracticeInput } from "../types";


export type DrainBashWeapon = "homing" | "burst" | "sonic";
export type DrainBashInput = Omit<PracticeInput, "buttons"> & { action?: "none" | "pickup" | "throw" | "attack" | "jump" | "special" };
export interface DrainBashSpecial { weapon: DrainBashWeapon | null; ammo: number }
export interface DrainBashProjectile {
  ownerId: string;
  kind: "homing" | "burst";
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageTicks: number;
}
export interface DrainBashWave { ownerId: string; x: number; y: number; radius: number; hitPlayerIds: string[] }
export interface DrainBashState {
  core: JungleBashState;
  specials: Record<string, DrainBashSpecial>;
  mysteryPickup: { x: number; y: number } | null;
  mysteryReadyAtTick: number;
  projectiles: DrainBashProjectile[];
  waves: DrainBashWave[];
}

function random(seed: number): number {
  let n = (seed | 0) + 0x6d2b79f5;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
function position(seed: number, tick: number): { x: number; y: number } {
  const angle = random(seed ^ Math.imul(tick + 13, 0x45d9f3b)) * Math.PI * 2;
  const radius = 1.5 + random(seed ^ Math.imul(tick + 29, 0x119de1f3)) * 4.5;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

export function createDrainBashState(playerIds: string[], seed: number): DrainBashState {
  const core = createJungleBashState(playerIds, seed, "jungle-bash");
  if (core.crate?.kind === "nitro") core.crate.kind = "tnt";
  core.healingFruit = null;
  core.healingFruitReadyAtTick = Number.MAX_SAFE_INTEGER;
  return {
    core,
    specials: Object.fromEntries(Object.keys(core.players).map((id) => [id, { weapon: null, ammo: 0 }])),
    mysteryPickup: position(seed, 0),
    mysteryReadyAtTick: 0,
    projectiles: [],
    waves: [],
  };
}

function choosePickup(state: DrainBashState, playerId: string): DrainBashWeapon | "heal" {
  const roll = random(state.core.seed ^ Math.imul(state.core.tick + 101, 0x27d4eb2d) ^ playerId.split("").reduce((v, c) => Math.imul(v ^ c.charCodeAt(0), 16777619), 0));
  const weights = C.mysteryWeaponWeights;
  if (roll < weights.homing) return "homing";
  if (roll < weights.homing + weights.burst) return "burst";
  if (roll < weights.homing + weights.burst + weights.sonic) return "sonic";
  return "heal";
}
function ammoFor(weapon: DrainBashWeapon): number {
  if (weapon === "homing") return C.homingAmmo;
  if (weapon === "burst") return C.burstAmmo;
  return C.sonicAmmo;
}
function damage(player: JungleBashPlayer, amount: number, vx: number, vy: number): void {
  if (player.eliminated || player.invulnerableTicks > 0 || player.jumpTicks > 0) return;
  player.health = Math.max(0, player.health - amount);
  player.invulnerableTicks = Math.ceil(J.hitInvulnerabilitySeconds / J.fixedStepSeconds);
  player.vx += vx;
  player.vy += vy;
  if (player.health === 0) {
    player.eliminated = true;
    player.carriedCrate = false;
    player.carriedCrateKind = null;
    player.carriedFuseTicks = null;
  }
}
function livingTargets(state: DrainBashState, ownerId: string): Array<[string, JungleBashPlayer]> {
  return Object.entries(state.core.players).filter(([id, player]) => id !== ownerId && !player.eliminated);
}
function fire(state: DrainBashState, id: string): void {
  const player = state.core.players[id];
  const special = state.specials[id];
  if (!player || player.eliminated || !special || !special.weapon || special.ammo <= 0) return;
  const weapon = special.weapon;
  special.ammo--;
  const fx = player.facingX || 1, fy = player.facingY || 0;
  if (weapon === "sonic") {
    state.waves.push({ ownerId: id, x: player.x, y: player.y, radius: 0, hitPlayerIds: [] });
    return;
  }
  if (weapon === "burst") {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      state.projectiles.push({ ownerId: id, kind: "burst", x: player.x, y: player.y,
        vx: Math.cos(angle) * C.burstSpeed, vy: Math.sin(angle) * C.burstSpeed, ageTicks: 0 });
    }
    return;
  }
  const targets = livingTargets(state, id).sort((a, b) => Math.hypot(a[1].x - player.x, a[1].y - player.y) - Math.hypot(b[1].x - player.x, b[1].y - player.y));
  const target = targets[0]?.[1];
  const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.atan2(fy, fx);
  state.projectiles.push({ ownerId: id, kind: "homing", x: player.x, y: player.y,
    vx: Math.cos(angle) * C.homingSpeed, vy: Math.sin(angle) * C.homingSpeed, ageTicks: 0 });
}
function turnToward(vx: number, vy: number, tx: number, ty: number, maxTurn: number, speed: number): [number, number] {
  const current = Math.atan2(vy, vx), target = Math.atan2(ty, tx);
  let delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  delta = Math.max(-maxTurn, Math.min(maxTurn, delta));
  const angle = current + delta;
  return [Math.cos(angle) * speed, Math.sin(angle) * speed];
}

export function stepDrainBash(state: DrainBashState, inputs: Record<string, DrainBashInput>): DrainBashState {
  if (state.core.finished) return structuredClone(state);
  const next = structuredClone(state);
  const previousSequence = Object.fromEntries(Object.entries(state.core.players).map(([id, player]) => [id, player.lastInputSequence]));
  const coreInputs: Record<string, JungleBashInput> = {};
  for (const [id, input] of Object.entries(inputs)) {
    const action = input.action === "special" ? "none" : input.action;
    coreInputs[id] = { sequence: input.sequence, x: input.x, y: input.y, action };
  }
  if (next.core.crate?.kind === "nitro") next.core.crate.kind = "tnt";
  next.core.healingFruit = null;
  next.core.healingFruitReadyAtTick = Number.MAX_SAFE_INTEGER;
  next.core = stepJungleBash(next.core, coreInputs);
  if (next.core.crate?.kind === "nitro") next.core.crate.kind = "tnt";
  next.core.healingFruit = null;
  next.core.healingFruitReadyAtTick = Number.MAX_SAFE_INTEGER;

  for (const [id, input] of Object.entries(inputs)) {
    const wasFresh = Number.isFinite(input.sequence) && input.sequence > (previousSequence[id] ?? -1);
    if (!wasFresh || next.core.players[id]?.eliminated) continue;
    if (input.action === "special") fire(next, id);
    if (input.action === "pickup" && next.mysteryPickup && next.core.players[id]
      && Math.hypot(next.core.players[id]!.x - next.mysteryPickup.x, next.core.players[id]!.y - next.mysteryPickup.y) <= J.pickupRange) {
      const pickup = choosePickup(next, id);
      if (pickup === "heal") {
        const player = next.core.players[id]!;
        player.health = Math.min(J.health, player.health + C.healingAmount);
      } else {
        next.specials[id] = { weapon: pickup, ammo: ammoFor(pickup) };
      }
      next.mysteryPickup = null;
      next.mysteryReadyAtTick = next.core.tick + Math.ceil(C.mysteryRespawnSeconds / C.fixedStepSeconds);
    }
  }

  const dt = C.fixedStepSeconds;
  const maxTurn = C.homingTurnRadiansPerSecond * dt;
  const remaining: DrainBashProjectile[] = [];
  for (const shot of next.projectiles) {
    if (shot.kind === "homing") {
      const targets = livingTargets(next, shot.ownerId).sort((a, b) => Math.hypot(a[1].x - shot.x, a[1].y - shot.y) - Math.hypot(b[1].x - shot.x, b[1].y - shot.y));
      const target = targets[0]?.[1];
      if (target) [shot.vx, shot.vy] = turnToward(shot.vx, shot.vy, target.x - shot.x, target.y - shot.y, maxTurn, C.homingSpeed);
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.ageTicks++;
    let hit = false;
    for (const [, player] of livingTargets(next, shot.ownerId)) {
      if (Math.hypot(player.x - shot.x, player.y - shot.y) > J.playerRadius + C.projectileRadius) continue;
      const speed = Math.hypot(shot.vx, shot.vy) || 1;
      damage(player, C.projectileDamage, shot.vx / speed * C.projectileKnockback, shot.vy / speed * C.projectileKnockback);
      hit = true;
      break;
    }
    const maxAge = Math.ceil((shot.kind === "homing" ? C.homingLifetimeSeconds : C.burstLifetimeSeconds) / dt);
    if (!hit && shot.ageTicks < maxAge && Math.hypot(shot.x, shot.y) < J.arenaRadius) remaining.push(shot);
  }
  next.projectiles = remaining;

  const activeWaves: DrainBashWave[] = [];
  for (const wave of next.waves) {
    const oldRadius = wave.radius;
    wave.radius = Math.min(C.sonicRadius, oldRadius + C.sonicWaveSpeed * dt);
    for (const [id, player] of livingTargets(next, wave.ownerId)) {
      if (wave.hitPlayerIds.includes(id)) continue;
      const distance = Math.hypot(player.x - wave.x, player.y - wave.y);
      if (distance < oldRadius - C.sonicWaveThickness || distance > wave.radius + C.sonicWaveThickness) continue;
      const direction = Math.atan2(player.y - wave.y, player.x - wave.x);
      damage(player, C.sonicDamage, Math.cos(direction) * C.sonicKnockback, Math.sin(direction) * C.sonicKnockback);
      wave.hitPlayerIds.push(id);
    }
    if (wave.radius < C.sonicRadius) activeWaves.push(wave);
  }
  next.waves = activeWaves;

  if (!next.mysteryPickup && next.core.tick >= next.mysteryReadyAtTick) next.mysteryPickup = position(next.core.seed, next.core.tick);
  const survivors = Object.entries(next.core.players).filter(([, player]) => !player.eliminated);
  const solo = Object.keys(next.core.players).length === 1;
  if (survivors.length === 0 || (!solo && survivors.length === 1)) {
    next.core.finished = true;
    next.core.winnerId = survivors[0]?.[0] ?? null;
  } else if (next.core.tick >= C.roundDurationSeconds / dt) {
    if (solo) { next.core.finished = true; next.core.winnerId = survivors[0]?.[0] ?? null; return next; }
    const ranked = survivors.sort((a, b) => b[1].health - a[1].health);
    next.core.finished = true;
    next.core.winnerId = ranked[0]![1].health === ranked[1]![1].health ? null : ranked[0]![0];
  }
  return next;
}

export const drainBashModule: PracticeGameModule<DrainBashState> = {
  id: "drain-bash",
  createState: (playerId, seed) => createDrainBashState([playerId], seed),
  step: (state, input) => {
    const id = Object.keys(state.core.players)[0]!;
    const player = state.core.players[id]!;
    return stepDrainBash(state, { [id]: { sequence: input.sequence, x: input.x, y: input.y,
      action: input.buttons.special ? "special" : input.buttons.jump ? "jump" : input.buttons.action ? (player.carriedCrate ? "throw" : "pickup") : "none" } });
  },
  snapshot: (state) => ({ ...structuredClone(state.core), specials: structuredClone(state.specials), mysteryPickup: structuredClone(state.mysteryPickup), specialProjectiles: structuredClone(state.projectiles), sonicWaves: structuredClone(state.waves) }),
  isTerminal: (state) => state.core.finished || Object.values(state.core.players).every((player) => player.eliminated),
};
export default drainBashModule;
