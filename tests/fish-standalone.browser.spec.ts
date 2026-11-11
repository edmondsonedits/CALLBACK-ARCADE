import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { OwnedPartyRooms } from "./helpers/owned-party-rooms";
import { art } from "./fixtures/fish-room";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };
const rooms = new OwnedPartyRooms();
test.afterEach(() => rooms.closeAll());

test("The Last Fish Swimming launches from the persistent party menu with an independent fish lifecycle", async ({ browser }) => {
  test.setTimeout(180_000);
  const host: BrowserContext = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
  const hostPage = await host.newPage();
  const phones: BrowserContext[] = [];
  const pageErrors: string[] = [];
  hostPage.on("pageerror", error => pageErrors.push(error.message));
  let sessionCode = "";
  try {
    const created = await host.request.post("/api/sessions", { headers, data: {} });
    expect(created.status(), await created.text()).toBe(201);
    sessionCode = (await created.json()).code;
    await hostPage.goto(`/session/${sessionCode}/host`);
    for (let i = 0; i < 3; i++) {
      const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      phones.push(phone);
      const page = await phone.newPage();
      page.on("pageerror", error => pageErrors.push(error.message));
      const joined = await phone.request.post(`/api/sessions/${sessionCode}/join`, { headers, data: { nickname: `Fish friend ${i + 1}` } });
      expect(joined.status(), await joined.text()).toBe(201);
      expect((await phone.request.get(`/api/sessions/${sessionCode}?role=player`, { headers })).status()).toBe(200);
      expect((await phone.request.get("/api/profile", { headers })).status()).toBe(200);
      expect((await phone.request.get("/api/profile/creations", { headers })).status()).toBe(200);
      await page.goto(`/session/${sessionCode}/play`);
    }

    const tile = hostPage.getByRole("button", { name: /The Last Fish Swimming/ });
    await expect(tile).toBeEnabled();
    await tile.click();
    const hostFrame = hostPage.frameLocator("iframe.session-game-frame");
    await hostFrame.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(hostFrame.getByRole("region", { name: "Fish game shared screen" })).toBeVisible({ timeout: 20_000 });
    const active = await host.request.get(`/api/sessions/${sessionCode}`, { headers });
    expect(active.status()).toBe(200);
    const activeGame = (await active.json()).activeGame as { code: string; title: string };
    expect(activeGame.title).toBe("The Last Fish Swimming");
    const code = activeGame.code;
    await rooms.track(host, code, baseURL);
    const childPlayer = await phones[0]!.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
    expect(childPlayer.status(), await childPlayer.text()).toBe(200);
    const firstPlayerId = (await childPlayer.json()).selfId as string;

    const playerViews = await Promise.all(phones.map(phone => phone.request.get(`/api/sessions/${sessionCode}?role=player`, { headers })));
    for (const response of playerViews) expect(response.status()).toBe(200);
    const initialResponse = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
    expect(initialResponse.status()).toBe(200);
    const initial = await initialResponse.json() as { phase: string; arcadeGameId: string; fishGame?: { matchId: string; finaleId: string; phase: string; drawingSeconds: number }; sketchRelay?: unknown };
    expect(initial).toMatchObject({ phase: "ARCADE_ACTIVE", arcadeGameId: "fish-tank", sketchRelay: null });
    expect(initial.fishGame).toMatchObject({ phase: "configure", drawingSeconds: 240 });

    await hostFrame.getByRole("button", { name: /Shark showdown/ }).click();
    await hostFrame.getByLabel("Drawing time").selectOption("90");
    await hostFrame.getByRole("button", { name: "Start fish game →" }).click();
    await expect(hostFrame.getByRole("button", { name: "Start drawing" })).toBeVisible();
    await hostFrame.getByRole("button", { name: "Start drawing" }).click();
    await expect(hostFrame.getByTestId("fish-tank")).toHaveAttribute("data-phase", "drawing");
    const phoneFrame = phones[0]!.pages()[0]!.frameLocator("iframe.session-game-frame");
    await expect(phoneFrame.getByRole("region", { name: "Fish drawing editor" })).toBeVisible({ timeout: 20_000 });
    const permission = phoneFrame.getByRole("checkbox", { name: /previous fish visit/ });
    await expect(permission).toBeVisible();
    await permission.check();
    const savedPermission = await phones[0]!.request.post(`/api/rooms/${code}/creations`, { headers, data: { allowHistory: true } });
    expect(savedPermission.status(), await savedPermission.text()).toBe(200);

    const drawingResponse = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
    expect(drawingResponse.status()).toBe(200);
    const drawing = await drawingResponse.json() as { fishGame: { matchId: string; finaleId: string; phase: string; mode: string; drawingSeconds: number }; arcade?: unknown; sketchRelay?: unknown };
    expect(drawing.fishGame).toMatchObject({ phase: "drawing", mode: "shark", drawingSeconds: 90 });
    expect(drawing).toMatchObject({ arcade: { gameId: "fish-tank" }, sketchRelay: null });

    const png = await art(hostPage, true);
    const uploaded = await phones[0]!.request.post(`/api/rooms/${code}/fish/upload`, { headers: { ...headers, "Content-Type": "image/png", "X-Fish-Match": drawing.fishGame.matchId, "X-Fish-Finale": drawing.fishGame.finaleId, "X-Fish-Action-Id": randomUUID() }, data: png });
    expect(uploaded.status(), await uploaded.text()).toBe(200);
    await expect.poll(async () => {
      const response = await phones[0]!.request.get("/api/profile/creations", { headers });
      expect(response.status()).toBe(200);
      const body = await response.json() as { creations: Array<{ kind: string; title: string }> };
      return body.creations.some(item => item.kind === "fish" && item.title === "Previous fish");
    }, { timeout: 12_000 }).toBe(true);

    const shared = await phones[0]!.request.get(`/api/rooms/${code}/creations`, { headers });
    expect(shared.status(), await shared.text()).toBe(200);
    const sharedAssets = await shared.json() as { assets: Array<{ kind: string }> };
    expect(sharedAssets.assets).toEqual([]); // Current-match fish stay in the authoritative finale, not the historical pool.

    await hostFrame.getByRole("button", { name: "Finish fish game", exact: true }).click();
    const playAgain = hostFrame.getByText("Play again", { exact: true });
    await expect(playAgain).toBeVisible({ timeout: 10_000 });
    await playAgain.click();
    await expect.poll(async () => {
      const response = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
      expect(response.status()).toBe(200);
      return (await response.json()).phase;
    }, { timeout: 10_000, intervals: [1000, 2000] }).toBe("LOBBY");
    const lobbyResponse = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
    expect(lobbyResponse.status()).toBe(200);
    expect(await lobbyResponse.json()).toMatchObject({ phase: "LOBBY", arcade: null, fishGame: null, sketchRelay: null });
    await hostFrame.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect(hostFrame.getByRole("region", { name: "Fish game shared screen" })).toBeVisible({ timeout: 20_000 });
    const replayConfigure = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
    const replayState = await replayConfigure.json() as { fishGame?: { matchId: string; phase: string; drawingSeconds: number } };
    expect(replayState.fishGame?.phase).toBe("configure");
    expect(replayState.fishGame?.matchId).not.toBe(initial.fishGame?.matchId);
    await hostFrame.getByRole("button", { name: /Peaceful tank/ }).click();
    await hostFrame.getByLabel("Drawing time").selectOption("360");
    await hostFrame.getByRole("button", { name: "Start fish game →" }).click();
    await expect(hostFrame.getByRole("button", { name: "Start drawing" })).toBeVisible();
    const returningPool = await phones[0]!.request.get(`/api/rooms/${code}/creations`, { headers });
    expect(returningPool.status(), await returningPool.text()).toBe(200);
    const fishForReturners = (await returningPool.json() as { assets: Array<{ kind: string; participantId: string }> }).assets.filter(asset => asset.kind === "fish");
    expect(fishForReturners).toEqual([expect.objectContaining({ participantId: firstPlayerId })]);
    expect(pageErrors).toEqual([]);
  } finally {
    if (sessionCode) {
      try {
        const response = await host.request.get(`/api/sessions/${sessionCode}`, { headers });
        if (response.ok()) {
          const view = await response.json() as { version: number };
          await host.request.post(`/api/sessions/${sessionCode}/host`, { headers, data: { operation: "close", version: view.version } });
        }
      } catch { /* Preserve the actual browser failure as the test result. */ }
    }
    await Promise.allSettled([host.close(), ...phones.map(phone => phone.close())]);
  }
});
