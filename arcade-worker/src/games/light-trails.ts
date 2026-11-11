import type { ArcadeGameContext, ArcadeGameModule, ArcadePlayerInput, ArcadePublicSnapshot, ArcadeViewer } from "./types";

/** King Prompter-native, server-simulated light-cycle arena. */
export const LIGHT_TRAILS_WIDTH = 64;
export const LIGHT_TRAILS_HEIGHT = 36;
export const LIGHT_TRAILS_STEP_MS = 1000 / 10;
export const LIGHT_TRAILS_INPUT_COOLDOWN_MS = 100;
export const LIGHT_TRAILS_MATCH_MS = 90_000;

export type LightTrailsDirection = "up" | "right" | "down" | "left";
export interface LightTrailsRider { playerId: string; x: number; y: number; direction: LightTrailsDirection; alive: boolean; distance: number }
export interface LightTrailsState {
  v: 1;
  matchId: string;
  startedAt: number;
  deadlineAt: number;
  pausedAt: number | null;
  status: "active" | "complete";
  tick: number;
  movementAccumulatorMs: number;
  riders: LightTrailsRider[];
  /** 0 is empty; 1..10 identify the rider that first claimed a cell. */
  trail: number[];
  lastInput: Record<string, { seq: number; at: number }>;
  winners: string[];
  tied: boolean;
  completedAt: number | null;
}

const SPAWNS: ReadonlyArray<{ x: number; y: number; direction: LightTrailsDirection }> = [
  { x: 4, y: 4, direction: "right" },
  { x: 59, y: 31, direction: "left" },
  { x: 4, y: 31, direction: "right" },
  { x: 59, y: 4, direction: "left" },
  { x: 32, y: 2, direction: "down" },
  { x: 32, y: 33, direction: "up" },
  { x: 2, y: 18, direction: "right" },
  { x: 61, y: 18, direction: "left" },
  { x: 16, y: 2, direction: "down" },
  { x: 47, y: 33, direction: "up" },
];
const DELTA: Record<LightTrailsDirection, { x: number; y: number }> = {
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
const OPPOSITE: Record<LightTrailsDirection, LightTrailsDirection> = { up: "down", right: "left", down: "up", left: "right" };

function validPlayers(playerIds: readonly string[]): boolean {
  return playerIds.length >= 2 && playerIds.length <= 10 && playerIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 120) && new Set(playerIds).size === playerIds.length;
}

export function createLightTrailsState(matchId: string, now: number, playerIds: readonly string[]): LightTrailsState {
  if (typeof matchId !== "string" || matchId.length < 1 || matchId.length > 120 || !Number.isFinite(now) || !validPlayers(playerIds)) throw new Error("INVALID_MATCH");
  const trail = Array<number>(LIGHT_TRAILS_WIDTH * LIGHT_TRAILS_HEIGHT).fill(0);
  const riders = playerIds.map((playerId, index) => {
    const spawn = SPAWNS[index]!;
    trail[spawn.y * LIGHT_TRAILS_WIDTH + spawn.x] = index + 1;
    return { playerId, ...spawn, alive: true, distance: 0 };
  });
  return { v: 1, matchId, startedAt: now, deadlineAt: now + LIGHT_TRAILS_MATCH_MS, pausedAt: null, status: "active", tick: 0, movementAccumulatorMs: 0, riders, trail, lastInput: {}, winners: [], tied: false, completedAt: null };
}

function validState(state: LightTrailsState): boolean {
  return !!state && state.v === 1 && typeof state.matchId === "string" && state.matchId.length > 0 && state.matchId.length <= 120 &&
    Number.isFinite(state.startedAt) && Number.isFinite(state.deadlineAt) && state.deadlineAt >= state.startedAt &&
    (state.pausedAt === null || (Number.isFinite(state.pausedAt) && state.pausedAt >= state.startedAt)) && (state.status === "active" || state.status === "complete") &&
    Number.isSafeInteger(state.tick) && state.tick >= 0 && Number.isFinite(state.movementAccumulatorMs) && state.movementAccumulatorMs >= 0 && state.movementAccumulatorMs < LIGHT_TRAILS_STEP_MS && Array.isArray(state.riders) && state.riders.length >= 2 && state.riders.length <= 10 &&
    state.riders.every((rider) => typeof rider.playerId === "string" && rider.playerId.length > 0 && Number.isSafeInteger(rider.x) && Number.isSafeInteger(rider.y) &&
      rider.x >= 0 && rider.x < LIGHT_TRAILS_WIDTH && rider.y >= 0 && rider.y < LIGHT_TRAILS_HEIGHT &&
      ["up", "right", "down", "left"].includes(rider.direction) && typeof rider.alive === "boolean" && Number.isSafeInteger(rider.distance) && rider.distance >= 0) &&
    new Set(state.riders.map((rider) => rider.playerId)).size === state.riders.length && Array.isArray(state.trail) && state.trail.length === LIGHT_TRAILS_WIDTH * LIGHT_TRAILS_HEIGHT &&
    state.trail.every((owner) => Number.isInteger(owner) && owner >= 0 && owner <= state.riders.length) && state.lastInput !== null && typeof state.lastInput === "object" &&
    Object.entries(state.lastInput).every(([playerId, input]) => state.riders.some((rider) => rider.playerId === playerId) && input !== null && typeof input === "object" &&
      Number.isSafeInteger(input.seq) && input.seq >= 0 && Number.isFinite(input.at) && input.at >= state.startedAt) &&
    Array.isArray(state.winners) && state.winners.every((playerId) => state.riders.some((rider) => rider.playerId === playerId)) && new Set(state.winners).size === state.winners.length &&
    typeof state.tied === "boolean" && (state.completedAt === null || Number.isFinite(state.completedAt)) &&
    (state.status === "active" ? state.completedAt === null && state.winners.length === 0 : state.completedAt !== null);
}

function stateOrThrow(unknownState: unknown): LightTrailsState {
  if (!validState(unknownState as LightTrailsState)) throw new Error("INVALID_STATE");
  return unknownState as LightTrailsState;
}

function inputDirection(input: ArcadePlayerInput): LightTrailsDirection | null {
  if (input.kind !== "position") return null;
  const dx = input.x - 0.5;
  const dy = input.y - 0.5;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 0.16) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function validatePosition(state: LightTrailsState, input: ArcadePlayerInput, now: number): boolean {
  if (input.kind !== "position" || !Number.isSafeInteger(input.seq) || input.seq < 0 || !Number.isFinite(input.x) || input.x < 0 || input.x > 1 ||
      !Number.isFinite(input.y) || input.y < 0 || input.y > 1 || !Number.isFinite(now) || now < state.startedAt || now >= state.deadlineAt ||
      state.status !== "active" || state.pausedAt !== null) return false;
  const rider = state.riders.find((candidate) => candidate.playerId === input.playerId);
  const previous = state.lastInput[input.playerId];
  if (!rider?.alive || (previous && (input.seq <= previous.seq || now - previous.at < LIGHT_TRAILS_INPUT_COOLDOWN_MS))) return false;
  const direction = inputDirection(input);
  return !direction || direction !== OPPOSITE[rider.direction];
}

export function applyLightTrailsInput(unknownState: unknown, input: ArcadePlayerInput, context: ArcadeGameContext): LightTrailsState {
  const state = stateOrThrow(unknownState);
  if (!validatePosition(state, input, context.now)) throw new Error("INVALID_INPUT");
  const rider = state.riders.find((candidate) => candidate.playerId === input.playerId)!;
  const direction = inputDirection(input);
  if (direction) rider.direction = direction;
  state.lastInput[input.playerId] = { seq: input.seq, at: context.now };
  return state;
}

function finish(state: LightTrailsState, now: number, emit?: ArcadeGameContext["emit"]): void {
  if (state.status === "complete") return;
  state.status = "complete";
  const survivors = state.riders.filter((rider) => rider.alive);
  const contenders = survivors.length ? survivors : state.riders;
  const longestRide = Math.max(...contenders.map((rider) => rider.distance));
  state.winners = contenders.filter((rider) => rider.distance === longestRide).map((rider) => rider.playerId);
  state.tied = state.winners.length !== 1;
  state.completedAt = now;
  emit?.({ eventId: `${state.matchId}:final`, type: "result", playerId: null, points: 0, occurredAt: Math.trunc(now), payload: { winners: [...state.winners], tied: state.tied, distance: distanceMap(state) } });
}

function distanceMap(state: LightTrailsState): Record<string, number> {
  return Object.fromEntries(state.riders.map((rider) => [rider.playerId, rider.distance]));
}

export function stepLightTrails(unknownState: unknown, fixedStepMs: number, context: ArcadeGameContext): LightTrailsState {
  const state = stateOrThrow(unknownState);
  if (!Number.isFinite(fixedStepMs) || fixedStepMs <= 0 || fixedStepMs > LIGHT_TRAILS_STEP_MS + 0.001 || !Number.isFinite(context.now)) throw new Error("INVALID_FIXED_STEP");
  if (state.status === "complete" || state.pausedAt !== null) return state;
  if (context.now >= state.deadlineAt) { finish(state, state.deadlineAt, context.emit); return state; }
  state.movementAccumulatorMs += fixedStepMs;
  if (state.movementAccumulatorMs + 0.001 < LIGHT_TRAILS_STEP_MS) return state;
  state.movementAccumulatorMs = Math.max(0, state.movementAccumulatorMs - LIGHT_TRAILS_STEP_MS);
  state.tick += 1;
  const moves = state.riders.filter((rider) => rider.alive).map((rider) => {
    const delta = DELTA[rider.direction];
    return { rider, x: rider.x + delta.x, y: rider.y + delta.y };
  });
  const destinations = new Map<string, number>();
  for (const move of moves) {
    const key = `${move.x},${move.y}`;
    destinations.set(key, (destinations.get(key) ?? 0) + 1);
  }
  const crashed = new Set<LightTrailsRider>();
  for (const move of moves) {
    const outside = move.x < 0 || move.x >= LIGHT_TRAILS_WIDTH || move.y < 0 || move.y >= LIGHT_TRAILS_HEIGHT;
    const occupied = !outside && state.trail[move.y * LIGHT_TRAILS_WIDTH + move.x] !== 0;
    if (outside || occupied || destinations.get(`${move.x},${move.y}`)! > 1) crashed.add(move.rider);
  }
  for (const move of moves) {
    const rider = move.rider;
    if (crashed.has(rider)) { rider.alive = false; continue; }
    rider.x = move.x;
    rider.y = move.y;
    rider.distance += 1;
    state.trail[rider.y * LIGHT_TRAILS_WIDTH + rider.x] = state.riders.indexOf(rider) + 1;
  }
  if (state.riders.filter((rider) => rider.alive).length <= 1) finish(state, context.now, context.emit);
  return state;
}

export function pauseLightTrails(unknownState: unknown, now: number): LightTrailsState {
  const state = stateOrThrow(unknownState);
  if (state.status !== "active" || state.pausedAt !== null || !Number.isFinite(now) || now < state.startedAt || now >= state.deadlineAt) throw new Error("INVALID_PAUSE");
  state.pausedAt = now;
  return state;
}

export function resumeLightTrails(unknownState: unknown, now: number): LightTrailsState {
  const state = stateOrThrow(unknownState);
  if (state.status !== "active" || state.pausedAt === null || !Number.isFinite(now) || now < state.pausedAt) throw new Error("INVALID_RESUME");
  state.deadlineAt += now - state.pausedAt;
  state.pausedAt = null;
  return state;
}

export function lightTrailsFinalResult(unknownState: unknown): { winners: string[]; tied: boolean; distance: Record<string, number> } | null {
  const state = stateOrThrow(unknownState);
  return state.status === "complete" ? { winners: [...state.winners], tied: state.tied, distance: distanceMap(state) } : null;
}

export function toLightTrailsSnapshot(unknownState: unknown, tick: number, viewer: ArcadeViewer): ArcadePublicSnapshot {
  const state = stateOrThrow(unknownState);
  return {
    v: 1, gameId: "light-trails", tick,
    state: {
      width: LIGHT_TRAILS_WIDTH, height: LIGHT_TRAILS_HEIGHT, status: state.status, paused: state.pausedAt !== null, deadlineAt: state.deadlineAt,
      riders: state.riders.map(({ playerId, x, y, direction, alive, distance }) => ({ playerId, x, y, direction, alive, distance })),
      trail: state.trail.map((owner) => owner.toString(36)).join(""), viewer: { role: viewer.role, playerId: viewer.playerId },
      ...(state.status === "complete" ? { result: lightTrailsFinalResult(state) } : {}),
    },
  };
}

export const lightTrailsGame: ArcadeGameModule & { finalResult: (state: unknown) => ReturnType<typeof lightTrailsFinalResult> } = {
  id: "light-trails", minPlayers: 2, maxPlayers: 10, inputKinds: ["position"], inputCooldownMs: LIGHT_TRAILS_INPUT_COOLDOWN_MS,
  snapshotEveryTicks: 6, persistEveryTicks: 6, persistInputImmediately: false, restoreLatestInputOnLoad: true,
  createState: (seed, now, playerIds) => createLightTrailsState(seed ?? "light-trails", now ?? Date.now(), playerIds ?? ["player-1", "player-2"]),
  validateInput: (unknownState, input, now) => { try { return validatePosition(stateOrThrow(unknownState), input, now); } catch { return false; } },
  applyInput: (state, input, context) => applyLightTrailsInput(state, input, context),
  step: (state, fixedStepMs, context) => stepLightTrails(state, fixedStepMs, context),
  snapshot: (state, tick, viewer) => toLightTrailsSnapshot(state, tick, viewer),
  finalResult: lightTrailsFinalResult,
  pause: (state, now) => pauseLightTrails(state, now),
  resume: (state, now) => resumeLightTrails(state, now),
};
