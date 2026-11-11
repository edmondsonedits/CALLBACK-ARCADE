import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { baseURL, completeMain, finale, mainResult, noNewJobs, noOverflow, openFish, openScreens, read, setupFish, toReveal, uploadFish } from "./fixtures/fish-room";

const showcaseFiles = ["sunburst.png", "moonfin.png", "mosskip.png"] as const;
const evidence = ".logs/fish-acceptance/runtime-six";

async function normalizeFishPng(page: Page, source: Buffer, hue?: number): Promise<Buffer> {
  const base64 = Buffer.from(source).toString("base64");
  const encoded = await page.evaluate(async ({ base64, hue }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 768;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    context.filter = hue === undefined ? "none" : `hue-rotate(${hue}deg)`;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1]!;
  }, { base64, hue });
  return Buffer.from(encoded, "base64");
}

// Large original PNG request bodies and video are retained separately from tracing.
test.use({ trace: "off", screenshot: "off" });

test("six humans submit single-PNG fish and complete the natural shark showcase", async ({ browser }) => {
  test.setTimeout(480_000);
  const h = await setupFish(browser, 6);
  await mkdir(evidence, { recursive: true });
  let recordingContext: BrowserContext | undefined;
  let recording: Awaited<ReturnType<Page["video"]>> = null;
  try {
    await completeMain(h);
    const originalMain = mainResult(await read(h.host, h.code));
    await openScreens(h);
    await openFish(h, "shark");

    // These concept images are local QA inputs only. Variants exist in memory
    // for this room and do not become bundled view assets or generation jobs.
    const sourcePngs = await Promise.all(showcaseFiles.map(file => readFile(new URL(`../assets/source/fish/showcase-v1/${file}`, import.meta.url))));
    const uploads = [
      ...await Promise.all(sourcePngs.map(png => normalizeFishPng(h.fixture, png))),
      ...await Promise.all(sourcePngs.map((png, index) => normalizeFishPng(h.fixture, png, [105, 205, 305][index]!))),
    ];
    expect(uploads).toHaveLength(6);
    for (const [index, phone] of h.phones.entries()) {
      await uploadFish(h, phone, uploads[index]!);
      expect((await finale(phone, h.code)).self!.submitted).toBe(true);
    }

    // Recording begins at the first release, after actual normal room deadlines.
    const firstReveal = await toReveal(h);
    expect(firstReveal.phase).toBe("reveal");
    const savedHostState = await h.host.storageState();
    await h.tv!.close();
    recordingContext = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: evidence, size: { width: 1280, height: 720 } },
      storageState: savedHostState,
    });
    const tv = await recordingContext.newPage();
    tv.setDefaultTimeout(15_000);
    h.tv = tv;
    tv.on("pageerror", error => h.errors.push(error.message));
    recording = tv.video();
    await tv.goto(`/host/${h.code}`);

    await tv.bringToFront();
    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-phase", "reveal", { timeout: 15_000 });
    const introduced = new Set<string>();
    let reveal = await finale(h.host, h.code);
    const revealDeadline = Date.now() + 45_000;
    while (reveal.phase === "reveal") {
      expect(Date.now()).toBeLessThan(revealDeadline);
      for (const id of reveal.revealedEntryIds) introduced.add(id);
      await tv.waitForTimeout(350);
      reveal = await finale(h.host, h.code);
    }
    expect(reveal.phase).toBe("voting");
    expect(introduced.size).toBe(6);
    expect(reveal.entries).toHaveLength(6);
    expect(reveal.entries.every(entry => Boolean(entry.assetId) && !entry.practice)).toBe(true);
    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-phase", "voting", { timeout: 15_000 });
    const renderer = tv.locator("[data-fish-renderer]");
    await expect(renderer).toHaveAttribute("data-fish-renderer", "webgl", { timeout: 15_000 });
    await expect(renderer).toHaveAttribute("data-fish-volume", "single-png", { timeout: 15_000 });
    const budget = await tv.getByTestId("fish-mesh").evaluate(c=>({width:(c as HTMLCanvasElement).width,height:(c as HTMLCanvasElement).height}));
    expect(budget.width).toBeLessThanOrEqual(1280);expect(budget.height).toBeLessThanOrEqual(720);
    await tv.screenshot({ path: `${evidence}/voting.png` });
    await noOverflow(tv);
    const motionSample = await tv.evaluate(async () => {
      const values:number[]=[];let last=performance.now();
      await new Promise<void>(resolve=>{const frame=(now:number)=>{values.push(now-last);last=now;if(values.length===180)resolve();else requestAnimationFrame(frame)};requestAnimationFrame(frame)});
      const sorted=values.slice(1).sort((a,b)=>a-b);return {frames:sorted.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1)};
    });
    await tv.waitForTimeout(4000);

    // Lock each ballot through its phone UI. The final ballot can immediately
    // enter the cinematic, so verify its authoritative lock in the snapshot.
    for (let index = 0; index < h.pages.length; index++) {
      const phone = h.pages[index]!;
      phone.setDefaultTimeout(15_000);
      await expect(phone.getByRole("heading", { name: "Which fish do you love?", exact: true })).toBeVisible({ timeout: 15_000 });
      const choices = phone.getByRole("button", { name: /^Fish [A-Z].*\+$/ });
      await expect(choices).toHaveCount(5, { timeout: 15_000 });
      for (let choice = 0; choice < 3; choice++) await choices.nth(choice).click();
      await phone.getByRole("button", { name: "Lock 3 favourites", exact: true }).click();
      await expect.poll(async () => (await finale(h.phones[index]!, h.code)).self?.ballotLocked).toBe(true);
      if (index < h.pages.length - 1) await expect(phone.getByRole("heading", { name: "Favourites locked.", exact: true })).toBeVisible({ timeout: 15_000 });
    }
    await tv.bringToFront();
    await expect.poll(async () => (await finale(h.host, h.code)).phase === "cinematic", { timeout: 15_000 }).toBe(true);

    const eliminated: string[] = [];
    const captured = new Set<string>();
    let sawPaintFragments=false;
    const cinematicDeadline = Date.now() + 90_000;
    let state = await finale(h.host, h.code);
    while (state.phase === "cinematic") {
      expect(Date.now()).toBeLessThan(cinematicDeadline);
      expect(state.result).toBeUndefined();
      const fragmentCount=Number(await renderer.getAttribute("data-fish-fragments"));
      if(fragmentCount>0){sawPaintFragments=true;if(!captured.has("paint-burst")){captured.add("paint-burst");await tv.screenshot({path:`${evidence}/paint-burst.png`});}}
      const event = state.cinematic?.event;
      expect(event).toBeDefined();
      for (const id of state.cinematic!.eliminatedEntryIds) if (!eliminated.includes(id)) eliminated.push(id);
      if (event!.kind === "hunt" && !captured.has("hunt")) {
        captured.add("hunt");
        await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-event", "hunt", { timeout: 15_000 });
        await tv.screenshot({ path: `${evidence}/hunt.png` });
      }
      if (event!.kind === "final-two" && !captured.has("final-two")) {
        captured.add("final-two");
        await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-event", "final-two", { timeout: 15_000 });
        await tv.screenshot({ path: `${evidence}/final-two.png` });
      }
      await tv.waitForTimeout(175);
      state = await finale(h.host, h.code);
    }
    expect(state.phase).toBe("champion");
    expect(state.result).toBeDefined();
    expect(eliminated).toHaveLength(5);
    expect(sawPaintFragments,"the actual submitted artwork must scatter during a bite").toBe(true);
    expect(eliminated).toEqual(state.result!.ranking.slice(1).reverse().map(row => row.entryId));
    expect(captured.has("hunt")).toBe(true);
    expect(captured.has("final-two")).toBe(true);
    await expect(tv.getByTestId("fish-champion")).toBeVisible({ timeout: 15_000 });
    await expect(tv.getByTestId("fish-champion")).toHaveCSS("opacity","1");
    await tv.screenshot({ path: `${evidence}/champion.png` });

    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-phase", "artists", { timeout: 15_000 });
    await expect(tv.getByRole("heading", { name: "Every fish. Every imagination.", exact: true })).toBeVisible();
    expect((await finale(h.host, h.code)).entries.map(entry => entry.artistName).sort()).toEqual([...h.names].sort());
    await tv.screenshot({ path: `${evidence}/artists.png` });

    await expect(tv.getByTestId("fish-tank")).toHaveAttribute("data-phase", "aquarium", { timeout: 15_000 });
    await expect(tv.getByText("Everyone’s back!", { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(tv.getByRole("button", { name: /^Meet / })).toHaveCount(6);
    await tv.waitForTimeout(4500);
    await tv.screenshot({ path: `${evidence}/aquarium.png` });

    const completed = await finale(h.host, h.code);
    expect(completed.phase).toBe("aquarium");
    expect(completed.entries).toHaveLength(6);
    expect(completed.entries.map(entry => entry.artistName).sort()).toEqual([...h.names].sort());
    expect(mainResult(await read(h.host, h.code))).toEqual(originalMain);
    await noNewJobs(h);
    for (const page of [tv, ...h.pages]) await noOverflow(page);
    expect(h.errors).toEqual([]);
    await writeFile(`${evidence}/observed.json`,JSON.stringify({motionSample,paintFragments:sawPaintFragments,fish:6,eliminations:5,revival:true,onlySinglePngSubmissions:true,mainScoresUnchanged:true},null,2));
  } finally {
    try {
      await recordingContext?.close();
      if (recording) await recording.saveAs(`${evidence}/runtime-six-demo.webm`);
    } finally { await h.close(); }
  }
});
