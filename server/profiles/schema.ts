export const PROFILE_DDL = [
  `CREATE TABLE IF NOT EXISTS character_profiles (token_hash TEXT PRIMARY KEY, version INTEGER NOT NULL, profile_json TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_character_profiles_updated ON character_profiles(updated_at)`,
] as const;
