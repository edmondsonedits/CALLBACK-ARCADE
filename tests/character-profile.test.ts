import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AVATAR } from "../lib/avatar-runtime";
import { changeCharacter, defaultCharacterProfile, redoCharacter, restoreCharacter, undoCharacter } from "../lib/character-profile";
import { DatabaseSync } from "node:sqlite";
import { CharacterProfileService } from "../server/profiles/service";

function memoryD1(): { db: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  class Statement {
    values: unknown[] = [];
    constructor(private readonly sql: string) {}
    bind(...values: unknown[]) { this.values = values; return this; }
    async first<T>() { return sqlite.prepare(this.sql).get(...this.values as never[]) as T ?? null; }
    async all<T>() { return { results: sqlite.prepare(this.sql).all(...this.values as never[]) as T[] }; }
    async run() { const result = sqlite.prepare(this.sql).run(...this.values as never[]); return { success: true, meta: { changes: Number(result.changes) } }; }
  }
  return { sqlite, db: { prepare: (sql: string) => new Statement(sql), async batch(statements: Statement[]) { return statements.map(statement => { const result = sqlite.prepare(statement["sql"]).run(...statement.values as never[]); return { success: true, meta: { changes: Number(result.changes) } }; }); } } as unknown as D1Database };
}

test("saved profile history supports undo, redo, and undoable default restore", () => {
  const initial = defaultCharacterProfile();
  const custom = { ...DEFAULT_AVATAR, skin: "deep" };
  const edited = changeCharacter(initial, custom, null);
  const undone = undoCharacter(edited);
  assert.equal(undone.avatarConfig.skin, initial.avatarConfig.skin);
  const redone = redoCharacter(undone);
  assert.equal(redone.avatarConfig.skin, "deep");
  const reset = restoreCharacter(redone, "default");
  assert.equal(reset.avatarConfig.skin, DEFAULT_AVATAR.skin);
  assert.equal(undoCharacter(reset).avatarConfig.skin, "deep");
});

test("selected starting baseline is independent and baseline restore is undoable", () => {
  const starting = defaultCharacterProfile({ avatarConfig: { ...DEFAULT_AVATAR, faceWidth: 1.07 }, avatarPreset: null });
  const edited = changeCharacter(starting, { ...DEFAULT_AVATAR, faceWidth: 1.1 }, null);
  const reset = restoreCharacter(edited, "baseline");
  assert.equal(reset.avatarConfig.faceWidth, 1.07);
  assert.equal(reset.baseline.avatarConfig.faceWidth, 1.07);
  assert.equal(undoCharacter(reset).avatarConfig.faceWidth, 1.1);
});

test("new edits after undo discard redo and retained history is bounded", () => {
  let state = defaultCharacterProfile();
  for (let i = 0; i < 90; i++) state = changeCharacter(state, { ...DEFAULT_AVATAR, faceWidth: 0.9 + i / 1000 }, null);
  assert.equal(state.past.length, 80);
  state = undoCharacter(state);
  state = changeCharacter(state, { ...DEFAULT_AVATAR, faceWidth: 1.1 }, null);
  assert.equal(state.future.length, 0);
  assert.equal(redoCharacter(state), state);
});

test("profile cookie hashes isolate profiles and stale versions cannot overwrite saved history", async () => {
  const { db, sqlite } = memoryD1();
  try {
    const service = new CharacterProfileService(db, () => 100);
    const first = await service.get("high-entropy-token-one");
    const changed = changeCharacter(first.profile, { ...DEFAULT_AVATAR, faceWidth: 1.1 }, null);
    assert.equal(await service.save("high-entropy-token-one", first.version, changed), 2);
    assert.equal(await service.save("high-entropy-token-one", first.version, first.profile), null);
    const reopened = await service.get("high-entropy-token-one");
    assert.equal(reopened.profile.past.length, 1);
    assert.equal(reopened.profile.past[0]?.avatarConfig.faceWidth, DEFAULT_AVATAR.faceWidth);
    const other = await service.get("high-entropy-token-two");
    assert.equal(other.profile.avatarConfig.faceWidth, DEFAULT_AVATAR.faceWidth);
    const stored = sqlite.prepare("SELECT token_hash, profile_json FROM character_profiles ORDER BY token_hash").all() as { token_hash: string; profile_json: string }[];
    assert.ok(stored.every(row => !row.token_hash.includes("high-entropy-token")));
  } finally { sqlite.close(); }
});

test("QR values accept codes and same-origin session or legacy links only", async () => {
  const { resolveScannedJoin } = await import("../lib/character-profile");
  assert.equal(resolveScannedJoin("B4CK", "https://callback.test"), "B4CK");
  assert.equal(resolveScannedJoin("https://callback.test/session/B4CK/play", "https://callback.test"), "B4CK");
  assert.equal(resolveScannedJoin("https://callback.test/play/B4CK", "https://callback.test"), "B4CK");
  assert.equal(resolveScannedJoin("https://evil.test/session/B4CK/play", "https://callback.test"), null);
  assert.equal(resolveScannedJoin("https://callback.test/any-path", "https://callback.test"), null);
});

test('hosted baseline and canonical default cannot be replaced after saving',async()=>{const {db}=memoryD1();const store=new CharacterProfileService(db);const token='a'.repeat(43);const initial=await store.get(token);const edited=changeCharacter(initial.profile,{...initial.profile.avatarConfig,hat:'none'},null);await store.save(token,initial.version,edited);const stored=await store.get(token);const wrongDefault=structuredClone(stored.profile);wrongDefault.default.avatarConfig.skin=wrongDefault.default.avatarConfig.skin==='fair'?'tan':'fair';await assert.rejects(store.save(token,stored.version,wrongDefault),/DEFAULT_IMMUTABLE/);const wrongBaseline=structuredClone(stored.profile);wrongBaseline.baseline.avatarConfig.outfitColor=wrongBaseline.baseline.avatarConfig.outfitColor==='blue'?'red':'blue';await assert.rejects(store.save(token,stored.version,wrongBaseline),/BASELINE_IMMUTABLE/);assert.equal((await store.get(token)).version,stored.version);});
