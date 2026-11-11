import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

type ArcadeSnapshot = {
  phase: string;
  schaetzorama: { round: number; phase: string; min: number; answer?: number; estimates: unknown[] };
};

async function sync(context: BrowserContext, code: string) {
  const response = await context.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<ArcadeSnapshot>;
}

async function createAndJoin(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", {
    headers,
    data: { gameLength: "arcade", arcadeGameId: "schaetzorama", contentMode: "party", timerAccessibility: false },
  });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  const phones: BrowserContext[] = [];
  for (const nickname of ["Alex", "Sam"]) {
    const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
    const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname } });
    expect(joined.status(), await joined.text()).toBe(201);
    phones.push(phone);
  }
  return { host, phones, code };
}

async function submitEstimate(page: Page, value: string, round: number) {
  await expect(page.getByText(`Round ${round} of 5`)).toBeVisible();
  await page.getByLabel("Your estimate").fill(value);
  await page.getByRole("button", { name: "Lock in estimate" }).click();
  await expect(page.getByText(/Estimate locked|Round \d+ revealed/)).toBeVisible();
}

test("Schaetzorama completes five phone rounds and rematches inside the same King Prompter room", async ({ browser }) => {
  const { host, phones, code } = await createAndJoin(browser);
  const hostPage = await host.newPage();
  const phonePages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "schaetzorama");
    for (let index = 0; index < phonePages.length; index += 1) await phonePages[index]!.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(phonePages[0]!.getByLabel("Your estimate")).toBeVisible();

    for (let round = 1; round <= 5; round += 1) {
      const hostSnapshot = await sync(host, code);
      expect(hostSnapshot.schaetzorama.round).toBe(round);
      expect(hostSnapshot.schaetzorama.phase).toBe("estimating");
      const estimate = String(hostSnapshot.schaetzorama.min);
      await submitEstimate(phonePages[0]!, estimate, round);
      if (round === 1) {
        const hidden = await sync(host, code);
        expect(hidden.schaetzorama.answer).toBeUndefined();
        expect(hidden.schaetzorama.estimates).toEqual([]);
      }
      await submitEstimate(phonePages[1]!, estimate, round);
      await expect(hostPage.getByText("Answer revealed")).toBeVisible();
      await expect(phonePages[0]!.getByText(new RegExp(`Round ${round} revealed`))).toBeVisible();
      await expect(phonePages[1]!.getByText(new RegExp(`Round ${round} revealed`))).toBeVisible();
      if (round < 5) {
        await hostPage.getByRole("button", { name: "Next question" }).click();
        await expect(hostPage.locator(".schaetzorama-round")).toHaveText(`${round + 1} / 5`);
      } else {
        await hostPage.getByRole("button", { name: "Finish match" }).click();
      }
    }

    await expect(hostPage.getByRole("heading", { name: "Final results" })).toBeVisible();
    await expect(phonePages[0]!.getByText("Final results")).toBeVisible();
    await expect(phonePages[1]!.getByText("Final results")).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "schaetzorama");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
