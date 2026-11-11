import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "chaos-kommando", contentMode: "party", timerAccessibility: false } });
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

test("Chaos-Kommando resolves four private team missions on the same King Prompter room", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser);
  const hostPage = await host.newPage();
  const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "chaos-kommando");
    for (const page of phonePages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (let missionNumber = 1; missionNumber <= 4; missionNumber += 1) {
      await expect(hostPage.getByRole("heading", { name: /Citywide Blackout|Rising Water|Lost Convoy|Reactor Cooldown/ })).toBeVisible();
      for (const page of phonePages) await expect(page.getByRole("heading", { name: /Citywide Blackout|Rising Water|Lost Convoy|Reactor Cooldown/ })).toBeVisible();
      await expect(phonePages[0]!.getByRole("button", { name: "Lock my tool" })).toBeDisabled();
      const tags = await phonePages[0]!.locator("fieldset").getByText(/Choose one team tool/).isVisible();
      expect(tags).toBe(true);
      const requiredLabels = await phonePages[0]!.locator("fieldset").evaluate((fieldset) => Array.from(fieldset.querySelectorAll('input[name="chaos-tool"]')).map((input) => input.getAttribute("value")));
      expect(requiredLabels.length).toBeGreaterThanOrEqual(3);
      const allTools = await phonePages[0]!.locator("fieldset label").allInnerTexts();
      const hostTitle = await hostPage.locator("h1").innerText();
      const missionKeys = { "Citywide Blackout": ["Grid repair kit", "Spare fuse"], "Rising Water": ["Portable pump", "Sandbag wall"], "Lost Convoy": ["Deploy beacon", "Route tablet"], "Reactor Cooldown": ["Coolant line", "Evacuation siren"] } as const;
      const required = missionKeys[hostTitle as keyof typeof missionKeys];
      expect(required).toBeTruthy();
      const chooseByLabel = async (page: typeof phonePages[number], label: string) => {
        await page.locator("fieldset label").filter({ hasText: label }).locator('input[name="chaos-tool"]').check();
        await page.getByRole("button", { name: "Lock my tool" }).click();
        await expect(page.getByRole("heading", { name: "Ready for the next call" })).toBeVisible();
      };
      await Promise.all([chooseByLabel(phonePages[0]!, required![0]), chooseByLabel(phonePages[1]!, required![1]), chooseByLabel(phonePages[2]!, allTools.find((text) => !required!.some((label) => text.includes(label)))!.trim())]);
      await expect(hostPage.getByText("Phones locked: 3 / 3.")).toBeVisible();
      await hostPage.getByRole("button", { name: "Reveal mission" }).click();
      if (missionNumber < 4) {
        await expect(hostPage.getByRole("heading", { name: "Mission contained" })).toBeVisible();
        await expect(phonePages[0]!.getByRole("heading", { name: "Mission contained" })).toBeVisible();
        await hostPage.getByRole("button", { name: "Next mission" }).click();
      } else {
        await expect(hostPage.getByRole("heading", { name: "City secured" })).toBeVisible();
        await expect(phonePages[0]!.getByRole("heading", { name: "You held the line" })).toBeVisible();
      }
    }
    await expect(hostPage.getByRole("heading", { name: "City secured" })).toBeVisible();
    await expect(hostPage.getByText("Team score: 4,000 / 4,000")).toBeVisible();
    await expect(phonePages[0]!.getByText(/Team score: 4,?000 \/ 4,?000/)).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "chaos-kommando");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
