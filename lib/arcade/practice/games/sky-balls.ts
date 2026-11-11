import { SKY_BALLS_CONFIG as C } from "./sky-balls-config";
import type { ArcadeInput } from "./types";

export type SkyBallsSide = "top" | "right" | "bottom" | "left";
export interface SkyBallsPlayer { side: SkyBallsSide; paddle: number; health: number; alive: boolean; lastInputSequence: number }
export interface SkyBallsBall { id: number; x: number; y: number; vx: number; vy: number }
export interface SkyBallsTilt { x: number; y: number; ticksRemaining: number }
export interface SkyBallsState {
  seed: number; tick: number; elapsedTicks: number; players: Record<string, SkyBallsPlayer>; balls: SkyBallsBall[];
  tilt: SkyBallsTilt | null; tiltWarningTicks: number; nextTiltTick: number; tiltIndex: number;
  nextBallTick: number; nextBallId: number; failedCorner: number; finished: boolean; winnerId: string | null; draw: boolean; goalCount: number;
}

const SIDES: readonly SkyBallsSide[] = ["top", "right", "bottom", "left"];
const SEATS: Readonly<Record<number, readonly SkyBallsSide[]>> = {
  1: ["left"],
  2: ["left", "right"], 3: ["top", "right", "bottom"], 4: SIDES,
};
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));

function randomUnit(seed: number, index: number): number {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b9)) | 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return (x >>> 0) / 0x1_0000_0000;
}

function newBall(seed: number, id: number, goalCount: number): SkyBallsBall {
  const angle = randomUnit(seed, id + goalCount * 17) * Math.PI * 2;
  const offset = (randomUnit(seed, id + goalCount * 31 + 1) - 0.5) * 1.5;
  return { id, x: 0, y: 0, vx: Math.cos(angle) * C.ballSpeed, vy: Math.sin(angle) * C.ballSpeed + offset };
}

function launchBall(state: SkyBallsState): SkyBallsBall {
  const corner = state.nextBallId % 4;
  const x = corner === 0 || corner === 3 ? -1 : 1;
  const y = corner < 2 ? -1 : 1;
  const angle = Math.atan2(-y, -x) + (randomUnit(state.seed, state.nextBallId + 700) - 0.5) * Math.PI / 2;
  return { id: state.nextBallId++, x: x * (C.halfSize - C.ballRadius), y: y * (C.halfSize - C.ballRadius), vx: Math.cos(angle) * C.ballSpeed, vy: Math.sin(angle) * C.ballSpeed };
}

export function createSkyBallsState(playerIds: readonly string[], seed: number): SkyBallsState {
  const ids = [...new Set(playerIds)].sort().slice(0, 4);
  const seats = SEATS[ids.length] ?? [];
  const players: Record<string, SkyBallsPlayer> = {};
  ids.forEach((id, i) => { players[id] = { side: seats[i]!, paddle: 0, health: C.startingHealth, alive: true, lastInputSequence: -1 }; });
  const normalizedSeed = seed | 0;
  const state: SkyBallsState = {
    seed: normalizedSeed, tick: 0, elapsedTicks: 0, players, balls: [], tilt: null, tiltWarningTicks: 0,
    nextTiltTick: C.firstTiltTick - C.tiltWarningTicks, tiltIndex: 0, nextBallTick: C.firstBallTick, nextBallId: 0,
    failedCorner: (normalizedSeed >>> 0) % 4, finished: false, winnerId: null, draw: false, goalCount: 0,
  };
  return state;
}

function playerAtSide(state: SkyBallsState, side: SkyBallsSide): [string, SkyBallsPlayer] | undefined {
  return Object.entries(state.players).find(([, p]) => p.side === side);
}

function startTilt(state: SkyBallsState): void {
  const failedEngine = (state.failedCorner + state.tiltIndex % 3) % 4;
  const angle = [Math.PI * 1.25, Math.PI * 1.75, Math.PI * 0.25, Math.PI * 0.75][failedEngine]!;
  state.tilt = { x: Math.cos(angle), y: Math.sin(angle), ticksRemaining: C.tiltDurationTicks };
  state.tiltIndex++;
  state.tiltWarningTicks = 0;
}

function reflectOnSide(ball: SkyBallsBall, side: SkyBallsSide, player: SkyBallsPlayer | undefined): boolean {
  const tangent = side === "left" || side === "right" ? ball.y : ball.x;
  const normal = side === "left" || side === "right" ? ball.x : ball.y;
  const boundary = C.halfSize - C.ballRadius;
  const crossed = side === "right" ? normal >= boundary : side === "left" ? normal <= -boundary : side === "bottom" ? normal >= boundary : normal <= -boundary;
  if (!crossed) return false;

  if (!player || !player.alive) {
    if (side === "left" || side === "right") { ball.x = side === "right" ? boundary : -boundary; ball.vx = -Math.abs(ball.vx) * (side === "right" ? 1 : -1); }
    else { ball.y = side === "bottom" ? boundary : -boundary; ball.vy = -Math.abs(ball.vy) * (side === "bottom" ? 1 : -1); }
    return false;
  }

  if (Math.abs(tangent - player.paddle) <= C.paddleHalfLength + C.ballRadius) {
    const offset = clamp((tangent - player.paddle) / C.paddleHalfLength, -1, 1) * C.paddleBounceInfluence;
    if (side === "left" || side === "right") {
      ball.x = side === "right" ? boundary : -boundary;
      ball.vx = side === "right" ? -Math.abs(ball.vx) : Math.abs(ball.vx);
      ball.vy += offset * C.ballSpeed;
    } else {
      ball.y = side === "bottom" ? boundary : -boundary;
      ball.vy = side === "bottom" ? -Math.abs(ball.vy) : Math.abs(ball.vy);
      ball.vx += offset * C.ballSpeed;
    }
    return false;
  }

  player.health = Math.max(0, player.health - 1);
  if (player.health === 0) player.alive = false;
  return true;
}

function finishIfNeeded(state: SkyBallsState): void {
  const alive = Object.entries(state.players).filter(([, p]) => p.alive);
  const solo = Object.keys(state.players).length === 1;
  if (alive.length === 0 || (!solo && alive.length === 1)) {
    state.finished = true;
    state.winnerId = alive[0]?.[0] ?? null;
    state.draw = alive.length === 0;
    return;
  }
}

function collideBalls(balls: SkyBallsBall[]): void {
  const diameter = C.ballRadius * 2;
  for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i]!, b = balls[j]!;
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
    if (distance < 1e-8 || distance >= diameter) continue;
    const nx = dx / distance, ny = dy / distance;
    const overlap = (diameter - distance) * 0.5;
    a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
    const relativeSpeed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (relativeSpeed < 0) { a.vx += nx * relativeSpeed; a.vy += ny * relativeSpeed; b.vx -= nx * relativeSpeed; b.vy -= ny * relativeSpeed; }
  }
}

export function stepSkyBalls(state: SkyBallsState, inputs: Readonly<Record<string, ArcadeInput>>): SkyBallsState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state);
  const dt = C.fixedStepSeconds;
  next.elapsedTicks++;

  if (next.tick >= next.nextBallTick && next.balls.length < C.maxBalls) {
    next.balls.push(launchBall(next));
    next.nextBallTick = next.tick + C.ballSpawnIntervalTicks;
  }

  if (next.tiltWarningTicks > 0) {
    next.tiltWarningTicks--;
    if (next.tiltWarningTicks === 0) startTilt(next);
  } else if (!next.tilt && next.tick + 1 >= next.nextTiltTick) {
    next.tiltWarningTicks = C.tiltWarningTicks;
  }

  for (const [id, player] of Object.entries(next.players)) {
    const input = inputs[id];
    if (!player.alive || !input || input.sequence <= player.lastInputSequence) continue;
    player.lastInputSequence = input.sequence;
    const axis = player.side === "left" || player.side === "right" ? input.y : input.x;
    player.paddle = clamp(player.paddle + clamp(axis, -1, 1) * C.paddleSpeed * dt, -C.paddleLimit, C.paddleLimit);
  }

  for (const ball of next.balls) {
    if (next.tilt) { ball.vx += next.tilt.x * C.tiltAcceleration * dt; ball.vy += next.tilt.y * C.tiltAcceleration * dt; }
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > C.maxTiltSpeed) { ball.vx *= C.maxTiltSpeed / speed; ball.vy *= C.maxTiltSpeed / speed; }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    // A corner crossing resolves both orthogonal sides in stable side order.
    for (const side of SIDES) {
      const defender = playerAtSide(next, side)?.[1];
      if (reflectOnSide(ball, side, defender)) {
        next.goalCount++;
        Object.assign(ball, newBall(next.seed, ball.id, next.goalCount));
      }
    }
  }

  if (next.tilt) {
    next.tilt.ticksRemaining--;
    if (next.tilt.ticksRemaining <= 0) {
      next.tilt = null;
      const gap = C.minTiltIntervalTicks + Math.floor(randomUnit(next.seed, 20_000 + next.tiltIndex) * (C.maxTiltIntervalTicks - C.minTiltIntervalTicks + 1));
      next.nextTiltTick = next.tick + gap - C.tiltWarningTicks;
    }
  }
  collideBalls(next.balls);
  next.tick++;
  finishIfNeeded(next);
  return next;
}

import { practiceModule } from "./types";
import type { PracticeInput } from "../types";
export const practiceSkyBallsModule = practiceModule("sky-balls", (id: string, seed: number) => createSkyBallsState([id], seed),
  (state, input: PracticeInput) => { const id = Object.keys(state.players)[0]!; return stepSkyBalls(state, { [id]: { sequence: input.sequence, x: input.x, y: input.y } }); },
  (state) => ({ seed: state.seed, tick: state.tick, elapsedTicks: state.elapsedTicks, players: structuredClone(state.players), balls: structuredClone(state.balls), tilt: structuredClone(state.tilt), tiltWarningTicks: state.tiltWarningTicks, nextTiltTick: state.nextTiltTick, nextBallTick: state.nextBallTick, failedCorner: state.failedCorner, finished: state.finished, goalCount: state.goalCount }),
  (state) => state.finished || Object.values(state.players).every((p) => !p.alive));
export default practiceSkyBallsModule;
