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

// lib/arcade/practice/games/rubble-alliance-config.ts
var RUBBLE_ALLIANCE_CONFIG = {
  fixedStepSeconds: 1 / 30,
  rounds: 3,
  roundDurationSeconds: 22,
  floorSize: 8,
  floorHalfExtent: 8,
  warningTicks: 36,
  fallingTicks: 8,
  roundTransitionTicks: 18,
  playerRadius: 0.36,
  acceleration: 5.2,
  maxSpeed: 4.8,
  drag: 0.975,
  boostMultiplier: 2.15,
  boostTicks: 10,
  boostCooldownTicks: 150,
  placementPoints: [5, 3, 1, 0]
};

// lib/arcade/practice/games/types.ts
function practiceModule(id, create, step, snapshot, terminal) {
  return { id, createState: create, step, snapshot, isTerminal: terminal };
}

// lib/arcade/practice/games/rubble-alliance.ts
function makeFloor() {
  return createDestructibleFloor(RUBBLE_ALLIANCE_CONFIG.floorSize, RUBBLE_ALLIANCE_CONFIG.floorHalfExtent, RUBBLE_ALLIANCE_CONFIG.warningTicks);
}
function makePlayers(ids, prior) {
  const players = {};
  const positions = [[-4.6, -4.6], [4.6, -4.6], [4.6, 4.6], [-4.6, 4.6]];
  [...ids].sort().forEach((id, index) => {
    const [x, y] = ids.length > 4 ? [Math.cos(index * Math.PI * 2 / ids.length) * 6, Math.sin(index * Math.PI * 2 / ids.length) * 6] : positions[index % positions.length];
    players[id] = { x, y, vx: 0, vy: 0, alive: true, lastInputSequence: -1, boostTicks: 0, boostCooldownTicks: 0, survivalTicks: 0, score: prior?.[id]?.score ?? 0 };
  });
  return players;
}
function createRubbleAllianceState(playerIds, seed, tuning) {
  const ids = [...new Set(playerIds)].sort();
  const players = makePlayers(ids);
  return {
    seed: seed | 0,
    tick: 0,
    roundIndex: 0,
    roundTick: 0,
    roundTransitionTicks: 0,
    floor: makeFloor(),
    players,
    eliminationOrder: [],
    roundScores: Object.fromEntries(ids.map((id) => [id, []])),
    finished: false,
    winnerId: null,
    winners: [],
    ...tuning ? { tuning } : {}
  };
}
function rankPlayers(state) {
  const alive = Object.entries(state.players).filter(([, p]) => p.alive).sort(([aId, a], [bId, b]) => b.survivalTicks - a.survivalTicks || aId.localeCompare(bId)).map(([id]) => id);
  return [...alive, ...[...state.eliminationOrder].reverse().filter((id) => !alive.includes(id))];
}
function finishRound(state) {
  const soloLost = Object.keys(state.players).length === 1 && !Object.values(state.players).some((player) => player.alive);
  if (soloLost) {
    state.roundIndex++;
    state.finished = true;
    state.winnerId = null;
    state.winners = [];
    return;
  }
  const order = rankPlayers(state);
  for (const [place, id] of order.entries()) {
    const tiedPlace = order.findIndex((candidate) => state.players[candidate].survivalTicks === state.players[id].survivalTicks);
    const points = order.length > 4 ? Math.max(0, order.length - tiedPlace - 1) : RUBBLE_ALLIANCE_CONFIG.placementPoints[place] ?? 0;
    state.players[id].score += points;
    state.roundScores[id].push(points);
  }
  state.roundIndex++;
  if (state.roundIndex >= (state.tuning?.rounds ?? RUBBLE_ALLIANCE_CONFIG.rounds)) {
    const highScore = Math.max(...Object.values(state.players).map((player) => player.score));
    state.winners = Object.entries(state.players).filter(([, player]) => player.score === highScore).map(([id]) => id).sort();
    state.winnerId = state.winners.length === 1 ? state.winners[0] : null;
    state.finished = true;
    return;
  }
  state.roundTransitionTicks = RUBBLE_ALLIANCE_CONFIG.roundTransitionTicks;
}
function beginNextRound(state) {
  state.players = makePlayers(Object.keys(state.players), state.players);
  state.floor = makeFloor();
  state.roundTick = 0;
  state.eliminationOrder = [];
}
function stepFloor(state) {
  const terminalStates = state.floor.tiles.map((tile) => tile.state === "falling" || tile.state === "gone" ? tile.state : null);
  for (let index = 0; index < terminalStates.length; index++) if (terminalStates[index]) state.floor.tiles[index].state = "destroyed";
  stepDestructibleFloor(state.floor);
  for (const [index, tile] of state.floor.tiles.entries()) {
    const terminal = terminalStates[index];
    if (terminal) {
      tile.state = terminal;
      if (terminal === "falling") {
        tile.ticksRemaining = Math.max(0, tile.ticksRemaining - 1);
        if (tile.ticksRemaining === 0) tile.state = "gone";
      }
      continue;
    }
    if (tile.state === "destroyed") {
      tile.state = "falling";
      tile.ticksRemaining = RUBBLE_ALLIANCE_CONFIG.fallingTicks;
    } else if (tile.state === "falling") {
      tile.ticksRemaining = Math.max(0, tile.ticksRemaining - 1);
      if (tile.ticksRemaining === 0) tile.state = "gone";
    }
  }
}
function eliminatePlayersOnGaps(state) {
  for (const [id, player] of Object.entries(state.players)) {
    if (!player.alive) continue;
    const tile = tileIndexAt(state.floor, player.x, player.y);
    if (tile !== null && state.floor.tiles[tile]?.state === "gone") {
      player.alive = false;
      state.eliminationOrder.push(id);
    }
  }
  const remaining = Object.values(state.players).filter((player) => player.alive).length;
  return remaining === 0 || Object.keys(state.players).length > 1 && remaining === 1;
}
function stepRubbleAlliance(state, inputs) {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state), dt = RUBBLE_ALLIANCE_CONFIG.fixedStepSeconds;
  next.tick++;
  if (next.roundTransitionTicks > 0) {
    next.roundTransitionTicks--;
    if (next.roundTransitionTicks === 0) beginNextRound(next);
    return next;
  }
  next.roundTick++;
  stepFloor(next);
  for (const [id, player] of Object.entries(next.players)) {
    if (!player.alive) continue;
    player.boostCooldownTicks = Math.max(0, player.boostCooldownTicks - 1);
    const input = inputs[id];
    if (input && input.sequence > player.lastInputSequence) {
      player.lastInputSequence = input.sequence;
      if (input.action === "special" && player.boostCooldownTicks === 0) {
        player.boostTicks = RUBBLE_ALLIANCE_CONFIG.boostTicks;
        player.boostCooldownTicks = RUBBLE_ALLIANCE_CONFIG.boostCooldownTicks;
        player.vx *= RUBBLE_ALLIANCE_CONFIG.boostMultiplier;
        player.vy *= RUBBLE_ALLIANCE_CONFIG.boostMultiplier;
      }
      const x = Number.isFinite(input.x) ? Math.max(-1, Math.min(1, input.x)) : 0;
      const y = Number.isFinite(input.y) ? Math.max(-1, Math.min(1, input.y)) : 0;
      const magnitude = Math.hypot(x, y), scale = magnitude > 1 ? 1 / magnitude : 1;
      const acceleration = RUBBLE_ALLIANCE_CONFIG.acceleration * (player.boostTicks > 0 ? RUBBLE_ALLIANCE_CONFIG.boostMultiplier : 1);
      player.vx += x * scale * acceleration * dt;
      player.vy += y * scale * acceleration * dt;
    }
    const speed = Math.hypot(player.vx, player.vy), maxSpeed = RUBBLE_ALLIANCE_CONFIG.maxSpeed * (player.boostTicks > 0 ? RUBBLE_ALLIANCE_CONFIG.boostMultiplier : 1);
    if (speed > maxSpeed) {
      player.vx *= maxSpeed / speed;
      player.vy *= maxSpeed / speed;
    }
    player.x = Math.max(-RUBBLE_ALLIANCE_CONFIG.floorHalfExtent + RUBBLE_ALLIANCE_CONFIG.playerRadius, Math.min(RUBBLE_ALLIANCE_CONFIG.floorHalfExtent - RUBBLE_ALLIANCE_CONFIG.playerRadius, player.x + player.vx * dt));
    player.y = Math.max(-RUBBLE_ALLIANCE_CONFIG.floorHalfExtent + RUBBLE_ALLIANCE_CONFIG.playerRadius, Math.min(RUBBLE_ALLIANCE_CONFIG.floorHalfExtent - RUBBLE_ALLIANCE_CONFIG.playerRadius, player.y + player.vy * dt));
    player.vx *= RUBBLE_ALLIANCE_CONFIG.drag;
    player.vy *= RUBBLE_ALLIANCE_CONFIG.drag;
    if (player.boostTicks > 0) player.boostTicks--;
    player.survivalTicks++;
    markFloorTile(next.floor, player.x, player.y);
  }
  const roundOver = eliminatePlayersOnGaps(next) || next.roundTick >= (next.tuning?.durationTicks ?? RUBBLE_ALLIANCE_CONFIG.roundDurationSeconds / dt);
  if (roundOver) finishRound(next);
  return next;
}
var practiceRubbleAllianceModule = practiceModule(
  "rubble-alliance",
  (id, seed) => createRubbleAllianceState([id], seed),
  (state, input) => {
    const id = Object.keys(state.players)[0];
    return stepRubbleAlliance(state, { [id]: { sequence: input.sequence, x: input.x, y: input.y, action: input.pressed?.includes("special") ? "special" : "none" } });
  },
  (state) => ({ seed: state.seed, tick: state.tick, roundIndex: state.roundIndex, roundTick: state.roundTick, roundTransitionTicks: state.roundTransitionTicks, floor: structuredClone(state.floor), players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, alive: p.alive, boostTicks: p.boostTicks, boostCooldownTicks: p.boostCooldownTicks, survivalTicks: p.survivalTicks }])), finished: state.finished }),
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

// lib/arcade/upgrades/rubble-alliance.ts
var RUBBLE_ARENAS = [{ id: "footprints", name: "Crumble Court", skill: "Keep a safe tile ahead of you. Boost to escape cracking ground, then let it recharge." }, { id: "pulse", name: "Faultline Foundry", skill: "Read the marked pulse row and cross it before the warning expires." }, { id: "islands", name: "Anchor Islands", skill: "Four central anchors survive for twenty seconds. Save nearby escape routes before their protection ends." }];
var anchors = [27, 28, 35, 36];
function modifiers(s) {
  const floor = s.core.floor;
  floor.warningTicks = Math.round(48 / s.options.hazards);
  if (s.options.arena === "islands") for (const i of anchors) {
    const t = floor.tiles[i];
    if (s.core.tick < 600) {
      t.state = "safe";
      t.ticksRemaining = 0;
    } else if (t.state === "safe") {
      t.state = "damaged";
      t.ticksRemaining = floor.warningTicks;
    }
  }
  if (s.options.arena === "pulse" && s.core.tick > 0 && s.core.tick % 120 === 0) {
    const row = Math.floor(s.core.tick / 120) % 8;
    for (let col = 0; col < 8; col++) {
      const t = floor.tiles[row * 8 + col];
      if (t.state === "safe") {
        t.state = "damaged";
        t.ticksRemaining = floor.warningTicks;
      }
    }
  }
}
function createRubbleMatch(ids, seed, input) {
  const options = normalizeArenaOptions(input, RUBBLE_ARENAS), s = { options, core: createRubbleAllianceState([...new Set(ids)].slice(0, 10), seed, { rounds: 1, durationTicks: options.duration * 30 }) };
  modifiers(s);
  return s;
}
function stepRubbleMatch(s, inputs) {
  if (s.core.finished) return structuredClone(s);
  const n = structuredClone(s);
  modifiers(n);
  n.core = stepRubbleAlliance(n.core, inputs);
  if (n.options.arena === "islands" && n.core.tick < 600) for (const i of anchors) {
    n.core.floor.tiles[i].state = "safe";
    n.core.floor.tiles[i].ticksRemaining = 0;
  }
  return n;
}
function rubbleBotInput(s, id) {
  const p = s.core.players[id], sequence = s.core.tick + 1;
  if (!p.alive) return { sequence, x: 0, y: 0 };
  const grid = s.core.floor, cell = 2, row = Math.max(0, Math.min(7, Math.floor((p.y + 8) / cell))), col = Math.max(0, Math.min(7, Math.floor((p.x + 8) / cell)));
  let best = -Infinity, tx = p.x, ty = p.y;
  for (let r = Math.max(0, row - 1); r <= Math.min(7, row + 1); r++) for (let c = Math.max(0, col - 1); c <= Math.min(7, col + 1); c++) {
    const tile = grid.tiles[r * 8 + c];
    if (tile.state === "gone" || tile.state === "falling") continue;
    const x2 = -7 + c * 2, y2 = -7 + r * 2, d2 = Math.hypot(x2 - p.x, y2 - p.y);
    const available = tile.state === "safe" ? grid.warningTicks : tile.ticksRemaining;
    if (available < d2 * 9 + 5) continue;
    const crowd = Object.entries(s.core.players).filter(([key, q]) => key !== id && q.alive && Math.hypot(q.x - x2, q.y - y2) < 1.4).length;
    const score = (tile.state === "safe" ? 80 : available) - d2 * 8 - crowd * 15 + Math.sin((s.core.seed + r * 8 + c + Number(id)) * 2.73) * 2;
    if (score > best) {
      best = score;
      tx = x2;
      ty = y2;
    }
  }
  let x = tx - p.x, y = ty - p.y;
  const d = Math.hypot(x, y), speed = d < 0.3 ? 0 : s.options.difficulty === "easy" ? 3.2 : s.options.difficulty === "hard" ? 4.6 : 4.1;
  x = x / Math.max(0.01, d) * speed - p.vx;
  y = y / Math.max(0.01, d) * speed - p.vy;
  const own = grid.tiles[row * 8 + col], action = own.state !== "safe" && own.ticksRemaining < 22 && d > 1.1 && p.boostCooldownTicks === 0 ? "special" : "none";
  const m = Math.max(1, Math.hypot(x, y));
  return { sequence, x: x / m, y: y / m, action };
}
var RUBBLE_GAME = {
  id: "rubble-alliance",
  title: "Rubble Alliance \xB7 Faultline Run",
  summary: "Leave cracking footprints, route around gaps and save your boost. Ten-contestant survival cups with three changing floor rules.",
  arenas: RUBBLE_ARENAS,
  defaults: { ...ARENA_DEFAULTS, arena: "footprints", duration: 30 },
  fields: arenaFields(RUBBLE_ARENAS).filter((f) => f.id !== "health"),
  create: createRubbleMatch,
  step: stepRubbleMatch,
  bot: rubbleBotInput,
  frame: (s) => ({ tick: s.core.tick, finished: s.core.finished, winners: s.core.winners, radius: 11.4, bounds: { x: 8, y: 8 }, theme: { sky: 2103595, floor: s.options.arena === "islands" ? 9488059 : 13350555, rim: 5066860 }, floor: s.core.floor, actors: Object.entries(s.core.players).map(([id, p]) => ({ id, x: p.x, y: p.y, alive: p.alive, health: 1, maxHealth: 1, heading: Math.atan2(p.vx, p.vy), score: p.score })), objects: s.options.arena === "islands" && s.core.tick < 600 ? anchors.map((i) => ({ id: "anchor-" + i, kind: "wave", x: -7 + i % 8 * 2, y: -7 + Math.floor(i / 8) * 2, radius: 0.85, color: 6616004 })) : [], status: s.options.arena === "islands" ? "Anchors " + Math.max(0, 20 - Math.floor(s.core.tick / 30)) + "s \xB7 plan your escape" : s.options.arena === "pulse" ? "Pulse row " + (Math.floor(s.core.tick / 120) % 8 + 1) + " \xB7 boost E to escape" : "Every footprint crumbles \xB7 boost E \xB7 recharge five seconds", skill: RUBBLE_ARENAS.find((a) => a.id === s.options.arena).skill }),
  controls: [{ action: "special", label: "Boost", key: "KeyE" }]
};
export {
  RUBBLE_ARENAS,
  RUBBLE_GAME,
  createRubbleMatch,
  rubbleBotInput,
  stepRubbleMatch
};
