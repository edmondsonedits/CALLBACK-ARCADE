import { JUNGLE_BASH_CONFIG } from "./jungle-bash-config";
import { createJungleBashState, stepJungleBash, type JungleBashState } from "./jungle-bash-simulation";
import type { ArcadeInput } from "./types";
import { asCombatInputs } from "./types";

const ROUND_TICKS = 30 * 30;
const SET_LENGTH = 3;
const INTERMISSION_TICKS = 60;

export interface TieBreakerState {
  core: JungleBashState;
  roundWins: Record<string, number>;
  roundNumber: number;
  intermissionTicks: number;
  finished: boolean;
  winnerId: string | null;
}

export function createTieBreakerState(playerIds: string[], seed: number): TieBreakerState {
  if ((playerIds.length !== 1 && playerIds.length !== 2) || new Set(playerIds).size !== playerIds.length) throw new Error("Tie-Breaker requires one or two unique players.");
  return {
    core: createJungleBashState(playerIds, seed),
    roundWins: Object.fromEntries(playerIds.map((id) => [id, 0])),
    roundNumber: 1,
    intermissionTicks: 0,
    finished: false,
    winnerId: null,
  };
}

function decideTimedRound(core: JungleBashState): string | null {
  const players = Object.entries(core.players).filter(([, player]) => !player.eliminated);
  if (players.length === 1) return players[0]![0];
  if (players.length === 0) return null;
  if (!players.length) return null;
  const [first, second] = players;
  if (first![1].health === second![1].health) return null;
  return first![1].health > second![1].health ? first![0] : second![0];
}

function finishRound(state: TieBreakerState): TieBreakerState {
  const winner = state.core.winnerId;
  if (winner && state.roundWins[winner] !== undefined) state.roundWins[winner]!++;
  const roundWinner = Object.entries(state.roundWins).sort((a, b) => b[1] - a[1])[0];
  if ((winner && state.roundWins[winner]! >= 2) || state.roundNumber >= SET_LENGTH) {
    state.finished = true;
    state.winnerId = roundWinner && roundWinner[1] > (Object.entries(state.roundWins).find(([id]) => id !== roundWinner[0])?.[1] ?? -1)
      ? roundWinner[0]
      : null;
    return state;
  }
  state.roundNumber++;
  state.intermissionTicks = INTERMISSION_TICKS;
  const ids = Object.keys(state.core.players);
  const nextSeed = (state.core.seed ^ Math.imul(state.roundNumber, 0x45d9f3b)) | 0;
  state.core = createJungleBashState(ids, nextSeed);
  return state;
}

export function stepTieBreaker(state: TieBreakerState, inputs: Record<string, ArcadeInput>): TieBreakerState {
  if (state.finished) return structuredClone(state);
  const next = structuredClone(state);
  if (next.intermissionTicks > 0) {
    next.intermissionTicks--;
    return next;
  }
  if (!next.core.finished) next.core = stepJungleBash(next.core, asCombatInputs(inputs));
  if (!next.core.finished && next.core.tick >= ROUND_TICKS) {
    next.core.finished = true;
    next.core.winnerId = decideTimedRound(next.core);
  }
  if (next.core.finished) {
    if (Object.keys(next.core.players).length === 1) { next.finished = true; next.winnerId = next.core.winnerId; }
    else finishRound(next);
  }
  return next;
}


export const TIE_BREAKER_ROUND_SECONDS = ROUND_TICKS * JUNGLE_BASH_CONFIG.fixedStepSeconds;
