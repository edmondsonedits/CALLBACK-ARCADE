import { expect, test, type Page } from "@playwright/test";

async function music(page: Page) {
  return page.locator("audio.host-music-deck").evaluateAll((nodes) => nodes.map((node) => {
    const audio = node as HTMLAudioElement;
    return { src: audio.currentSrc || audio.src, paused: audio.paused, muted: audio.muted, volume: audio.volume };
  }));
}

async function startOverlapAudit(page: Page) {
  await page.evaluate(() => {
    const state = { timer: 0, max: 0 };
    state.timer = window.setInterval(() => {
      const active = [...document.querySelectorAll<HTMLAudioElement>("audio.host-music-deck")]
        .filter((audio) => !audio.paused && !audio.muted && audio.volume > 0.001).length;
      state.max = Math.max(state.max, active);
    }, 15);
    (window as typeof window & { __musicOverlap?: typeof state }).__musicOverlap = state;
  });
}

async function finishOverlapAudit(page: Page) {
  return page.evaluate(() => {
    const state = (window as typeof window & { __musicOverlap?: { timer: number; max: number } }).__musicOverlap;
    if (!state) return 0;
    clearInterval(state.timer);
    return state.max;
  });
}

test("host music rotates without overlap, respects mute, and stays off phones", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("host-rotation-seeded")) {
      localStorage.setItem("king-prompter-menu-preferences:v3", JSON.stringify({ version: 1, soundEnabled: true, volume: 0.2, motion: "reduced" }));
      sessionStorage.setItem("host-rotation-seeded", "true");
    }
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Start Callback" }).click();
  await expect(page.getByRole("heading", { name: "Get everyone together.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Host a game", exact: true }).click();
  await expect(page).toHaveURL(/\/session\/[A-Z2-9]{4}\/host$/);
  await expect.poll(async () => (await music(page)).filter((audio) => !audio.paused && !audio.muted && audio.volume > 0.001).length).toBe(1);
  const initialSource = (await music(page)).find((audio) => !audio.paused)!.src;

  await startOverlapAudit(page);
  await page.evaluate(() => {
    const set = (context: "thinking" | "voting" | "results" | "game") => window.dispatchEvent(new CustomEvent("king-prompter:host-music-phase", {
      detail: { type: "host-music-phase", phase: "game", gameId: "standard", context },
    }));
    set("thinking");
    window.setTimeout(() => set("voting"), 160);
    window.setTimeout(() => set("results"), 320);
    window.setTimeout(() => set("game"), 480);
  });
  await page.waitForTimeout(2400);
  expect(await finishOverlapAudit(page)).toBeLessThanOrEqual(1);
  const active = (await music(page)).filter((audio) => !audio.paused && !audio.muted && audio.volume > 0.001);
  expect(active).toHaveLength(1);
  expect(active[0]!.src).not.toBe(initialSource);
  expect(active[0]!.volume).toBeLessThanOrEqual(0.111);

  const code = new URL(page.url()).pathname.split("/")[2]!;
  const phoneContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const phone = await phoneContext.newPage();
    await phone.emulateMedia({ reducedMotion: "reduce" });
    await phone.goto(`/session/${code}/play`);
    await expect.poll(async () => phone.locator("audio.host-music-deck").evaluateAll((nodes) => nodes.filter((node) => {
      const audio = node as HTMLAudioElement;
      return !audio.paused && !audio.muted && audio.volume > 0;
    }).length)).toBe(0);
  } finally {
    await phoneContext.close();
  }

  await page.getByRole("button", { name: "Mute host music", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unmute host music", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("king-prompter-menu-preferences:v3")!).soundEnabled)).toBe(false);
  await expect.poll(async () => (await music(page)).filter((audio) => !audio.paused && !audio.muted && audio.volume > 0).length).toBe(0);
  await page.reload();
  const muteControl = page.locator("button.host-music-toggle");
  await expect(muteControl).toHaveAttribute("aria-label", /^(Unmute host music|Enable host music)$/);
  await expect.poll(async () => (await music(page)).filter((audio) => !audio.paused && !audio.muted && audio.volume > 0).length).toBe(0);
  await muteControl.click();
  await expect.poll(async () => (await music(page)).filter((audio) => !audio.paused && !audio.muted && audio.volume > 0.001).length).toBe(1);
});
