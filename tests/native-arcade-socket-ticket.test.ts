import assert from "node:assert/strict";
import test from "node:test";
import { issueNativeArcadeSocketTicket, verifyNativeArcadeSocketTicket, roomSocketGameId } from "../lib/arcade/native-socket-ticket";

const base = { roomId: "room-1", roomCode: "ABCD", gameId: "imposter" as const, matchId: "match-1", generationId: "generation-1", partyKey: "room-1", actorId: "player-1", tokenHash: "a".repeat(64), role: "player" as const };

test("all active party packs use scoped socket tickets without enabling archived packs", async () => {
  for (const pack of ["standard", "pictures", "comic", "king-mystery", "royal-rumours", "bowl-of-fools"]) {
    const gameId = roomSocketGameId(pack);
    assert.equal(gameId, `party:${pack}`);
    const { ticket } = await issueNativeArcadeSocketTicket({ ...base, gameId: gameId! }, "test-secret", 10_000);
    await verifyNativeArcadeSocketTicket(ticket, "test-secret", { gameId: gameId!, now: 10_001 });
    await assert.rejects(verifyNativeArcadeSocketTicket(ticket, "test-secret", { gameId: "imposter", now: 10_001 }), /BINDING/);
  }
  for (const pack of ["birthday", "bowl", "royal-war-room", "unknown"]) assert.equal(roomSocketGameId(pack), null);
  assert.equal(roomSocketGameId("arcade", "sketch-relay"), "sketch-relay");
  assert.equal(roomSocketGameId("arcade", "sumo"), null);
});

test("native Arcade socket tickets bind the authenticated room, match, generation, and actor", async () => {
  const { ticket } = await issueNativeArcadeSocketTicket(base, "test-secret", 10_000);
  const claims = await verifyNativeArcadeSocketTicket(ticket, "test-secret", { ...base, now: 10_001 });
  assert.equal(claims.actorId, "player-1");
  await assert.rejects(verifyNativeArcadeSocketTicket(ticket, "test-secret", { ...base, roomId: "other-room", now: 10_001 }), /BINDING/u);
  await assert.rejects(verifyNativeArcadeSocketTicket(ticket, "other-secret", { ...base, now: 10_001 }), /SIGNATURE/u);
});

test("native Arcade socket tickets expire and reject unsupported games and roles", async () => {
  const { ticket, claims } = await issueNativeArcadeSocketTicket(base, "test-secret", 20_000);
  await assert.rejects(verifyNativeArcadeSocketTicket(ticket, "test-secret", { now: claims.exp }), /EXPIRED/u);
  await assert.rejects(issueNativeArcadeSocketTicket({ ...base, gameId: "air-hockey" as never }, "test-secret", 20_000), /invalid_value/u);
  await assert.rejects(issueNativeArcadeSocketTicket({ ...base, role: "mirror" as never }, "test-secret", 20_000), /Invalid option/u);
});
