import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createAndJoin(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "pantomime", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  const phones: BrowserContext[] = [];
  for (const nickname of ["Alex", "Sam", "Riley"]) {
    const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
    const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname } });
    expect(joined.status(), await joined.text()).toBe(201);
    phones.push(phone);
  }
  return { host, phones, code };
}

test("Pantomime keeps the prompt and guesses private until the same-room reveal", async ({ browser }) => {
  const { host, phones, code } = await createAndJoin(browser);
  const hostPage = await host.newPage();
  const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "pantomime");
    for (const page of phonePages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (const page of phonePages) await expect(page.locator(".pantomime-phone")).toBeVisible();

    let performer = undefined as (typeof phonePages)[number] | undefined;
    for (const page of phonePages) if (await page.locator(".pantomime-private-prompt").isVisible()) { performer = page; break; }
    expect(performer, "one phone receives the private acting prompt").toBeTruthy();
    const prompt = (await performer!.locator(".pantomime-private-prompt strong").innerText()).trim();
    expect(prompt).toBeTruthy();
    const guesser = phonePages.find((page) => page !== performer)!;
    await expect(hostPage.getByText(prompt, { exact: true })).toHaveCount(0);
    for (const page of phonePages) if (page !== performer) await expect(page.getByText(prompt, { exact: true })).toHaveCount(0);

    const wrongGuess = `${prompt} nonsense`;
    await guesser.getByLabel("Your guess").fill(wrongGuess);
    await guesser.getByRole("button", { name: "Send guess" }).click();
    await expect(hostPage.getByText(wrongGuess, { exact: true })).toHaveCount(0);
    await expect(guesser.getByLabel("Your private guesses")).toContainText(wrongGuess);
    await expect(guesser.getByLabel("Your guess")).toBeVisible();
    await expect(guesser.getByText("Guess 2 of 5")).toBeVisible();

    await guesser.getByLabel("Your guess").fill(prompt);
    await guesser.getByRole("button", { name: "Send guess" }).click();
    await expect(hostPage.getByRole("heading", { name: /guessed it/ })).toBeVisible();
    await expect(hostPage.locator(".pantomime-prompt-reveal")).toContainText(prompt);
    await expect(hostPage.getByText(wrongGuess, { exact: true })).toBeVisible();
    await expect(performer!.locator(".pantomime-prompt-reveal")).toContainText(prompt);

    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "pantomime");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});

test("all-bot Pantomime shows a practice cue on the host and a spectator phone without overflow", async ({ browser }) => {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
  try {
    const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "pantomime", contentMode: "party", timerAccessibility: false } });
    expect(created.status(), await created.text()).toBe(201);
    const { code } = await created.json() as { code: string };
    const page = await host.newPage();
    await page.goto(`/host/${code}`);
    for (let seat = 1; seat <= 3; seat += 1) {
      const toggle = page.getByRole("switch", { name: `Bot ${seat}`, exact: true });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
    }
    await page.getByRole("button", { name: "Start Game", exact: true }).click();
    const cue = page.getByText(/Bot practice cue:/);
    await expect(cue).toBeVisible({ timeout: 60_000 });
    const desktop = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(desktop.scroll).toBeLessThanOrEqual(desktop.client);
    const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Practice Phone", audience: true } });
    expect(joined.status(), await joined.text()).toBe(201);
    const phonePage = await phone.newPage();
    await phonePage.goto(`/play/${code}`);
    await expect(phonePage.getByText(/Bot practice cue:/)).toBeVisible();
    const phoneSized = await phonePage.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(phoneSized.scroll).toBeLessThanOrEqual(phoneSized.client);
  } finally {
    await Promise.all([host.close(), phone.close()]);
  }
});
