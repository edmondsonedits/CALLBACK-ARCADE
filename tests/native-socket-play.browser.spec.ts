import { expect, test, type Page } from "@playwright/test";

interface SocketTrace { opened: number; matchIds: string[]; roles: string[]; closed: number }

function traceNativeSockets(page: Page): SocketTrace {
  const trace: SocketTrace = { opened: 0, matchIds: [], roles: [], closed: 0 };
  page.on("websocket", (socket) => {
    if (!/\/native-arcade\/[a-f0-9]{64}\/socket$/u.test(socket.url())) return;
    trace.opened += 1;
    socket.on("close", () => { trace.closed += 1; });
    socket.on("framereceived", (frame) => {
      try {
        const message = JSON.parse(String(frame.payload)) as { type?: string; snapshot?: { role?: string; arcade?: { matchId?: string } | null } };
        if (message.type === "snapshot" && message.snapshot?.role) trace.roles.push(message.snapshot.role);
        if (message.type === "snapshot" && message.snapshot?.arcade?.matchId) trace.matchIds.push(message.snapshot.arcade.matchId);
      } catch { /* Non-JSON frames are not part of the room protocol. */ }
    });
  });
  return trace;
}

test("shared native Buzzwort starts, submits over its socket, replays, and reconnects each role", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  const settings = { baseURL, extraHTTPHeaders: { Origin: baseURL! } };
  const phones = await Promise.all([0, 1, 2].map(() => browser.newContext({ ...settings, viewport: { width: 390, height: 844 } })));
  const phonePages = await Promise.all(phones.map((context) => context.newPage()));
  let code: string | null = null;
  const hostTrace = traceNativeSockets(page);
  const phoneTraces = phonePages.map(traceNativeSockets);
  const launch = async () => {
    const current = await (await page.request.get(`/api/sessions/${code}`)).json() as { version: number };
    const response = await page.request.post(`/api/sessions/${code}/host`, { data: { operation: "launch", version: current.version, game: { kind: "main", gameId: "arcade", arcadeGameId: "buzzwort" } } });
    expect(response.status(), await response.text()).toBe(200);
  };

  try {
    const created = await page.request.post("/api/sessions", { data: {} });
    expect(created.status(), await created.text()).toBe(201);
    code = (await created.json() as { code: string }).code;
    for (let index = 0; index < phones.length; index += 1) {
      const joined = await phones[index]!.request.post(`/api/sessions/${code}/join`, { data: { nickname: `Socket Player ${index + 1}` } });
      expect(joined.status(), await joined.text()).toBe(201);
    }
    await page.goto(`/session/${code}/host`);
    await Promise.all(phonePages.map((phone) => phone.goto(`/session/${code}/play`)));
    await launch();

    const hostGame = page.frameLocator("iframe.session-game-frame");
    const phoneGames = phonePages.map((phone) => phone.frameLocator("iframe.session-game-frame"));
    await expect(hostGame.getByRole("button", { name: "Start Game", exact: true })).toBeEnabled();
    await expect.poll(() => hostTrace.opened, { timeout: 15_000, message: "lobby host socket" }).toBeGreaterThan(0);
    for (let index = 0; index < phoneTraces.length; index += 1) await expect.poll(() => phoneTraces[index]!.opened, { timeout: 15_000, message: `lobby phone ${index + 1} socket` }).toBeGreaterThan(0);

    const hostLobbySockets = hostTrace.opened;
    const phoneLobbySockets = phoneTraces.map((trace) => trace.opened);
    await hostGame.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect.poll(() => hostTrace.matchIds.at(-1), { timeout: 20_000, message: "host receives the active match snapshot after reconnect" }).toBeTruthy();
    const firstMatchId = hostTrace.matchIds.at(-1)!;
    await Promise.all(phoneGames.map((frame) => expect(frame.locator(".buzzwort-phone")).toBeVisible()));
    for (let index = 0; index < phoneTraces.length; index += 1) {
      await expect.poll(() => phoneTraces[index]!.matchIds.includes(firstMatchId), { timeout: 20_000, message: `phone ${index + 1} receives its active match snapshot` }).toBe(true);
      await expect.poll(() => phoneTraces[index]!.opened, { timeout: 20_000 }).toBeGreaterThan(phoneLobbySockets[index]!);
    }
    await expect.poll(() => hostTrace.opened, { timeout: 20_000 }).toBeGreaterThan(hostLobbySockets);

    const activeSession = await (await page.request.get(`/api/sessions/${code}`)).json() as { activeGame: { code: string } };
    const childHostCookie = (await page.context().cookies(baseURL)).filter((cookie) => cookie.name === `callback_host_${activeSession.activeGame.code}`);
    expect(childHostCookie, "the host child cookie is issued to the host iframe").toHaveLength(1);
    await phones[0]!.addCookies(childHostCookie);
    const phoneSocketsBeforeReload = phoneTraces[0]!.opened;
    const phoneSnapshotsBeforeReload = phoneTraces[0]!.roles.length;
    await phonePages[0]!.reload();
    await expect.poll(() => phoneTraces[0]!.opened, { timeout: 20_000, message: "phone reconnects with both role cookies present" }).toBeGreaterThan(phoneSocketsBeforeReload);
    await expect.poll(() => phoneTraces[0]!.roles.length, { timeout: 20_000, message: "reconnected phone receives a fresh role snapshot" }).toBeGreaterThan(phoneSnapshotsBeforeReload);
    await expect.poll(() => phoneTraces[0]!.roles.at(-1), { timeout: 20_000, message: "role hint keeps the phone ticket player-scoped" }).toBe("player");
    await expect.poll(() => hostTrace.roles.at(-1), { timeout: 20_000, message: "host ticket stays host-scoped" }).toBe("host");

    let clueGiver = -1;
    for (let index = 0; index < phoneGames.length; index += 1) {
      if (await phoneGames[index]!.locator(".buzzwort-secret-card").isVisible()) { clueGiver = index; break; }
    }
    expect(clueGiver, "one connected phone receives the private card").toBeGreaterThanOrEqual(0);
    const clueFrame = phoneGames[clueGiver]!;
    const taboo = (await clueFrame.locator(".buzzwort-secret-card b").first().innerText()).trim();
    expect(taboo).toBeTruthy();
    await clueFrame.getByLabel("Give your team a clue").fill(`That is ${taboo}`);
    await clueFrame.getByRole("button", { name: "Send clue", exact: true }).click();
    await expect(hostGame.getByRole("heading", { name: /^(Ember|Cobalt) wins$/ })).toBeVisible();
    await expect(hostGame.locator(".buzzwort-card-reveal")).toContainText(taboo);

    const hostResultSockets = hostTrace.opened;
    const phoneResultSockets = phoneTraces.map((trace) => trace.opened);
    await hostGame.getByRole("button", { name: "Play again", exact: true }).click();
    await expect(hostGame.getByRole("button", { name: "Start Game", exact: true })).toBeVisible();
    await expect.poll(() => hostTrace.opened, { timeout: 20_000, message: "host reconnects to replay lobby" }).toBeGreaterThan(hostResultSockets);
    for (let index = 0; index < phoneTraces.length; index += 1) await expect.poll(() => phoneTraces[index]!.opened, { timeout: 20_000, message: `phone ${index + 1} reconnects to replay lobby` }).toBeGreaterThan(phoneResultSockets[index]!);

    const replayLobbyHostSockets = hostTrace.opened;
    const replayLobbyPhoneSockets = phoneTraces.map((trace) => trace.opened);
    await hostGame.getByRole("button", { name: "Start Game", exact: true }).click();
    await expect.poll(() => hostTrace.matchIds.at(-1), { timeout: 20_000, message: "replay starts with a fresh match id" }).not.toBe(firstMatchId);
    const secondMatchId = hostTrace.matchIds.at(-1)!;
    expect(secondMatchId).not.toBe(firstMatchId);
    await expect.poll(() => hostTrace.opened, { timeout: 20_000 }).toBeGreaterThan(replayLobbyHostSockets);
    for (let index = 0; index < phoneTraces.length; index += 1) {
      await expect.poll(() => phoneTraces[index]!.matchIds.includes(secondMatchId), { timeout: 20_000, message: `phone ${index + 1} receives replay match` }).toBe(true);
      await expect.poll(() => phoneTraces[index]!.opened, { timeout: 20_000 }).toBeGreaterThan(replayLobbyPhoneSockets[index]!);
    }
  } finally {
    if (code) {
      const current = await page.request.get(`/api/sessions/${code}`).catch(() => null);
      if (current?.ok()) {
        const session = await current.json() as { version: number };
        await page.request.post(`/api/sessions/${code}/host`, { data: { operation: "close", version: session.version } }).catch(() => null);
      }
    }
    await Promise.allSettled([page.close(), ...phones.map((context) => context.close())]);
  }
});

