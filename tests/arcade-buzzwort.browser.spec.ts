import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createAndJoin(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "buzzwort", contentMode: "party", timerAccessibility: false } });
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

test("Buzzwort stays in King Prompter and keeps its card private until reveal", async ({ browser }) => {
  const { host, phones, code } = await createAndJoin(browser);
  const hostPage = await host.newPage();
  const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "buzzwort");
    for (const page of phonePages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (const page of phonePages) await expect(page.locator(".buzzwort-phone")).toBeVisible();

    let clueGiver = undefined as (typeof phonePages)[number] | undefined;
    for (const page of phonePages) if (await page.locator(".buzzwort-secret-card").isVisible()) { clueGiver = page; break; }
    expect(clueGiver, "one phone receives the private clue card").toBeTruthy();
    const card = clueGiver!.locator(".buzzwort-secret-card");
    const target = (await card.locator("strong").innerText()).trim();
    const taboo = (await card.locator("b").first().innerText()).trim();
    expect(target).toBeTruthy();
    expect(taboo).toBeTruthy();
    for (const page of phonePages) {
      if (page === clueGiver) continue;
      await expect(page.locator(".buzzwort-secret-card")).toHaveCount(0);
      await expect(page.getByText(target, { exact: true })).toHaveCount(0);
    }
    await expect(hostPage.getByText(target, { exact: true })).toHaveCount(0);
    await expect(hostPage.getByText(taboo, { exact: true })).toHaveCount(0);

    await clueGiver!.getByLabel("Give your team a clue").fill(`That is ${taboo}`);
    await clueGiver!.getByRole("button", { name: "Send clue" }).click();
    await expect(hostPage.getByRole("heading", { name: /^(Ember|Cobalt) wins$/ })).toBeVisible();
    await expect(hostPage.locator(".buzzwort-card-reveal")).toContainText(target);
    await expect(hostPage.locator(".buzzwort-card-reveal")).toContainText(taboo);
    for (const page of phonePages) await expect(page.locator(".buzzwort-phone-card")).toContainText(target);

    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "buzzwort");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
