// lib/arcade/practice/games/volt-vault-config.ts
var VOLT_VAULT_CONFIG = {
  fixedStepSeconds: 1 / 30,
  maxPlayers: 4,
  lives: 3,
  arenaHalfSize: 5,
  playerRadius: 0.34,
  acceleration: 18,
  maxSpeed: 4.6,
  drag: 0.9,
  collisionImpulse: 1.1,
  hitInvulnerabilityTicks: 24,
  roundDurationTicks: 30 * 75,
  tierTwoAtTick: 30 * 20,
  tierThreeAtTick: 30 * 42,
  warningTicks: 39,
  dangerTicks: 48,
  interPatternTicks: 12,
  tileHalfSize: 0.86,
  fastZoneX: 3.35,
  fastZoneMultiplier: 1.22,
  safeSpawn: { x: 0, y: 0 },
  tierSpeedMultipliers: [1, 1.13, 1.28],
  placementScores: [1, 0]
};

// lib/arcade/practice/games/types.ts
function practiceModule(id, create, step, snapshot, terminal) {
  return { id, createState: create, step, snapshot, isTerminal: terminal };
}

// lib/arcade/practice/games/volt-vault.ts
var clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
var distanceSq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
function hashSeed(seed) {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2146121005);
  x ^= x >>> 15;
  return x >>> 0;
}
function hazardCells(patternIndex, seed) {
  const variant = hashSeed(seed) % 2;
  switch ((patternIndex + variant) % 6) {
    case 0:
      return [-3, -1, 1, 3].map((y) => ({ x: 0, y }));
    case 1:
      return [-3, -1, 1, 3].map((x) => ({ x, y: 0 }));
    case 2:
      return [-2, 0, 2].flatMap((x) => [-2, 2].map((y) => ({ x, y })));
    case 3:
      return [-3, -1, 1, 3].map((v) => ({ x: v, y: v }));
    case 4:
      return [-3, -1, 1, 3].map((v) => ({ x: v, y: -v }));
    default:
      return [-2, 0, 2].flatMap((y) => [-3, 3].map((x) => ({ x, y })));
  }
}
function tierAt(tick) {
  return tick >= VOLT_VAULT_CONFIG.tierThreeAtTick ? 2 : tick >= VOLT_VAULT_CONFIG.tierTwoAtTick ? 1 : 0;
}
function createHazard(seed) {
  return {
    tier: 0,
    phase: "warning",
    patternIndex: 0,
    cycleIndex: 0,
    warningTicksRemaining: VOLT_VAULT_CONFIG.warningTicks,
    dangerTicksRemaining: 0,
    intermissionTicksRemaining: 0,
    warningCells: hazardCells(0, seed),
    activeCells: [],
    reverseControls: false
  };
}
function createVoltVaultState(playerIds, seed, tuning) {
  const ids = [...new Set(playerIds)].sort().slice(0, Math.min(10, tuning?.capacity ?? VOLT_VAULT_CONFIG.maxPlayers));
  const rotation = hashSeed(seed) / 4294967296 * Math.PI * 2;
  const players = {};
  ids.forEach((id, index) => {
    const angle = rotation + index / Math.max(ids.length, 1) * Math.PI * 2;
    const radius = ids.length > 1 ? 2.55 : 0;
    players[id] = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      alive: true,
      lives: VOLT_VAULT_CONFIG.lives,
      lastInputSequence: -1,
      invulnerableTicks: 0,
      survivalTicks: 0,
      eliminatedAtTick: null
    };
  });
  return {
    seed: seed | 0,
    tick: 0,
    players,
    hazard: createHazard(seed),
    eliminationOrder: [],
    finished: false,
    winnerId: null,
    winners: [],
    ...tuning ? { tuning } : {}
  };
}
function advanceHazard(state) {
  const h = state.hazard;
  h.tier = tierAt(state.tick);
  if (h.phase === "warning") {
    h.warningTicksRemaining--;
    if (h.warningTicksRemaining <= 0) {
      h.phase = "danger";
      h.warningTicksRemaining = 0;
      h.dangerTicksRemaining = Math.max(18, Math.round(VOLT_VAULT_CONFIG.dangerTicks / (1 + h.tier * 0.18)));
      h.activeCells = h.warningCells.map((cell) => ({ ...cell }));
    }
  } else if (h.phase === "danger") {
    h.dangerTicksRemaining--;
    if (h.dangerTicksRemaining <= 0) {
      h.phase = "intermission";
      h.dangerTicksRemaining = 0;
      h.activeCells = [];
      h.intermissionTicksRemaining = Math.max(5, Math.round(VOLT_VAULT_CONFIG.interPatternTicks / (1 + h.tier * 0.25)));
    }
  } else {
    h.intermissionTicksRemaining--;
    if (h.intermissionTicksRemaining <= 0) {
      h.cycleIndex++;
      h.patternIndex = (h.patternIndex + 1) % 6;
      h.warningCells = hazardCells(h.patternIndex, state.seed ^ h.cycleIndex * 73244475);
      h.phase = "warning";
      h.intermissionTicksRemaining = 0;
      h.warningTicksRemaining = Math.max(15, Math.round(VOLT_VAULT_CONFIG.warningTicks / (1 + h.tier * 0.14)));
      h.reverseControls = state.tuning?.controlMode === "never" ? false : state.tuning?.controlMode === "alternate" ? h.cycleIndex % 2 === 1 : h.cycleIndex % 4 === 2;
    }
  }
}
function damagePlayers(state) {
  const h = state.hazard;
  if (h.phase !== "danger") return;
  const hitRadius = VOLT_VAULT_CONFIG.tileHalfSize + VOLT_VAULT_CONFIG.playerRadius;
  for (const [id, player] of Object.entries(state.players)) {
    if (!player.alive || player.invulnerableTicks > 0) continue;
    const hit = h.activeCells.some((cell) => distanceSq(player, cell) <= hitRadius * hitRadius);
    if (!hit) continue;
    player.lives = Math.max(0, player.lives - 1);
    player.invulnerableTicks = VOLT_VAULT_CONFIG.hitInvulnerabilityTicks;
    if (player.lives === 0) {
      player.alive = false;
      player.eliminatedAtTick = state.tick;
      state.eliminationOrder.push(id);
    }
  }
}
function movePlayers(state, inputs) {
  const dt = VOLT_VAULT_CONFIG.fixedStepSeconds;
  for (const [id, player] of Object.entries(state.players)) {
    if (!player.alive) continue;
    if (player.invulnerableTicks > 0) player.invulnerableTicks--;
    const input = inputs[id];
    if (input && Number.isSafeInteger(input.sequence) && input.sequence > player.lastInputSequence) {
      player.lastInputSequence = input.sequence;
      let x = clamp(input.x, -1, 1), y = clamp(input.y, -1, 1);
      if (state.hazard.reverseControls) {
        x = -x;
        y = -y;
      }
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
      }
      player.vx += x * VOLT_VAULT_CONFIG.acceleration * dt;
      player.vy += y * VOLT_VAULT_CONFIG.acceleration * dt;
    }
    const speed = Math.hypot(player.vx, player.vy);
    const fastZone = Math.abs(player.x) >= VOLT_VAULT_CONFIG.fastZoneX || Math.abs(player.y) >= VOLT_VAULT_CONFIG.fastZoneX ? VOLT_VAULT_CONFIG.fastZoneMultiplier : 1;
    const maxSpeed = VOLT_VAULT_CONFIG.maxSpeed * VOLT_VAULT_CONFIG.tierSpeedMultipliers[state.hazard.tier] * fastZone;
    if (speed > maxSpeed) {
      player.vx *= maxSpeed / speed;
      player.vy *= maxSpeed / speed;
    }
    player.vx *= VOLT_VAULT_CONFIG.drag;
    player.vy *= VOLT_VAULT_CONFIG.drag;
    player.x = clamp(player.x + player.vx * dt, -VOLT_VAULT_CONFIG.arenaHalfSize + VOLT_VAULT_CONFIG.playerRadius, VOLT_VAULT_CONFIG.arenaHalfSize - VOLT_VAULT_CONFIG.playerRadius);
    player.y = clamp(player.y + player.vy * dt, -VOLT_VAULT_CONFIG.arenaHalfSize + VOLT_VAULT_CONFIG.playerRadius, VOLT_VAULT_CONFIG.arenaHalfSize - VOLT_VAULT_CONFIG.playerRadius);
    player.survivalTicks++;
  }
  const alive = Object.entries(state.players).filter(([, player]) => player.alive);
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i][1], b = alive[j][1];
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    if (distance < 1e-6 || distance >= VOLT_VAULT_CONFIG.playerRadius * 2) continue;
    const nx = dx / distance, ny = dy / distance;
    const push = (VOLT_VAULT_CONFIG.playerRadius * 2 - distance) * 0.5;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    a.vx -= nx * VOLT_VAULT_CONFIG.collisionImpulse;
    a.vy -= ny * VOLT_VAULT_CONFIG.collisionImpulse;
    b.vx += nx * VOLT_VAULT_CONFIG.collisionImpulse;
    b.vy += ny * VOLT_VAULT_CONFIG.collisionImpulse;
  }
}
function resolveResult(state) {
  const alive = Object.entries(state.players).filter(([, player]) => player.alive);
  const solo = Object.keys(state.players).length === 1;
  if ((alive.length > 1 || solo && alive.length === 1) && state.tick < (state.tuning?.durationTicks ?? VOLT_VAULT_CONFIG.roundDurationTicks)) return;
  if (solo && alive.length === 0) {
    state.finished = true;
    state.winners = [];
    state.winnerId = null;
    return;
  }
  state.finished = true;
  const ranked = alive.length > 0 ? alive : Object.entries(state.players);
  const mostLives = Math.max(-1, ...ranked.map(([, player]) => player.lives));
  const finalists = ranked.filter(([, player]) => player.lives === mostLives);
  const best = Math.max(-1, ...finalists.map(([, player]) => player.survivalTicks));
  state.winners = finalists.filter(([, player]) => player.survivalTicks === best).map(([id]) => id).sort();
  state.winnerId = state.winners.length === 1 ? state.winners[0] : null;
}
function stepVoltVault(state, inputs) {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state);
  next.tick++;
  advanceHazard(next);
  movePlayers(next, inputs);
  damagePlayers(next);
  resolveResult(next);
  return next;
}
var practiceVoltVaultModule = practiceModule(
  "volt-vault",
  (id, seed) => createVoltVaultState([id], seed),
  (state, input) => {
    const id = Object.keys(state.players)[0];
    return stepVoltVault(state, { [id]: { sequence: input.sequence, x: input.x, y: input.y } });
  },
  (state) => ({ tick: state.tick, players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, alive: p.alive, lives: p.lives, invulnerableTicks: p.invulnerableTicks, survivalTicks: p.survivalTicks }])), hazard: { ...state.hazard, warningCells: state.hazard.warningCells.map((c) => [c.x, c.y]), activeCells: state.hazard.activeCells.map((c) => [c.x, c.y]) }, arenaHalfSize: VOLT_VAULT_CONFIG.arenaHalfSize, fastZoneX: VOLT_VAULT_CONFIG.fastZoneX, finished: state.finished }),
  (state) => state.finished || Object.values(state.players).every((p) => !p.alive)
);

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

// lib/arcade/upgrades/volt-vault.ts
var VOLT_ARENAS = [{ id: "circuit", name: "Circuit Court", skill: "Read yellow warnings and route away before the red electrical pulse." }, { id: "polarity", name: "Polarity Palace", skill: "Controls reverse on alternating cycles. Watch the polarity indicator and countersteer." }, { id: "gyre", name: "Dynamo Gyre", skill: "The floor circulates clockwise. Brake against the flow while avoiding telegraphed shocks." }];
function createVoltMatch(ids, seed, input) {
  const options = normalizeArenaOptions(input, VOLT_ARENAS), core = createVoltVaultState([...new Set(ids)].slice(0, 10), seed, { capacity: 10, durationTicks: options.duration * 30, controlMode: options.arena === "polarity" ? "alternate" : "never" });
  for (const p of Object.values(core.players)) p.lives = options.health;
  core.hazard.warningTicksRemaining = Math.round(39 / options.hazards);
  return { core, options };
}
function stepVoltMatch(s, inputs) {
  if (s.core.finished) return structuredClone(s);
  const n = structuredClone(s);
  n.core.hazard.reverseControls = n.options.arena === "polarity" && n.core.hazard.cycleIndex % 2 === 1;
  if (n.options.arena === "gyre") for (const p of Object.values(n.core.players)) {
    if (!p.alive) continue;
    p.vx -= p.y * 0.025 * n.options.hazards;
    p.vy += p.x * 0.025 * n.options.hazards;
  }
  n.core = stepVoltVault(n.core, inputs);
  if (n.core.hazard.phase === "warning" && n.core.hazard.cycleIndex !== s.core.hazard.cycleIndex) n.core.hazard.warningTicksRemaining = Math.max(10, Math.round(n.core.hazard.warningTicksRemaining / n.options.hazards));
  n.core.hazard.reverseControls = n.options.arena === "polarity" && n.core.hazard.cycleIndex % 2 === 1;
  return n;
}
function voltBotInput(s, id) {
  const p = s.core.players[id], sequence = s.core.tick + 1;
  if (!p.alive) return { sequence, x: 0, y: 0 };
  const h = s.core.hazard, threat = h.phase === "danger" ? h.activeCells : h.phase === "warning" ? h.warningCells : [], index = Object.keys(s.core.players).indexOf(id);
  let best = -Infinity, tx = p.x, ty = p.y;
  for (let y2 = -4; y2 <= 4; y2 += 2) for (let x2 = -4; x2 <= 4; x2 += 2) {
    const safe = Math.min(8, ...threat.map((q) => Math.hypot(q.x - x2, q.y - y2)));
    if (safe < 1.6) continue;
    const crowd = Object.entries(s.core.players).filter(([key, q]) => key !== id && q.alive && Math.hypot(q.x - x2, q.y - y2) < 1).length;
    const d2 = Math.hypot(x2 - p.x, y2 - p.y), score = -d2 * 3 - crowd * 2 + safe * 0.35 + Math.sin(index * 2.4 + x2 + y2) * 0.2;
    if (score > best) {
      best = score;
      tx = x2;
      ty = y2;
    }
  }
  if (s.options.difficulty === "easy" && (s.core.tick + index) % 9 !== 0) return { sequence, x: 0, y: 0 };
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), v = Math.min(s.options.difficulty === "hard" ? 4.6 : 3.4, d * 4), x = dx / Math.max(0.01, d) * v - p.vx * 1.6, y = dy / Math.max(0.01, d) * v - p.vy * 1.6, m = Math.max(1, Math.hypot(x, y)), reverse = h.reverseControls ? -1 : 1;
  return { sequence, x: x / m * reverse, y: y / m * reverse };
}
var VOLT_GAME = {
  id: "volt-vault",
  title: "Volt Vault \xB7 Polarity Palace",
  summary: "Read electrical telegraphs, learn reverse controls and counter the dynamo flow. Ten-contestant survival cups with adjustable lives and warning pressure.",
  arenas: VOLT_ARENAS,
  defaults: { ...ARENA_DEFAULTS, arena: "circuit" },
  fields: arenaFields(VOLT_ARENAS),
  create: createVoltMatch,
  step: stepVoltMatch,
  bot: voltBotInput,
  frame: (s) => ({ tick: s.core.tick, finished: s.core.finished, winners: s.core.winners, radius: 7.2, bounds: { x: 5, y: 5 }, theme: { sky: 1252921, floor: 9351884, rim: 3693943 }, actors: Object.entries(s.core.players).map(([id, p]) => ({ id, x: p.x, y: p.y, alive: p.alive, health: p.lives, maxHealth: s.options.health, invulnerable: p.invulnerableTicks > 0, heading: Math.atan2(p.vx, p.vy) })), objects: (s.core.hazard.phase === "danger" ? s.core.hazard.activeCells : s.core.hazard.phase === "warning" ? s.core.hazard.warningCells : []).map((q, i) => ({ id: "cell-" + i, kind: "tile", ...q, radius: 0.86, color: s.core.hazard.phase === "danger" ? 16736866 : 16767051, warning: s.core.hazard.phase === "danger" })), status: (s.core.hazard.reverseControls ? "REVERSED CONTROLS \xB7 " : "") + (s.options.arena === "gyre" ? "Clockwise flow \xB7 " : "") + (s.core.hazard.phase === "warning" ? "Yellow \u2192 shock in " + (s.core.hazard.warningTicksRemaining / 30).toFixed(1) + "s" : s.core.hazard.phase === "danger" ? "RED \xB7 energized cells" : "Recharge \xB7 prepare the next escape"), skill: VOLT_ARENAS.find((a) => a.id === s.options.arena).skill }),
  controls: []
};
export {
  VOLT_ARENAS,
  VOLT_GAME,
  createVoltMatch,
  stepVoltMatch,
  voltBotInput
};
