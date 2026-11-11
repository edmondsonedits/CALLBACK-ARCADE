import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };
async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const response = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "drift-racer", contentMode: "party", timerAccessibility: false } });
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

test("Drift Racer resolves eight private two-phone turns and replays in the same room", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser); const hostPage = await host.newPage(); const [amber, blue] = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`); await expect(hostPage.getByRole("heading", { name: "Drift Racer", exact: true })).toBeVisible();
    await Promise.all([amber!.goto(`/play/${code}`), blue!.goto(`/play/${code}`)]);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (let turn = 1; turn <= 8; turn += 1) {
      await expect(hostPage.getByRole("heading", { name: new RegExp(`Drift Racer TURN ${turn} / 8`) })).toBeVisible();
      await Promise.all([amber!.getByRole("button", { name: "Coast" }).click(), blue!.getByRole("button", { name: "Coast" }).click()]);
      await Promise.all([amber!.getByRole("button", { name: "Lock this move" }).click(), blue!.getByRole("button", { name: "Lock this move" }).click()]);
      await expect(amber!.getByRole("heading", { name: "Line set." })).toBeVisible();
      await expect(hostPage.getByRole("button", { name: "Resolve turn" })).toBeEnabled();
      await hostPage.getByRole("button", { name: "Resolve turn" }).click();
    }
    await expect(hostPage.getByRole("heading", { name: "Dead heat at the line" })).toBeVisible();
    await expect(amber!.getByRole("heading", { name: "A photo finish" })).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "drift-racer");
  } finally { await Promise.all([host.close(), ...phones.map((phone) => phone.close())]); }
});

test("Drift Racer can run on one phone with no bot or winner", async ({ browser }) => {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "drift-racer", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
  const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Solo Driver" } });
  expect(joined.status(), await joined.text()).toBe(201);
  const hostPage = await host.newPage(); const phonePage = await phone.newPage();
  try {
    await Promise.all([hostPage.goto(`/host/${code}`), phonePage.goto(`/play/${code}`)]);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(hostPage.getByRole("heading", { name: "Drift Racer TURN 1 / 8" })).toBeVisible();
    await expect(phonePage.getByRole("button", { name: "Lock this move" })).toBeEnabled();
    await phonePage.getByRole("button", { name: "Accelerate" }).click();
    await phonePage.getByRole("button", { name: "Lock this move" }).click();
    await hostPage.getByRole("button", { name: "Resolve turn" }).click();
    await expect(hostPage.getByRole("heading", { name: "Drift Racer TURN 2 / 8" })).toBeVisible();
  } finally { await Promise.all([host.close(), phone.close()]); }
});
