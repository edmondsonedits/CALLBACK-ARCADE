import type { ArcadeGameContext, ArcadeGameModule, ArcadePlayerInput, ArcadePublicSnapshot } from "./types";

export const TAP_RACE_MATCH_MS = 45_000;
export const TAP_RACE_COOLDOWN_MS = 100;
export const TAP_RACE_FINISH_DISTANCE = 100;

export interface TapRaceRacer { playerId: string; progress: number; tapCount: number }
export interface TapRaceState {
  v: 1;
  matchId: string;
  startedAt: number;
  deadlineAt: number;
  pausedAt: number | null;
  status: "active" | "complete";
  racers: TapRaceRacer[];
  winners: string[];
  tied: boolean;
  completedAt: number | null;
}

function validPlayerIds(playerIds: readonly string[]): boolean {
  return playerIds.length >= 2 && playerIds.length <= 10 && playerIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 120) && new Set(playerIds).size === playerIds.length;
}

export function createTapRaceState(matchId: string, now: number, playerIds: readonly string[]): TapRaceState {
  if (typeof matchId !== "string" || matchId.length < 1 || matchId.length > 120 || !Number.isFinite(now) || !validPlayerIds(playerIds)) throw new Error("INVALID_MATCH");
  return {
    v: 1,
    matchId,
    startedAt: now,
    deadlineAt: now + TAP_RACE_MATCH_MS,
    pausedAt: null,
    status: "active",
    racers: playerIds.map((playerId) => ({ playerId, progress: 0, tapCount: 0 })),
    winners: [],
    tied: false,
    completedAt: null,
  };
}

function progressByPlayer(state: TapRaceState): Record<string, number> {
  return Object.fromEntries(state.racers.map((racer) => [racer.playerId, racer.progress]));
}

function completeRace(state: TapRaceState, now: number, emit?: (event: Record<string, unknown>) => void): void {
  if (state.status === "complete") return;
  const best = Math.max(...state.racers.map((racer) => racer.progress));
  state.winners = state.racers.filter((racer) => racer.progress === best).map((racer) => racer.playerId);
  state.tied = state.winners.length !== 1;
  state.completedAt = now;
  state.status = "complete";
  emit?.({
    eventId: `${state.matchId}:final`,
    type: "result",
    playerId: null,
    points: 0,
    payload: { winners: [...state.winners], tied: state.tied, progress: progressByPlayer(state) },
    occurredAt: now,
  });
}

export function pauseTapRace(state: TapRaceState, now: number): void {
  if (state.status !== "active" || state.pausedAt !== null || !Number.isFinite(now) || now < state.startedAt || now >= state.deadlineAt) throw new Error("INVALID_PAUSE");
  state.pausedAt = now;
}

export function resumeTapRace(state: TapRaceState, now: number): void {
  if (state.status !== "active" || state.pausedAt === null || !Number.isFinite(now) || now < state.pausedAt) throw new Error("INVALID_RESUME");
  state.deadlineAt += now - state.pausedAt;
  state.pausedAt = null;
}

export function applyTapRaceInput(state: TapRaceState, input: ArcadePlayerInput, now: number, emit?: (event: Record<string, unknown>) => void): TapRaceState {
  if (input.kind !== "tap" || !Number.isSafeInteger(input.seq) || input.seq < 0 || !Number.isFinite(now) || now < state.startedAt) throw new Error("INVALID_INPUT");
  if (state.status !== "active") throw new Error("MATCH_COMPLETE");
  if (state.pausedAt !== null) throw new Error("MATCH_PAUSED");
  if (!state.racers.some((racer) => racer.playerId === input.playerId)) throw new Error("WRONG_PLAYER");
  if (now >= state.deadlineAt) { completeRace(state, state.deadlineAt, emit); return state; }
  const racer = state.racers.find((candidate) => candidate.playerId === input.playerId)!;
  racer.tapCount += 1;
  racer.progress = Math.min(TAP_RACE_FINISH_DISTANCE, racer.progress + 1);
  if (racer.progress >= TAP_RACE_FINISH_DISTANCE) completeRace(state, now, emit);
  return state;
}

export function stepTapRace(state: TapRaceState, fixedStepMs: number, now: number, emit?: (event: Record<string, unknown>) => void): TapRaceState {
  if (!Number.isFinite(fixedStepMs) || fixedStepMs <= 0 || !Number.isFinite(now)) throw new Error("INVALID_STEP");
  if (state.pausedAt !== null) return state;
  if (state.status === "active" && now >= state.deadlineAt) completeRace(state, state.deadlineAt, emit);
  return state;
}

export function finalTapRaceResult(state: TapRaceState): { winners: string[]; tied: boolean; progress: Record<string, number> } | null {
  if (state.status !== "complete") return null;
  return { winners: [...state.winners], tied: state.tied, progress: progressByPlayer(state) };
}

export function toTapRaceSnapshot(state: TapRaceState, tick: number, viewer: { role: "host" | "player" | "spectator"; playerId: string | null }): ArcadePublicSnapshot {
  return {
    v: 1,
    gameId: "tap-race",
    tick,
    state: {
      status: state.status,
      courseLength: TAP_RACE_FINISH_DISTANCE,
      racers: state.racers.map((racer) => ({ playerId: racer.playerId, progress: racer.progress, tapCount: racer.tapCount })),
      viewer: { role: viewer.role, playerId: viewer.playerId },
    },
  };
}

export const tapRaceGame: ArcadeGameModule & { finalResult: (state: TapRaceState) => ReturnType<typeof finalTapRaceResult> } = {
  id: "tap-race",
  minPlayers: 2,
  maxPlayers: 10,
  inputKinds: ["tap"],
  inputCooldownMs: TAP_RACE_COOLDOWN_MS,
  createState: (seed, now, playerIds) => createTapRaceState(seed ?? "tap-race", now ?? Date.now(), playerIds ?? ["player-1", "player-2"]),
  validateInput: (unknownState, input, now) => {
    const state = unknownState as TapRaceState;
    return input.kind === "tap" && state.status === "active" && state.pausedAt === null && now < state.deadlineAt && state.racers.some((racer) => racer.playerId === input.playerId);
  },
  applyInput: (unknownState, input, context: ArcadeGameContext) => applyTapRaceInput(unknownState as TapRaceState, input, context.now, context.emit),
  step: (unknownState, fixedStepMs, context) => stepTapRace(unknownState as TapRaceState, fixedStepMs, context.now, context.emit),
  snapshot: (state, tick, viewer) => toTapRaceSnapshot(state as TapRaceState, tick, viewer),
  finalResult: (state) => finalTapRaceResult(state as TapRaceState),
  pause: (state, now) => pauseTapRace(state as TapRaceState, now),
  resume: (state, now) => resumeTapRace(state as TapRaceState, now),
};
