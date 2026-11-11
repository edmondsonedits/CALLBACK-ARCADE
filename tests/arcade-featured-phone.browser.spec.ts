import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { ACTIVE_FULL_ARCADE_GAMES } from "../lib/arcade/full-games";

declare global {
  interface Window {
    CallbackPhoneGame?: {
      status: () => { active?: boolean; phase?: string; paused?: boolean };
      input: (seat: number, packet: { seq: number; x: number; y: number; buttons: number; plan?: { x: number; y: number; a: number; locked: boolean } }) => boolean;
    };
    __arcadeQaAcceptedPhoneInputs?: number;
    __arcadeQaPhoneInputAttempts?: number;
    __arcadeQaLastPhoneInputResult?: boolean;
    __arcadeQaPhoneStatus?: { active?: boolean; phase?: string; paused?: boolean };
    __arcadeQaAcceptedDirectionalInputs?: number;
  }
}

const phoneGames = ACTIVE_FULL_ARCADE_GAMES.filter(game => game.phoneRooms);

async function makePhone(browser: Browser, baseURL: string): Promise<BrowserContext> {
  return browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
}

async function openPhoneLobby(page: Page) {
  await page.getByRole("button", { name: "Phone players", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Bring your phones" });
  await expect(dialog.getByRole("button", { name: "Create room" })).toBeVisible();
  await dialog.getByRole("button", { name: "Create room" }).click();
  await expect(dialog.locator(".cp-host-code")).toHaveText(/[A-Z0-9]{4}/, { timeout: 10_000 });
  return dialog;
}

for (const game of phoneGames) {
  test(`${game.title} connects two phones, accepts a game input, reconnects, and closes`, async ({ browser }, testInfo) => {
    const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
    const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
    const phones = await Promise.all([makePhone(browser, baseURL), makePhone(browser, baseURL)]);
    // These contexts represent separate physical devices. Keep each virtual
    // device visible while Playwright switches between its pages.
    await host.addInitScript(() => Object.defineProperty(document, "hidden", { configurable: true, get: () => false }));
    for (const phone of phones) await phone.addInitScript(() => Object.defineProperty(document, "hidden", { configurable: true, get: () => false }));
    const hostPage = await host.newPage();
    const phonePages = await Promise.all(phones.map(context => context.newPage()));
    const browserErrors: string[] = [];
    hostPage.on("pageerror", error => browserErrors.push(error.message));
    for (const phone of phonePages) phone.on("pageerror", error => browserErrors.push(error.message));

    try {
      const response = await hostPage.goto(game.href);
      expect(response?.status(), `${game.id} host package`).toBe(200);
      await expect(hostPage.getByRole("button", { name: "Phone players", exact: true })).toBeVisible();
      await expect.poll(() => hostPage.evaluate(() => Boolean(window.CallbackPhoneGame?.input))).toBe(true);

      await hostPage.evaluate(() => {
        const adapter = window.CallbackPhoneGame!;
        const input = adapter.input.bind(adapter);
        window.__arcadeQaAcceptedPhoneInputs = 0;
        window.__arcadeQaPhoneInputAttempts = 0;
        window.__arcadeQaAcceptedDirectionalInputs = 0;
        adapter.input = (seat, packet) => {
          const accepted = input(seat, packet);
          window.__arcadeQaPhoneInputAttempts! += 1;
          window.__arcadeQaLastPhoneInputResult = accepted;
          window.__arcadeQaPhoneStatus = adapter.status();
          if (accepted !== false) {
            window.__arcadeQaAcceptedPhoneInputs! += 1;
            if (Math.abs(packet.x) >= 0.2 || Math.abs(packet.y) >= 0.2) window.__arcadeQaAcceptedDirectionalInputs! += 1;
          }
          return accepted;
        };
      });

      const dialog = await openPhoneLobby(hostPage);
      const code = (await dialog.locator(".cp-host-code").textContent())!.trim();
      const joinHref = await dialog.locator(".cp-host-url").getAttribute("href");
      expect(joinHref).toContain(`/arcade-games/phone/controller.html?code=${code}`);

      for (let index = 0; index < phonePages.length; index += 1) {
        const phone = phonePages[index]!;
        const joined = await phone.goto(joinHref!);
        expect(joined?.status(), `${game.id} phone route`).toBe(200);
        await phone.getByLabel("Your name").fill(index === 0 ? "Phone One" : "Phone Two");
        await phone.getByRole("button", { name: "Join room" }).click();
        await expect(phone.locator("#cp-play")).toBeVisible({ timeout: 10_000 });
        await expect(phone.locator("#cp-status")).toContainText("Paused on TV");
        await expect(phone.locator("#cp-identity")).toContainText(index === 0 ? "Phone One" : "Phone Two");
      }
      await expect(dialog.locator(".cp-host-roster")).toContainText("Phone One · Connected");
      await expect(dialog.locator(".cp-host-roster")).toContainText("Phone Two · Connected");
      await expect(dialog.getByRole("button", { name: "Start match" })).toBeEnabled();
      await dialog.getByRole("button", { name: "Start match" }).click();
      await expect(dialog).toBeHidden();
      await expect.poll(() => hostPage.evaluate(() => Boolean(window.CallbackPhoneGame?.status().active))).toBe(true);
      if (["royal-sumo", "royal-roller-ruckus", "royal-twisted"].includes(game.id)) {
        await expect.poll(() => hostPage.evaluate(() => window.CallbackPhoneGame?.status().phase), { timeout: game.id === "royal-roller-ruckus" ? 30_000 : 15_000 }).not.toBe("countdown");
      }

      const phone = phonePages[0]!;
      await expect(phone.locator("#cp-status")).toContainText("Connected", { timeout: 10_000 });
      if (game.id === "blind-crown") {
        await expect(phone.locator("#cp-plan-controls")).toBeVisible();
        await expect(phone.getByRole("button", { name: "Lock plan" })).toBeEnabled();
        await phone.locator("#cp-plan-x").evaluate((element: HTMLInputElement) => {
          element.value = "0.62";
          element.dispatchEvent(new Event("input", { bubbles: true }));
        });
        await phone.getByRole("button", { name: "Lock plan" }).click();
      } else if (game.id === "royal-roller-ruckus") {
        const stick = phone.locator("#cp-stick");
        await expect(stick).toBeVisible();
        await expect(stick).toHaveAttribute("aria-disabled", "false");
        await phone.bringToFront();
        const beforeDirectionalInputs = await hostPage.evaluate(() => window.__arcadeQaAcceptedDirectionalInputs ?? 0);
        const bounds = await stick.boundingBox();
        expect(bounds).not.toBeNull();
        await phone.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
        await phone.mouse.down();
        await phone.mouse.move(bounds!.x + bounds!.width * 0.8, bounds!.y + bounds!.height / 2, { steps: 4 });
        await phone.waitForTimeout(250);
        try {
          await expect.poll(() => hostPage.evaluate(() => window.__arcadeQaAcceptedDirectionalInputs ?? 0), { timeout: 10_000 }).toBeGreaterThan(beforeDirectionalInputs);
        } catch (error) {
          const hostDetail = await hostPage.evaluate(() => ({ attempts: window.__arcadeQaPhoneInputAttempts, accepted: window.__arcadeQaAcceptedPhoneInputs, result: window.__arcadeQaLastPhoneInputResult, status: window.__arcadeQaPhoneStatus, directional: window.__arcadeQaAcceptedDirectionalInputs }));
          const phoneDetail = await phone.evaluate(() => ({ status: document.querySelector("#cp-status")?.textContent, enabled: document.querySelector("#cp-stick")?.getAttribute("aria-disabled"), focus: document.activeElement?.id }));
          throw new Error(`${error instanceof Error ? error.message : error}; host input diagnostics=${JSON.stringify(hostDetail)}; phone input diagnostics=${JSON.stringify(phoneDetail)}`);
        }
        await phone.mouse.up();
        await phone.keyboard.down("ArrowRight");
        await phone.waitForTimeout(120);
        await phone.keyboard.up("ArrowRight");
      } else {
        const action = phone.locator(".cp-controller-action").first();
        await expect(action).toBeEnabled();
        const bounds = await action.boundingBox();
        expect(bounds).not.toBeNull();
        await phone.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
        await phone.mouse.down();
        await phone.waitForTimeout(120);
        await phone.mouse.up();
      }
      try {
        await expect.poll(() => hostPage.evaluate(() => window.__arcadeQaAcceptedPhoneInputs ?? 0), { timeout: 10_000 }).toBeGreaterThan(0);
      } catch (error) {
        const hostDetail = await hostPage.evaluate(() => ({ attempts: window.__arcadeQaPhoneInputAttempts, accepted: window.__arcadeQaAcceptedPhoneInputs, result: window.__arcadeQaLastPhoneInputResult, status: window.__arcadeQaPhoneStatus, visible: !document.hidden }));
        const phoneDetail = await phone.evaluate(() => ({ status: document.querySelector("#cp-status")?.textContent, enabled: document.querySelector("#cp-stick")?.getAttribute("aria-disabled"), focus: document.activeElement?.id }));
        throw new Error(`${error instanceof Error ? error.message : error}; host input diagnostics=${JSON.stringify(hostDetail)}; phone input diagnostics=${JSON.stringify(phoneDetail)}`);
      }

      const screenshots = testInfo.outputPath("screenshots");
      await mkdir(screenshots, { recursive: true });
      await phone.screenshot({ path: `${screenshots}/${game.id}-connected-phone.png`, fullPage: true });

      await phone.reload();
      await expect(phone.locator("#cp-play")).toBeVisible({ timeout: 10_000 });
      await expect(phone.locator("#cp-status")).toContainText("Connected", { timeout: 10_000 });
      await expect(dialog).toBeHidden();

      await hostPage.getByRole("button", { name: new RegExp(`Phone room ${code}, 2 connected`) }).click();
      const reopened = hostPage.getByRole("dialog", { name: "Bring your phones" });
      await expect(reopened.locator(".cp-host-roster")).toContainText("Phone One · Connected");
      await expect(reopened.getByRole("button", { name: "End room" })).toBeEnabled();
      await reopened.getByRole("button", { name: "End room" }).click();
      await expect(reopened.locator(".cp-host-room")).toBeHidden();
      await expect(hostPage.getByRole("button", { name: "Phone players", exact: true })).toBeVisible();
      expect(browserErrors, `${game.id} browser errors`).toEqual([]);
    } finally {
      await Promise.all([host.close(), ...phones.map(context => context.close())]);
    }
  });
}
