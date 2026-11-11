import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { expectArcadeRoomLobby } from "./helpers/arcade-host";
import { WORD_TILES_DICTIONARY } from "../server/arcade/word_tiles";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

async function createRoom(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "word-tiles", contentMode: "party", timerAccessibility: false } });
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

function findWords(letters: string, count: number, excluded: Set<string>): string[] {
  const rack = [...letters.toLowerCase()].sort().join("");
  const found: string[] = [];
  for (const word of WORD_TILES_DICTIONARY) {
    if (!/^[a-z]{3,7}$/u.test(word)) continue;
    if (excluded.has(word)) continue;
    const remaining = [...rack];
    let fits = true;
    for (const letter of word) {
      const index = remaining.indexOf(letter);
      if (index < 0) { fits = false; break; }
      remaining.splice(index, 1);
    }
    if (fits) found.push(word);
    if (found.length === count) break;
  }
  if (found.length === 0) return found;
  while (found.length < count) found.push(found[0]!);
  return found;
}

test("Word Tiles runs five private rack rounds on phones and replays in the same room", async ({ browser }) => {
  const { host, phones, code } = await createRoom(browser);
  const hostPage = await host.newPage();
  const pages = await Promise.all(phones.map((phone) => phone.newPage()));
  try {
    await hostPage.goto(`/host/${code}`);
    await expectArcadeRoomLobby(hostPage, code, "word-tiles");
    for (const page of pages) await page.goto(`/play/${code}`);
    await hostPage.getByRole("button", { name: "Start Game", exact: true }).click();
    for (let round = 1; round <= 5; round += 1) {
      await expect(hostPage.getByRole("heading", { name: "Word Tiles" })).toBeVisible();
      const rackLabel = await hostPage.getByLabel(/^Letter rack/).getAttribute("aria-label");
      expect(rackLabel).not.toBeNull();
      await Promise.all(pages.map((page) => expect.poll(async () => page.getByLabel(/^Letter rack/).getAttribute("aria-label")).toBe(rackLabel)));
      const rack = (rackLabel ?? "").replace("Letter rack ", "").replaceAll(" ", "");
      const words = findWords(rack, 3, new Set());
      expect(words).toHaveLength(3);
      await Promise.all(pages.map(async (page, index) => {
        await expect(page.getByLabel("Your word")).toHaveValue("");
        const counts = new Map<string, number>();
        for (const letter of rack.toUpperCase()) counts.set(letter, (counts.get(letter) ?? 0) + 1);
        const [tileLetter, tileCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
        const sameLetterTiles = page.getByRole("button", { name: `Add letter ${tileLetter}` });
        for (let tile = 0; tile < tileCount; tile += 1) await sameLetterTiles.first().click();
        await expect(sameLetterTiles.first()).toBeDisabled();
        await page.getByLabel("Your word").fill(words[index]!);
        await page.getByRole("button", { name: "Submit word" }).click();
        await expect(page.getByRole("heading", { name: "Tiles down" })).toBeVisible();
      }));
      await expect(hostPage.getByText("Words locked: 3 / 3.")).toBeVisible();
      await hostPage.getByRole("button", { name: "Reveal words" }).click();
      if (round < 5) {
        await expect(hostPage.getByRole("heading", { name: "Words are on the table" })).toBeVisible();
        await hostPage.getByRole("button", { name: "Next rack" }).click();
      } else {
        await expect(hostPage.getByLabel("Word Tiles final results")).toBeVisible();
      }
    }
    await expect(hostPage.getByLabel("Word Tiles final results")).toBeVisible();
    await expect(pages[0]!.getByText("Stay in the room for another set of racks.")).toBeVisible();
    await hostPage.getByRole("button", { name: "Play again" }).click();
    await expectArcadeRoomLobby(hostPage, code, "word-tiles");
  } finally {
    await Promise.all([host.close(), ...phones.map((phone) => phone.close())]);
  }
});
