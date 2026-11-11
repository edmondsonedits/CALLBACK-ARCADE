import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };
async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const response = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "minions-td", contentMode: "party", timerAccessibility: false } });
  expect(response.status(), await response.text()).toBe(201);
  const { code } = await response.json() as { code: string };
  const phones: BrowserContext[] = [];
  for (const nickname of ["Amber", "Blue"]) {
    const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
    const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname } });
    expect(joined.status(), await joined.text()).toBe(201); phones.push(phone);
  }
  return { host, phones, code };
}

test("Minions TD resolves six private two-phone strategy waves and replays in the same room", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser); const hostPage = await host.newPage(); const [amber, blue] = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`); await expectArcadeRoomLobby(hostPage, code, "minions-td");
    await Promise.all([amber!.goto(`/play/${code}`), blue!.goto(`/play/${code}`)]);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (let round = 1; round <= 6; round += 1) {
      await expect(hostPage.getByText(`WAVE ${round} / 6`)).toBeVisible();
      await Promise.all([amber!.getByRole("button", { name: /^Deploy Swiftling/ }).click(), blue!.getByRole("button", { name: /^Deploy Swiftling/ }).click()]);
      await expect(amber!.getByRole("heading", { name: "Hold your line" })).toBeVisible();
      await expect(blue!.getByRole("heading", { name: "Hold your line" })).toBeVisible();
      await expect(hostPage.getByText("Orders locked: 2 / 2 · choices stay private until reveal.")).toBeVisible();
      await expect(hostPage.getByText("Deploy Swiftling", { exact: true })).toHaveCount(0);
      await hostPage.getByRole("button", { name: "Resolve all orders" }).click();
      if (round < 6) {
        await expect(hostPage.getByRole("heading", { name: "Wave resolved" })).toBeVisible();
        await expect(amber!.getByRole("heading", { name: "The wave is over" })).toBeVisible();
        await hostPage.getByRole("button", { name: "Open next wave" }).click();
      } else {
        await expect(hostPage.getByLabel("Minions TD final results")).toBeVisible();
        await expect(hostPage.getByRole("heading", { name: "The lanes end in a draw" })).toBeVisible();
      }
    }
    await expect(amber!.getByRole("heading", { name: "Draw game" })).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "minions-td");
  } finally { await Promise.all([host.close(), ...phones.map((phone) => phone.close())]); }
});
