import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";
const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "magic-arena", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201); const { code } = await created.json() as { code: string };
  const phones: BrowserContext[] = [];
  for (const nickname of ["Ember", "Cobalt"]) { const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } }); const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname } }); expect(joined.status(), await joined.text()).toBe(201); phones.push(phone); }
  return { host, phones, code };
}

test("Magic Arena takes two simultaneous private phone moves per round, resolves a five-round draw, and replays", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser); const hostPage = await host.newPage(); const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`); await expectArcadeRoomLobby(hostPage, code, "magic-arena");
    for (const page of phonePages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (let round = 1; round <= 5; round += 1) {
      await expect(hostPage.getByText(`ROUND ${round} / 5`)).toBeVisible();
      for (const page of phonePages) { await expect(page.getByText(`Round ${round} of 5`)).toBeVisible(); await page.getByRole("radio", { name: "Focus" }).check(); await page.getByRole("button", { name: "Lock my action" }).click(); }
      await expect(hostPage.getByText("Moves locked: 2 / 2")).toBeVisible();
      await hostPage.getByRole("button", { name: "Reveal round" }).click();
      if (round < 5) { await expect(hostPage.getByRole("region", { name: "Magic Arena host screen" }).getByText(/: Focus · \d+ damage taken/)).toHaveCount(2); await hostPage.getByRole("button", { name: "Next round" }).click(); }
    }
    await expect(hostPage.getByRole("heading", { name: "Draw match" })).toBeVisible();
    await expect(phonePages[0]!.getByRole("heading", { name: "Draw match" })).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "magic-arena");
  } finally { await Promise.all([host.close(), ...phones.map((phone) => phone.close())]); }
});
