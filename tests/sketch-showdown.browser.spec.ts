import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { HostSnapshot, PlayerSnapshot, PlayerAction, HostAction } from "../lib/contracts";
import { mkdir } from "node:fs/promises";
import {OwnedPartyRooms} from './helpers/owned-party-rooms';
const ownedRooms=new OwnedPartyRooms();
test.afterEach(()=>ownedRooms.closeAll());

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };
const artifacts = ".logs/qa-sketch-showdown";
async function read(context: BrowserContext, code: string) { const response = await context.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } }); expect(response.status(), await response.text()).toBe(200); return response.json() as Promise<HostSnapshot | PlayerSnapshot>; }
async function readPhone(context: BrowserContext, code: string) { const snap = await read(context, code); expect(snap.role).toBe("player"); return snap as PlayerSnapshot; }
async function action(context: BrowserContext, code: string, type: PlayerAction["type"] | HostAction["type"], payload: Record<string, unknown> = {}, host = false) {
  const snap = await read(context, code); const r = await context.request.post(`/api/rooms/${code}/${host ? "host" : "player"}-actions`, { headers, data: { type, actionId: crypto.randomUUID(), expectedPhase: snap.phase, roundId: snap.roundId ?? "lobby", payload } }); expect(r.status(), await r.text()).toBe(200); return r;
}
async function gameAction(context: BrowserContext, code: string, type: PlayerAction["type"], payload: Record<string, unknown>) { const s = (await read(context, code)).sketchRelay!; return action(context, code, type, { matchId: s.matchId, round: s.round, ...payload }); }
async function hostNext(context: BrowserContext, code: string) { const s = (await read(context, code)).sketchRelay!; await action(context, code, "ADVANCE_SKETCH_RELAY", { matchId: s.matchId, round: s.round, phase: s.phase, transition: "next" }, true); if(s.phase === "round-results" && s.showdown?.workshop) { const next=(await read(context, code)).sketchRelay!; if(next.phase === "round-results") { expect(next.showdown?.workshop?.intermission).toBe(true); await action(context,code,"ADVANCE_SKETCH_RELAY",{matchId:next.matchId,round:next.round,phase:next.phase,transition:"next"},true); } } }
async function setup(browser: Browser, humans: number, bots = 0) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } }); const phones: BrowserContext[] = []; const pages: Page[] = [];
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false, imageModel: "flux-1-schnell" } }); expect(created.status(), await created.text()).toBe(201); const { code } = await created.json() as { code: string };await ownedRooms.track(host,code,baseURL);
  for (let i = 0; i < humans; i++) { const phone = await browser.newContext({ baseURL, viewport: { width: i === 0 ? 320 : 390, height: 844 } }); phones.push(phone); const join = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: ["Danny", "Morgan", "Sam", "Alex"][i] ?? `Artist ${i}` } }); expect(join.status()).toBe(201); pages.push(await phone.newPage()); }
  for (let i = 0; i < bots; i++) await action(host, code, "ADD_BOT", {}, true);
  await action(host, code, "START_GAME", {}, true);
  const tv = await host.newPage(); await tv.addInitScript(() => { const log: string[] = []; Object.assign(window, { __sketchSpoken: log }); if ("speechSynthesis" in window) { window.speechSynthesis.speak = u => { log.push(u.text); }; window.speechSynthesis.cancel = () => {}; } });
  // Exercise the supported HTTP fallback deterministically, including delayed TV polls.
  await tv.route(`**/api/rooms/${code}/realtime`, route => route.fulfill({ status: 503, json: { error: { message: "Testing HTTP sync fallback" } } }));
  await tv.goto(`/host/${code}`); for (const page of pages) await page.goto(`/play/${code}`);
  return { host, phones, pages, tv, code, close: async () => { await Promise.allSettled([host.close(), ...phones.map(p => p.close())]); } };
}
async function phase(context: BrowserContext, code: string, expected: string) { await expect.poll(async () => (await read(context, code)).sketchRelay?.phase, { timeout: 20_000 }).toBe(expected); }
async function draw(page: Page, index = 0) { await page.bringToFront(); const canvas = page.getByTestId("sketch-canvas"); await expect(canvas).toBeVisible(); const b = (await canvas.boundingBox())!; const x = b.x + b.width * .3, y = b.y + b.height * .3; await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + b.width * .35, y + b.height * .25, { steps: 14 }); await page.mouse.move(x + b.width * .12, y + b.height * (.35 + index * .025), { steps: 10 }); await page.mouse.up(); await page.getByRole("button", { name: "Done", exact: true }).click(); const uploaded = page.waitForResponse(r => r.url().endsWith("/sketch") && r.request().method() === "POST", { timeout: 15_000 }); await page.getByRole("button", { name: "Send sketch", exact: true }).click(); const response = await uploaded; expect(response.status()).toBe(200); await expect(page.getByTestId("sketch-canvas")).not.toBeVisible(); }
async function noOverflow(page: Page) { const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })); expect(size.scroll).toBeLessThanOrEqual(size.client + 1); }
async function artistPose(page: Page) {
  return page.getByTestId("revealed-artist-avatar").evaluate(element => [...element.querySelectorAll('[data-puppet-joint]')].map(joint => Number(joint.getAttribute("transform")?.match(/rotate\(([-\d.]+)/)?.[1] ?? 0)));
}
async function winnerMoves(tv: Page, phone: Page, host: BrowserContext, code: string) {
  let delayed = false;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await tv.route(`**/api/rooms/${code}/sync`, async route => {
    delayed = true; await gate;
    await route.continue();
  });
  try {
    await tv.emulateMedia({ reducedMotion: "no-preference" });
    // Wait until the TV's next poll is held, so no earlier in-flight poll can
    // deliver the move before the deliberate transport delay has elapsed.
    await expect.poll(() => delayed).toBe(true);
    await phone.getByRole("button", { name: "Dance", exact: true }).click();
    await expect(phone.getByText("Dance sent. Watch your avatar on the TV.", { exact: true })).toBeVisible();
    await tv.bringToFront();
    await new Promise(resolve => setTimeout(resolve, 3500)); release();
    await expect(tv.getByTestId("revealed-artist-avatar")).toHaveAttribute("data-emote", "dance");
    await expect.poll(async () => (await artistPose(tv)).some(angle => Math.abs(angle) > 20), { timeout: 2000 }).toBe(true);
    await tv.screenshot({ path: `${artifacts}/tv-winner-dance.png` });
    await tv.waitForTimeout(3000);
    expect((await artistPose(tv)).every(angle => angle === 0)).toBe(true);
    for (const [name, emote] of [["Cheer", "cheer"], ["Wave", "wave"], ["Take a bow", "bow"], ["Who, me?", "shrug"], ["Facepalm", "facepalm"]]) {
      const current = (await read(host, code)).sketchRelay!;
      await action(host, code, "ADVANCE_SKETCH_RELAY", { matchId: current.matchId, round: current.round, phase: current.phase, transition: "replay" }, true);
      await phone.getByRole("button", { name, exact: true }).click();
      await tv.bringToFront();
      await expect(tv.getByTestId("revealed-artist-avatar")).toHaveAttribute("data-emote", emote!);
      await expect.poll(async () => (await artistPose(tv)).some(angle => Math.abs(angle) > 12), { timeout: 3000 }).toBe(true);
    }
    await tv.emulateMedia({ reducedMotion: "reduce" });
    await phone.getByRole("button", { name: "Cheer", exact: true }).click();
    await tv.bringToFront();
    await expect(tv.getByTestId("revealed-artist-avatar")).toHaveAttribute("data-emote", "cheer");
    await expect.poll(async () => (await artistPose(tv)).some(angle => Math.abs(angle) > 80)).toBe(true);
    const heldPose = await artistPose(tv); await tv.waitForTimeout(400); expect(await artistPose(tv)).toEqual(heldPose);
    await tv.screenshot({ path: `${artifacts}/tv-winner-reduced-motion.png` });
  } finally { release(); await tv.unrouteAll({ behavior: "wait" }); }
}

test("four phones complete all three rounds with anonymous ranked ballots, artist bonuses, avatar controls and narration", async ({ browser }) => {
  test.setTimeout(240_000); await mkdir(artifacts, { recursive: true }); const h = await setup(browser, 4);
  try {
    const errors: string[] = []; h.tv.on("pageerror", e => errors.push(e.message));
    await h.tv.getByRole("button", { name: "Open host controls" }).click();
    const controls = h.tv.getByRole("dialog", { name: "Host controls" }); await expect(controls).toBeVisible();
    await expect(controls.getByRole("button", { name: "End game", exact: true })).toHaveCount(0);
    await expect(controls.getByText(/Finish the exhibition/)).toBeVisible(); await controls.getByRole("button", { name: "Close controls" }).click();
    await expect(h.tv.getByRole("button", { name: "Voice on", exact: true })).toHaveAttribute("aria-pressed", "true");
    await h.pages[0]!.getByLabel("Your drawing prompt").fill("A wizard delivering a very suspicious pizza"); await h.pages[0]!.getByRole("button", { name: "Add my prompt" }).click();
    for (let i = 1; i < h.phones.length; i++) await gameAction(h.phones[i]!, h.code, "SUBMIT_SKETCH_PROMPT", { prompt: `A dragon arguing with ${["a toaster", "a parking meter", "a sandwich"][i - 1]}` });
    await phase(h.host, h.code, "prompt-voting");
    const cards = h.pages[0]!.locator('section[aria-label="Sketch and Sorcery controller"] button[aria-pressed]'); await cards.nth(0).click(); await cards.nth(1).click(); await cards.nth(2).click(); await h.pages[0]!.getByRole("button", { name: "Lock 3 favourites", exact: true }).click();
    for (const phone of h.phones.slice(1)) { const s = (await readPhone(phone, h.code)).sketchRelay!; await gameAction(phone, h.code, "RANK_SKETCH_PROMPTS", { ranking: s.showdown!.promptOptions!.filter(p => p.id !== s.showdown!.ownPromptId).slice(0, 3).map(p => p.id) }); }
    const expected = new Map<string, number>();
    for (const round of [1, 2, 3]) {
      if (round === 2) {
        await phase(h.host, h.code, "curse-selection");
        const curse = (await read(h.host, h.code)).sketchRelay!.showdown!.curse!;
        const chooser = (await Promise.all(h.phones.map(async phone => ({ phone, id: (await readPhone(phone, h.code)).selfId })))).find(p => p.id === curse.chooserId)!;
        const chooserPage = h.pages[h.phones.indexOf(chooser.phone)]!;
        await expect(chooserPage.getByRole("heading", { name: "Choose everyone's curse." })).toBeVisible();
        await noOverflow(chooserPage); await gameAction(chooser.phone, h.code, "CHOOSE_SKETCH_CURSE", { curse: curse.options[0] });
      }
      if (round === 3) {
        await phase(h.host, h.code, "final-preparation");
        await expect(h.pages[0]!.getByRole("heading", { name: "Make the final your own." })).toBeVisible();
        await h.pages[0]!.getByRole("button", { name: "At a royal banquet", exact: true }).click();
        await h.pages[0]!.getByRole("button", { name: "dragon", exact: true }).click();
        await h.pages[0]!.getByRole("button", { name: "Lock my final assignment" }).click();
        for (const phone of h.phones.slice(1)) await gameAction(phone, h.code, "PREPARE_SKETCH_FINAL", { modifier: "tiny", starter: "shield" });
      }
      await phase(h.host, h.code, "drawing"); const shared = (await read(h.host, h.code)).sketchRelay!.showdown!.prompt;
      const assignment = (await read(h.phones[0]!, h.code)).sketchRelay!.self!;
      if (round === 3) { expect(assignment.prompt).toBe(`${shared} — at a royal banquet`); expect(assignment.restriction).toBeUndefined(); expect(assignment.starter).toBe("dragon"); }
      else expect(assignment.prompt).toBe(shared);
      if (round === 1) { await noOverflow(h.pages[0]!); await h.pages[0]!.reload(); await expect(h.pages[0]!.getByTestId("sketch-canvas")).toBeVisible(); await h.tv.screenshot({ path: `${artifacts}/tv-drawing.png` }); }
      for (const [i, page] of h.pages.entries()) await draw(page, i);
      await phase(h.host, h.code, "showcase"); await expect(h.tv.locator('[data-phase="showcase"]')).toBeVisible();
      if (round === 1) {
        const art = await h.tv.locator('[data-phase="showcase"] img').first().boundingBox();
        expect(art!.height).toBeGreaterThan(500); expect(art!.width).toBeGreaterThan(900);
        await expect(h.tv.locator('[data-phase="showcase"] main')).toHaveCSS("opacity", "1");
        await h.tv.screenshot({ path: `${artifacts}/tv-showcase.png` });
      } await hostNext(h.host, h.code);
      await phase(h.host, h.code, "laughter-voting"); const owner = new Map<string, string>();
      for (const phone of h.phones) { const snap = await readPhone(phone, h.code); owner.set(snap.sketchRelay!.showdown!.ownEntryId!, snap.selfId); if (!expected.has(snap.selfId)) expected.set(snap.selfId, 0); }
      const publicGallery = (await read(h.host, h.code)).sketchRelay!; for (const entry of publicGallery.showdown!.entries) { expect(entry.playerId).toBeUndefined(); expect(entry.prompt).toBeUndefined(); expect(entry.starter).toBeUndefined(); }
      if (round === 1) { await expect(h.pages[0]!.getByRole("heading", { name: "Rank your favourite drawings." })).toBeVisible(); await noOverflow(h.pages[0]!); await h.pages[0]!.screenshot({ path: `${artifacts}/phone-ballot-320.png`, fullPage: true }); await h.tv.screenshot({ path: `${artifacts}/tv-gallery.png` }); }
      for (const phone of h.phones) { const snap = await readPhone(phone, h.code); const ranking = snap.sketchRelay!.showdown!.entries.filter(e => e.entryId !== snap.sketchRelay!.showdown!.ownEntryId).slice(0, 3).map(e => e.entryId); for (const [i, id] of ranking.entries()) expected.set(owner.get(id)!, expected.get(owner.get(id)!)! + [100, 75, 50][i]! * round); await gameAction(phone, h.code, "RANK_SKETCH_LAUGHTER", { ranking }); }
      await phase(h.host, h.code, "artist-guessing");
      for (const phone of h.phones) { const snap = await readPhone(phone, h.code); const guesses = snap.sketchRelay!.showdown!.laughterRanking!.map(entryId => ({ entryId, playerId: owner.get(entryId)! })); expected.set(snap.selfId, expected.get(snap.selfId)! + guesses.length * 50 * round); await gameAction(phone, h.code, "GUESS_SKETCH_ARTISTS", { guesses }); }
      await phase(h.host, h.code, "revealing");
      if (round === 1) { const reveal = (await read(h.host, h.code)).sketchRelay!.showdown!.revealEntry!; const performerIndex = await Promise.all(h.phones.map(async p => (await readPhone(p, h.code)).selfId)).then(ids => ids.indexOf(reveal.playerId!)); const performer = h.pages[performerIndex]!;
        await expect(performer.getByRole("heading", { name: "Take the stage!" })).toBeVisible(); await performer.getByRole("button", { name: "Dance", exact: true }).click(); await expect(h.tv.getByTestId("revealed-artist-avatar")).toHaveAttribute("data-emote", "dance"); await expect.poll(() => h.tv.getByTestId("revealed-artist-avatar").evaluate(element => element.querySelector("svg")?.getBoundingClientRect().height ?? 0)).toBeGreaterThan(140);
        await expect(h.pages[(performerIndex + 1) % 4]!.getByRole("button", { name: "Dance", exact: true })).toHaveCount(0);
        await h.tv.screenshot({ path: `${artifacts}/tv-artist-reveal.png` }); await performer.screenshot({ path: `${artifacts}/phone-performance.png`, fullPage: true });
      }
      let checkedWinner = false;
      while ((await read(h.host, h.code)).sketchRelay!.phase === "revealing") {
        const current = (await read(h.host, h.code)).sketchRelay!.showdown!.revealEntry!;
        if (round === 1 && current.place === 1 && !checkedWinner) {
          const performerIndex = await Promise.all(h.phones.map(async p => (await readPhone(p, h.code)).selfId)).then(ids => ids.indexOf(current.playerId!));
          await expect(h.pages[performerIndex]!.getByRole("heading", { name: "Take the stage!" })).toBeVisible();
          await expect(h.tv.getByTestId("revealed-artist-avatar")).toHaveAttribute("data-player-id", current.playerId!);
          await winnerMoves(h.tv, h.pages[performerIndex]!, h.host, h.code); checkedWinner = true;
        }
        await hostNext(h.host, h.code);
      }
      const score = (await read(h.host, h.code)).sketchRelay!.scores; for (const [id, points] of expected) expect(score[id]).toBe(points);
      await hostNext(h.host, h.code); if (round < 3) { await phase(h.host, h.code, "halfway"); await expect(h.tv.getByRole("heading", { name: round === 1 ? "One down. Two to draw." : "One last spell." })).toBeVisible(); await h.tv.screenshot({ path: `${artifacts}/tv-halfway.png` }); await hostNext(h.host, h.code); }
    }
    await phase(h.host, h.code, "complete"); await expect(h.tv.getByRole("heading", { name: "Art happened. Somehow." })).toBeVisible(); await h.tv.screenshot({ path: `${artifacts}/tv-final.png` });
    const spoken = await h.tv.evaluate(() => (window as unknown as { __sketchSpoken: string[] }).__sketchSpoken); expect(spoken.some(line => line.includes("four minutes"))).toBe(true); expect(spoken.some(line => /Danny|Morgan|Sam|Alex/.test(line))).toBe(true);
    await noOverflow(h.tv); expect(errors).toEqual([]);
  } finally { await h.close(); }
});

test("ten-player gallery fits 16:9 and the narrow controller preserves accessible ranking controls", async ({ browser }) => {
  test.setTimeout(150_000); await mkdir(artifacts, { recursive: true }); const h = await setup(browser, 1, 9);
  try {
    await gameAction(h.phones[0]!, h.code, "SUBMIT_SKETCH_PROMPT", { prompt: "A duck attempting royal diplomacy" }); await phase(h.host, h.code, "prompt-voting");
    const g = (await read(h.phones[0]!, h.code)).sketchRelay!; await gameAction(h.phones[0]!, h.code, "RANK_SKETCH_PROMPTS", { ranking: g.showdown!.promptOptions!.filter(p => p.id !== g.showdown!.ownPromptId).slice(0, 3).map(p => p.id) }); await phase(h.host, h.code, "drawing");
    await draw(h.pages[0]!); await phase(h.host, h.code, "showcase"); await hostNext(h.host, h.code); await phase(h.host, h.code, "laughter-voting");
    await expect(h.tv.getByTestId('showdown-gallery').locator(':scope > figure')).toHaveCount(10); await noOverflow(h.tv); const bounds = await h.tv.locator('[data-phase="laughter-voting"]').boundingBox(); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(769);
    await h.tv.screenshot({ path: `${artifacts}/tv-gallery-ten.png` }); await h.pages[0]!.emulateMedia({ reducedMotion: "reduce" }); await noOverflow(h.pages[0]!);
    const hitSize = await h.pages[0]!.locator('button[aria-pressed]').first().boundingBox(); expect(hitSize!.height).toBeGreaterThanOrEqual(44);
    const ballot = (await readPhone(h.phones[0]!, h.code)).sketchRelay!; await gameAction(h.phones[0]!, h.code, "RANK_SKETCH_LAUGHTER", { ranking: ballot.showdown!.entries.filter(e => e.entryId !== ballot.showdown!.ownEntryId).slice(0, 3).map(e => e.entryId) }); await phase(h.host, h.code, "artist-guessing"); await gameAction(h.phones[0]!, h.code, "GUESS_SKETCH_ARTISTS", { guesses: [] }); await phase(h.host, h.code, "revealing"); while ((await read(h.host, h.code)).sketchRelay!.phase === "revealing") await hostNext(h.host, h.code);
    await expect(h.tv.getByRole("list", { name: "Scores", exact: true })).toBeVisible(); await h.tv.screenshot({ path: `${artifacts}/tv-scoreboard-ten.png` }); const lastScore = await h.tv.getByRole("list", { name: "Scores", exact: true }).locator("li").last().boundingBox(); const footer = await h.tv.locator("footer").last().boundingBox(); expect(lastScore!.y + lastScore!.height).toBeLessThanOrEqual(footer!.y + 1);
  } finally { await h.close(); }
});

test("all 100 drawing ideas can be browsed and borrowing the final one preserves original-prompt priority", async ({ browser }) => {
  await mkdir(artifacts, { recursive: true });
  const h = await setup(browser, 3);
  try {
    const ideas = (await readPhone(h.phones[0]!, h.code)).sketchRelay!.showdown!.examples;
    expect(ideas).toHaveLength(100);
    const phone = h.pages[0]!; await phone.getByText("Browse 100 drawing ideas", { exact: true }).click();
    const choices=phone.getByLabel('Browse 100 ideas');await expect(choices.locator('option')).toHaveCount(100);await choices.selectOption('99');await phone.getByRole('button',{name:'Use this idea',exact:true}).click();
    await expect(phone.getByLabel("Your drawing prompt")).toHaveValue(ideas[99]!.text);
    await expect(phone.getByRole('region',{name:'Drawing ideas',exact:true})).toHaveCount(0);
    await phone.screenshot({ path: `${artifacts}/phone-prompt-catalogue-320.png`, fullPage: true });
    await phone.getByRole("button", { name: "Add my prompt", exact: false }).click();
    for (const [i, context] of h.phones.slice(1).entries()) await gameAction(context, h.code, "SUBMIT_SKETCH_PROMPT", { prompt: `A suspicious parking meter number ${i}` });
    await phase(h.host, h.code, "prompt-voting");
    const options = (await read(h.host, h.code)).sketchRelay!.showdown!.promptOptions!;
    expect(options.find(p => p.text === ideas[99]!.text)?.original).toBe(false);
    expect(options.filter(p => p.text.startsWith("A suspicious parking meter")).every(p => p.original)).toBe(true);
    await noOverflow(phone);
  } finally { await h.close(); }
});

test("a stalled PNG encoder releases Sending and preserves the sketch for a successful retry", async ({ browser }) => {
  test.setTimeout(120_000); const h = await setup(browser, 1, 2);
  try {
    await gameAction(h.phones[0]!, h.code, "SUBMIT_SKETCH_PROMPT", { prompt: "A knight arguing with a sandwich" }); await phase(h.host, h.code, "prompt-voting");
    const g = (await readPhone(h.phones[0]!, h.code)).sketchRelay!; await gameAction(h.phones[0]!, h.code, "RANK_SKETCH_PROMPTS", { ranking: g.showdown!.promptOptions!.filter(p => p.id !== g.showdown!.ownPromptId).slice(0, 3).map(p => p.id) }); await phase(h.host, h.code, "drawing");
    const page = h.pages[0]!; await page.bringToFront(); await expect(page.getByTestId("sketch-canvas")).toBeVisible();
    await page.evaluate(() => { const original = HTMLCanvasElement.prototype.toBlob; let stalled = false; HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) { if (!stalled) { stalled = true; return; } original.call(this, callback, type, quality); }; });
    const box = (await page.getByTestId("sketch-canvas").boundingBox())!; await page.mouse.move(box.x + box.width * .3, box.y + box.height * .3); await page.mouse.down(); await page.mouse.move(box.x + box.width * .6, box.y + box.height * .6, { steps: 10 }); await page.mouse.up();
    await page.getByRole("button", { name: "Done", exact: true }).click(); await page.getByRole("button", { name: "Send sketch", exact: true }).click();
    await expect(page.getByText("Preparing the image took too long. Your drawing is saved; please try sending again.", { exact: true })).toBeVisible({ timeout: 15_000 }); await expect(page.getByRole("button", { name: "Done", exact: true })).toBeEnabled(); await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Done", exact: true }).click(); const uploaded = page.waitForResponse(r => r.url().endsWith("/sketch") && r.request().method() === "POST", { timeout: 15_000 }); await page.getByRole("button", { name: "Send sketch", exact: true }).click(); expect((await uploaded).status()).toBe(200); await expect(page.getByTestId("sketch-canvas")).not.toBeVisible();
  } finally { await h.close(); }
});


test("regular drawing phone toolbar fits short screens and suppresses long-press selection", async ({ browser }) => {
  const h = await setup(browser, 3);
  try {
    for (const phone of h.phones) await gameAction(phone, h.code, "SUBMIT_SKETCH_PROMPT", { prompt: "Dog standing on a dog at a royal banquet" });
    await phase(h.host, h.code, "prompt-voting");
    for (const phone of h.phones) await gameAction(phone, h.code, "RANK_SKETCH_PROMPTS", { ranking: [] });
    await phase(h.host, h.code, "drawing");
    const page = h.pages[0]!;
    const studio = page.getByTestId("drawing-studio");
    await expect(studio).toBeVisible();
    for (const [width,height] of [[320,480],[375,600],[390,664],[412,700],[568,320],[844,390]]) {
      await page.setViewportSize({width,height});
      await expect.poll(() => studio.evaluate(e=>Math.round(e.getBoundingClientRect().height))).toBe(height);
      const metrics = await studio.evaluate(root => {
        const canvas = root.querySelector('canvas')!.getBoundingClientRect();
        const buttons = [...root.querySelectorAll('button')].filter(el => el.getBoundingClientRect().width > 0 && !el.closest('dialog'));
        return { canvasHeight:canvas.height, overflow:document.documentElement.scrollWidth > innerWidth,
          hidden: buttons.filter(el=>{const r=el.getBoundingClientRect(); const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x < -1 || r.right > innerWidth+1 || r.y < -1 || r.bottom > innerHeight+1 || !hit || !el.contains(hit);}).map(el=>el.textContent),
          selectable: buttons.filter(el=>{const css=getComputedStyle(el);return (css.getPropertyValue('user-select')||css.getPropertyValue('-webkit-user-select')) !== 'none';}).map(el=>el.textContent) };
      });
      expect(metrics,`${width}x${height}`).toMatchObject({overflow:false,hidden:[],selectable:[]});
      expect(metrics.canvasHeight).toBeGreaterThan(70);
      const suppressed = await page.getByRole('button',{name:'Pen',exact:true}).evaluate(el=>!el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})));
      expect(suppressed).toBe(true);
    }
    await page.setViewportSize({width:390,height:664});
    await mkdir('.logs/fish-acceptance/phone-fit',{recursive:true});
    await page.screenshot({path:'.logs/fish-acceptance/phone-fit/regular-drawing.png'});
  } finally { await h.close(); }
});
