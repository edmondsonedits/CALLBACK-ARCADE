/** Estimated starting values; available source guides describe the rules, not measured physics. */
export const RUBBLE_ALLIANCE_CONFIG = {
  fixedStepSeconds: 1 / 30,
  rounds: 3,
  roundDurationSeconds: 22,
  floorSize: 8,
  floorHalfExtent: 8,
  warningTicks: 36,
  fallingTicks: 8,
  roundTransitionTicks: 18,
  playerRadius: 0.36,
  acceleration: 5.2,
  maxSpeed: 4.8,
  drag: 0.975,
  boostMultiplier: 2.15,
  boostTicks: 10,
  boostCooldownTicks: 150,
  placementPoints: [5, 3, 1, 0] as const,
} as const;
