CREATE TABLE IF NOT EXISTS sorcery_prompt_preferences (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, match_id TEXT NOT NULL, actor_id TEXT NOT NULL, profile_hash TEXT NOT NULL, host_hash TEXT, options_json TEXT NOT NULL, choice_id TEXT, accepted_at INTEGER NOT NULL, reward INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sorcery_preferences_profile ON sorcery_prompt_preferences(profile_hash,accepted_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_sorcery_preferences_choice ON sorcery_prompt_preferences(choice_id,accepted_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sorcery_hall_awards (match_id TEXT NOT NULL, round_number INTEGER NOT NULL, entry_id TEXT NOT NULL, nomination_count INTEGER NOT NULL, PRIMARY KEY(match_id,round_number,entry_id));

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS player_creation_presence (room_id TEXT NOT NULL, participant_id TEXT NOT NULL, profile_hash TEXT NOT NULL, allow_history INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(room_id,participant_id));

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS fish_creation_sources (creation_id TEXT PRIMARY KEY, room_id TEXT NOT NULL, match_id TEXT NOT NULL, asset_id TEXT NOT NULL);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sorcery_hall_preferences (room_id TEXT NOT NULL, player_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(room_id,player_id));

CREATE TABLE IF NOT EXISTS room_creation_controls (room_id TEXT PRIMARY KEY, hidden INTEGER NOT NULL DEFAULT 0);
