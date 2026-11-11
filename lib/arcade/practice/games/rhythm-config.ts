/** Tuning estimates; see docs/arcade/games/rhythm/FIDELITY.md. */
export const RHYTHM_CONFIG = {
  fixedStepHz: 30, maxPlayers: 10, startBpm: 84, bpmIncreaseEveryNotes: 6, bpmStep: 8, maxBpm: 132,
  notesPerPlayer: 24, leadInTicks: 60, initialIntervalTicks: 21, minimumIntervalTicks: 14,
  perfectTicks: 1, goodTicks: 3, perfectPoints: 100, goodPoints: 70, missPoints: 0,
  comboBonusEvery: 4, comboBonus: 20, maxScore: 9999,
} as const;
