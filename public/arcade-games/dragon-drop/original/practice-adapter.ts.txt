import type { PracticeControl, PracticeGameModule, PracticeInput } from "../types";
import type { ArcadeGameModule, ArcadeInput } from "./types";

function stripCompetitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCompetitiveFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !["winnerId", "winners", "draw", "result"].includes(key))
    .map(([key, child]) => [key, stripCompetitiveFields(child)]));
}

export function createPracticeAdapter<State>(source: ArcadeGameModule<State>, options: {
  readonly mapInput: (input: PracticeInput) => ArcadeInput;
  readonly terminal: (state: State) => boolean;
}): PracticeGameModule<State, unknown> {
  return {
    id: source.id,
    createState: (playerId, seed) => source.createState([playerId], seed),
    step: (state, input) => {
      const players = (state as { players?: Record<string, unknown> }).players;
      const playerId = players ? Object.keys(players)[0] : undefined;
      return source.step(state, playerId ? { [playerId]: options.mapInput(input) } : {});
    },
    snapshot: (state) => stripCompetitiveFields(source.snapshot(state)),
    isTerminal: options.terminal,
  };
}

export function laneInput(input: PracticeInput): ArcadeInput {
  const lane = input.pressed?.find((item) => item.startsWith("lane-"));
  const index = lane ? Math.max(0, Math.min(3, Number(lane.slice(-1)) - 1)) : null;
  return {
    sequence: input.sequence,
    x: index === null ? input.x : [-1, -1 / 3, 1 / 3, 1][index]!,
    y: index === null ? input.y : 0,
    action: index === null ? "none" : "attack",
  };
}

export function movementActionInput(input: PracticeInput, action?: PracticeControl): ArcadeInput {
  const pressed = new Set(input.pressed ?? []);
  return { sequence: input.sequence, x: input.x, y: input.y, action: action && pressed.has(action) ? "attack" : "none" };
}
