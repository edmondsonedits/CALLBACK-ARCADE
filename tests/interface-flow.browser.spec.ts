import { expect, test, type Locator } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const viewportCases = [
  { width: 320, height: 568 },
  { width: 393, height: 720 },
  { width: 667, height: 375 },
];

async function scrollState(target: Locator) {
  return target.evaluate((element) => {
    const root = document.scrollingElement as HTMLElement | null;
    const ancestors: number[] = [];
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      if (parent.scrollHeight > parent.clientHeight + 2) ancestors.push(parent.scrollTop);
      parent = parent.parentElement;
    }
    return { windowY: window.scrollY, rootTop: root?.scrollTop ?? 0, ancestors };
  });
}

async function resetScroll(target: Locator) {
  await target.evaluate((element) => {
    window.scrollTo(0, 0);
    const root = document.scrollingElement as HTMLElement | null;
    if (root) root.scrollTop = 0;
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      parent.scrollTop = 0;
      parent = parent.parentElement;
    }
  });
}

function didScroll(before: Awaited<ReturnType<typeof scrollState>>, after: Awaited<ReturnType<typeof scrollState>>) {
  return after.windowY > before.windowY || after.rootTop > before.rootTop || after.ancestors.some((top, index) => top > (before.ancestors[index] ?? 0));
}

test("home gives direct play choices, secondary destinations, and keyboard access", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Start Callback", exact: true }).click();

  const host = page.getByRole("button", { name: "Host a game", exact: true });
  const join = page.getByRole("link", { name: "Join a game", exact: true });
  await expect(host).toBeVisible();
  await expect(join).toBeVisible();

  await host.focus();
  await page.keyboard.press("Tab");
  await expect(join).toBeFocused();

  await expect(page.getByRole("link", { name: "Your character", exact: true })).toBeAttached();
  await expect(page.getByRole("link", { name: "History Books", exact: true })).toBeAttached();
  await expect(page.getByRole("link", { name: "How to play", exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeAttached();
  await expect(page.getByRole("link", { name: "Browse games", exact: true })).toBeAttached();
  await expect(page.getByRole("link", { name: "Fish practice", exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "House Edmondson", exact: true })).toBeAttached();

  await mkdir(".logs/interface-reconstruction/qa", { recursive: true });
  for (const viewport of viewportCases) {
    await page.setViewportSize(viewport);
    await expect(host).toBeVisible();
    await expect(join).toBeVisible();
    await page.screenshot({ path: `.logs/interface-reconstruction/qa/home-${viewport.width}x${viewport.height}.png` });
  }
});

test("History Books uses natural document scrolling, server-filter requests, and a scrollable match detail", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const matches = Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    return {
      id: `archive-${number}`,
      room_code: `A${String(number).padStart(3, "0")}`,
      match_number: number,
      game_length: number > 9 ? "comic" : "pictures",
      title: `Archive Chapter ${String(number).padStart(2, "0")}`,
      player_count: 3,
      winner_names: `Winner ${number}`,
      played_at: Date.UTC(2026, 9, number),
    };
  });
  const requests: Array<{ mode: string; query: string }> = [];
  await page.route("**/api/history**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/history") {
      const mode = url.searchParams.get("mode") ?? "";
      const query = url.searchParams.get("q") ?? "";
      requests.push({ mode, query });
      let result = matches.filter((match) => !mode || match.game_length === mode);
      if (query) result = result.filter((match) => `${match.title} ${match.winner_names}`.toLowerCase().includes(query.toLowerCase()));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: result }) });
      return;
    }
    const matchNumber = Number(url.pathname.split("/").at(-1)?.replace("archive-", ""));
    const detail = {
      id: `archive-${matchNumber}`,
      gameId: "pictures",
      code: `A${String(matchNumber).padStart(3, "0")}`,
      matchNumber,
      gameLength: "pictures",
      title: `Archive Chapter ${String(matchNumber).padStart(2, "0")}`,
      playedAt: Date.UTC(2026, 9, matchNumber),
      players: [1, 2, 3].map((player) => ({ id: `player-${player}`, nickname: `Player ${player}`, avatar: player, color: "#46DBDC", bot: false, score: 100 - player, winner: player === 1 })),
      winnerIds: ["player-1"],
      rounds: Array.from({ length: 12 }, (_, index) => ({ id: `round-${index + 1}`, label: `Round ${index + 1}`, prompt: `A prompt for round ${index + 1}`, answers: [{ id: `answer-${index + 1}`, player_id: "player-1", text: `Answer ${index + 1}` }] })),
      images: [],
      comicTheme: null,
      comicFrames: [],
      restoration: null,
      awards: [],
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ match: detail }) });
  });

  await page.setViewportSize({ width: 393, height: 720 });
  await page.goto("/history-books");
  const document = page.locator(".menu-document");
  await expect(document).toBeVisible();
  const cards = page.locator(".history-grid .history-card");
  await expect(page.getByRole("heading", { name: "History Books", exact: true })).toBeVisible();
  await expect.poll(async () => cards.count()).toBe(12);
  await expect(page.getByRole("searchbox", { name: "Search History Books", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Filter by game", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Previous|Next) (screen|games|History)/i })).toHaveCount(0);

  const lastCard = cards.last();
  await resetScroll(lastCard);
  const beforeScroll = await scrollState(lastCard);
  await lastCard.scrollIntoViewIfNeeded();
  const afterScroll = await scrollState(lastCard);
  await expect(lastCard).toBeInViewport();
  expect(didScroll(beforeScroll, afterScroll), "the final history card is reached with ordinary document scrolling").toBe(true);
  await page.screenshot({ path: ".logs/interface-reconstruction/qa/history-last-card-393x720.png" });

  await page.getByRole("combobox", { name: "Filter by game", exact: true }).selectOption("comic");
  await expect.poll(() => requests.some((request) => request.mode === "comic" && request.query === "")).toBe(true);
  await expect.poll(async () => cards.count()).toBe(3);
  await page.getByRole("searchbox", { name: "Search History Books", exact: true }).fill("Winner 11");
  await expect.poll(() => requests.some((request) => request.mode === "comic" && request.query === "Winner 11")).toBe(true);
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Archive Chapter 11");
  await cards.first().click();

  const detail = page.getByRole("dialog");
  await expect(detail).toBeVisible();
  const finalRound = detail.getByText("Round 12", { exact: true });
  await finalRound.scrollIntoViewIfNeeded();
  await expect(finalRound).toBeInViewport();
  await expect(detail.getByRole("button", { name: /Close/ })).toBeVisible();
  await page.screenshot({ path: ".logs/interface-reconstruction/qa/history-detail-393x720.png" });
  await detail.getByRole("button", { name: /Close/ }).click();
  await page.getByRole("link", { name: "Back to Grand Hall", exact: true }).click();
  await expect(page).toHaveURL(/\/\?menu=1$/);
  await expect(page.getByRole("button", { name: "Host a game", exact: true })).toBeVisible();
});

test("host picker starts on Party Games and all seven cards remain reachable by scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Start Callback", exact: true }).click();
  await page.getByRole("button", { name: "Host a game", exact: true }).click();
  await expect(page).toHaveURL(/\/session\/[A-Z2-9]{4}\/host$/);
  const code = new URL(page.url()).pathname.split("/")[2]!;
  try {
    const gameGrid = page.locator(".game-menu-grid");
    const partyTab = page.getByRole("button", { name: /^Party Games/ }).first();
    const arcadeTab = page.getByRole("button", { name: /^Arcade/ }).first();
    await expect(partyTab).toBeVisible();
    await expect(arcadeTab).toBeVisible();
    await expect(partyTab).toHaveAttribute("aria-pressed", "true");
    await expect(gameGrid).toBeVisible();
    await expect(gameGrid.getByRole("button")).toHaveCount(7);
    for (const title of ["Sketch & Sorcery", "King Prompter", "Bowl of Fools", "Royal Rumours", "Royal Frame-Up", "Let’s Make a Comic", "Legacy Standard"]) {
      await expect(gameGrid).toContainText(title);
    }

    await arcadeTab.click();
    await expect(arcadeTab).toHaveAttribute("aria-pressed", "true");
    await expect(gameGrid).toContainText(/Royal Sumo/);
    await partyTab.click();
    await expect(partyTab).toHaveAttribute("aria-pressed", "true");
    await expect(gameGrid.getByRole("button")).toHaveCount(7);
    await expect(page.getByRole("button", { name: /^(Previous|Next) (screen|games|Games)/i })).toHaveCount(0);

    await mkdir(".logs/interface-reconstruction/qa", { recursive: true });
    for (const viewport of viewportCases) {
      await page.setViewportSize(viewport);
      await expect(gameGrid.getByRole("button")).toHaveCount(7);
      const finalCard = gameGrid.getByRole("button").last();
      await resetScroll(finalCard);
      await page.screenshot({ path: `.logs/interface-reconstruction/qa/picker-${viewport.width}x${viewport.height}-top.png` });
      const beforeScroll = await scrollState(finalCard);
      await finalCard.scrollIntoViewIfNeeded();
      const afterScroll = await scrollState(finalCard);
      await expect(finalCard).toBeInViewport();
      expect(didScroll(beforeScroll, afterScroll), `Legacy Standard is reachable by ordinary scrolling at ${viewport.width}x${viewport.height}`).toBe(true);
      await page.screenshot({ path: `.logs/interface-reconstruction/qa/picker-${viewport.width}x${viewport.height}.png` });
    }
  } finally {
    const currentResponse = await page.request.get(`/api/sessions/${code}`);
    if (currentResponse.ok()) {
      const current = await currentResponse.json() as { version: number };
      await page.request.post(`/api/sessions/${code}/host`, { data: { operation: "close", version: current.version } });
    }
  }
});
