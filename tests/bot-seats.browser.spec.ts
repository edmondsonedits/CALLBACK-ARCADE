import { expect, test, type Browser } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };

async function createRoom(browser: Browser, gameLength: "standard" | "pictures" | "king-mystery") {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const created = await host.request.post("/api/rooms", { headers, data: { gameLength, contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  return { host, code };
}

test("main bot seats replace with phone identities and restore the requested bot across supported packs", async ({ browser }) => {
  for (const gameLength of ["standard", "pictures", "king-mystery"] as const) {
    const { host, code } = await createRoom(browser, gameLength);
    const page = await host.newPage();
    try {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto(`/host/${code}`);
      const botOne = page.getByRole("switch", { name: "Bot 1", exact: true });
      await expect(botOne).toBeVisible();
      await expect(botOne).toHaveAttribute("aria-checked", "false");
      await botOne.click();
      await expect(botOne).toHaveAttribute("aria-checked", "true");
      let toggleState = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json() as { botSeats: number[]; players: unknown[]; phase: string; roundId: string };
      expect(toggleState.botSeats).toContain(1);
      await expect(page.getByText("LOCAL BOT")).toBeVisible();

      for (let slot = 2; slot <= 10; slot += 1) {
        const action = await host.request.post(`/api/rooms/${code}/host-actions`, { headers, data: { type: "SET_BOT_SEAT", actionId: crypto.randomUUID(), roundId: toggleState.roundId, expectedPhase: toggleState.phase, payload: { seat: slot, enabled: true } } });
        expect(action.status(), await action.text()).toBe(200);
      }
      toggleState = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json() as typeof toggleState;
      expect(toggleState.botSeats).toHaveLength(10);

      const phone = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
      const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Phone Friend" } });
      expect(joined.status(), await joined.text()).toBe(201);
      const afterJoin = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json() as { players: Array<{ id: string; nickname: string; bot?: boolean; seat: number; lobbySlot?: number }>; botSeats: number[]; roundId: string; phase: string };
      expect(afterJoin.players).toEqual(expect.arrayContaining([expect.objectContaining({ nickname: "Phone Friend", seat: 11, lobbySlot: 1 })]));
      expect(afterJoin.players.find((player) => player.nickname === "Phone Friend")?.bot).not.toBe(true);
      expect(afterJoin.players.some((player) => player.lobbySlot === 1 && player.bot)).toBe(false);
      expect(afterJoin.botSeats).toContain(1);
      await expect(page.getByRole("switch", { name: "Bot 1", exact: true })).toHaveCount(0);

      const human = afterJoin.players.find((player) => player.nickname === "Phone Friend")!;
      const removed = await host.request.post(`/api/rooms/${code}/host-actions`, { headers, data: { type: "REMOVE_PLAYER", actionId: crypto.randomUUID(), roundId: afterJoin.roundId, expectedPhase: afterJoin.phase, payload: { playerId: human.id } } });
      expect(removed.status(), await removed.text()).toBe(200);
      const afterLeave = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json() as { players: Array<{ nickname: string; bot?: boolean; seat: number; lobbySlot?: number }> };
      expect(afterLeave.players).toEqual(expect.arrayContaining([expect.objectContaining({ nickname: "Party Bot 6", seat: 12, lobbySlot: 1, bot: true })]));
      await expect(page.getByRole("switch", { name: "Bot 1", exact: true })).toHaveAttribute("aria-checked", "true");
      const returningPhone = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
      const rejoined = await returningPhone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Phone Friend" } });
      expect(rejoined.status(), await rejoined.text()).toBe(201);
      const rejoinedBody = await rejoined.json() as { id: string };
      expect(rejoinedBody.id).not.toBe(human.id);
      const afterRejoin = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json() as { players: Array<{ id: string; nickname: string; seat: number; lobbySlot?: number }> };
      const returningHuman = afterRejoin.players.find((player) => player.id === rejoinedBody.id)!;
      expect(returningHuman).toMatchObject({ nickname: "Phone Friend", seat: 13 });
      expect(returningHuman.lobbySlot).toBeGreaterThanOrEqual(1);
      expect(returningHuman.lobbySlot).toBeLessThanOrEqual(10);
      expect(afterRejoin.players.filter((player) => player.id !== returningHuman.id && player.lobbySlot === returningHuman.lobbySlot)).toHaveLength(0);
      await returningPhone.close();
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      await phone.close();
    } finally {
      await host.close();
    }
  }
});

test("an audience joins an active game on a distinct historical seat without retiring a player", async ({ browser }) => {
  const { host, code } = await createRoom(browser, "standard");
  const firstPhone = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const secondPhone = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const audiencePhone = await browser.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  try {
    const firstJoin = await firstPhone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Player One" } });
    const secondJoin = await secondPhone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Player Two" } });
    expect(firstJoin.status(), await firstJoin.text()).toBe(201);
    expect(secondJoin.status(), await secondJoin.text()).toBe(201);
    const initial = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json() as { roundId: string; phase: string; players: Array<{ id: string; role: string; seat: number; lobbySlot?: number }> };
    const start = await host.request.post(`/api/rooms/${code}/host-actions`, { headers, data: { type: "START_GAME", actionId: crypto.randomUUID(), roundId: initial.roundId, expectedPhase: initial.phase, payload: {} } });
    expect(start.status(), await start.text()).toBe(200);

    const playerView = await (await firstPhone.request.post(`/api/rooms/${code}/sync`, { headers: { ...headers, "X-Callback-Role": "player" }, data: { version: 0 } })).json() as { role: string; selfId: string };
    expect(playerView.role).toBe("player");
    const spectator = await audiencePhone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Watcher", audience: true } });
    expect(spectator.status(), await spectator.text()).toBe(201);
    expect((await spectator.json() as { role: string }).role).toBe("audience");

    const unchangedPlayer = await (await firstPhone.request.post(`/api/rooms/${code}/sync`, { headers: { ...headers, "X-Callback-Role": "player" }, data: { version: 0 } })).json() as { selfId: string };
    expect(unchangedPlayer.selfId).toBe(playerView.selfId);
    const audienceView = await (await audiencePhone.request.post(`/api/rooms/${code}/sync`, { headers: { ...headers, "X-Callback-Role": "player" }, data: { version: 0 } })).json() as { role: string; players: Array<{ id: string; role: string; seat: number; lobbySlot?: number }> };
    expect(audienceView.role).toBe("audience");
    const human = audienceView.players.find((player) => player.id === playerView.selfId)!;
    const spectatorRow = audienceView.players.find((player) => player.role === "audience")!;
    expect(human.seat).toBe(1);
    expect(spectatorRow.seat).toBe(3);
    expect(spectatorRow.lobbySlot).toBeUndefined();
  } finally {
    await Promise.all([host, firstPhone, secondPhone, audiencePhone].map((context) => context.close()));
  }
});

test("solo creation with three bots keeps four distinct identities and logical slots", async ({ browser }) => {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  try {
    const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "standard", contentMode: "party", timerAccessibility: false, soloMode: true, soloPlayerName: "Solo Host", botCount: 3 } });
    expect(created.status(), await created.text()).toBe(201);
    const { code } = await created.json() as { code: string };
    const snapshot = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json() as { players: Array<{ id: string; nickname: string; bot?: boolean; seat: number; lobbySlot?: number }> };
    expect(snapshot.players).toHaveLength(4);
    expect(new Set(snapshot.players.map((player) => player.id)).size).toBe(4);
    expect(snapshot.players.filter((player) => player.bot).map((player) => player.lobbySlot)).toEqual([2, 3, 4]);
    expect(snapshot.players.map((player) => player.seat)).toEqual([1, 2, 3, 4]);
  } finally {
    await host.close();
  }
});
