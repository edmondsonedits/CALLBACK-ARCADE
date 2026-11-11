import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";
import { SCHATTENJAGD_CASE_LIBRARY } from "../server/arcade/schattenjagd";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "schattenjagd", contentMode: "party", timerAccessibility: false } });
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

test("Schattenjagd runs four private clue cases on phones and replays in the same King Prompter room", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser);
  const hostPage = await host.newPage();
  const pages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "schattenjagd");
    for (const page of pages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (let round = 1; round <= 4; round += 1) {
      const scenario = SCHATTENJAGD_CASE_LIBRARY[round - 1]!;
      await expect(hostPage.getByRole("heading", { name: scenario.title })).toBeVisible();
      await expect(hostPage.getByText(scenario.clues[0]!.text)).toHaveCount(0);
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index]!;
        const clue = scenario.clues[index % scenario.clues.length]!;
        await expect(page.getByText(clue.text)).toBeVisible();
        if (index < scenario.clues.length) await expect(page.getByText(scenario.clues[(index + 1) % scenario.clues.length]!.text)).toHaveCount(0);
        await page.getByRole("button", { name: new RegExp(`^${scenario.suspects.find((suspect) => suspect.id === scenario.targetId)!.name}`) }).click();
        await expect(page.getByRole("heading", { name: "Choice recorded" })).toBeVisible();
        await expect(page.getByText(scenario.suspects.find((suspect) => suspect.id === scenario.targetId)!.name, { exact: true })).toHaveCount(0);
      }
      await expect(hostPage.getByText(`Private votes locked: 3 / 3.`)).toBeVisible();
      await hostPage.getByRole("button", { name: "Reveal the case" }).click();
      if (round < 4) {
        await expect(hostPage.getByRole("heading", { name: new RegExp(`${scenario.title}: ${scenario.suspects.find((suspect) => suspect.id === scenario.targetId)!.name}`) })).toBeVisible();
        await hostPage.getByRole("button", { name: "Open next case" }).click();
      } else {
        await expect(hostPage.getByLabel("Schattenjagd final results")).toBeVisible();
      }
    }
    await expect(hostPage.getByLabel("Schattenjagd final results")).toBeVisible();
    await expect(pages[0]!.getByText("Wait for your host to start another hunt.")).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "schattenjagd");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
