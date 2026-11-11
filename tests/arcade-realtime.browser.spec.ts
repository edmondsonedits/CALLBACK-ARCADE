import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const testHeaders = { Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };
type RealtimeGame = "air-hockey" | "tap-race" | "light-trails";

async function createMatch(browser: Browser, gameId: RealtimeGame) {
  const options = { baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: testHeaders };
  const host = await browser.newContext(options);
  const phones: BrowserContext[] = [];
  const created = await host.request.post("/api/arcade/online/rooms", { data: { gameId, options: {} } });
  expect(created.status(), await created.text()).toBe(201);
  const room = await created.json() as { code: string; hostUrl: string };
  for (let index = 0; index < 2; index++) phones.push(await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: testHeaders,
  }));
  return { host, phones, code: room.code, hostUrl: room.hostUrl };
}

async function joinPhone(page: Page, code: string, nickname: string) {
  await page.goto(`/arcade/online/join/${code}`);
  await page.getByLabel("Your name").fill(nickname);
  await page.getByRole("button", { name: "Join game", exact: true }).click();
  await expect(page.getByText("Waiting for the host", { exact: false })).toBeVisible();
}

async function readRoom(host: BrowserContext, code: string) {
  const response = await host.request.get(`/api/arcade/online/rooms/${code}`);
  expect(response.status()).toBe(200);
  return await response.json() as {
    status: "LOBBY" | "PLAYING" | "RESULT";
    round: number;
    lastResult: { winners: string[]; scores: Record<string, number>; reason?: string } | null;
    game: { view?: { snapshot?: { tick?: number } } } | null;
  };
}

async function waitForResult(host: BrowserContext, code: string) {
  await expect.poll(async () => (await readRoom(host, code)).status, {
    intervals: [750],
    timeout: 130_000,
    message: `${code} should reach a server-recorded terminal round result`,
  }).toBe("RESULT");
  const room = await readRoom(host, code);
  expect(room.lastResult).not.toBeNull();
  expect(room.lastResult!.winners).toEqual(expect.any(Array));
  expect(room.lastResult!.scores).toBeTruthy();
  return room;
}

async function openRoom(browser: Browser, gameId: RealtimeGame) {
  const { host, phones, code, hostUrl } = await createMatch(browser, gameId);
  const hostPage = await host.newPage();
  const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  await hostPage.goto(hostUrl);
  await joinPhone(phonePages[0]!, code, "Alex");
  await joinPhone(phonePages[1]!, code, "Sam");
  await expect(hostPage.getByText("Alex", { exact: true })).toBeVisible();
  await expect(hostPage.getByText("Sam", { exact: true })).toBeVisible();
  await hostPage.getByRole("button", { name: "Start match", exact: true }).click();
  await expect(hostPage.locator(".online-host")).toHaveClass(/is-playing/);
  await expect(phonePages[0]!.getByText(/Connected ·/)).toBeVisible();
  await expect(phonePages[1]!.getByText(/Connected ·/)).toBeVisible();
  return { host, phones, hostPage, phonePages, code };
}

async function dragStick(page: Page, button: ReturnType<Page["getByRole"]>, right: boolean) {
  await expect(button).toBeEnabled();
  const bounds = await button.boundingBox();
  expect(bounds).not.toBeNull();
  const acceptedInput = page.waitForResponse((response) => response.url().includes("/input") && response.status() === 200);
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * (right ? 0.8 : 0.2), bounds!.y + bounds!.height / 2, { steps: 4 });
  await acceptedInput;
  await page.mouse.up();
}

test("Air Hockey accepts phone movement, reaches a recorded result, and replays in the same room", async ({ browser }) => {
  test.setTimeout(160_000);
  const { host, phones, hostPage, phonePages, code } = await openRoom(browser, "air-hockey");
  try {
    await expect(hostPage.getByRole("img", { name: "Online team Air Hockey" })).toBeVisible();
    const phone = phonePages[0]!;
    await phone.bringToFront();
    const tickBefore = (await readRoom(host, code)).game?.view?.snapshot?.tick ?? 0;
    await dragStick(phone, phone.getByRole("button", { name: "Move your contestant", exact: true }), true);
    await expect.poll(async () => (await readRoom(host, code)).game?.view?.snapshot?.tick ?? 0, { timeout: 8_000 }).toBeGreaterThan(tickBefore);
    await phone.reload();
    await expect(phone.getByText(/Connected ·/)).toBeVisible();
    await hostPage.bringToFront();
    const result = await waitForResult(host, code);
    await expect(hostPage.getByRole("heading", { name: /won|drawn|time limit/i })).toBeVisible();
    await hostPage.getByRole("button", { name: "Next round", exact: true }).click();
    await expect.poll(async () => (await readRoom(host, code)).status).toBe("PLAYING");
    expect((await readRoom(host, code)).round).toBe(result.round + 1);
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});

test("Tap Race is archived and rejects new phone rooms", async ({ request }) => {
  const response = await request.post("/api/arcade/online/rooms", { data: { gameId: "tap-race", options: {} }, headers: { Origin: baseURL } });
  expect(response.status()).toBe(404);
  expect((await response.json() as { error: { code: string } }).error.code).toBe("ONLINE_GAME_UNAVAILABLE");
});

test("Light Trails accepts phone steering, records a terminal result, and replays in the same room", async ({ browser }) => {
  test.setTimeout(160_000);
  const { host, phones, hostPage, phonePages, code } = await openRoom(browser, "light-trails");
  try {
    await expect(hostPage.getByRole("img", { name: /Online Light Trails/ })).toBeVisible();
    const phone = phonePages[0]!;
    await phone.bringToFront();
    const tickBefore = (await readRoom(host, code)).game?.view?.snapshot?.tick ?? 0;
    await dragStick(phone, phone.getByRole("button", { name: "Move your contestant", exact: true }), true);
    await expect.poll(async () => (await readRoom(host, code)).game?.view?.snapshot?.tick ?? 0, { timeout: 8_000 }).toBeGreaterThan(tickBefore);
    const result = await waitForResult(host, code);
    await expect(hostPage.getByRole("heading", { name: /won|drawn|time limit/i })).toBeVisible();
    await hostPage.getByRole("button", { name: "Next round", exact: true }).click();
    await expect.poll(async () => (await readRoom(host, code)).status).toBe("PLAYING");
    expect((await readRoom(host, code)).round).toBe(result.round + 1);
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
