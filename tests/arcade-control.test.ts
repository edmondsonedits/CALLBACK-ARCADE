import assert from "node:assert/strict";
import test from "node:test";
import { verifyArcadeCallback } from "../server/arcade/tickets";
import { syncArcadeWorker } from "../server/arcade/control";

const base = { roomCode: "ABCD", gameId: "air-hockey" as const, matchId: "match-1", roomVersion: 4, phase: "ARCADE_ACTIVE" as const, paused: false, controllerIds: ["p1", "p2"] };

test("signed Worker sync binds room lifecycle and normalizes results to paused", async () => {
  let receivedUrl = "";
  let receivedBody = "";
  let receivedHeaders: Headers | undefined;
  await syncArcadeWorker({ ...base, phase: "ARCADE_RESULTS", paused: false }, "https://arcade.example", "secret", async (input, init) => {
    receivedUrl = String(input);
    receivedBody = String(init?.body);
    receivedHeaders = new Headers(init?.headers);
    return Response.json({ ok: true });
  });
  assert.equal(receivedUrl, "https://arcade.example/control/ABCD");
  const message = JSON.parse(receivedBody) as { phase: string; paused: boolean; action: string; matchId: string };
  assert.equal(message.phase, "ARCADE_RESULTS");
  assert.equal(message.paused, true);
  assert.equal(message.action, "sync");
  assert.equal(message.matchId, "match-1");
  await verifyArcadeCallback(receivedBody, {
    timestamp: receivedHeaders?.get("x-arcade-timestamp") ?? undefined,
    nonce: receivedHeaders?.get("x-arcade-nonce") ?? undefined,
    signature: receivedHeaders?.get("x-arcade-signature") ?? undefined,
  }, "secret");
});

test("signed Worker sync rejects invalid seats and non-TLS remote endpoints", async () => {
  await assert.rejects(syncArcadeWorker({ ...base, revokedControllerIds: ["outside"] }, "https://arcade.example", "secret", fetch), /INVALID_ARCADE_CONTROL_SYNC/);
  await assert.rejects(syncArcadeWorker(base, "http://arcade.example", "secret", fetch), /INVALID_ARCADE_WORKER_URL/);
});

test("signed Worker sync supports the native Light Trails realtime game", async () => {
  let body = "";
  await syncArcadeWorker({ ...base, gameId: "light-trails", controllerIds: ["p1", "p2", "p3"] }, "https://arcade.example", "secret", async (_input, init) => {
    body = String(init?.body);
    return Response.json({ ok: true });
  });
  assert.equal((JSON.parse(body) as { gameId: string }).gameId, "light-trails");
});
