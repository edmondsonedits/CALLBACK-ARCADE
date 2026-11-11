import { createJungleBashState, stepJungleBash, type JungleBashState } from "./jungle-bash-simulation";
import { makeCombatInput, practiceModule } from "./types";
import type { PracticeInput } from "../types";

export type JungleBashPracticeState = JungleBashState;
export function createJungleBashPracticeState(playerId: string, seed: number): JungleBashState { return createJungleBashState([playerId], seed); }
export function stepJungleBashPractice(state: JungleBashState, input: PracticeInput): JungleBashState {
  const id = Object.keys(state.players)[0]!;
  return stepJungleBash(state, { [id]: makeCombatInput(input, state.players[id]!.carriedCrate) });
}
export const jungleBashModule = practiceModule("jungle-bash", createJungleBashPracticeState, stepJungleBashPractice,
  (state) => structuredClone(state), (state) => state.finished || Object.values(state.players).every((player) => player.eliminated));
export default jungleBashModule;
