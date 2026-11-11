import assert from "node:assert/strict";
import test from "node:test";
import { createRoomSchema } from "../lib/contracts";
import { blocksNewArchivedGame } from "../lib/game/archived-packs";
import { SessionGameSchema } from "../lib/session-contracts";

const archived = ["bowl", "royal-war-room", "birthday"] as const;

test("archived packs cannot be selected for new room launches", () => {
  for (const gameLength of archived) {
    assert.equal(createRoomSchema.safeParse({ gameLength, contentMode: "party", timerAccessibility: false, birthdayName: "Alex" }).success, false, gameLength);
    assert.equal(SessionGameSchema.safeParse({ kind: "main", gameId: gameLength, contentMode: "party", timerAccessibility: false, birthdayName: "Alex" }).success, false, gameLength);
  }
  assert.equal(createRoomSchema.safeParse({ gameLength: "pictures", contentMode: "party", timerAccessibility: false }).success, true);
  assert.equal(SessionGameSchema.safeParse({ kind: "main", gameId: "pictures", contentMode: "party", timerAccessibility: false }).success, true);
});

test("existing archived rooms can continue but cannot start or replay archived games", () => {
  for (const gameLength of archived) {
    assert.equal(blocksNewArchivedGame(gameLength, "START_GAME"), true);
    assert.equal(blocksNewArchivedGame(gameLength, "PLAY_AGAIN"), true);
  }
  assert.equal(blocksNewArchivedGame("pictures", "START_GAME"), false);
  assert.equal(blocksNewArchivedGame("birthday", "SUBMIT_ANSWER"), false);
});
