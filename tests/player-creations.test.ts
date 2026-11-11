import assert from "node:assert/strict";
import test from "node:test";
import { emptyFishDocument } from "../lib/fish-art";
import { decodePlayerCreationPng, normalizeCreationPlacement, validatePlayerCreationSource } from "../lib/player-creations";
import { PlayerCreationService } from "../server/player-creations/service";
import type { D1Database } from "@cloudflare/workers-types";

test("creation placement is normalized and clamped to the tank-safe bounds", () => {
  assert.deepEqual(normalizeCreationPlacement({ x: -2, y: 8, layer: "backdrop" }), { x: 0.08, y: 0.88, layer: "backdrop" });
  assert.deepEqual(normalizeCreationPlacement({ x: Number.NaN, layer: "shark" }), { x: 0.5, y: 0.72, layer: "floor" });
});

test("creation sources are bounded and fish documents use the editor validator", () => {
  assert.deepEqual(validatePlayerCreationSource("fish", emptyFishDocument()), emptyFishDocument());
  assert.deepEqual(validatePlayerCreationSource("scenery", emptyFishDocument()), emptyFishDocument());
  assert.throws(() => validatePlayerCreationSource("fish", { version: 99 }), /INVALID_SOURCE/u);
  assert.throws(() => validatePlayerCreationSource("scenery", { drawing: "not an editor document" }), /INVALID_SOURCE/u);
  const stroke = { kind: "stroke" as const, tool: "pen" as const, color: "#222222", size: 2, points: Array.from({ length: 1200 }, () => ({ x: 0.2, y: 0.3 })) };
  assert.throws(() => validatePlayerCreationSource("scenery", { ...emptyFishDocument(), body: Array.from({ length: 40 }, () => stroke) }), /SOURCE_TOO_LARGE/u);
});

test("creation PNG payload decoding accepts bounded base64 and rejects malformed data", () => {
  assert.deepEqual([...decodePlayerCreationPng("AQID")], [1, 2, 3]);
  assert.throws(() => decodePlayerCreationPng("%%%"), /INVALID_PNG/u);
});

test("draft autosave advances its revision and rejects a stale tab", async () => {
  const source = emptyFishDocument();
  const row = { creation_id: "123e4567-e89b-42d3-a456-426614174000", kind: "scenery", title: "", created_at: 1, updated_at: 1, share_in_rooms: 0, revision: 0, state: "draft", draft_json: JSON.stringify({ source }), placement_json: JSON.stringify({ x: 0.5, y: 0.72, layer: "floor" }), current_object_key: null, current_sha256: null, current_byte_size: null };
  const db = {
    prepare(sql: string) {
      const statement = { values: [] as unknown[], bind(...values: unknown[]) { this.values = values; return this; }, async first<T>() { return sql.includes("FROM player_creations") ? row as T : null; }, async run() { if (!sql.startsWith("UPDATE player_creations")) return { meta: { changes: 0 } }; if (Number(this.values.at(-1)) !== row.revision) return { meta: { changes: 0 } }; row.title = String(this.values[0]); row.updated_at = Number(this.values[1]); row.share_in_rooms = Number(this.values[2]); row.draft_json = String(this.values[3]); row.placement_json = String(this.values[4]); row.revision++; return { meta: { changes: 1 } }; } };
      return statement;
    },
  } as unknown as D1Database;
  const service = new PlayerCreationService(db, undefined, () => 2);
  const first = await service.saveDraft("a".repeat(64), row.creation_id, { expectedRevision: 0, source });
  assert.equal(first.record?.revision, 1);
  const stale = await service.saveDraft("a".repeat(64), row.creation_id, { expectedRevision: 0, source });
  assert.equal(stale.record, null);
});
