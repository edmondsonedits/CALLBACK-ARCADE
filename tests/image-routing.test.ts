import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { OPENAI_IMAGE_GUARD_DDL, reserveOpenAIImageRequest } from "../server/openai-image-guard";

const sqlite = new DatabaseSync(":memory:");
for (const sql of OPENAI_IMAGE_GUARD_DDL) sqlite.exec(sql);
const db = {
  prepare(sql: string) {
    const wrap = (values: unknown[] = []) => ({
      bind(...next: unknown[]) { return wrap(next); },
      first: async <T>() => sqlite.prepare(sql).get(...values as never[]) as T | undefined ?? null,
      all: async <T>() => ({ results: sqlite.prepare(sql).all(...values as never[]) as T[] }),
      run: async () => { const result = sqlite.prepare(sql).run(...values as never[]); return { success: true, meta: { changes: Number(result.changes) } }; },
    }) as unknown as D1PreparedStatement;
    return wrap();
  },
} as unknown as D1Database;const env = { OPENAI_IMAGE_API_KEY: "test-only", OPENAI_IMAGES_ENABLED: "true", OPENAI_IMAGES_CREDIT_WINDOW: "test-grant", OPENAI_IMAGES_STOP_AT: "2099-01-01T00:00:00Z", OPENAI_IMAGE_QUALITY: "high", DB: db };
(globalThis as unknown as { __imageRouterTestEnv: unknown }).__imageRouterTestEnv = env;
const binding = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__imageRouterTestEnv;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { getAIProviders } = await import("../server/ai");
binding.deregister();

test("image-only activation cannot charge FLUX or lore, and low requires a durable reservation", async (t) => {
  const requests: Array<Record<string, unknown>> = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, "/v1/images/generations");
    requests.push(await request.json() as Record<string, unknown>);
    const bytes = new Uint8Array(1024); bytes.set([0x89, 0x50, 0x4e, 0x47]);
    return Response.json({ created: 1, data: [{ b64_json: Buffer.from(bytes).toString("base64") }] });
  });
  const providers = getAIProviders();
  for (const model of ["flux-1-schnell", "flux-2-fast", "flux-2-quality"] as const) {
    assert.equal(await providers.image.generate("A pigeon", { model, aspect: "square" }), null);
  }
  const lore = await providers.lore.analyze({ prompt: "A pigeon", memoryRole: "ANCHOR", answers: [], graph: { nodes: [], edges: [] } });
  assert.deepEqual(lore.analyses, []);
  assert.equal(requests.length, 0);
  await assert.rejects(() => providers.image.generate("A pigeon", { model: "openai-low", aspect: "square" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "ALLOWANCE_STOP");
  assert.equal(requests.length, 0);
  const reservation = await reserveOpenAIImageRequest({ db, config: env, jobId: "image-job", roomId: "image-room" });
  assert.equal(reservation.reserved, true);
  if (!reservation.reserved) return;
  await assert.rejects(() => providers.image.generate("x".repeat(8001), { model: "openai-low", aspect: "square", openAIReservation: reservation.reservation, openAIJobId: "image-job", openAIRoomId: "image-room" }), (error: unknown) => error instanceof Error && "code" in error && error.code === "OPENAI_IMAGE_PROMPT_TOO_LONG");
  assert.equal(requests.length, 0);
  const image = await providers.image.generate("A pigeon", { model: "openai-low", aspect: "square", openAIReservation: reservation.reservation, openAIJobId: "image-job", openAIRoomId: "image-room" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.quality, "low");
  assert.equal(requests[0]!.model, "gpt-image-2");
  assert.equal(image?.contentType, "image/png");
  await assert.rejects(() => providers.image.generate("A pigeon", { model: "openai-low", aspect: "square", openAIReservation: reservation.reservation }), (error: unknown) => error instanceof Error && "code" in error && error.code === "ALLOWANCE_STOP");
  assert.equal(requests.length, 1, "a reservation can authorize at most one outbound call");
});
