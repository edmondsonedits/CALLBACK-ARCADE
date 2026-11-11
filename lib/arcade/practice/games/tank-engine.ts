import { TANK_ENGINE_BASE as B } from "./tank-engine-config";
import { JUNGLE_FOX_CONFIG as J } from "./jungle-fox-config";
import { METAL_FOX_CONFIG as M } from "./metal-fox-config";
import type { ArcadeInput } from "./types";

export type TankGameId = "jungle-fox" | "metal-fox";
export type TankPickupKind = "health" | "mine" | "missile" | "mortar";
export type TankProjectileKind = "shell" | "missile" | "mortar";
export interface TankPlayer {
  x: number; y: number; vx: number; vy: number; heading: number; health: number; alive: boolean;
  invulnerableTicks: number; mines: number; missileVolleys: number; mortarRounds: number;
  fireCooldownTicks: number; mineCooldownTicks: number; lastInputSequence: number; hits: number; shots: number;
}
export interface TankProjectile {
  id: number; ownerId: string; kind: TankProjectileKind; x: number; y: number; vx: number; vy: number;
  radius: number; damage: number; blastRadius: number; lifetimeTicks: number; age: number;
}
export interface TankPickup { id: number; kind: TankPickupKind; x: number; y: number; lifetimeTicks: number }
export interface TankMine { id: number; ownerId: string; x: number; y: number; fuseTicks: number }
export interface MetalWall { id: number; x: number; y: number; phase: "warning" | "active" | "retracting"; ticksRemaining: number }
export interface TotemHazard { phase: "idle" | "warning" | "strike" | "recover"; x: number; y: number; ticksRemaining: number; nextWarningTick: number; strikeIndex: number }
export interface TankEngineState {
  gameId: TankGameId; seed: number; tick: number; remainingTicks: number; nextObjectId: number;
  nextPickupTick: number; nextWallWaveTick: number; players: Record<string, TankPlayer>;
  projectiles: TankProjectile[]; pickups: TankPickup[]; mines: TankMine[]; walls: MetalWall[];
  hazard: TotemHazard | null; finished: boolean; winnerId: string | null; winners: string[]; draw: boolean;
}

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const wrapAngle = (n: number): number => Math.atan2(Math.sin(n), Math.cos(n));

function randomWord(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b9)) | 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return x >>> 0;
}

function spawnPoints(count: number): Array<[number, number]> {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, count);
    return [Math.cos(angle) * 5.6, Math.sin(angle) * 5.6];
  });
}

export function createTankEngineState(playerIds: readonly string[], seed: number, gameId: TankGameId): TankEngineState {
  const ids = [...new Set(playerIds)].sort().slice(0, B.maxPlayers);
  const positions = spawnPoints(ids.length);
  const players: Record<string, TankPlayer> = {};
  ids.forEach((id, index) => {
    const [x, y] = positions[index]!;
    const heading = Math.atan2(-y, -x);
    players[id] = { x, y, vx: 0, vy: 0, heading, health: B.maxHealth, alive: true, invulnerableTicks: 0,
      mines: 3, missileVolleys: 0, mortarRounds: 0, fireCooldownTicks: 0, mineCooldownTicks: 0,
      lastInputSequence: -1, hits: 0, shots: 0 };
  });
  const jungle = gameId === "jungle-fox";
  return {
    gameId, seed: seed | 0, tick: 0, remainingTicks: B.roundDurationTicks, nextObjectId: 1,
    nextPickupTick: jungle ? J.pickupFirstTick : M.pickupFirstTick,
    nextWallWaveTick: jungle ? Number.MAX_SAFE_INTEGER : M.wallWaveIntervalTicks,
    players, projectiles: [], pickups: [], mines: [], walls: [],
    hazard: jungle ? { phase: "idle", x: 0, y: 0, ticksRemaining: 0, nextWarningTick: J.hazardFirstWarningTick, strikeIndex: 0 } : null,
    finished: false, winnerId: null, winners: [], draw: false,
  };
}

function damageTank(player: TankPlayer, damage: number): void {
  if (!player.alive || player.invulnerableTicks > 0) return;
  player.health = Math.max(0, player.health - damage);
  player.invulnerableTicks = B.playerHitInvulnerabilityTicks;
  player.hits++;
  if (player.health === 0) player.alive = false;
}

function nearestWall(state: TankEngineState, x: number, y: number): MetalWall | undefined {
  if (state.gameId !== "metal-fox") return undefined;
  const half = M.wallHalfExtent;
  return state.walls.find((wall) => wall.phase === "active" && Math.abs(x - wall.x) <= half && Math.abs(y - wall.y) <= half);
}

function plantMine(state: TankEngineState, id: string, tank: TankPlayer): void {
  if (tank.mines <= 0 || tank.mineCooldownTicks > 0) return;
  const c = Math.cos(tank.heading), s = Math.sin(tank.heading);
  state.mines.push({ id: state.nextObjectId++, ownerId: id, x: tank.x - c * 0.76, y: tank.y - s * 0.76, fuseTicks: B.mineFuseTicks });
  tank.mines--; tank.mineCooldownTicks = state.gameId === "jungle-fox" ? J.mineCooldownTicks : M.mineCooldownTicks;
}

function fire(state: TankEngineState, id: string, tank: TankPlayer): void {
  const jungle = state.gameId === "jungle-fox";
  const cfg = jungle ? J : M;
  if (tank.fireCooldownTicks > 0) return;
  let kind: TankProjectileKind = "shell";
  let damage: number = B.normalShotDamage, speed: number = cfg.shellSpeed;
  let radius: number = B.shotRadius, blastRadius = 0;
  if (jungle && tank.missileVolleys > 0) {
    kind = "missile"; damage = J.missileDamage; speed = J.missileSpeed; radius = 0.22; blastRadius = J.missileBlastRadius;
    tank.missileVolleys--;
  } else if (!jungle && tank.mortarRounds > 0) {
    kind = "mortar"; damage = M.mortarDamage; speed = cfg.shellSpeed; radius = 0.24; blastRadius = M.mortarBlastRadius;
    tank.mortarRounds--;
  }
  const angles = kind === "missile" ? [-0.09, 0.09] : [0];
  for (const offset of angles) {
    const angle = tank.heading + offset, c = Math.cos(angle), s = Math.sin(angle);
    state.projectiles.push({ id: state.nextObjectId++, ownerId: id, kind, x: tank.x + c * (B.tankRadius + 0.16),
      y: tank.y + s * (B.tankRadius + 0.16), vx: c * speed, vy: s * speed, radius, damage, blastRadius,
      lifetimeTicks: kind === "mortar" ? M.mortarFlightTicks : 72, age: 0 });
  }
  tank.shots++;
  tank.fireCooldownTicks = kind === "missile" ? J.missileCooldownTicks : cfg.shellCooldownTicks;
}

function advanceTank(state: TankEngineState, id: string, tank: TankPlayer, input: ArcadeInput | undefined): void {
  const cfg = state.gameId === "jungle-fox" ? J : M;
  tank.invulnerableTicks = Math.max(0, tank.invulnerableTicks - 1);
  tank.fireCooldownTicks = Math.max(0, tank.fireCooldownTicks - 1);
  tank.mineCooldownTicks = Math.max(0, tank.mineCooldownTicks - 1);
  let throttle = 0;
  const validInput = input && Number.isSafeInteger(input.sequence) && input.sequence >= tank.lastInputSequence;
  const freshInput = validInput && input.sequence > tank.lastInputSequence;
  if (validInput) {
    const ix = clamp(input.x, -1, 1), iy = clamp(input.y, -1, 1);
    throttle = Math.min(1, Math.hypot(ix, iy));
    if (throttle > 0.1) {
      const wanted = Math.atan2(iy, ix), diff = wrapAngle(wanted - tank.heading);
      tank.heading += clamp(diff, -cfg.turnRateRadiansPerSecond * B.fixedStepSeconds, cfg.turnRateRadiansPerSecond * B.fixedStepSeconds);
    }
    if (freshInput) {
      tank.lastInputSequence = input.sequence;
      if (input.action === "attack") fire(state, id, tank);
      else if (input.action === "special") plantMine(state, id, tank);
    }
  }
  tank.vx += Math.cos(tank.heading) * cfg.acceleration * throttle * B.fixedStepSeconds;
  tank.vy += Math.sin(tank.heading) * cfg.acceleration * throttle * B.fixedStepSeconds;
  const speed = Math.hypot(tank.vx, tank.vy);
  if (speed > cfg.maxSpeed) { tank.vx *= cfg.maxSpeed / speed; tank.vy *= cfg.maxSpeed / speed; }
  let nx = clamp(tank.x + tank.vx * B.fixedStepSeconds, -B.arenaHalfExtent + B.tankRadius, B.arenaHalfExtent - B.tankRadius);
  let ny = clamp(tank.y + tank.vy * B.fixedStepSeconds, -B.arenaHalfExtent + B.tankRadius, B.arenaHalfExtent - B.tankRadius);
  const wall = nearestWall(state, nx, ny);
  if (wall) {
    if (Math.abs(tank.x - wall.x) > Math.abs(tank.y - wall.y)) nx = tank.x;
    else ny = tank.y;
    tank.vx *= -0.25; tank.vy *= -0.25;
  }
  tank.x = nx; tank.y = ny;
  tank.vx *= cfg.drag; tank.vy *= cfg.drag;
}

function explode(state: TankEngineState, x: number, y: number, damage: number, radius: number): void {
  for (const tank of Object.values(state.players)) {
    if (!tank.alive) continue;
    const distance = Math.hypot(tank.x - x, tank.y - y);
    if (distance <= radius) damageTank(tank, Math.max(1, Math.round(damage * Math.max(0.35, 1 - distance / (radius * 1.25)))));
  }
}

function stepProjectiles(state: TankEngineState): void {
  const survivors: TankProjectile[] = [];
  for (const shot of state.projectiles) {
    shot.age++;
    shot.x += shot.vx * B.fixedStepSeconds; shot.y += shot.vy * B.fixedStepSeconds;
    if (Math.abs(shot.x) > B.arenaHalfExtent || Math.abs(shot.y) > B.arenaHalfExtent || shot.age >= shot.lifetimeTicks) {
      if (shot.kind === "mortar" && shot.age >= shot.lifetimeTicks) explode(state, shot.x, shot.y, shot.damage, shot.blastRadius);
      continue;
    }
    if (shot.kind !== "mortar" && nearestWall(state, shot.x, shot.y)) continue;
    let hitTank = false;
    for (const [id, tank] of Object.entries(state.players)) {
      if (id === shot.ownerId || !tank.alive || Math.hypot(tank.x - shot.x, tank.y - shot.y) > B.tankRadius + shot.radius) continue;
      if (shot.blastRadius > 0) explode(state, shot.x, shot.y, shot.damage, shot.blastRadius);
      else damageTank(tank, shot.damage);
      hitTank = true; break;
    }
    if (!hitTank) survivors.push(shot);
  }
  state.projectiles = survivors;
}

function seededPosition(state: TankEngineState, index: number): [number, number] {
  const x = (randomWord(state.seed, index * 2) / 0xffffffff) * 11 - 5.5;
  const y = (randomWord(state.seed, index * 2 + 1) / 0xffffffff) * 11 - 5.5;
  return [x, y];
}

function spawnPickups(state: TankEngineState): void {
  const cfg = state.gameId === "jungle-fox" ? J : M;
  if (state.tick < state.nextPickupTick) return;
  state.nextPickupTick = state.tick + cfg.pickupIntervalMinTicks + randomWord(state.seed, state.tick) % cfg.pickupIntervalRangeTicks;
  if (state.pickups.length >= B.maximumPickups) return;
  const kinds = cfg.pickupTypes;
  const kind = kinds[randomWord(state.seed, state.tick + 1) % kinds.length]! as TankPickupKind;
  const [x, y] = seededPosition(state, state.tick + 37);
  const valid = !state.walls.some((wall) => wall.phase === "active" && Math.abs(wall.x - x) < M.wallHalfExtent + 0.5 && Math.abs(wall.y - y) < M.wallHalfExtent + 0.5);
  if (valid) state.pickups.push({ id: state.nextObjectId++, kind, x, y, lifetimeTicks: B.pickupLifetimeTicks });
}

function stepPickups(state: TankEngineState): void {
  const remain: TankPickup[] = [];
  for (const pickup of state.pickups) {
    pickup.lifetimeTicks--;
    const collector = Object.values(state.players).find((tank) => tank.alive && Math.hypot(tank.x - pickup.x, tank.y - pickup.y) <= 0.68);
    if (collector) {
      if (pickup.kind === "health") collector.health = Math.min(B.maxHealth, collector.health + 20);
      else if (pickup.kind === "mine") collector.mines = Math.min(B.maximumMines, collector.mines + 1);
      else if (pickup.kind === "missile") collector.missileVolleys = Math.min(4, collector.missileVolleys + (state.gameId === "jungle-fox" ? 2 : 0));
      else if (pickup.kind === "mortar") collector.mortarRounds = Math.min(4, collector.mortarRounds + (state.gameId === "metal-fox" ? 2 : 0));
      continue;
    }
    if (pickup.lifetimeTicks > 0) remain.push(pickup);
  }
  state.pickups = remain;
}

function stepMines(state: TankEngineState): void {
  const remain: TankMine[] = [];
  for (const mine of state.mines) {
    mine.fuseTicks--;
    if (mine.fuseTicks <= 0) explode(state, mine.x, mine.y, B.mineDamage, B.mineRadius);
    else remain.push(mine);
  }
  state.mines = remain;
}

function advanceTotem(state: TankEngineState): void {
  const hazard = state.hazard;
  if (!hazard) return;
  if (hazard.phase === "idle" && state.tick >= hazard.nextWarningTick) {
    const index = hazard.strikeIndex;
    const angle = index === 0 ? 0 : ((index - 1) % 16) * Math.PI / 8;
    const radius = index === 0 ? 0 : J.hazardTravelRadius;
    hazard.x = Math.cos(angle) * radius; hazard.y = Math.sin(angle) * radius;
    hazard.phase = "warning"; hazard.ticksRemaining = J.hazardWarningTicks;
  } else if (hazard.phase === "warning") {
    hazard.ticksRemaining--;
    if (hazard.ticksRemaining <= 0) {
      hazard.phase = "strike"; hazard.ticksRemaining = 1;
      for (const tank of Object.values(state.players)) {
        if (tank.alive && Math.hypot(tank.x - hazard.x, tank.y - hazard.y) <= J.hazardRadius) damageTank(tank, J.hazardDamage);
      }
    }
  } else if (hazard.phase === "strike") {
    hazard.phase = "recover"; hazard.ticksRemaining = J.hazardRecoverTicks;
    hazard.strikeIndex++;
  } else if (hazard.phase === "recover") {
    hazard.ticksRemaining--;
    if (hazard.ticksRemaining <= 0) {
      hazard.phase = "idle"; hazard.nextWarningTick = state.tick + J.hazardIntervalTicks;
    }
  }
}

const WALL_CELLS: ReadonlyArray<readonly [number, number]> = [
  [-4, -4], [-2, -4], [0, -4], [2, -4], [4, -4],
  [-4, -2], [-2, -2], [0, -2], [2, -2], [4, -2],
  [-4, 0], [-2, 0], [2, 0], [4, 0],
  [-4, 2], [-2, 2], [0, 2], [2, 2], [4, 2],
  [-4, 4], [-2, 4], [0, 4], [2, 4], [4, 4],
];

function stepWalls(state: TankEngineState): void {
  if (state.gameId !== "metal-fox") return;
  const kept: MetalWall[] = [];
  for (const wall of state.walls) {
    wall.ticksRemaining--;
    if (wall.ticksRemaining <= 0) {
      if (wall.phase === "warning") { wall.phase = "active"; wall.ticksRemaining = M.wallActiveTicks; }
      else if (wall.phase === "active") { wall.phase = "retracting"; wall.ticksRemaining = M.wallRetractTicks; }
      else continue;
    }
    kept.push(wall);
  }
  state.walls = kept;
  if (state.tick < state.nextWallWaveTick) return;
  const candidates = WALL_CELLS.slice(randomWord(state.seed, state.tick) % WALL_CELLS.length);
  let added = 0;
  for (const [x, y] of [...candidates, ...WALL_CELLS]) {
    if (added >= M.wallWaveCount) break;
    if (state.walls.some((wall) => Math.hypot(wall.x - x, wall.y - y) < 1.5)) continue;
    if (Object.values(state.players).some((tank) => Math.hypot(tank.x - x, tank.y - y) < 1.25)) continue;
    state.walls.push({ id: state.nextObjectId++, x, y, phase: "warning", ticksRemaining: M.wallWarningTicks });
    added++;
  }
  state.nextWallWaveTick = state.tick + M.wallWaveIntervalTicks;
}

function resolveTankBumps(state: TankEngineState): void {
  const tanks = Object.values(state.players).filter((tank) => tank.alive);
  for (let i = 0; i < tanks.length; i++) for (let j = i + 1; j < tanks.length; j++) {
    const a = tanks[i]!, b = tanks[j]!, dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    if (distance < 1e-5 || distance >= B.tankRadius * 2) continue;
    const nx = dx / distance, ny = dy / distance, overlap = B.tankRadius * 2 - distance;
    a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5; b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
  }
}

function finishIfNeeded(state: TankEngineState): void {
  const alive = Object.entries(state.players).filter(([, tank]) => tank.alive);
  const solo = Object.keys(state.players).length === 1;
  if (solo && alive.length === 1 && state.remainingTicks > 0) return;
  if (solo && alive.length === 0) { state.winners = []; state.winnerId = null; state.draw = false; state.finished = true; return; }
  if (alive.length > 1 && state.remainingTicks > 0) return;
  if (alive.length === 1 && state.remainingTicks > 0) state.winners = [alive[0]![0]];
  else {
    const score = Math.max(-1, ...Object.values(state.players).map((tank) => tank.health));
    state.winners = Object.entries(state.players).filter(([, tank]) => tank.health === score).map(([id]) => id).sort();
  }
  state.winnerId = state.winners.length === 1 ? state.winners[0]! : null;
  state.draw = state.winnerId === null;
  state.finished = true;
}

export function stepTankEngine(state: TankEngineState, inputs: Readonly<Record<string, ArcadeInput>>, expectedGameId: TankGameId = state.gameId): TankEngineState {
  if (state.finished) return structuredClone(state);
  if (state.gameId !== expectedGameId) throw new Error(`Tank engine variant mismatch: ${state.gameId} != ${expectedGameId}`);
  const next = structuredClone(state);
  next.tick++; next.remainingTicks = Math.max(0, next.remainingTicks - 1);
  stepWalls(next);
  advanceTotem(next);
  for (const [id, tank] of Object.entries(next.players)) if (tank.alive) advanceTank(next, id, tank, inputs[id]);
  resolveTankBumps(next);
  stepProjectiles(next);
  stepMines(next);
  spawnPickups(next);
  stepPickups(next);
  finishIfNeeded(next);
  return next;
}

export function tankSnapshot(state: TankEngineState): unknown {
  return {
    gameId: state.gameId, tick: state.tick, remainingTicks: state.remainingTicks,
    players: Object.fromEntries(Object.entries(state.players).map(([id, tank]) => [id, {
      x: tank.x, y: tank.y, vx: tank.vx, vy: tank.vy, heading: tank.heading, health: tank.health, alive: tank.alive,
      invulnerableTicks: tank.invulnerableTicks, mines: tank.mines, missileVolleys: tank.missileVolleys,
      mortarRounds: tank.mortarRounds, hits: tank.hits, shots: tank.shots,
    }])),
    projectiles: state.projectiles.map(({ id, ownerId, kind, x, y, vx, vy, age }) => ({ id, ownerId, kind, x, y, vx, vy, age })),
    pickups: state.pickups.map(({ id, kind, x, y, lifetimeTicks }) => ({ id, kind, x, y, lifetimeTicks })),
    mines: state.mines.map(({ id, ownerId, x, y, fuseTicks }) => ({ id, ownerId, x, y, fuseTicks })),
    walls: state.walls.map((wall) => ({ ...wall })),
    hazard: state.hazard ? { ...state.hazard } : null,
    finished: state.finished, winnerId: state.winnerId, winners: [...state.winners], draw: state.draw,
  };
}

export function tankResult(state: TankEngineState): unknown | null {
  return state.finished ? {
    winnerId: state.winnerId, winners: [...state.winners], draw: state.draw,
    scores: Object.fromEntries(Object.entries(state.players).map(([id, tank]) => [id, tank.health])),
  } : null;
}
