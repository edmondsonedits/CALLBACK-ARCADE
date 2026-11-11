import { expect, test } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test.describe(`host controls at ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });
    test("modal keyboard isolation, dismissal, and focus restoration survive repeated opens", async ({ page }) => {
      // Stay in an empty active lobby: no game start, bots, or image work.
      const response = await page.request.post("/api/rooms", {
        headers: { "Content-Type": "application/json", Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" },
        data: { gameLength: "standard", contentMode: "party", timerAccessibility: false },
      });
      expect(response.status(), await response.text()).toBe(201);
      const { code } = await response.json() as { code: string };
      await page.goto(`/host/${code}`);
      const trigger = page.getByRole("button", { name: "Open host controls" });
      const drawer = page.getByRole("dialog", { name: "Host controls" });
      const close = drawer.getByRole("button", { name: "Close controls" });
      const background = page.getByRole("combobox", { name: "Game pack", exact: true });
      await expect(trigger).toBeVisible();
      const originalPack = await background.inputValue();
      await background.evaluate((element) => {
        element.setAttribute("data-background-inputs", "0");
        for (const type of ["input", "change"]) element.addEventListener(type, () => {
          element.setAttribute("data-background-inputs", String(Number(element.getAttribute("data-background-inputs")) + 1));
        });
      });
      const actions: string[] = [];
      page.on("request", (request) => { if (request.url().endsWith("/host-actions")) actions.push(request.url()); });

      for (const dismissal of ["Escape", "close", "Escape", "close"] as const) {
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(drawer).toBeVisible();
        await expect(close).toBeFocused();
        expect(await drawer.evaluate((element) => element.matches(":modal"))).toBe(true);

        // Tab/Shift+Tab must not enter any control underneath the backdrop.
        for (const key of ["Tab", "Shift+Tab"]) {
          for (let step = 0; step < 24; step += 1) {
            await page.keyboard.press(key);
            expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
          }
        }
        // Even a direct focus attempt cannot send keyboard input to Game pack.
        await background.evaluate((element) => (element as HTMLElement).focus());
        expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
        await page.keyboard.press("ArrowDown");
        await expect(background).toHaveValue(originalPack);
        await expect(background).toHaveAttribute("data-background-inputs", "0");

        // Ordinary clicks within the panel must not dismiss it.
        await drawer.getByRole("heading", { name: "Host desk" }).click();
        await expect(drawer).toBeVisible();
        // Preserve the existing pointer behavior: backdrop clicks do not close.
        await drawer.click({ position: { x: 2, y: 2 } });
        await expect(drawer).toBeVisible();
        if (dismissal === "Escape") await page.keyboard.press("Escape");
        else await close.click();
        await expect(drawer).not.toBeVisible();
        await expect(trigger).toBeFocused();
      }
      await expect(background).toHaveValue(originalPack);
      expect(actions).toEqual([]);
    });
  });
}
