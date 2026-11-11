import { createSketchRelayMatch } from "../server/arcade/sketch_relay";
import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { deflateSync } from "node:zlib";
import type { RoomState } from "../server/types";

type Statement = { sql: string; values: unknown[]; bind(...values: unknown[]): Statement; first(): Promise<unknown>; run(): Promise<unknown> };
type Job = { id: string; room_id: string; kind: string; prompt_json: string; status: string; error_code?: string | null; object_key?: string; content_type?: string; byte_size?: number; lease_owner?: string; lease_expires_at?: number; attempts: number };
let room: RoomState; let seatHash = ""; let leaseLost = false; let loseLeaseAtBatch = false; let completionBatches = 0; let putCount = 0;
const jobs = new Map<string, Job>(); const actions = new Set<string>(); const objects = new Map<string, Uint8Array>(); const imageReservations = new Map<string, { roomId: string; window: string; day: string }>(); const imageCircuits = new Set<string>();
const statement = (sql: string): Statement => ({ sql, values: [], bind(...values) { this.values = values; return this; }, async run() {
  if (sql.startsWith("INSERT INTO openai_image_reservations")) {
    const values = this.values; const jobId = String(values[0]); const roomId = String(values[1]); const window = String(values[2]); const day = String(values[4]);
    if (imageReservations.has(jobId) || imageCircuits.has(String(values[6])) || [...imageReservations.values()].filter(row => row.window === String(values[7])).length >= Number(values[8]) || [...imageReservations.values()].filter(row => row.window === String(values[9]) && row.day === String(values[10])).length >= Number(values[11]) || [...imageReservations.values()].filter(row => row.window === String(values[12]) && row.roomId === String(values[13])).length >= Number(values[14])) return { meta: { changes: 0 } };
    imageReservations.set(jobId, { roomId, window, day }); return { meta: { changes: 1 } };
  }
  if (sql.startsWith("INSERT OR IGNORE INTO openai_image_circuits")) { const window = String(this.values[0]); const changes = imageCircuits.has(window) ? 0 : 1; imageCircuits.add(window); return { meta: { changes } }; }
  return { meta: { changes: 1 } };
}, async first() {
  if (sql.startsWith("SELECT id, code, host_token_hash")) return { id: room.id, code: room.code, host_token_hash: "unused", version: room.version, state_json: JSON.stringify(room), expires_at: Date.now() + 60_000 };
  if (sql.startsWith("SELECT id, role, token_hash")) return this.values[1] === seatHash ? { id: "p1", role: "player", token_hash: seatHash, removed_at: null } : null;
  if (sql.startsWith("SELECT count FROM rate_limits")) return { count: 1 };
  if (sql.includes("FROM processed_actions")) return actions.has(String(this.values[1])) ? { used: 1 } : null;
  if (sql.startsWith("SELECT 1 AS owned")) { const job = jobs.get(String(this.values[0])); return !leaseLost && job?.status === "GENERATING" && job.lease_owner === this.values[2] && (job.lease_expires_at ?? 0) > Date.now() ? { owned: 1 } : null; }
  if (sql.includes("FROM jobs")) { const job = jobs.get(String(this.values[0])); return job && job.room_id === this.values[1] && job.status === "READY" ? job : null; }
  return null;
} });
const db = { prepare: statement, async batch(statements: Statement[]) {
  let committed = false;
  return statements.map(s => {
    const v = s.values; let changes = 0;
    if (s.sql.startsWith("UPDATE rooms SET phase")) {
      if (loseLeaseAtBatch && s.sql.includes("SELECT 1 FROM jobs WHERE")) leaseLost = true;
      const guard = !s.sql.includes("SELECT 1 FROM jobs WHERE") || !leaseLost && jobs.get(String(v[v.length - 3]))?.lease_owner === v[v.length - 2];
      committed = room.version === v[11] && guard;
      if (committed) { room = JSON.parse(String(v[3])) as RoomState; changes = 1; }
    } else if (committed && s.sql.startsWith("INSERT INTO processed_actions")) { actions.add(String(v[1])); changes = 1; }
    else if (committed && s.sql.includes("'SKETCH_UPLOAD', 'READY'")) { jobs.set(String(v[0]), { id: String(v[0]), room_id: String(v[1]), kind: "SKETCH_UPLOAD", status: "READY", attempts: 0, prompt_json: String(v[4]), object_key: String(v[5]), content_type: "image/png", byte_size: Number(v[6]) }); changes = 1; }
    else if (committed && s.sql.startsWith("INSERT INTO jobs")) { jobs.set(String(v[0]), { id: String(v[0]), room_id: String(v[1]), kind: String(v[3]), status: "QUEUED", attempts: 0, prompt_json: String(v[5]) }); changes = 1; }
    else if (committed && s.sql.startsWith("UPDATE jobs SET status = ?")) { completionBatches++; const job = jobs.get(String(v[6]))!; job.status = String(v[0]); job.object_key = v[1] ? String(v[1]) : undefined; job.content_type = v[2] ? String(v[2]) : undefined; job.byte_size = v[3] ? Number(v[3]) : undefined; job.error_code = v[4] ? String(v[4]) : null; job.lease_owner = undefined; changes = 1; }
    return { meta: { changes } };
  });
} };
const storage = {
  async put(key: string, bytes: Uint8Array, options?: { onlyIf?: unknown }) { if (!options?.onlyIf || !objects.has(key)) { objects.set(key, bytes.slice()); putCount++; } return {}; },
  async head(key: string) { const bytes = objects.get(key); return bytes ? { size: bytes.length } : null; },
  async get(key: string) { const bytes = objects.get(key); return bytes ? { size: bytes.length, arrayBuffer: async () => bytes.slice().buffer } : null; },
};
const env = { DB: db, MEDIA: storage, CLOUDFLARE_ACCOUNT_ID: "test-account", CLOUDFLARE_AI_API_TOKEN: "test-token", OPENAI_IMAGE_API_KEY: "test-image-key", OPENAI_IMAGES_ENABLED: "true", OPENAI_IMAGES_CREDIT_WINDOW: "sketch-grant", OPENAI_IMAGES_STOP_AT: "2099-01-01T00:00:00Z" };
(globalThis as unknown as { __sketchImageTestEnv: unknown }).__sketchImageTestEnv = env;
const hook = registerHooks({ resolve(specifier, context, nextResolve) { if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__sketchImageTestEnv;", shortCircuit: true }; return nextResolve(specifier, context); } });
const { readSketchPng, validateSketchPng, SKETCH_MAX_BYTES, transformSketchReference, runSketchTransformJob } = await import("../server/sketch-images");
const { POST } = await import("../app/api/rooms/[code]/sketch/route");
const { sha256Hex } = await import("../server/crypto");
const { createRoomState, applyHostAction } = await import("../server/engine");
hook.deregister();

function crc(bytes: Uint8Array) { let c = -1; for (const byte of bytes) { c ^= byte; for (let i = 0; i < 8; i++) c = c >>> 1 ^ (c & 1 ? 0xedb88320 : 0); } return (c ^ -1) >>> 0; }
function png(size = 480) { const chunk = (type: string, data: Uint8Array) => { const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); out.write(type, 4); out.set(data, 8); out.writeUInt32BE(crc(out.subarray(4, -4)), out.length - 4); return out; }; const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6; const pixels = Buffer.alloc(size * (size * 4 + 1), 255); for (let y = 0; y < size; y++) pixels[y * (size * 4 + 1)] = 0; return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", new Uint8Array())]); }
async function reset() {
  const now = Date.now(); jobs.clear(); actions.clear(); objects.clear(); imageReservations.clear(); imageCircuits.clear(); leaseLost = false; loseLeaseAtBatch = false; completionBatches = 0; putCount = 0;
  room = createRoomState("SKCH", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false }, now);
  for (let i = 1; i <= 3; i++) room.participants.push({ id: `p${i}`, nickname: `Player ${i}`, nicknameNormalized: `player ${i}`, role: "player", seat: i, avatar: i - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: now, removedAt: null });
  room = applyHostAction(room, { type: "START_GAME", actionId: "start", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, now + 1).next;
  // Image-provider/upload regressions exercise retained relay assignments independently of the new election phase.
  room.sketchRelay = createSketchRelayMatch({ matchId: room.arcadeMatch!.id, players: ["p1", "p2", "p3"], now: now + 1 }); room.deadlineAt = room.sketchRelay.deadline;
  seatHash = await sha256Hex("seat-test");
}
// The controller binds retries to the canvas bytes and emits this exact ID shape.
const uploadId = `sketch-${"a".repeat(64)}`;
function upload(bytes = png(), overrides: Record<string, string> = {}) { const m = room.sketchRelay!; return new Request("https://game.test/api/rooms/SKCH/sketch", { method: "POST", headers: { Origin: "https://game.test", Cookie: "callback_seat_SKCH=seat-test", "Content-Type": "image/png", "X-Sketch-Match": m.matchId, "X-Sketch-Round": "1", "X-Sketch-Chain": m.chains[0]!.chainId, "X-Sketch-Leg": "drawing", "X-Sketch-Prompt-Index": "0", "X-Sketch-Action-Id": uploadId, ...overrides }, body: bytes }); }
const submit = (request: Request) => POST(request, { params: Promise.resolve({ code: "SKCH" }) });
function claimedJob() { const job = [...jobs.values()].find(j => j.kind === "SKETCH_TRANSFORM")!; job.status = "GENERATING"; job.lease_owner = "lease-test"; job.lease_expires_at = Date.now() + 90_000; return job; }

test("bounded PNG reader rejects oversized streams, dimensions, truncated and timed out uploads", async () => {
  assert.deepEqual(validateSketchPng(png()), { width: 480, height: 480 });
  assert.throws(() => validateSketchPng(png(513)), /square PNG/u);
  assert.throws(() => validateSketchPng(png().subarray(0, 40)), /PNG/u);
  const huge = new Request("https://game.test", { method: "POST", headers: { "Content-Type": "image/png" }, body: new Uint8Array(SKETCH_MAX_BYTES + 1) });
  await assert.rejects(readSketchPng(huge), /too large/u);
  const slow = new Request("https://game.test", { method: "POST", headers: { "Content-Type": "image/png" }, body: new ReadableStream({ pull() { return new Promise(() => {}); } }), duplex: "half" } as RequestInit);
  await assert.rejects(readSketchPng(slow, 10), /timed out/u);
});

test("upload enforces cookie actor, origin, assignment, pause, phase, and immutable retry receipts", async () => {
  await reset();
  assert.equal((await submit(upload(png(), { Origin: "https://evil.test" }))).status, 403);
  assert.equal((await submit(upload(png(), { Cookie: "" }))).status, 401);
  assert.equal((await submit(upload(png(), { "X-Sketch-Chain": room.sketchRelay!.chains[1]!.chainId }))).status, 409);
  room.paused = true; assert.equal((await submit(upload())).status, 409); room.paused = false;
  assert.equal(putCount, 0);
  const first = await submit(upload()); assert.equal(first.status, 200, await first.clone().text());
  const body = await first.json() as { assetId: string }; assert.ok(jobs.get(body.assetId));
  const version = room.version; const count = jobs.size;
  const retry = await submit(upload()); assert.equal(retry.status, 200); assert.equal(retry.headers.get("x-callback-idempotent"), "true");
  assert.equal(room.version, version); assert.equal(jobs.size, count); assert.equal(putCount, 1);
  assert.equal((await submit(upload(png(479)))).status, 409); assert.equal(putCount, 1);
  const previousRound = room.sketchRelay!.round; room.sketchRelay!.round = 2;
  const stale = upload(png(), { "X-Sketch-Round": String(previousRound), "X-Sketch-Action-Id": "22345678-1234-4234-8234-123456789abc" });
  assert.equal((await submit(stale)).status, 409);
});

test("the real existing provider receives the exact PNG as indexed multipart FLUX2-fast reference", async t => {
  const bytes = png(); let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++; const request = new Request(input, init);
    assert.match(request.url, /flux-2-klein-4b$/u);
    const form = await request.formData(); assert.equal(form.get("width"), "1024"); assert.equal(form.get("height"), "1024");
    const reference = form.get("input_image_0") as File; assert.equal(reference.type, "image/png"); assert.deepEqual(new Uint8Array(await reference.arrayBuffer()), new Uint8Array(bytes));
    assert.equal(form.has("input_image_1"), false); assert.match(String(form.get("prompt")), /medieval fantasy 3D/u);
    return Response.json({ result: { image: Buffer.from(bytes).toString("base64") } });
  });
  assert.ok(await transformSketchReference(bytes)); assert.equal(calls, 1);
});

test("OpenAI-selected Sketch Relay sends the immutable PNG to low Images with one durable reservation", async t => {
  await reset(); room.imageModel = "openai-low"; assert.equal((await submit(upload())).status, 200); const job = claimedJob(); const sourceJob = [...jobs.values()].find(value => value.kind === "SKETCH_UPLOAD")!; const sourceBytes = objects.get(sourceJob.object_key!);
  const requestShapes: Array<{ path: string; retry: string | null; model: string | null; quality: string | null; count: string | null; image: Uint8Array | null; contentType: string | null }> = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init); const path = new URL(request.url).pathname;
    if (path !== "/v1/images/edits") return new Response(null, { status: 204 });
    const form = await request.formData(); const file = form.getAll("image[]")[0];
    requestShapes.push({ path, retry: request.headers.get("x-stainless-retry-count"), model: typeof form.get("model") === "string" ? form.get("model") as string : null, quality: typeof form.get("quality") === "string" ? form.get("quality") as string : null, count: typeof form.get("n") === "string" ? form.get("n") as string : null, image: file instanceof File ? new Uint8Array(await file.arrayBuffer()) : null, contentType: file instanceof File ? file.type : null });
    return Response.json({ created: 1, data: [{ b64_json: png().toString("base64") }] });
  });
  const result = await runSketchTransformJob("SKCH", job); const apiRequest = requestShapes[0];
  assert.equal(requestShapes.length, 1); assert.equal(apiRequest?.path, "/v1/images/edits"); assert.equal(apiRequest?.model, "gpt-image-2"); assert.equal(apiRequest?.quality, "low"); assert.equal(apiRequest?.count, "1"); assert.equal(apiRequest?.contentType, "image/png");
  if (sourceBytes) assert.deepEqual(apiRequest?.image, sourceBytes);
  assert.equal(imageReservations.size, 1); assert.equal(result.status, "READY"); assert.equal(imageCircuits.size, 0);
});
test("OpenAI quota exhaustion latches the grant and returns the original sketch with a safe notice", async t => {
  await reset(); room.imageModel = "openai-low"; assert.equal((await submit(upload())).status, 200); const job = claimedJob(); let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ error: { message: "Insufficient quota", type: "insufficient_quota", code: "insufficient_quota" } }, { status: 429 }); });
  const result = await runSketchTransformJob("SKCH", job);
  assert.equal(calls, 1, `calls=${calls}; reservations=${imageReservations.size}; circuits=${imageCircuits.size}`); assert.equal(imageReservations.size, 1); assert.equal(result.status, "FALLBACK"); assert.equal(result.reason, "ALLOWANCE_STOP"); assert.equal(calls, 1); assert.equal(imageReservations.size, 1);
  assert.ok(imageCircuits.has("sketch-grant")); assert.equal(room.imageGenerationNotice?.reason, "ALLOWANCE_STOP");
});

test("generic OpenAI rate limiting does not trip the allowance circuit", async t => {
  await reset(); room.imageModel = "openai-low"; env.OPENAI_IMAGES_CREDIT_WINDOW = "generic-rate-limit-window"; assert.equal((await submit(upload())).status, 200); const job = claimedJob();
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: { message: "Too many requests", type: "rate_limit_error", code: "rate_limit_exceeded" } }, { status: 429 }));
  const result = await runSketchTransformJob("SKCH", job);
  assert.equal(result.status, "FALLBACK"); assert.equal(result.reason, undefined); assert.equal(job.error_code, "IMAGE_PROVIDER_FAILED"); assert.equal(imageReservations.size, 1); assert.equal(imageCircuits.size, 0);
});
test("OpenAI API errors with key fragments are stored as a fixed code and never latch on 401", async t => {
  await reset(); room.imageModel = "openai-low"; env.OPENAI_IMAGES_CREDIT_WINDOW = "sanitized-provider-error-window"; assert.equal((await submit(upload())).status, 200); const job = claimedJob();
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (new URL(request.url).pathname !== "/v1/images/edits") return new Response(null, { status: 204 });
    return Response.json({ error: { message: "Invalid API key sk-secret-fragment", type: "invalid_request_error", code: "invalid_api_key" } }, { status: 401 });
  });
  const result = await runSketchTransformJob("SKCH", job);
  assert.equal(result.status, "FALLBACK"); assert.equal(job.error_code, "IMAGE_PROVIDER_FAILED"); assert.equal(job.error_code?.includes("sk-secret-fragment"), false); assert.equal(imageCircuits.size, 0);
});
test("provider failure atomically chooses the real source once without another model or text fallback", async t => {
  await reset(); assert.equal((await submit(upload())).status, 200); const job = claimedJob(); let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ success: false }, { status: 500 }); });
  const result = await runSketchTransformJob("SKCH", job);
  assert.equal(calls, 1); assert.equal(result.status, "FALLBACK"); assert.equal(result.assetId, room.sketchRelay!.chains[0]!.drawing!.assetId);
  assert.equal(job.status, "FALLBACK"); assert.equal(room.sketchRelay!.chains[0]!.drawing!.image.status, "FALLBACK"); assert.equal(completionBatches, 1);
});

test("a delayed provider result cannot complete a replaced lease or stale round", async t => {
  await reset(); assert.equal((await submit(upload())).status, 200); const job = claimedJob();
  t.mock.method(globalThis, "fetch", async () => { leaseLost = true; return Response.json({ result: { image: png().toString("base64") } }); });
  await assert.rejects(runSketchTransformJob("SKCH", job), /JOB_LEASE_CHANGED/u);
  assert.equal(completionBatches, 0); assert.equal(room.sketchRelay!.chains[0]!.drawing!.image.status, "QUEUED");
  leaseLost = false; room.sketchRelay!.round = 2;
  await assert.rejects(runSketchTransformJob("SKCH", job), /STALE_SKETCH_JOB/u); assert.equal(completionBatches, 0);
});

test("an expired attempt uses source fallback without purchasing a second generation", async t => {
  await reset(); assert.equal((await submit(upload())).status, 200); const job = claimedJob(); job.attempts = 1;
  t.mock.method(globalThis, "fetch", async () => { assert.fail("must not retry generation"); });
  assert.equal((await runSketchTransformJob("SKCH", job)).status, "FALLBACK");
});

test("successful generation commits its R2 receipt and room image together under the current lease", async t => {
  await reset(); assert.equal((await submit(upload())).status, 200); const job = claimedJob();
  t.mock.method(globalThis, "fetch", async () => Response.json({ result: { image: png().toString("base64") } }));
  const result = await runSketchTransformJob("SKCH", job);
  assert.deepEqual(result, { status: "READY", assetId: job.id }); assert.equal(job.status, "READY");
  assert.ok(job.object_key && objects.has(job.object_key)); assert.equal(room.sketchRelay!.chains[0]!.drawing!.image.assetId, job.id);
  assert.equal(completionBatches, 1);
});

test("lease replacement immediately before the atomic commit blocks both room and job completion", async t => {
  await reset(); assert.equal((await submit(upload())).status, 200); const job = claimedJob(); loseLeaseAtBatch = true;
  t.mock.method(globalThis, "fetch", async () => Response.json({ result: { image: png().toString("base64") } }));
  const version = room.version;
  await assert.rejects(runSketchTransformJob("SKCH", job), /JOB_LEASE_CHANGED/u);
  assert.equal(room.version, version); assert.equal(job.status, "GENERATING"); assert.equal(completionBatches, 0);
  assert.equal(room.sketchRelay!.chains[0]!.drawing!.image.status, "QUEUED");
});

test("unavailable storage retains an honest retryable upload instead of submitting a fake image", async () => {
  await reset(); const configured = env.MEDIA;
  try {
    (env as { MEDIA?: typeof storage }).MEDIA = undefined;
    const response = await submit(upload()); assert.equal(response.status, 503); assert.match(await response.text(), /Keep your drawing/u);
    assert.equal(jobs.size, 0); assert.equal(room.sketchRelay!.chains[0]!.drawing, undefined);
  } finally { env.MEDIA = configured; }
});
