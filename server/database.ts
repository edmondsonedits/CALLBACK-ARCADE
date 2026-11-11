import {PLAYER_CREATIONS_DDL} from "./player-creations/schema";
import {SORCERY_WORKSHOP_DDL} from "./sorcery/workshop-schema";
import { env } from "cloudflare:workers";
import { MATCH_ROUNDS_DDL } from "./match-rounds-schema";
import type { Role } from "../lib/contracts";
import { makeId } from "../lib/game/random";
import { sha256Hex, timingSafeStringEqual } from "./crypto";
import { deserializeRoomState, serializeRoomState } from "./serialization";
import type { DbEffect, ParticipantState, RoomState } from "./types";
import { rebalanceBowlTeams } from "./bowl";
import { arcadeFinalizeRoomCasGuard } from "./arcade/room";
import {ONLINE_ARCADE_DDL} from './arcade/online/schema';
import { OPENAI_IMAGE_GUARD_DDL } from './openai-image-guard';
import { SESSION_DDL } from './sessions/schema';
import { reserveCallbackCode } from './sessions/codes';
import { sessionAvatarUpdate } from './sessions/avatar';
import { PROFILE_DDL } from './profiles/schema';
import { PROFILE_FACE_DDL } from './profile-faces/schema';
import { AVATAR_POSE_DDL } from './avatar/schema';
import { chooseLobbySlot, hydrateLobbySlots, nextPhysicalSeat } from "./participant-seats";
import { SKETCH_SHOWCASE_DDL } from "./sketch-showcase-schema";

export interface RuntimeEnv {
  DB: D1Database;
  MEDIA?: R2Bucket;
  IMAGES?: { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } } };
  OPENAI_API_KEY?: string;
  OPENAI_IMAGE_API_KEY?: string;
  OPENAI_IMAGES_ENABLED?: string;
  OPENAI_IMAGES_CREDIT_WINDOW?: string;
  OPENAI_IMAGES_STOP_AT?: string;
  OPENAI_IMAGES_MAX_REQUESTS?: string;
  OPENAI_IMAGES_MAX_DAILY_REQUESTS?: string;
  OPENAI_IMAGES_MAX_ROOM_REQUESTS?: string;
  OPENAI_TEXT_MODEL?: string;
  OPENAI_TEXT_REASONING_EFFORT?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_API_TOKEN?: string;
  CLOUDFLARE_IMAGE_MODEL?: string;
  CLOUDFLARE_TEXT_MODEL?: string;
  RATE_LIMIT_HMAC_SECRET?: string;
  CALLBACK_ENV?: string;
  PARTY_WORKER_URL?: string;
  PARTY_SECRET?: string;
  ARCADE_WORKER_URL?: string;
  ARCADE_TICKET_SECRET?: string;
  ARCADE_CONTROL_SECRET?: string;
  ARCADE_CALLBACK_SECRET?: string;
}

export function runtimeEnv(): RuntimeEnv { return env as unknown as RuntimeEnv; }
export function getD1(): D1Database {
  const database = runtimeEnv().DB;
  if (!database) throw new Error("D1 binding DB is unavailable");
  return database;
}

const DDL = [
  ...SESSION_DDL,
  ...PROFILE_DDL,
  ...PROFILE_FACE_DDL,
  ...AVATAR_POSE_DDL,
  ...ONLINE_ARCADE_DDL,
  ...OPENAI_IMAGE_GUARD_DDL,
  ...SKETCH_SHOWCASE_DDL,
  ...SORCERY_WORKSHOP_DDL,
  ...PLAYER_CREATIONS_DDL,
  `CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, host_token_hash TEXT NOT NULL, phase TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, last_action_id TEXT, state_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'LOBBY', game_length TEXT NOT NULL DEFAULT 'standard', content_mode TEXT NOT NULL DEFAULT 'party', deadline_at INTEGER, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, token_hash TEXT NOT NULL, nickname TEXT NOT NULL, nickname_normalized TEXT NOT NULL, role TEXT NOT NULL, seat INTEGER NOT NULL, avatar INTEGER NOT NULL, color TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, pending_activation INTEGER NOT NULL DEFAULT 0, connected_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, removed_at INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(room_id, nickname_normalized), UNIQUE(room_id, seat))`,
  `CREATE TABLE IF NOT EXISTS display_sessions (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, last_seen_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS media_signals (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, sender_id TEXT NOT NULL, recipient_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rounds (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, round_index INTEGER NOT NULL, kind TEXT NOT NULL, prompt_id TEXT, state_json TEXT NOT NULL DEFAULT '{}', started_at INTEGER, completed_at INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(room_id, round_index))`,
  `CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, round_id TEXT NOT NULL, player_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(round_id, player_id, kind))`,
  `CREATE TABLE IF NOT EXISTS answers (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, round_id TEXT NOT NULL, player_id TEXT NOT NULL, text TEXT NOT NULL, normalized_text TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, submitted_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(round_id, player_id))`,
  `CREATE TABLE IF NOT EXISTS votes (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, round_id TEXT NOT NULL, voter_id TEXT NOT NULL, answer_id TEXT NOT NULL, rank INTEGER NOT NULL, weight INTEGER NOT NULL, audience INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(round_id, voter_id, rank), UNIQUE(round_id, voter_id, answer_id))`,
  `CREATE TABLE IF NOT EXISTS predictions (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, round_id TEXT NOT NULL, player_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(round_id, player_id, kind))`,
  `CREATE TABLE IF NOT EXISTS feedback_votes (event_key TEXT PRIMARY KEY, pair_id TEXT NOT NULL, choice_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS lore (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, round_id TEXT NOT NULL, source_answer_id TEXT, author_player_id TEXT, kind TEXT NOT NULL, short_meaning TEXT NOT NULL, payload_json TEXT NOT NULL, safety TEXT NOT NULL, used_at INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS lore_edges (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, round_id TEXT NOT NULL, from_lore_id TEXT NOT NULL, relation TEXT NOT NULL, to_lore_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(room_id, from_lore_id, relation, to_lore_id))`,
  `CREATE TABLE IF NOT EXISTS callbacks (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, round_id TEXT NOT NULL, lore_id TEXT NOT NULL, source_author_id TEXT, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(round_id, lore_id))`,
  `CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, round_id TEXT, kind TEXT NOT NULL, status TEXT NOT NULL, prompt_hash TEXT NOT NULL UNIQUE, prompt_json TEXT NOT NULL, lease_owner TEXT, lease_expires_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0, object_key TEXT, content_type TEXT, byte_size INTEGER, safety TEXT, error_code TEXT, updated_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS score_events (id TEXT PRIMARY KEY, event_key TEXT NOT NULL UNIQUE, room_id TEXT NOT NULL, round_id TEXT NOT NULL, player_id TEXT NOT NULL, kind TEXT NOT NULL, points INTEGER NOT NULL, detail_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS processed_actions (room_id TEXT NOT NULL, action_id TEXT NOT NULL, actor_id TEXT NOT NULL, action_type TEXT NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(room_id, action_id))`,
  `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(key, window_start))`,
  `CREATE TABLE IF NOT EXISTS metrics_daily (day TEXT NOT NULL, metric TEXT NOT NULL, value INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, metric))`,
  `CREATE TABLE IF NOT EXISTS cleanup_queue (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, object_key TEXT, run_after INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS history_matches (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, match_number INTEGER NOT NULL, room_code TEXT NOT NULL, game_length TEXT NOT NULL, title TEXT NOT NULL, player_count INTEGER NOT NULL, winner_names TEXT NOT NULL, played_at INTEGER NOT NULL, archive_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(room_id, match_number))`,
  `CREATE TABLE IF NOT EXISTS history_media (match_id TEXT NOT NULL, asset_id TEXT NOT NULL, object_key TEXT NOT NULL, content_type TEXT NOT NULL, byte_size INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(match_id, asset_id))`,
  `CREATE TABLE IF NOT EXISTS arcade_matches (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, match_number INTEGER NOT NULL, game_id TEXT NOT NULL, status TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, result_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(room_id, match_number))`,
  `CREATE TABLE IF NOT EXISTS arcade_score_events (event_key TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES arcade_matches(id) ON DELETE CASCADE, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, event_type TEXT NOT NULL, player_id TEXT, points INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL DEFAULT '{}', occurred_at INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_expiry ON rooms(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_status_updated ON rooms(status, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_players_room_role ON players(room_id, role)`,
  `CREATE INDEX IF NOT EXISTS idx_display_sessions_room_seen ON display_sessions(room_id, last_seen_at)`,
  `CREATE INDEX IF NOT EXISTS idx_media_signals_recipient_expiry ON media_signals(room_id, recipient_id, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_rounds_room_kind ON rounds(room_id, kind)`,
  `CREATE INDEX IF NOT EXISTS idx_answers_room_round ON answers(room_id, round_id)`,
  `CREATE INDEX IF NOT EXISTS idx_votes_room_round ON votes(room_id, round_id)`,
  `CREATE INDEX IF NOT EXISTS idx_lore_room_used ON lore(room_id, used_at)`,
  `CREATE INDEX IF NOT EXISTS idx_lore_edges_room_round ON lore_edges(room_id, round_id)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_room_status ON jobs(room_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_status_lease ON jobs(status, lease_expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_score_events_room_player ON score_events(room_id, player_id)`,
  `CREATE INDEX IF NOT EXISTS idx_score_events_room_round ON score_events(room_id, round_id)`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry ON rate_limits(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_cleanup_queue_run_after ON cleanup_queue(run_after)`,
  `CREATE INDEX IF NOT EXISTS idx_history_played_at ON history_matches(played_at)`,
  `CREATE INDEX IF NOT EXISTS idx_history_game_length ON history_matches(game_length, played_at)`,
  `CREATE INDEX IF NOT EXISTS idx_history_media_match ON history_media(match_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_arcade_matches_room_number ON arcade_matches(room_id, match_number)`,
  `CREATE INDEX IF NOT EXISTS idx_arcade_events_room_match ON arcade_score_events(room_id, match_id)`,
] as const;

let schemaPromise: Promise<void> | null = null;
export function ensureDatabase(): Promise<void> {
  schemaPromise ??= (async () => {
    const database = getD1();
    await database.batch([...DDL, ...MATCH_ROUNDS_DDL].map((statement) => database.prepare(statement)));
    await database.prepare("PRAGMA optimize").run();
  })().catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

interface RoomRow { id: string; code: string; host_token_hash: string; version: number; state_json: string; expires_at: number }

function hydrateRoomState(value: RoomState): RoomState {
  hydrateLobbySlots(value);
  const validMemoryKinds = new Set(["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"]);
  value.lore = Array.isArray(value.lore) ? value.lore.filter((item) => item?.winner === true && validMemoryKinds.has(item.kind)) : [];
  for (const lore of value.lore) lore.safe = true;
  value.memoryEdges = Array.isArray(value.memoryEdges) ? value.memoryEdges.filter((edge) => Boolean(edge?.fromLoreId && edge?.toLoreId && edge?.relation)) : [];
  value.primaryMemoryIds = value.primaryMemoryIds && typeof value.primaryMemoryIds === "object" ? value.primaryMemoryIds : {};
  const validIds = new Set(value.lore.map((item) => item.id));
  for (const kind of ["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"] as const) if (value.primaryMemoryIds[kind] && !validIds.has(value.primaryMemoryIds[kind]!)) delete value.primaryMemoryIds[kind];
  value.callbackCandidates = Array.isArray(value.callbackCandidates) ? value.callbackCandidates.filter((candidate) => Array.isArray(candidate?.sourceMemoryIds)) : [];
  value.remixCandidates = Array.isArray(value.remixCandidates) ? value.remixCandidates.filter((candidate) => candidate?.purpose === "REMIX" && Array.isArray(candidate.sourceMemoryIds)) : [];
  for (const candidate of [...value.callbackCandidates, ...value.remixCandidates]) {
    candidate.usageCount ??= candidate.used ? 1 : 0;
    candidate.lastUsedRoundIndex ??= null;
  }
  value.anchorImage ??= null;
  value.finalImage ??= null;
  value.birthdayName ??= value.gameLength === "birthday" ? "Birthday Legend" : null;
  value.birthdayPersonId ??= null;
  value.soloMode ??= false;
  value.soloLiveImages ??= false;
  value.imageModel ??= "flux-1-schnell";
  value.imageGenerationNotice ??= null;
  value.kingImages = value.kingImages && typeof value.kingImages === "object" ? value.kingImages : {};
  value.kingFinalists = Array.isArray(value.kingFinalists) ? value.kingFinalists : [];
  value.comicTheme ??= null;
  value.comicFrames = Array.isArray(value.comicFrames) ? value.comicFrames : [];
  value.feedbackVotes = Array.isArray(value.feedbackVotes) ? value.feedbackVotes : [];
  value.matchNumber ??= 1;
  value.feedbackTallies = value.feedbackTallies && typeof value.feedbackTallies === "object" ? value.feedbackTallies : {};
  value.developerMode ??= false;
  value.soloPlayerId ??= null;
  for (const participant of value.participants ?? []) { participant.bot ??= false; participant.avatarPreset ??= null; }
  if (value.currentRound) {
    value.currentRound.choiceOptions ??= []; value.currentRound.featuredAnswerId ??= null; value.currentRound.developerScoreCap ??= null;
    value.currentRound.kingMysteryOrder ??= []; value.currentRound.kingMysteryIndex ??= 0; value.currentRound.kingMysteryDecoys ??= {};
    value.currentRound.kingMysteryVotes ??= {}; value.currentRound.kingMysteryResults ??= {};
  }
  return value;
}

export async function loadRoom(code: string): Promise<{ row: RoomRow; state: RoomState } | null> {
  await ensureDatabase();
  const row = await getD1().prepare("SELECT id, code, host_token_hash, version, state_json, expires_at FROM rooms WHERE code = ? AND expires_at > ? AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='main' AND child_code=rooms.code AND active=0)").bind(code.toUpperCase(), Date.now()).first<RoomRow>();
  if (!row) return null;
  return { row, state: hydrateRoomState(deserializeRoomState(row.state_json)) };
}

export async function roomCodeAvailable(code: string): Promise<boolean> {
  await ensureDatabase();
  return reserveCallbackCode(getD1(),code,'main',Date.now()+86400000);
}

export async function loadFeedbackTallies(): Promise<RoomState["feedbackTallies"]> {
  await ensureDatabase();
  const rows = await getD1().prepare("SELECT pair_id, choice_id, COUNT(*) AS votes FROM feedback_votes GROUP BY pair_id, choice_id").all<{ pair_id: string; choice_id: "a" | "b"; votes: number }>();
  const tallies: RoomState["feedbackTallies"] = {};
  for (const row of rows.results) {
    tallies[row.pair_id] ??= { a: 0, b: 0 };
    tallies[row.pair_id][row.choice_id] = Number(row.votes);
  }
  return tallies;
}

export async function insertRoom(state: RoomState, hostTokenHash: string): Promise<void> {
  await ensureDatabase();
  const day = new Date().toISOString().slice(0, 10);
  await getD1().batch([
    getD1().prepare("INSERT INTO rooms (id, code, host_token_hash, phase, version, last_action_id, state_json, status, game_length, content_mode, deadline_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(state.id, state.code, hostTokenHash, state.phase, state.version, "room-created", serializeRoomState(state), state.status, state.gameLength, state.contentMode, state.deadlineAt, state.updatedAt, state.expiresAt),
    getD1().prepare("INSERT INTO metrics_daily(day, metric, value) VALUES (?, 'rooms_created', 1) ON CONFLICT(day, metric) DO UPDATE SET value = value + 1").bind(day),
  ]);
}

export async function authenticateHost(requestToken: string | null, room: { row: RoomRow }): Promise<boolean> {
  if (!requestToken) return false;
  return timingSafeStringEqual(await sha256Hex(requestToken), room.row.host_token_hash);
}

export async function registerDisplaySession(roomId: string, tokenHash: string, now = Date.now()): Promise<void> {
  await ensureDatabase();
  await getD1().batch([
    getD1().prepare("DELETE FROM display_sessions WHERE room_id = ? AND last_seen_at < ?").bind(roomId, now - 24 * 60 * 60 * 1000),
    getD1().prepare("INSERT INTO display_sessions (id, room_id, last_seen_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at").bind(tokenHash, roomId, now),
  ]);
}

export async function authenticateDisplay(roomId: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  await ensureDatabase();
  const hash = await sha256Hex(token);
  const row = await getD1().prepare("SELECT id FROM display_sessions WHERE id = ? AND room_id = ? AND last_seen_at > ?").bind(hash, roomId, Date.now() - 6 * 60 * 60 * 1000).first<{ id: string }>();
  return Boolean(row);
}

export async function touchDisplaySession(roomId: string, token: string | null, now = Date.now()): Promise<void> {
  if (!token) return;
  const hash = await sha256Hex(token);
  await getD1().prepare("UPDATE display_sessions SET last_seen_at = ? WHERE id = ? AND room_id = ?").bind(now, hash, roomId).run();
}

export async function countActiveDisplaySessions(roomId: string, now = Date.now()): Promise<number> {
  await ensureDatabase();
  const row = await getD1().prepare("SELECT COUNT(*) AS count FROM display_sessions WHERE room_id = ? AND last_seen_at > ?").bind(roomId, now - 8_000).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function sendMediaSignal(roomId: string, senderId: string, targetId: string, kind: string, payload: unknown, now = Date.now()): Promise<void> {
  await ensureDatabase();
  await getD1().batch([
    getD1().prepare("DELETE FROM media_signals WHERE created_at < ?").bind(now - 120_000),
    getD1().prepare("INSERT INTO media_signals (id, room_id, sender_id, recipient_id, kind, payload_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(makeId("signal"), roomId, senderId, targetId, kind, JSON.stringify(payload), now, now + 120_000),
  ]);
}

export async function readMediaSignals(roomId: string, targetId: string, after: number): Promise<Array<{ id: string; senderId: string; kind: string; payload: unknown; createdAt: number }>> {
  await ensureDatabase();
  const rows = await getD1().prepare("SELECT id, sender_id, kind, payload_json, created_at FROM media_signals WHERE room_id = ? AND recipient_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 100").bind(roomId, targetId, after).all<{ id: string; sender_id: string; kind: string; payload_json: string; created_at: number }>();
  return rows.results.map((row) => ({ id: row.id, senderId: row.sender_id, kind: row.kind, payload: JSON.parse(row.payload_json) as unknown, createdAt: row.created_at }));
}

interface PlayerRow { id: string; role: "player" | "audience"; token_hash: string; removed_at: number | null }
export async function authenticateSeat(roomId: string, token: string | null): Promise<PlayerRow | null> {
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await getD1().prepare("SELECT id, role, token_hash, removed_at FROM players WHERE room_id = ? AND token_hash = ?").bind(roomId, hash).first<PlayerRow>();
  if (!row || row.removed_at || !timingSafeStringEqual(hash, row.token_hash)) return null;
  return row;
}

function expiryFor(state: RoomState, now: number): number {
  if (state.status === "LOBBY") return now + 2 * 60 * 60 * 1000;
  if (state.status === "ACTIVE") return now + 6 * 60 * 60 * 1000;
  return now + 24 * 60 * 60 * 1000;
}

function changed(result: D1Result<unknown> | undefined): number { return Number(result?.meta?.changes ?? 0); }

function conditionalEffect(database: D1Database, roomId: string, actionId: string, effect: DbEffect, matchNumber: number): D1PreparedStatement | D1PreparedStatement[] {
  const guard = "EXISTS (SELECT 1 FROM rooms WHERE id = ? AND last_action_id = ?)";
  if (effect.type === "answer") return database.prepare(`INSERT INTO answers (id, room_id, round_id, player_id, text, normalized_text, hidden, submitted_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(round_id, player_id) DO NOTHING`).bind(effect.answer.id, roomId, effect.roundId, effect.answer.playerId, effect.answer.text, effect.answer.text.normalize("NFKC"), effect.answer.hidden ? 1 : 0, effect.answer.submittedAt, roomId, actionId);
  if (effect.type === "hide_answer") return database.prepare(`UPDATE answers SET hidden = 1 WHERE id = ? AND room_id = ? AND ${guard}`).bind(effect.answerId, roomId, roomId, actionId);
  if (effect.type === "vote") return database.prepare(`INSERT INTO votes (id, room_id, round_id, voter_id, answer_id, rank, weight, audience) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT DO NOTHING`).bind(makeId("vote"), roomId, effect.roundId, effect.voterId, effect.answerId, effect.rank, effect.weight, effect.audience ? 1 : 0, roomId, actionId);
  if (effect.type === "prediction") return database.prepare(`INSERT INTO predictions (id, room_id, round_id, player_id, kind, payload_json) SELECT ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(round_id, player_id, kind) DO UPDATE SET payload_json=excluded.payload_json`).bind(makeId("prediction"), roomId, effect.roundId, effect.playerId, effect.kind, JSON.stringify(effect.payload), roomId, actionId);
  if (effect.type === "feedback_vote") return database.prepare(`INSERT INTO feedback_votes(event_key, pair_id, choice_id) SELECT ?, ?, ? WHERE ${guard} ON CONFLICT(event_key) DO NOTHING`).bind(effect.eventKey, effect.pairId, effect.choiceId, roomId, actionId);
  if (effect.type === "score") return database.prepare(`INSERT INTO score_events (id, event_key, room_id, round_id, player_id, kind, points, detail_json) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(event_key) DO NOTHING`).bind(effect.event.id, effect.event.eventKey, roomId, effect.event.roundId, effect.event.playerId, effect.event.kind, effect.event.points, JSON.stringify(effect.event.detail), roomId, actionId);
  if (effect.type === "lore") return database.prepare(`INSERT INTO lore (id, room_id, round_id, source_answer_id, author_player_id, kind, short_meaning, payload_json, safety) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(id) DO NOTHING`).bind(effect.lore.id, roomId, effect.roundId, effect.lore.sourceAnswerId, effect.lore.sourceAuthorId, effect.lore.kind, effect.lore.shortMeaning, JSON.stringify(effect.lore), effect.lore.safe ? "safe" : "blocked", roomId, actionId);
  if (effect.type === "lore_update") return database.prepare(`UPDATE lore SET kind = ?, short_meaning = ?, payload_json = ?, safety = ? WHERE id = ? AND room_id = ? AND ${guard}`).bind(effect.lore.kind, effect.lore.shortMeaning, JSON.stringify(effect.lore), effect.lore.safe ? "safe" : "blocked", effect.lore.id, roomId, roomId, actionId);
  if (effect.type === "memory_edge") return database.prepare(`INSERT INTO lore_edges (id, room_id, round_id, from_lore_id, relation, to_lore_id) SELECT ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(room_id, from_lore_id, relation, to_lore_id) DO NOTHING`).bind(effect.edge.id, roomId, effect.edge.roundId, effect.edge.fromLoreId, effect.edge.relation, effect.edge.toLoreId, roomId, actionId);
  if (effect.type === "callback") return database.prepare(`INSERT INTO callbacks (id, room_id, round_id, lore_id, source_author_id, payload_json) SELECT ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(id) DO NOTHING`).bind(effect.callback.id, roomId, effect.roundId, effect.callback.sourceMemoryIds.join(","), effect.sourceAuthorId ?? null, JSON.stringify(effect.callback), roomId, actionId);
  if (effect.type === "round") return database.prepare(`INSERT INTO match_rounds (id, room_id, match_number, round_index, kind, prompt_id, state_json, started_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json WHERE match_rounds.room_id=excluded.room_id AND match_rounds.match_number=excluded.match_number`).bind(effect.round.id, roomId, matchNumber, effect.round.index, effect.round.kind, effect.round.promptId, JSON.stringify(effect.round), effect.round.startedAt, roomId, actionId);
  if (effect.type === "job") return database.prepare(`INSERT INTO jobs (id, room_id, round_id, kind, status, prompt_hash, prompt_json, updated_at) SELECT ?, ?, ?, ?, 'QUEUED', ?, ?, ? WHERE ${guard} ON CONFLICT(prompt_hash) DO NOTHING`).bind(effect.id, roomId, effect.roundId, effect.kind, effect.promptHash, JSON.stringify(effect.prompt), effect.now, roomId, actionId);
  if (effect.type === "sketch_source" && effect.kind === "FISH_UPLOAD") return database.prepare(`INSERT INTO jobs (id, room_id, round_id, kind, status, prompt_hash, prompt_json, object_key, content_type, byte_size, safety, updated_at) SELECT ?, ?, ?, 'FISH_UPLOAD', 'READY', ?, ?, ?, 'image/png', ?, 'safe', ? WHERE ${guard} ON CONFLICT(id) DO NOTHING`).bind(effect.id, roomId, effect.roundId, effect.promptHash, JSON.stringify(effect.prompt), effect.objectKey, effect.byteSize, effect.now, roomId, actionId);
  if (effect.type === "sketch_source") return database.prepare(`INSERT INTO jobs (id, room_id, round_id, kind, status, prompt_hash, prompt_json, object_key, content_type, byte_size, safety, updated_at) SELECT ?, ?, ?, 'SKETCH_UPLOAD', 'READY', ?, ?, ?, 'image/png', ?, 'safe', ? WHERE ${guard} ON CONFLICT(id) DO NOTHING`).bind(effect.id, roomId, effect.roundId, effect.promptHash, JSON.stringify(effect.prompt), effect.objectKey, effect.byteSize, effect.now, roomId, actionId);
  if (effect.type === "sketch_job_complete") return database.prepare(`UPDATE jobs SET status = ?, lease_owner = NULL, lease_expires_at = NULL, object_key = ?, content_type = ?, byte_size = ?, error_code = ?, safety = 'safe', updated_at = ? WHERE id = ? AND room_id = ? AND status = 'GENERATING' AND lease_owner = ? AND lease_expires_at > ? AND ${guard}`).bind(effect.status, effect.objectKey ?? null, effect.contentType ?? null, effect.byteSize ?? null, effect.errorCode ?? null, effect.now, effect.id, roomId, effect.leaseOwner, effect.now, roomId, actionId);
  if (effect.type === "arcade_match") return database.prepare(`INSERT INTO arcade_matches(id, room_id, match_number, game_id, status, started_at) SELECT ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(room_id, match_number) DO NOTHING`).bind(effect.match.id, roomId, effect.match.matchNumber, effect.match.gameId, effect.match.status, effect.match.startedAt, roomId, actionId);
  if (effect.type === "arcade_finalize") {
    const resultJson = JSON.stringify(effect.match.result ?? {});
    const event = database.prepare(`INSERT INTO arcade_score_events(event_key, match_id, room_id, event_type, player_id, points, payload_json, occurred_at) SELECT ?, ?, ?, 'result', NULL, 0, ?, ? WHERE ${guard}`).bind(effect.event.eventId, effect.match.id, roomId, JSON.stringify(effect.event.payload ?? {}), effect.event.occurredAt, roomId, actionId);
    const complete = database.prepare(`UPDATE arcade_matches SET status = 'COMPLETE', ended_at = ?, result_json = ? WHERE id = ? AND room_id = ? AND status = 'ACTIVE' AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND last_action_id = ? AND phase = 'ARCADE_RESULTS') AND EXISTS (SELECT 1 FROM arcade_score_events WHERE event_key = ? AND match_id = ? AND event_type = 'result' AND payload_json = ? AND occurred_at = ?)`).bind(effect.match.endedAt, resultJson, effect.match.id, roomId, roomId, actionId, effect.event.eventId, effect.match.id, JSON.stringify(effect.event.payload ?? {}), effect.event.occurredAt);
    return [event, complete];
  }
  if (effect.type === "participant_add") return database.prepare(`INSERT INTO players(id, room_id, token_hash, nickname, nickname_normalized, role, seat, avatar, color, active, pending_activation, connected_at, last_seen_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard} ON CONFLICT(id) DO NOTHING`).bind(effect.participant.id, roomId, effect.tokenHash, effect.participant.nickname, effect.participant.nicknameNormalized, effect.participant.role, effect.participant.seat, effect.participant.avatar, effect.participant.color, effect.participant.active ? 1 : 0, effect.participant.pendingActivation ? 1 : 0, effect.participant.lastSeenAt, effect.participant.lastSeenAt, roomId, actionId);
  return database.prepare(`UPDATE players SET active = ?, pending_activation = ?, last_seen_at = ?, removed_at = ?, nickname_normalized = CASE WHEN ? IS NOT NULL THEN 'removed:' || id ELSE nickname_normalized END WHERE id = ? AND room_id = ? AND ${guard}`).bind(effect.participant.active ? 1 : 0, effect.participant.pendingActivation ? 1 : 0, effect.participant.lastSeenAt, effect.participant.removedAt, effect.participant.removedAt, effect.participant.id, roomId, roomId, actionId);
}

export async function processedAction(roomId: string, actionId: string): Promise<Record<string, unknown> | null> {
  const row = await getD1().prepare("SELECT response_json FROM processed_actions WHERE room_id = ? AND action_id = ?").bind(roomId, actionId).first<{ response_json: string }>();
  return row ? JSON.parse(row.response_json) as Record<string, unknown> : null;
}

export async function persistMutation(options: {
  base: RoomState;
  next: RoomState;
  actionId: string;
  actorId: string;
  actionType: string;
  effects: DbEffect[];
  recordAction?: boolean;
}): Promise<boolean> {
  const { base, next, actionId, actorId, actionType, effects, recordAction = true } = options;
  const database = getD1();
  const now = Date.now();
  next.version = base.version + 1;
  next.updatedAt = now;
  next.expiresAt = expiryFor(next, now);
  next.actionCount += 1;
  const response = { ok: true, version: next.version, phase: next.phase };
  const finalizeGuard = arcadeFinalizeRoomCasGuard(effects, base.id);
  const sketchCompletion = effects.find((effect) => effect.type === "sketch_job_complete");
  const sketchGuard = sketchCompletion ? " AND EXISTS (SELECT 1 FROM jobs WHERE id = ? AND room_id = rooms.id AND status = 'GENERATING' AND lease_owner = ? AND lease_expires_at > ?)" : "";
  const sketchGuardValues = sketchCompletion ? [sketchCompletion.id, sketchCompletion.leaseOwner, sketchCompletion.now] : [];
  const statements: D1PreparedStatement[] = [
    database.prepare(`UPDATE rooms SET phase = ?, version = ?, last_action_id = ?, state_json = ?, status = ?, game_length = ?, content_mode = ?, deadline_at = ?, updated_at = ?, expires_at = ? WHERE id = ? AND version = ? AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='main' AND child_code=rooms.code AND active=0)${finalizeGuard.sql}${sketchGuard}`).bind(next.phase, next.version, actionId, serializeRoomState(next), next.status, next.gameLength, next.contentMode, next.deadlineAt, next.updatedAt, next.expiresAt, base.id, base.version, ...finalizeGuard.values, ...sketchGuardValues),
  ];
  if (recordAction) statements.push(database.prepare("INSERT INTO processed_actions(room_id, action_id, actor_id, action_type, response_json) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND last_action_id = ?) ON CONFLICT(room_id, action_id) DO NOTHING").bind(base.id, actionId, actorId, actionType, JSON.stringify(response), base.id, actionId));
  for (const effect of effects) {
    const conditional = conditionalEffect(database, base.id, actionId, effect, next.matchNumber);
    statements.push(...(Array.isArray(conditional) ? conditional : [conditional]));
  }
  if (actionType === 'UPDATE_AVATAR') {
    const participant = next.participants.find(player => player.id === actorId && !player.removedAt && !player.bot && player.role === 'player');
    if (participant?.avatarConfig) statements.push(sessionAvatarUpdate(database, {roomId:base.id,actionId,actorId,version:next.version,avatarConfig:participant.avatarConfig,avatarPreset:participant.avatarPreset??null}));
  }
  for(const b of next.sketchRelay?.showdown?.workshop?.ballots??[]){
    if(b.acceptedAt===undefined)continue;
    statements.push(database.prepare("INSERT INTO sorcery_prompt_preferences(id,room_id,match_id,actor_id,profile_hash,host_hash,options_json,choice_id,accepted_at,reward) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rooms WHERE id=? AND last_action_id=?) ON CONFLICT(id) DO NOTHING").bind(b.id,base.id,next.sketchRelay!.matchId,b.actor,b.owner,next.sorceryHostProfileHash??null,JSON.stringify(b.options),b.choice??null,b.acceptedAt,b.reward,base.id,actionId));
  }
  const results = await database.batch(statements);
  const committed = changed(results[0]) === 1;
  if(committed&&base.sketchRelay?.phase==='round-results'&&next.sketchRelay?.showdown?.version===4&&next.sketchRelay.phase!=='round-results'){
    const {archiveSketchShowcase}=await import('./sketch-showcase');await archiveSketchShowcase(next).catch(()=>console.warn('hall_archive_deferred',{roomId:next.id}));
  }
  if (committed && next.status === "COMPLETE") {
    const { archiveCompletedMatch } = await import("./history");
    await archiveCompletedMatch(next).catch((error) => console.error("history_archive_failed", { roomId: next.id, matchNumber: next.matchNumber, error: String(error) }));
  }
  return committed;
}

const PLAYER_COLORS = ["#46DBDC", "#FFD84B", "#FF6F61", "#9C7CFF", "#7BE495", "#FF9ED2", "#56A7FF", "#F5A742", "#9BE564", "#E88DFF", "#54E6B5", "#FF886F"];
export async function addParticipant(roomCode: string, participant: Omit<ParticipantState, "id" | "seat" | "avatar" | "color" | "lastSeenAt" | "removedAt">, tokenHash: string, parentMemberId?: string): Promise<ParticipantState | "RACE"> {
  const loaded = await loadRoom(roomCode);
  if (!loaded) throw new Error("ROOM_NOT_FOUND");
  const base = loaded.state;
  if (participant.role === "player" && (base.phase !== "LOBBY" || base.status !== "LOBBY" || base.joiningLocked)) return "RACE";
  if (participant.role === "player" && base.participants.filter((item) => item.role === "player" && !item.bot && !item.removedAt).length >= 10) return "RACE";
  const lobbySlot = participant.role === "player" ? chooseLobbySlot(base, !participant.bot) : null;
  if (participant.role === "player" && lobbySlot === null) return "RACE";
  const seat = nextPhysicalSeat(base);
  const now = Date.now();
  const nextParticipant: ParticipantState = { ...participant, id: makeId(participant.role === "player" ? "player" : "audience"), seat, ...(participant.role === "player" ? { lobbySlot: lobbySlot! } : {}), avatar: (seat - 1) % 12, color: PLAYER_COLORS[(seat - 1) % PLAYER_COLORS.length], lastSeenAt: now, removedAt: null };
  const next = structuredClone(base);
  const replacedBot = participant.role === "player" && !participant.bot ? next.participants.find((item) => item.role === "player" && item.lobbySlot === lobbySlot && item.bot && !item.removedAt) : undefined;
  if (replacedBot) { replacedBot.active = false; replacedBot.removedAt = now; }
  next.participants.push(nextParticipant);
  if (participant.role === "player" && participant.bot) next.botSeats = [...new Set([...(next.botSeats ?? []), lobbySlot!])].sort((left, right) => left - right);
  rebalanceBowlTeams(next);
  const actionId = `join:${nextParticipant.id}`;
  next.version = base.version + 1;
  next.updatedAt = now;
  next.expiresAt = expiryFor(next, now);
  next.actionCount += 1;
  const database = getD1();
  const statements: D1PreparedStatement[] = [
    database.prepare("UPDATE rooms SET version = ?, last_action_id = ?, state_json = ?, updated_at = ?, expires_at = ? WHERE id = ? AND version = ? AND (NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='main' AND child_code=rooms.code) OR EXISTS(SELECT 1 FROM callback_session_games g JOIN callback_session_members m ON m.session_code=g.session_code JOIN callback_sessions s ON s.active_id=g.id WHERE g.child_kind='main' AND g.child_code=rooms.code AND g.active=1 AND s.stage='PLAYING' AND s.expires_at>? AND m.id=? AND m.token_hash=? AND NOT EXISTS(SELECT 1 FROM players p WHERE p.room_id=rooms.id AND p.token_hash=m.token_hash AND p.removed_at IS NOT NULL)))").bind(next.version, actionId, serializeRoomState(next), now, next.expiresAt, base.id, base.version, now, parentMemberId ?? null, tokenHash),
  ];
  if (replacedBot) {
    const retire = conditionalEffect(database, base.id, actionId, { type: "participant_state", participant: replacedBot }, next.matchNumber);
    statements.push(...(Array.isArray(retire) ? retire : [retire]));
  }
  statements.push(database.prepare("UPDATE players SET nickname_normalized = 'removed:' || id WHERE room_id = ? AND nickname_normalized = ? AND removed_at IS NOT NULL AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND last_action_id = ?)").bind(base.id, nextParticipant.nicknameNormalized, base.id, actionId));
  statements.push(database.prepare("INSERT INTO players(id, room_id, token_hash, nickname, nickname_normalized, role, seat, avatar, color, active, pending_activation, connected_at, last_seen_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND last_action_id = ?)").bind(nextParticipant.id, base.id, tokenHash, nextParticipant.nickname, nextParticipant.nicknameNormalized, nextParticipant.role, seat, nextParticipant.avatar, nextParticipant.color, nextParticipant.active ? 1 : 0, nextParticipant.pendingActivation ? 1 : 0, now, now, base.id, actionId));
  const results = await database.batch(statements);
  return changed(results[0]) === 1 ? nextParticipant : "RACE";
}

export async function updateLastSeen(roomId: string, participantId: string, now = Date.now()): Promise<void> {
  await getD1().prepare("UPDATE players SET last_seen_at = ? WHERE room_id = ? AND id = ?").bind(now, roomId, participantId).run();
}

export async function cleanupExpiredRooms(limit = 3): Promise<number> {
  await ensureDatabase();
  const rows = await getD1().prepare("SELECT id FROM rooms WHERE expires_at <= ? ORDER BY expires_at LIMIT ?").bind(Date.now(), limit).all<{ id: string }>();
  for (const { id } of rows.results) {
    if(!await import("./player-creations/room-manifest").then(m=>m.retryFishArchives(id)).catch(()=>false))continue;
    await import("./sketch-showcase").then(m => m.retryPendingSketchShowcase(id)).catch(() => {});
    const media = runtimeEnv().MEDIA;
    if (media) {
      const objects = await getD1().prepare("SELECT id, kind, object_key FROM jobs WHERE room_id = ? AND object_key IS NOT NULL").bind(id).all<{ id: string; kind: string; object_key: string }>();
      const keys = objects.results.flatMap((row) => row.kind === "COMIC_PANEL_IMAGE" ? [row.object_key, `rooms/${id}/${row.id}-reference`] : [row.object_key]);
      if (keys.length) await media.delete(keys);
      // Include immutable upload objects from races that never acquired a job receipt.
      let cursor: string | undefined;
      do {
        const page = await media.list({ prefix: `rooms/${id}/`, limit: 1000, ...(cursor ? { cursor } : {}) });
        if (page.objects.length) await media.delete(page.objects.map(object => object.key));
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    }
    const tables = ["player_creation_presence", "room_creation_controls", "arcade_score_events", "arcade_matches", "assignments", "answers", "votes", "predictions", "lore_edges", "lore", "callbacks", "jobs", "score_events", "processed_actions", "cleanup_queue", "media_signals", "display_sessions", "players", "match_rounds", "rounds"];
    await getD1().batch([...tables.map((table) => getD1().prepare(`DELETE FROM ${table} WHERE room_id = ?`).bind(id)), getD1().prepare("DELETE FROM rooms WHERE id = ?").bind(id)]);
  }
  await getD1().prepare("DELETE FROM rate_limits WHERE expires_at <= ?").bind(Date.now()).run();
  await getD1().prepare("DELETE FROM avatar_live_poses WHERE expires_at <= ?").bind(Date.now()).run();
  return rows.results.length;
}

export async function countActiveCodes(): Promise<number> {
  await ensureDatabase();
  const row = await getD1().prepare("SELECT COUNT(*) AS count FROM rooms WHERE expires_at > ?").bind(Date.now()).first<{ count: number }>();
  return row?.count ?? 0;
}

export interface AuthIdentity { role: Role; id: string }
