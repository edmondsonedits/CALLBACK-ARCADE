import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";
const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "kartentisch", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201); const { code } = await created.json() as { code: string };
  const phones: BrowserContext[] = [];
  for (const nickname of ["Spade", "Heart", "Diamond"]) { const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } }); const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname } }); expect(joined.status(), await joined.text()).toBe(201); phones.push(phone); }
  return { host, phones, code };
}

async function playNextCard(pages: Awaited<ReturnType<BrowserContext["newPage"]>>[], hostPage: Awaited<ReturnType<BrowserContext["newPage"]>>, names: string[], expectedCount: number) {
  const currentPlayer = await hostPage.getByText(/to play$/).textContent();
  const playerIndex = names.findIndex((name) => currentPlayer?.startsWith(name));
  expect(playerIndex, `Host turn label was ${currentPlayer}`).toBeGreaterThanOrEqual(0);
  const cards = pages[playerIndex]!.locator('button[aria-label^="Play "]:enabled');
  await expect(cards.first()).toBeEnabled();
  await cards.first().click();
  await expect(hostPage.getByText(`${expectedCount}/3 cards in`)).toBeVisible();
}

test("Kartentisch plays five private-hand tricks across three phones, reveals final hands, and replays", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser); const hostPage = await host.newPage(); const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`); await expectArcadeRoomLobby(hostPage, code, "kartentisch");
    for (const page of phonePages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (let trick = 1; trick <= 5; trick += 1) {
      await expect(hostPage.getByText(`TRICK ${trick} / 5`)).toBeVisible();
      for (let seat = 0; seat < 3; seat += 1) await playNextCard(phonePages, hostPage, ["Spade", "Heart", "Diamond"], seat + 1);
      await expect(hostPage.getByText("3/3 cards in")).toBeVisible();
      await hostPage.getByRole("button", { name: "Reveal trick" }).click();
      for (const page of phonePages) await expect(page.getByText(trick === 5 ? "FINAL HAND REVEAL" : "Trick revealed")).toBeVisible();
      if (trick < 5) { await expect(hostPage.locator(`[aria-label="Trick ${trick} reveal"]`)).toBeVisible(); await hostPage.getByRole("button", { name: "Next trick" }).click(); }
    }
    await expect(hostPage.getByText("FINAL HAND REVEAL")).toBeVisible();
    await expect(phonePages[0]!.getByText("FINAL HAND REVEAL")).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "kartentisch");
  } finally { await Promise.all([host.close(), ...phones.map((phone) => phone.close())]); }
});
