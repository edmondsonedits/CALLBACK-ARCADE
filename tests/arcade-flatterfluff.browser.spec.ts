import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "flatterfluff", contentMode: "party", timerAccessibility: false } });
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

async function aimAtFirstTarget(page: import("@playwright/test").Page) {
  const field = page.getByTestId("flatterfluff-aim-field");
  const location = await field.evaluate((svg) => {
    const bounds = svg.getBoundingClientRect();
    const target = svg.querySelector("[data-target-id] circle");
    if (!target) throw new Error("Target board has no targets");
    return { x: bounds.left + Number(target.getAttribute("cx")) / 1000 * bounds.width, y: bounds.top + Number(target.getAttribute("cy")) / 1000 * bounds.height };
  });
  await page.mouse.click(location.x, location.y);
  await page.getByRole("button", { name: "Lock my shot" }).click();
  await expect(page.getByRole("heading", { name: "Ready to pop!" })).toBeVisible();
}

test("Flatterfluff runs five target waves through King Prompter phones and replays in the same room", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser);
  const hostPage = await host.newPage();
  const pages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "flatterfluff");
    for (const page of pages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();

    for (let round = 1; round <= 5; round += 1) {
      await expect(hostPage.getByRole("heading", { name: "Find your mark." })).toBeVisible();
      await Promise.all(pages.map(aimAtFirstTarget));
      await expect(hostPage.getByText("2 / 2")).toBeVisible();
      await hostPage.getByRole("button", { name: "Reveal shots" }).click();
      if (round < 5) {
        await expect(hostPage.getByRole("heading", { name: "Wave complete" })).toBeVisible();
        await hostPage.getByRole("button", { name: "Next wave" }).click();
      }
    }
    await expect(hostPage.getByLabel("Flatterfluff final results")).toBeVisible();
    await expect(pages[0]!.getByText(/You scored [1-9]/)).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "flatterfluff");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
