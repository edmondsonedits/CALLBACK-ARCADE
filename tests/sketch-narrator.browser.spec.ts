import { expect, test, type Browser } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { HostSnapshot } from "../lib/contracts";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };
async function setup(browser: Browser) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
  const phone = await browser.newContext({ baseURL });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false, imageModel: "flux-1-schnell" } });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Danny" } }); expect(joined.status()).toBe(201);
  async function read() { const r = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } }); expect(r.status()).toBe(200); return r.json() as Promise<HostSnapshot>; }
  for (const type of ["ADD_BOT", "ADD_BOT", "START_GAME"]) {
    const s = await read();
    const r = await host.request.post(`/api/rooms/${code}/host-actions`, { headers, data: { type, actionId: crypto.randomUUID(), expectedPhase: s.phase, roundId: s.roundId || "lobby", payload: {} } }); expect(r.status(), await r.text()).toBe(200);
  }
  const page = await host.newPage();
  await page.addInitScript(() => {
    const log: string[] = []; Object.assign(window, { __narratorTestSpeech: log });
    if ("speechSynthesis" in window) { window.speechSynthesis.speak = u => { log.push(u.text); }; window.speechSynthesis.cancel = () => {}; }
  });
  await page.route(`**/api/rooms/${code}/realtime`, r => r.fulfill({ status: 503, json: { error: { message: "Use HTTP for narrator QA" } } }));
  return { host, phone, page, code, read, close: () => Promise.allSettled([host.close(), phone.close()]) };
}

test("host can select all eight moods, keep one after reload, and narrate once per event", async ({ browser }) => {
  const h = await setup(browser);
  try {
    await h.page.goto(`/host/${h.code}`);
    const mood = h.page.getByRole("combobox", { name: "Narrator mood" });
    await expect(mood).toBeVisible(); await expect(mood.locator("option")).toHaveCount(9);
    await mood.selectOption("sassy");
    const caption = h.page.getByTestId("narrator-caption");
    await expect(caption).toHaveAttribute("data-cue-key", /^sassy:/);
    await expect(h.page.getByRole("button", { name: "Voice on", exact: true })).toHaveAttribute("aria-pressed", "true");
    await caption.click();
    const text = await caption.innerText();
    const cueCount = () => h.page.evaluate(line => (window as typeof window & { __narratorTestSpeech: string[] }).__narratorTestSpeech.filter(spoken => spoken === line).length, text);
    await expect.poll(cueCount).toBe(1);
    await h.page.waitForTimeout(2500);
    expect(await cueCount()).toBe(1);
    await h.page.reload(); await expect(mood).toHaveValue("sassy"); await expect(caption).toHaveText(text);
    await expect(h.page.getByRole("button", { name: "Voice on", exact: true })).toHaveAttribute("aria-pressed", "true");
    for (const value of ["nice", "funny", "quirky", "silly", "critical", "analytical", "mean"]) { await mood.selectOption(value); await expect(caption).toHaveAttribute("data-cue-key", new RegExp(`^${value}:`)); }
    await h.page.emulateMedia({ reducedMotion: "reduce" });
    await mood.focus(); await expect(mood).toBeFocused();
    await mkdir(".logs/qa-narrator", { recursive: true });
    await h.page.screenshot({ path: ".logs/qa-narrator/mood-selector-1366.png" });
    expect(await h.page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally { await h.close(); }
});

test("public presentation fixtures name the final submitter but keep anonymous art secret, prioritize time and resume cleanly", async ({ browser }) => {
  const h = await setup(browser);
  try {
    // Authenticated real-room host snapshot; mutate presentation only, never gameplay state.
    const fixture = await h.read(); const game = fixture.sketchRelay!; const d = game.showdown!;
    let revision = fixture.version + 100;
    function show(phase: typeof game.phase, remaining: number, elapsed = 0) {
      fixture.version = fixture.stateVersion = ++revision; fixture.serverTime = Date.now(); fixture.deadlineAt = Date.now() + remaining;
      game.phase = phase; game.deadline = fixture.deadlineAt; d.phaseStartedAt = Date.now() - elapsed; d.phaseDuration = elapsed + remaining;
    }
    show("drawing", 200_000, 40_000); d.pendingPlayers = [fixture.players.find(p => p.nickname === "Danny")!.id];
    await h.page.route(`**/api/rooms/${h.code}/sync`, r => { fixture.serverTime = Date.now(); return r.fulfill({ status: 200, json: fixture }); });
    await h.page.goto(`/host/${h.code}`);
    const caption = h.page.getByTestId("narrator-caption");
    await h.page.getByRole("combobox", { name: "Narrator mood" }).selectOption("quirky");
    await expect(caption).toContainText("Danny", { timeout: 20_000 });
    await expect(h.page.getByRole("button", { name: "Voice on", exact: true })).toHaveAttribute("aria-pressed", "true");
    await caption.click();
    const first = { entryId: "anonymous-A", letter: "A", practice: true, image: { status: "MISSING" as const }, playerId: fixture.players[0]!.id, prompt: "HIDDEN ASSIGNMENT" };
    d.entries = [first, { ...first, entryId: "anonymous-B", letter: "B" }]; d.pendingPlayers = []; d.fallback = false;
    show("showcase", 20_000);
    await expect(caption).toContainText("Drawing A"); await expect(caption).not.toContainText("Danny"); await expect(caption).not.toContainText("HIDDEN ASSIGNMENT");
    show("showcase", 10_000, 10_000); await expect(caption).toContainText("Drawing B");
    show("drawing", 10_000, 230_000); await expect(caption).toContainText(/Ten seconds|[1-9] seconds/);
    fixture.paused = true; fixture.version = fixture.stateVersion = ++revision;
    await expect(caption).toContainText("paused");
    const beforeResume = await h.page.evaluate(() => (window as typeof window & { __narratorTestSpeech: string[] }).__narratorTestSpeech.length);
    fixture.paused = false; fixture.version = fixture.stateVersion = ++revision;
    await expect(caption).toContainText("Back to the exhibition");
    await expect.poll(() => h.page.evaluate((offset) => (window as typeof window & { __narratorTestSpeech: string[] }).__narratorTestSpeech.slice(offset).some(line => line.includes("Back to the exhibition")), beforeResume)).toBe(true);
    const afterResume = await h.page.evaluate((offset) => (window as typeof window & { __narratorTestSpeech: string[] }).__narratorTestSpeech.slice(offset), beforeResume);
    expect(afterResume.some(line => line.includes("paused"))).toBe(false);
  } finally { await h.close(); }
});
