import { createTieBreakerState, stepTieBreaker, type TieBreakerState } from "./tie-breaker-engine";
import { makeCombatInput, practiceModule } from "./types";
import type { PracticeInput } from "../types";
export function createTieBreakerPracticeState(playerId: string, seed: number): TieBreakerState { return createTieBreakerState([playerId], seed); }
export function stepTieBreakerPractice(state: TieBreakerState, input: PracticeInput): TieBreakerState {
 const id = Object.keys(state.core.players)[0]!;
 return stepTieBreaker(state, { [id]: makeCombatInput(input, state.core.players[id]!.carriedCrate) });
}
export const tieBreakerModule = practiceModule("tie-breaker", createTieBreakerPracticeState, stepTieBreakerPractice,
 (state) => structuredClone(state), (state) => state.finished || Object.values(state.core.players).every((player) => player.eliminated));
export default tieBreakerModule;
