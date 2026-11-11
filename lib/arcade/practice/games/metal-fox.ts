import { createTankEngineState, stepTankEngine, tankResult, tankSnapshot, type TankEngineState } from "./tank-engine";
import type { ArcadeGameModule, ArcadeInput } from "./types";

export type MetalFoxState = TankEngineState;
export function createMetalFoxState(playerIds: readonly string[], seed: number): MetalFoxState {
  return createTankEngineState(playerIds, seed, "metal-fox");
}
export function stepMetalFox(state: MetalFoxState, inputs: Readonly<Record<string, ArcadeInput>>): MetalFoxState {
  return stepTankEngine(state, inputs, "metal-fox");
}
export const metalFoxModule: ArcadeGameModule<MetalFoxState> = {
  id: "metal-fox", minPlayers: 2, createState: createMetalFoxState, step: stepMetalFox,
  snapshot: tankSnapshot, result: tankResult,
};

import { createPracticeAdapter } from "./practice-adapter";
import type { PracticeInput } from "../types";
const tankPracticeInput = (input: PracticeInput): ArcadeInput => {
  const pressed = new Set(input.pressed ?? []);
  return { sequence: input.sequence, x: input.x, y: input.y,
    action: pressed.has("fire") ? "attack" : pressed.has("special") ? "special" : "none" };
};
const practiceMetalFoxModule = createPracticeAdapter(metalFoxModule, { mapInput: tankPracticeInput,
  terminal: (state: TankEngineState) => state.finished || Object.values(state.players).every((tank) => !tank.alive) });
export default practiceMetalFoxModule;
