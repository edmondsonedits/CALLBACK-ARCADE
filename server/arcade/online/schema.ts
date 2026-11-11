import { SESSION_GAMES_DDL } from '../../sessions/schema';
/** Kept in sync with db/schema.ts and the appended Drizzle migration. */
export const ONLINE_ARCADE_DDL=[
 SESSION_GAMES_DDL,
 `CREATE TABLE IF NOT EXISTS online_arcade_rooms(code TEXT PRIMARY KEY, game_id TEXT NOT NULL, host_token_hash TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, state_json TEXT NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS online_arcade_seats(room_code TEXT NOT NULL REFERENCES online_arcade_rooms(code) ON DELETE CASCADE, seat_id TEXT NOT NULL, token_hash TEXT NOT NULL, nickname TEXT NOT NULL, nickname_normalized TEXT NOT NULL, sequence INTEGER NOT NULL DEFAULT 0, input_json TEXT NOT NULL DEFAULT '{}', last_seen_at INTEGER NOT NULL, PRIMARY KEY(room_code,seat_id), UNIQUE(room_code,nickname_normalized), UNIQUE(room_code,token_hash))`,
 `CREATE TABLE IF NOT EXISTS online_arcade_results(event_key TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES online_arcade_rooms(code) ON DELETE CASCADE, match_id TEXT NOT NULL, result_json TEXT NOT NULL, occurred_at INTEGER NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS idx_online_arcade_expiry ON online_arcade_rooms(expires_at)`,
] as const;
