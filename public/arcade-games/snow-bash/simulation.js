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
function damagePlayer(player, damage, vx, vy) {
  if (player.eliminated || player.invulnerableTicks > 0 || player.jumpTicks > 0) return;
  player.health = Math.max(0, player.health - damage);
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

// lib/arcade/upgrades/snow-bash.ts
var SNOW_ARENAS = [
  { id: "palace", name: "Polar Palace", skill: "Bait the sleeping penguin, then jump or brake before it charges." },
  { id: "crosswind", name: "Crosswind Glacier", skill: "Read the wind reversal and brake against drifting momentum." },
  { id: "thaw", name: "Thawing Lake", skill: "Leave cracking ice early and plan a safe route through shrinking islands." }
];
var SNOW_DEFAULTS = { ...ARENA_DEFAULTS, arena: "palace" };
function createSnowMatch(playerIds, seed, input) {
  const options = normalizeArenaOptions(input, SNOW_ARENAS), core = createJungleBashState([...new Set(playerIds)].slice(0, 10), seed, "snow-bash");
  core.hazardScale = options.hazards;
  for (const p of Object.values(core.players)) p.health = options.health;
  if (options.arena === "thaw") core.floor = createDestructibleFloor(7, 9, 60);
  return { core, options, wind: 0 };
}
function stepSnowMatch(state, inputs) {
  if (state.core.finished) return structuredClone(state);
  const core = structuredClone(state.core), { options } = state;
  const wind = options.arena === "crosswind" ? Math.sin(core.tick / 180 * Math.PI) * options.hazards * 0.06 : 0;
  for (const p of Object.values(core.players)) if (!p.eliminated) p.vx += wind;
  if (core.penguin && core.penguin.state === "active") {
    const target = Object.values(core.players).filter((p) => !p.eliminated).sort((a, b) => Math.hypot(a.x - core.penguin.x, a.y - core.penguin.y) - Math.hypot(b.x - core.penguin.x, b.y - core.penguin.y))[0];
    if (target) {
      const dx = target.x - core.penguin.x, dy = target.y - core.penguin.y, d = Math.hypot(dx, dy);
      if (d > 0) {
        const travel = Math.min(d, 2.8 / 30 * Math.abs(options.hazards - 1)) * Math.sign(options.hazards - 1);
        core.penguin.x += dx / d * travel;
        core.penguin.y += dy / d * travel;
      }
    }
  }
  if (core.floor && core.tick > 90 && core.tick % Math.max(15, Math.round(60 / options.hazards)) === 0) {
    const floor = core.floor, index = (Math.floor(core.tick / Math.max(15, Math.round(60 / options.hazards))) * 17 + core.seed) % floor.tiles.length;
    const size = floor.halfExtent * 2 / floor.size;
    markFloorTile(floor, -floor.halfExtent + (index % floor.size + 0.5) * size, -floor.halfExtent + (Math.floor(index / floor.size) + 0.5) * size);
  }
  const next = stepJungleBash(core, inputs);
  if (!next.finished && next.tick >= options.duration * 30) {
    const alive = Object.entries(next.players).filter(([, p]) => !p.eliminated), health = Math.max(0, ...alive.map(([, p]) => p.health));
    const leaders = alive.filter(([, p]) => p.health === health);
    next.finished = true;
    next.winnerId = leaders.length === 1 ? leaders[0][0] : null;
  }
  return { core: next, options, wind };
}
var snowBotInput = (s, id) => combatBotInput(s, id);
function snowFrame(s) {
  const p = s.core.penguin, theme = s.options.arena === "crosswind" ? { sky: 1516625, floor: 11788021, rim: 4643804 } : s.options.arena === "thaw" ? { sky: 1518664, floor: 12508136, rim: 6666992 } : { sky: 1186363, floor: 14346995, rim: 10667250 };
  return {
    tick: s.core.tick,
    finished: s.core.finished,
    winners: s.core.winnerId ? [s.core.winnerId] : [],
    radius: 10,
    theme,
    floor: s.core.floor,
    actors: Object.entries(s.core.players).map(([id, p2]) => ({ id, x: p2.x, y: p2.y, height: p2.jumpTicks ? Math.sin(Math.PI * p2.jumpTicks / 19) * 1.4 : 0, alive: !p2.eliminated, health: p2.health, maxHealth: s.options.health, carrying: p2.carriedCrateKind, invulnerable: p2.invulnerableTicks > 0, heading: Math.atan2(p2.facingX, p2.facingY) })),
    objects: [
      { id: "penguin", kind: "penguin", x: p.x, y: p.y, radius: 0.9, warning: p.state === "warning" || p.state === "active", label: p.state.toUpperCase() },
      ...s.core.crate ? [{ id: "crate", kind: "crate", x: s.core.crate.x, y: s.core.crate.y, color: s.core.crate.kind === "steel" ? 9415622 : 16740193 }] : [],
      ...s.core.healingFruit ? [{ id: "fruit", kind: "fruit", ...s.core.healingFruit, color: 16740193 }] : [],
      ...s.core.projectiles.map((q, i) => ({ id: "shot-" + i, kind: "crate", x: q.x, y: q.y, height: 0.6, color: q.kind === "steel" ? 9415622 : 16740193, warning: q.kind !== "steel" }))
    ],
    status: s.options.arena === "crosswind" ? `Wind ${s.wind < 0 ? "\u2190" : "\u2192"} \xB7 reversal every 6 seconds` : s.options.arena === "thaw" ? "Cracking ice will collapse \xB7 keep an escape route" : `Penguin ${p.state} \xB7 grab a crate and aim before throwing`,
    skill: SNOW_ARENAS.find((a) => a.id === s.options.arena).skill
  };
}
var SNOW_GAME = {
  id: "snow-bash",
  title: "Snow Bash \xB7 Polar Panic",
  summary: "Crates, slippery ice and one very grumpy penguin. Learn three arenas and compete in a custom Crown Cup.",
  arenas: SNOW_ARENAS,
  defaults: SNOW_DEFAULTS,
  fields: arenaFields(SNOW_ARENAS),
  create: createSnowMatch,
  step: stepSnowMatch,
  bot: snowBotInput,
  frame: snowFrame,
  controls: [{ action: "pickup", label: "Grab / Throw", key: "KeyE" }, { action: "jump", label: "Jump", key: "Space" }, { action: "attack", label: "Shove", key: "KeyQ" }]
};
export {
  SNOW_ARENAS,
  SNOW_DEFAULTS,
  SNOW_GAME,
  createSnowMatch,
  snowBotInput,
  snowFrame,
  stepSnowMatch
};
