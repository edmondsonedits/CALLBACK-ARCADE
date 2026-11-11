export const SESSION_GAMES_DDL = `CREATE TABLE IF NOT EXISTS callback_session_games(id TEXT PRIMARY KEY,session_code TEXT NOT NULL,child_kind TEXT NOT NULL,child_code TEXT,active INTEGER NOT NULL DEFAULT 1,game_json TEXT NOT NULL,created_at INTEGER NOT NULL)`;
export const SESSION_DDL = [
  `CREATE TABLE IF NOT EXISTS arcade_phone_rooms(code TEXT PRIMARY KEY,game TEXT NOT NULL,host_token_hash TEXT NOT NULL,status_json TEXT NOT NULL,private_states_json TEXT NOT NULL DEFAULT '{}',bot_enabled_json TEXT NOT NULL DEFAULT '{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true}',active_seats_json TEXT,version INTEGER NOT NULL DEFAULT 1,host_seen_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,closed INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS callback_code_registry(code TEXT PRIMARY KEY,owner TEXT NOT NULL,expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS callback_sessions(code TEXT PRIMARY KEY,host_token_hash TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,stage TEXT NOT NULL DEFAULT 'SELECTING',active_id TEXT,last_action_id TEXT,expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS callback_session_members(id TEXT PRIMARY KEY,session_code TEXT NOT NULL,seat INTEGER NOT NULL,token_hash TEXT NOT NULL,nickname TEXT NOT NULL,nickname_normalized TEXT NOT NULL,avatar_json TEXT,avatar_preset TEXT,last_seen_at INTEGER NOT NULL,UNIQUE(session_code,seat),UNIQUE(session_code,token_hash),UNIQUE(session_code,nickname_normalized))`,
  SESSION_GAMES_DDL,
  `CREATE INDEX IF NOT EXISTS idx_session_game_child ON callback_session_games(child_kind,child_code,active)`,
  `CREATE INDEX IF NOT EXISTS idx_session_member_room ON callback_session_members(session_code)`,
  `CREATE TABLE IF NOT EXISTS callback_session_mirror_codes(code TEXT PRIMARY KEY,session_code TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS callback_session_mirrors(token_hash TEXT PRIMARY KEY,session_code TEXT NOT NULL,last_seen_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_session_mirrors_room ON callback_session_mirrors(session_code)`,
  `CREATE TABLE IF NOT EXISTS callback_session_presentations(session_code TEXT PRIMARY KEY,presentation_json TEXT NOT NULL)`,
] as const;
