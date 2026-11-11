export const OPENAI_IMAGE_GUARD_DDL = [
  `CREATE TABLE IF NOT EXISTS openai_image_reservations (job_id TEXT PRIMARY KEY, room_id TEXT NOT NULL, credit_window_id TEXT NOT NULL, reserved_at INTEGER NOT NULL, day_utc TEXT NOT NULL, billing_blocked INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_openai_image_reservations_window ON openai_image_reservations(credit_window_id)`,
  `CREATE INDEX IF NOT EXISTS idx_openai_image_reservations_day ON openai_image_reservations(credit_window_id, day_utc)`,
  `CREATE INDEX IF NOT EXISTS idx_openai_image_reservations_room ON openai_image_reservations(credit_window_id, room_id)`,
  `CREATE TABLE IF NOT EXISTS openai_image_circuits (credit_window_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)`,
] as const;

export interface OpenAIImageAccessResult { available: boolean; code: string | null; message: string | null }
export interface OpenAIImageGuardConfig {
  OPENAI_IMAGES_ENABLED?: string;
  OPENAI_IMAGES_CREDIT_WINDOW?: string;
  OPENAI_IMAGES_STOP_AT?: string;
  OPENAI_IMAGES_MAX_REQUESTS?: string;
  OPENAI_IMAGES_MAX_DAILY_REQUESTS?: string;
  OPENAI_IMAGES_MAX_ROOM_REQUESTS?: string;
  OPENAI_IMAGE_API_KEY?: string;
  DB?: D1Database;
}
type Config = OpenAIImageGuardConfig;

const ACCESS_MESSAGE = "OpenAI image generation is unavailable. Choose another generator or continue with the concept card.";
const STOP_MESSAGE = "OpenAI image generation has reached its configured allowance or stop date. Choose another generator or continue with the concept card.";
const blockedCreditWindows = new Set<string>();
const setupMessage = "OpenAI image generation is not configured for this game. Choose another generator or continue with the concept card.";
const accessDenied = (code: string, message = ACCESS_MESSAGE): OpenAIImageAccessResult => ({ available: false, code, message });
const open = (): OpenAIImageAccessResult => ({ available: true, code: null, message: null });

function timestamp(value: Date | number = Date.now()): number {
  return value instanceof Date ? value.getTime() : value;
}

function verifiedWindow(config: Config): string | null {
  if (config.OPENAI_IMAGES_ENABLED !== "true") return null;
  if (!(typeof config.OPENAI_IMAGES_CREDIT_WINDOW === "string") || !config.OPENAI_IMAGES_CREDIT_WINDOW.trim() || config.OPENAI_IMAGES_CREDIT_WINDOW.trim().length > 128) return null;
  return config.OPENAI_IMAGES_CREDIT_WINDOW.trim();
}

function stopAt(config: Config): number | null {
  if (typeof config.OPENAI_IMAGES_STOP_AT !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(config.OPENAI_IMAGES_STOP_AT)) return null;
  const parsed = Date.parse(config.OPENAI_IMAGES_STOP_AT);
  return Number.isFinite(parsed) ? parsed : null;
}

function max(config: Config, key: string, fallback: number, ceiling: number): number | null {
  const raw = (config as unknown as Record<string, unknown>)[key];
  if (raw === undefined) return fallback;
  const value = typeof raw === "string" && /^\d+$/u.test(raw) ? Number(raw) : Number.NaN;
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, ceiling) : null;
}

export function openAIImageAccess(config: Config, now: Date | number = Date.now()): OpenAIImageAccessResult {
  if (!(typeof config.OPENAI_IMAGE_API_KEY === "string" && config.OPENAI_IMAGE_API_KEY)) return accessDenied("OPENAI_IMAGE_NOT_CONFIGURED", setupMessage);
  if (config.OPENAI_IMAGES_ENABLED !== "true") return accessDenied("OPENAI_IMAGES_DISABLED");
  const window = verifiedWindow(config);
  const expires = stopAt(config);
  if (!window || expires === null) return accessDenied("OPENAI_IMAGES_NOT_VERIFIED", setupMessage);
  if (!Number.isFinite(timestamp(now))) return accessDenied("OPENAI_IMAGES_NOT_VERIFIED", setupMessage);
  if (blockedCreditWindows.has(window)) return accessDenied("ALLOWANCE_STOP", STOP_MESSAGE);
  const limits = caps(config);
  if (!limits.total || !limits.daily || !limits.room) return accessDenied("ALLOWANCE_STOP", STOP_MESSAGE);
  if (expires <= timestamp(now)) return accessDenied("ALLOWANCE_STOP", STOP_MESSAGE);
  return open();
}

export interface OpenAIImageReservation { readonly jobId: string; readonly roomId: string; readonly creditWindowId: string }
const issuedReservations = new WeakSet<object>();
function issueReservation(jobId: string, roomId: string, creditWindowId: string): OpenAIImageReservation {
  const value = Object.freeze({ jobId, roomId, creditWindowId });
  issuedReservations.add(value);
  return value;
}

export function consumeOpenAIImageReservation(value: unknown, expected: { creditWindowId: string; jobId: string; roomId: string }): value is OpenAIImageReservation {
  if (typeof value !== "object" || value === null || !issuedReservations.has(value)) return false;
  const reservation = value as OpenAIImageReservation;
  if (reservation.creditWindowId !== expected.creditWindowId || reservation.jobId !== expected.jobId || reservation.roomId !== expected.roomId) return false;
  issuedReservations.delete(value);
  return true;
}

export const OPENAI_IMAGE_MAX_PROMPT_CHARS = 8000;

function caps(config: Config) {
  return {
    total: max(config, "OPENAI_IMAGES_MAX_REQUESTS", 1000, 1000),
    daily: max(config, "OPENAI_IMAGES_MAX_DAILY_REQUESTS", 300, 300),
    room: max(config, "OPENAI_IMAGES_MAX_ROOM_REQUESTS", 100, 100),
  };
}

export async function getOpenAIImageAvailability(config: Config, db: D1Database | undefined = config.DB, now: Date | number = Date.now()): Promise<OpenAIImageAccessResult> {
  const access = openAIImageAccess(config, now);
  if (!access.available) return access;
  if (!db) return accessDenied("OPENAI_IMAGE_GUARD_UNAVAILABLE", setupMessage);
  try {
    const window = verifiedWindow(config)!;
    const [circuit, counts] = await Promise.all([
      db.prepare("SELECT credit_window_id FROM openai_image_circuits WHERE credit_window_id = ?").bind(window).first<{ credit_window_id: string }>(),
      db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN day_utc = ? THEN 1 ELSE 0 END) AS daily, SUM(CASE WHEN billing_blocked = 1 THEN 1 ELSE 0 END) AS billing_blocked FROM openai_image_reservations WHERE credit_window_id = ?").bind(new Date(timestamp(now)).toISOString().slice(0, 10), window).first<{ total: number; daily: number; billing_blocked: number }>(),
    ]);
    if (circuit || Number(counts?.billing_blocked ?? 0) > 0) return accessDenied("ALLOWANCE_STOP", STOP_MESSAGE);
    // Usage summaries are advisory for this endpoint. The INSERT SELECT below remains the atomic gate.
    const limits = caps(config);
    if (!limits.total || !limits.daily || !limits.room || Number(counts?.total ?? 0) >= limits.total || Number(counts?.daily ?? 0) >= limits.daily) return accessDenied("ALLOWANCE_STOP", STOP_MESSAGE);
    return open();
  } catch {
    return accessDenied("OPENAI_IMAGE_GUARD_UNAVAILABLE", setupMessage);
  }
}

export type OpenAIImageReservationResult = { reserved: true; reservation: OpenAIImageReservation } | { reserved: false; code: string; message: string };

export async function reserveOpenAIImageRequest(input: { db: D1Database; config: Config; jobId: string; roomId: string; now?: Date | number }): Promise<OpenAIImageReservationResult> {
  const now = timestamp(input.now);
  const access = openAIImageAccess(input.config, now);
  if (!access.available) return { reserved: false, code: access.code ?? "ALLOWANCE_STOP", message: access.message ?? STOP_MESSAGE };
  const window = verifiedWindow(input.config)!;
  const limits = caps(input.config);
  const day = new Date(now).toISOString().slice(0, 10);
  try {
    const result = await input.db.prepare(`INSERT INTO openai_image_reservations (job_id, room_id, credit_window_id, reserved_at, day_utc)
      SELECT ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM openai_image_reservations WHERE job_id = ?)
        AND NOT EXISTS (SELECT 1 FROM openai_image_circuits WHERE credit_window_id = ?)
        AND NOT EXISTS (SELECT 1 FROM openai_image_reservations WHERE credit_window_id = ? AND billing_blocked = 1)
        AND (SELECT COUNT(*) FROM openai_image_reservations WHERE credit_window_id = ?) < ?
        AND (SELECT COUNT(*) FROM openai_image_reservations WHERE credit_window_id = ? AND day_utc = ?) < ?
        AND (SELECT COUNT(*) FROM openai_image_reservations WHERE credit_window_id = ? AND room_id = ?) < ?`)
      .bind(input.jobId, input.roomId, window, now, day, input.jobId, window, window, window, limits.total, window, day, limits.daily, window, input.roomId, limits.room)
      .run();
    if (Number(result.meta.changes ?? 0) === 1) return { reserved: true, reservation: issueReservation(input.jobId, input.roomId, window) };
    return { reserved: false, code: "ALLOWANCE_STOP", message: STOP_MESSAGE };
  } catch {
    return { reserved: false, code: "OPENAI_IMAGE_GUARD_UNAVAILABLE", message: setupMessage };
  }
}

export async function tripOpenAIImageCircuit(db: D1Database, creditWindowId: string, now: Date | number = Date.now(), jobId?: string): Promise<void> {
  blockedCreditWindows.add(creditWindowId);
  const writes = [db.prepare("INSERT OR IGNORE INTO openai_image_circuits (credit_window_id, created_at) VALUES (?, ?)").bind(creditWindowId, timestamp(now)).run()];
  if (jobId) writes.push(db.prepare("UPDATE openai_image_reservations SET billing_blocked = 1 WHERE job_id = ? AND credit_window_id = ?").bind(jobId, creditWindowId).run());
  const results = await Promise.allSettled(writes);
  if (results.every(result => result.status === "rejected")) throw new Error("OPENAI_IMAGE_CIRCUIT_PERSIST_FAILED");
}

function errorFields(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return {};
  const top = error as Record<string, unknown>;
  const nested = top.error && typeof top.error === "object" ? top.error as Record<string, unknown> : {};
  return { ...nested, ...top };
}

export function isOpenAIImageBillingError(error: unknown): boolean {
  const fields = errorFields(error);
  const codes = [fields.code, fields.type, fields.error_code].filter((value): value is string => typeof value === "string").map((value) => value.toLowerCase());
  if (codes.some((code) => ["credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached", "project_usage_limit_exceeded", "organization_usage_limit_exceeded", "project_spend_limit_exceeded", "organization_spend_limit_exceeded"].includes(code))) return true;
  const message = [fields.message, fields.error_message].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  return /(?:credit balance|insufficient quota|quota.*(?:exhaust|exceed|unavailable)|(?:project|organization).{0,60}(?:spend|usage).{0,25}limit|(?:spend|usage).{0,25}limit.{0,25}(?:project|organization))/u.test(message);
}

export function isOpenAIImageGuardError(error: unknown): error is OpenAIImageGuardError { return error instanceof OpenAIImageGuardError; }

export class OpenAIImageGuardError extends Error {
  readonly code: string;
  constructor(code: string, message = STOP_MESSAGE) { super(message); this.name = "OpenAIImageGuardError"; this.code = code; }
}
