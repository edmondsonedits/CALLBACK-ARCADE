import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.ARCADE_TEST_URL || "http://127.0.0.1:4194";
const browser = await chromium.launch({
  args: [
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const failures = [];
const results = [];
try {
  for (const id of [
    "royal-ballistix",
    "royal-twisted",
    "royal-scratch-match",
    "space-bash",
    "royal-roller-ruckus",
    "royal-sumo",
  ]) {
    const host = await browser.newPage({
      viewport: { width: 1366, height: 768 },
    });
    const phone = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    for (const p of [host, phone])
      p.on("pageerror", (e) => failures.push({ id, error: e.message }));
    await host.goto(`${base}/host.html?game=${id}`);
    await host.waitForFunction(
      () =>
        document.querySelector("#code").textContent.length === 6 &&
        !document.querySelector("#start").disabled,
      { timeout: 30000 },
    );
    const code = await host.locator("#code").textContent();
    await phone.goto(`${base}/join.html?code=${code}`);
    await phone.locator("#name").fill("Phone One");
    await phone.locator("#join-button").click();
    await phone.locator("#controls").waitFor({ state: "visible" });
    await host.waitForFunction(() =>
      document
        .querySelector("#roster")
        .textContent.includes("Phone One · Connected"),
    );
    await host.locator("#start").click();
    await phone.waitForFunction(() =>
      document.querySelector("#phase").textContent.includes("you are playing"),
    );
    const runningGame = host.frames().find((f) => f.url().includes("/games/"));
    await runningGame.waitForFunction(
      (id) => {
        if (id === "royal-roller-ruckus")
          return document
            .querySelector("#countdown")
            ?.classList.contains("hidden");
        const api =
          id === "royal-ballistix"
            ? RoyalBallistix
            : id === "royal-twisted"
              ? RoyalTwisted
              : id === "royal-scratch-match"
                ? ScratchMatchAPI
                : id === "space-bash"
                  ? SpaceBash
                  : RoyalSumo;
        return id === "royal-scratch-match"
          ? api.getState().phase === "response"
          : api.getState().phase === "fight";
      },
      id,
      { timeout: 60000 },
    );
    const action = phone.locator("#actions button").first();
    if (await action.count()) {
      const r = await action.boundingBox();
      await phone.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await phone.mouse.down();
      await phone.waitForTimeout(180);
      await phone.mouse.up();
    } else {
      const b = phone.getByRole("button", { name: "Move right" });
      const r = await b.boundingBox();
      await phone.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await phone.mouse.down();
      await phone.waitForTimeout(300);
      await phone.mouse.up();
    }
    await host.waitForTimeout(300);
    const state = await host
      .frames()
      .find((f) => f.url().includes("/games/"))
      .evaluate(
        (id) =>
          id === "royal-ballistix"
            ? RoyalBallistix.getState()
            : id === "royal-twisted"
              ? RoyalTwisted.getState()
              : id === "royal-scratch-match"
                ? ScratchMatchAPI.getState()
                : id === "space-bash"
                  ? SpaceBash.getState()
                  : id === "royal-roller-ruckus"
                    ? {
                        controllers: CallbackInput.getControllers(),
                        playerCount: CallbackInput.getPlayerCount(),
                      }
                    : RoyalSumo.getState(),
        id,
      );
    if (id === "royal-ballistix") {
      assert.equal(state.playerCount, 10);
      assert.equal(state.players[1].external, true);
    }
    if (id === "royal-twisted") {
      assert.equal(state.players, 10);
      assert.equal(state.controllers[1], "remote");
    }
    if (id === "royal-scratch-match") {
      assert.equal(state.playerCount, 10);
      assert.ok(state.humanPlayers.includes(1));
      assert.equal(state.players[1].human, true);
      assert.ok(state.controllerInputs > 0);
    }
    if (id === "space-bash") {
      assert.equal(state.playerCount, 10);
      assert.equal(state.controllers[1].human, true);
    }
    if (id === "royal-roller-ruckus") {
      assert.equal(state.playerCount, 10);
      assert.equal(state.controllers[1].source, "network");
    }
    if (id === "royal-sumo") {
      assert.equal(state.multiplayer.fighterCount, 10);
      assert.ok(state.multiplayer.humanSlots.includes(1));
    }
    await host.locator("#pause").click();
    await phone.waitForFunction(() =>
      document.querySelector("#phase").textContent.includes("Paused"),
    );
    assert.equal(await phone.locator("#actions button:enabled").count(), 0);
    await host.locator("#resume").click();
    await phone.waitForFunction(() =>
      document.querySelector("#phase").textContent.includes("you are playing"),
    );
    const identity = await phone.locator("#identity").textContent();
    await phone.reload();
    await phone.locator("#controls").waitFor({ state: "visible" });
    assert.equal(await phone.locator("#identity").textContent(), identity);
    const layout = await phone.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      touchTargets: [...document.querySelectorAll("#controls button")].every(
        (b) => b.getBoundingClientRect().height >= 44,
      ),
    }));
    assert.equal(layout.overflow, false);
    assert.equal(layout.touchTargets, true);
    await phone.screenshot({ path: `.local/room-${id}-phone.png` });
    await host.screenshot({ path: `.local/room-${id}-host.png` });
    results.push({
      id,
      phase: state.phase,
      playerCount: state.playerCount || state.players?.length,
      controllers: state.controllers || state.humanPlayers,
      layout,
    });
    console.log(JSON.stringify(results.at(-1)));
    await phone.close();
    await host.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(failures, []);
console.log("SIX REAL ROOM FLOWS PASSED");
