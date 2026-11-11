import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { NEUTRAL_POSE } from '../lib/avatar-pose';
import { DEFAULT_AVATAR } from '../lib/avatar-runtime';
import { DEFAULT_PIECE_TRANSFORM } from '../lib/avatar-pieces';

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? 'http://localhost:3000';
const headers = { Origin: baseURL, 'X-Callback-Test-Mode': 'deterministic-matrix' };
async function room(browser: Browser, shared = false) {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
  const phones: BrowserContext[] = [];
  const created = await host.request.post(shared ? '/api/sessions' : '/api/rooms', { headers, data: shared ? {} : { gameLength: 'pictures', contentMode: 'party', timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  const path = `/api/${shared ? 'sessions' : 'rooms'}/${code}`;
  for (const name of ['Danny', 'Friend']) {
    const c = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }); phones.push(c);
    const joined = await c.request.post(`${path}/join`, { headers, data: { nickname: name } });
    expect(joined.status(), await joined.text()).toBe(201);
  }
  return { host, phones, code, path, shared, close: () => Promise.all([host, ...phones].map(c => c.close())) };
}
async function snapshot(h: Awaited<ReturnType<typeof room>>) {
  if (h.shared) return (await h.host.request.get(h.path)).json();
  return (await h.host.request.post(`${h.path}/sync`, { headers, data: { version: 0 } })).json();
}

for (const shared of [false, true]) test(`${shared ? 'shared lobby' : 'game room'} pose API derives ownership, rejects spoofing and preserves gameplay`, async ({ browser }) => {
  const h = await room(browser, shared);
  try {
    const before = await snapshot(h);
    expect((await h.host.request.post(`${h.path}/avatar-poses`, { headers, data: { sequence: 1, pose: NEUTRAL_POSE } })).status()).toBe(401);
    const first = h.phones[0]!;
    expect((await first.request.post(`${h.path}/avatar-poses`, { headers, data: { sequence: 20, pose: { ...NEUTRAL_POSE, leftElbow: 75 } } })).status()).toBe(204);
    expect((await first.request.post(`${h.path}/avatar-poses`, { headers, data: { sequence: 21, pose: NEUTRAL_POSE, playerId: before.players[1].id } })).status()).toBe(422);
    expect((await first.request.post(`${h.path}/avatar-poses`, { headers: { ...headers, Origin: 'https://other.test' }, data: { sequence: 21, pose: NEUTRAL_POSE } })).status()).toBe(403);
    await first.request.post(`${h.path}/avatar-poses`, { headers, data: { sequence: 19, pose: NEUTRAL_POSE } });
    const live = await (await h.host.request.get(`${h.path}/avatar-poses`)).json();
    expect(live.poses).toHaveLength(1); expect(live.poses[0].playerId).toBe(before.players[0].id); expect(live.poses[0].pose.leftElbow).toBe(75);
    const after = await snapshot(h); expect(after.version).toBe(before.version); expect(after.phase ?? after.stage).toBe(before.phase ?? before.stage);
    expect(JSON.stringify(live)).not.toMatch(/token|nickname|answer|score/);
    await expect.poll(async () => (await (await h.host.request.get(`${h.path}/avatar-poses`)).json()).poses.length).toBe(0);
  } finally { await h.close(); }
});

test('ten-player host cards keep names and bot badges below puppets at two desktop sizes', async ({ browser }) => {
  const h = await room(browser);
  try {
    for (let i = 2; i < 9; i++) {
      const c = await browser.newContext({ baseURL }); h.phones.push(c);
      expect((await c.request.post(`${h.path}/join`, { headers, data: { nickname: `Friend ${i}` } })).status()).toBe(201);
    }
    const s = await snapshot(h);
    expect((await h.host.request.post(`${h.path}/host-actions`, { headers, data: { type: 'ADD_BOT', actionId: crypto.randomUUID(), roundId: s.roundId, expectedPhase: s.phase, payload: {} } })).status()).toBe(200);
    const page = await h.host.newPage(); await page.goto(`/host/${h.code}`);
    await expect(page.locator('.roster-player-footer')).toHaveCount(10);
    for (const [width, height] of [[1366, 768], [1280, 720]]) {
      await page.setViewportSize({ width: width!, height: height! });
      const geometry = await page.locator('.roster-grid .roster-player').evaluateAll(cards => cards.map(card => {
        const stage = card.querySelector('.roster-avatar-stage')!.getBoundingClientRect();
        const name = card.querySelector('strong')!.getBoundingClientRect();
        return { separated: stage.bottom <= name.top, bottom: card.getBoundingClientRect().bottom };
      }));
      expect(geometry.every(c => c.separated)).toBe(true); expect(geometry.every(c => c.bottom <= height!)).toBe(true);
      const start = await page.getByRole('button', { name: /Start the game/ }).boundingBox();
      expect(start!.y + start!.height).toBeLessThanOrEqual(height!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: '.logs/qa-avatar-live/host-ten-players.png' });
  } finally { await h.close(); }
});

test('phone drag bends joints, reaches host, settles, and presets and face controls work', async ({ browser }) => {
  const h = await room(browser);
  try {
    const host = await h.host.newPage(); await host.goto(`/host/${h.code}`);
    const phone = await h.phones[0]!.newPage(); await phone.goto(`/play/${h.code}`);
    await phone.getByRole('button', { name: 'Character', exact: true }).click();
    const pad = phone.locator('.avatar-puppet-pad'); await pad.scrollIntoViewIfNeeded();
    expect(await phone.locator('.phone-game-screen').getAttribute('hidden')).not.toBeNull();
    const selfSvg = await phone.locator('.phone-self .avatar-svg').boundingBox();
    const phoneHeader = await phone.locator('.phone-header').boundingBox();
    expect(selfSvg!.y + selfSvg!.height).toBeLessThanOrEqual(phoneHeader!.y + phoneHeader!.height);
    const hand = pad.locator('[data-puppet-handle="leftHand"]'); const point = await hand.boundingBox(); expect(point).not.toBeNull();
    await phone.mouse.move(point!.x + point!.width / 2, point!.y + point!.height / 2); await phone.mouse.down();
    await phone.mouse.move(point!.x - 22, point!.y - 45, { steps: 8 });
    await expect.poll(async () => {
      const value = await (await h.host.request.get(`${h.path}/avatar-poses`)).json(); return Math.abs(value.poses[0]?.pose.leftElbow ?? 0);
    }).toBeGreaterThan(5);
    await expect.poll(() => host.locator('.roster-player').first().locator('[data-puppet-joint="left-elbow"]').first().getAttribute('transform')).not.toBe('rotate(0 78 267)');
    expect(await host.locator('.roster-player').first().locator('[data-puppet-joint="left-elbow"]').evaluateAll(nodes=>new Set(nodes.map(node=>node.getAttribute('transform'))).size)).toBe(1);
    await phone.mouse.up();
    await pad.getByRole('button', { name: 'Reactions', exact: true }).click();
    await pad.getByRole('button', { name: 'Cheer', exact: true }).click();
    await expect.poll(async () => {
      const value = await (await h.host.request.get(`${h.path}/avatar-poses`)).json(); return Math.abs(value.poses[0]?.pose.rightArm ?? 0);
    }).toBeGreaterThan(40);
    await pad.getByRole('button', { name: 'Back', exact: true }).click();
    await pad.getByRole('button', { name: 'Joint controls', exact: true }).click();
    await pad.getByRole('button', { name: 'Next', exact: true }).click();
    await pad.getByRole('button', { name: 'Next', exact: true }).click();
    await pad.getByRole('button', { name: 'Next', exact: true }).click();
    const mouth = pad.getByLabel('Mouth expression', { exact: true });
    await phone.bringToFront();
    await mouth.press('End');
    await expect(mouth).toHaveValue('1');
    await expect.poll(async () => (await (await h.host.request.get(`${h.path}/avatar-poses`)).json()).poses[0]?.pose.mouth ?? 0).toBeGreaterThan(.5);
    await pad.getByRole('button', { name: 'Settle', exact: true }).click();
    await expect(mouth).toHaveValue('0');
    await pad.getByRole('button', { name: 'Back', exact: true }).click();
    await pad.getByRole('button', { name: 'Reactions', exact: true }).click();
    for (const name of ['Jump', 'Cry', 'Funny', 'Wave', 'Dance', 'Facepalm', 'Laugh', 'Wobble']) await expect(pad.getByRole('button', { name, exact: true })).toBeVisible();
    await phone.screenshot({ path: '.logs/qa-avatar-live/phone-puppet.png' });
    await phone.setViewportSize({ width: 667, height: 375 });
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await phone.reload(); await expect(phone.getByRole('button', { name: 'Character', exact: true })).toBeVisible();
    await expect.poll(async () => (await (await h.host.request.get(`${h.path}/avatar-poses`)).json()).poses.length).toBe(0);
  } finally { await h.close(); }
});

test('shared lobby pad supports reduced motion and resets when returning from a game', async ({ browser }) => {
  const h = await room(browser, true);
  try {
    const host = await h.host.newPage(); await host.goto(`/session/${h.code}/host`);
    const phone = await h.phones[0]!.newPage(); await phone.emulateMedia({ reducedMotion: 'reduce' }); await phone.goto(`/session/${h.code}/play`);
    await phone.getByRole('button', { name: 'Character', exact: true }).click();
    await phone.getByRole('button', { name: 'Reactions', exact: true }).click();
    await phone.getByRole('button', { name: 'Cry', exact: true }).click();
    await expect.poll(async () => (await (await h.host.request.get(`${h.path}/avatar-poses`)).json()).poses[0]?.pose.mouth ?? 0).toBeLessThan(-.2);
    const puppet = phone.locator('.avatar-puppet-pad [data-puppet-joint="head"]'); await expect(puppet).toBeVisible();
    await phone.screenshot({ path: '.logs/qa-avatar-live/phone-reduced-motion.png' });
    await host.getByRole('button', { name: /Party Games/ }).click(); await host.getByRole('button', { name: /King Prompter/ }).click();
    await expect(phone.locator('iframe.session-game-frame')).toBeVisible();
    const startFits = await host.frameLocator('iframe.session-game-frame').getByRole('button', { name: /Start the game/ }).evaluate(button => button.getBoundingClientRect().bottom <= button.ownerDocument.defaultView!.innerHeight);
    expect(startFits).toBe(true);
    await expect(phone.frameLocator('iframe.session-game-frame').getByRole('button', { name: 'Character', exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'New Game', exact: true }).click(); await host.getByRole('button', { name: 'Choose New Game', exact: true }).click();
    await expect(phone.getByRole('heading', { name: 'Welcome, Danny' })).toBeVisible();
    await expect(phone.getByRole('button', { name: 'Character', exact: true })).toBeVisible();
  } finally { await h.close(); }
});

test('host puppet releases expired pose even while its live polling fails', async ({ browser }) => {
  const h = await room(browser);
  try {
    const host = await h.host.newPage(); await host.goto(`/host/${h.code}`);
    await h.phones[0]!.request.post(`${h.path}/avatar-poses`, { headers, data: { sequence: 1, pose: { ...NEUTRAL_POSE, leftElbow: 90 } } });
    await expect(host.locator('.roster-player').first().locator('.live-pose')).toHaveCount(1);
    await host.route('**/avatar-poses', route => route.abort());
    await expect(host.locator('.roster-player').first().locator('.live-pose')).toHaveCount(0, { timeout: 5000 });
  } finally { await h.close(); }
});

test('host receives poses when a pose response takes longer than its polling interval', async ({ browser }) => {
  const h = await room(browser);
  try {
    const host = await h.host.newPage();
    await host.route('**/avatar-poses', async route => {
      const response = await route.fetch();
      await new Promise(resolve => setTimeout(resolve, 750));
      try { await route.fulfill({ response }); } catch { /* cleanup can close an outstanding route */ }
    });
    await host.goto(`/host/${h.code}`);
    await h.phones[0]!.request.post(`${h.path}/avatar-poses`, { headers, data: { sequence: 1, pose: { ...NEUTRAL_POSE, leftElbow: 90 } } });
    await expect(host.locator('.roster-player').first().locator('.live-pose')).toHaveCount(1, { timeout: 3000 });
  } finally { await h.close(); }
});

test('customized limb handles follow joints; a second touch cannot steal the drag', async ({ browser }) => {
  const h = await room(browser);
  try {
    const config = { ...DEFAULT_AVATAR, bodyWidth: 1.1, pieceTransforms: { leftArm: { ...DEFAULT_PIECE_TRANSFORM, x: 14, y: -6, rotation: 15, scale: 1.1 } } };
    const s = await snapshot(h);
    expect((await h.phones[0]!.request.post(`${h.path}/player-actions`, { headers, data: { type: 'UPDATE_AVATAR', actionId: crypto.randomUUID(), roundId: s.roundId, expectedPhase: s.phase, payload: { avatarConfig: config, avatarPreset: null } } })).status()).toBe(200);
    const phone = await h.phones[0]!.newPage(); await phone.goto(`/play/${h.code}`);
    await phone.getByRole('button', { name: 'Character', exact: true }).click();
    const pad = phone.locator('.avatar-puppet-pad'); await pad.scrollIntoViewIfNeeded();
    const handle = pad.locator('[data-puppet-handle="leftHand"]');
    expect(await handle.evaluate(el => el.parentElement?.getAttribute('data-puppet-joint'))).toBe('left-elbow');
    const box = await handle.boundingBox(); expect(box).not.toBeNull();
    const a = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2, id: 1 };
    const moved = { ...a, x: a.x - 24, y: a.y - 35 };
    const second = { x: a.x + 40, y: a.y + 30, id: 2 };
    const cdp = await h.phones[0]!.newCDPSession(phone);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [moved] });
    await expect.poll(async () => Math.abs((await (await h.host.request.get(`${h.path}/avatar-poses`)).json()).poses[0]?.pose.leftElbow ?? 0)).toBeGreaterThan(5);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [moved, second] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [moved, { ...second, x: second.x + 40, y: second.y - 40 }] });
    const live = await (await h.host.request.get(`${h.path}/avatar-poses`)).json(); expect(live.poses[0].pose.x).toBe(0); expect(live.poses[0].pose.y).toBe(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect.poll(async () => Math.abs((await (await h.host.request.get(`${h.path}/avatar-poses`)).json()).poses[0]?.pose.leftElbow ?? 0), { timeout: 6000 }).toBeLessThan(1);
    await phone.getByRole('button', { name: 'Game', exact: true }).click();
    await expect(pad.locator('.avatar-puppet-preview')).not.toBeVisible();
    await cdp.detach();
  } finally { await h.close(); }
});
