import type { ArcadeGameContext, ArcadeGameModule, ArcadePlayerInput, ArcadePublicSnapshot } from "./types";

export const AIR_HOCKEY_STEP_MS = 1000 / 60;
export const AIR_HOCKEY_SNAPSHOT_EVERY_TICKS = 3;
export const AIR_HOCKEY_INPUT_INTERVAL_MS = 34;
export const AIR_HOCKEY_MATCH_MS = 90_000;
export const AIR_HOCKEY_TARGET_SCORE = 7;

const TABLE = { width: 1000, height: 600, puckRadius: 16, paddleRadius: 32, goalTop: 210, goalBottom: 390 } as const;
const MAX_PUCK_SPEED = 850;

export interface AirHockeyInput { seq: number; x: number; y: number }
export interface AirHockeyState {
  seed: string;
  startedAt: number;
  deadlineAt: number;
  status: "active" | "complete";
  pausedAt: number | null;
  playerIds: string[];
  paddles: Array<{ playerId: string; x: number; y: number }>;
  puck: { x: number; y: number; vx: number; vy: number; serveTicks: number };
  score: Record<string, number>;
  tick: number;
  goalCount: number;
  lastInput: Record<string, { seq: number; at: number; x: number; y: number }>;
  emittedEventIds: string[];
  tied: boolean;
}

function initialPuck(seed: string): AirHockeyState["puck"] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  const direction = (hash >>> 0) % 2 === 0 ? 1 : -1;
  return { x: TABLE.width / 2, y: TABLE.height / 2, vx: direction * 300, vy: 0, serveTicks: 45 };
}

export function createAirHockeyState(seed: string, now: number, playerIds: readonly string[] = ["player-1", "player-2"]): AirHockeyState {
  if (!seed || seed.length > 120 || !Number.isFinite(now) || !Array.isArray(playerIds) || playerIds.length < 2 || playerIds.length > 10 || new Set(playerIds).size !== playerIds.length || playerIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 120)) throw new Error("INVALID_MATCH");
  return {
    seed, startedAt: now, deadlineAt: now + AIR_HOCKEY_MATCH_MS, status: "active", pausedAt: null, playerIds: [...playerIds],
    paddles: playerIds.map((playerId, index) => {
      const teamSize = playerIds.filter((_, i) => i % 2 === index % 2).length;
      return { playerId, x: index % 2 === 0 ? 125 : TABLE.width - 125, y: TABLE.height * (Math.floor(index / 2) + 1) / (teamSize + 1) };
    }),
    puck: initialPuck(seed), score: Object.fromEntries(playerIds.map((id) => [id, 0])), tick: 0, goalCount: 0,
    lastInput: {}, emittedEventIds: [], tied: false,
  };
}

export function applyAirHockeyInput(state: AirHockeyState, playerId: string, input: AirHockeyInput, now: number): void {
  const playerIndex = state.playerIds.indexOf(playerId);
  if (playerIndex < 0) throw new Error("WRONG_PLAYER");
  if (state.status !== "active" || now >= state.deadlineAt) throw new Error("MATCH_COMPLETE");
  if (state.pausedAt !== null) throw new Error("MATCH_PAUSED");
  if (!Number.isSafeInteger(input.seq) || !Number.isFinite(input.x) || !Number.isFinite(input.y) || input.x < 0 || input.x > 1 || input.y < 0 || input.y > 1 || !Number.isFinite(now) || now < state.startedAt) throw new Error("INVALID_INPUT");
  const previous = state.lastInput[playerId];
  if (previous && input.seq <= previous.seq) throw new Error("STALE_INPUT");
  const changed = !previous || input.x !== previous.x || input.y !== previous.y;
  if (!changed) {
    state.lastInput[playerId] = { ...previous!, seq: input.seq };
    return;
  }
  if (previous && now - previous.at < AIR_HOCKEY_INPUT_INTERVAL_MS) throw new Error("INPUT_RATE_LIMITED");
  const halfStart = playerIndex % 2 === 0 ? TABLE.paddleRadius : TABLE.width / 2 + TABLE.paddleRadius;
  const halfEnd = playerIndex % 2 === 0 ? TABLE.width / 2 - TABLE.paddleRadius : TABLE.width - TABLE.paddleRadius;
  const paddle = state.paddles[playerIndex]!;
  paddle.x = halfStart + input.x * (halfEnd - halfStart);
  paddle.y = TABLE.paddleRadius + input.y * (TABLE.height - TABLE.paddleRadius * 2);
  state.lastInput[playerId] = { seq: input.seq, at: now, x: input.x, y: input.y };
}

function emitOnce(state: AirHockeyState, event: Record<string, unknown>, emit?: (event: Record<string, unknown>) => void): void {
  const eventId = String(event.eventId);
  if (state.emittedEventIds.includes(eventId)) return;
  state.emittedEventIds.push(eventId);
  if (emit) emit(event);
}

function completeMatch(state: AirHockeyState, now: number, emit?: (event: Record<string, unknown>) => void): void {
  if (state.status === "complete") return;
  state.status = "complete";
  const [left, right] = state.playerIds;
  const leftScore = state.score[left]!;
  const rightScore = state.score[right]!;
  const winners = leftScore === rightScore ? [] : state.playerIds.filter((_, index) => index % 2 === (leftScore > rightScore ? 0 : 1));
  state.tied = winners.length === 0;
  emitOnce(state, {
    eventId: `${state.seed}:final`, type: "result", playerId: null, points: 0, occurredAt: Math.trunc(now),
    payload: { winners, tied: state.tied, score: { ...state.score } },
  }, emit);
}

function scoreGoal(state: AirHockeyState, concedingPlayerId: string, now: number, emit?: (event: Record<string, unknown>) => void): void {
  const scoringSide = state.playerIds.indexOf(concedingPlayerId) % 2 === 0 ? 1 : 0;
  const scoringPlayerIds = state.playerIds.filter((_, index) => index % 2 === scoringSide);
  const scorer = scoringPlayerIds[0]!;
  state.goalCount += 1;
  for (const id of scoringPlayerIds) state.score[id] = (state.score[id] ?? 0) + 1;
  emitOnce(state, {
    eventId: `${state.seed}:goal:${state.goalCount}`, type: "goal", playerId: scorer, points: 1,
    occurredAt: Math.trunc(now), payload: { score: { ...state.score }, goal: state.goalCount, scoringPlayerIds },
  }, emit);
  state.puck = { x: TABLE.width / 2, y: TABLE.height / 2, vx: scorer === state.playerIds[0] ? 300 : -300, vy: 0, serveTicks: 45 };
  if (state.score[scorer]! >= AIR_HOCKEY_TARGET_SCORE) completeMatch(state, now, emit);
}

export function stepAirHockey(state: AirHockeyState, fixedStepMs: number, now: number, emit?: (event: Record<string, unknown>) => void): void {
  if (!Number.isFinite(fixedStepMs) || fixedStepMs <= 0 || fixedStepMs > AIR_HOCKEY_STEP_MS + 0.001) throw new Error("INVALID_FIXED_STEP");
  if (state.status === "complete" || state.pausedAt !== null) return;
  state.tick += 1;
  if (now >= state.deadlineAt) { completeMatch(state, state.deadlineAt, emit); return; }

  const puck = state.puck;
  if (puck.serveTicks > 0) puck.serveTicks -= 1;
  else {
    const dt = fixedStepMs / 1000;
    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;
    if (puck.y < TABLE.puckRadius) { puck.y = TABLE.puckRadius; puck.vy = Math.abs(puck.vy); }
    if (puck.y > TABLE.height - TABLE.puckRadius) { puck.y = TABLE.height - TABLE.puckRadius; puck.vy = -Math.abs(puck.vy); }
    if (puck.x <= 0 && puck.y >= TABLE.goalTop && puck.y <= TABLE.goalBottom) { scoreGoal(state, state.playerIds[0], now, emit); return; }
    if (puck.x >= TABLE.width && puck.y >= TABLE.goalTop && puck.y <= TABLE.goalBottom) { scoreGoal(state, state.playerIds[1], now, emit); return; }
    if (puck.x < TABLE.puckRadius) { puck.x = TABLE.puckRadius; puck.vx = Math.abs(puck.vx); }
    if (puck.x > TABLE.width - TABLE.puckRadius) { puck.x = TABLE.width - TABLE.puckRadius; puck.vx = -Math.abs(puck.vx); }

    for (const paddle of state.paddles) {
      const dx = puck.x - paddle.x;
      const dy = puck.y - paddle.y;
      const distanceSquared = dx * dx + dy * dy;
      const minimumDistance = TABLE.puckRadius + TABLE.paddleRadius;
      if (distanceSquared >= minimumDistance * minimumDistance) continue;
      const distance = Math.sqrt(distanceSquared) || 1;
      const nx = dx / distance;
      const ny = dy / distance;
      puck.x = paddle.x + nx * minimumDistance;
      puck.y = paddle.y + ny * minimumDistance;
      const velocityAlongNormal = puck.vx * nx + puck.vy * ny;
      if (velocityAlongNormal < 0) {
        puck.vx -= 2 * velocityAlongNormal * nx;
        puck.vy -= 2 * velocityAlongNormal * ny;
      }
      const speed = Math.hypot(puck.vx, puck.vy);
      if (speed > MAX_PUCK_SPEED) { puck.vx *= MAX_PUCK_SPEED / speed; puck.vy *= MAX_PUCK_SPEED / speed; }
      if (speed < 300) { puck.vx *= 300 / (speed || 1); puck.vy *= 300 / (speed || 1); }
    }
  }
}

export function pauseAirHockey(state: AirHockeyState, now: number): void {
  if (state.status !== "active" || state.pausedAt !== null || !Number.isFinite(now) || now < state.startedAt || now >= state.deadlineAt) throw new Error("INVALID_PAUSE");
  state.pausedAt = now;
}

export function resumeAirHockey(state: AirHockeyState, now: number): void {
  if (state.status !== "active" || state.pausedAt === null || !Number.isFinite(now) || now < state.pausedAt) throw new Error("INVALID_RESUME");
  state.deadlineAt += now - state.pausedAt;
  state.pausedAt = null;
}

export function toAirHockeySnapshot(state: AirHockeyState, tick: number): ArcadePublicSnapshot {
  return {
    v: 1, gameId: "air-hockey", tick,
    state: {
      width: TABLE.width, height: TABLE.height, goalTop: TABLE.goalTop, goalBottom: TABLE.goalBottom,
      players: [...state.playerIds], teams: { left: state.playerIds.filter((_, i) => i % 2 === 0), right: state.playerIds.filter((_, i) => i % 2 === 1) }, paddles: state.paddles.map((paddle) => ({ ...paddle })),
      puck: { x: state.puck.x, y: state.puck.y }, score: { ...state.score },
      deadlineAt: state.deadlineAt, status: state.status, tied: state.tied,
    },
  };
}

function finalResult(state: AirHockeyState): { winners: string[]; tied: boolean; score: Record<string, number> } | null {
  if (state.status !== "complete") return null;
  const [left, right] = state.playerIds;
  const leftScore = state.score[left]!;
  const rightScore = state.score[right]!;
  return { winners: leftScore === rightScore ? [] : state.playerIds.filter((_, index) => index % 2 === (leftScore > rightScore ? 0 : 1)), tied: leftScore === rightScore, score: { ...state.score } };
}

export const airHockeyGame: Omit<ArcadeGameModule, "finalResult"> & { finalResult: (state: AirHockeyState) => ReturnType<typeof finalResult> } = {
  id: "air-hockey",
  minPlayers: 2,
  maxPlayers: 10,
  inputKinds: ["position"],
  inputCooldownMs: AIR_HOCKEY_INPUT_INTERVAL_MS,
  createState: (seed, now, playerIds) => createAirHockeyState(seed ?? "air-hockey", now ?? Date.now(), playerIds ?? ["player-1", "player-2"]),
  applyInput: (unknownState: unknown, input: ArcadePlayerInput, context: ArcadeGameContext) => {
    const state = unknownState as AirHockeyState;
    if (input.kind !== "position") throw new Error("INVALID_INPUT_KIND");
    applyAirHockeyInput(state, input.playerId, input, context.now);
    return state;
  },
  step: (unknownState, fixedStepMs, context) => stepAirHockey(unknownState as AirHockeyState, fixedStepMs, context.now, context.emit),
  snapshot: (state, tick) => toAirHockeySnapshot(state as AirHockeyState, tick),
  finalResult: (state) => finalResult(state as AirHockeyState),
  pause: (state, now) => { pauseAirHockey(state as AirHockeyState, now); return state; },
  resume: (state, now) => { resumeAirHockey(state as AirHockeyState, now); return state; },
};
