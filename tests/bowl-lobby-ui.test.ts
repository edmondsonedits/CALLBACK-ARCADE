import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyHostAction, createRoomState } from "../server/engine";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";
import { rebalanceBowlTeams } from "../server/bowl";
import type { GameLength, HostAction } from "../lib/contracts";

// Use the Site's actual Next compatibility shims; CSS does not affect SSR semantics.
const shims = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === "next/link" ? "vinext/shims/link" : specifier === "next/image" ? "vinext/shims/image" : specifier, context);
  },
  load(url, context, nextLoad) {
    return url.endsWith(".css") ? { format: "module", source: "export default {}", shortCircuit: true } : nextLoad(url, context);
  },
});
const { HostLobby } = await import("../app/host/[code]/page");
const { BowlResults } = await import("../app/components/BowlOfFools");
const { FinalPhoneResults } = await import("../app/play/[code]/page");
shims.deregister();

function room(gameLength: GameLength, count = 0) {
  const state = createRoomState("B4CK", { gameLength, contentMode: "party", timerAccessibility: false }, 1000);
  state.participants = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, nickname: `Player ${i}`, nicknameNormalized: `player ${i}`, role: "player" as const, seat: i, avatar: i, color: "#46dbdc", active: true, pendingActivation: false, bot: false, lastSeenAt: 1000, removedAt: null }));
  if (gameLength === "bowl") rebalanceBowlTeams(state);
  else state.foolTeams = Object.fromEntries(state.participants.map((p, i) => [p.id, i % 2 ? "MOTLEY" : "BELLS"]));
  return state;
}
function render(state: ReturnType<typeof room>, display = false) {
  return renderToStaticMarkup(createElement(HostLobby, { snapshot: hostSnapshot(state, 1000), display, act: async () => {}, startGame: () => {} }));
}

for (const game of ["bowl", "bowl-of-fools"] as const) {
  test(`${game} lobby selects its actual pack and keeps image generation out`, () => {
    const html = render(room(game));
    assert.match(html, game === "bowl"
      ? /<option value="bowl" disabled="" selected="">/
      : new RegExp(`<option value="${game}" selected="">`));
    assert.doesNotMatch(html, /Image generator|image settings|Comics use FLUX/);
    if (game === "bowl") assert.doesNotMatch(html, /role="switch" aria-label="Bot/);
    else assert.match(html, /role="switch" aria-label="Bot 1"/);
    if (game === "bowl") {
      assert.match(html, /Bowl of Fools Classic · archived existing room/);
      assert.match(html, /This archived room can continue its current game\. New games from archived packs are unavailable\./);
    }
  });
  test(`${game} lobby explains four-player requirement and keeps start disabled`, () => {
    const html = render(room(game, 1));
    assert.match(html, /class="button button-primary start-button" disabled=""/);
    if (game === "bowl") assert.match(html, /This archived room can finish its current game, but cannot start another one\./);
    else {
      assert.match(html, /four players total|at least two active players/);
      assert.match(html, /Local bots count/);
      assert.match(html, /role="switch" aria-label="Bot 1"/);
    }
  });
  test(`${game} lobby explains unbalanced teams even with four players`, () => {
    const state = room(game, 4);
    if (game === "bowl") state.bowl!.teams.p1 = "bells";
    else state.foolTeams.p1 = "BELLS";
    const html = render(state);
    assert.match(html, /class="button button-primary start-button" disabled=""/);
    if (game === "bowl") assert.match(html, /archived room can finish its current game/);
    else assert.match(html, /at least two active players on each team/);
  });
  test(`${game} lobby enables a valid four-player team split and keeps mirror read-only`, () => {
    const state = room(game, 4);
    const html = render(state);
    if (game === "bowl") {
      assert.match(html, /class="button button-primary start-button" disabled=""/);
      assert.match(html, /<option value="standard">Legacy Standard/);
      assert.match(html, /archived room can finish its current game/);
    } else {
      assert.doesNotMatch(html, /class="button button-primary start-button" disabled/);
      assert.doesNotMatch(html, /4–10 humans/);
    }
    assert.doesNotMatch(render(state, true), /Start the game|Add bot|Image generator|<select/);
  });
  if (game === "bowl") test(`${game} lobby does not count inactive seats toward a team's minimum`, () => {
    const state = room(game, 5);
    state.participants[1].active = false;
    const html = render(state);
    assert.match(html, /archived room can finish its current game/);
    assert.match(html, /class="button button-primary start-button" disabled=""/);
  });
}
test("Bowl of Fools counts bot seats toward its four-player start minimum", () => {
  const state = room("bowl-of-fools", 4);
  state.participants[0]!.bot = true;
  state.participants[2]!.bot = true;
  const html = render(state);
  assert.doesNotMatch(html, /class="button button-primary start-button" disabled/);
  assert.match(html, /4\/10 players/);
  assert.match(html, /role="switch" aria-label="Bot 1"/);
});
test("Bowl phone bot-seat preferences are disclosed only to the host player", () => {
  const state = room("bowl-of-fools", 2);
  state.foolHostPlayerId = "p0";
  state.botSeats = [4];
  const host = playerSnapshot(state, state.participants[0]!, 1000);
  const guest = playerSnapshot(state, state.participants[1]!, 1000);
  assert.deepEqual(host.botSeats, [4]);
  assert.equal("botSeats" in guest, false);
});
test("Classic keeps start disabled when inherited bots remain, even with four humans", () => {
  const state = room("bowl", 5);
  state.participants[4].bot = true;
  const html = render(state);
  assert.match(html, /class="button button-primary start-button" disabled=""/);
  assert.match(html, /This archived room can finish its current game, but cannot start another one\./);
});
test("archived Classic lobby preserves seats and permits switching to a retained game", () => {
  const action = (state: ReturnType<typeof room>, type: HostAction["type"], payload: Record<string, unknown>) => applyHostAction(state, { type, actionId: crypto.randomUUID(), roundId: state.currentRound?.id ?? "lobby", expectedPhase: state.phase, payload } as HostAction, 1100).next;
  let state = action(room("standard", 4), "ADD_BOT", {});
  const bot = state.participants.find((player) => player.bot)!;
  state = action(state, "SET_CONFIG", { gameLength: "bowl" });
  assert.equal(state.participants.length, 5);
  assert.equal(state.participants.find((player) => player.id === bot.id)?.bot, true);
  assert.deepEqual(state.bowl!.teams, { p0: "bells", p1: "motley", p2: "bells", p3: "motley" });
  for (let i = 0; i < 4; i += 1) assert.ok(render(state).includes(`Player ${i}`));
  assert.match(render(state), /archived room can finish its current game/);
  assert.match(render(state), /<option value="standard">Legacy Standard/);
  state = action(state, "SET_CONFIG", { gameLength: "standard" });
  assert.equal(state.participants.length, 5);
  assert.match(render(state), /role="switch" aria-label="Bot/);
  assert.match(render(state), /Image generator/);
  assert.doesNotThrow(() => action(state, "START_GAME", {}));
});
test("archived Classic lobby remains unavailable at any roster size", () => {
  const html = render(room("bowl", 11));
  assert.match(html, /class="button button-primary start-button" disabled=""/);
  assert.match(html, /This archived room can finish its current game, but cannot start another one\./);
});
test("archived Classic results explain that replay is unavailable", () => {
  const state = room("bowl", 4);
  state.phase = "FINAL_RESULTS";
  state.bowl!.winnerTeam = "bells";
  const html = renderToStaticMarkup(createElement(BowlResults, { snapshot: hostSnapshot(state, 1000) }));
  assert.match(html, /This archived pack cannot be replayed/);
  assert.doesNotMatch(html, /Play Again|href="\/host\/new\?game=bowl"/);
  assert.match(html, /href="\/host\/new"/);
});
test("active Fool Bowl phone results offer refill only to the host player", () => {
  const state = createRoomState("F00L", { gameLength: "bowl-of-fools", contentMode: "party", timerAccessibility: false }, 1000);
  state.phase = "FINAL_RESULTS";
  state.participants = [0, 1].map((i) => ({ id: `p${i}`, nickname: `Player ${i}`, nicknameNormalized: `player ${i}`, role: "player" as const, seat: i, avatar: i, color: "#46dbdc", active: true, pendingActivation: false, bot: false, lastSeenAt: 1000, removedAt: null }));
  state.foolHostPlayerId = "p0";
  const hostSnapshotForPhone = playerSnapshot(state, state.participants[0], 1000);
  const playerSnapshotForPhone = playerSnapshot(state, state.participants[1], 1000);
  const hostHtml = renderToStaticMarkup(createElement(FinalPhoneResults, { snapshot: hostSnapshotForPhone, hostAct: async () => {} }));
  const playerHtml = renderToStaticMarkup(createElement(FinalPhoneResults, { snapshot: playerSnapshotForPhone, hostAct: async () => {} }));
  assert.match(hostHtml, /Refill the bowl/);
  assert.doesNotMatch(playerHtml, /Refill the bowl|Play again/);
});
test("ordinary party lobby retains bot and image settings", () => {
  const html = render(room("pictures", 2));
  assert.match(html, /role="switch" aria-label="Bot 1"/);
  assert.match(html, /Image generator/);
});
