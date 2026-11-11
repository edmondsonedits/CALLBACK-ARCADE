import { JUNGLE_BASH_CONFIG as C } from "./jungle-bash-config";
import { SPACE_BASH_CONFIG as S } from "./space-bash-config";
import { SNOW_BASH_CONFIG as N } from "./snow-bash-config";
import { createDestructibleFloor, markFloorTile, stepDestructibleFloor, tileIndexAt, type DestructibleFloor } from "./destructible-floor";

export type JungleBashAction = "none" | "pickup" | "throw" | "attack" | "jump" | "special";
export type JungleBashCrateKind = "steel" | "tnt" | "nitro";
export interface JungleBashInput { sequence: number; x: number; y: number; action?: JungleBashAction }
export interface JungleBashPlayer {
  x: number; y: number; vx: number; vy: number; health: number; eliminated: boolean;
  lastInputSequence: number; facingX: number; facingY: number; carriedCrate: boolean;
  jumpTicks: number; attackCooldownTicks: number; invulnerableTicks: number;
  carriedCrateKind: JungleBashCrateKind | null; carriedFuseTicks: number | null;
}
export interface JungleBashProjectile { ownerId: string; kind: JungleBashCrateKind; fuseTicks: number | null; x: number; y: number; vx: number; vy: number; age: number }
export interface JungleBashState {
  /** Opt-in for full arenas. Legacy practice rules keep their original floor behavior. */
  gapJumping?: boolean;
  /** Full-game explosive reach/impulse; omitted for the legacy rules. */
  hazardScale?: number;
  seed: number; tick: number; variant: "jungle-bash" | "space-bash" | "snow-bash"; floor: DestructibleFloor | null;
  penguin: { x: number; y: number; state: "sleep" | "warning" | "active" | "return"; ticksRemaining: number } | null;
  players: Record<string, JungleBashPlayer>; crate: { x: number; y: number; kind: JungleBashCrateKind } | null;
  healingFruit: { x: number; y: number } | null; healingFruitReadyAtTick: number;
  projectiles: JungleBashProjectile[]; winnerId: string | null; finished: boolean;
}

function random(seed: number): number {
  let n = (seed | 0) + 0x6d2b79f5;
  n = Math.imul(n ^ (n >>> 15), n | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}

function respawnCrate(seed: number, tick: number, variant: JungleBashState["variant"], floor: DestructibleFloor | null): { x: number; y: number; kind: JungleBashCrateKind } {
  const angle = random(seed ^ Math.imul(tick + 1, 0x45d9f3b)) * Math.PI * 2;
  const radius = random(seed ^ Math.imul(tick + 17, 0x119de1f3)) * C.arenaRadius * 0.45;
  const roll = random(seed ^ Math.imul(tick + 31, 0x27d4eb2d));
  const kind: JungleBashCrateKind = variant === "space-bash" ? (roll < S.tntBagRatio ? "tnt" : "nitro") : roll < 0.58 ? "steel" : roll < 0.82 ? "tnt" : "nitro";
  let x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
  if (floor) {
    const preferred = tileIndexAt(floor, x, y);
    if (preferred === null || floor.tiles[preferred]?.state !== "safe") {
      const start = Math.floor(random(seed ^ Math.imul(tick + 59, 0x165667b1)) * floor.tiles.length);
      for (let offset = 0; offset < floor.tiles.length; offset++) {
        const index = (start + offset) % floor.tiles.length;
        if (floor.tiles[index]?.state !== "safe") continue;
        const tileSize = floor.halfExtent * 2 / floor.size;
        const column = index % floor.size, row = Math.floor(index / floor.size);
        x = -floor.halfExtent + (column + 0.5) * tileSize;
        y = -floor.halfExtent + (row + 0.5) * tileSize;
        break;
      }
    }
  }
  return { x, y, kind };
}

function damagePlayer(player: JungleBashPlayer, damage: number, vx: number, vy: number): void {
  if (player.eliminated || player.invulnerableTicks > 0 || player.jumpTicks > 0) return;
  player.health = Math.max(0, player.health - damage);
  player.invulnerableTicks = Math.ceil(C.hitInvulnerabilitySeconds / C.fixedStepSeconds);
  player.vx += vx; player.vy += vy;
  if (player.health === 0) { player.eliminated = true; player.carriedCrate = false; player.carriedCrateKind = null; player.carriedFuseTicks = null; }
}

function explodeAt(state: JungleBashState, x: number, y: number, ownerVx: number, ownerVy: number, kind: JungleBashCrateKind): void {
  const scale = typeof state.hazardScale === "number" && Number.isFinite(state.hazardScale) ? Math.max(0.5, Math.min(1.5, state.hazardScale)) : 1;
  const blastRadius = C.blastRadius * scale;
  if (state.floor && kind !== "steel") markFloorTile(state.floor, x, y);
  for (const player of Object.values(state.players)) {
    if (player.eliminated || player.invulnerableTicks > 0 || player.jumpTicks > 0) continue;
    const dx = player.x - x, dy = player.y - y, distance = Math.hypot(dx, dy);
    if (distance > blastRadius) continue;
    const falloff = Math.max(0.35, 1 - distance / (blastRadius * 1.35));
    const nx = distance > 0.001 ? dx / distance : (ownerVx ? Math.sign(ownerVx) : 1);
    const ny = distance > 0.001 ? dy / distance : (ownerVy ? Math.sign(ownerVy) : 0);
    damagePlayer(player, C.blastDamage, nx * C.blastImpulse * scale * falloff, ny * C.blastImpulse * scale * falloff);
  }
}

function stepSnowPenguin(state: JungleBashState): void {
  const penguin = state.penguin;
  if (!penguin) return;
  if (penguin.state === "sleep") {
    const activated = Object.values(state.players).some((player) => !player.eliminated && Math.hypot(player.x - penguin.x, player.y - penguin.y) <= N.wakeRadius);
    if (activated) { penguin.state = "warning"; penguin.ticksRemaining = N.warningTicks; }
  } else if (penguin.state === "warning") {
    penguin.ticksRemaining--;
    if (penguin.ticksRemaining <= 0) { penguin.state = "active"; penguin.ticksRemaining = N.activeTicks; }
  } else if (penguin.state === "active") {
    penguin.ticksRemaining--;
    const target = Object.values(state.players).filter((player) => !player.eliminated)
      .sort((a, b) => Math.hypot(a.x - penguin.x, a.y - penguin.y) - Math.hypot(b.x - penguin.x, b.y - penguin.y))[0];
    if (target) {
      const dx = target.x - penguin.x, dy = target.y - penguin.y, distance = Math.hypot(dx, dy);
      if (distance > 0) { const travel = Math.min(distance, N.hazardSpeed * C.fixedStepSeconds); penguin.x += dx / distance * travel; penguin.y += dy / distance * travel; }
      if (distance <= N.contactRadius + N.hazardSpeed * C.fixedStepSeconds) {
        const direction = Math.hypot(dx, dy) > 0 ? Math.hypot(dx, dy) : 1;
        damagePlayer(target, N.contactDamage, dx / direction * N.knockbackImpulse, dy / direction * N.knockbackImpulse);
        penguin.state = "return"; penguin.ticksRemaining = N.returnTicks;
        return;
      }
    }
    if (penguin.ticksRemaining <= 0) { penguin.state = "return"; penguin.ticksRemaining = N.returnTicks; }
  } else {
    penguin.ticksRemaining--;
    penguin.x *= 0.88; penguin.y *= 0.88;
    if (penguin.ticksRemaining <= 0) { penguin.x = 0; penguin.y = 0; penguin.state = "sleep"; penguin.ticksRemaining = 0; }
  }
}

export function createJungleBashState(playerIds: string[], seed: number, variant: JungleBashState["variant"] = "jungle-bash"): JungleBashState {
  const ids = [...new Set(playerIds)].sort();
  const players: Record<string, JungleBashPlayer> = {};
  ids.forEach((id, index) => {
    const angle = (2 * Math.PI * index) / Math.max(1, ids.length);
    players[id] = { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4, vx: 0, vy: 0,
      health: C.health, eliminated: false, lastInputSequence: -1, facingX: Math.cos(angle + Math.PI),
      facingY: Math.sin(angle + Math.PI), carriedCrate: false, jumpTicks: 0, attackCooldownTicks: 0, invulnerableTicks: 0,
      carriedCrateKind: null, carriedFuseTicks: null };
  });
  const crateAngle = random(seed) * 2 * Math.PI;
  const fruitAngle = random(seed ^ 0x72ad4f31) * 2 * Math.PI;
  const initialCrateKind: JungleBashCrateKind = variant === "space-bash"
    ? (random(seed ^ 0x1bd11bda) < S.tntBagRatio ? "tnt" : "nitro")
    : "steel";
  return { seed: seed | 0, tick: 0, variant, floor: variant === "space-bash" ? createDestructibleFloor(S.floorSize, S.floorHalfExtent, S.floorWarningTicks) : null,
    penguin: variant === "snow-bash" ? { x: 0, y: 0, state: "sleep", ticksRemaining: 0 } : null, players,
    crate: { x: Math.cos(crateAngle) * 1.5, y: Math.sin(crateAngle) * 1.5, kind: initialCrateKind },
    healingFruit: { x: Math.cos(fruitAngle) * 2.6, y: Math.sin(fruitAngle) * 2.6 }, healingFruitReadyAtTick: 0,
    projectiles: [], winnerId: null, finished: false };
}

function clampInput(input: JungleBashInput): JungleBashInput {
  const finite = (v: number) => Number.isFinite(v) ? v : 0;
  let x = Math.max(-C.inputAxisLimit, Math.min(C.inputAxisLimit, finite(input.x)));
  let y = Math.max(-C.inputAxisLimit, Math.min(C.inputAxisLimit, finite(input.y)));
  const mag = Math.hypot(x, y);
  if (mag > 1) { x /= mag; y /= mag; }
  return { sequence: Math.max(0, Math.floor(finite(input.sequence))), x, y,
    action: input.action === "pickup" || input.action === "throw" || input.action === "attack" || input.action === "jump" || input.action === "special" ? input.action : "none" };
}

export function stepJungleBash(state: JungleBashState, inputs: Record<string, JungleBashInput>): JungleBashState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state);
  const dt = C.fixedStepSeconds;
  for (const [id, player] of Object.entries(next.players)) {
    if (player.eliminated) continue;
    const input = clampInput(inputs[id] ?? { sequence: player.lastInputSequence, x: 0, y: 0, action: "none" });
    if (input.sequence < player.lastInputSequence) continue;
    const freshInput = input.sequence > player.lastInputSequence;
    if (freshInput) player.lastInputSequence = input.sequence;
    if (input.x || input.y) { player.facingX = input.x; player.facingY = input.y; }
    player.jumpTicks = Math.max(0, player.jumpTicks - 1);
    player.attackCooldownTicks = Math.max(0, player.attackCooldownTicks - 1);
    player.invulnerableTicks = Math.max(0, player.invulnerableTicks - 1);
    const accelerationScale = next.variant === "snow-bash" ? N.accelerationScale : 1;
    player.vx += input.x * C.moveSpeed * accelerationScale * dt;
    player.vy += input.y * C.moveSpeed * accelerationScale * dt;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > C.maxSpeed) { player.vx *= C.maxSpeed / speed; player.vy *= C.maxSpeed / speed; }
    const action = freshInput ? input.action : "none";
    if (player.carriedFuseTicks !== null) player.carriedFuseTicks--;
    if (action === "jump" && player.jumpTicks === 0) {
      player.jumpTicks = Math.ceil(C.jumpDurationSeconds / dt);
    } else if (action === "attack" && player.attackCooldownTicks === 0) {
      player.attackCooldownTicks = Math.ceil(C.attackCooldownSeconds / dt);
      for (const [otherId, other] of Object.entries(next.players)) {
        if (otherId === id || other.eliminated || other.invulnerableTicks > 0) continue;
        const dx = other.x - player.x, dy = other.y - player.y, distance = Math.hypot(dx, dy);
        if (distance > C.attackRange || distance === 0 || (dx * player.facingX + dy * player.facingY) / distance < 0.15) continue;
        other.vx += player.facingX * C.attackImpulse; other.vy += player.facingY * C.attackImpulse;
      }
    } else if (action === "pickup" && !player.carriedCrate && next.crate && Math.hypot(player.x - next.crate.x, player.y - next.crate.y) <= C.pickupRange) {
      player.carriedCrate = true; player.carriedCrateKind = next.crate.kind;
      player.carriedFuseTicks = next.crate.kind === "tnt" ? (next.variant === "space-bash" ? S.tntFuseTicks : Math.ceil(C.tntFuseSeconds / dt)) : null;
      next.crate = null;
    } else if (action === "throw" && player.carriedCrate) {
      next.projectiles.push({ ownerId: id, kind: player.carriedCrateKind ?? "steel", fuseTicks: player.carriedFuseTicks, x: player.x, y: player.y, vx: player.facingX * C.throwSpeed,
        vy: player.facingY * C.throwSpeed, age: 0 });
      player.carriedCrate = false; player.carriedCrateKind = null; player.carriedFuseTicks = null;
    }
    if (player.carriedCrate && player.carriedFuseTicks !== null && player.carriedFuseTicks <= 0) {
      explodeAt(next, player.x, player.y, player.facingX, player.facingY, player.carriedCrateKind ?? "tnt");
      player.carriedCrate = false; player.carriedCrateKind = null; player.carriedFuseTicks = null;
      if (!next.crate) next.crate = respawnCrate(next.seed, next.tick, next.variant, next.floor);
    }
  }
  for (const p of Object.values(next.players)) {
    if (p.eliminated) continue;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const damping = next.variant === "snow-bash" ? N.momentumDamping : C.knockbackDamping;
    p.vx *= damping; p.vy *= damping;
    if (next.floor) {
      const tileIndex = tileIndexAt(next.floor, p.x, p.y);
      if (tileIndex === null || (next.floor.tiles[tileIndex]?.state === "destroyed" && !(next.gapJumping && p.jumpTicks > 0))) {
        p.eliminated = true; p.health = 0; p.carriedCrate = false; p.carriedCrateKind = null; p.carriedFuseTicks = null;
      }
    } else {
      const radius = Math.hypot(p.x, p.y);
      if (radius > C.arenaRadius) { p.x *= C.arenaRadius / radius; p.y *= C.arenaRadius / radius; p.vx *= -0.5; p.vy *= -0.5; }
    }
  }
  const living = Object.entries(next.players).filter(([, p]) => !p.eliminated);
  for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
    const a = living[i][1], b = living[j][1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= C.playerRadius * 2 || d === 0) continue;
    const nx = dx / d, ny = dy / d, overlap = C.playerRadius * 2 - d;
    a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2;
    a.vx -= nx * C.bumpImpulse; a.vy -= ny * C.bumpImpulse; b.vx += nx * C.bumpImpulse; b.vy += ny * C.bumpImpulse;
  }
  if (next.variant === "snow-bash") stepSnowPenguin(next);
  if (next.healingFruit) {
    for (const player of Object.values(next.players)) {
      if (player.eliminated || player.health >= C.health || Math.hypot(player.x - next.healingFruit.x, player.y - next.healingFruit.y) > C.playerRadius + 0.2) continue;
      player.health = Math.min(C.health, player.health + C.healingAmount);
      next.healingFruit = null;
      next.healingFruitReadyAtTick = next.tick + Math.ceil(C.healingFruitRespawnSeconds / dt);
      break;
    }
  } else if (next.tick >= next.healingFruitReadyAtTick) {
    const angle = random(next.seed ^ Math.imul(next.tick + 41, 0x165667b1)) * Math.PI * 2;
    const radius = random(next.seed ^ Math.imul(next.tick + 53, 0x9e3779b9)) * C.arenaRadius * 0.55;
    next.healingFruit = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }
  if (next.crate?.kind === "nitro") {
    const toucher = Object.values(next.players).find((player) => !player.eliminated && !player.carriedCrate && Math.hypot(player.x - next.crate!.x, player.y - next.crate!.y) <= C.playerRadius + C.crateRadius * 0.65);
    if (toucher) { explodeAt(next, next.crate.x, next.crate.y, toucher.vx, toucher.vy, "nitro"); next.crate = null; }
  }
  const remainingProjectiles: JungleBashProjectile[] = [];
  for (const shot of next.projectiles) {
    shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.age += dt;
    if (shot.fuseTicks !== null) shot.fuseTicks--;
    let hit = false;
    for (const [id, player] of Object.entries(next.players)) {
      if (id === shot.ownerId || player.eliminated) continue;
      if (Math.hypot(player.x - shot.x, player.y - shot.y) <= C.playerRadius + C.crateRadius) {
        if (shot.kind === "steel") damagePlayer(player, C.throwDamage, shot.vx * 0.35, shot.vy * 0.35);
        else explodeAt(next, shot.x, shot.y, shot.vx, shot.vy, shot.kind);
        hit = true;
        break;
      }
    }
    const fuseExpired = shot.fuseTicks !== null && shot.fuseTicks <= 0;
    if (fuseExpired && !hit) explodeAt(next, shot.x, shot.y, shot.vx, shot.vy, shot.kind);
    if (hit || fuseExpired || shot.age >= C.throwLifetimeSeconds || Math.hypot(shot.x, shot.y) >= C.arenaRadius) {
      if (!next.crate) next.crate = respawnCrate(next.seed, next.tick, next.variant, next.floor);
    } else remainingProjectiles.push(shot);
  }
  next.projectiles = remainingProjectiles;
  if (!next.crate && next.projectiles.length === 0 && !Object.values(next.players).some((player) => player.carriedCrate))
    next.crate = respawnCrate(next.seed, next.tick, next.variant, next.floor);
  if (next.floor) stepDestructibleFloor(next.floor);
  next.tick++;
  const survivors = Object.entries(next.players).filter(([, p]) => !p.eliminated);
  const solo = Object.keys(next.players).length === 1;
  if (survivors.length === 0 || (!solo && survivors.length === 1)) { next.finished = true; next.winnerId = survivors[0]?.[0] ?? null; }
  else if (next.tick >= C.roundDurationSeconds / dt) {
    if (solo) { next.finished = true; next.winnerId = survivors[0]?.[0] ?? null; return next; }
    const ranked = survivors.sort((a, b) => b[1].health - a[1].health);
    const first = ranked[0]!;
    const second = ranked[1]!;
    next.finished = true;
    next.winnerId = first[1].health === second[1].health ? null : first[0];
  }
  return next;
}
