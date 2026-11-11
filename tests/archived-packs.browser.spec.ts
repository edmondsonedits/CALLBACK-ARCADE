import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("active menu, six-pack setup, and legacy links show only available games", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/?menu=1");
  await expect(page.getByRole("link", { name: "Bowl of Fools", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Royal War Room", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Birthday", exact: true })).toHaveCount(0);
  const screenshotDirectory = resolve(process.cwd(), ".logs/qa-pack-archive");
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: resolve(screenshotDirectory, "active-menu.png"), fullPage: true, caret: "initial" });

  await page.goto("/host/new");
  const selector = page.locator("#game-pack");
  await expect(selector).toBeVisible();
  const values = await selector.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  expect(values).toEqual(["bowl-of-fools", "royal-rumours", "king-mystery", "pictures", "comic", "standard"]);
  const screenshot = resolve(screenshotDirectory, "active-packs.png");
  await page.screenshot({ path: screenshot, fullPage: true, caret: "initial" });

  for (const game of ["bowl", "royal-war-room", "birthday"]) {
    await page.goto(`/host/new?game=${game}`);
    await expect(page).toHaveURL(new RegExp(`/archived-game\\?pack=${game}$`));
    await expect(page.getByText("This pack has been removed from active play.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Return to the active menu" })).toHaveAttribute("href", "/?menu=1");
  }
  await page.goto("/birthday");
  await expect(page.getByRole("heading", { name: "30th Birthday is unavailable." })).toBeVisible();
  await page.goto("/birthday/new");
  await expect(page.getByRole("heading", { name: "30th Birthday is unavailable." })).toBeVisible();
  await page.goto("/archived-game?pack=constructor");
  await expect(page.getByRole("heading", { name: "This game pack is unavailable." })).toBeVisible();
});
