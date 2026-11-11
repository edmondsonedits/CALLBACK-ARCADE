import assert from "node:assert/strict";
import test, { after } from "node:test";
import { deflateSync, inflateSync } from "node:zlib";
import { build } from "esbuild";
import { convertV4MiniflareOptions, Miniflare, type V4MiniflareOptions } from "miniflare";

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(width: number, height: number, pixels: Uint8Array, colorType: 2 | 6): Uint8Array {
  const chunks: Uint8Array[] = [];
  const chunk = (type: string, data: Uint8Array) => {
    const name = new TextEncoder().encode(type), result = new Uint8Array(12 + data.length), view = new DataView(result.buffer);
    view.setUint32(0, data.length); result.set(name, 4); result.set(data, 8); view.setUint32(8 + data.length, crc32(result.subarray(4, 8 + data.length))); chunks.push(result);
  };
  const channels = colorType === 6 ? 4 : 3, header = new Uint8Array(13), view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = colorType; chunk("IHDR", header);
  const raw = new Uint8Array(height * (width * channels + 1));
  for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * width * channels, (y + 1) * width * channels), y * (width * channels + 1) + 1);
  chunk("IDAT", new Uint8Array(deflateSync(raw))); chunk("IEND", new Uint8Array());
  const out = new Uint8Array(8 + chunks.reduce((sum, item) => sum + item.length, 0)); out.set([137, 80, 78, 71, 13, 10, 26, 10]);
  let cursor = 8; for (const item of chunks) { out.set(item, cursor); cursor += item.length; }
  return out;
}
function testFaces() {
  const size = 64, photo = new Uint8Array(size * size * 3), face = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) photo.set([110, 90, 70], i * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) face.set([220, 120, 90, x >= 8 && x < 56 && y >= 6 && y < 60 ? 255 : 0], (y * size + x) * 4);
  return { photo: png(size, size, photo, 2), face: png(size, size, face, 6) };
}

let miniflare: Miniflare | undefined;
after(async () => { await miniflare?.dispose(); });

test("Worker SDK edit integration validates multipart options, D1 idempotency, alpha decode, and R2 retrieval", async () => {
  const built = await build({ entryPoints: ["tests/fixtures/profile-face-worker.ts"], bundle: true, platform: "browser", format: "esm", target: "es2022", write: false });
  const { photo, face } = testFaces();
  const options: V4MiniflareOptions = {
    modules: true, script: built.outputFiles[0]!.text, d1Databases: { DB: "profile-face-integration-db" }, r2Buckets: ["MEDIA"],
    compatibilityDate: "2026-08-22",
    bindings: { OPENAI_IMAGE_API_KEY: "worker-test-image-key", OPENAI_IMAGES_ENABLED: "true", OPENAI_IMAGES_CREDIT_WINDOW: "worker-test-window", OPENAI_IMAGES_STOP_AT: "2099-01-01T00:00:00Z", TEST_OUTPUT_B64: Buffer.from(face).toString("base64") },
  };
  miniflare = new Miniflare(convertV4MiniflareOptions(options));
  const first = await miniflare.dispatchFetch("http://localhost/generate", { method: "POST", headers: { "Content-Type": "image/png", "Idempotency-Key": "44444444-4444-4444-8444-444444444444" }, body: photo });
  assert.equal(first.status, 200, await first.clone().text());
  const firstBody = await first.json() as { result: { status: string; faceId: string }; providerCalls: number; contract: boolean };
  assert.equal(firstBody.result.status, "ready"); assert.equal(firstBody.providerCalls, 1); assert.equal(firstBody.contract, true);
  const replay = await miniflare.dispatchFetch("http://localhost/generate", { method: "POST", headers: { "Content-Type": "image/png", "Idempotency-Key": "44444444-4444-4444-8444-444444444444" }, body: photo });
  const replayBody = await replay.json() as typeof firstBody;
  assert.equal(replayBody.result.faceId, firstBody.result.faceId); assert.equal(replayBody.providerCalls, 1);
  const stored = await miniflare.dispatchFetch(`http://localhost/face/${firstBody.result.faceId}`);
  assert.equal(stored.status, 200); assert.equal(stored.headers.get("content-type"), "image/png");
  assert.deepEqual(new Uint8Array(await stored.arrayBuffer()), face);
  const trimResponse = await miniflare.dispatchFetch("http://localhost/trim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ faceId: firstBody.result.faceId, cutoffPercent: 70, curvePercent: 20 }) });
  assert.equal(trimResponse.status, 200, await trimResponse.clone().text());
  const trimmed = await trimResponse.json() as { faceId: string; providerCalls: number };
  assert.notEqual(trimmed.faceId, firstBody.result.faceId);
  assert.equal(trimmed.providerCalls, 1);
  const trimmedPngResponse = await miniflare.dispatchFetch(`http://localhost/face/${trimmed.faceId}`);
  assert.equal(trimmedPngResponse.status, 200);
  const trimmedPng = new Uint8Array(await trimmedPngResponse.arrayBuffer());
  assert.deepEqual(Array.from(trimmedPng.subarray(16, 24)), Array.from(face.subarray(16, 24)));
  const idatLength = new DataView(trimmedPng.buffer, trimmedPng.byteOffset, trimmedPng.byteLength).getUint32(33);
  const pixels = new Uint8Array(inflateSync(trimmedPng.subarray(41, 41 + idatLength)));
  assert.equal(pixels[1 + 43 * (1 + 64 * 4) + 32 * 4 + 3], 255);
  assert.equal(pixels[1 + 44 * (1 + 64 * 4) + 32 * 4 + 3], 0);
  assert.equal(pixels[1 + 40 * (1 + 64 * 4) + 10 * 4 + 3], 0);
});
