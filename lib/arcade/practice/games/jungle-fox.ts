import { createTankEngineState, stepTankEngine, tankResult, tankSnapshot, type TankEngineState } from "./tank-engine";
import type { ArcadeGameModule, ArcadeInput } from "./types";

export type JungleFoxState = TankEngineState;
export function createJungleFoxState(playerIds: readonly string[], seed: number): JungleFoxState {
  return createTankEngineState(playerIds, seed, "jungle-fox");
}
export function stepJungleFox(state: JungleFoxState, inputs: Readonly<Record<string, ArcadeInput>>): JungleFoxState {
  return stepTankEngine(state, inputs, "jungle-fox");
}
export const jungleFoxModule: ArcadeGameModule<JungleFoxState> = {
  id: "jungle-fox", minPlayers: 2, createState: createJungleFoxState, step: stepJungleFox,
  snapshot: tankSnapshot, result: tankResult,
};

import { createPracticeAdapter } from "./practice-adapter";
import type { PracticeInput } from "../types";
const tankPracticeInput = (input: PracticeInput): ArcadeInput => {
  const pressed = new Set(input.pressed ?? []);
  return { sequence: input.sequence, x: input.x, y: input.y,
    action: pressed.has("fire") ? "attack" : pressed.has("special") ? "special" : "none" };
};
const practiceJungleFoxModule = createPracticeAdapter(jungleFoxModule, { mapInput: tankPracticeInput,
  terminal: (state: TankEngineState) => state.finished || Object.values(state.players).every((tank) => !tank.alive) });
export default practiceJungleFoxModule;
