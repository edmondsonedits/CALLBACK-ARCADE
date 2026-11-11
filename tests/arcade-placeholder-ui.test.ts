import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHooks } from "node:module";
import { ARCADE_GAMES, ARCADE_PLACEHOLDER_NOTE, getArcadeLaunchHref } from "../lib/arcade/catalog";
import { getFullArcadeGame } from "../lib/arcade/full-games";
import { PRACTICE_GAMES } from "../lib/arcade/practice/catalog";

// Vite supplies this alias in the Site; use the same real shim in Node rendering.
const linkAlias = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/link" ? "vinext/shims/link" : specifier, context);
  },
});
const { default: ArcadePage } = await import("../app/arcade/page");
const { default: ArcadePracticePage } = await import("../app/arcade/practice/page");
const { default: ArcadePracticeLab } = await import("../app/components/ArcadePracticeLab");
const { RoomSetupForm } = await import("../app/components/RoomSetupForm");
linkAlias.deregister();

test("completed replacements clear only their own placeholder flag", () => {
  for (const game of [...ARCADE_GAMES, ...PRACTICE_GAMES]) {
    assert.equal(game.placeholder, getFullArcadeGame(game.id) === null && !["sketch-relay", "fish-tank"].includes(game.id), game.id);
  }
  assert.match(ARCADE_PLACEHOLDER_NOTE, /replaced with a full game/);
  assert.match(ARCADE_PLACEHOLDER_NOTE, /one at a time/);
});

test("all room-game cards show the replacement note without removing launch links", () => {
  const html = renderToStaticMarkup(createElement(ArcadePage));
  for (const game of ARCADE_GAMES) {
    const card = html.match(new RegExp('<li[^>]*data-game-id="' + game.id + '"[\\s\\S]*?</li>'))?.[0];
    assert.ok(card, game.id);
    assert.equal(card.includes(ARCADE_PLACEHOLDER_NOTE), game.placeholder, game.id);
    assert.equal(card.includes("Placeholder"), game.placeholder, game.id);
    assert.ok(card.includes(getArcadeLaunchHref(game)!.replaceAll("&", "&amp;")), game.id);
    assert.equal(card.includes("Ready to play"), !game.placeholder && game.status === "playable", game.id);
  }
});

test("all practice cards and individual screens disclose their placeholder status", () => {
  const catalog = renderToStaticMarkup(createElement(ArcadePracticePage));
  for (const game of PRACTICE_GAMES) {
    const card = catalog.match(new RegExp('<li[^>]*data-game-id="' + game.id + '"[\\s\\S]*?</li>'))?.[0];
    assert.equal(Boolean(card?.includes(ARCADE_PLACEHOLDER_NOTE)), game.placeholder, game.id);
    assert.ok(card?.includes('/arcade/practice/' + game.id), game.id);
    const screen = renderToStaticMarkup(createElement(ArcadePracticeLab, { gameId: game.id }));
    assert.equal(screen.includes(ARCADE_PLACEHOLDER_NOTE), game.placeholder, game.id);
    if (game.placeholder) { assert.ok(screen.includes("Reset"), game.id); assert.ok(screen.includes("Exit"), game.id); }
    else { assert.ok(screen.includes(getFullArcadeGame(game.id)!.href), game.id); assert.ok(screen.includes("iframe"), game.id); assert.ok(screen.includes("Exit"), game.id); }
  }
});

test("each room-game setup discloses the note and non-arcade setup stays unchanged", () => {
  for (const game of ARCADE_GAMES) {
    const html = renderToStaticMarkup(createElement(RoomSetupForm, { initialGame: "arcade", initialArcadeGame: game.id }));
    assert.equal(html.includes(ARCADE_PLACEHOLDER_NOTE), game.placeholder, game.id);
  }
  const ordinary = renderToStaticMarkup(createElement(RoomSetupForm, { initialGame: "pictures" }));
  assert.equal(ordinary.includes(ARCADE_PLACEHOLDER_NOTE), false);
});
