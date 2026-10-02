import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const b = await chromium.launch();
const base = process.env.ARCADE_TEST_URL || "http://127.0.0.1:4194";
const host = await b.newPage({ viewport: { width: 1366, height: 768 } });
const phones = [];
const errors = [];
host.on("pageerror", (e) => errors.push(e.message));
try {
  await host.goto(`${base}/host.html?game=royal-ballistix`);
  await host.getByRole("button", { name: "Start game", exact: true }).waitFor();
  await host.waitForFunction(() => !document.querySelector("#start").disabled);
  const code = await host.locator("#code").textContent();
  for (let i = 0; i < 2; i++) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(`${base}/join.html?code=${code}`);
    await p.locator("#name").fill(`Tester ${i + 1}`);
    await p.locator("#join-button").click();
    await p.locator("#controls").waitFor({ state: "visible" });
    phones.push(p);
  }
  await host.locator("#start").click();
  await phones[0].waitForFunction(() =>
    document.querySelector("#phase").textContent.includes("you are playing"),
  );
  const game = host.frames().find((f) => f.url().includes("/games/"));
  await game.waitForFunction(
    () => RoyalBallistix.getState().phase === "fight",
    { timeout: 30000 },
  );
  const otherHost = await b.newPage();
  await otherHost.goto(`${base}/host.html?game=royal-ballistix`);
  await otherHost.waitForFunction(
    () => !document.querySelector("#start").disabled,
  );
  assert.notEqual(await otherHost.locator("#code").textContent(), code);
  assert.equal(
    (await otherHost.locator("#roster").textContent()).includes("Tester"),
    false,
  );
  const denied = await host.evaluate(
    (code) =>
      new Promise((resolve) => {
        const ws = new WebSocket(
          `${location.origin.replace("http", "ws")}/api/rooms/${code}/socket`,
        );
        ws.onopen = () =>
          ws.send(
            JSON.stringify({
              type: "auth",
              role: "controller",
              token: "0".repeat(64),
            }),
          );
        ws.onclose = (e) => resolve(e.code);
      }),
    code,
  );
  assert.equal(denied, 4003);
  await game.evaluate(() => {
    const original = RoyalBallistix.cancelPlayerInput;
    window.safeCancels = 0;
    RoyalBallistix.cancelPlayerInput = (id) => {
      window.safeCancels++;
      return original(id);
    };
  });
  const magnet = phones[0].getByRole("button", { name: "Magnet", exact: true });
  const mr = await magnet.boundingBox();
  await phones[0].mouse.move(mr.x + mr.width / 2, mr.y + mr.height / 2);
  await phones[0].mouse.down();
  await phones[0].waitForTimeout(100);
  await magnet.dispatchEvent("pointercancel", { pointerId: 1 });
  await game.waitForFunction(() => window.safeCancels > 0);
  assert.equal(
    await game.evaluate(() => RoyalBallistix.getState().players[1].magnet),
    false,
  );
  await phones[0].mouse.up();
  for (const [i, p] of phones.entries()) {
    const btn = p.getByRole("button", {
      name: i === 0 ? "Move left" : "Move right",
      exact: true,
    });
    const r = await btn.boundingBox();
    await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await p.mouse.down();
  }
  await host.waitForTimeout(350);
  const before = await game.evaluate(() => RoyalBallistix.getState());
  assert.equal(before.players[1].external, true);
  assert.equal(before.players[2].external, true);
  assert.equal(
    await otherHost
      .frames()
      .find((f) => f.url().includes("/games/"))
      .evaluate(() => RoyalBallistix.getState().players[1].external),
    false,
  );
  await otherHost.close();
  for (const p of phones) await p.mouse.up();
  await phones[0].close();
  await host.waitForTimeout(350);
  const after = await game.evaluate(() => RoyalBallistix.getState());
  assert.equal(after.players[1].external, false);
  assert.equal(after.players[2].external, true);
  const identity = await phones[1].locator("#identity").textContent();
  await phones[1].reload();
  await phones[1].locator("#controls").waitFor({ state: "visible" });
  assert.equal(await phones[1].locator("#identity").textContent(), identity);
  await host.reload();
  await host.waitForFunction(() =>
    document.querySelector("#phase").textContent.includes("Paused"),
  );
  assert.equal(await host.locator("#resume").isDisabled(), true);
  await host.locator("#restart").click();
  await host.waitForFunction(() => !document.querySelector("#start").disabled);
  await host.locator("#start").click();
  await phones[1].waitForFunction(() =>
    document.querySelector("#phase").textContent.includes("you are playing"),
  );
  const capacity = await host.evaluate(async (code) => {
    const statuses = [];
    for (let i = 0; i < 8; i++) {
      const r = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `Capacity ${i}` }),
      });
      statuses.push(r.status);
    }
    return statuses;
  }, code);
  assert.deepEqual(capacity, [201, 201, 201, 201, 201, 201, 201, 409]);
  await host.screenshot({ path: ".local/two-phone-host.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: two independent seats during fight, disconnect to bot, same-seat refresh, host restart recovery, nine-phone capacity",
  );
} finally {
  await b.close();
}
