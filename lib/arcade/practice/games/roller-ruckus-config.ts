/** Tunable estimates: accessible written sources describe the lap and momentum rules, not physics constants. */
export const ROLLER_RUCKUS_CONFIG = {
  fixedStepSeconds: 1 / 30,
  roundDurationSeconds: 120,
  targetLaps: 3,
  trackRadiusX: 8,
  trackRadiusY: 5.2,
  innerTrackFactor: 0.78,
  outerTrackFactor: 1.16,
  playerRadius: 0.52,
  acceleration: 6.4,
  maxSpeed: 8.2,
  collisionRestitution: 0.48,
  rollDamping: 0.994,
  checkpointCount: 4,
  respawnTicks: 36,
  fallImpulse: 1.4,
} as const;
