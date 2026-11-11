// lib/arcade/practice/games/manic-panic-config.ts
var MANIC_PANIC_CONFIG = {
  fixedStepSeconds: 1 / 30,
  roundDurationSeconds: 75,
  arenaRadius: 10,
  playerRadius: 0.55,
  mountedAcceleration: 5.2,
  mountedMaxSpeed: 6.2,
  mountedDamping: 0.982,
  mountedBumpImpulse: 2.5,
  onFootAcceleration: 7.1,
  onFootMaxSpeed: 5,
  onFootDamping: 0.97,
  onFootBumpImpulse: 3.2,
  bombCooldownSeconds: 1.4,
  bombPickupRange: 1.3,
  bombRespawnSeconds: 2.2,
  bombThrowSpeed: 7.5,
  bombFuseSeconds: 1.1,
  bombBlastRadius: 2.5,
  bombKnockback: 5.5,
  hitInvulnerabilitySeconds: 0.8,
  inputAxisLimit: 1
};

// lib/arcade/practice/games/manic-panic.ts
function clampInput(input) {
  const finite = (value) => Number.isFinite(value) ? value : 0;
  let x = Math.max(-MANIC_PANIC_CONFIG.inputAxisLimit, Math.min(MANIC_PANIC_CONFIG.inputAxisLimit, finite(input.x)));
  let y = Math.max(-MANIC_PANIC_CONFIG.inputAxisLimit, Math.min(MANIC_PANIC_CONFIG.inputAxisLimit, finite(input.y)));
  const magnitude = Math.hypot(x, y);
  if (magnitude > 1) {
    x /= magnitude;
    y /= magnitude;
  }
  return {
    sequence: Math.max(0, Math.floor(finite(input.sequence))),
    x,
    y,
    action: input.action === "pickup" || input.action === "throw" ? input.action : "none"
  };
}
function detonate(state, bomb) {
  for (const player of Object.values(state.players)) {
    if (player.eliminated || player.invulnerableTicks > 0) continue;
    const dx = player.x - bomb.x, dy = player.y - bomb.y, distance = Math.hypot(dx, dy);
    const blastScale = Math.max(0.5, Math.min(1.5, state.tuning?.blastScale ?? 1));
    if (distance > MANIC_PANIC_CONFIG.bombBlastRadius * blastScale) continue;
    player.bombHits++;
    player.mounted = false;
    player.invulnerableTicks = Math.ceil(MANIC_PANIC_CONFIG.hitInvulnerabilitySeconds / MANIC_PANIC_CONFIG.fixedStepSeconds);
    const inverseDistance = distance > 1e-5 ? 1 / distance : 1;
    const nx = distance > 1e-5 ? dx * inverseDistance : player.x - bomb.x || 1;
    const ny = distance > 1e-5 ? dy * inverseDistance : 0;
    player.vx += nx * MANIC_PANIC_CONFIG.bombKnockback * blastScale;
    player.vy += ny * MANIC_PANIC_CONFIG.bombKnockback * blastScale;
    if (player.bombHits >= 2) {
      player.eliminated = true;
      player.carryingBomb = false;
    }
  }
}
function createManicPanicState(playerIds, seed, tuning) {
  const ids = [...new Set(playerIds)].sort();
  const players = {};
  ids.forEach((id, index) => {
    const angle = 2 * Math.PI * index / Math.max(1, ids.length);
    players[id] = {
      x: Math.cos(angle) * 4,
      y: Math.sin(angle) * 4,
      vx: 0,
      vy: 0,
      mounted: true,
      bombHits: 0,
      eliminated: false,
      lastInputSequence: -1,
      facingX: Math.cos(angle + Math.PI),
      facingY: Math.sin(angle + Math.PI),
      invulnerableTicks: 0,
      bombCooldownTicks: 0,
      carryingBomb: false
    };
  });
  return {
    seed: seed | 0,
    tick: 0,
    players,
    bombs: [{ ownerId: "", x: 0, y: 0, vx: 0, vy: 0, fuseTicks: null }],
    bombRespawnAtTick: null,
    winnerId: null,
    finished: false,
    ...tuning ? { tuning } : {}
  };
}
function stepManicPanic(state, inputs) {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state), dt = MANIC_PANIC_CONFIG.fixedStepSeconds;
  for (const [id, player] of Object.entries(next.players)) {
    if (player.eliminated) continue;
    const input = clampInput(inputs[id] ?? { sequence: player.lastInputSequence, x: 0, y: 0 });
    if (input.sequence < player.lastInputSequence) continue;
    const fresh = input.sequence > player.lastInputSequence;
    if (fresh) player.lastInputSequence = input.sequence;
    if (input.x || input.y) {
      player.facingX = input.x;
      player.facingY = input.y;
    }
    player.invulnerableTicks = Math.max(0, player.invulnerableTicks - 1);
    player.bombCooldownTicks = Math.max(0, player.bombCooldownTicks - 1);
    const acceleration = player.mounted ? MANIC_PANIC_CONFIG.mountedAcceleration : MANIC_PANIC_CONFIG.onFootAcceleration;
    const maxSpeed = player.mounted ? MANIC_PANIC_CONFIG.mountedMaxSpeed : MANIC_PANIC_CONFIG.onFootMaxSpeed;
    player.vx += input.x * acceleration * dt;
    player.vy += input.y * acceleration * dt;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx *= maxSpeed / speed;
      player.vy *= maxSpeed / speed;
    }
    if (fresh && input.action === "pickup" && !player.carryingBomb) {
      const bombIndex = next.bombs.findIndex((bomb) => bomb.fuseTicks === null && Math.hypot(player.x - bomb.x, player.y - bomb.y) <= MANIC_PANIC_CONFIG.bombPickupRange);
      if (bombIndex >= 0) {
        next.bombs.splice(bombIndex, 1);
        player.carryingBomb = true;
      }
    } else if (fresh && input.action === "throw" && player.carryingBomb && player.bombCooldownTicks === 0) {
      next.bombs.push({
        ownerId: id,
        x: player.x + player.facingX * (MANIC_PANIC_CONFIG.playerRadius + 0.15),
        y: player.y + player.facingY * (MANIC_PANIC_CONFIG.playerRadius + 0.15),
        vx: player.facingX * MANIC_PANIC_CONFIG.bombThrowSpeed,
        vy: player.facingY * MANIC_PANIC_CONFIG.bombThrowSpeed,
        fuseTicks: Math.ceil(MANIC_PANIC_CONFIG.bombFuseSeconds / dt)
      });
      player.carryingBomb = false;
      player.bombCooldownTicks = Math.ceil(MANIC_PANIC_CONFIG.bombCooldownSeconds / dt);
    }
  }
  for (const player of Object.values(next.players)) {
    if (player.eliminated) continue;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    const radius = Math.hypot(player.x, player.y);
    if (radius > MANIC_PANIC_CONFIG.arenaRadius) {
      player.eliminated = true;
      player.mounted = false;
      player.carryingBomb = false;
      continue;
    }
    player.vx *= player.mounted ? MANIC_PANIC_CONFIG.mountedDamping : MANIC_PANIC_CONFIG.onFootDamping;
    player.vy *= player.mounted ? MANIC_PANIC_CONFIG.mountedDamping : MANIC_PANIC_CONFIG.onFootDamping;
  }
  const active = Object.entries(next.players).filter(([, player]) => !player.eliminated);
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    const a = active[i][1], b = active[j][1], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    if (distance === 0 || distance >= MANIC_PANIC_CONFIG.playerRadius * 2) continue;
    const nx = dx / distance, ny = dy / distance, overlap = MANIC_PANIC_CONFIG.playerRadius * 2 - distance;
    a.x -= nx * overlap / 2;
    a.y -= ny * overlap / 2;
    b.x += nx * overlap / 2;
    b.y += ny * overlap / 2;
    const impulse = (a.mounted ? MANIC_PANIC_CONFIG.mountedBumpImpulse : MANIC_PANIC_CONFIG.onFootBumpImpulse) + (b.mounted ? MANIC_PANIC_CONFIG.mountedBumpImpulse : MANIC_PANIC_CONFIG.onFootBumpImpulse);
    a.vx -= nx * impulse / 2;
    a.vy -= ny * impulse / 2;
    b.vx += nx * impulse / 2;
    b.vy += ny * impulse / 2;
  }
  const remaining = [];
  for (const bomb of next.bombs) {
    if (bomb.fuseTicks === null) {
      remaining.push(bomb);
      continue;
    }
    bomb.x += bomb.vx * dt;
    bomb.y += bomb.vy * dt;
    bomb.vx *= 0.985;
    bomb.vy *= 0.985;
    bomb.fuseTicks--;
    if (bomb.fuseTicks <= 0 || Math.hypot(bomb.x, bomb.y) >= MANIC_PANIC_CONFIG.arenaRadius) {
      detonate(next, bomb);
      next.bombRespawnAtTick = next.tick + Math.ceil(MANIC_PANIC_CONFIG.bombRespawnSeconds / dt);
    } else remaining.push(bomb);
  }
  next.bombs = remaining;
  next.tick++;
  if (next.bombs.length === 0 && !Object.values(next.players).some((player) => !player.eliminated && player.carryingBomb) && next.bombRespawnAtTick === null) {
    next.bombRespawnAtTick = next.tick + Math.ceil(MANIC_PANIC_CONFIG.bombRespawnSeconds / dt);
  }
  if (!next.bombs.some((bomb) => bomb.fuseTicks === null) && next.bombRespawnAtTick !== null && next.tick >= next.bombRespawnAtTick) {
    next.bombs.push({ ownerId: "", x: 0, y: 0, vx: 0, vy: 0, fuseTicks: null });
    next.bombRespawnAtTick = null;
  }
  const survivors = Object.entries(next.players).filter(([, player]) => !player.eliminated);
  const solo = Object.keys(next.players).length === 1;
  if (survivors.length === 0 || !solo && survivors.length === 1) {
    next.finished = true;
    next.winnerId = survivors[0]?.[0] ?? null;
  } else if (next.tick >= (next.tuning?.durationTicks ?? MANIC_PANIC_CONFIG.roundDurationSeconds / dt)) {
    if (solo) {
      next.finished = true;
      next.winnerId = survivors[0]?.[0] ?? null;
      return next;
    }
    const ranked = survivors.sort((a, b) => a[1].bombHits - b[1].bombHits);
    next.finished = true;
    next.winnerId = ranked[0][1].bombHits === ranked[1][1].bombHits ? null : ranked[0][0];
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

// lib/arcade/upgrades/manic-panic.ts
var MANIC_ARENAS = [{ id: "joust", name: "Bomb Joust", skill: "Collect a bomb, lead a moving rival, then brake before the rim. A first hit costs your buggy." }, { id: "crosscurrents", name: "Crosscurrent Speedway", skill: "Read the changing current, countersteer and compensate when throwing." }, { id: "bankshot", name: "Ricochet Bowl", skill: "Bank armed bombs off the rim; their fuse keeps running after a rebound." }];
function createManicMatch(ids, seed, input) {
  const options = normalizeArenaOptions(input, MANIC_ARENAS);
  options.health = Math.min(2, options.health);
  const core = createManicPanicState([...new Set(ids)].slice(0, 10), seed, { durationTicks: options.duration * 30, blastScale: options.hazards });
  const rotation = (seed >>> 0) % 4096 / 4096 * Math.PI * 2;
  for (const [i, p] of Object.values(core.players).entries()) {
    const a = Math.atan2(p.y, p.x) + rotation, r = 4 + Math.sin(seed * 0.017 + i * 2.3) * 0.35;
    p.x = Math.cos(a) * r;
    p.y = Math.sin(a) * r;
    p.facingX = -Math.cos(a);
    p.facingY = -Math.sin(a);
    p.bombHits = 2 - options.health;
  }
  return { core, options };
}
function stepManicMatch(s, inputs) {
  if (s.core.finished) return structuredClone(s);
  const n = structuredClone(s);
  if (n.options.arena === "crosscurrents") {
    const a = Math.floor(n.core.tick / 180) * Math.PI / 2;
    for (const p of Object.values(n.core.players)) {
      if (p.eliminated) continue;
      p.vx += Math.cos(a) * 0.12 * n.options.hazards;
      p.vy += Math.sin(a) * 0.12 * n.options.hazards;
    }
  }
  if (n.options.arena === "bankshot") for (const b of n.core.bombs) {
    if (b.fuseTicks === null) continue;
    const d = Math.hypot(b.x, b.y), dot = (b.x * b.vx + b.y * b.vy) / Math.max(1e-3, d);
    if (d > 9.4 && dot > 0) {
      const x = b.x / d, y = b.y / d;
      b.x = x * 9.35;
      b.y = y * 9.35;
      b.vx -= 2 * dot * x;
      b.vy -= 2 * dot * y;
    }
  }
  n.core = stepManicPanic(n.core, inputs);
  return n;
}
function manicBotInput(s, id) {
  const p = s.core.players[id], sequence = s.core.tick + 1;
  if (p.eliminated) return { sequence, x: 0, y: 0 };
  const index = Object.keys(s.core.players).indexOf(id), reaction = s.options.difficulty === "easy" ? 8 : s.options.difficulty === "hard" ? 1 : 3;
  if ((s.core.tick + index + Math.abs(s.core.seed)) % reaction) return { sequence, x: 0, y: 0 };
  let x = 0, y = 0, action = "none";
  const target = Object.entries(s.core.players).filter(([key, q]) => key !== id && !q.eliminated).sort((a, b) => Math.abs(Math.hypot(a[1].x - p.x, a[1].y - p.y) - 6) - Math.abs(Math.hypot(b[1].x - p.x, b[1].y - p.y) - 6))[0]?.[1];
  if (p.carryingBomb && target) {
    const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
    if (d >= 5.2 && d < 8 && p.bombCooldownTicks === 0) {
      x = dx + target.vx * 0.75;
      y = dy + target.vy * 0.75;
      action = "throw";
    } else {
      x = dx * (d < 5.2 ? -1 : 1);
      y = dy * (d < 5.2 ? -1 : 1);
    }
  } else {
    const bomb = s.core.bombs.find((b) => b.fuseTicks === null);
    if (bomb) {
      x = bomb.x - p.x;
      y = bomb.y - p.y;
      if (Math.hypot(x, y) < 1.25) action = "pickup";
    } else {
      x = -p.x;
      y = -p.y;
    }
  }
  if (action !== "throw") {
    for (const b of s.core.bombs) {
      const alert = s.options.difficulty === "hard" ? 28 : s.options.difficulty === "normal" ? 14 : 7;
      if (b.fuseTicks === null || b.fuseTicks > alert) continue;
      const dx = p.x - b.x - b.vx * Math.min(0.4, b.fuseTicks / 30), dy = p.y - b.y - b.vy * Math.min(0.4, b.fuseTicks / 30), d2 = Math.hypot(dx, dy);
      if (d2 < 3.5 * s.options.hazards) {
        x += dx / Math.max(0.15, d2) * 7;
        y += dy / Math.max(0.15, d2) * 7;
      }
    }
    const d = Math.hypot(p.x, p.y);
    if (d > 7.5) {
      x -= p.x * 2;
      y -= p.y * 2;
    }
    const m2 = Math.max(1, Math.hypot(x, y));
    x = x / m2 * 4 - p.vx;
    y = y / m2 * 4 - p.vy;
  }
  const m = Math.max(1, Math.hypot(x, y));
  return { sequence, x: x / m, y: y / m, action };
}
var MANIC_GAME = {
  id: "manic-panic",
  title: "Manic Panic \xB7 Bomb Joust",
  summary: "Bump buggies, steal bombs and time ricochets. Ten real contestants, custom Crown Cups and changing currents.",
  arenas: MANIC_ARENAS,
  defaults: { ...ARENA_DEFAULTS, arena: "joust", health: 2 },
  fields: arenaFields(MANIC_ARENAS).map((f) => f.id === "health" ? { ...f, label: "Bomb hits to eliminate", max: 2 } : f),
  create: createManicMatch,
  step: stepManicMatch,
  bot: manicBotInput,
  frame: (s) => ({ tick: s.core.tick, finished: s.core.finished, winners: s.core.winnerId ? [s.core.winnerId] : [], radius: 10, theme: { sky: 2103868, floor: s.options.arena === "bankshot" ? 13999464 : 9672389, rim: 6509687 }, actors: Object.entries(s.core.players).map(([id, p]) => ({ id, x: p.x, y: p.y, height: p.mounted ? 0.25 : 0, heading: Math.atan2(p.facingX, p.facingY), alive: !p.eliminated, health: Math.max(0, 2 - p.bombHits), maxHealth: s.options.health, carrying: p.carryingBomb ? "tnt" : null, invulnerable: p.invulnerableTicks > 0, mounted: p.mounted })), objects: s.core.bombs.map((b, i) => ({ id: "bomb-" + i, kind: "bomb", x: b.x, y: b.y, radius: 2.5 * s.options.hazards, color: b.fuseTicks === null ? 2371909 : 16740193, warning: b.fuseTicks !== null, label: b.fuseTicks === null ? "GRAB" : String((b.fuseTicks / 30).toFixed(1)) })), status: s.options.arena === "crosscurrents" ? "Current " + ["\u2192", "\u2193", "\u2190", "\u2191"][Math.floor(s.core.tick / 180) % 4] + " \xB7 two bomb hits eliminate" : s.options.arena === "bankshot" ? "Bombs rebound \xB7 fuse continues \xB7 brake before the rim" : "Grab E \xB7 aim with movement \xB7 throw E \xB7 first hit breaks the buggy", skill: MANIC_ARENAS.find((a) => a.id === s.options.arena).skill }),
  controls: [{ action: "pickup", label: "Grab / Throw", key: "KeyE" }]
};
export {
  MANIC_ARENAS,
  MANIC_GAME,
  createManicMatch,
  manicBotInput,
  stepManicMatch
};
