import { createJungleBashState, stepJungleBash, type JungleBashState } from "./jungle-bash-simulation";
import { makeCombatInput, practiceModule } from "./types";
import type { PracticeInput } from "../types";
export type SpaceBashState = JungleBashState & { variant: "space-bash" };
export function createSpaceBashState(playerId: string, seed: number): SpaceBashState { return createJungleBashState([playerId], seed, "space-bash") as SpaceBashState; }
export function stepSpaceBash(state: SpaceBashState, input: PracticeInput): SpaceBashState {
 const id = Object.keys(state.players)[0]!; return stepJungleBash(state, { [id]: makeCombatInput(input, state.players[id]!.carriedCrate) }) as SpaceBashState;
}
export const spaceBashModule = practiceModule("space-bash", createSpaceBashState, stepSpaceBash, (state) => structuredClone(state),
 (state) => state.finished || Object.values(state.players).every((player) => player.eliminated));
export default spaceBashModule;
