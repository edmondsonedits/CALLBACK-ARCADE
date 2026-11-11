import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "magic-duell", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  const phones: BrowserContext[] = [];
  for (const nickname of ["Ember", "Cobalt"]) {
    const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
    const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname } });
    expect(joined.status(), await joined.text()).toBe(201);
    phones.push(phone);
  }
  return { host, phones, code };
}

async function drawGlyph(page: Page, glyph: "bolt" | "shield") {
  const points = glyph === "bolt"
    ? [[.1, .5], [.28, .34], [.45, .2], [.2, .8], [.85, .4]]
    : [[.5, .1], [.85, .4], [.7, .85], [.3, .85], [.15, .4], [.5, .1]];
  const pad = page.getByLabel("Draw the selected spell glyph");
  const box = await pad.boundingBox();
  expect(box).not.toBeNull();
  const point = (entry: number[]) => ({ x: box!.x + entry[0]! * box!.width, y: box!.y + entry[1]! * box!.height });
  const first = point(points[0]!);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const entry of points.slice(1)) { const next = point(entry); await page.mouse.move(next.x, next.y, { steps: 4 }); }
  await page.mouse.up();
}

test("Magic Duell drafts private spellbooks, resolves five drawn simultaneous casts, and replays in the same room", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser);
  const hostPage = await host.newPage();
  const [ember, cobalt] = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "magic-duell");
    await Promise.all([ember!.goto(`/play/${code}`), cobalt!.goto(`/play/${code}`)]);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(hostPage.getByLabel("Magic Duell loadout draft")).toBeVisible();
    const addSpell = async (page: Page, spell: string) => await page.getByRole("heading", { name: spell, exact: true }).locator("xpath=..").getByRole("button", { name: "Add to spellbook" }).click();
    await addSpell(ember!, "Comet Lance"); await addSpell(ember!, "Spark Bolt"); await addSpell(ember!, "Stillwater");
    await addSpell(cobalt!, "Spark Bolt"); await addSpell(cobalt!, "Prism Ward"); await addSpell(cobalt!, "Stillwater");
    await Promise.all([ember!.getByRole("button", { name: "Seal 3 / 3 spells" }).click(), cobalt!.getByRole("button", { name: "Seal 3 / 3 spells" }).click()]);
    await expect(ember!.getByRole("heading", { name: "Your spellbook is sealed" })).toBeVisible();
    await expect(cobalt!.getByText("Comet Lance", { exact: true })).toHaveCount(0);
    await expect(hostPage.getByText("Loadouts locked: 2 / 2")).toBeVisible();
    await hostPage.getByRole("button", { name: "Begin the duel" }).click();
    for (let round = 1; round <= 5; round += 1) {
      await expect(hostPage.getByRole("heading", { name: "Read the arena" })).toBeVisible();
      const emberSpell = round <= 2 ? "Comet Lance" : "Spark Bolt";
      await ember!.getByRole("button", { name: new RegExp(`^${emberSpell}`) }).click();
      await cobalt!.getByRole("button", { name: /^Prism Ward/ }).click();
      await drawGlyph(ember!, "bolt"); await drawGlyph(cobalt!, "shield");
      await expect(ember!.getByText("Glyph detected: zig-zag bolt")).toBeVisible();
      await expect(cobalt!.getByText("Glyph detected: shield")).toBeVisible();
      await Promise.all([ember!.getByRole("button", { name: "Cast spell" }).click(), cobalt!.getByRole("button", { name: "Cast spell" }).click()]);
      await expect(ember!.getByRole("heading", { name: "Your spell is flying" })).toBeVisible();
      await expect(cobalt!.getByRole("heading", { name: "Your spell is flying" })).toBeVisible();
      await expect(hostPage.getByText("Spells locked: 2 / 2. Casts stay hidden until reveal.")).toBeVisible();
      await hostPage.getByRole("button", { name: "Reveal the casts" }).click();
      if (round < 5) {
        await expect(hostPage.getByRole("heading", { name: "Cast resolved" })).toBeVisible();
        await hostPage.getByRole("button", { name: "Next round" }).click();
      } else {
        await expect(hostPage.getByLabel("Magic Duell final results")).toBeVisible();
        await expect(hostPage.getByRole("heading", { name: "Ember wins!" })).toBeVisible();
      }
    }
    await expect(ember!.getByRole("heading", { name: "You win!" })).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "magic-duell");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
