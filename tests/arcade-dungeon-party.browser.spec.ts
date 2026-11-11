import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "dungeon-party", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201); const { code } = await created.json() as { code: string };
  const phones: BrowserContext[] = [];
  for (const nickname of ["Alex", "Sam", "Riley"]) { const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } }); const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname } }); expect(joined.status(), await joined.text()).toBe(201); phones.push(phone); }
  return { host, phones, code };
}

test("Dungeon Party runs three private cooperative encounters and replays in its King Prompter room", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser); const hostPage = await host.newPage(); const pages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`); await expectArcadeRoomLobby(hostPage, code, "dungeon-party");
    for (const page of pages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    const moves = [["strike", "strike", "guard"], ["decode", "decode", "rally"], ["spell", "spell", "ward"]];
    const encounterTitles = ["Goblin Patrol", "Rune Gate", "Dragon Vault"];
    for (let i = 0; i < 3; i += 1) {
      await expect(hostPage.getByRole("heading", { name: encounterTitles[i]! })).toBeVisible();
      for (const page of pages) await expect(page.getByRole("heading", { name: encounterTitles[i]! })).toBeVisible();
      await Promise.all(pages.map(async (page, index) => {
        await page.getByRole("button", { name: new RegExp(moves[i]![index]!, "i") }).click();
        await expect(page.getByRole("heading", { name: "Ready for the reveal" })).toBeVisible();
      }));
      await expect(hostPage.getByText("Choices locked: 3 / 3.")).toBeVisible();
      await hostPage.getByRole("button", { name: "Reveal party choices" }).click();
      if (i < 2) { await expect(hostPage.getByRole("heading", { name: "Encounter cleared" })).toBeVisible(); await expect(pages[0]!.getByRole("heading", { name: "You cleared it together" })).toBeVisible(); await hostPage.getByRole("button", { name: "Next encounter" }).click(); }
    }
    await expect(hostPage.getByRole("heading", { name: "The party escaped!" })).toBeVisible();
    await expect(hostPage.getByLabel("Dungeon Party results").getByText("Team score")).toBeVisible();
    await expect(pages[0]!.getByRole("heading", { name: "You made it out!" })).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "dungeon-party");
  } finally { await Promise.all([host.close(), ...phones.map((phone) => phone.close())]); }
});

test("Dungeon Party exposes defeat and matching damage labels when every player guards", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser); const hostPage = await host.newPage(); const pages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`); await expectArcadeRoomLobby(hostPage, code, "dungeon-party");
    for (const page of pages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    const encounterTitles = ["Goblin Patrol", "Rune Gate", "Dragon Vault"];
    const guardLabels = ["Guard", "Brace the arch", "Raise a ward"];
    for (let i = 0; i < 3; i += 1) {
      await expect(hostPage.getByRole("heading", { name: encounterTitles[i]! })).toBeVisible();
      await Promise.all(pages.map((page) => page.getByRole("button", { name: new RegExp(guardLabels[i]!, "i") }).click()));
      await hostPage.getByRole("button", { name: "Reveal party choices" }).click();
      if (i < 2) {
        await expect(hostPage.getByRole("heading", { name: "The party took a hit" })).toBeVisible();
        await expect(pages[0]!.getByRole("heading", { name: "The party takes a hit" })).toBeVisible();
        await hostPage.getByRole("button", { name: "Next encounter" }).click();
      } else {
        await expect(hostPage.getByRole("heading", { name: "The party fell" })).toBeVisible();
        await expect(pages[0]!.getByRole("heading", { name: "The party fell" })).toBeVisible();
      }
    }
    await expect(hostPage.getByText("Party health").locator("..") .getByText("0 / 10")).toBeVisible();
  } finally { await Promise.all([host.close(), ...phones.map((phone) => phone.close())]); }
});
