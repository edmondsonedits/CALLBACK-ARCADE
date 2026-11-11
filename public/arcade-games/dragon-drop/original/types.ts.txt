import type { PracticeGameId, PracticeGameModule, PracticeInput } from "../types";
export type { PracticeGameModule, PracticeInput } from "../types";

export interface ArcadeGameModule<State = unknown> {
  readonly id: PracticeGameId;
  readonly minPlayers?: number;
  readonly maxPlayers?: number;
  createState(playerIds: readonly string[], seed: number): State;
  step(state: State, inputs: Readonly<Record<string, ArcadeInput>>): State;
  snapshot(state: State): unknown;
  result(state: State): unknown | null;
}
export type CombatAction = "none" | "pickup" | "throw" | "attack" | "jump" | "special";
export interface ArcadeInput { sequence: number; x: number; y: number; action?: CombatAction | "duck" }
export interface CombatInput { sequence: number; x: number; y: number; action?: CombatAction }
export function makeCombatInput(input: PracticeInput, carrying: boolean): CombatInput {
  const pressed = new Set(input.pressed ?? []);
  return { sequence: input.sequence, x: input.x, y: input.y,
    action: pressed.has("jump") ? "jump" : pressed.has("special") ? "attack" : pressed.has("action") ? (carrying ? "throw" : "pickup") : "none" };
}
export function practiceModule<State, Snapshot = unknown>(id: PracticeGameId,
  create: (playerId: string, seed: number) => State,
  step: (state: State, input: PracticeInput) => State,
  snapshot: (state: State) => Snapshot,
  terminal: (state: State) => boolean,
): PracticeGameModule<State, Snapshot> { return { id, createState: create, step, snapshot, isTerminal: terminal }; }



export function asCombatInputs(inputs: Readonly<Record<string, ArcadeInput>>): Record<string, CombatInput> {
  return Object.fromEntries(Object.entries(inputs).map(([id, input]) => [id, { ...input, action: input.action === "duck" ? "none" : input.action }]));
}
