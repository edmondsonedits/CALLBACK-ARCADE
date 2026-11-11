import { expect, test } from "@playwright/test";
import { setupFish, completeMain, openScreens, mainResult, read, finale, uploadFish, art, reloadScreen, toReveal, waitFishPhase, finishPresentation, noNewJobs, noOverflow } from "./fixtures/fish-room";
import { mkdir } from "node:fs/promises";

test.use({ actionTimeout: 15_000 });

test("host and phones run a peaceful fish bonus, recover WebGL, and return through the aquarium", async ({ browser, browserName }) => {
  test.skip(browserName !== "chromium", "This regression requires Chromium's WEBGL_lose_context extension.");
  test.setTimeout(300_000);
  const h = await setupFish(browser, 3);
  try {
    await completeMain(h);
    const original = mainResult(await read(h.host, h.code));
    await openScreens(h);
    const tv = h.tv!;
    await tv.emulateMedia({ reducedMotion: "no-preference" });
    await tv.bringToFront();

    await expect(tv.getByRole("heading", { name: "Play to the death?", exact: true })).toBeVisible();
    const sharkMode = tv.getByRole("button", { name: /Shark showdown/ });
    await sharkMode.click();
    await expect(sharkMode).toHaveAttribute("aria-pressed", "true");
    const peacefulMode = tv.getByRole("button", { name: /Peaceful tank/ });
    await peacefulMode.click();
    await expect(peacefulMode).toHaveAttribute("aria-pressed", "true");
    const drawingTime = tv.getByRole("combobox", { name: /Drawing time/ });
    await expect(drawingTime).toBeVisible();
    await drawingTime.selectOption("90");
    await expect(drawingTime).toHaveValue("90");
    await tv.getByRole("button", { name: "Start fish game →", exact: true }).click();
    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-phase", "tutorial");
    await tv.getByRole("button", { name: "Start drawing", exact: true }).click();
    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-phase", "drawing");
    expect((await finale(h.host, h.code)).drawingSeconds).toBe(90);
    console.info("Controls: visible configuration and drawing start passed");

    for (let index = 0; index < h.phones.length; index++) await uploadFish(h, h.phones[index]!, await art(h.fixture, true, index));
    await reloadScreen(h, h.pages[0]!);
    expect((await finale(h.phones[0]!, h.code)).self!.submitted).toBe(true);

    await toReveal(h);
    await waitFishPhase(h, ["voting"]);
    const castBallot = async (index: number) => {
      const phone = h.pages[index]!;
      await expect(phone.getByRole("heading", { name: "Which fish do you love?", exact: true })).toBeVisible();
      const choice = phone.getByRole("button", { name: /Fish [A-Z].*\+/ }).first();
      await expect(choice).toBeVisible();
      await choice.click();
      await phone.getByRole("button", { name: /^Lock 1 favourite$/ }).click();
    };
    await castBallot(0);
    await expect.poll(async () => (await finale(h.phones[0]!, h.code)).self?.ballotLocked).toBe(true);
    await reloadScreen(h, h.pages[0]!);
    await expect(h.pages[0]!.getByRole("heading", { name: "Favourites locked.", exact: true })).toBeVisible();
    await castBallot(1);
    await castBallot(2);
    await expect.poll(async () => (await finale(h.phones[2]!, h.code)).self?.ballotLocked).toBe(true);
    await waitFishPhase(h, ["cinematic"], 15_000);

    console.info("Controls: all three visible phone ballots locked");
    const aquarium = await finishPresentation(h);
    expect(aquarium.phase).toBe("aquarium");
    expect(aquarium.mode).toBe("peaceful");
    await tv.bringToFront();
    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-phase", "aquarium");
    await mkdir(".logs/fish-acceptance/controls", { recursive: true });
    const gentle = tv.getByRole("button", { name: "Gentle motion", exact: true });
    await gentle.click();
    await expect(gentle).toHaveAttribute("aria-pressed", "true");
    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-reduced-motion", "true");
    await gentle.click();
    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-reduced-motion", "false");

    await tv.waitForTimeout(1200);
    const meshCanvas = tv.getByTestId("fish-mesh");
    const webgl = await meshCanvas.evaluate(canvas => {
      const gl = (canvas as HTMLCanvasElement).getContext("webgl");
      const extension = gl?.getExtension("WEBGL_lose_context");
      if (!gl || !extension) return false;
      const pageWindow = window as typeof window & { __fishWebglExtension?: { loseContext(): void; restoreContext(): void }; __fishWebglEvents?: { lost: number; restored: number } };
      pageWindow.__fishWebglExtension = extension;
      pageWindow.__fishWebglEvents = { lost: 0, restored: 0 };
      canvas.addEventListener("webglcontextlost", () => { pageWindow.__fishWebglEvents!.lost++; }, { once: true });
      canvas.addEventListener("webglcontextrestored", () => { pageWindow.__fishWebglEvents!.restored++; }, { once: true });
      extension.loseContext();
      return true;
    });
    expect(webgl, "Chromium must expose WEBGL_lose_context for the recovery assertion").toBe(true);
    await expect(tv.locator("[data-fish-renderer]")).toHaveAttribute("data-fish-renderer", "canvas");
    expect(await tv.evaluate(() => (window as typeof window & { __fishWebglEvents?: { lost: number } }).__fishWebglEvents?.lost)).toBe(1);
    await expect.poll(() => tv.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("[data-fish-renderer] canvas");
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return 0;
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 3]! > 200 && data[i + 2]! > 180 && data[i + 2]! > data[i]! * 1.4 && data[i + 2]! > data[i + 1]! * 1.08) count++;
      return count;
    })).toBeGreaterThan(200);
    await tv.screenshot({ path: ".logs/fish-acceptance/controls/canvas-fallback.png" });
    await tv.evaluate(() => (window as typeof window & { __fishWebglExtension?: { restoreContext(): void } }).__fishWebglExtension!.restoreContext());
    await expect(tv.locator("[data-fish-renderer]")).toHaveAttribute("data-fish-renderer", "webgl");
    await expect.poll(() => tv.evaluate(() => (window as typeof window & { __fishWebglEvents?: { restored: number } }).__fishWebglEvents?.restored)).toBe(1);
    await expect(tv.locator("[data-fish-renderer]")).toHaveAttribute("data-fish-renderer", "webgl");
    await tv.screenshot({ path: ".logs/fish-acceptance/controls/webgl-restored.png" });
    console.info("Controls: painted Canvas fallback and WebGL restoration passed");

    const artist = tv.getByRole("button", { name: /^Meet / }).first();
    await artist.focus(); await tv.keyboard.press("Enter");
    const card = tv.getByRole("dialog", { name: /^Fish by / });
    await expect(card).toBeVisible();
    await tv.screenshot({ path: ".logs/fish-acceptance/controls/artist-card.png" });
    const close = card.getByRole("button", { name: "Close artist card", exact: true });
    await expect(close).toBeFocused();
    await tv.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await expect(artist).toBeFocused();

    expect(mainResult(await read(h.host,h.code))).toEqual(original);
    await tv.getByRole("button", { name: "Finish fish game", exact: true }).click();
    await expect(tv.getByRole("heading", { name: "The Last Fish Swimming", exact: true })).toBeVisible();
    const returned = await read(h.host, h.code);
    expect(returned.fishGame!.phase).toBe("closed");
    expect(returned.phase).toBe("ARCADE_RESULTS");
    expect(returned.sketchRelay).toBeNull();
    await noNewJobs(h);
    for (const page of [tv, ...h.pages]) await noOverflow(page);
    expect(h.errors).toEqual([]);
  } finally { await h.close(); }
});
