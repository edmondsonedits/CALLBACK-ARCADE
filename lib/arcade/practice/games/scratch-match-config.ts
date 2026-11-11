/** Tuning estimates; see docs/arcade/games/scratch-match/FIDELITY.md. */
export const SCRATCH_MATCH_CONFIG = {
  fixedStepHz: 30, maxPlayers: 8, bpm: 100, notesPerPlayer: 20, leadInTicks: 60,
  perfectTicks: 1, goodTicks: 3, lives: 5, perfectPoints: 100, goodPoints: 60,
  missPoints: 0, maxScore: 9999, maxRoundTicks: 30 * 60,
} as const;
