/** All timing values are tuning estimates; see docs/arcade/games/twisted-system/FIDELITY.md. */
export const TWISTED_SYSTEM_CONFIG = {
  fixedStepSeconds: 1 / 30,
  maxPlayers: 4,
  courseObstacleCount: 36,
  firstImpactTick: 120,
  initialObstacleIntervalTicks: 90,
  intervalReductionPerObstacle: 2,
  minimumObstacleIntervalTicks: 24,
  initialCueLeadTicks: 36,
  minimumCueTicks: 18,
  hitWindowTicks: 8,
  // A secondary guide says six rods may be missed; the seventh miss eliminates.
  livesPerPlayer: 7,
  previewCueCount: 4,
  tierSize: 8,
} as const;
