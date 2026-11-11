import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { ARENA_ONLINE_ENGINES } from "../lib/arcade/online/arena-engines";
import { SUMO_ONLINE_ENGINE } from "../lib/arcade/online/sumo";
import { ONLINE_ARCADE_DDL } from "../server/arcade/online/schema";

function database(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  for (const sql of ONLINE_ARCADE_DDL) sqlite.exec(sql);
  class Statement {
    values: unknown[] = [];
    constructor(readonly sql: string) {}
    bind(...values: unknown[]) { this.values = values; return this; }
    async first() { return sqlite.prepare(this.sql).get(...this.values as (string | number | null)[]) ?? null; }
    async all() { return { results: sqlite.prepare(this.sql).all(...this.values as (string | number | null)[]) }; }
    async run() { const result = sqlite.prepare(this.sql).run(...this.values as (string | number | null)[]); return { success: true, meta: { changes: Number(result.changes) } }; }
  }
  return {
    prepare: (sql: string) => new Statement(sql),
    async batch(statements: Statement[]) {
      sqlite.exec("BEGIN");
      try { const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  } as unknown as D1Database;
}

const origin = "https://arcade.test";
const request = (path: string, body?: unknown, cookie?: string) => new Request(origin + path, {
  method: body === undefined ? "GET" : "POST",
  headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test("archived online games cannot be created or started again, while a playing legacy room still accepts input", async () => {
  const { OnlineArcadeService } = await import("../server/arcade/online/service");
  const db = database();
  const snowEngine = ARENA_ONLINE_ENGINES.find(engine => engine.id === "snow-bash")!;
  const testEngine = { ...snowEngine, id: "test-arena" };
  const service = new OnlineArcadeService(db, id => [testEngine, ...ARENA_ONLINE_ENGINES, SUMO_ONLINE_ENGINE].find(engine => engine.id === id) ?? null, () => 1000);
  for (const gameId of ["space-bash", "sky-balls", "royal-ballistix", "tap-race"]) {
    assert.equal((await service.create(request("/rooms", { gameId }))).status, 404, gameId);
  }

  const created = await service.create(request("/rooms", { gameId: "test-arena" }));
  assert.equal(created.status, 201);
  const { code } = await created.json() as { code: string };
  const host = created.headers.get("set-cookie")!.split(";")[0]!;
  const joined = await service.join(request("/join", { nickname: "One" }), code);
  const seat = joined.headers.get("set-cookie")!.split(";")[0]!;

  const row = await db.prepare("SELECT state_json FROM online_arcade_rooms WHERE code=?").bind(code).first<{ state_json: string }>();
  const state = JSON.parse(row!.state_json) as Record<string, unknown>;
  state.gameId = "snow-bash";
  state.status = "PLAYING";
  state.matchId = "legacy-archived-match";
  await db.prepare("UPDATE online_arcade_rooms SET game_id='snow-bash',status='PLAYING',state_json=? WHERE code=?").bind(JSON.stringify(state), code).run();

  const current = await service.host(request("/host", { operation: "start" }, host), code);
  assert.equal(current.status, 200, "a repeated start must leave an already playing archived match available");
  assert.equal((await current.json() as { matchId: string }).matchId, "legacy-archived-match");
  assert.equal((await service.input(request("/input", { matchId: "legacy-archived-match", seq: 1, x: 0.25, y: 0 }, seat), code)).status, 200);

  state.status = "LOBBY";
  state.matchId = "";
  await db.prepare("UPDATE online_arcade_rooms SET status='LOBBY',state_json=? WHERE code=?").bind(JSON.stringify(state), code).run();
  assert.equal((await service.host(request("/host", { operation: "start" }, host), code)).status, 404, "archived lobby cannot be newly started");
  state.status = "RESULT";
  await db.prepare("UPDATE online_arcade_rooms SET status='RESULT',state_json=? WHERE code=?").bind(JSON.stringify(state), code).run();
  assert.equal((await service.host(request("/host", { operation: "start" }, host), code)).status, 404, "archived result cannot be replayed");
});
