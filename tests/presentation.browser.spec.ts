/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };

type Pack = "standard" | "pictures" | "comic" | "king-mystery" | "royal-rumours" | "bowl-of-fools";

async function createStartedRoom(browser: Browser, gameLength: Pack) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const create = await host.request.post("/api/rooms", {
    headers,
    data: {
      gameLength,
      contentMode: "party",
      timerAccessibility: false,
      ...(gameLength === "bowl-of-fools" ? { foolHostName: "Host Player", foolScrollsPerPlayer: 1, foolVoiceEnabled: false } : {}),
    },
  });
  expect(create.status(), await create.text()).toBe(201);
  const { code } = await create.json() as { code: string };
  const players: BrowserContext[] = [];
  const count = gameLength === "bowl-of-fools" ? 3 : 3;
  for (let index = 0; index < count; index += 1) {
    const player = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
    const joined = await player.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: `Player ${index + 1}` } });
    expect(joined.status(), await joined.text()).toBe(201);
    players.push(player);
  }
  const synced = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
  expect(synced.status()).toBe(200);
  const snapshot = await synced.json() as any;
  const started = await host.request.post(`/api/rooms/${code}/host-actions`, {
    headers,
    data: { type: "START_GAME", actionId: crypto.randomUUID(), roundId: snapshot.roundId, expectedPhase: snapshot.phase, payload: {} },
  });
  expect(started.status(), `${gameLength}: ${await started.text()}`).toBe(200);
  return { host, players, code };
}

test("every shipped pack enters its own no-scroll castle room", async ({ browser }) => {
  test.setTimeout(150_000);
  const matrix: Array<[Pack, string]> = [
    ["standard", "hall-of-echoes"], ["pictures", "prompt-foundry"], ["comic", "scriptorium"],
    ["king-mystery", "evidence-vault"], ["royal-rumours", "rumour-press"],
  ];
  for (const [pack, room] of matrix) {
    const { host, players, code } = await createStartedRoom(browser, pack);
    const page = await host.newPage();
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`/host/${code}`);
    await expect(page.locator(`[data-castle-room="${room}"]`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(errors).toEqual([]);
    await Promise.all(players.map((player) => player.close()));
    await host.close();
  }
});

test("reduced motion keeps the live stage while removing travel and ambient loops", async ({ browser }) => {
  const { host, players, code } = await createStartedRoom(browser, "standard");
  const page = await host.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/host/${code}`);
  await expect(page.locator('[data-castle-room="hall-of-echoes"]')).toBeVisible();
  expect(await page.locator(".castle-room-backdrop").evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  expect(await page.locator(".castle-room-ambient i").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  expect(await page.locator(".pigeon-host").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await Promise.all(players.map((player) => player.close()));
  await host.close();
});

test("Arcade catalog is reachable, keyboard accessible, and responsive", async ({ page }) => {
  await page.goto("/?menu=1");
  const arcadeLink = page.getByRole("link", { name: "Arcade" });
  await expect(arcadeLink).toBeVisible();
  await arcadeLink.focus();
  await expect(arcadeLink).toBeFocused();
  expect(await arcadeLink.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/arcade$/);
  await expect(page.getByRole("heading", { name: "The Arcade", level: 1 })).toBeVisible();
  await expect(page.locator(".arcade-card h2")).toHaveCount(18);
  const playable = page.getByRole("list", { name: "Party-room arcade games" }).locator(".arcade-card a");
  await expect(playable).toHaveCount(18);
  await expect(page.getByRole("link", { name: /Schaetzorama/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=schaetzorama");
  await expect(page.getByRole("link", { name: /Imposter/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=imposter");
  await expect(page.getByRole("link", { name: /Buzzwort/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=buzzwort");
  await expect(page.getByRole("link", { name: /Pantomime/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=pantomime");
  await expect(page.getByRole("link", { name: /Zeichnen & Erraten/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=zeichnen-und-erraten");
  await expect(page.getByRole("link", { name: /Arena Survivor/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=arena-survivor");
  await expect(page.getByRole("link", { name: /Air Hockey/ })).toHaveAttribute("href", "/arcade/online/new?game=air-hockey");
  await expect(page.getByRole("link", { name: /Light Trails/ })).toHaveAttribute("href", "/arcade/online/new?game=light-trails");
  await expect(page.getByRole("link", { name: /Tap Race/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Chaos-Kommando/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=chaos-kommando");
  await expect(page.getByRole("link", { name: /Magic Arena/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=magic-arena");
  await expect(page.getByRole("link", { name: /Kartentisch/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=kartentisch");
  await expect(page.getByRole("link", { name: /Dungeon Party/ })).toHaveAttribute("href", "/host/new?gameLength=arcade&arcadeGameId=dungeon-party");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".arcade-card").first()).toBeVisible();
});
