import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { setupFish, completeMain, openScreens, reloadScreen, mainResult, read, finale, openFish, fishAction, uploadFish, art, toReveal, waitFishPhase, noNewJobs, noOverflow } from "./fixtures/fish-room";

async function assertPaintedTank(page: Page) {
  await page.bringToFront();
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-fish-renderer] canvas');
    if (document.hidden || !canvas?.width || !canvas.height) return false;
    // The water is a CSS backdrop; this canvas deliberately has a transparent
    // center. Its painted edge plants establish that the render loop is alive.
    const pixels = canvas.getContext("2d")!.getImageData(0, Math.floor(canvas.height * .7), Math.max(1, Math.floor(canvas.width * .17)), Math.max(1, Math.floor(canvas.height * .3))).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  })).toBe(true);
}

for (const count of [4, 10]) test(`${count} human fish play the full shark story with pause, reload, original art and unchanged scores`, async ({ browser }) => {
  test.setTimeout(540_000);
  const h = await setupFish(browser, count);
  const evidence = `.logs/fish-acceptance/${count}-fish`;
  await mkdir(evidence, { recursive: true });
  try {
    await completeMain(h); const before = mainResult(await read(h.host, h.code));
    await openScreens(h); await openFish(h, "shark");
    for (let i = 0; i < count; i++) await uploadFish(h, h.phones[i]!, await art(h.fixture, true, i));
    await toReveal(h);
    await h.tv!.bringToFront();
    await expect(h.tv!.getByTestId("fish-tank")).toHaveAttribute("data-phase", "reveal");
    const introductions = new Set<string>();
    let introduction = await finale(h.host, h.code);
    while (introduction.phase === "reveal") {
      for (const id of introduction.revealedEntryIds) introductions.add(id);
      await h.tv!.waitForTimeout(500);
      introduction = await finale(h.host, h.code);
    }
    expect(introductions.size).toBe(count);
    expect(introduction.phase).toBe("voting");
    await expect(h.tv!.getByTestId("fish-tank")).toHaveAttribute("data-phase", "voting");
    await fishAction(h.host, h.code, "FISH_PAUSE");
    await assertPaintedTank(h.tv!);
    await h.tv!.screenshot({ path: `${evidence}/voting.png` });
    await noOverflow(h.tv!);
    const measureFrames = () => h.tv!.evaluate(async () => {
      const samples: number[] = []; const scenes = new Set<string>(); let last = performance.now();
      await new Promise<void>(resolve => { const frame = (now: number) => { scenes.add(document.querySelector('[data-testid="fish-tank"]')?.getAttribute("data-event") ?? "unknown"); samples.push(now - last); last = now; if (samples.length >= 180) resolve(); else requestAnimationFrame(frame); }; requestAnimationFrame(frame); });
      const sorted = samples.slice(1).sort((a,b) => a-b);
      return { scenes: [...scenes], active: true, browser: navigator.userAgent, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, renderer: document.querySelector('[data-fish-renderer]')?.getAttribute('data-fish-renderer'), count: sorted.length, medianMs: sorted[Math.floor(sorted.length*.5)], p95Ms: sorted[Math.floor(sorted.length*.95)], maxMs: sorted.at(-1) };
    });
    let frameSample: ReturnType<typeof measureFrames> | undefined;
    await fishAction(h.host, h.code, "FISH_RESUME");
    await Promise.all(h.phones.map(async phone => {
      const f = await finale(phone, h.code);
      expect(f.rankLimit).toBe(3);
      expect(f.entries.every(e=>!e.artistName&&!e.playerId)).toBe(true);
      await fishAction(phone, h.code, "FISH_BALLOT", { ranking: f.self!.ballotOptions.slice(0,3) });
    }));
    await waitFishPhase(h, ["cinematic"]);
    await fishAction(h.host, h.code, "FISH_PAUSE");
    const paused = await finale(h.host, h.code);
    await reloadScreen(h, h.tv!);
    expect((await finale(h.host, h.code)).elapsedMs).toBe(paused.elapsedMs);
    await expect(h.tv!.getByTestId("fish-tank")).toHaveAttribute("data-phase", "cinematic");
    expect((await finale(h.host, h.code)).result).toBeUndefined();
    await fishAction(h.host, h.code, "FISH_RESUME");
    await h.tv!.bringToFront();
    const shots: string[] = [], eliminated: string[] = [], captured = new Set<string>();
    const cutoff = Date.now()+100000;
    let final = await finale(h.host, h.code);
    while (final.phase === "cinematic") {
      expect(Date.now()).toBeLessThan(cutoff);
      expect(final.result).toBeUndefined(); expect(final.champion).toBeUndefined();
      const e = final.cinematic!.event!;
      if (!shots.includes(e.id)) shots.push(e.id);
      for (const id of final.cinematic!.eliminatedEntryIds) if (!eliminated.includes(id)) eliminated.push(id);
      const shot = e.kind;
      if (!frameSample && shot === "hunt") frameSample = measureFrames();
      if (!captured.has(shot) && ((shot === "hunt" || shot === "final-two") ? e.elapsedMs > (e.biteAtMs ?? 0)-450 && e.elapsedMs < (e.biteAtMs ?? 0)+120 : e.elapsedMs > 300)) {
        captured.add(shot); await h.tv!.screenshot({ path: `${evidence}/${shot}.png` });
      }
      await h.tv!.waitForTimeout(150);
      final = await finale(h.host, h.code);
    }
    expect(final.phase).toBe("champion");
    expect(frameSample).toBeDefined();
    const performanceSample = await frameSample!;
    expect(performanceSample.scenes).toContain("hunt");
    expect(final.result!.ranking).toHaveLength(count);
    expect(eliminated).toEqual(final.result!.ranking.slice(1).reverse().map(row=>row.entryId));
    expect(shots.filter(id=>id.includes("hunt"))).toHaveLength(count-2);
    await expect(h.tv!.getByTestId("fish-champion")).toBeVisible();
    await expect(h.tv!.getByTestId("fish-champion")).toHaveCSS("opacity", "1");
    await h.tv!.screenshot({ path: `${evidence}/champion.png` });
    await fishAction(h.host, h.code, "FISH_ADVANCE");
    await expect(h.tv!.getByTestId("fish-tank")).toHaveAttribute("data-phase", "artists");
    await h.tv!.screenshot({ path: `${evidence}/artists.png` });
    await fishAction(h.host, h.code, "FISH_ADVANCE");
    await expect(h.tv!.getByTestId("fish-tank")).toHaveAttribute("data-phase", "aquarium");
    await expect(h.tv!.getByText("Everyone’s back!", { exact: false })).toBeVisible();
    await expect(h.tv!.getByRole("button", { name:"Pause", exact:true })).toHaveCount(1); // gallery only
    // Host button defaults must not turn this full-tank hit layer opaque.
    const hitPlane = h.tv!.getByRole("button", { name: "Select a swimming fish to meet its artist" });
    await expect(hitPlane).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(hitPlane).toHaveCSS("border-width", "0px");
    await h.tv!.waitForTimeout(4200);
    await assertPaintedTank(h.tv!);
    await h.tv!.screenshot({ path: `${evidence}/aquarium.png` });
    // A bounded idle soak catches mounting/timer churn after the busy presentation.
    const nodesBefore = await h.tv!.locator("canvas").count();
    await h.tv!.waitForTimeout(60_000);
    expect(await h.tv!.locator("canvas").count()).toBe(nodesBefore);
    await assertPaintedTank(h.tv!);
    expect(await h.tv!.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    final = await finale(h.host, h.code);
    expect(final.phase).toBe("aquarium");
    expect(new Set(final.entries.map(e=>e.id)).size).toBe(count);
    expect(final.entries.map(e=>e.artistName).sort()).toEqual([...h.names].sort());
    await noOverflow(h.tv!);
    expect(mainResult(await read(h.host,h.code))).toEqual(before); await noNewJobs(h);
    expect(h.errors).toEqual([]);
    await writeFile(`${evidence}/observed.json`, JSON.stringify({ count, measuredAt: new Date().toISOString(), performanceSample, introductions: introductions.size, aquariumIdleSeconds: 60, captured: [...captured], shots, eliminationCount: eliminated.length, fullRevival: true, scoresUnchanged: true }, null, 2));
  } finally { await h.close(); }
});
