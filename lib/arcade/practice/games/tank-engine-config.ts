/** Shared baseline. Per-arena values live beside each game; all values are tuning estimates. */
export const TANK_ENGINE_BASE = {
  fixedStepSeconds: 1 / 30,
  maxPlayers: 10,
  arenaHalfExtent: 8,
  tankRadius: 0.43,
  maxHealth: 99,
  normalShotDamage: 20,
  shotRadius: 0.16,
  playerHitInvulnerabilityTicks: 42,
  maximumPickups: 2,
  pickupLifetimeTicks: 720,
  maximumMines: 6,
  mineDamage: 60,
  mineRadius: 2.1,
  mineFuseTicks: 120,
  roundDurationTicks: 90 * 30,
} as const;
