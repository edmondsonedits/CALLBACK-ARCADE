import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createAndJoin(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "imposter", contentMode: "party", timerAccessibility: false } });
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

test("Imposter plays privately on King Prompter phones and reveals in its host room", async ({ browser }) => {
  const { host, phones, code } = await createAndJoin(browser);
  const hostPage = await host.newPage();
  const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "imposter");
    for (const phonePage of phonePages) await phonePage.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();

    for (let index = 0; index < phonePages.length; index += 1) {
      const page = phonePages[index]!;
      await expect(page.getByLabel("Your clue")).toBeVisible();
      const assignment = page.locator(".imposter-assignment");
      const roleText = await assignment.innerText();
      expect(roleText).toMatch(/YOUR ROLE · (IMPOSTER|CIVILIAN)/);
      if (roleText.includes("IMPOSTER")) expect(roleText).toContain("You don’t know the word");
      else expect(roleText).not.toContain("You don’t know the word");
      await page.getByLabel("Your clue").fill(`Clue ${index + 1}`);
      await page.getByRole("button", { name: "Lock my clue" }).click();
      await expect(page.getByText(/Clue locked|Discussion & vote/)).toBeVisible();
    }

    await expect(hostPage.getByRole("heading", { name: "Who doesn’t know the word?" })).toBeVisible();
    for (let index = 0; index < phonePages.length; index += 1) {
      const page = phonePages[index]!;
      await expect(page.getByLabel("Choose one player")).toBeVisible();
      const options = await page.locator("#imposter-vote option").evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value).filter(Boolean));
      expect(options.length).toBe(2);
      await page.locator("#imposter-vote").selectOption(options[0]!);
      await page.getByRole("button", { name: "Lock my vote" }).click();
      await expect(page.getByText(/Vote locked|The reveal/)).toBeVisible();
    }

    await expect(hostPage.getByRole("heading", { name: /Imposter found|The imposter got away/ })).toBeVisible();
    for (const page of phonePages) {
      await expect(page.getByText("The word was")).toBeVisible();
      await expect(page.getByText(/IMPOSTER|CIVILIAN/).first()).toBeVisible();
    }
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "imposter");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
