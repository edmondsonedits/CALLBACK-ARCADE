import { createJungleBashState, stepJungleBash, type JungleBashState } from "./jungle-bash-simulation";
import { makeCombatInput, practiceModule } from "./types";
import type { PracticeInput } from "../types";
export type SnowBashState = JungleBashState & { variant: "snow-bash" };
export function createSnowBashState(playerId: string, seed: number): SnowBashState { return createJungleBashState([playerId], seed, "snow-bash") as SnowBashState; }
export function stepSnowBash(state: SnowBashState, input: PracticeInput): SnowBashState {
 const id = Object.keys(state.players)[0]!; return stepJungleBash(state, { [id]: makeCombatInput(input, state.players[id]!.carriedCrate) }) as SnowBashState;
}
export const snowBashModule = practiceModule("snow-bash", createSnowBashState, stepSnowBash, (state) => structuredClone(state),
 (state) => state.finished || Object.values(state.players).every((player) => player.eliminated));
export default snowBashModule;
