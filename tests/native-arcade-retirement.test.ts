import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { retireNativeArcadeRoomWith } from "../server/arcade-native/retirement";

function database(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE rooms(id TEXT,code TEXT,state_json TEXT); CREATE TABLE callback_session_games(id TEXT,session_code TEXT,child_kind TEXT,child_code TEXT,active INTEGER,created_at INTEGER)");
  const prepare = (sql: string, args: unknown[] = []) => ({
    bind: (...values: unknown[]) => prepare(sql, values),
    first: async <T>() => sqlite.prepare(sql).get(...args as never[]) as T | undefined ?? null,
    run: async () => { sqlite.prepare(sql).run(...args as never[]); return { meta: { changes: 1 } }; },
  });
  return { prepare } as unknown as D1Database;
}

test("native Arcade retirement resolves and retires the inactive session child generation", async () => {
  const db = database();
  await db.prepare("INSERT INTO rooms(id,code,state_json) VALUES('room-stable','ABCD',?)").bind(JSON.stringify({ gameLength: "arcade", arcadeGameId: "imposter" })).run();
  await db.prepare("INSERT INTO callback_session_games(id,session_code,child_kind,child_code,active,created_at) VALUES('child-generation','parent-session','main','ABCD',0,5)").run();
  let requestUrl = "";
  let requestBody: Record<string, unknown> | null = null;
  await retireNativeArcadeRoomWith(db, { PARTY_SECRET: "s".repeat(40), PARTY_WORKER_URL: "https://party.example" }, "abcd", async (input, init) => {
    requestUrl = String(input); requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response("{}", { status: 200, headers: { "x-native-retired-generation": "child-generation" } });
  });
  assert.match(requestUrl, /^https:\/\/party\.example\/native-arcade\/[a-f0-9]{64}\/retire$/u);
  assert.deepEqual(requestBody, { operation: "retire", roomId: "room-stable", generationId: "child-generation", partyKey: "session-parent-session" });
});
