/** Non-destructive migration: retain legacy rounds and already-published archives. */
export const MATCH_ROUNDS_DDL = [
  `CREATE TABLE IF NOT EXISTS match_rounds (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, match_number INTEGER NOT NULL, round_index INTEGER NOT NULL, kind TEXT NOT NULL, prompt_id TEXT, state_json TEXT NOT NULL DEFAULT '{}', started_at INTEGER, completed_at INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(room_id, match_number, round_index))`,
  `CREATE INDEX IF NOT EXISTS idx_match_rounds_room_match ON match_rounds(room_id, match_number)`,
  `CREATE TABLE IF NOT EXISTS callback_schema_migrations (id TEXT PRIMARY KEY)`,
  // Legacy replay upserts retained the first match's row ID but replaced its JSON.
  // The JSON ID reconnects recoverable current-match answers/votes to their round.
  // Future indexes from an earlier, longer match must never enter the current one.
  `INSERT OR IGNORE INTO match_rounds(id,room_id,match_number,round_index,kind,prompt_id,state_json,started_at,completed_at,created_at)
   SELECT COALESCE(NULLIF(json_extract(r.state_json,'$.id'),''),r.id),r.room_id,
     COALESCE(json_extract(room.state_json,'$.matchNumber'),1),r.round_index,
     COALESCE(json_extract(r.state_json,'$.kind'),r.kind),
     COALESCE(json_extract(r.state_json,'$.promptId'),r.prompt_id),r.state_json,
     COALESCE(json_extract(r.state_json,'$.startedAt'),r.started_at),r.completed_at,r.created_at
   FROM rounds r JOIN rooms room ON room.id=r.room_id
   WHERE json_valid(r.state_json) AND json_valid(room.state_json)
     AND (r.round_index<=COALESCE(json_extract(room.state_json,'$.roundIndex'),-1)
       OR json_extract(r.state_json,'$.id')=json_extract(room.state_json,'$.currentRound.id'))
     AND NOT EXISTS(SELECT 1 FROM callback_schema_migrations WHERE id='match-rounds-v1')`,
  `INSERT OR IGNORE INTO callback_schema_migrations(id) VALUES('match-rounds-v1')`,
] as const;
