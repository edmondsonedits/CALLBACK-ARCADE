// lib/arcade/practice/games/dragon-drop-config.ts
var DRAGON_DROP_CONFIG = {
  fixedStepSeconds: 1 / 30,
  maxPlayers: 4,
  arenaHalfWidth: 7,
  arenaHalfHeight: 5.5,
  playerRadius: 0.36,
  acceleration: 13,
  maxSpeed: 4.2,
  drag: 0.88,
  playerBumpImpulse: 1.15,
  jewelPickupRange: 0.78,
  jewelSpawnTicks: 72,
  maxLooseJewels: 4,
  shotCooldownTicks: 12,
  attackCooldownTicks: 18,
  pickupRecoveryTicks: 12,
  attackRange: 1.15,
  attackHalfAngleRadians: 0.85,
  attackImpulse: 3.8,
  targetY: -4.85,
  targetHalfTravel: 4.25,
  targetSpeed: 2.6,
  targetRadius: 0.62,
  targetHitRadius: 0.8,
  projectileSpeed: 14,
  projectileLifetimeTicks: 75,
  projectileRadius: 0.18,
  aimToleranceRadians: 0.28,
  minScoreDistance: 1.8,
  maxScoreDistance: 10,
  scoringZones: 5,
  roundDurationTicks: 30 * 20,
  intermissionTicks: 45,
  roundCount: 3,
  seedJewels: 4
};

// lib/arcade/practice/games/practice-adapter.ts
function stripCompetitiveFields(value) {
  if (Array.isArray(value)) return value.map(stripCompetitiveFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["winnerId", "winners", "draw", "result"].includes(key)).map(([key, child]) => [key, stripCompetitiveFields(child)]));
}
function createPracticeAdapter(source, options) {
  return {
    id: source.id,
    createState: (playerId, seed) => source.createState([playerId], seed),
    step: (state, input) => {
      const players = state.players;
      const playerId = players ? Object.keys(players)[0] : void 0;
      return source.step(state, playerId ? { [playerId]: options.mapInput(input) } : {});
    },
    snapshot: (state) => stripCompetitiveFields(source.snapshot(state)),
    isTerminal: options.terminal
  };
}
function movementActionInput(input, action) {
  const pressed = new Set(input.pressed ?? []);
  return { sequence: input.sequence, x: input.x, y: input.y, action: action && pressed.has(action) ? "attack" : "none" };
}

// lib/arcade/practice/games/dragon-drop.ts
var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));
var distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function hash(seed, index) {
  let x = seed ^ Math.imul(index + 1, 2654435769) | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2146121005);
  x ^= x >>> 15;
  x = Math.imul(x, 2221713035);
  x ^= x >>> 16;
  return x >>> 0;
}
function seededJewel(state) {
  const id = state.nextJewelId++;
  const lane = hash(state.seed, id * 2) % 4;
  const x = [-3.2, -1.1, 1.1, 3.2][lane];
  const y = -0.15 + (hash(state.seed, id * 2 + 1) / 4294967296 - 0.5) * 1.25;
  return { id, x, y, vx: 0, vy: 0 };
}
function initialPosition(index, count, seed) {
  const rotation = (seed >>> 0) % 4096 / 4096 * Math.PI * 2;
  const angle = -Math.PI / 2 + rotation + index * Math.PI * 2 / Math.max(count, 1);
  const r = count > 1 ? 3 : 0;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}
function createDragonDropState(playerIds, seed, tuning) {
  const ids = [...new Set(playerIds)].sort().slice(0, Math.min(10, tuning?.capacity ?? DRAGON_DROP_CONFIG.maxPlayers));
  const players = {};
  ids.forEach((id, index) => {
    const [x, y] = initialPosition(index, ids.length, seed);
    const angle = Math.atan2(DRAGON_DROP_CONFIG.targetY - y, -x);
    players[id] = {
      x,
      y,
      vx: 0,
      vy: 0,
      aimX: Math.cos(angle),
      aimY: Math.sin(angle),
      carriedJewelId: null,
      score: 0,
      lastInputSequence: -1,
      attackCooldownTicks: 0,
      shotCooldownTicks: 0,
      pickupRecoveryTicks: 0,
      hits: 0,
      shots: 0
    };
  });
  const state = {
    seed: seed | 0,
    tick: 0,
    round: 1,
    roundTick: 0,
    phase: "active",
    intermissionTicks: 0,
    nextJewelId: 1,
    nextShotId: 1,
    spawnCountdown: DRAGON_DROP_CONFIG.jewelSpawnTicks,
    players,
    jewels: [],
    shots: [],
    target: { x: 0, y: DRAGON_DROP_CONFIG.targetY, vx: DRAGON_DROP_CONFIG.targetSpeed * (tuning?.targetSpeedScale ?? 1), direction: 1 },
    finished: false,
    winnerId: null,
    winners: [],
    ...tuning ? { tuning } : {}
  };
  for (let i = 0; i < DRAGON_DROP_CONFIG.seedJewels; i++) state.jewels.push(seededJewel(state));
  return state;
}
function scoreZone(player, target) {
  const shotDistance = player.y - target.y;
  if (shotDistance < DRAGON_DROP_CONFIG.minScoreDistance || shotDistance > DRAGON_DROP_CONFIG.maxScoreDistance) return 0;
  const band = (shotDistance - DRAGON_DROP_CONFIG.minScoreDistance) / (DRAGON_DROP_CONFIG.maxScoreDistance - DRAGON_DROP_CONFIG.minScoreDistance);
  return clamp(Math.floor(band * DRAGON_DROP_CONFIG.scoringZones) + 1, 1, DRAGON_DROP_CONFIG.scoringZones);
}
function predictedTargetX(state, flightSeconds) {
  const edge = DRAGON_DROP_CONFIG.targetHalfTravel;
  let x = state.target.x + state.target.vx * flightSeconds;
  for (let i = 0; i < 3 && (x > edge || x < -edge); i++) {
    if (x > edge) x = edge - (x - edge);
    else x = -edge + (-edge - x);
  }
  return clamp(x, -edge, edge);
}
function shoot(state, playerId, player, points) {
  const distY = DRAGON_DROP_CONFIG.targetY - player.y;
  const flightSeconds = Math.max(0, -distY) / DRAGON_DROP_CONFIG.projectileSpeed;
  const targetX = predictedTargetX(state, flightSeconds);
  const aimAngle = Math.atan2(player.aimY, player.aimX);
  const desiredAngle = Math.atan2(DRAGON_DROP_CONFIG.targetY - player.y, targetX - player.x);
  const delta = Math.atan2(Math.sin(desiredAngle - aimAngle), Math.cos(desiredAngle - aimAngle));
  if (Math.abs(delta) > DRAGON_DROP_CONFIG.aimToleranceRadians) return;
  const jewelIndex = state.jewels.findIndex((j) => j.id === player.carriedJewelId);
  if (jewelIndex < 0) {
    player.carriedJewelId = null;
    return;
  }
  state.jewels.splice(jewelIndex, 1);
  state.shots.push({
    id: state.nextShotId++,
    x: player.x + player.aimX * (DRAGON_DROP_CONFIG.playerRadius + 0.12),
    y: player.y + player.aimY * (DRAGON_DROP_CONFIG.playerRadius + 0.12),
    vx: player.aimX * DRAGON_DROP_CONFIG.projectileSpeed,
    vy: player.aimY * DRAGON_DROP_CONFIG.projectileSpeed,
    ownerId: playerId,
    points,
    ticksRemaining: DRAGON_DROP_CONFIG.projectileLifetimeTicks
  });
  player.carriedJewelId = null;
  player.shotCooldownTicks = DRAGON_DROP_CONFIG.shotCooldownTicks;
  player.shots++;
}
function melee(state, attackerId, attacker) {
  for (const [targetId, target] of Object.entries(state.players)) {
    if (targetId === attackerId || target.carriedJewelId === null) continue;
    const dx = target.x - attacker.x, dy = target.y - attacker.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6 || d > DRAGON_DROP_CONFIG.attackRange) continue;
    if ((dx * attacker.aimX + dy * attacker.aimY) / d < Math.cos(DRAGON_DROP_CONFIG.attackHalfAngleRadians)) continue;
    const jewelId = target.carriedJewelId;
    target.carriedJewelId = null;
    const jewel = state.jewels.find((item) => item.id === jewelId);
    if (jewel) {
      const nx = dx / d, ny = dy / d;
      jewel.x = clamp(target.x + nx * DRAGON_DROP_CONFIG.playerRadius * 1.7, -DRAGON_DROP_CONFIG.arenaHalfWidth, DRAGON_DROP_CONFIG.arenaHalfWidth);
      jewel.y = clamp(target.y + ny * DRAGON_DROP_CONFIG.playerRadius * 1.7, -DRAGON_DROP_CONFIG.arenaHalfHeight, DRAGON_DROP_CONFIG.arenaHalfHeight);
      jewel.vx = nx * DRAGON_DROP_CONFIG.attackImpulse;
      jewel.vy = ny * DRAGON_DROP_CONFIG.attackImpulse;
      target.vx += nx * DRAGON_DROP_CONFIG.attackImpulse * 0.45;
      target.vy += ny * DRAGON_DROP_CONFIG.attackImpulse * 0.45;
    }
    target.hits++;
    target.pickupRecoveryTicks = DRAGON_DROP_CONFIG.pickupRecoveryTicks;
    attacker.attackCooldownTicks = DRAGON_DROP_CONFIG.attackCooldownTicks;
    return;
  }
}
function handleAction(state, id, player) {
  if (player.shotCooldownTicks > 0 || player.attackCooldownTicks > 0) return;
  if (player.carriedJewelId !== null) {
    const points = scoreZone(player, state.target);
    if (points > 0) shoot(state, id, player, points);
    if (player.carriedJewelId !== null) melee(state, id, player);
  } else {
    melee(state, id, player);
  }
}
function updateMovement(state, inputs) {
  const dt = DRAGON_DROP_CONFIG.fixedStepSeconds;
  for (const [id, player] of Object.entries(state.players)) {
    player.attackCooldownTicks = Math.max(0, player.attackCooldownTicks - 1);
    player.shotCooldownTicks = Math.max(0, player.shotCooldownTicks - 1);
    player.pickupRecoveryTicks = Math.max(0, player.pickupRecoveryTicks - 1);
    const input = inputs[id];
    if (input && Number.isSafeInteger(input.sequence) && input.sequence > player.lastInputSequence) {
      player.lastInputSequence = input.sequence;
      let x = clamp(input.x, -1, 1), y = clamp(input.y, -1, 1);
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
      }
      if (magnitude > 0.12) {
        player.aimX = x / Math.hypot(x, y);
        player.aimY = y / Math.hypot(x, y);
      }
      player.vx += x * DRAGON_DROP_CONFIG.acceleration * dt;
      player.vy += y * DRAGON_DROP_CONFIG.acceleration * dt;
      if (input.action === "attack") handleAction(state, id, player);
    }
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > DRAGON_DROP_CONFIG.maxSpeed) {
      player.vx *= DRAGON_DROP_CONFIG.maxSpeed / speed;
      player.vy *= DRAGON_DROP_CONFIG.maxSpeed / speed;
    }
    player.x = clamp(player.x + player.vx * dt, -DRAGON_DROP_CONFIG.arenaHalfWidth + DRAGON_DROP_CONFIG.playerRadius, DRAGON_DROP_CONFIG.arenaHalfWidth - DRAGON_DROP_CONFIG.playerRadius);
    player.y = clamp(player.y + player.vy * dt, -DRAGON_DROP_CONFIG.arenaHalfHeight + DRAGON_DROP_CONFIG.playerRadius, DRAGON_DROP_CONFIG.arenaHalfHeight - DRAGON_DROP_CONFIG.playerRadius);
    player.vx *= DRAGON_DROP_CONFIG.drag;
    player.vy *= DRAGON_DROP_CONFIG.drag;
  }
}
function resolvePlayerBumps(state) {
  const players = Object.values(state.players);
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), diameter = DRAGON_DROP_CONFIG.playerRadius * 2;
    if (d < 1e-6 || d >= diameter) continue;
    const nx = dx / d, ny = dy / d, overlap = diameter - d;
    a.x -= nx * overlap / 2;
    a.y -= ny * overlap / 2;
    b.x += nx * overlap / 2;
    b.y += ny * overlap / 2;
    a.vx -= nx * DRAGON_DROP_CONFIG.playerBumpImpulse * 0.5;
    a.vy -= ny * DRAGON_DROP_CONFIG.playerBumpImpulse * 0.5;
    b.vx += nx * DRAGON_DROP_CONFIG.playerBumpImpulse * 0.5;
    b.vy += ny * DRAGON_DROP_CONFIG.playerBumpImpulse * 0.5;
  }
}
function updateTarget(state) {
  const speedMultiplier = 1 + (state.round - 1) * 0.12;
  state.target.x += state.target.vx * DRAGON_DROP_CONFIG.fixedStepSeconds * speedMultiplier;
  if (state.target.x >= DRAGON_DROP_CONFIG.targetHalfTravel) {
    state.target.x = DRAGON_DROP_CONFIG.targetHalfTravel;
    state.target.direction = -1;
  } else if (state.target.x <= -DRAGON_DROP_CONFIG.targetHalfTravel) {
    state.target.x = -DRAGON_DROP_CONFIG.targetHalfTravel;
    state.target.direction = 1;
  }
  state.target.vx = state.target.direction * DRAGON_DROP_CONFIG.targetSpeed * speedMultiplier * (state.tuning?.targetSpeedScale ?? 1);
}
function updateJewels(state) {
  const dt = DRAGON_DROP_CONFIG.fixedStepSeconds;
  for (const jewel of state.jewels) {
    const carrier = Object.values(state.players).find((p) => p.carriedJewelId === jewel.id);
    if (carrier) {
      jewel.x = carrier.x - carrier.aimX * 0.38;
      jewel.y = carrier.y - carrier.aimY * 0.38;
      continue;
    }
    jewel.x = clamp(jewel.x + jewel.vx * dt, -DRAGON_DROP_CONFIG.arenaHalfWidth, DRAGON_DROP_CONFIG.arenaHalfWidth);
    jewel.y = clamp(jewel.y + jewel.vy * dt, -DRAGON_DROP_CONFIG.arenaHalfHeight, DRAGON_DROP_CONFIG.arenaHalfHeight);
    jewel.vx *= 0.9;
    jewel.vy *= 0.9;
  }
  for (const player of Object.values(state.players)) {
    if (player.carriedJewelId !== null || player.pickupRecoveryTicks > 0) continue;
    const index = state.jewels.findIndex((jewel) => !Object.values(state.players).some((holder) => holder.carriedJewelId === jewel.id) && jewel.vx * jewel.vx + jewel.vy * jewel.vy < 30 && distance(player.x, player.y, jewel.x, jewel.y) <= DRAGON_DROP_CONFIG.jewelPickupRange);
    if (index < 0) continue;
    player.carriedJewelId = state.jewels[index].id;
  }
}
function updateShots(state) {
  const dt = DRAGON_DROP_CONFIG.fixedStepSeconds;
  for (let i = state.shots.length - 1; i >= 0; i--) {
    const shot = state.shots[i];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.ticksRemaining--;
    if (distance(shot.x, shot.y, state.target.x, state.target.y) <= DRAGON_DROP_CONFIG.targetHitRadius + DRAGON_DROP_CONFIG.projectileRadius) {
      const owner = state.players[shot.ownerId];
      if (owner) owner.score += shot.points;
      state.shots.splice(i, 1);
    } else if (shot.ticksRemaining <= 0 || Math.abs(shot.x) > DRAGON_DROP_CONFIG.arenaHalfWidth || Math.abs(shot.y) > DRAGON_DROP_CONFIG.arenaHalfHeight) {
      state.shots.splice(i, 1);
    }
  }
}
function resetRound(state) {
  state.jewels = [];
  state.shots = [];
  for (const [index, player] of Object.values(state.players).entries()) {
    player.carriedJewelId = null;
    const [x, y] = initialPosition(index, Object.keys(state.players).length, state.seed);
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
  }
  for (let i = 0; i < DRAGON_DROP_CONFIG.seedJewels; i++) state.jewels.push(seededJewel(state));
  state.target.x = 0;
  state.target.direction = state.round % 2 ? 1 : -1;
  state.target.vx = state.target.direction * DRAGON_DROP_CONFIG.targetSpeed * (1 + (state.round - 1) * 0.12);
  state.spawnCountdown = DRAGON_DROP_CONFIG.jewelSpawnTicks;
  state.roundTick = 0;
  state.phase = "active";
}
function finish(state) {
  state.finished = true;
  state.phase = "finished";
  const high = Math.max(0, ...Object.values(state.players).map((p) => p.score));
  state.winners = Object.entries(state.players).filter(([, p]) => p.score === high).map(([id]) => id).sort();
  state.winnerId = state.winners.length === 1 ? state.winners[0] : null;
}
function stepDragonDrop(current, inputs) {
  if (current.finished) return structuredClone(current);
  const state = structuredClone(current);
  state.tick++;
  if (state.phase === "intermission") {
    state.intermissionTicks--;
    if (state.intermissionTicks <= 0) resetRound(state);
    return state;
  }
  state.roundTick++;
  updateTarget(state);
  updateMovement(state, inputs);
  resolvePlayerBumps(state);
  updateJewels(state);
  updateShots(state);
  state.spawnCountdown--;
  if (state.spawnCountdown <= 0) {
    if (state.jewels.length < DRAGON_DROP_CONFIG.maxLooseJewels) state.jewels.push(seededJewel(state));
    state.spawnCountdown = Math.max(30, DRAGON_DROP_CONFIG.jewelSpawnTicks - (state.round - 1) * 8);
  }
  if (state.roundTick >= (state.tuning?.durationTicks ?? DRAGON_DROP_CONFIG.roundDurationTicks)) {
    if (state.round >= (state.tuning?.rounds ?? DRAGON_DROP_CONFIG.roundCount)) finish(state);
    else {
      state.round++;
      state.phase = "intermission";
      state.intermissionTicks = DRAGON_DROP_CONFIG.intermissionTicks;
    }
  }
  return state;
}
var dragonDropModule = {
  id: "dragon-drop",
  minPlayers: 2,
  createState: createDragonDropState,
  step: stepDragonDrop,
  snapshot: (state) => ({
    tick: state.tick,
    round: state.round,
    roundTick: state.roundTick,
    phase: state.phase,
    intermissionTicks: state.intermissionTicks,
    players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, {
      x: p.x,
      y: p.y,
      aimX: p.aimX,
      aimY: p.aimY,
      score: p.score,
      carryingJewel: p.carriedJewelId !== null,
      hits: p.hits
    }])),
    jewels: state.jewels.map(({ id, x, y, vx, vy }) => ({ id, x, y, vx, vy })),
    shots: state.shots.map(({ id, x, y, ownerId, points }) => ({ id, x, y, ownerId, points })),
    target: { x: state.target.x, y: state.target.y },
    finished: state.finished,
    winnerId: state.winnerId,
    winners: [...state.winners]
  }),
  result: (state) => state.finished ? { winnerId: state.winnerId, winners: [...state.winners], scores: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, p.score])) } : null
};
var practiceDragonDropModule = createPracticeAdapter(dragonDropModule, {
  mapInput: (input) => movementActionInput(input, "action"),
  terminal: (state) => state.finished
});

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

// lib/arcade/upgrades/dragon-drop.ts
var DRAGON_ARENAS = [{ id: "gallery", name: "Dragon Gallery", skill: "Collect jewels and lead the dragon. Longer shots earn more points; aim before firing." }, { id: "switchback", name: "Switchback Roost", skill: "Watch the turn countdown. The dragon reverses every five seconds; time your shot after its turn." }, { id: "gust", name: "Windward Spire", skill: "Alternating gusts bend flying jewels. Aim into the wind or shorten your shot." }];
function createDragonMatch(ids, seed, input) {
  const options = normalizeArenaOptions(input, DRAGON_ARENAS);
  const core = createDragonDropState([...new Set(ids)].slice(0, 10), seed, { capacity: 10, rounds: 1, durationTicks: options.duration * 30, targetSpeedScale: options.hazards });
  return { core, options };
}
function stepDragonMatch(s, inputs) {
  if (s.core.finished) return structuredClone(s);
  const n = structuredClone(s);
  if (n.options.arena === "switchback" && n.core.tick > 0 && n.core.tick % 150 === 0) {
    n.core.target.direction = n.core.target.direction === 1 ? -1 : 1;
    n.core.target.vx = -n.core.target.vx;
  }
  if (n.options.arena === "gust") {
    const force = (Math.floor(n.core.tick / 180) % 2 ? -1 : 1) * 0.08 * n.options.hazards;
    for (const q of n.core.shots) q.vx += force;
  }
  n.core = stepDragonDrop(n.core, inputs);
  return n;
}
function dragonBotInput(s, id) {
  const p = s.core.players[id], sequence = s.core.tick + 1;
  let tx = 0, ty = 2.2;
  const action = "none";
  if (p.carriedJewelId === null) {
    const loose = s.core.jewels.filter((q) => !Object.values(s.core.players).some((player) => player.carriedJewelId === q.id)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (loose) {
      tx = loose.x;
      ty = loose.y;
    } else {
      tx = Math.sin(Number(id) * 2.4) * 2;
      ty = 0;
    }
  } else if (p.y > 1.7) {
    const flight = (p.y + 4.85) / 14;
    let target = s.core.target.x + s.core.target.vx * flight;
    for (let i = 0; i < 3 && (target > 4.25 || target < -4.25); i++) target = target > 4.25 ? 8.5 - target : -8.5 - target;
    if (s.options.arena === "gust" && s.options.difficulty === "hard") target -= (Math.floor(s.core.tick / 180) % 2 ? -1 : 1) * 1.2 * s.options.hazards * flight * flight;
    const error = s.options.difficulty === "easy" ? Math.sin(s.core.tick / 14 + Number(id)) * 1.4 : s.options.difficulty === "normal" ? Math.sin(s.core.tick / 21 + Number(id)) * 0.3 : 0;
    const dx2 = target + error - p.x, dy2 = -4.85 - p.y, m2 = Math.max(0.01, Math.hypot(dx2, dy2));
    return { sequence, x: dx2 / m2, y: dy2 / m2, action: "attack" };
  }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), v = Math.min(3.8, d * 4), x = dx / Math.max(0.01, d) * v - p.vx, y = dy / Math.max(0.01, d) * v - p.vy, m = Math.max(1, Math.hypot(x, y));
  return { sequence, x: x / m, y: y / m, action };
}
var DRAGON_GAME = {
  id: "dragon-drop",
  title: "Dragon Drop \xB7 Jewel Joust",
  summary: "Claim a jewel, line up a distant shot and lead the dragon. Ten contestants compete for points across three aiming arenas.",
  arenas: DRAGON_ARENAS,
  defaults: { ...ARENA_DEFAULTS, arena: "gallery" },
  fields: arenaFields(DRAGON_ARENAS).filter((f) => f.id !== "health").map((f) => f.id === "hazards" ? { ...f, label: "Target / wind intensity" } : f),
  create: createDragonMatch,
  step: stepDragonMatch,
  bot: dragonBotInput,
  frame: (s) => ({ tick: s.core.tick, finished: s.core.finished, winners: s.core.winners, radius: 9, bounds: { x: 7, y: 5.5 }, theme: { sky: 1778243, floor: 13348821, rim: 6705536 }, actors: Object.entries(s.core.players).map(([id, p]) => ({ id, x: p.x, y: p.y, alive: true, health: 0, maxHealth: 0, heading: Math.atan2(p.aimX, p.aimY), carrying: p.carriedJewelId !== null ? "jewel" : null, score: p.score })), objects: [{ id: "dragon", kind: "dragon", x: s.core.target.x, y: s.core.target.y, color: 9168308 }, ...s.core.jewels.filter((q) => !Object.values(s.core.players).some((p) => p.carriedJewelId === q.id)).map((q) => ({ id: "jewel-" + q.id, kind: "power", x: q.x, y: q.y, color: 9234924 })), ...s.core.shots.map((q) => ({ id: "shot-" + q.id, kind: "orb", x: q.x, y: q.y, color: 16767051, radius: 0.18 }))], status: s.options.arena === "switchback" ? "Dragon turns in " + (5 - Math.floor(s.core.tick % 150 / 30)) + "s \xB7 aim then fire E" : s.options.arena === "gust" ? "Gust " + (Math.floor(s.core.tick / 180) % 2 ? "\u2190" : "\u2192") + " \xB7 distant shots earn more points" : "Walk over a jewel \xB7 lead the target \xB7 fire / steal E \xB7 distant shots earn more points", skill: DRAGON_ARENAS.find((a) => a.id === s.options.arena).skill }),
  controls: [{ action: "attack", label: "Fire / Steal", key: "KeyE" }]
};
export {
  DRAGON_ARENAS,
  DRAGON_GAME,
  createDragonMatch,
  dragonBotInput,
  stepDragonMatch
};
