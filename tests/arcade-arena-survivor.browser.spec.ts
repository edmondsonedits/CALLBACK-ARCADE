import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createAndJoin(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "arena-survivor", contentMode: "party", timerAccessibility: false } });
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

test("Arena Survivor keeps each choice private until host reveal and supports same-room replay", async ({ browser }) => {
  const { host, phones, code } = await createAndJoin(browser);
  const hostPage = await host.newPage();
  const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "arena-survivor");
    for (const page of phonePages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(hostPage.getByRole("heading", { name: /Escape|Survival|Shipwreck|Blackout|Smoke|Thin Ice|Wildfire|Rip Current/ })).toBeVisible();
    for (const page of phonePages) await expect(page.getByRole("heading", { name: /Escape|Survival|Shipwreck|Blackout|Smoke|Thin Ice|Wildfire|Rip Current/ })).toBeVisible();

    const voter = phonePages[0]!;
    const choices = voter.locator('input[name="arena-choice"]');
    await expect(choices).toHaveCount(3);
    const firstChoice = await choices.nth(0).getAttribute("value");
    expect(firstChoice).toBeTruthy();
    const firstChoiceText = await voter.locator(`label:has(input[value="${firstChoice}"]) strong`).innerText();
    await voter.locator(`input[name="arena-choice"][value="${firstChoice}"]`).check();
    await voter.getByRole("button", { name: "Lock my choice" }).click();
    await expect(voter.getByRole("heading", { name: "Hold your ground" })).toBeVisible();
    await expect(hostPage.locator('[aria-label="Possible choices"]')).toContainText(firstChoiceText);
    await expect(hostPage.getByText("The winning answer stays secret until the reveal.")).toBeVisible();
    await expect(hostPage.locator('[class*="progress"]')).toContainText(/1\s*of 3 players have chosen/);

    await hostPage.getByRole("button", { name: "Reveal the outcome" }).click();
    await expect(hostPage.getByRole("heading", { name: /survived|moment of truth/ })).toBeVisible();
    await expect(hostPage.getByText("The best choice")).toBeVisible();
    await expect(hostPage.getByRole("region", { name: "Vote breakdown" })).toBeVisible();
    await expect(voter.getByText("The best choice")).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "arena-survivor");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
