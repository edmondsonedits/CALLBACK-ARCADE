import assert from "node:assert/strict";
import test from "node:test";
import { ARCADE_GAMES } from "../lib/arcade/catalog";
import { ACTIVE_FULL_ARCADE_GAMES, FULL_ARCADE_GAMES } from "../lib/arcade/full-games";
import { getFullArcadeGame as getPersistedOnlineFullGame } from "../lib/arcade/online/full-games";
import { ONLINE_HOSTED_GAME_IDS } from "../lib/arcade/online/catalog";
import { PRACTICE_GAMES, getPracticeGame } from "../lib/arcade/practice/catalog";
import { isArchivedArcadeGame, ARCHIVED_ARCADE_GAMES } from "../lib/arcade/archived-games";
import { SessionGameSchema } from "../lib/session-contracts";

test("the archive identifies the sixteen requested Arcade games and aliases", () => {
  assert.equal(ARCHIVED_ARCADE_GAMES.length, 16);
  for (const id of [
    "space-bash", "snow-bash", "drain-bash", "jungle-bash", "tie-breaker", "manic-panic",
    "rubble-alliance", "sky-balls", "royal-ballistix", "dragon-drop", "volt-vault",
    "mystery-beat", "jungle-fox", "metal-fox", "paint-panic", "rhythm", "tap-race",
  ]) assert.equal(isArchivedArcadeGame(id), true, id);
  for (const id of ["sumo", "twisted-system", "roller-ruckus", "scratch-match", "tailblazer", "blind-crown", "air-hockey"]) {
    assert.equal(isArchivedArcadeGame(id), false, id);
  }
});

test("archived Arcade games and aliases are absent from every active catalog", () => {
  assert.deepEqual(PRACTICE_GAMES.map(game => game.id), ["sumo", "twisted-system", "roller-ruckus", "scratch-match", "tailblazer"]);
  assert.deepEqual(ACTIVE_FULL_ARCADE_GAMES.map(game => game.id), ["royal-sumo", "royal-scratch-match", "royal-roller-ruckus", "royal-twisted", "blind-crown"]);
  assert.ok(FULL_ARCADE_GAMES.some(game => game.practiceId === "space-bash"), "archived full-game source remains resolvable for persisted matches");
  assert.deepEqual(ONLINE_HOSTED_GAME_IDS, ["sumo", "twisted-system", "roller-ruckus", "scratch-match", "tailblazer", "air-hockey", "light-trails"]);
  assert.equal(getPracticeGame("space-bash"), null);
  assert.equal(getPracticeGame("sky-balls"), null);
  assert.equal(getPersistedOnlineFullGame("space-bash")?.id, "space-bash", "persisted archived online matches retain their renderer definition");
  assert.equal(getPersistedOnlineFullGame("sky-balls")?.id, "royal-ballistix", "the legacy Royal Ballistix alias retains its renderer definition");
  assert.equal(ARCADE_GAMES.some(game => isArchivedArcadeGame(game.id)), false);
});

test("shared-session validation rejects archived online Arcade launches", () => {
  for (const gameId of ["space-bash", "sky-balls", "royal-ballistix", "tap-race"]) {
    assert.equal(SessionGameSchema.safeParse({ kind: "online", gameId }).success, false, gameId);
  }
  assert.equal(SessionGameSchema.safeParse({ kind: "main", gameId: "arcade", arcadeGameId: "tap-race" }).success, false);
  assert.equal(SessionGameSchema.safeParse({ kind: "main", gameId: "arcade", arcadeGameId: "air-hockey" }).success, true);
  assert.equal(SessionGameSchema.safeParse({ kind: "online", gameId: "sumo" }).success, true);
});
