// lib/arcade/practice/games/drain-bash-config.ts
var DRAIN_BASH_CONFIG = {
  fixedStepSeconds: 1 / 30,
  roundDurationSeconds: 90,
  mysteryRespawnSeconds: 7,
  mysteryWeaponWeights: { homing: 0.3, burst: 0.27, sonic: 0.23, heal: 0.2 },
  homingAmmo: 3,
  burstAmmo: 2,
  sonicAmmo: 1,
  healingAmount: 1,
  homingSpeed: 6.5,
  homingTurnRadiansPerSecond: 2.2,
  homingLifetimeSeconds: 3,
  burstSpeed: 7,
  burstLifetimeSeconds: 1.5,
  projectileRadius: 0.22,
  projectileDamage: 1,
  projectileKnockback: 2.8,
  sonicRadius: 4.2,
  sonicWaveSpeed: 11,
  sonicWaveThickness: 0.45,
  sonicDamage: 1,
  sonicKnockback: 3.2
};

// lib/arcade/practice/games/jungle-bash-config.ts
var JUNGLE_BASH_CONFIG = {
  fixedStepSeconds: 1 / 30,
  roundDurationSeconds: 90,
  arenaRadius: 10,
  playerRadius: 0.55,
  moveSpeed: 4.2,
  maxSpeed: 5.8,
  bumpImpulse: 2.1,
  knockbackDamping: 0.985,
  health: 3,
  crateRadius: 0.5,
  pickupRange: 1.25,
  throwSpeed: 9,
  throwLifetimeSeconds: 1.5,
  throwDamage: 1,
  blastRadius: 3.2,
  blastDamage: 2,
  blastImpulse: 5.2,
  tntFuseSeconds: 3,
  healingAmount: 1,
  healingFruitRespawnSeconds: 8,
  jumpDurationSeconds: 0.62,
  attackRange: 1.35,
  attackImpulse: 3.8,
  attackCooldownSeconds: 0.55,
  hitInvulnerabilitySeconds: 1.35,
  inputAxisLimit: 1
};

// lib/arcade/practice/games/space-bash-config.ts
var SPACE_BASH_CONFIG = {
  floorSize: 8,
  floorHalfExtent: 8,
  floorWarningTicks: 24,
  tntFuseTicks: 90,
  tntBagRatio: 0.875,
  roundDurationSeconds: 90
};

// lib/arcade/practice/games/snow-bash-config.ts
var SNOW_BASH_CONFIG = {
  accelerationScale: 0.74,
  momentumDamping: 0.994,
  wakeRadius: 1.15,
  warningTicks: 30,
  activeTicks: 210,
  returnTicks: 60,
  hazardSpeed: 2.8,
  contactRadius: 0.88,
  contactDamage: 1,
  knockbackImpulse: 3.4
};

// lib/arcade/practice/games/destructible-floor.ts
function createDestructibleFloor(size, halfExtent, warningTicks) {
  if (!Number.isInteger(size) || size < 1 || size > 32) throw new RangeError("Floor size must be an integer from 1 to 32.");
  if (!Number.isFinite(halfExtent) || halfExtent <= 0) throw new RangeError("Floor half extent must be positive.");
  if (!Number.isInteger(warningTicks) || warningTicks < 2) throw new RangeError("Floor warning must last at least two ticks.");
  return { size, halfExtent, warningTicks, tiles: Array.from({ length: size * size }, () => ({ state: "safe", ticksRemaining: 0 })) };
}
function tileIndexAt(floor, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < -floor.halfExtent || y < -floor.halfExtent || x >= floor.halfExtent || y >= floor.halfExtent) return null;
  const tileSize = floor.halfExtent * 2 / floor.size;
  const column = Math.floor((x + floor.halfExtent) / tileSize);
  const row = Math.floor((y + floor.halfExtent) / tileSize);
  return row * floor.size + column;
}
function markFloorTile(floor, x, y) {
  const index = tileIndexAt(floor, x, y);
  if (index === null) return false;
  const tile = floor.tiles[index];
  if (!tile || tile.state === "destroyed") return false;
  if (tile.state === "safe") {
    tile.state = "damaged";
    tile.ticksRemaining = floor.warningTicks;
  }
  return true;
}
function stepDestructibleFloor(floor) {
  for (const tile of floor.tiles) {
    if (tile.state === "safe" || tile.state === "destroyed") continue;
    tile.ticksRemaining = Math.max(0, tile.ticksRemaining - 1);
    if (tile.ticksRemaining === 0) tile.state = "destroyed";
    else if (tile.ticksRemaining <= Math.ceil(floor.warningTicks * 2 / 3)) tile.state = "cracking";
  }
  return floor;
}

// lib/arcade/practice/games/jungle-bash-simulation.ts
function random(seed) {
  let n = (seed | 0) + 1831565813;
  n = Math.imul(n ^ n >>> 15, n | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
}
function respawnCrate(seed, tick, variant, floor) {
  const angle = random(seed ^ Math.imul(tick + 1, 73244475)) * Math.PI * 2;
  const radius = random(seed ^ Math.imul(tick + 17, 295559667)) * JUNGLE_BASH_CONFIG.arenaRadius * 0.45;
  const roll = random(seed ^ Math.imul(tick + 31, 668265261));
  const kind = variant === "space-bash" ? roll < SPACE_BASH_CONFIG.tntBagRatio ? "tnt" : "nitro" : roll < 0.58 ? "steel" : roll < 0.82 ? "tnt" : "nitro";
  let x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
  if (floor) {
    const preferred = tileIndexAt(floor, x, y);
    if (preferred === null || floor.tiles[preferred]?.state !== "safe") {
      const start = Math.floor(random(seed ^ Math.imul(tick + 59, 374761393)) * floor.tiles.length);
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
function damagePlayer(player, damage2, vx, vy) {
  if (player.eliminated || player.invulnerableTicks > 0 || player.jumpTicks > 0) return;
  player.health = Math.max(0, player.health - damage2);
  player.invulnerableTicks = Math.ceil(JUNGLE_BASH_CONFIG.hitInvulnerabilitySeconds / JUNGLE_BASH_CONFIG.fixedStepSeconds);
  player.vx += vx;
  player.vy += vy;
  if (player.health === 0) {
    player.eliminated = true;
    player.carriedCrate = false;
    player.carriedCrateKind = null;
    player.carriedFuseTicks = null;
  }
}
function explodeAt(state, x, y, ownerVx, ownerVy, kind) {
  const scale = typeof state.hazardScale === "number" && Number.isFinite(state.hazardScale) ? Math.max(0.5, Math.min(1.5, state.hazardScale)) : 1;
  const blastRadius = JUNGLE_BASH_CONFIG.blastRadius * scale;
  if (state.floor && kind !== "steel") markFloorTile(state.floor, x, y);
  for (const player of Object.values(state.players)) {
    if (player.eliminated || player.invulnerableTicks > 0 || player.jumpTicks > 0) continue;
    const dx = player.x - x, dy = player.y - y, distance = Math.hypot(dx, dy);
    if (distance > blastRadius) continue;
    const falloff = Math.max(0.35, 1 - distance / (blastRadius * 1.35));
    const nx = distance > 1e-3 ? dx / distance : ownerVx ? Math.sign(ownerVx) : 1;
    const ny = distance > 1e-3 ? dy / distance : ownerVy ? Math.sign(ownerVy) : 0;
    damagePlayer(player, JUNGLE_BASH_CONFIG.blastDamage, nx * JUNGLE_BASH_CONFIG.blastImpulse * scale * falloff, ny * JUNGLE_BASH_CONFIG.blastImpulse * scale * falloff);
  }
}
function stepSnowPenguin(state) {
  const penguin = state.penguin;
  if (!penguin) return;
  if (penguin.state === "sleep") {
    const activated = Object.values(state.players).some((player) => !player.eliminated && Math.hypot(player.x - penguin.x, player.y - penguin.y) <= SNOW_BASH_CONFIG.wakeRadius);
    if (activated) {
      penguin.state = "warning";
      penguin.ticksRemaining = SNOW_BASH_CONFIG.warningTicks;
    }
  } else if (penguin.state === "warning") {
    penguin.ticksRemaining--;
    if (penguin.ticksRemaining <= 0) {
      penguin.state = "active";
      penguin.ticksRemaining = SNOW_BASH_CONFIG.activeTicks;
    }
  } else if (penguin.state === "active") {
    penguin.ticksRemaining--;
    const target = Object.values(state.players).filter((player) => !player.eliminated).sort((a, b) => Math.hypot(a.x - penguin.x, a.y - penguin.y) - Math.hypot(b.x - penguin.x, b.y - penguin.y))[0];
    if (target) {
      const dx = target.x - penguin.x, dy = target.y - penguin.y, distance = Math.hypot(dx, dy);
      if (distance > 0) {
        const travel = Math.min(distance, SNOW_BASH_CONFIG.hazardSpeed * JUNGLE_BASH_CONFIG.fixedStepSeconds);
        penguin.x += dx / distance * travel;
        penguin.y += dy / distance * travel;
      }
      if (distance <= SNOW_BASH_CONFIG.contactRadius + SNOW_BASH_CONFIG.hazardSpeed * JUNGLE_BASH_CONFIG.fixedStepSeconds) {
        const direction = Math.hypot(dx, dy) > 0 ? Math.hypot(dx, dy) : 1;
        damagePlayer(target, SNOW_BASH_CONFIG.contactDamage, dx / direction * SNOW_BASH_CONFIG.knockbackImpulse, dy / direction * SNOW_BASH_CONFIG.knockbackImpulse);
        penguin.state = "return";
        penguin.ticksRemaining = SNOW_BASH_CONFIG.returnTicks;
        return;
      }
    }
    if (penguin.ticksRemaining <= 0) {
      penguin.state = "return";
      penguin.ticksRemaining = SNOW_BASH_CONFIG.returnTicks;
    }
  } else {
    penguin.ticksRemaining--;
    penguin.x *= 0.88;
    penguin.y *= 0.88;
    if (penguin.ticksRemaining <= 0) {
      penguin.x = 0;
      penguin.y = 0;
      penguin.state = "sleep";
      penguin.ticksRemaining = 0;
    }
  }
}
function createJungleBashState(playerIds, seed, variant = "jungle-bash") {
  const ids = [...new Set(playerIds)].sort();
  const players = {};
  ids.forEach((id, index) => {
    const angle = 2 * Math.PI * index / Math.max(1, ids.length);
    players[id] = {
      x: Math.cos(angle) * 4,
      y: Math.sin(angle) * 4,
      vx: 0,
      vy: 0,
      health: JUNGLE_BASH_CONFIG.health,
      eliminated: false,
      lastInputSequence: -1,
      facingX: Math.cos(angle + Math.PI),
      facingY: Math.sin(angle + Math.PI),
      carriedCrate: false,
      jumpTicks: 0,
      attackCooldownTicks: 0,
      invulnerableTicks: 0,
      carriedCrateKind: null,
      carriedFuseTicks: null
    };
  });
  const crateAngle = random(seed) * 2 * Math.PI;
  const fruitAngle = random(seed ^ 1923960625) * 2 * Math.PI;
  const initialCrateKind = variant === "space-bash" ? random(seed ^ 466688986) < SPACE_BASH_CONFIG.tntBagRatio ? "tnt" : "nitro" : "steel";
  return {
    seed: seed | 0,
    tick: 0,
    variant,
    floor: variant === "space-bash" ? createDestructibleFloor(SPACE_BASH_CONFIG.floorSize, SPACE_BASH_CONFIG.floorHalfExtent, SPACE_BASH_CONFIG.floorWarningTicks) : null,
    penguin: variant === "snow-bash" ? { x: 0, y: 0, state: "sleep", ticksRemaining: 0 } : null,
    players,
    crate: { x: Math.cos(crateAngle) * 1.5, y: Math.sin(crateAngle) * 1.5, kind: initialCrateKind },
    healingFruit: { x: Math.cos(fruitAngle) * 2.6, y: Math.sin(fruitAngle) * 2.6 },
    healingFruitReadyAtTick: 0,
    projectiles: [],
    winnerId: null,
    finished: false
  };
}
function clampInput(input) {
  const finite = (v) => Number.isFinite(v) ? v : 0;
  let x = Math.max(-JUNGLE_BASH_CONFIG.inputAxisLimit, Math.min(JUNGLE_BASH_CONFIG.inputAxisLimit, finite(input.x)));
  let y = Math.max(-JUNGLE_BASH_CONFIG.inputAxisLimit, Math.min(JUNGLE_BASH_CONFIG.inputAxisLimit, finite(input.y)));
  const mag = Math.hypot(x, y);
  if (mag > 1) {
    x /= mag;
    y /= mag;
  }
  return {
    sequence: Math.max(0, Math.floor(finite(input.sequence))),
    x,
    y,
    action: input.action === "pickup" || input.action === "throw" || input.action === "attack" || input.action === "jump" || input.action === "special" ? input.action : "none"
  };
}
function stepJungleBash(state, inputs) {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state);
  const dt = JUNGLE_BASH_CONFIG.fixedStepSeconds;
  for (const [id, player] of Object.entries(next.players)) {
    if (player.eliminated) continue;
    const input = clampInput(inputs[id] ?? { sequence: player.lastInputSequence, x: 0, y: 0, action: "none" });
    if (input.sequence < player.lastInputSequence) continue;
    const freshInput = input.sequence > player.lastInputSequence;
    if (freshInput) player.lastInputSequence = input.sequence;
    if (input.x || input.y) {
      player.facingX = input.x;
      player.facingY = input.y;
    }
    player.jumpTicks = Math.max(0, player.jumpTicks - 1);
    player.attackCooldownTicks = Math.max(0, player.attackCooldownTicks - 1);
    player.invulnerableTicks = Math.max(0, player.invulnerableTicks - 1);
    const accelerationScale = next.variant === "snow-bash" ? SNOW_BASH_CONFIG.accelerationScale : 1;
    player.vx += input.x * JUNGLE_BASH_CONFIG.moveSpeed * accelerationScale * dt;
    player.vy += input.y * JUNGLE_BASH_CONFIG.moveSpeed * accelerationScale * dt;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > JUNGLE_BASH_CONFIG.maxSpeed) {
      player.vx *= JUNGLE_BASH_CONFIG.maxSpeed / speed;
      player.vy *= JUNGLE_BASH_CONFIG.maxSpeed / speed;
    }
    const action = freshInput ? input.action : "none";
    if (player.carriedFuseTicks !== null) player.carriedFuseTicks--;
    if (action === "jump" && player.jumpTicks === 0) {
      player.jumpTicks = Math.ceil(JUNGLE_BASH_CONFIG.jumpDurationSeconds / dt);
    } else if (action === "attack" && player.attackCooldownTicks === 0) {
      player.attackCooldownTicks = Math.ceil(JUNGLE_BASH_CONFIG.attackCooldownSeconds / dt);
      for (const [otherId, other] of Object.entries(next.players)) {
        if (otherId === id || other.eliminated || other.invulnerableTicks > 0) continue;
        const dx = other.x - player.x, dy = other.y - player.y, distance = Math.hypot(dx, dy);
        if (distance > JUNGLE_BASH_CONFIG.attackRange || distance === 0 || (dx * player.facingX + dy * player.facingY) / distance < 0.15) continue;
        other.vx += player.facingX * JUNGLE_BASH_CONFIG.attackImpulse;
        other.vy += player.facingY * JUNGLE_BASH_CONFIG.attackImpulse;
      }
    } else if (action === "pickup" && !player.carriedCrate && next.crate && Math.hypot(player.x - next.crate.x, player.y - next.crate.y) <= JUNGLE_BASH_CONFIG.pickupRange) {
      player.carriedCrate = true;
      player.carriedCrateKind = next.crate.kind;
      player.carriedFuseTicks = next.crate.kind === "tnt" ? next.variant === "space-bash" ? SPACE_BASH_CONFIG.tntFuseTicks : Math.ceil(JUNGLE_BASH_CONFIG.tntFuseSeconds / dt) : null;
      next.crate = null;
    } else if (action === "throw" && player.carriedCrate) {
      next.projectiles.push({
        ownerId: id,
        kind: player.carriedCrateKind ?? "steel",
        fuseTicks: player.carriedFuseTicks,
        x: player.x,
        y: player.y,
        vx: player.facingX * JUNGLE_BASH_CONFIG.throwSpeed,
        vy: player.facingY * JUNGLE_BASH_CONFIG.throwSpeed,
        age: 0
      });
      player.carriedCrate = false;
      player.carriedCrateKind = null;
      player.carriedFuseTicks = null;
    }
    if (player.carriedCrate && player.carriedFuseTicks !== null && player.carriedFuseTicks <= 0) {
      explodeAt(next, player.x, player.y, player.facingX, player.facingY, player.carriedCrateKind ?? "tnt");
      player.carriedCrate = false;
      player.carriedCrateKind = null;
      player.carriedFuseTicks = null;
      if (!next.crate) next.crate = respawnCrate(next.seed, next.tick, next.variant, next.floor);
    }
  }
  for (const p of Object.values(next.players)) {
    if (p.eliminated) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const damping = next.variant === "snow-bash" ? SNOW_BASH_CONFIG.momentumDamping : JUNGLE_BASH_CONFIG.knockbackDamping;
    p.vx *= damping;
    p.vy *= damping;
    if (next.floor) {
      const tileIndex = tileIndexAt(next.floor, p.x, p.y);
      if (tileIndex === null || next.floor.tiles[tileIndex]?.state === "destroyed" && !(next.gapJumping && p.jumpTicks > 0)) {
        p.eliminated = true;
        p.health = 0;
        p.carriedCrate = false;
        p.carriedCrateKind = null;
        p.carriedFuseTicks = null;
      }
    } else {
      const radius = Math.hypot(p.x, p.y);
      if (radius > JUNGLE_BASH_CONFIG.arenaRadius) {
        p.x *= JUNGLE_BASH_CONFIG.arenaRadius / radius;
        p.y *= JUNGLE_BASH_CONFIG.arenaRadius / radius;
        p.vx *= -0.5;
        p.vy *= -0.5;
      }
    }
  }
  const living = Object.entries(next.players).filter(([, p]) => !p.eliminated);
  for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
    const a = living[i][1], b = living[j][1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= JUNGLE_BASH_CONFIG.playerRadius * 2 || d === 0) continue;
    const nx = dx / d, ny = dy / d, overlap = JUNGLE_BASH_CONFIG.playerRadius * 2 - d;
    a.x -= nx * overlap / 2;
    a.y -= ny * overlap / 2;
    b.x += nx * overlap / 2;
    b.y += ny * overlap / 2;
    a.vx -= nx * JUNGLE_BASH_CONFIG.bumpImpulse;
    a.vy -= ny * JUNGLE_BASH_CONFIG.bumpImpulse;
    b.vx += nx * JUNGLE_BASH_CONFIG.bumpImpulse;
    b.vy += ny * JUNGLE_BASH_CONFIG.bumpImpulse;
  }
  if (next.variant === "snow-bash") stepSnowPenguin(next);
  if (next.healingFruit) {
    for (const player of Object.values(next.players)) {
      if (player.eliminated || player.health >= JUNGLE_BASH_CONFIG.health || Math.hypot(player.x - next.healingFruit.x, player.y - next.healingFruit.y) > JUNGLE_BASH_CONFIG.playerRadius + 0.2) continue;
      player.health = Math.min(JUNGLE_BASH_CONFIG.health, player.health + JUNGLE_BASH_CONFIG.healingAmount);
      next.healingFruit = null;
      next.healingFruitReadyAtTick = next.tick + Math.ceil(JUNGLE_BASH_CONFIG.healingFruitRespawnSeconds / dt);
      break;
    }
  } else if (next.tick >= next.healingFruitReadyAtTick) {
    const angle = random(next.seed ^ Math.imul(next.tick + 41, 374761393)) * Math.PI * 2;
    const radius = random(next.seed ^ Math.imul(next.tick + 53, 2654435769)) * JUNGLE_BASH_CONFIG.arenaRadius * 0.55;
    next.healingFruit = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }
  if (next.crate?.kind === "nitro") {
    const toucher = Object.values(next.players).find((player) => !player.eliminated && !player.carriedCrate && Math.hypot(player.x - next.crate.x, player.y - next.crate.y) <= JUNGLE_BASH_CONFIG.playerRadius + JUNGLE_BASH_CONFIG.crateRadius * 0.65);
    if (toucher) {
      explodeAt(next, next.crate.x, next.crate.y, toucher.vx, toucher.vy, "nitro");
      next.crate = null;
    }
  }
  const remainingProjectiles = [];
  for (const shot of next.projectiles) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.age += dt;
    if (shot.fuseTicks !== null) shot.fuseTicks--;
    let hit = false;
    for (const [id, player] of Object.entries(next.players)) {
      if (id === shot.ownerId || player.eliminated) continue;
      if (Math.hypot(player.x - shot.x, player.y - shot.y) <= JUNGLE_BASH_CONFIG.playerRadius + JUNGLE_BASH_CONFIG.crateRadius) {
        if (shot.kind === "steel") damagePlayer(player, JUNGLE_BASH_CONFIG.throwDamage, shot.vx * 0.35, shot.vy * 0.35);
        else explodeAt(next, shot.x, shot.y, shot.vx, shot.vy, shot.kind);
        hit = true;
        break;
      }
    }
    const fuseExpired = shot.fuseTicks !== null && shot.fuseTicks <= 0;
    if (fuseExpired && !hit) explodeAt(next, shot.x, shot.y, shot.vx, shot.vy, shot.kind);
    if (hit || fuseExpired || shot.age >= JUNGLE_BASH_CONFIG.throwLifetimeSeconds || Math.hypot(shot.x, shot.y) >= JUNGLE_BASH_CONFIG.arenaRadius) {
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
  if (survivors.length === 0 || !solo && survivors.length === 1) {
    next.finished = true;
    next.winnerId = survivors[0]?.[0] ?? null;
  } else if (next.tick >= JUNGLE_BASH_CONFIG.roundDurationSeconds / dt) {
    if (solo) {
      next.finished = true;
      next.winnerId = survivors[0]?.[0] ?? null;
      return next;
    }
    const ranked = survivors.sort((a, b) => b[1].health - a[1].health);
    const first = ranked[0];
    const second = ranked[1];
    next.finished = true;
    next.winnerId = first[1].health === second[1].health ? null : first[0];
  }
  return next;
}

// lib/arcade/practice/games/drain-bash.ts
function random2(seed) {
  let n = (seed | 0) + 1831565813;
  n = Math.imul(n ^ n >>> 15, n | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
}
function position(seed, tick) {
  const angle = random2(seed ^ Math.imul(tick + 13, 73244475)) * Math.PI * 2;
  const radius = 1.5 + random2(seed ^ Math.imul(tick + 29, 295559667)) * 4.5;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
function createDrainBashState(playerIds, seed) {
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
    waves: []
  };
}
function choosePickup(state, playerId) {
  const roll = random2(state.core.seed ^ Math.imul(state.core.tick + 101, 668265261) ^ playerId.split("").reduce((v, c) => Math.imul(v ^ c.charCodeAt(0), 16777619), 0));
  const weights = DRAIN_BASH_CONFIG.mysteryWeaponWeights;
  if (roll < weights.homing) return "homing";
  if (roll < weights.homing + weights.burst) return "burst";
  if (roll < weights.homing + weights.burst + weights.sonic) return "sonic";
  return "heal";
}
function ammoFor(weapon) {
  if (weapon === "homing") return DRAIN_BASH_CONFIG.homingAmmo;
  if (weapon === "burst") return DRAIN_BASH_CONFIG.burstAmmo;
  return DRAIN_BASH_CONFIG.sonicAmmo;
}
function damage(player, amount, vx, vy) {
  if (player.eliminated || player.invulnerableTicks > 0 || player.jumpTicks > 0) return;
  player.health = Math.max(0, player.health - amount);
  player.invulnerableTicks = Math.ceil(JUNGLE_BASH_CONFIG.hitInvulnerabilitySeconds / JUNGLE_BASH_CONFIG.fixedStepSeconds);
  player.vx += vx;
  player.vy += vy;
  if (player.health === 0) {
    player.eliminated = true;
    player.carriedCrate = false;
    player.carriedCrateKind = null;
    player.carriedFuseTicks = null;
  }
}
function livingTargets(state, ownerId) {
  return Object.entries(state.core.players).filter(([id, player]) => id !== ownerId && !player.eliminated);
}
function fire(state, id) {
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
      const angle2 = i * Math.PI / 4;
      state.projectiles.push({
        ownerId: id,
        kind: "burst",
        x: player.x,
        y: player.y,
        vx: Math.cos(angle2) * DRAIN_BASH_CONFIG.burstSpeed,
        vy: Math.sin(angle2) * DRAIN_BASH_CONFIG.burstSpeed,
        ageTicks: 0
      });
    }
    return;
  }
  const targets = livingTargets(state, id).sort((a, b) => Math.hypot(a[1].x - player.x, a[1].y - player.y) - Math.hypot(b[1].x - player.x, b[1].y - player.y));
  const target = targets[0]?.[1];
  const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.atan2(fy, fx);
  state.projectiles.push({
    ownerId: id,
    kind: "homing",
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * DRAIN_BASH_CONFIG.homingSpeed,
    vy: Math.sin(angle) * DRAIN_BASH_CONFIG.homingSpeed,
    ageTicks: 0
  });
}
function turnToward(vx, vy, tx, ty, maxTurn, speed) {
  const current = Math.atan2(vy, vx), target = Math.atan2(ty, tx);
  let delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  delta = Math.max(-maxTurn, Math.min(maxTurn, delta));
  const angle = current + delta;
  return [Math.cos(angle) * speed, Math.sin(angle) * speed];
}
function stepDrainBash(state, inputs) {
  if (state.core.finished) return structuredClone(state);
  const next = structuredClone(state);
  const previousSequence = Object.fromEntries(Object.entries(state.core.players).map(([id, player]) => [id, player.lastInputSequence]));
  const coreInputs = {};
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
    if (input.action === "pickup" && next.mysteryPickup && next.core.players[id] && Math.hypot(next.core.players[id].x - next.mysteryPickup.x, next.core.players[id].y - next.mysteryPickup.y) <= JUNGLE_BASH_CONFIG.pickupRange) {
      const pickup = choosePickup(next, id);
      if (pickup === "heal") {
        const player = next.core.players[id];
        player.health = Math.min(JUNGLE_BASH_CONFIG.health, player.health + DRAIN_BASH_CONFIG.healingAmount);
      } else {
        next.specials[id] = { weapon: pickup, ammo: ammoFor(pickup) };
      }
      next.mysteryPickup = null;
      next.mysteryReadyAtTick = next.core.tick + Math.ceil(DRAIN_BASH_CONFIG.mysteryRespawnSeconds / DRAIN_BASH_CONFIG.fixedStepSeconds);
    }
  }
  const dt = DRAIN_BASH_CONFIG.fixedStepSeconds;
  const maxTurn = DRAIN_BASH_CONFIG.homingTurnRadiansPerSecond * dt;
  const remaining = [];
  for (const shot of next.projectiles) {
    if (shot.kind === "homing") {
      const targets = livingTargets(next, shot.ownerId).sort((a, b) => Math.hypot(a[1].x - shot.x, a[1].y - shot.y) - Math.hypot(b[1].x - shot.x, b[1].y - shot.y));
      const target = targets[0]?.[1];
      if (target) [shot.vx, shot.vy] = turnToward(shot.vx, shot.vy, target.x - shot.x, target.y - shot.y, maxTurn, DRAIN_BASH_CONFIG.homingSpeed);
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.ageTicks++;
    let hit = false;
    for (const [, player] of livingTargets(next, shot.ownerId)) {
      if (Math.hypot(player.x - shot.x, player.y - shot.y) > JUNGLE_BASH_CONFIG.playerRadius + DRAIN_BASH_CONFIG.projectileRadius) continue;
      const speed = Math.hypot(shot.vx, shot.vy) || 1;
      damage(player, DRAIN_BASH_CONFIG.projectileDamage, shot.vx / speed * DRAIN_BASH_CONFIG.projectileKnockback, shot.vy / speed * DRAIN_BASH_CONFIG.projectileKnockback);
      hit = true;
      break;
    }
    const maxAge = Math.ceil((shot.kind === "homing" ? DRAIN_BASH_CONFIG.homingLifetimeSeconds : DRAIN_BASH_CONFIG.burstLifetimeSeconds) / dt);
    if (!hit && shot.ageTicks < maxAge && Math.hypot(shot.x, shot.y) < JUNGLE_BASH_CONFIG.arenaRadius) remaining.push(shot);
  }
  next.projectiles = remaining;
  const activeWaves = [];
  for (const wave of next.waves) {
    const oldRadius = wave.radius;
    wave.radius = Math.min(DRAIN_BASH_CONFIG.sonicRadius, oldRadius + DRAIN_BASH_CONFIG.sonicWaveSpeed * dt);
    for (const [id, player] of livingTargets(next, wave.ownerId)) {
      if (wave.hitPlayerIds.includes(id)) continue;
      const distance = Math.hypot(player.x - wave.x, player.y - wave.y);
      if (distance < oldRadius - DRAIN_BASH_CONFIG.sonicWaveThickness || distance > wave.radius + DRAIN_BASH_CONFIG.sonicWaveThickness) continue;
      const direction = Math.atan2(player.y - wave.y, player.x - wave.x);
      damage(player, DRAIN_BASH_CONFIG.sonicDamage, Math.cos(direction) * DRAIN_BASH_CONFIG.sonicKnockback, Math.sin(direction) * DRAIN_BASH_CONFIG.sonicKnockback);
      wave.hitPlayerIds.push(id);
    }
    if (wave.radius < DRAIN_BASH_CONFIG.sonicRadius) activeWaves.push(wave);
  }
  next.waves = activeWaves;
  if (!next.mysteryPickup && next.core.tick >= next.mysteryReadyAtTick) next.mysteryPickup = position(next.core.seed, next.core.tick);
  const survivors = Object.entries(next.core.players).filter(([, player]) => !player.eliminated);
  const solo = Object.keys(next.core.players).length === 1;
  if (survivors.length === 0 || !solo && survivors.length === 1) {
    next.core.finished = true;
    next.core.winnerId = survivors[0]?.[0] ?? null;
  } else if (next.core.tick >= DRAIN_BASH_CONFIG.roundDurationSeconds / dt) {
    if (solo) {
      next.core.finished = true;
      next.core.winnerId = survivors[0]?.[0] ?? null;
      return next;
    }
    const ranked = survivors.sort((a, b) => b[1].health - a[1].health);
    next.core.finished = true;
    next.core.winnerId = ranked[0][1].health === ranked[1][1].health ? null : ranked[0][0];
  }
  return next;
}

// lib/arcade/upgrades/arena-types.ts
var ARENA_DEFAULTS = { arena: "classic", players: 6, difficulty: "normal", duration: 60, crowns: 3, health: 3, pace: 1, hazards: 1, seed: 712, name: "YOU", sound: false, graphics: "balanced", haptics: false };
function arenaFields(arenas) {
  return [
    { id: "arena", label: "Arena", choices: arenas.map((m) => ({ value: m.id, label: m.name })) },
    { id: "players", label: "Contestants (all bots in Watch mode)", min: 2, max: 10, step: 1 },
    { id: "difficulty", label: "Bot skill", choices: ["easy", "normal", "hard"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })) },
    { id: "duration", label: "Round seconds", min: 30, max: 90, step: 15 },
    { id: "crowns", label: "Crowns to win", min: 1, max: 7, step: 1 },
    { id: "health", label: "Starting hearts", min: 1, max: 3, step: 1 },
    { id: "pace", label: "Game speed", min: 0.75, max: 1.25, step: 0.05 },
    { id: "hazards", label: "Hazard intensity", min: 0.5, max: 1.5, step: 0.1 },
    { id: "seed", label: "Arena seed", min: 1, max: 999999, step: 1 },
    { id: "name", label: "Your name", type: "text" },
    { id: "sound", label: "Sound effects", type: "checkbox" },
    { id: "haptics", label: "Touch vibration", type: "checkbox" },
    { id: "graphics", label: "Graphics", choices: ["performance", "balanced", "quality"].map((value) => ({ value, label: value })) }
  ];
}
function normalizeArenaOptions(input, arenas) {
  const number = (value, fallback, min, max) => Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : fallback));
  return {
    ...ARENA_DEFAULTS,
    ...input,
    arena: arenas.some((a) => a.id === input.arena) ? input.arena : arenas[0].id,
    players: Math.round(number(input.players, 6, 2, 10)),
    duration: number(input.duration, 60, 30, 90),
    crowns: Math.round(number(input.crowns, 3, 1, 7)),
    health: Math.round(number(input.health, 3, 1, 3)),
    pace: number(input.pace, 1, 0.75, 1.25),
    hazards: number(input.hazards, 1, 0.5, 1.5),
    seed: Math.round(number(input.seed, 712, 1, 999999)),
    difficulty: ["easy", "normal", "hard"].includes(input.difficulty) ? input.difficulty : "normal",
    name: String(input.name || "YOU").replace(/[<>]/g, "").slice(0, 20)
  };
}

// lib/arcade/upgrades/combat-common.ts
function safeFloor(s, x, y) {
  if (Math.hypot(x, y) > 8.8) return false;
  if (!s.core.floor) return true;
  const i = tileIndexAt(s.core.floor, x, y);
  return i !== null && s.core.floor.tiles[i]?.state === "safe";
}
function combatBotInput(s, id) {
  const p = s.core.players[id];
  if (p.eliminated) return { sequence: s.core.tick + 1, x: 0, y: 0, action: "none" };
  const cfg = s.options.difficulty, accuracy = cfg === "hard" ? 1 : cfg === "easy" ? 0.68 : 0.86;
  const nearest = Object.entries(s.core.players).filter(([key, q]) => key !== id && !q.eliminated).sort((a, b) => Math.hypot(a[1].x - p.x, a[1].y - p.y) - Math.hypot(b[1].x - p.x, b[1].y - p.y))[0]?.[1];
  let target = s.core.crate && !p.carriedCrate ? s.core.crate : nearest || { x: 0, y: 0 };
  if (p.health < s.options.health && s.core.healingFruit) target = s.core.healingFruit;
  let dx = target.x - p.x, dy = target.y - p.y, action = "none";
  const penguin = s.core.penguin, threat = !!penguin && penguin.state === "active" && Math.hypot(penguin.x - p.x, penguin.y - p.y) < 2.4;
  if (threat) {
    dx = p.x - penguin.x;
    dy = p.y - penguin.y;
    action = "jump";
  } else if (p.carriedCrate && nearest && Math.hypot(nearest.x - p.x, nearest.y - p.y) < 6) {
    dx = nearest.x + nearest.vx * 0.35 * accuracy - p.x;
    dy = nearest.y + nearest.vy * 0.35 * accuracy - p.y;
    action = "throw";
  } else if (!p.carriedCrate && s.core.crate && Math.hypot(s.core.crate.x - p.x, s.core.crate.y - p.y) < 1.2) action = "pickup";
  else if (nearest && Math.hypot(nearest.x - p.x, nearest.y - p.y) < 1.3) action = "attack";
  const length = Math.hypot(dx, dy) || 1;
  let x = dx / length * accuracy - p.vx * 0.24, y = dy / length * accuracy - p.vy * 0.24;
  if (action === "throw") {
    x = dx / length;
    y = dy / length;
  }
  if (!safeFloor(s, p.x + p.vx * 0.5 + x * 1.5, p.y + p.vy * 0.5 + y * 1.5)) {
    let best = -Infinity, bx = 0, by = 0;
    for (let n = 0; n < 16; n++) {
      const a = n * Math.PI / 8, cx = Math.cos(a), cy = Math.sin(a), tx = p.x + cx * 2, ty = p.y + cy * 2;
      if (!safeFloor(s, tx, ty)) continue;
      const score = -((tx - target.x) ** 2 + (ty - target.y) ** 2);
      if (score > best) {
        best = score;
        bx = cx;
        by = cy;
      }
    }
    x = bx - p.vx * 0.35;
    y = by - p.vy * 0.35;
    if (action === "throw") action = "none";
  }
  return { sequence: s.core.tick + 1, x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), action };
}
function combatActors(core, options) {
  return Object.entries(core.players).map(([id, p]) => ({ id, x: p.x, y: p.y, height: p.jumpTicks ? Math.sin(Math.PI * p.jumpTicks / 19) * 1.4 : 0, alive: !p.eliminated, health: p.health, maxHealth: options.health, carrying: p.carriedCrateKind, invulnerable: p.invulnerableTicks > 0, heading: Math.atan2(p.facingX, p.facingY) }));
}
function combatObjects(core) {
  return [...core.crate ? [{ id: "crate", kind: "crate", x: core.crate.x, y: core.crate.y, color: core.crate.kind === "steel" ? 9415622 : 16740193, warning: core.crate.kind !== "steel" }] : [], ...core.healingFruit ? [{ id: "fruit", kind: "fruit", ...core.healingFruit, color: 16740193 }] : [], ...core.projectiles.map((q, i) => ({ id: "crate-shot-" + i, kind: "crate", x: q.x, y: q.y, height: 0.6, color: q.kind === "steel" ? 9415622 : 16740193, warning: q.kind !== "steel" }))];
}
function timedCombatResult(core, duration) {
  if (!core.finished && core.tick >= duration * 30) {
    const alive = Object.entries(core.players).filter(([, p]) => !p.eliminated), top = Math.max(0, ...alive.map(([, p]) => p.health)), winners = alive.filter(([, p]) => p.health === top);
    core.finished = true;
    core.winnerId = winners.length === 1 ? winners[0][0] : null;
  }
}

// lib/arcade/upgrades/drain-bash.ts
var DRAIN_ARENAS = [
  { id: "junction", name: "Sump Junction", skill: "Learn when to spend Homing, Burst and Sonic charges from mystery crates." },
  { id: "flood", name: "Floodgate Spiral", skill: "Lead your aim and brake against the circulating flood current." },
  { id: "echo", name: "Echo Vault", skill: "Bank special projectiles off the vault rim to attack from a new angle." }
];
var defaults = { ...ARENA_DEFAULTS, arena: "junction" };
function createDrainMatch(ids, seed, input) {
  const options = normalizeArenaOptions(input, DRAIN_ARENAS), game = createDrainBashState([...new Set(ids)].slice(0, 10), seed);
  game.core.hazardScale = options.hazards;
  for (const p of Object.values(game.core.players)) p.health = options.health;
  return { game, options };
}
function stepDrainMatch(s, inputs) {
  if (s.game.core.finished) return structuredClone(s);
  const game = structuredClone(s.game), { options } = s;
  if (options.arena === "flood") {
    for (const p of Object.values(game.core.players)) if (!p.eliminated) {
      p.vx -= p.y * 0.018 * options.hazards;
      p.vy += p.x * 0.018 * options.hazards;
    }
  }
  if (options.arena === "echo") for (const p of game.projectiles) {
    const r = Math.hypot(p.x, p.y), dot = p.x * p.vx + p.y * p.vy;
    if (r > 8.9 && dot > 0) {
      const k = 2 * dot / (r * r);
      p.vx = (p.vx - k * p.x) * 0.92;
      p.vy = (p.vy - k * p.y) * 0.92;
    }
  }
  const next = stepDrainBash(game, inputs);
  if (s.game.mysteryPickup && !next.mysteryPickup) next.mysteryReadyAtTick = next.core.tick + Math.round(210 / options.hazards);
  timedCombatResult(next.core, options.duration);
  return { game: next, options };
}
function drainBotInput(s, id) {
  const p = s.game.core.players[id], power = s.game.specials[id], base = combatBotInput({ core: s.game.core, options: s.options }, id);
  if (p.eliminated) return base;
  const target = Object.entries(s.game.core.players).filter(([key, q]) => key !== id && !q.eliminated).sort((a, b) => Math.hypot(a[1].x - p.x, a[1].y - p.y) - Math.hypot(b[1].x - p.x, b[1].y - p.y))[0]?.[1];
  if (power.weapon && power.ammo > 0 && target && Math.hypot(target.x - p.x, target.y - p.y) < (power.weapon === "homing" ? 7 : 3.6)) return { ...base, action: "special" };
  if ((!power.weapon || power.ammo === 0) && s.game.mysteryPickup && !p.carriedCrate) {
    const q = s.game.mysteryPickup, dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    return { ...base, x: dx / len - p.vx * 0.2, y: dy / len - p.vy * 0.2, action: len < 1.2 ? "pickup" : "none" };
  }
  return base;
}
function drainFrame(s) {
  const theme = s.options.arena === "flood" ? { sky: 1059643, floor: 4689301, rim: 4643804 } : s.options.arena === "echo" ? { sky: 2169144, floor: 7364747, rim: 10255615 } : { sky: 1319729, floor: 6785926, rim: 10336883 };
  const own = s.game.specials[Object.keys(s.game.core.players)[0]];
  return {
    tick: s.game.core.tick,
    finished: s.game.core.finished,
    winners: s.game.core.winnerId ? [s.game.core.winnerId] : [],
    actors: combatActors(s.game.core, s.options),
    objects: [
      ...combatObjects(s.game.core),
      ...s.game.mysteryPickup ? [{ id: "mystery", kind: "power", ...s.game.mysteryPickup, color: 10255615, label: "?" }] : [],
      ...s.game.projectiles.map((p, i) => ({ id: "power-shot-" + i, kind: "orb", x: p.x, y: p.y, height: 0.65, radius: 0.2, color: p.kind === "homing" ? 10255615 : 16740193 })),
      ...s.game.waves.map((w, i) => ({ id: "wave-" + i, kind: "wave", x: w.x, y: w.y, radius: w.radius, color: 4643804 })),
      ...s.options.arena === "flood" ? [{ id: "flow", kind: "wave", x: 0, y: 0, radius: 4, color: 4643804 }] : []
    ],
    radius: 10,
    theme,
    status: (s.options.arena === "flood" ? "Clockwise current \xB7 " : s.options.arena === "echo" ? "Rim rebounds \xB7 " : "Mystery arsenal \xB7 ") + (own.weapon ? own.weapon.toUpperCase() + " \xB7 " + own.ammo + " charges" : "Collect a purple mystery crate"),
    skill: DRAIN_ARENAS.find((a) => a.id === s.options.arena).skill
  };
}
var DRAIN_GAME = {
  id: "drain-bash",
  title: "Drain Bash \xB7 Sump Siege",
  summary: "Master a mystery arsenal, ride flood currents and bank shots through the Echo Vault. Custom ten-contestant Crown Cups.",
  arenas: DRAIN_ARENAS,
  defaults,
  fields: arenaFields(DRAIN_ARENAS).map((f) => f.id === "hazards" ? { ...f, label: "Power intensity" } : f),
  create: createDrainMatch,
  step: stepDrainMatch,
  bot: drainBotInput,
  frame: drainFrame,
  controls: [{ action: "pickup", label: "Grab / Throw", key: "KeyE" }, { action: "jump", label: "Jump", key: "Space" }, { action: "special", label: "Weapon", key: "KeyF" }]
};
export {
  DRAIN_ARENAS,
  DRAIN_GAME,
  createDrainMatch,
  drainBotInput,
  drainFrame,
  stepDrainMatch
};
