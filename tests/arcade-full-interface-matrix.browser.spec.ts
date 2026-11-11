import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { ACTIVE_FULL_ARCADE_GAMES } from "../lib/arcade/full-games";

const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1366, height: 768 },
  { name: "short-landscape", width: 844, height: 390 },
] as const;

test("all featured full games fit desktop, phone, and short landscape screens", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") browserErrors.push(message.text()); });
  const screenshotDirectory = testInfo.outputPath("screenshots");
  await mkdir(screenshotDirectory, { recursive: true });

  for (const game of ACTIVE_FULL_ARCADE_GAMES) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const response = await page.goto(game.href);
      expect(response?.status(), `${game.id} ${viewport.name} route`).toBe(200);
      await expect(page.locator("canvas").first(), `${game.id} ${viewport.name} canvas`).toBeVisible();
      await expect(page.locator("button:visible").first(), `${game.id} ${viewport.name} player controls`).toBeVisible();

      const layout = await page.evaluate(() => {
        const canvas = document.querySelector("canvas");
        if (!canvas) return null;
        const canvasRect = canvas.getBoundingClientRect();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          visibleButtons: [...document.querySelectorAll("button")]
            .filter(button => {
              const style = getComputedStyle(button);
              const rect = button.getBoundingClientRect();
              return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
            })
            .map(button => {
              const rect = button.getBoundingClientRect();
              return { label: button.getAttribute("aria-label") || button.textContent?.trim() || "button", left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            }),
          canvasLeft: canvasRect.left,
          canvasRight: canvasRect.right,
          canvasTop: canvasRect.top,
          canvasBottom: canvasRect.bottom,
        };
      });
      expect(layout, `${game.id} ${viewport.name} game canvas`).not.toBeNull();
      expect(layout!.scrollWidth, `${game.id} ${viewport.name} horizontal overflow`).toBeLessThanOrEqual(viewport.width + 1);
      expect(layout!.canvasLeft, `${game.id} ${viewport.name} canvas clipped at left`).toBeGreaterThanOrEqual(-1);
      expect(layout!.canvasRight, `${game.id} ${viewport.name} canvas clipped at right`).toBeLessThanOrEqual(viewport.width + 1);
      expect(layout!.canvasTop, `${game.id} ${viewport.name} canvas clipped at top`).toBeGreaterThanOrEqual(-1);
      expect(layout!.canvasBottom, `${game.id} ${viewport.name} canvas clipped at bottom`).toBeLessThanOrEqual(viewport.height + 1);
      for (const button of layout!.visibleButtons) {
        expect(button.left, `${game.id} ${viewport.name} ${button.label} clipped at left`).toBeGreaterThanOrEqual(-1);
        expect(button.right, `${game.id} ${viewport.name} ${button.label} clipped at right`).toBeLessThanOrEqual(viewport.width + 1);
        expect(button.top, `${game.id} ${viewport.name} ${button.label} clipped at top`).toBeGreaterThanOrEqual(-1);
        expect(button.bottom, `${game.id} ${viewport.name} ${button.label} clipped at bottom`).toBeLessThanOrEqual(viewport.height + 1);
      }

      if (viewport.name === "phone") {
        const path = `${screenshotDirectory}/${game.id}-phone.png`;
        await page.screenshot({ path, fullPage: false });
      }
    }
  }

  expect(browserErrors, "featured games should load without browser errors").toEqual([]);
});
