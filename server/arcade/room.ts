import { z } from "zod";
import { ArcadeGameIdSchema } from "../../lib/arcade/contracts";
import { makeId } from "../../lib/game/random";
import { selectArcadeControllerIds } from "./tickets";
import { deserializeRoomState, serializeRoomState } from "../serialization";
import type { ArcadeEventState, ArcadeMatchState, DbEffect, RoomState } from "../types";

const ArcadeEventSchema = z.object({
  eventId: z.string().trim().min(1).max(120), matchId: z.string().min(1).max(120),
  type: z.enum(["goal", "result"]), playerId: z.string().min(1).max(120).nullable(),
  points: z.number().int().min(0).max(100_000), occurredAt: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.unknown()).optional(),
}).strict();

export function arcadeFinalizeRoomCasGuard(effects: readonly DbEffect[], roomId: string): { sql: string; values: unknown[] } {
  const finalization = effects.find((effect) => effect.type === "arcade_finalize");
  if (finalization?.type === "arcade_finalize" && (
    !ArcadeGameIdSchema.safeParse(finalization.match.gameId).success || finalization.match.status !== "COMPLETE" ||
    finalization.event.matchId !== finalization.match.id || finalization.event.eventId !== `${finalization.match.id}:${finalization.match.gameId}:complete` ||
    finalization.event.type !== "result" || finalization.event.playerId !== null || finalization.event.points !== 0 || !finalization.match.result
  )) throw new Error("ARCADE_FINALIZE_MATCH_MISMATCH");
  return finalization?.type === "arcade_finalize"
    ? { sql: " AND EXISTS (SELECT 1 FROM arcade_matches WHERE id = ? AND room_id = ? AND status = 'ACTIVE')", values: [finalization.match.id, roomId] }
    : { sql: "", values: [] };
}

export function createArcadeMatch(room: RoomState, gameId: z.infer<typeof ArcadeGameIdSchema>, now = Date.now()): { room: RoomState; effect: Extract<DbEffect, { type: "arcade_match" }> } {
  if (room.gameLength !== "arcade" || room.arcadeGameId !== gameId) throw new Error("ARCADE_GAME_MISMATCH");
  if (room.phase !== "LOBBY") throw new Error("WRONG_PHASE");
  if (gameId !== "drift-racer" && gameId !== "fish-tank" && room.participants.filter((participant) => participant.role === "player" && participant.active && !participant.removedAt).length < 2) throw new Error("NOT_ENOUGH_PLAYERS");
  const match: ArcadeMatchState = {
    id: makeId("arcade-match"), gameId, matchNumber: room.matchNumber, status: "ACTIVE",
    startedAt: now, endedAt: null, result: null,
    ...((gameId === "air-hockey" || gameId === "tap-race" || gameId === "light-trails") ? { controllerIds: selectArcadeControllerIds(gameId, room.participants, room.matchNumber) } : {}),
  };
  const next = structuredClone(room);
  next.arcadeMatch = match;
  next.phase = "ARCADE_ACTIVE";
  next.phaseStartedAt = now;
  next.deadlineAt = null;
  next.paused = false;
  next.remainingMs = null;
  next.status = "ACTIVE";
  next.joiningLocked = true;
  return { room: next, effect: { type: "arcade_match", match } };
}

function validatedEvents(events: unknown): ArcadeEventState[] {
  const parsed = z.array(ArcadeEventSchema).max(200).parse(events);
  const unique = new Map<string, ArcadeEventState>();
  for (const event of parsed) {
    if (event.type === "goal" && !event.playerId) throw new Error("ARCADE_PLAYER_REQUIRED");
    if (JSON.stringify(event.payload ?? {}).length > 16_000) throw new Error("ARCADE_EVENT_TOO_LARGE");
    const prior = unique.get(event.eventId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(event)) throw new Error("ARCADE_EVENT_CONFLICT");
    unique.set(event.eventId, event);
  }
  return [...unique.values()];
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

interface PersistedArcadeEvent {
  event_key: string;
  event_type: "goal" | "result";
  player_id: string | null;
  points: number;
  payload_json: string;
  occurred_at: number;
}

async function loadPersistedEvents(db: D1Database, roomId: string, matchId: string, events: ArcadeEventState[]): Promise<PersistedArcadeEvent[]> {
  if (!events.length) return [];
  const keys = events.map((event) => `${matchId}:${event.eventId}`);
  const result = await db.prepare(`SELECT event_key, event_type, player_id, points, payload_json, occurred_at FROM arcade_score_events WHERE room_id = ? AND match_id = ? AND event_key IN (${keys.map(() => "?").join(",")})`).bind(roomId, matchId, ...keys).all<PersistedArcadeEvent>();
  return result.results;
}

function assertEventsCompatible(persisted: PersistedArcadeEvent[], matchId: string, events: ArcadeEventState[]): void {
  const incoming = new Map(events.map((event) => [`${matchId}:${event.eventId}`, event]));
  for (const row of persisted) {
    const event = incoming.get(row.event_key);
    let payload: unknown;
    try { payload = JSON.parse(row.payload_json) as unknown; }
    catch { throw new Error("ARCADE_EVENT_CONFLICT"); }
    if (!event || row.event_type !== event.type || row.player_id !== event.playerId || row.points !== event.points || row.occurred_at !== event.occurredAt || canonicalJson(payload) !== canonicalJson(event.payload ?? {})) {
      throw new Error("ARCADE_EVENT_CONFLICT");
    }
  }
}

function allEventsPersisted(persisted: PersistedArcadeEvent[], matchId: string, events: ArcadeEventState[]): boolean {
  const keys = new Set(persisted.map((row) => row.event_key));
  return events.every((event) => keys.has(`${matchId}:${event.eventId}`));
}

export async function recordArcadeEvents(roomId: string, input: unknown, database?: D1Database): Promise<{ accepted: number; completed: boolean }> {
  const events = validatedEvents(input);
  if (!events.length) return { accepted: 0, completed: false };
  let db = database;
  if (!db) {
    const runtimeDatabase = await import("../database");
    await runtimeDatabase.ensureDatabase();
    db = runtimeDatabase.getD1();
  }
  const roomRow = await db.prepare("SELECT version, state_json FROM rooms WHERE id = ?").bind(roomId).first<{ version: number; state_json: string }>();
  if (!roomRow) throw new Error("ROOM_NOT_FOUND");
  const base = deserializeRoomState(roomRow.state_json);
  if (roomRow.version !== base.version) throw new Error("ROOM_CHANGED");
  const match = base.arcadeMatch;
  if (base.gameLength !== "arcade" || !match) throw new Error("ARCADE_MATCH_NOT_ACTIVE");
  if (events.some((event) => event.matchId !== match.id)) throw new Error("ARCADE_MATCH_MISMATCH");
  const knownPlayers = new Set(base.participants.filter((participant) => participant.role === "player").map((participant) => participant.id));
  if (events.some((event) => event.playerId && !knownPlayers.has(event.playerId))) throw new Error("ARCADE_PLAYER_MISMATCH");
  const existingEvents = await loadPersistedEvents(db, roomId, match.id, events);
  assertEventsCompatible(existingEvents, match.id, events);
  if (base.phase === "ARCADE_RESULTS" && match.status === "COMPLETE") {
    if (allEventsPersisted(existingEvents, match.id, events)) return { accepted: 0, completed: true };
    throw new Error("ARCADE_MATCH_NOT_ACTIVE");
  }
  if (base.phase !== "ARCADE_ACTIVE" || match.status !== "ACTIVE") throw new Error("ARCADE_MATCH_NOT_ACTIVE");
  const resultEvents = events.filter((event) => event.type === "result");
  if (resultEvents.length > 1) throw new Error("ARCADE_MULTIPLE_RESULTS");
  const resultEvent = resultEvents[0];
  const now = Math.max(Date.now(), base.updatedAt);
  const statements = [] as ReturnType<D1Database["prepare"]>[];
  let expectedCompletedVersion: number | null = null;
  if (resultEvent) {
    const next = structuredClone(base);
    next.phase = "ARCADE_RESULTS";
    next.phaseStartedAt = resultEvent.occurredAt;
    next.deadlineAt = null;
    next.status = "COMPLETE";
    next.arcadeMatch = { ...match, status: "COMPLETE", endedAt: resultEvent.occurredAt, result: resultEvent.payload ?? {} };
    next.version = base.version + 1;
    next.updatedAt = now;
    next.actionCount += 1;
    next.expiresAt = Math.max(base.expiresAt, now + 30 * 60 * 1000);
    expectedCompletedVersion = next.version;
    const duplicateGuard = "AND NOT EXISTS (SELECT 1 FROM arcade_score_events existing, json_each(?) incoming WHERE existing.event_key = json_extract(incoming.value, '$.eventKey') AND (existing.event_type != json_extract(incoming.value, '$.type') OR existing.player_id IS NOT json_extract(incoming.value, '$.playerId') OR existing.points != json_extract(incoming.value, '$.points') OR existing.payload_json != json_extract(incoming.value, '$.payloadJson') OR existing.occurred_at != json_extract(incoming.value, '$.occurredAt')))";
    const duplicateGuardPayload = JSON.stringify(events.map((event) => ({ eventKey: `${match.id}:${event.eventId}`, type: event.type, playerId: event.playerId, points: event.points, payloadJson: canonicalJson(event.payload ?? {}), occurredAt: event.occurredAt })));
    statements.push(db.prepare(`UPDATE rooms SET phase = ?, version = ?, state_json = ?, status = ?, deadline_at = NULL, updated_at = ?, expires_at = ? WHERE id = ? AND version = ? AND phase = 'ARCADE_ACTIVE' AND EXISTS (SELECT 1 FROM arcade_matches WHERE id = ? AND room_id = ? AND status = 'ACTIVE') ${duplicateGuard}`).bind(next.phase, next.version, serializeRoomState(next), next.status, now, next.expiresAt, roomId, base.version, match.id, roomId, duplicateGuardPayload));
  }
  const eventGate = expectedCompletedVersion === null
    ? "EXISTS (SELECT 1 FROM rooms WHERE id = ? AND version = ? AND phase = 'ARCADE_ACTIVE') AND EXISTS (SELECT 1 FROM arcade_matches WHERE id = ? AND room_id = ? AND status = 'ACTIVE')"
    : "EXISTS (SELECT 1 FROM rooms WHERE id = ? AND version = ? AND phase = 'ARCADE_RESULTS') AND EXISTS (SELECT 1 FROM arcade_matches WHERE id = ? AND room_id = ? AND status = 'ACTIVE')";
  for (const event of events) {
    const gateBindings = expectedCompletedVersion === null ? [roomId, base.version, match.id, roomId] : [roomId, expectedCompletedVersion, match.id, roomId];
    statements.push(db.prepare(`INSERT INTO arcade_score_events(event_key, match_id, room_id, event_type, player_id, points, payload_json, occurred_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${eventGate} ON CONFLICT(event_key) DO NOTHING`).bind(`${match.id}:${event.eventId}`, match.id, roomId, event.type, event.playerId, event.points, canonicalJson(event.payload ?? {}), event.occurredAt, ...gateBindings));
  }
  if (resultEvent && expectedCompletedVersion !== null) {
    statements.push(db.prepare("UPDATE arcade_matches SET status = 'COMPLETE', ended_at = ?, result_json = ? WHERE id = ? AND room_id = ? AND status = 'ACTIVE' AND EXISTS (SELECT 1 FROM rooms WHERE id = ? AND version = ? AND phase = 'ARCADE_RESULTS') AND EXISTS (SELECT 1 FROM arcade_score_events WHERE event_key = ? AND event_type = 'result' AND player_id IS ? AND points = ? AND payload_json = ? AND occurred_at = ?)").bind(resultEvent.occurredAt, canonicalJson(resultEvent.payload ?? {}), match.id, roomId, roomId, expectedCompletedVersion, `${match.id}:${resultEvent.eventId}`, resultEvent.playerId, resultEvent.points, canonicalJson(resultEvent.payload ?? {}), resultEvent.occurredAt));
  }
  const results = await db.batch(statements);
  const roomCasChanges = resultEvent ? Number(results[0]?.meta?.changes ?? 0) : 0;
  const eventResultOffset = resultEvent ? 1 : 0;
  const accepted = events.reduce((count, _event, index) => count + Number(results[eventResultOffset + index]?.meta?.changes ?? 0), 0);
  if (resultEvent && roomCasChanges === 0) {
    const currentRow = await db.prepare("SELECT version, state_json FROM rooms WHERE id = ?").bind(roomId).first<{ version: number; state_json: string }>();
    const currentPersisted = await loadPersistedEvents(db, roomId, match.id, events);
    assertEventsCompatible(currentPersisted, match.id, events);
    if (currentRow) {
      const current = deserializeRoomState(currentRow.state_json);
      if (currentRow.version === current.version && current.version > base.version && current.phase === "ARCADE_RESULTS" && current.arcadeMatch?.status === "COMPLETE" && current.arcadeMatch.id === match.id && allEventsPersisted(currentPersisted, match.id, events)) {
        return { accepted: 0, completed: true };
      }
    }
    throw new Error("ROOM_CHANGED");
  }
  if (resultEvent) {
    const matchResult = results[results.length - 1];
    if (Number(matchResult?.meta?.changes ?? 0) !== 1) throw new Error("ARCADE_RESULT_NOT_PERSISTED");
  }
  const persisted = await loadPersistedEvents(db, roomId, match.id, events);
  assertEventsCompatible(persisted, match.id, events);
  if (!resultEvent && !allEventsPersisted(persisted, match.id, events)) throw new Error("ROOM_CHANGED");
  return { accepted, completed: Boolean(resultEvent && roomCasChanges === 1 && allEventsPersisted(persisted, match.id, events)) };
}
