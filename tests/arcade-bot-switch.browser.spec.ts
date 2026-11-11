import { expect, test } from '@playwright/test';

test('host bot switches persist, disappear for phones and produce a zero-bot round', async ({ browser, baseURL }) => {
  const settings = { baseURL, extraHTTPHeaders: { Origin: baseURL! } };
  const host = await browser.newContext({ ...settings, viewport: { width: 1366, height: 768 } });
  const phones = await Promise.all([0, 1].map(() => browser.newContext({ ...settings, viewport: { width: 390, height: 844 } })));
  try {
    const created = await host.request.post('/api/arcade/online/rooms', { data: { gameId: 'sumo', options: {} } });
    expect(created.status()).toBe(201);
    const room = await created.json() as { code: string; hostUrl: string };
    const tv = await host.newPage(); await tv.goto(room.hostUrl);
    await expect(tv.getByRole('switch')).toHaveCount(10);
    for (let index = 1; index <= 10; index++) {
      const toggle = tv.getByRole('switch', { name: `Bot ${index}`, exact: true });
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
      await toggle.click(); await expect(toggle).toHaveAttribute('aria-checked', 'false');
    }
    await expect(tv.getByRole('button', { name: /at least 2 contestants/i })).toBeDisabled();
    await tv.reload(); await expect(tv.getByRole('switch', { name: 'Bot 10', exact: true })).toHaveAttribute('aria-checked', 'false');
    for (let index = 0; index < 2; index++) {
      const page = await phones[index].newPage(); await page.goto(`/arcade/online/join/${room.code}`);
      await page.getByLabel('Your name').fill(`Human ${index + 1}`);
      await page.getByRole('button', { name: 'Join game', exact: true }).click();
      await expect(page.getByText('Waiting for the host', { exact: false })).toBeVisible();
    }
    await expect(tv.getByRole('switch')).toHaveCount(8);
    await expect(tv.getByRole('switch', { name: 'Bot 1', exact: true })).toHaveCount(0);
    await tv.screenshot({ path: '.logs/qa-bots/online-zero-bots-lobby.png' });
    await tv.getByRole('button', { name: 'Start match', exact: true }).click();
    await expect(tv.locator('.online-score-strip > span')).toHaveCount(2);
    await expect(tv.locator('.online-score-strip')).not.toContainText('BOT');
    await tv.getByRole('button', { name: 'Pause', exact: true }).click();
    const state = await (await host.request.get(`/api/arcade/online/rooms/${room.code}`)).json() as { activeIds: string[]; botEnabled: Record<string, boolean> };
    expect(state.activeIds).toEqual(['00', '01']); expect(Object.values(state.botEnabled).every(value => !value)).toBe(true);
    await host.request.post(`/api/arcade/online/rooms/${room.code}/host`, { data: { operation: 'lobby' } });
    await expect(tv.getByRole('button', { name: 'Remove Human 1', exact: true })).toBeVisible();
    await tv.getByRole('button', { name: 'Remove Human 1', exact: true }).click();
    await expect(tv.getByRole('switch', { name: 'Bot 1', exact: true })).toHaveAttribute('aria-checked', 'false');
    const toggle = tv.getByRole('switch', { name: 'Bot 1', exact: true }); await toggle.focus(); await toggle.press('Space');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  } finally { await Promise.allSettled([host.close(), ...phones.map(context => context.close())]); }
});

test('a new shared-lobby phone waits for the next round instead of entering an excluded seat', async ({ browser, baseURL }) => {
  const options = { baseURL, extraHTTPHeaders: { Origin: baseURL! } };
  const host = await browser.newContext(options);
  const phones = await Promise.all([0, 1, 2].map(() => browser.newContext(options)));
  try {
    const created = await host.request.post('/api/sessions', { data: {} }); expect(created.status()).toBe(201);
    const session = await created.json() as { code: string; version: number };
    for (let index = 0; index < 2; index++) expect((await phones[index].request.post(`/api/sessions/${session.code}/join`, { data: { nickname: `Phone ${index + 1}` } })).status()).toBe(201);
    const current = await (await host.request.get(`/api/sessions/${session.code}`)).json() as { version: number };
    const launched = await host.request.post(`/api/sessions/${session.code}/host`, { data: { operation: 'launch', version: current.version, game: { kind: 'online', gameId: 'sumo' } } });
    expect(launched.status()).toBe(200);
    const state = await launched.json() as { activeGame: { code: string } }; const code = state.activeGame.code;
    for (let index = 2; index < 10; index++) expect((await host.request.post(`/api/arcade/online/rooms/${code}/host`, { data: { operation: 'bot', seatId: String(index).padStart(2, '0'), enabled: false } })).status()).toBe(200);
    expect((await host.request.post(`/api/arcade/online/rooms/${code}/host`, { data: { operation: 'start' } })).status()).toBe(200);
    const joined = await phones[2].request.post(`/api/sessions/${session.code}/join`, { data: { nickname: 'Late phone' } }); expect(joined.status()).toBe(201);
    expect((await joined.json() as { frameUrl: string | null }).frameUrl).toBeNull();
    const waiting = await phones[2].request.get(`/api/sessions/${session.code}?role=player`);
    expect((await waiting.json() as { frameUrl: string | null }).frameUrl).toBeNull();
    const playing = await (await host.request.get(`/api/arcade/online/rooms/${code}`)).json() as { activeIds: string[]; players: unknown[]; version: number };
    expect(playing.activeIds).toEqual(['00', '01']); expect(playing.players).toHaveLength(2);
    await host.request.post(`/api/arcade/online/rooms/${code}/host`, { data: { operation: 'lobby' } });
    const before = await (await host.request.get(`/api/arcade/online/rooms/${code}`)).json() as { version: number };
    const ready = await phones[2].request.get(`/api/sessions/${session.code}?role=player`);
    expect((await ready.json() as { frameUrl: string | null }).frameUrl).not.toBeNull();
    const after = await (await host.request.get(`/api/arcade/online/rooms/${code}`)).json() as { players: unknown[]; version: number };
    expect(after.players).toHaveLength(3); expect(after.version).toBeGreaterThan(before.version);
  } finally { await Promise.allSettled([host.close(), ...phones.map(context => context.close())]); }
});

test('sparse imported contestants keep their own phone names in the actual host frame', async ({ browser, baseURL }) => {
  const settings = { baseURL, extraHTTPHeaders: { Origin: baseURL! } };
  const host = await browser.newContext(settings);
  const phones = await Promise.all(Array.from({ length: 8 }, () => browser.newContext(settings)));
  try {
    const created = await host.request.post('/api/arcade/online/rooms', { data: { gameId: 'scratch-match', options: {} } });
    expect(created.status()).toBe(201);
    const room = await created.json() as { code: string; hostUrl: string };
    for (let index = 0; index < 8; index++) expect((await phones[index].request.post(`/api/arcade/online/rooms/${room.code}/join`, { data: { nickname: `Phone ${index + 1}` } })).status()).toBe(201);
    for (let index = 0; index < 10; index++) {
      if ([2, 7].includes(index)) continue;
      const seatId = String(index).padStart(2, '0');
      if (index < 8) expect((await host.request.post(`/api/arcade/online/rooms/${room.code}/host`, { data: { operation: 'remove', seatId } })).status()).toBe(200);
      expect((await host.request.post(`/api/arcade/online/rooms/${room.code}/host`, { data: { operation: 'bot', seatId, enabled: false } })).status()).toBe(200);
    }
    const tv = await host.newPage(); await tv.goto(room.hostUrl);
    await expect(tv.getByRole('button', { name: 'Start match', exact: true })).toBeVisible();
    await tv.getByRole('button', { name: 'Start match', exact: true }).click();
    const iframe = tv.locator('.online-game-frame'); await expect(iframe).toBeVisible();
    const frame = await (await iframe.elementHandle())?.contentFrame();
    await expect.poll(async () => frame?.evaluate('window.ScratchMatchAPI?.getState()?.players?.map(p=>p.name)')).toEqual(['Phone 3', 'Phone 8']);
    await expect(tv.locator('.online-score-strip > span')).toHaveCount(2);
    await tv.getByRole('button', { name: 'Pause', exact: true }).click();
  } finally { await Promise.allSettled([host.close(), ...phones.map(context => context.close())]); }
});
