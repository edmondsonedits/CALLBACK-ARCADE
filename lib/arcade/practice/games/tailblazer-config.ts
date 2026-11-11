/** Starting estimates from observed Tailblazer footage; see the fidelity notes. */
export const TAILBLAZER_CONFIG = {
  fixedStepSeconds: 1 / 30,
  maxPlayers: 10,
  rounds: 3,
  roundDurationSeconds: 25,
  roundDurationTicks: 25 * 30,
  roundTransitionTicks: 36,
  arenaHalfSize: 7.5,
  moveSpeed: 4.0,
  turnRateRadiansPerSecond: 2.25,
  trailSpacing: 0.24,
  trailCellSize: 0.6,
  collisionRadius: 0.23,
  selfCollisionGraceTicks: 18,
  placementPoints: [5, 3, 1, 0] as const,
} as const;
