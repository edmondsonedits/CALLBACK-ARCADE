import { test, expect } from '@playwright/test';

test('one parent lobby socket stays alive while the host switches into a game iframe', async ({ page, baseURL }) => {
  const created = await page.request.post('/api/sessions', { headers: { Origin: baseURL! }, data: {} });
  expect(created.status()).toBe(201);
  const { code } = await created.json() as { code: string };
  const socketUrl = `ws://${new URL(baseURL!).host}/sessions/${code}/socket`;
  const sockets: Array<{ close: () => void }> = [];
  await page.route(`**/api/sessions/${code}/socket-ticket?role=host`, route => route.fulfill({ json: { url: socketUrl, ticket: 'browser-test-ticket' } }));
  await page.routeWebSocket(socketUrl, ws => sockets.push(ws));
  try {
    await page.goto(`/session/${code}/host`);
    await expect.poll(() => sockets.length).toBe(1);
    await page.getByRole('button', { name: /Party Games/ }).click();
    await page.getByRole('button', { name: /King Prompter/ }).click();
    await expect(page.locator('iframe.session-game-frame')).toBeVisible();
    expect(sockets).toHaveLength(1);
  } finally {
    for (const socket of sockets) socket.close();
    const snapshot = await page.request.get(`/api/sessions/${code}`);
    if (snapshot.ok()) {
      const lobby = await snapshot.json() as { version: number };
      await page.request.post(`/api/sessions/${code}/host`, { headers: { Origin: baseURL! }, data: { operation: 'close', version: lobby.version } });
    }
  }
});
