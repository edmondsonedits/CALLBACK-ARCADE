import type { PracticeGameModule, PracticeInput } from "./types";

const STEP_MS = 1000 / 30;
const MAX_CATCH_UP_STEPS = 3;
const DEFAULT_RESET_CUE_MS = 500;

export interface PracticeSessionOptions {
  readonly playerId: string;
  readonly seed: number;
  readonly resetCueMs?: number;
  readonly now?: () => number;
}

export interface PracticeFrame<Snapshot> {
  readonly state: Snapshot;
  readonly seed: number;
  readonly tick: number;
  readonly inputSequence: number;
  readonly resetCount: number;
  readonly resetPending: boolean;
  readonly resetRemainingMs: number;
  readonly disposed: boolean;
}

export interface PracticeSession<State = unknown, Snapshot = unknown> {
  readonly game: PracticeGameModule<State, Snapshot>;
  readonly playerId: string;
  readonly resetCueMs: number;
  readonly now: () => number;
  state: State;
  seed: number;
  tick: number;
  inputSequence: number;
  resetCount: number;
  accumulatorMs: number;
  resetRemainingMs: number;
  paused: boolean;
  disposed: boolean;
  input: Omit<PracticeInput, "sequence">;
  pendingPressed: Set<keyof NonNullable<PracticeInput["buttons"]>>;
}

const EMPTY_INPUT: Omit<PracticeInput, "sequence"> = { x: 0, y: 0, buttons: {} };

function normalizeInput(input: Partial<Omit<PracticeInput, "sequence">>): Omit<PracticeInput, "sequence"> {
  const axis = (value: number | undefined) => Number.isFinite(value) ? Math.max(-1, Math.min(1, value!)) : 0;
  return {
    x: axis(input.x),
    y: axis(input.y),
    buttons: { ...(input.buttons ?? {}) },
  };
}

function frame<State, Snapshot>(session: PracticeSession<State, Snapshot>): PracticeFrame<Snapshot> {
  return {
    state: session.game.snapshot(session.state),
    seed: session.seed,
    tick: session.tick,
    inputSequence: session.inputSequence,
    resetCount: session.resetCount,
    resetPending: session.resetRemainingMs > 0,
    resetRemainingMs: session.resetRemainingMs,
    disposed: session.disposed,
  };
}

function beginAttempt<State, Snapshot>(session: PracticeSession<State, Snapshot>, seed: number): void {
  session.seed = seed | 0;
  session.state = session.game.createState(session.playerId, session.seed);
  session.tick = 0;
  session.inputSequence = 0;
  session.accumulatorMs = 0;
  session.resetRemainingMs = 0;
  session.input = { ...EMPTY_INPUT, buttons: {} };
  session.pendingPressed.clear();
}

export function createPracticeSession<State, Snapshot>(
  game: PracticeGameModule<State, Snapshot>,
  options: PracticeSessionOptions,
): PracticeSession<State, Snapshot> {
  const now = options.now ?? Date.now;
  now();
  return {
    game,
    playerId: options.playerId,
    seed: options.seed | 0,
    resetCueMs: Math.max(1, options.resetCueMs ?? DEFAULT_RESET_CUE_MS),
    now,
    state: game.createState(options.playerId, options.seed | 0),
    tick: 0,
    inputSequence: 0,
    resetCount: 0,
    accumulatorMs: 0,
    resetRemainingMs: 0,
    paused: false,
    disposed: false,
    input: { ...EMPTY_INPUT, buttons: {} },
    pendingPressed: new Set(),
  };
}

export function setPracticeSessionInput<State, Snapshot>(
  session: PracticeSession<State, Snapshot>,
  input: Partial<Omit<PracticeInput, "sequence">>,
): void {
  if (!session.paused && !session.disposed) {
    const next = normalizeInput(input);
    for (const [control, pressed] of Object.entries(next.buttons)) {
      if (pressed && !session.input.buttons[control as keyof typeof session.input.buttons]) session.pendingPressed.add(control as keyof NonNullable<PracticeInput["buttons"]>);
    }
    session.input = next;
  }
}

export function setPracticeSessionPaused<State, Snapshot>(session: PracticeSession<State, Snapshot>, paused: boolean): void {
  if (session.disposed || session.paused === paused) return;
  session.paused = paused;
  session.input = { ...EMPTY_INPUT, buttons: {} };
  session.pendingPressed.clear();
  session.accumulatorMs = 0;
}

export function resetPracticeSession<State, Snapshot>(
  session: PracticeSession<State, Snapshot>,
  seed = (session.seed + 1) | 0,
): PracticeFrame<Snapshot> {
  if (!session.disposed) {
    beginAttempt(session, seed);
    session.resetCount++;
  }
  return frame(session);
}

export function advancePracticeSession<State, Snapshot>(
  session: PracticeSession<State, Snapshot>,
  elapsedMs: number,
): PracticeFrame<Snapshot> {
  if (session.disposed || session.paused || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return frame(session);
  if (session.resetRemainingMs > 0) {
    session.resetRemainingMs = Math.max(0, session.resetRemainingMs - elapsedMs);
    if (session.resetRemainingMs === 0) {
      beginAttempt(session, session.seed);
      session.resetCount++;
    }
    return frame(session);
  }

  session.accumulatorMs += elapsedMs;
  const availableSteps = Math.floor((session.accumulatorMs + 1e-7) / STEP_MS);
  const steps = Math.min(availableSteps, MAX_CATCH_UP_STEPS);
  if (availableSteps > MAX_CATCH_UP_STEPS) session.accumulatorMs = 0;
  else session.accumulatorMs -= steps * STEP_MS;

  for (let index = 0; index < steps; index++) {
    const input: PracticeInput = { ...session.input, buttons: { ...session.input.buttons }, pressed: [...session.pendingPressed], sequence: ++session.inputSequence };
    session.pendingPressed.clear();
    session.state = session.game.step(session.state, input);
    session.tick++;
    if (session.game.isTerminal(session.state)) {
      session.input = { ...EMPTY_INPUT, buttons: {} };
      session.pendingPressed.clear();
      session.accumulatorMs = 0;
      session.resetRemainingMs = session.resetCueMs;
      break;
    }
  }
  return frame(session);
}

export function disposePracticeSession<State, Snapshot>(session: PracticeSession<State, Snapshot>): void {
  session.disposed = true;
  session.paused = true;
  session.input = { ...EMPTY_INPUT, buttons: {} };
  session.pendingPressed.clear();
  session.accumulatorMs = 0;
  session.resetRemainingMs = 0;
}
