import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

test("Arcade D1 migration safely reapplies when runtime DDL already created its tables", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE rooms (id TEXT PRIMARY KEY)");
    const migration = readFileSync(new URL("../drizzle/0005_arcade.sql", import.meta.url), "utf8");
    const statements = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);

    for (let run = 0; run < 2; run++) for (const statement of statements) database.exec(statement);

    const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name LIKE 'arcade_%' ORDER BY name").all()
      .map((row) => String(row.name));
    assert.deepEqual(tables, ["arcade_matches", "arcade_score_events"]);
    assert.ok(database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'index' AND name = 'idx_arcade_matches_room_number'").get());
    assert.ok(database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'index' AND name = 'idx_arcade_events_room_match'").get());
  } finally {
    database.close();
  }
});
