import assert from "node:assert/strict";
import test from "node:test";
import { ARCADE_GAMES, getArcadeControllerCapacity, getArcadeLaunchHref, getArcadeMinimumPlayers } from "../lib/arcade/catalog";
import { ArcadeGameIdSchema } from "../lib/arcade/contracts";

const expectedIds = [
  "arena-survivor", "buzzwort", "chaos-kommando", "drift-racer", "flatterfluff", "kartentisch",
  "magic-arena", "magic-duell", "minions-td", "schaetzorama", "word-tiles", "sketch-relay", "zeichnen-und-erraten",
  "air-hockey", "imposter", "light-trails", "pantomime", "schattenjagd", "dungeon-party", "fish-tank",
] as const;

test("arcade catalog has one titled, valid-status entry for every stable game ID", () => {
  const ids = ARCADE_GAMES.map((game) => game.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [...expectedIds].sort());
  for (const game of ARCADE_GAMES) {
    assert.equal(ArcadeGameIdSchema.safeParse(game.id).success, true);
    assert.ok(game.title.trim().length > 0);
    assert.ok(game.summary.trim().length > 0);
    assert.ok(["in-development", "playable"].includes(game.status));
  }
});

test("only playable games have launch links", () => {
  for (const game of ARCADE_GAMES) {
    const href = getArcadeLaunchHref(game);
    assert.equal(Boolean(href), game.status === "playable", game.id);
  }
});

test("Schaetzorama is selectable through the King Prompter Arcade room flow", () => {
  const schaetzorama = ARCADE_GAMES.find((game) => game.id === "schaetzorama");
  assert.ok(schaetzorama);
  assert.equal(schaetzorama.status, "playable");
  assert.equal(getArcadeLaunchHref(schaetzorama), "/host/new?gameLength=arcade&arcadeGameId=schaetzorama");
});

test("Imposter is selectable through its native King Prompter room flow", () => {
  const imposter = ARCADE_GAMES.find((game) => game.id === "imposter");
  assert.ok(imposter);
  assert.equal(imposter.status, "playable");
  assert.equal(getArcadeLaunchHref(imposter), "/host/new?gameLength=arcade&arcadeGameId=imposter");
});

test("Buzzwort is selectable through its native King Prompter room flow", () => {
  const buzzwort = ARCADE_GAMES.find((game) => game.id === "buzzwort");
  assert.ok(buzzwort);
  assert.equal(buzzwort.status, "playable");
  assert.equal(getArcadeLaunchHref(buzzwort), "/host/new?gameLength=arcade&arcadeGameId=buzzwort");
});

test("Pantomime is selectable through its native King Prompter room flow", () => {
  const pantomime = ARCADE_GAMES.find((game) => game.id === "pantomime");
  assert.ok(pantomime);
  assert.equal(pantomime.status, "playable");
  assert.equal(getArcadeLaunchHref(pantomime), "/host/new?gameLength=arcade&arcadeGameId=pantomime");
});

test("Zeichnen & Erraten is selectable through its native King Prompter room flow", () => {
  const drawGuess = ARCADE_GAMES.find((game) => game.id === "zeichnen-und-erraten");
  assert.ok(drawGuess);
  assert.equal(drawGuess.status, "playable");
  assert.equal(getArcadeLaunchHref(drawGuess), "/host/new?gameLength=arcade&arcadeGameId=zeichnen-und-erraten");
});

test("Arena Survivor is selectable through its native King Prompter room flow", () => {
  const game = ARCADE_GAMES.find((item) => item.id === "arena-survivor");
  assert.ok(game);
  assert.equal(game.status, "playable");
  assert.equal(getArcadeLaunchHref(game), "/host/new?gameLength=arcade&arcadeGameId=arena-survivor");
});

test("Chaos-Kommando is selectable and requires a cooperating three-player team", () => {
  const game = ARCADE_GAMES.find((item) => item.id === "chaos-kommando");
  assert.ok(game); assert.equal(game.status, "playable");
  assert.equal(getArcadeLaunchHref(game), "/host/new?gameLength=arcade&arcadeGameId=chaos-kommando");
  assert.equal(getArcadeMinimumPlayers("chaos-kommando"), 3);
});

test("Magic Arena is selectable with two to ten controller seats", () => {
  const game = ARCADE_GAMES.find((item) => item.id === "magic-arena");
  assert.ok(game); assert.equal(game.status, "playable");
  assert.equal(getArcadeLaunchHref(game), "/host/new?gameLength=arcade&arcadeGameId=magic-arena");
  assert.equal(getArcadeControllerCapacity("magic-arena"), 10);
  assert.equal(getArcadeMinimumPlayers("magic-arena"), 2);
});

test("Kartentisch is selectable with three to ten players", () => {
  const game = ARCADE_GAMES.find((item) => item.id === "kartentisch");
  assert.equal(game?.status, "playable");
  assert.equal(getArcadeLaunchHref(game!), "/host/new?gameLength=arcade&arcadeGameId=kartentisch");
  assert.equal(getArcadeControllerCapacity("kartentisch"), 10);
  assert.equal(getArcadeMinimumPlayers("kartentisch"), 3);
});

test("Dungeon Party is playable for a three-to-ten-player team", () => {
  const game = ARCADE_GAMES.find((item) => item.id === "dungeon-party");
  assert.ok(game); assert.equal(game.status, "playable");
  assert.equal(getArcadeLaunchHref(game), "/host/new?gameLength=arcade&arcadeGameId=dungeon-party");
  assert.equal(getArcadeMinimumPlayers("dungeon-party"), 3);
  assert.equal(getArcadeControllerCapacity("dungeon-party"), 10);
});

test("Word Tiles supports a private two-to-ten-player table", () => {
  assert.equal(getArcadeMinimumPlayers("word-tiles"), 2);
  assert.equal(getArcadeControllerCapacity("word-tiles"), 10);
});

test("Schattenjagd supports a private two-to-ten-player investigation", () => {
  assert.equal(getArcadeMinimumPlayers("schattenjagd"), 2);
  assert.equal(getArcadeControllerCapacity("schattenjagd"), 10);
});

test("Magic Duell has two to ten private controller seats", () => {
  assert.equal(getArcadeMinimumPlayers("magic-duell"), 2);
  assert.equal(getArcadeControllerCapacity("magic-duell"), 10);
});

test("Minions TD has two to ten strategy seats", () => {
  const game = ARCADE_GAMES.find((item) => item.id === "minions-td");
  assert.ok(game);
  assert.equal(game.status, "playable");
  assert.equal(getArcadeLaunchHref(game), "/host/new?gameLength=arcade&arcadeGameId=minions-td");
  assert.equal(getArcadeMinimumPlayers("minions-td"), 2);
  assert.equal(getArcadeControllerCapacity("minions-td"), 10);
});

test("Flatterfluff is playable for two to ten phone shooters", () => {
  const game = ARCADE_GAMES.find((item) => item.id === "flatterfluff");
  assert.ok(game);
  assert.equal(game.status, "playable");
  assert.equal(getArcadeLaunchHref(game), "/host/new?gameLength=arcade&arcadeGameId=flatterfluff");
  assert.equal(getArcadeMinimumPlayers("flatterfluff"), 2);
  assert.equal(getArcadeControllerCapacity("flatterfluff"), 10);
});

test("Drift Racer supports one-player practice through ten-player phone races", () => {
  assert.equal(getArcadeMinimumPlayers("drift-racer"), 1);
  assert.equal(getArcadeControllerCapacity("drift-racer"), 10);
});

test("Light Trails is configured for two-to-ten live phone riders", () => {
  const game = ARCADE_GAMES.find(({ id }) => id === "light-trails");
  assert.ok(game);
  assert.equal(game.status, "playable");
  assert.equal(getArcadeLaunchHref(game), "/arcade/online/new?game=light-trails");
  assert.equal(getArcadeMinimumPlayers("light-trails"), 2);
  assert.equal(getArcadeControllerCapacity("light-trails"), 10);
});

test("native hidden-role and performer titles advertise their actual three-player floor", () => {
  for (const gameId of ["buzzwort", "imposter", "pantomime", "zeichnen-und-erraten", "arena-survivor"] as const) assert.equal(getArcadeMinimumPlayers(gameId), 3);
  assert.equal(getArcadeMinimumPlayers("air-hockey"), 2);
});


test("Sketch & Sorcery launches as a complete native game with three to ten players", () => {
  const game = ARCADE_GAMES.find(item => item.id === "sketch-relay");
  assert.ok(game); assert.equal(game.status, "playable"); assert.equal(game.placeholder, false);
  assert.equal(getArcadeLaunchHref(game), "/host/new?gameLength=arcade&arcadeGameId=sketch-relay");
  assert.equal(getArcadeMinimumPlayers("sketch-relay"), 3); assert.equal(getArcadeControllerCapacity("sketch-relay"), 10);
});

test("The Last Fish Swimming launches independently through the ordinary party room flow", () => {
  const game = ARCADE_GAMES.find(item => item.id === "fish-tank");
  assert.ok(game); assert.equal(game.status, "playable"); assert.equal(game.placeholder, false);
  assert.equal(getArcadeLaunchHref(game), "/host/new?gameLength=arcade&arcadeGameId=fish-tank");
  assert.equal(getArcadeMinimumPlayers("fish-tank"), 1); assert.equal(getArcadeControllerCapacity("fish-tank"), 10);
});
