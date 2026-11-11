import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("featured phone lobby keeps off-seat bot preferences through phone replacement and starts with zero bots", async ({ browser }, testInfo) => {
  const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
  const phones = await Promise.all([0, 1].map(() => browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })));
  await host.addInitScript(() => Object.defineProperty(document, "hidden", { configurable: true, get: () => false }));
  for (const phone of phones) await phone.addInitScript(() => Object.defineProperty(document, "hidden", { configurable: true, get: () => false }));
  try {
    const tv = await host.newPage();
    await tv.goto("/arcade-games/royal-sumo/");
    await expect.poll(() => tv.evaluate(() => Boolean(window.CallbackPhoneGame?.input))).toBe(true);
    await tv.getByRole("button", { name: "Phone players", exact: true }).click();
    const lobby = tv.getByRole("dialog", { name: "Bring your phones" });
    await lobby.getByRole("button", { name: "Create room" }).click();
    const code = lobby.locator(".cp-host-code");
    await expect(code).toHaveText(/[A-Z0-9]{4}/, { timeout: 10_000 });
    const roomCode = (await code.textContent())!.trim();

    const bot1 = lobby.getByRole("switch", { name: "Bot 1", exact: true });
    await expect(lobby.getByRole("switch")).toHaveCount(10);
    await expect(bot1).toHaveAttribute("aria-checked", "true");
    await expect(bot1).toContainText("On");
    await expect.poll(() => bot1.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(23, 100, 67)");
    await bot1.click();
    await expect(bot1).toHaveAttribute("aria-checked", "false");
    await expect(bot1).toContainText("Off");
    await expect.poll(() => bot1.evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(116, 47, 60)");
    const captures = testInfo.outputPath("screenshots");
    await mkdir(captures, { recursive: true });
    await tv.screenshot({ path: `${captures}/bot-switch-off.png`, fullPage: true });

    const phone1 = await phones[0]!.newPage();
    await phone1.goto(`/arcade-games/phone/controller.html?code=${roomCode}`);
    await phone1.getByLabel("Your name").fill("Replacement One");
    await phone1.getByRole("button", { name: "Join room" }).click();
    await expect(phone1.locator("#cp-play")).toBeVisible();
    await expect(lobby.locator(".cp-host-roster")).toContainText("Replacement One · Connected");
    await expect(lobby.getByRole("switch", { name: "Bot 1", exact: true })).toHaveCount(0);
    await phone1.screenshot({ path: `${captures}/phone-replacement-controller.png`, fullPage: true });
    await phone1.getByRole("button", { name: "Change room" }).click();
    await expect(lobby.locator(".cp-host-roster")).toContainText("1. Open seat");
    await expect(lobby.getByRole("switch", { name: "Bot 1", exact: true })).toHaveAttribute("aria-checked", "false");

    for (let seat = 1; seat < 10; seat += 1) {
      const toggle = lobby.getByRole("switch", { name: `Bot ${seat + 1}`, exact: true });
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
    }
    await expect(lobby.getByRole("button", { name: "Start match" })).toBeDisabled();

    await phone1.getByLabel("Your name").fill("Human One");
    await phone1.getByRole("button", { name: "Join room" }).click();
    await expect(lobby.locator(".cp-host-roster")).toContainText("Human One · Connected");
    await expect(lobby.getByRole("button", { name: "Start match" })).toBeDisabled();
    const phone2 = await phones[1]!.newPage();
    await phone2.goto(`/arcade-games/phone/controller.html?code=${roomCode}`);
    await phone2.getByLabel("Your name").fill("Human Two");
    await phone2.getByRole("button", { name: "Join room" }).click();
    await expect(lobby.locator(".cp-host-roster")).toContainText("Human Two · Connected");
    const start = lobby.getByRole("button", { name: "Start match" });
    await expect(start).toBeEnabled();
    await start.click();
    await expect.poll(() => tv.evaluate(() => Boolean(window.CallbackPhoneGame?.status().active))).toBe(true);
    await tv.getByRole("button", { name: new RegExp(`Phone room ${roomCode}`) }).click();
    await lobby.getByRole("button", { name: "End room" }).click();
    await expect(lobby.locator(".cp-host-room")).toBeHidden();
  } finally {
    await Promise.allSettled([host.close(), ...phones.map(phone => phone.close())]);
  }
});

declare global {
  interface Window { CallbackPhoneGame?: { status: () => { active?: boolean; phase?: string; paused?: boolean }; input: (seat: number, packet: { seq: number; x: number; y: number; buttons: number; plan?: { x: number; y: number; a: number; locked: boolean } }) => boolean } }
}
