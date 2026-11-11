import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  OPENAI_IMAGE_GUARD_DDL,
  type OpenAIImageGuardConfig,
  getOpenAIImageAvailability,
  isOpenAIImageBillingError,
  openAIImageAccess,
  reserveOpenAIImageRequest,
  tripOpenAIImageCircuit,
} from "../server/openai-image-guard";

function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const sql of OPENAI_IMAGE_GUARD_DDL) sqlite.exec(sql);
  const wrap = (sql: string, args: unknown[] = []): D1PreparedStatement => ({
    bind: (...values: unknown[]) => wrap(sql, values),
    first: async <T>() => sqlite.prepare(sql).get(...args as never[]) as T | undefined ?? null,
    all: async <T>() => ({ results: sqlite.prepare(sql).all(...args as never[]) as T[] }),
    run: async () => { const result = sqlite.prepare(sql).run(...args as never[]); return { success: true, meta: { changes: Number(result.changes) } }; },
  }) as unknown as D1PreparedStatement;
  const db = { prepare: wrap, async batch(statements: D1PreparedStatement[]) { sqlite.exec("BEGIN"); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } } } as unknown as D1Database;
  return { db, sqlite };
}

const now = Date.parse("2026-10-30T12:00:00.000Z");
const base = {
  OPENAI_IMAGE_API_KEY: "test-image-key",
  OPENAI_IMAGES_ENABLED: "true",
  OPENAI_IMAGES_CREDIT_WINDOW: "grant-2026-10",
  OPENAI_IMAGES_STOP_AT: "2026-11-05T23:59:59Z",
};
const request = (db: D1Database, id: string, room = "room-a", config: OpenAIImageGuardConfig = base, at = now) => reserveOpenAIImageRequest({ db, config, jobId: id, roomId: room, now: at });

test("OpenAI image access requires an image key, explicit verification, and a future ISO stop time", () => {
  assert.equal(openAIImageAccess(base, now).available, true);
  assert.equal(openAIImageAccess({ ...base, OPENAI_IMAGES_ENABLED: "false" }, now).code, "OPENAI_IMAGES_DISABLED");
  assert.equal(openAIImageAccess({ ...base, OPENAI_IMAGES_CREDIT_WINDOW: "  " }, now).available, false);
  assert.equal(openAIImageAccess({ ...base, OPENAI_IMAGES_STOP_AT: "not-a-date" }, now).available, false);
  assert.equal(openAIImageAccess({ ...base, OPENAI_IMAGES_STOP_AT: "2026-10-30T11:59:59Z" }, now).code, "ALLOWANCE_STOP");
  assert.equal(openAIImageAccess({ ...base, OPENAI_IMAGE_API_KEY: undefined }, now).code, "OPENAI_IMAGE_NOT_CONFIGURED");
  assert.equal(openAIImageAccess({ ...base, OPENAI_IMAGE_API_KEY: undefined, OPENAI_API_KEY: "general" } as OpenAIImageGuardConfig, now).code, "OPENAI_IMAGE_NOT_CONFIGURED");
  assert.equal(openAIImageAccess({ ...base, OPENAI_IMAGES_MAX_REQUESTS: "0" }, now).code, "ALLOWANCE_STOP");
  assert.equal(openAIImageAccess({ ...base, OPENAI_IMAGES_MAX_DAILY_REQUESTS: "abc" }, now).code, "ALLOWANCE_STOP");
});


test("database availability fails closed when ledger reads fail", async () => {
  const broken = { prepare() { return { bind() { return this; }, first: async () => { throw new Error("D1 unavailable"); } }; } } as unknown as D1Database;
  const result = await getOpenAIImageAvailability(base, broken, now);
  assert.equal(result.available, false); assert.equal(result.code, "OPENAI_IMAGE_GUARD_UNAVAILABLE");
});
test("durable reservation is unique per job and failed attempts stay spent", async () => {
  const { db } = database();
  assert.equal((await request(db, "job-1")).reserved, true);
  const duplicate = await request(db, "job-1");
  assert.equal(duplicate.reserved, false);
  if (!duplicate.reserved) assert.equal(duplicate.code, "ALLOWANCE_STOP");
  const spent = await getOpenAIImageAvailability(base, db, now);
  assert.equal(spent.available, true);
  const row = await db.prepare("SELECT COUNT(*) AS count FROM openai_image_reservations").first<{ count: number }>();
  assert.equal(Number(row?.count), 1, "there is no refund path after provider errors");
});

test("atomic D1 reservation enforces global, UTC-day, and room caps across concurrent workers", async () => {
  const { db } = database();
  const limited = { ...base, OPENAI_IMAGES_MAX_REQUESTS: "3", OPENAI_IMAGES_MAX_DAILY_REQUESTS: "2", OPENAI_IMAGES_MAX_ROOM_REQUESTS: "1" };
  const global = await Promise.all(Array.from({ length: 8 }, (_, index) => request(db, `global-${index}`, `room-${index}`, { ...limited, OPENAI_IMAGES_MAX_DAILY_REQUESTS: "10", OPENAI_IMAGES_MAX_ROOM_REQUESTS: "10" })));
  assert.equal(global.filter((entry) => entry.reserved).length, 3);
  assert.equal((await getOpenAIImageAvailability({ ...limited, OPENAI_IMAGES_MAX_DAILY_REQUESTS: "10", OPENAI_IMAGES_MAX_ROOM_REQUESTS: "10" }, db, now)).available, false);

  const { db: dailyDb } = database();
  const daily = await Promise.all(Array.from({ length: 5 }, (_, index) => request(dailyDb, `daily-${index}`, `daily-room-${index}`, limited)));
  assert.equal(daily.filter((entry) => entry.reserved).length, 2);

  const { db: roomDb } = database();
  const room = await Promise.all(Array.from({ length: 4 }, (_, index) => request(roomDb, `room-${index}`, "same-room", limited)));
  assert.equal(room.filter((entry) => entry.reserved).length, 1);
  const nextDay = await request(roomDb, "tomorrow-room", "other-room", limited, Date.parse("2026-10-31T00:00:00.000Z"));
  assert.equal(nextDay.reserved, true, "UTC daily cap resets while window and room ledgers remain scoped");
});

test("request limits default and clamp to their maximums", async () => {
  const { db } = database();
  const config = { ...base, OPENAI_IMAGES_MAX_REQUESTS: "9000", OPENAI_IMAGES_MAX_DAILY_REQUESTS: "9999", OPENAI_IMAGES_MAX_ROOM_REQUESTS: "5000" };
  for (let i = 0; i < 1001; i++) {
    const dayOffset = Math.floor(i / 300);
    const outcome = await request(db, `limit-${i}`, `room-${i}`, config, now + dayOffset * 24 * 60 * 60 * 1000);
    if (i < 1000) assert.equal(outcome.reserved, true);
    else assert.equal(outcome.reserved, false);
  }
});

test("circuit latch is durable and blocks every later reservation in the same credit window", async () => {
  const { db } = database();
  assert.equal((await request(db, "before-circuit")).reserved, true);
  await tripOpenAIImageCircuit(db, "grant-2026-10", now);
  const result = await request(db, "after-circuit");
  assert.equal(result.reserved, false);
  if (!result.reserved) assert.equal(result.code, "ALLOWANCE_STOP");
  const availability = await getOpenAIImageAvailability(base, db, now);
  assert.equal(availability.available, false);
  assert.equal(availability.code, "ALLOWANCE_STOP");
});


function failingWrites(db: D1Database, shouldFail: (sql: string) => boolean): D1Database {
  return {
    prepare(sql: string) {
      const original = db.prepare(sql);
      const wrap = (bound: D1PreparedStatement): D1PreparedStatement => ({
        bind: (...values: unknown[]) => wrap(bound.bind(...values)),
        first: <T>() => bound.first<T>(),
        all: <T>() => bound.all<T>(),
        run: () => shouldFail(sql) ? Promise.reject(new Error("selective D1 write fault")) : bound.run(),
      }) as unknown as D1PreparedStatement;
      return wrap(original);
    },
  } as D1Database;
}

test("billing latch survives either circuit-table or reservation-row write failure", async () => {
  const first = database();
  assert.equal((await request(first.db, "circuit-write-fails", "room-a", { ...base, OPENAI_IMAGES_CREDIT_WINDOW: "circuit-write-fails" })).reserved, true);
  const configA = { ...base, OPENAI_IMAGES_CREDIT_WINDOW: "circuit-write-fails" };
  await tripOpenAIImageCircuit(failingWrites(first.db, sql => sql.startsWith("INSERT OR IGNORE INTO openai_image_circuits")), "circuit-write-fails", now, "circuit-write-fails");
  const rowA = await first.db.prepare("SELECT billing_blocked FROM openai_image_reservations WHERE job_id = ?").bind("circuit-write-fails").first<{ billing_blocked: number }>();
  assert.equal(rowA?.billing_blocked, 1);
  assert.equal((await request(first.db, "after-circuit-write-fails", "room-b", configA)).reserved, false);

  const second = database();
  const configB = { ...base, OPENAI_IMAGES_CREDIT_WINDOW: "ledger-write-fails" };
  assert.equal((await request(second.db, "ledger-write-fails", "room-a", configB)).reserved, true);
  await tripOpenAIImageCircuit(failingWrites(second.db, sql => sql.startsWith("UPDATE openai_image_reservations SET billing_blocked")), "ledger-write-fails", now, "ledger-write-fails");
  const rowB = await second.db.prepare("SELECT credit_window_id FROM openai_image_circuits WHERE credit_window_id = ?").bind("ledger-write-fails").first<{ credit_window_id: string }>();
  assert.equal(rowB?.credit_window_id, "ledger-write-fails");
  assert.equal((await request(second.db, "after-ledger-write-fails", "room-b", configB)).reserved, false);
});

test("in-process latch blocks a window if both durable latch writes fail", async () => {
  const { db } = database();
  const config = { ...base, OPENAI_IMAGES_CREDIT_WINDOW: "both-latch-writes-fail" };
  assert.equal((await request(db, "both-latch-writes-fail", "room-a", config)).reserved, true);
  await assert.rejects(tripOpenAIImageCircuit(failingWrites(db, sql => sql.startsWith("INSERT OR IGNORE INTO openai_image_circuits") || sql.startsWith("UPDATE openai_image_reservations SET billing_blocked")), "both-latch-writes-fail", now, "both-latch-writes-fail"), /OPENAI_IMAGE_CIRCUIT_PERSIST_FAILED/u);
  assert.equal((await request(db, "after-both-latch-writes-fail", "room-b", config)).reserved, false);
});
test("billing exhaustion latches but a generic rate limit does not", () => {
  assert.equal(isOpenAIImageBillingError({ status: 429, code: "insufficient_quota", message: "Quota unavailable" }), true);
  assert.equal(isOpenAIImageBillingError({ status: 402, code: "credit_balance_exhausted" }), true);
  assert.equal(isOpenAIImageBillingError({ status: 429, code: "rate_limit_exceeded", message: "Too many requests" }), false);
});
