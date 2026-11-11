import { expect, test } from "@playwright/test";
import { getFullArcadeGame } from "../lib/arcade/full-games";
import { PRACTICE_GAMES } from "../lib/arcade/practice/catalog";

test("all retained direct practice routes run locally, reset, and exit without room requests", async ({ page }) => {
  const roomRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/rooms") || pathname.startsWith("/api/arcade") || pathname.includes("/arcade-ticket")) roomRequests.push(pathname);
  });

  for (const game of PRACTICE_GAMES) {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(`/arcade/practice/${game.id}`);
    expect(response?.status(), game.id).toBe(200);
    const full = getFullArcadeGame(game.id);
    if (full) {
      await expect(page.locator("iframe")).toHaveAttribute("src", full.href);
      await expect(page.frameLocator("iframe").locator("canvas").first()).toBeVisible();
      await page.getByRole("link", { name: `Exit ${full.title} to the Arcade` }).click();
      await expect(page).toHaveURL(/\/arcade\/practice$/);
      expect(roomRequests).toEqual([]);
      continue;
    }
    await expect(page.getByRole("heading", { level: 1, name: game.title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Exit" })).toBeVisible();
    await page.getByRole("button", { name: "Sound off" }).click();
    await expect(page.getByRole("button", { name: "Sound on" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Reset" })).toBeEnabled();
    const canvas = page.locator("canvas.arcade-practice-canvas");
    await expect(canvas).toBeVisible();
    await expect.poll(async () => Number(await canvas.getAttribute("data-practice-tick")), { message: `${game.id} simulation should advance` }).toBeGreaterThan(0);
    await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: "Reset" }).click();
    await page.getByText("Practice details").click();
    await expect(page.getByText(/Seed/)).toBeVisible();
    expect(roomRequests, `${game.id} must not create/join a room or realtime match`).toEqual([]);
    await page.getByRole("link", { name: "Exit" }).click();
    await expect(page).toHaveURL(/\/arcade\/practice$/);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/arcade/practice/sumo");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);

  const invalid = await page.goto("/arcade/practice/not-a-game");
  expect(invalid?.status()).toBe(404);
  expect(roomRequests).toEqual([]);
});
