import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync, inflateSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { PROFILE_FACE_DDL } from "../server/profile-faces/schema";
import { OPENAI_IMAGE_GUARD_DDL } from "../server/openai-image-guard";
import { sha256Hex } from "../server/crypto";
import { ProfileFaceService, assertOwnedProfileFaceIds, validateGeneratedFacePng } from "../server/profile-faces/service";

function png(width: number, height: number, pixels: Uint8Array, colorType: 2 | 6 = 6): Uint8Array {
  const chunks: Uint8Array[] = [];
  const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const name = new TextEncoder().encode(type), payload = new Uint8Array(12 + data.length), view = new DataView(payload.buffer);
    view.setUint32(0, data.length); payload.set(name, 4); payload.set(data, 8); view.setUint32(8 + data.length, crc32(payload.subarray(4, 8 + data.length))); chunks.push(payload);
  };
  const channels = colorType === 6 ? 4 : 3, header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = colorType; header[12] = 0; chunk("IHDR", header);
  const scanlines = new Uint8Array(height * (1 + width * channels));
  for (let y = 0; y < height; y++) scanlines.set(pixels.subarray(y * width * channels, (y + 1) * width * channels), y * (1 + width * channels) + 1);
  chunk("IDAT", new Uint8Array(deflateSync(scanlines))); chunk("IEND", new Uint8Array());
  const output = new Uint8Array(8 + chunks.reduce((n, item) => n + item.length, 0)); output.set([137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8; for (const item of chunks) { output.set(item, offset); offset += item.length; }
  return output;
}

function serviceStorage(objects: Map<string, Uint8Array>): R2Bucket {
  return { put: async (key: string, value: Uint8Array) => { objects.set(key, value); }, head: async (key: string) => objects.has(key) ? { size: objects.get(key)!.length } : null, delete: async (key: string) => { objects.delete(key); }, get: async (key: string) => { const value = objects.get(key); return value ? { size: value.length, arrayBuffer: async () => value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) } : null; } } as unknown as R2Bucket;
}

class TestD1 {
  sqlite = new DatabaseSync(":memory:");
  constructor() { for (const sql of [...PROFILE_FACE_DDL, ...OPENAI_IMAGE_GUARD_DDL]) this.sqlite.exec(sql); }
  async batch(statements: D1PreparedStatement[]) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
  prepare(sql: string) {
    const sqlite = this.sqlite;
    const wrap = (values: unknown[] = []) => ({
      bind(...next: unknown[]) { return wrap(next); },
      first: async <T>() => sqlite.prepare(sql).get(...values as never[]) as T | undefined ?? null,
      run: async () => { const result = sqlite.prepare(sql).run(...values as never[]); return { success: true, meta: { changes: Number(result.changes) } }; },
    }) as unknown as D1PreparedStatement;
    return wrap();
  }
}

const width = 64, height = 64;
const transparentPixels = new Uint8Array(width * height * 4);
const opaqueHolePixels = new Uint8Array(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const index = (y * width + x) * 4;
  const inHead = x >= 8 && x < 56 && y >= 5 && y < 60;
  transparentPixels.set([240, 150, 100, inHead ? 255 : 0], index);
  opaqueHolePixels.set([240, 150, 100, 255], index);
}
opaqueHolePixels[(32 * width + 32) * 4 + 3] = 0;
const validFacePng = png(width, height, transparentPixels);
const opaqueHolePng = png(width, height, opaqueHolePixels);
const opaquePng = png(width, height, new Uint8Array(Array.from({ length: width * height }, () => [240, 150, 100, 255]).flat()));
const emptyPng = png(width, height, new Uint8Array(width * height * 4));
const rgbPhotoPng = png(width, height, new Uint8Array(Array.from({ length: width * height }, () => [240, 150, 100]).flat()), 2);

test("face output validation decodes PNG pixels and requires a transparent perimeter and visible interior", async () => {
  assert.deepEqual(await validateGeneratedFacePng(validFacePng), { width, height });
  await assert.rejects(() => validateGeneratedFacePng(opaquePng), /TRANSPARENCY_REQUIRED/u);
  await assert.rejects(() => validateGeneratedFacePng(opaqueHolePng), /TRANSPARENCY_REQUIRED/u);
  await assert.rejects(() => validateGeneratedFacePng(emptyPng), /EMPTY_IMAGE/u);
  await assert.rejects(() => validateGeneratedFacePng(validFacePng.subarray(0, validFacePng.length - 6)), /INVALID_IMAGE_OUTPUT/u);
});


test("an abandoned generation becomes terminal without another provider call", async () => {
  const db = new TestD1();
  const token = "stale-owner-cookie-secret", key = "33333333-3333-4333-8333-333333333333", now = 1_000_000;
  const profileHash = await sha256Hex(token), input = rgbPhotoPng;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer));
  const requestHash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  db.sqlite.prepare("INSERT INTO profile_face_jobs(job_id, profile_hash, idempotency_key, request_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'GENERATING', ?, ?)").run("stale-job", profileHash, key, requestHash, now - 200_000, now - 200_000);
  let providerCalls = 0;
  const result = await new ProfileFaceService({ db: db as unknown as D1Database, storage: serviceStorage(new Map()), guard: {}, now: () => now, imageEdit: async () => { providerCalls++; return validFacePng; } }).generate(token, key, input);
  assert.deepEqual(result, { status: "failed", code: "GENERATION_INTERRUPTED", terminal: true });
  assert.equal(providerCalls, 0);
});
test("profile face idempotency permits only one provider call and stores an opaque owner-bound UUID", async () => {
  const db = new TestD1();
  const objects = new Map<string, Uint8Array>();
  let providerCalls = 0;
  const service = new ProfileFaceService({
    db: db as unknown as D1Database,
    storage: serviceStorage(objects),
    imageKey: "test-image-key",
    guard: { OPENAI_IMAGE_API_KEY: "test-image-key", OPENAI_IMAGES_ENABLED: "true", OPENAI_IMAGES_CREDIT_WINDOW: "test-window", OPENAI_IMAGES_STOP_AT: "2099-01-01T00:00:00Z" },
    imageEdit: async () => { providerCalls++; await new Promise(resolve => setTimeout(resolve, 10)); return validFacePng; },
  });
  const key = "22222222-2222-4222-8222-222222222222";
  const [first, replay] = await Promise.all([
    service.generate("owner-cookie-secret", key, rgbPhotoPng),
    service.generate("owner-cookie-secret", key, rgbPhotoPng),
  ]);
  assert.equal(providerCalls, 1);
  assert.equal(first.status, "ready");
  assert.equal(replay.status, "processing");
  const repeated = await service.generate("owner-cookie-secret", key, rgbPhotoPng);
  assert.equal(repeated.status, "ready");
  if (first.status !== "ready" || repeated.status !== "ready") return;
  assert.equal(first.faceId, repeated.faceId);
  assert.match(first.faceId, /^[0-9a-f-]{36}$/iu);
  assert.equal(await service.owns("owner-cookie-secret", first.faceId), true);
  assert.equal(await service.owns("different-cookie-secret", first.faceId), false);
  assert.deepEqual(await service.getPublic(first.faceId), { bytes: validFacePng.buffer.slice(validFacePng.byteOffset, validFacePng.byteOffset + validFacePng.byteLength), size: validFacePng.byteLength });
  assert.equal(objects.size, 1);
  const readOnlyService = new ProfileFaceService({ db: db as unknown as D1Database, storage: serviceStorage(objects), guard: {}, imageEdit: async () => { throw new Error("should not call provider"); } });
  assert.deepEqual(await readOnlyService.generate("owner-cookie-secret", key, rgbPhotoPng), { status: "ready", faceId: first.faceId });
  await assert.rejects(() => new ProfileFaceService({ db: db as unknown as D1Database, storage: serviceStorage(objects), guard: {}, imageEdit: async () => { providerCalls++; return validFacePng; } }).generate("new-owner-secret", key, rgbPhotoPng), /OPENAI_IMAGE_NOT_CONFIGURED/u);
  assert.equal(providerCalls, 1);
  assert.equal((await service.generate("owner-cookie-secret", key, png(width, height, new Uint8Array(width * height * 3), 2))).status, "conflict");
  assert.equal(providerCalls, 1);
  await assert.rejects(() => assertOwnedProfileFaceIds(db as unknown as D1Database, "different-cookie-secret", [first.faceId]), /PROFILE_FACE_NOT_OWNED/u);
  await assertOwnedProfileFaceIds(db as unknown as D1Database, "owner-cookie-secret", [first.faceId]);
});

test("neck trim saves an owner-only transparent derivative and replays the same cutoff without changing source", async () => {
  const db = new TestD1(), objects = new Map<string, Uint8Array>();
  const service = new ProfileFaceService({ db: db as unknown as D1Database, storage: serviceStorage(objects), imageKey: "test-image-key", guard: { OPENAI_IMAGE_API_KEY: "test-image-key", OPENAI_IMAGES_ENABLED: "true", OPENAI_IMAGES_CREDIT_WINDOW: "trim-window", OPENAI_IMAGES_STOP_AT: "2099-01-01T00:00:00Z" }, imageEdit: async () => validFacePng });
  const generated = await service.generate("owner-cookie-secret", "44444444-4444-4444-8444-444444444444", rgbPhotoPng);
  assert.equal(generated.status, "ready");
  if (generated.status !== "ready") return;
  const trimmed = await service.trim("owner-cookie-secret", generated.faceId, 70);
  assert.equal(await service.owns("owner-cookie-secret", trimmed.faceId), true);
  assert.equal(await service.owns("someone-elses-cookie", trimmed.faceId), false);
  assert.deepEqual(await service.getPublic(generated.faceId), { bytes: validFacePng.buffer.slice(validFacePng.byteOffset, validFacePng.byteOffset + validFacePng.byteLength), size: validFacePng.byteLength });
  assert.deepEqual(await service.trim("owner-cookie-secret", generated.faceId, 70), trimmed);
  const stored = objects.get(`profile-faces/${trimmed.faceId}.png`)!;
  assert.equal(await validateGeneratedFacePng(stored).then(() => true), true);
  const idatLength = new DataView(stored.buffer, stored.byteOffset, stored.byteLength).getUint32(33);
  const raw = new Uint8Array(inflateSync(stored.subarray(41, 41 + idatLength)));
  assert.equal(raw[1 + ((Math.floor(height * 0.7)) * (1 + width * 4)) + 4 * 32 + 3], 0);
  assert.equal(raw[1 + (Math.floor(height * 0.7) - 1) * (1 + width * 4) + 4 * 32 + 3], 255);
  const curved = await service.trim("owner-cookie-secret", generated.faceId, 70, 20);
  assert.notEqual(curved.faceId, trimmed.faceId);
  assert.deepEqual(await service.trim("owner-cookie-secret", generated.faceId, 70, 20), curved);
  assert.equal(await service.owns("owner-cookie-secret", curved.faceId), true);
  assert.equal(await service.owns("someone-elses-cookie", curved.faceId), false);
  const curvedStored = objects.get(`profile-faces/${curved.faceId}.png`)!;
  const curvedIdatLength = new DataView(curvedStored.buffer, curvedStored.byteOffset, curvedStored.byteLength).getUint32(33);
  const curvedRaw = new Uint8Array(inflateSync(curvedStored.subarray(41, 41 + curvedIdatLength)));
  const alphaAt = (x: number, y: number) => curvedRaw[y * (1 + width * 4) + 1 + x * 4 + 3];
  assert.equal(alphaAt(10, 40), 0, "the raised edge removes pixels above the straight cutoff");
  assert.equal(alphaAt(32, 40), 255, "the center keeps pixels up to the deeper chin point");
  await assert.rejects(() => service.trim("other-owner-cookie", generated.faceId, 70), /PROFILE_FACE_NOT_OWNED/u);
});
