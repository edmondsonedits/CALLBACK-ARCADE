export const AVATAR_POSE_DDL = [
  `CREATE TABLE IF NOT EXISTS avatar_live_poses (scope TEXT NOT NULL, player_id TEXT NOT NULL, sequence INTEGER NOT NULL, pose_json TEXT NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(scope, player_id))`,
  `CREATE INDEX IF NOT EXISTS idx_avatar_poses_expiry ON avatar_live_poses(expires_at)`,
] as const;
