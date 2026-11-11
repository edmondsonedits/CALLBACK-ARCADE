/** Tuning estimates; see docs/arcade/games/mystery-beat/FIDELITY.md. */
export const MYSTERY_BEAT_CONFIG = {
  fixedStepHz: 30, maxPlayers: 10, notesPerComposer: 2, maxNotes: 20,
  composeTicksPerPlayer: 150, previewTicks: 90, firstPerformanceTick: 15,
  intervalTicks: 18, perfectTicks: 1, goodTicks: 3, perfectPoints: 100, goodPoints: 70,
  comboBonusEvery: 4, comboBonus: 15, maxScore: 9999,
} as const;
