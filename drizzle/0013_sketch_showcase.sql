CREATE TABLE sketch_showcase_preferences (room_id TEXT NOT NULL, player_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY(room_id, player_id));
--> statement-breakpoint
CREATE TABLE sketch_showcase_profile_preferences (profile_hash TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE sketch_showcase_entries (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, source_match_id TEXT NOT NULL, history_match_id TEXT NOT NULL, source_game_id TEXT NOT NULL, rules_version INTEGER NOT NULL, round_number INTEGER NOT NULL, entry_id TEXT NOT NULL, artist_id TEXT NOT NULL, artist_name TEXT NOT NULL, completed_at INTEGER NOT NULL, laughter_points INTEGER NOT NULL, tied_count INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending', evidence_json TEXT NOT NULL, original_info_json TEXT, transformed_info_json TEXT, updated_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(source_match_id, round_number, entry_id));
--> statement-breakpoint
CREATE INDEX idx_sketch_showcase_feed ON sketch_showcase_entries(state, completed_at, id);
--> statement-breakpoint
CREATE INDEX idx_sketch_showcase_owner ON sketch_showcase_entries(room_id, artist_id, state);
