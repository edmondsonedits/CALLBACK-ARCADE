import { expect, test, type Browser, type BrowserContext } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createHost(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "bowl-of-fools", contentMode: "party", timerAccessibility: false, foolHostName: "Host Player", foolScrollsPerPlayer: 1 } });
  expect(created.status(), await created.text()).toBe(201);
  return { host, code: (await created.json() as { code: string }).code };
}

test("Bowl phone host can fill all ten players, turn a bot off at capacity, and start", async ({ browser }) => {
  const { host, code } = await createHost(browser);
  try {
    const page = await host.newPage();
    await page.goto(`/play/${code}`);
    await expect(page.getByRole("heading", { name: /Your court is gathering/ })).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(9);
    for (let seat = 2; seat <= 10; seat += 1) {
      const toggle = page.getByRole("switch", { name: `Bot ${seat}`, exact: true });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
    }
    await expect(page.locator(".fool-player-count")).toContainText("10/10");
    const fullSeat = page.getByRole("switch", { name: "Bot 2", exact: true });
    await expect(fullSeat).toBeEnabled();
    await fullSeat.click();
    await expect(fullSeat).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(".fool-player-count")).toContainText("9/10");
    await page.getByRole("button", { name: "Shuffle teams" }).click();
    await expect(page.locator(".fool-team-grid")).toBeVisible();
    const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  } finally {
    await host.close();
  }
});

test("Bowl phone host hides human-occupied bot seats and guests cannot see bot controls", async ({ browser }) => {
  const { host, code } = await createHost(browser);
  const guest: BrowserContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
  try {
    const joined = await guest.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Guest Player" } });
    expect(joined.status(), await joined.text()).toBe(201);
    const hostPage = await host.newPage();
    const guestPage = await guest.newPage();
    await Promise.all([hostPage.goto(`/play/${code}`), guestPage.goto(`/play/${code}`)]);
    await expect(hostPage.getByRole("switch")).toHaveCount(8);
    await expect(hostPage.getByRole("switch", { name: "Bot 1", exact: true })).toHaveCount(0);
    await expect(hostPage.getByRole("switch", { name: "Bot 2", exact: true })).toHaveCount(0);
    await expect(hostPage.getByRole("switch", { name: "Bot 3", exact: true })).toBeVisible();
    await expect(guestPage.getByRole("switch")).toHaveCount(0);
    await expect(guestPage.getByText("Waiting for the host", { exact: false })).toBeVisible();
  } finally {
    await Promise.all([host.close(), guest.close()]);
  }
});
