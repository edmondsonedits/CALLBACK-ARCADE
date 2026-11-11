import { sql } from "drizzle-orm";
export * from './profile-schema';
import { check, foreignKey, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const avatarLivePoses = sqliteTable('avatar_live_poses', {
  scope: text('scope').notNull(), playerId: text('player_id').notNull(), sequence: integer('sequence').notNull(),
  poseJson: text('pose_json').notNull(), expiresAt: integer('expires_at').notNull(),
}, table => [primaryKey({columns: [table.scope, table.playerId]}), index('idx_avatar_poses_expiry').on(table.expiresAt)]);

export const onlineArcadeRooms=sqliteTable('online_arcade_rooms',{
 code:text('code').primaryKey(),gameId:text('game_id').notNull(),hostTokenHash:text('host_token_hash').notNull(),version:integer('version').notNull(),status:text('status').notNull(),stateJson:text('state_json').notNull(),updatedAt:integer('updated_at').notNull(),expiresAt:integer('expires_at').notNull(),
},table=>[index('idx_online_arcade_expiry').on(table.expiresAt)]);
export const onlineArcadeSeats=sqliteTable('online_arcade_seats',{
 roomCode:text('room_code').notNull().references(()=>onlineArcadeRooms.code,{onDelete:'cascade'}),seatId:text('seat_id').notNull(),tokenHash:text('token_hash').notNull(),nickname:text('nickname').notNull(),nicknameNormalized:text('nickname_normalized').notNull(),sequence:integer('sequence').notNull().default(0),inputJson:text('input_json').notNull().default('{}'),lastSeenAt:integer('last_seen_at').notNull(),
},table=>[primaryKey({columns:[table.roomCode,table.seatId]}),uniqueIndex('idx_online_arcade_seat_name').on(table.roomCode,table.nicknameNormalized),uniqueIndex('idx_online_arcade_seat_token').on(table.roomCode,table.tokenHash)]);
export const onlineArcadeResults=sqliteTable('online_arcade_results',{
 eventKey:text('event_key').primaryKey(),roomCode:text('room_code').notNull().references(()=>onlineArcadeRooms.code,{onDelete:'cascade'}),matchId:text('match_id').notNull(),resultJson:text('result_json').notNull(),occurredAt:integer('occurred_at').notNull(),
});

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(), code: text("code").notNull(), hostTokenHash: text("host_token_hash").notNull(),
  phase: text("phase").notNull(), version: integer("version").notNull().default(1), lastActionId: text("last_action_id"), stateJson: text("state_json").notNull(),
  status: text("status").notNull().default("LOBBY"), gameLength: text("game_length").notNull().default("standard"),
  contentMode: text("content_mode").notNull().default("party"), deadlineAt: integer("deadline_at"),
  updatedAt: integer("updated_at").notNull(), expiresAt: integer("expires_at").notNull(), createdAt,
}, (table) => [uniqueIndex("idx_rooms_code_unique").on(table.code), index("idx_rooms_expiry").on(table.expiresAt), index("idx_rooms_status_updated").on(table.status, table.updatedAt)]);

export const players = sqliteTable("players", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(), nickname: text("nickname").notNull(), nicknameNormalized: text("nickname_normalized").notNull(),
  role: text("role").notNull(), seat: integer("seat").notNull(), avatar: integer("avatar").notNull(), color: text("color").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true), pendingActivation: integer("pending_activation", { mode: "boolean" }).notNull().default(false),
  connectedAt: integer("connected_at").notNull(), lastSeenAt: integer("last_seen_at").notNull(), removedAt: integer("removed_at"), createdAt,
}, (table) => [uniqueIndex("idx_players_room_name_unique").on(table.roomId, table.nicknameNormalized), uniqueIndex("idx_players_room_seat_unique").on(table.roomId, table.seat), index("idx_players_room_role").on(table.roomId, table.role)]);

export const displaySessions = sqliteTable("display_sessions", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  lastSeenAt: integer("last_seen_at").notNull(), createdAt,
}, (table) => [index("idx_display_sessions_room_seen").on(table.roomId, table.lastSeenAt)]);

export const legacyRounds = sqliteTable("rounds", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  roundIndex: integer("round_index").notNull(), kind: text("kind").notNull(), promptId: text("prompt_id"),
  stateJson: text("state_json").notNull().default("{}"), startedAt: integer("started_at"), completedAt: integer("completed_at"), createdAt,
}, (table) => [uniqueIndex("idx_rounds_room_index_unique").on(table.roomId, table.roundIndex), index("idx_rounds_room_kind").on(table.roomId, table.kind)]);

export const rounds = sqliteTable("match_rounds", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  matchNumber: integer("match_number").notNull(), roundIndex: integer("round_index").notNull(), kind: text("kind").notNull(), promptId: text("prompt_id"),
  stateJson: text("state_json").notNull().default("{}"), startedAt: integer("started_at"), completedAt: integer("completed_at"), createdAt,
}, table => [uniqueIndex("idx_match_rounds_room_match_index_unique").on(table.roomId, table.matchNumber, table.roundIndex), index("idx_match_rounds_room_match").on(table.roomId, table.matchNumber)]);

export const schemaMigrations = sqliteTable("callback_schema_migrations", { id: text("id").primaryKey() });

export const assignments = sqliteTable("assignments", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), roundId: text("round_id").notNull(), playerId: text("player_id").notNull(),
  kind: text("kind").notNull(), payloadJson: text("payload_json").notNull(), createdAt,
}, (table) => [uniqueIndex("idx_assignments_round_player_kind").on(table.roundId, table.playerId, table.kind)]);

export const answers = sqliteTable("answers", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), roundId: text("round_id").notNull(), playerId: text("player_id").notNull(),
  text: text("text").notNull(), normalizedText: text("normalized_text").notNull(), hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  submittedAt: integer("submitted_at").notNull(), createdAt,
}, (table) => [uniqueIndex("idx_answers_round_player_unique").on(table.roundId, table.playerId), index("idx_answers_room_round").on(table.roomId, table.roundId)]);

export const votes = sqliteTable("votes", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), roundId: text("round_id").notNull(), voterId: text("voter_id").notNull(),
  answerId: text("answer_id").notNull(), rank: integer("rank").notNull(), weight: integer("weight").notNull(), audience: integer("audience", { mode: "boolean" }).notNull().default(false), createdAt,
}, (table) => [uniqueIndex("idx_votes_round_voter_rank_unique").on(table.roundId, table.voterId, table.rank), uniqueIndex("idx_votes_round_voter_answer_unique").on(table.roundId, table.voterId, table.answerId), index("idx_votes_room_round").on(table.roomId, table.roundId)]);

export const predictions = sqliteTable("predictions", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), roundId: text("round_id").notNull(), playerId: text("player_id").notNull(),
  kind: text("kind").notNull(), payloadJson: text("payload_json").notNull(), createdAt,
}, (table) => [uniqueIndex("idx_predictions_round_player_kind_unique").on(table.roundId, table.playerId, table.kind)]);

export const feedbackVotes = sqliteTable("feedback_votes", {
  eventKey: text("event_key").primaryKey(), pairId: text("pair_id").notNull(), choiceId: text("choice_id").notNull(), createdAt,
});

export const lore = sqliteTable("lore", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), roundId: text("round_id").notNull(), sourceAnswerId: text("source_answer_id"),
  authorPlayerId: text("author_player_id"), kind: text("kind").notNull(), shortMeaning: text("short_meaning").notNull(), payloadJson: text("payload_json").notNull(),
  safety: text("safety").notNull(), usedAt: integer("used_at"), createdAt,
}, (table) => [index("idx_lore_room_used").on(table.roomId, table.usedAt)]);

export const loreEdges = sqliteTable("lore_edges", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), roundId: text("round_id").notNull(),
  fromLoreId: text("from_lore_id").notNull(), relation: text("relation").notNull(), toLoreId: text("to_lore_id").notNull(), createdAt,
}, (table) => [
  uniqueIndex("idx_lore_edges_relation_unique").on(table.roomId, table.fromLoreId, table.relation, table.toLoreId),
  index("idx_lore_edges_room_round").on(table.roomId, table.roundId),
]);

export const callbacks = sqliteTable("callbacks", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), roundId: text("round_id").notNull(), loreId: text("lore_id").notNull(),
  sourceAuthorId: text("source_author_id"), payloadJson: text("payload_json").notNull(), createdAt,
}, (table) => [uniqueIndex("idx_callbacks_round_lore_unique").on(table.roundId, table.loreId)]);

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), roundId: text("round_id"), kind: text("kind").notNull(), status: text("status").notNull(),
  promptHash: text("prompt_hash").notNull(), promptJson: text("prompt_json").notNull(), leaseOwner: text("lease_owner"), leaseExpiresAt: integer("lease_expires_at"),
  attempts: integer("attempts").notNull().default(0), objectKey: text("object_key"), contentType: text("content_type"), byteSize: integer("byte_size"),
  safety: text("safety"), errorCode: text("error_code"), updatedAt: integer("updated_at").notNull(), createdAt,
}, (table) => [uniqueIndex("idx_jobs_prompt_hash_unique").on(table.promptHash), index("idx_jobs_room_status").on(table.roomId, table.status), index("idx_jobs_status_lease").on(table.status, table.leaseExpiresAt)]);

export const openAIImageReservations = sqliteTable("openai_image_reservations", {
  jobId: text("job_id").primaryKey(), roomId: text("room_id").notNull(), creditWindowId: text("credit_window_id").notNull(),
  reservedAt: integer("reserved_at").notNull(), dayUtc: text("day_utc").notNull(), billingBlocked: integer("billing_blocked", { mode: "boolean" }).notNull().default(false),
}, (table) => [index("idx_openai_image_reservations_window").on(table.creditWindowId), index("idx_openai_image_reservations_day").on(table.creditWindowId, table.dayUtc), index("idx_openai_image_reservations_room").on(table.creditWindowId, table.roomId)]);

export const openAIImageCircuits = sqliteTable("openai_image_circuits", {
  creditWindowId: text("credit_window_id").primaryKey(), createdAt: integer("created_at").notNull(),
});
export const scoreEvents = sqliteTable("score_events", {
  id: text("id").primaryKey(), eventKey: text("event_key").notNull(), roomId: text("room_id").notNull(), roundId: text("round_id").notNull(),
  playerId: text("player_id").notNull(), kind: text("kind").notNull(), points: integer("points").notNull(), detailJson: text("detail_json").notNull().default("{}"), createdAt,
}, (table) => [uniqueIndex("idx_score_events_key_unique").on(table.eventKey), index("idx_score_events_room_player").on(table.roomId, table.playerId), index("idx_score_events_room_round").on(table.roomId, table.roundId)]);

export const processedActions = sqliteTable("processed_actions", {
  roomId: text("room_id").notNull(), actionId: text("action_id").notNull(), actorId: text("actor_id").notNull(), actionType: text("action_type").notNull(),
  responseJson: text("response_json").notNull(), createdAt,
}, (table) => [primaryKey({ columns: [table.roomId, table.actionId] })]);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").notNull(), windowStart: integer("window_start").notNull(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull(),
}, (table) => [primaryKey({ columns: [table.key, table.windowStart] }), index("idx_rate_limits_expiry").on(table.expiresAt)]);

export const metricsDaily = sqliteTable("metrics_daily", {
  day: text("day").notNull(), metric: text("metric").notNull(), value: integer("value").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.day, table.metric] })]);

export const cleanupQueue = sqliteTable("cleanup_queue", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), objectKey: text("object_key"), runAfter: integer("run_after").notNull(), attempts: integer("attempts").notNull().default(0), createdAt,
}, (table) => [index("idx_cleanup_queue_run_after").on(table.runAfter)]);

export const historyMatches = sqliteTable("history_matches", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), matchNumber: integer("match_number").notNull(),
  roomCode: text("room_code").notNull(), gameLength: text("game_length").notNull(), title: text("title").notNull(),
  playerCount: integer("player_count").notNull(), winnerNames: text("winner_names").notNull(),
  playedAt: integer("played_at").notNull(), archiveJson: text("archive_json").notNull(), createdAt,
}, (table) => [uniqueIndex("idx_history_room_match_unique").on(table.roomId, table.matchNumber), index("idx_history_played_at").on(table.playedAt), index("idx_history_game_length").on(table.gameLength, table.playedAt)]);

export const historyMedia = sqliteTable("history_media", {
  matchId: text("match_id").notNull(), assetId: text("asset_id").notNull(), objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(), byteSize: integer("byte_size"), createdAt,
}, (table) => [primaryKey({ columns: [table.matchId, table.assetId] }), index("idx_history_media_match").on(table.matchId)]);

// Public winner projection intentionally has no room foreign key: it survives cleanup.
export const sketchShowcasePreferences = sqliteTable("sketch_showcase_preferences", {
  roomId: text("room_id").notNull(), playerId: text("player_id").notNull(), enabled: integer("enabled").notNull().default(0), updatedAt: integer("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.roomId, table.playerId] })]);
export const sketchShowcaseProfilePreferences = sqliteTable("sketch_showcase_profile_preferences", {
  profileHash: text("profile_hash").primaryKey(), enabled: integer("enabled").notNull().default(0), updatedAt: integer("updated_at").notNull(),
});
export const sketchShowcaseEntries = sqliteTable("sketch_showcase_entries", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull(), sourceMatchId: text("source_match_id").notNull(), historyMatchId: text("history_match_id").notNull(),
  sourceGameId: text("source_game_id").notNull(), rulesVersion: integer("rules_version").notNull(), roundNumber: integer("round_number").notNull(), entryId: text("entry_id").notNull(),
  artistId: text("artist_id").notNull(), artistName: text("artist_name").notNull(), completedAt: integer("completed_at").notNull(), laughterPoints: integer("laughter_points").notNull(), tiedCount: integer("tied_count").notNull(),
  state: text("state").notNull().default("pending"), evidenceJson: text("evidence_json").notNull(), originalInfoJson: text("original_info_json"), transformedInfoJson: text("transformed_info_json"), updatedAt: integer("updated_at").notNull(), createdAt,
}, table => [uniqueIndex("idx_sketch_showcase_source").on(table.sourceMatchId, table.roundNumber, table.entryId), index("idx_sketch_showcase_feed").on(table.state, table.completedAt, table.id), index("idx_sketch_showcase_owner").on(table.roomId, table.artistId, table.state)]);

export const arcadeMatches = sqliteTable("arcade_matches", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  matchNumber: integer("match_number").notNull(), gameId: text("game_id").notNull(), status: text("status").notNull(),
  startedAt: integer("started_at").notNull(), endedAt: integer("ended_at"), resultJson: text("result_json"), createdAt,
}, (table) => [uniqueIndex("idx_arcade_matches_room_number").on(table.roomId, table.matchNumber)]);

export const arcadeScoreEvents = sqliteTable("arcade_score_events", {
  eventKey: text("event_key").primaryKey(), matchId: text("match_id").notNull().references(() => arcadeMatches.id, { onDelete: "cascade" }),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }), eventType: text("event_type").notNull(),
  playerId: text("player_id"), points: integer("points").notNull().default(0), payloadJson: text("payload_json").notNull().default("{}"),
  occurredAt: integer("occurred_at").notNull(), createdAt,
}, (table) => [index("idx_arcade_events_room_match").on(table.roomId, table.matchId)]);

export const mediaSignals = sqliteTable("media_signals", {
  id: text("id").primaryKey(), roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }), senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id").notNull(), kind: text("kind").notNull(), payloadJson: text("payload_json").notNull(), createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(),
}, (table) => [index("idx_media_signals_recipient_expiry").on(table.roomId, table.recipientId, table.expiresAt)]);
// Standalone trusted-family TV games: separate mailbox, never party scoring authority.
export const arcadePhoneRooms = sqliteTable('arcade_phone_rooms', {
  code: text('code').primaryKey(), game: text('game').notNull(), hostTokenHash: text('host_token_hash').notNull(),
  statusJson: text('status_json').notNull(), privateStatesJson: text('private_states_json').notNull().default('{}'),
  botEnabledJson: text('bot_enabled_json').notNull().default('{"0":true,"1":true,"2":true,"3":true,"4":true,"5":true,"6":true,"7":true,"8":true,"9":true}'),
  activeSeatsJson: text('active_seats_json'), version: integer('version').notNull().default(1),
  hostSeenAt: integer('host_seen_at').notNull(), expiresAt: integer('expires_at').notNull(), closed: integer('closed').notNull().default(0),
}, table => [index('idx_arcade_phone_rooms_expiry').on(table.expiresAt), check('arcade_phone_closed_check', sql`${table.closed} IN (0, 1)`)]);
export const arcadePhoneSeats = sqliteTable('arcade_phone_seats', {
  roomCode: text('room_code').notNull().references(() => arcadePhoneRooms.code, { onDelete: 'cascade' }),
  seat: integer('seat').notNull(), name: text('name').notNull(), tokenHash: text('token_hash').notNull(),
  lastSeq: integer('last_seq').notNull().default(0), lastSeenAt: integer('last_seen_at').notNull(), inputAt: integer('input_at').notNull().default(0),
}, table => [primaryKey({ columns: [table.roomCode, table.seat] }), uniqueIndex('idx_arcade_phone_seat_token').on(table.roomCode, table.tokenHash), check('arcade_phone_seat_check', sql`${table.seat} >= 0 AND ${table.seat} < 10`)]);
export const arcadePhoneInputs = sqliteTable('arcade_phone_inputs', {
  roomCode: text('room_code').notNull(), seat: integer('seat').notNull(), seq: integer('seq').notNull(),
  packetJson: text('packet_json').notNull(), receivedAt: integer('received_at').notNull(),
}, table => [primaryKey({ columns: [table.roomCode, table.seat, table.seq] }), index('idx_arcade_phone_inputs_age').on(table.roomCode, table.receivedAt), foreignKey({ columns: [table.roomCode, table.seat], foreignColumns: [arcadePhoneSeats.roomCode, arcadePhoneSeats.seat] }).onDelete('cascade')]);

export const callbackCodeRegistry=sqliteTable('callback_code_registry',{code:text('code').primaryKey(),owner:text('owner').notNull(),expiresAt:integer('expires_at').notNull()});
export const callbackSessions=sqliteTable('callback_sessions',{code:text('code').primaryKey(),hostTokenHash:text('host_token_hash').notNull(),version:integer('version').notNull().default(1),stage:text('stage').notNull().default('SELECTING'),activeId:text('active_id'),lastActionId:text('last_action_id'),expiresAt:integer('expires_at').notNull()});
export const callbackSessionMembers=sqliteTable('callback_session_members',{id:text('id').primaryKey(),sessionCode:text('session_code').notNull(),seat:integer('seat').notNull(),tokenHash:text('token_hash').notNull(),nickname:text('nickname').notNull(),nicknameNormalized:text('nickname_normalized').notNull(),avatarJson:text('avatar_json'),avatarPreset:text('avatar_preset'),lastSeenAt:integer('last_seen_at').notNull()},t=>[uniqueIndex('session_seat').on(t.sessionCode,t.seat),uniqueIndex('session_token').on(t.sessionCode,t.tokenHash),uniqueIndex('session_nickname').on(t.sessionCode,t.nicknameNormalized),index('idx_session_member_room').on(t.sessionCode)]);
export const callbackSessionGames=sqliteTable('callback_session_games',{id:text('id').primaryKey(),sessionCode:text('session_code').notNull(),childKind:text('child_kind').notNull(),childCode:text('child_code'),active:integer('active').notNull().default(1),gameJson:text('game_json').notNull(),createdAt:integer('created_at').notNull()},t=>[index('idx_session_game_child').on(t.childKind,t.childCode,t.active)]);

export const callbackSessionMirrorCodes=sqliteTable('callback_session_mirror_codes',{code:text('code').primaryKey(),sessionCode:text('session_code').notNull().unique(),expiresAt:integer('expires_at').notNull()});
export const callbackSessionMirrors=sqliteTable('callback_session_mirrors',{tokenHash:text('token_hash').primaryKey(),sessionCode:text('session_code').notNull(),lastSeenAt:integer('last_seen_at').notNull()},t=>[index('idx_session_mirrors_room').on(t.sessionCode)]);
export const callbackSessionPresentations=sqliteTable('callback_session_presentations',{sessionCode:text('session_code').primaryKey(),presentationJson:text('presentation_json').notNull()});

export * from './profile-face-schema';
export * from './player-creations-schema';

export {roomCreationControls,sorceryPromptPreferences,sorceryHallAwards,sorceryHallPreferences,playerCreationPresence,fishCreationSources} from "./sorcery-workshop-schema";
