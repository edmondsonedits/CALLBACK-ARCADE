import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
(globalThis as unknown as { __profileFaceRouteEnv: unknown }).__profileFaceRouteEnv = {};
const binding = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = globalThis.__profileFaceRouteEnv;", shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
const { POST } = await import("../app/api/profile/face/route");
binding.deregister();
const url = "https://game.example/api/profile/face";
const idempotencyKey = "22222222-2222-4222-8222-222222222222";

test("profile face upload requires same-origin and the existing private profile cookie", async () => {
  const foreign = await POST(new Request(url, { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "image/png", "Idempotency-Key": idempotencyKey }, body: new Uint8Array([1]) }));
  assert.equal(foreign.status, 403);
  const anonymous = await POST(new Request(url, { method: "POST", headers: { Origin: "https://game.example", "Content-Type": "image/png", "Idempotency-Key": idempotencyKey }, body: new Uint8Array([1]) }));
  assert.equal(anonymous.status, 401);
});

test("profile face upload rejects an oversized declared body before database or provider access", async () => {
  const response = await POST(new Request(url, { method: "POST", headers: { Origin: "https://game.example", Cookie: `callback_profile=${"x".repeat(48)}`, "Content-Type": "image/png", "Idempotency-Key": idempotencyKey, "Content-Length": String(2 * 1024 * 1024 + 1) }, body: new Uint8Array([1]) }));
  assert.equal(response.status, 413);
  assert.equal((await response.json() as { error: string }).error, "PHOTO_TOO_LARGE");
});
