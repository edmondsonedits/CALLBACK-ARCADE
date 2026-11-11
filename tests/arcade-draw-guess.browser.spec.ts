import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createAndJoin(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "zeichnen-und-erraten", contentMode: "party", timerAccessibility: false } });
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

test("Zeichnen & Erraten batches drawing, protects artist prompt, guesses on phones, and replays in the room", async ({ browser }) => {
  const { host, phones, code } = await createAndJoin(browser);
  const hostPage = await host.newPage();
  const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "zeichnen-und-erraten");
    for (const page of phonePages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (const page of phonePages) await expect(page.locator(".arcade-phone-card")).toBeVisible();
    let artist: (typeof phonePages)[number] | undefined;
    await expect.poll(async () => {
      for (const page of phonePages) if (await page.locator("canvas").count()) return page;
      return undefined;
    }).toBeTruthy();
    for (const page of phonePages) if (await page.locator("canvas").count()) { artist = page; break; }
    expect(artist, "one phone receives the artist canvas").toBeTruthy();
    const prompt = (await artist!.getByText("Your secret prompt").locator("xpath=following-sibling::strong").innerText()).trim();
    expect(prompt).toBeTruthy();
    const guesser = phonePages.find((page) => page !== artist)!;
    await expect(hostPage.getByText(prompt, { exact: true })).toHaveCount(0);
    for (const page of phonePages) if (page !== artist) await expect(page.getByText(prompt, { exact: true })).toHaveCount(0);

    const canvas = artist!.locator("canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await artist!.mouse.move(box!.x + 30, box!.y + 30);
    await artist!.mouse.down();
    await artist!.mouse.move(box!.x + 120, box!.y + 90, { steps: 6 });
    await artist!.mouse.up();
    await artist!.getByRole("button", { name: "Submit drawing" }).click();
    await expect(hostPage.getByRole("img", { name: "Live drawing" })).toBeVisible();
    const renderedStroke = hostPage.locator('svg[aria-label="Live drawing"] polyline');
    await expect(renderedStroke).toHaveCount(1);
    expect((await renderedStroke.getAttribute("points"))?.trim().split(/\s+/).length).toBeGreaterThan(1);
    await expect(guesser.getByLabel("Your guess")).toBeVisible();
    await guesser.getByLabel("Your guess").fill(`${prompt} extra`);
    await guesser.getByRole("button", { name: "Send guess" }).click();
    await expect(hostPage.getByText(`${prompt} extra`, { exact: true })).toHaveCount(0);
    await expect(guesser.getByLabel("Your previous guesses")).toContainText(`${prompt} extra`);
    await expect(guesser.getByLabel("Your guess")).toBeVisible();
    await guesser.getByLabel("Your guess").fill(prompt);
    await guesser.getByRole("button", { name: "Send guess" }).click();
    await expect(hostPage.getByRole("heading", { name: /guessed it/ })).toBeVisible();
    await expect(hostPage.getByText("The secret prompt").locator("xpath=following-sibling::strong")).toHaveText(prompt);
    await expect(hostPage.getByText(`${prompt} extra`, { exact: true })).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "zeichnen-und-erraten");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
