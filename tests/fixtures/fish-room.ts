import { Buffer } from "node:buffer";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {OwnedPartyRooms} from '../helpers/owned-party-rooms';
import type { HostAction, HostSnapshot, PlayerAction, PlayerSnapshot } from "../../lib/contracts";
import type { FishFinaleAction } from "../../lib/arcade/fish-finale";

export const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
export const headers = { Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };
type Snapshot = HostSnapshot | PlayerSnapshot;
export interface Harness {
  host: BrowserContext;
  phones: BrowserContext[];
  fixture: Page;
  code: string;
  ids: string[];
  names: string[];
  tv?: Page;
  pages: Page[];
  errors: string[];
  browserName: string;
  reloadWindows: Set<Page>;
  navigationDiagnostics: string[];
  close(): Promise<void>;
}

export async function read(context: BrowserContext, code: string): Promise<Snapshot> {
  const response = await context.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}
export async function readPhone(context: BrowserContext, code: string) {
  const snapshot = await read(context, code);
  expect(snapshot.role).toBe("player");
  return snapshot as PlayerSnapshot;
}
export async function finale(context: BrowserContext, code: string) {
  const snapshot = await read(context, code);
  const value = snapshot.fishGame ?? snapshot.sketchRelay?.finale;
  expect(value, "The room should expose its authoritative fish snapshot").toBeTruthy();
  return value!;
}
export async function ordinaryAction(context: BrowserContext, code: string, type: HostAction["type"] | PlayerAction["type"], payload: Record<string, unknown>, host = false) {
  const snapshot = await read(context, code);
  const response = await context.request.post(`/api/rooms/${code}/${host ? "host" : "player"}-actions`, {
    headers, data: { type, actionId: crypto.randomUUID(), roundId: snapshot.roundId ?? "lobby", expectedPhase: snapshot.phase, payload },
  });
  expect(response.status(), await response.text()).toBe(200);
}
export async function gameAction(context: BrowserContext, code: string, type: PlayerAction["type"], payload: Record<string, unknown>) {
  const match = (await read(context, code)).sketchRelay!;
  await ordinaryAction(context, code, type, { matchId: match.matchId, round: match.round, ...payload });
}
export async function nextMain(h: Harness) {
  const match = (await read(h.host, h.code)).sketchRelay!;
  await ordinaryAction(h.host, h.code, "ADVANCE_SKETCH_RELAY", { matchId: match.matchId, round: match.round, phase: match.phase, transition: "next" }, true);
}
export async function fishAction(context: BrowserContext, code: string, type: FishFinaleAction["type"], fields: Record<string, unknown> = {}, expectedStatus = 200, actionId = crypto.randomUUID()) {
  const state = await finale(context, code);
  const response = await context.request.post(`/api/rooms/${code}/fish`, {
    headers, data: { actionId, type, payload: { matchId: state.matchId, finaleId: state.finaleId, phase: state.phase, ...fields } },
  });
  expect(response.status(), await response.text()).toBe(expectedStatus);
  return response;
}
export async function setup(browser: Browser, count = 3, settings: {sorceryLength?: "quick"|"long"; arcadeGameId?: "sketch-relay" | "fish-tank"} = {}): Promise<Harness> {
  const ownedRooms=new OwnedPartyRooms();
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
  const phones: BrowserContext[] = [];
  const names = ["Zoë Longname 🐟", "Morgan", "Sam", "River", "Sky", "Avery", "Charlie", "Finley", "Harper", "Jordan"].slice(0, count);
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: settings.arcadeGameId ?? "sketch-relay", contentMode: "party", timerAccessibility: false, imageModel: "flux-1-schnell", ...settings } });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  await ownedRooms.track(host,code,baseURL);
  const ids: string[] = [];
  for (const [index, nickname] of names.entries()) {
    const phone = await browser.newContext({ baseURL, viewport: { width: index ? 390 : 320, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: index ? 1 : 2 });
    phones.push(phone);
    const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname } });
    expect(joined.status(), await joined.text()).toBe(201);
    ids.push((await readPhone(phone, code)).selfId);
  }
  const fixture = await host.newPage();
  const h: Harness = { host, phones, fixture, code, ids, names, pages: [], errors: [], browserName: browser.browserType().name(), reloadWindows: new Set(), navigationDiagnostics: [], close: async () => { await ownedRooms.closeAll();await Promise.allSettled([host.close(), ...phones.map(phone => phone.close())]); } };
  await ordinaryAction(host, code, "START_GAME", {}, true);
  return h;
}

/** Real browser PNG encoding gives the upload decoder a valid RGBA8 stream. */
export async function art(page: Page, fish: boolean, variant = 0) {
  const encoded = await page.evaluate(({ fish, variant }) => {
    const canvas = document.createElement("canvas");
    canvas.width = fish ? 1024 : 480; canvas.height = fish ? 768 : 480;
    const ctx = canvas.getContext("2d")!;
    if (!fish) { ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.fillStyle = ["#196fe6", "#d65494", "#36aa80"][variant % 3]!;
    ctx.beginPath(); ctx.ellipse(canvas.width * .52, canvas.height * .5, canvas.width * .26, canvas.height * .23, 0, 0, Math.PI * 2); ctx.fill();
    // A visible external fin and an opaque white interior mark exercise both alpha and retained detail.
    ctx.beginPath(); ctx.moveTo(canvas.width * .48, canvas.height * .32); ctx.lineTo(canvas.width * .57, canvas.height * .12); ctx.lineTo(canvas.width * .65, canvas.height * .38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(canvas.width * .68, canvas.height * .45, canvas.width * .035, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#102342"; ctx.beginPath(); ctx.arc(canvas.width * .69, canvas.height * .45, canvas.width * .013, 0, Math.PI * 2); ctx.fill();
    return canvas.toDataURL("image/png").split(",")[1]!;
  }, { fish, variant });
  return Buffer.from(encoded, "base64");
}
export async function drawEditorFish(page: Page) {
  const editor = page.getByRole("region", { name: "Fish drawing editor", exact: true });
  await expect(editor).toBeVisible();
  const intro = editor.getByRole("button", { name: "Got it", exact: true });
  if (await intro.isVisible()) await intro.click();
  await expect(editor.getByRole("button", { name: "Send fish", exact: true })).toBeDisabled();
  const canvas = editor.getByRole("img", { name: "Your fish. Its head faces right and tail faces left.", exact: true });
  await editor.getByRole("button", { name: "Use #529AFF", exact: true }).click();
  await editor.getByRole("button", { name: "Fill", exact: true }).click();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width * .53, bounds.y + bounds.height * .5);
  await editor.getByRole('button',{name:'Use #FFFFFF',exact:true}).click();
  await editor.getByRole("button", { name: "Body", exact: true }).click();
  await editor.getByRole("button", { name: "Brush", exact: true }).click();
  const settings = editor.getByRole("region", { name: "Tool settings" });
  await settings.getByRole("slider", { name: "Brush size", exact: true }).fill("44");
  await settings.getByRole("button", { name: /^Done/ }).click();
  const artboard = (await canvas.boundingBox())!;
  for (const [x, y] of [[665, 330], [465, 185]]) {
    await page.mouse.click(artboard.x + artboard.width * x / 1024, artboard.y + artboard.height * y / 768);
  }
  await editor.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Redo", exact: true })).toBeEnabled();
  await editor.getByRole("button", { name: "Redo", exact: true }).click();
  await editor.getByRole("button", { name: "Preview swim", exact: true }).click();
  await expect(editor.getByText("Swim check · your artwork stays unchanged", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Back to drawing", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.screenshot({ path: ".logs/playwright-artifacts/fish-editor-external-parts.png", fullPage: true });
  const sent = page.waitForResponse(response => response.url().endsWith("/fish/upload") && response.request().method() === "POST");
  await editor.getByRole("button", { name: "Send fish", exact: true }).click();
  const response = await sent; expect(response.status()).toBe(200);
  const actionId = response.request().headers()["x-fish-action-id"]!;
  await expect(page.getByRole("heading", { name: "Your fish is saved!", exact: true })).toBeVisible();
  const link = await page.getByRole("link", { name: "Open my fish image ↗" }).getAttribute("href");
  const assetId = link!.split("/").at(-1)!; expect(assetId).toMatch(/^fish_[a-f0-9]{64}$/);
  // Read the acknowledged immutable asset through the artist's own session.
  // WebKit does not expose binary fetch request bodies through postDataBuffer.
  const stored = await page.context().request.get(link!); expect(stored.status()).toBe(200);
  const bytes = await stored.body();
  const dimensions = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(dimensions.getUint32(16)).toBe(1024); expect(dimensions.getUint32(20)).toBe(768);
  return { bytes, actionId, assetId };
}
export async function inspectFishPixels(page: Page, bytes: Buffer) {
  const pixels = await page.evaluate(async encoded => {
    const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data];
    return { corner: pixel(0, 0), water: pixel(100, 384), body: pixel(550, 400), whiteEye: pixel(665, 330), externalFin: pixel(465, 185) };
  }, btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join("")));
  expect(pixels.corner[3]).toBe(0); expect(pixels.water[3]).toBe(0);
  expect(pixels.body).toEqual([82, 154, 255, 255]);
  expect(pixels.whiteEye).toEqual([255, 255, 255, 255]); expect(pixels.externalFin).toEqual([255, 255, 255, 255]);
}
export async function uploadMain(h: Harness, phone: BrowserContext, bytes: Buffer) {
  const snapshot = await readPhone(phone, h.code), match = snapshot.sketchRelay!;
  const response = await phone.request.post(`/api/rooms/${h.code}/sketch`, {
    headers: { ...headers, "Content-Type": "image/png", "X-Sketch-Match": match.matchId, "X-Sketch-Round": String(match.round), "X-Sketch-Chain": match.self!.chainId, "X-Sketch-Leg": "drawing", "X-Sketch-Prompt-Index": "0", "X-Sketch-Action-Id": crypto.randomUUID() }, data: bytes,
  });
  expect(response.status(), await response.text()).toBe(200);
}
export async function drainJobs(h: Harness) {
  for (let i = 0; i < 12; i++) {
    const response = await h.host.request.post(`/api/rooms/${h.code}/jobs/run`, { headers, data: {} });
    if (response.status() === 204) return;
    expect([200, 202], await response.text()).toContain(response.status());
    const result = await response.json() as { status: string; live?: boolean };
    expect(result.live, "This no-provider browser run must not generate live paid artwork").not.toBe(true);
  }
  throw new Error("The baseline image job queue did not drain");
}
/** Complete the supported three-human match through authenticated production endpoints. */
export async function completeMain(h: Harness) {
  if ((await read(h.host, h.code)).fishGame) return;
  const bytes = await art(h.fixture, false);
  const expected = Object.fromEntries(h.ids.map(id => [id, 0]));
  for (let step = 0; step < 110; step++) {
    const snapshot = await read(h.host, h.code), match = snapshot.sketchRelay!;
    switch (match.phase) {
      case "complete": {
        expect(match.totalRounds).toBe(3); expect(match.round).toBe(3); expect(snapshot.phase).toBe("ARCADE_RESULTS");
        expect(match.scores).toEqual(expected); expect(match.finale).toBeUndefined();
        await drainJobs(h); return;
      }
      case "prompt-writing":
        for (const [index, phone] of h.phones.entries()) await gameAction(phone, h.code, "SUBMIT_SKETCH_PROMPT", { prompt: `A royal duck delivering a suspicious sandwich number ${index}` });
        break;
      case "prompt-voting":
        for (const phone of h.phones) {
          const own = (await readPhone(phone, h.code)).sketchRelay!.showdown!;
          await gameAction(phone, h.code, "RANK_SKETCH_PROMPTS", { ranking: own.promptOptions!.filter(option => option.id !== own.ownPromptId).slice(0, 3).map(option => option.id) });
        }
        break;
      case "curse-selection": {
        const curse = match.showdown!.curse!;
        await gameAction(h.phones[h.ids.indexOf(curse.chooserId)]!, h.code, "CHOOSE_SKETCH_CURSE", { curse: curse.options[0] }); break;
      }
      case "final-preparation":
        for (const phone of h.phones) await gameAction(phone, h.code, "PREPARE_SKETCH_FINAL", { modifier: "tiny", starter: "shield" });
        break;
      case "drawing": for (const phone of h.phones) await uploadMain(h, phone, bytes); break;
      case "transforming": await drainJobs(h); break;
      case "laughter-voting": {
        const owners = new Map<string, string>();
        for (const phone of h.phones) { const own = await readPhone(phone, h.code); owners.set(own.sketchRelay!.showdown!.ownEntryId!, own.selfId); }
        for (const phone of h.phones) {
          const own = (await readPhone(phone, h.code)).sketchRelay!.showdown!;
          const ranking = own.entries.filter(entry => entry.entryId !== own.ownEntryId).slice(0, 3).map(entry => entry.entryId);
          for (const [index, entry] of ranking.entries()) expected[owners.get(entry)!]! += [100, 75, 50][index]! * match.round;
          await gameAction(phone, h.code, "RANK_SKETCH_LAUGHTER", { ranking });
        }
        break;
      }
      case "artist-guessing": for (const phone of h.phones) await gameAction(phone, h.code, "GUESS_SKETCH_ARTISTS", { guesses: [] }); break;
      case "showcase": case "revealing": case "round-results": case "halfway": await nextMain(h); break;
      default: throw new Error(`Unexpected v3 phase ${match.phase}`);
    }
  }
  throw new Error("The supported three-round main match did not finish");
}
function capturePageError(h: Harness, page: Page, error: Error) {
  // WebKit reports an old in-flight poll canceled by explicit navigation as a
  // pageerror. Only classify the known read-only polling URLs while awaiting a fresh healthy sync.
  const canceledPolls = ["sync", "realtime", "display-status"].map(endpoint => `/${new URL(baseURL).host}/api/rooms/${h.code}/${endpoint} due to access control checks.`);
  if (h.browserName === "webkit" && h.reloadWindows.has(page) && canceledPolls.includes(error.message)) {
    h.navigationDiagnostics.push(error.message); return;
  }
  h.errors.push(error.message);
}
export async function reloadScreen(h: Harness, page: Page) {
  h.reloadWindows.add(page);
  try {
    await page.reload();
    await page.waitForResponse(response => new URL(response.url()).pathname === `/api/rooms/${h.code}/sync` && [200, 204].includes(response.status()));
  } finally { h.reloadWindows.delete(page); }
}
export async function openScreens(h: Harness) {
  h.tv = await h.host.newPage();
  h.tv.on("pageerror", error => capturePageError(h, h.tv!, error));
  await h.tv.goto(`/host/${h.code}`);
  for (const phone of h.phones) { const page = await phone.newPage(); page.on("pageerror", error => capturePageError(h, page, error)); await page.goto(`/play/${h.code}`); h.pages.push(page); }
}
export function mainResult(snapshot: Snapshot) {
  if ("arcadeGameId" in snapshot && snapshot.arcadeGameId === "fish-tank") return { game: "fish-tank", mainResults: snapshot.results, playerScores: snapshot.players.map(player => player.score ?? 0) };
  const main = { ...snapshot.sketchRelay! }; delete main.finale;
  return { main, arcade: snapshot.arcade, results: snapshot.results, phase: snapshot.phase };
}
export async function openFish(h: Harness, mode: "peaceful" | "shark") {
  if ((await read(h.host, h.code)).fishGame) {
    await fishAction(h.host, h.code, "FISH_CONFIGURE", { mode, drawingSeconds: 90 });
    await fishAction(h.host, h.code, "FISH_START");
    await fishAction(h.host, h.code, "FISH_ADVANCE");
    expect((await finale(h.host, h.code)).phase).toBe("drawing");
    return;
  }
  const match = (await read(h.host, h.code)).sketchRelay!;
  const response = await h.host.request.post(`/api/rooms/${h.code}/fish`, { headers, data: { actionId: crypto.randomUUID(), type: "FISH_OPEN", payload: { matchId: match.matchId } } });
  expect(response.status(), await response.text()).toBe(200);
  expect((await finale(h.host, h.code)).mode).toBe("peaceful");
  await fishAction(h.host, h.code, "FISH_CONFIGURE", { mode, drawingSeconds: 90 });
  await fishAction(h.host, h.code, "FISH_START");
  await fishAction(h.host, h.code, "FISH_ADVANCE");
  expect((await finale(h.host, h.code)).phase).toBe("drawing");
}
export async function uploadFish(h: Harness, phone: BrowserContext, bytes: Buffer, actionId = crypto.randomUUID(), expectedStatus = 200) {
  const state = await finale(phone, h.code);
  const response = await phone.request.post(`/api/rooms/${h.code}/fish/upload`, { headers: { ...headers, "Content-Type": "image/png", "X-Fish-Match": state.matchId, "X-Fish-Finale": state.finaleId, "X-Fish-Action-Id": actionId }, data: bytes });
  expect(response.status(), await response.text()).toBe(expectedStatus);
  return response;
}
export async function waitFishPhase(h: Harness, allowed: string[], timeout = 125_000) {
  await expect.poll(async () => allowed.includes((await finale(h.host, h.code)).phase), { timeout, intervals: [500, 1000] }).toBe(true);
  return finale(h.host, h.code);
}
export async function toReveal(h: Harness) {
  // Missing submissions deliberately wait for the real server drawing + grace clocks.
  return waitFishPhase(h, ["reveal", "closed"], 130_000);
}
export async function noNewJobs(h: Harness) {
  const snapshot = await read(h.host, h.code);
  expect(snapshot.sketchImageJobs ?? [], "Fish must never enqueue a sketch transform").toEqual([]);
  expect(snapshot.imageJobsPending, "Fish must never enqueue an image provider job").toBe(false);
}

export async function setupFish(browser: Browser, count = 3): Promise<Harness> {
  return setup(browser, count, { arcadeGameId: "fish-tank" });
}
export async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
}
export async function finishPresentation(h: Harness) {
  let state = await finale(h.host, h.code);
  if (state.phase === "cinematic") { await fishAction(h.host, h.code, "FISH_SKIP"); state = await finale(h.host, h.code); }
  if (state.phase === "champion") { await fishAction(h.host, h.code, "FISH_ADVANCE"); state = await finale(h.host, h.code); }
  if (state.phase === "artists") await fishAction(h.host, h.code, "FISH_ADVANCE");
  return finale(h.host, h.code);
}
