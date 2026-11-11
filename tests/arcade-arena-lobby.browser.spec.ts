import { expect, test, type Browser } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

test("Arcade host lobby shows the chosen game instead of King Prompter setup settings", async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await context.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "arena-survivor", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { hostUrl } = await created.json() as { hostUrl: string };
  const hostPage = await context.newPage();
  try {
    await hostPage.goto(hostUrl);
    await expect(hostPage.getByText("KING PROMPTER ARCADE", { exact: true })).toBeVisible();
    await expect(hostPage.getByRole("heading", { name: "Arena Survivor", exact: true })).toBeVisible();
    await expect(hostPage.getByLabel("Game pack")).toHaveCount(0);
    await expect(hostPage.getByRole("button", { name: "Waiting for 3 players", exact: true })).toBeDisabled();
    await expect(hostPage.getByRole("alert")).toHaveCount(0);
  } finally { await context.close(); }
});

test("solo Drift Racer gets an Arcade-only title screen and an enabled Start Game button", async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await context.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "drift-racer", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { hostUrl, code } = await created.json() as { hostUrl: string; code: string };
  const joined = await context.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Solo Driver" } });
  expect(joined.status(), await joined.text()).toBe(201);
  const hostPage = await context.newPage();
  try {
    await hostPage.goto(hostUrl);
    await expect(hostPage.getByRole("heading", { name: "Drift Racer", exact: true })).toBeVisible();
    await expect(hostPage.getByRole("button", { name: "Start Game", exact: true })).toBeEnabled();
    await expect(hostPage.getByLabel("Game pack")).toHaveCount(0);
    await expect(hostPage.getByLabel("Image generator")).toHaveCount(0);
    await expect(hostPage.getByLabel("Content")).toHaveCount(0);
    await expect(hostPage.getByText(/needs 2 players|invite 1 more/i)).toHaveCount(0);
  } finally { await context.close(); }
});

test("Arcade room setup is separate from party game and image settings", async ({ page }) => {
  await page.goto("/host/new?gameLength=arcade&arcadeGameId=drift-racer");
  await expect(page.getByRole("heading", { name: "Drift Racer", exact: true })).toBeVisible();
  await expect(page.getByLabel("Game pack")).toHaveCount(0);
  await expect(page.getByLabel("Image generator")).toHaveCount(0);
  await expect(page.getByLabel("Content")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create Arcade room", exact: true })).toBeEnabled();
});

test("lobby player names sit below the full avatar", async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await context.request.post("/api/rooms", { headers, data: { gameLength: "standard", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { hostUrl, code } = await created.json() as { hostUrl: string; code: string };
  const joined = await context.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Solo Driver" } });
  expect(joined.status(), await joined.text()).toBe(201);
  const hostPage = await context.newPage();
  try {
    await hostPage.goto(hostUrl);
    const card = hostPage.locator(".roster-player").filter({ hasText: "Solo Driver" });
    const avatar = await card.locator(".callback-avatar").boundingBox();
    const name = await card.locator("strong").boundingBox();
    expect(avatar).not.toBeNull(); expect(name).not.toBeNull();
    expect(name!.y).toBeGreaterThanOrEqual(avatar!.y + avatar!.height + 3);
  } finally { await context.close(); }
});
