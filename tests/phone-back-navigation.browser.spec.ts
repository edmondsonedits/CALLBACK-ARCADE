import { expect, test } from '@playwright/test';

test('first entry and explicit Replay Intro still play; menu marking preserves URL details',async({page})=>{
  await page.addInitScript(()=>{HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/?legacy=0&navigation-check=1#return');
  await page.getByRole('button',{name:'Start Callback',exact:true}).click();
  await expect(page.locator('.tv-entry')).toHaveAttribute('data-entry-stage','intro');
  await page.locator('.tv-intro-video').dispatchEvent('ended');
  await expect(page.locator('.tv-entry')).toHaveAttribute('data-entry-stage','menu');
  const url=new URL(page.url());expect(url.searchParams.get('menu')).toBe('1');expect(url.searchParams.get('navigation-check')).toBe('1');expect(url.hash).toBe('#return');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Replay Intro',exact:true}).click();
  await expect(page.locator('.tv-entry')).toHaveAttribute('data-entry-stage','intro');
});
import { OwnedPartyRooms } from './helpers/owned-party-rooms';

const ownedRooms = new OwnedPartyRooms();
test.afterEach(() => ownedRooms.closeAll());

test('completed intro returns to the live menu after route Back', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start Callback' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Callback' }).click();
  await expect(page.getByRole('button', { name: 'Host a game' })).toBeVisible();
  await expect(page).toHaveURL(/\/?\?menu=1$/);

  await page.getByRole('link', { name: 'Your character' }).click();
  await expect(page.getByRole('heading', { name: 'Character Studio' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Host a game' })).toBeVisible();
  await expect(page.locator('.tv-entry')).toHaveAttribute('data-entry-stage', 'menu');
  await expect(page).toHaveURL(/\/?\?menu=1$/);
});

test('home panels use Back and Forward without leaving the menu', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?menu=1');

  await page.getByRole('button', { name: 'Winning artwork' }).click();
  await expect(page.getByRole('region', { name: 'Sketch & Sorcery winning artwork' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Winning artwork' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('region', { name: 'Sketch & Sorcery winning artwork' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Sketch & Sorcery winning artwork' })).toBeVisible();

  await page.goBack();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Set the stage' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Set the stage' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('dialog', { name: 'Set the stage' })).toBeVisible();
});

test('phone character and style screens follow Back and Forward', async ({ browser }) => {
  const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? 'http://127.0.0.1:3018';
  const headers = { Origin: baseURL, 'Content-Type': 'application/json' };
  const context = await browser.newContext({ baseURL, viewport: { width: 393, height: 700 }, isMobile: true, hasTouch: true });
  try {
    const { code } = await (await context.request.post('/api/sessions', { headers, data: {} })).json();
    await context.request.post(`/api/sessions/${code}/join`, { headers, data: { nickname: 'Back Tester' } });
    const page = await context.newPage();
    await page.goto(`/session/${code}/play`);
    await expect(page.getByRole('heading', { name: 'Welcome, Back Tester' })).toBeVisible();

    await page.getByRole('button', { name: 'Character', exact: true }).click();
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Game', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.goForward();
    await expect(page.getByRole('button', { name: 'Character', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await page.goBack();
    await expect(page.getByRole('button', { name: 'Game', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.goForward();
    await expect(page.getByRole('button', { name: 'Style', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Customize character', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goForward();
    await expect(page.getByRole('dialog')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('starting a room retires the phone Style screen without changing the game view on Back', async ({ browser }) => {
  const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? 'http://127.0.0.1:3018';
  const headers = { Origin: baseURL, 'X-Callback-Test-Mode': 'deterministic-matrix' };
  const host = await browser.newContext({ baseURL });
  const phone = await browser.newContext({ baseURL, viewport: { width: 393, height: 700 }, isMobile: true, hasTouch: true });
  try {
    const created = await host.request.post('/api/rooms', { headers, data: { gameLength: 'pictures', contentMode: 'party', timerAccessibility: false } });
    expect(created.status()).toBe(201);
    const { code } = await created.json();
    await ownedRooms.track(host, code, baseURL);
    expect((await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: 'Back Tester' } })).status()).toBe(201);
    const page = await phone.newPage();
    await page.goto('/?menu=1');
    await page.goto(`/play/${code}`);
    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Customize character', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Customize character', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const beforeBot = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json();
    const addBot = await host.request.post(`/api/rooms/${code}/host-actions`, { headers, data: { type: 'ADD_BOT', actionId: crypto.randomUUID(), roundId: beforeBot.roundId, expectedPhase: beforeBot.phase, payload: {} } });
    expect(addBot.status(), await addBot.text()).toBe(200);
    const snapshot = await (await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } })).json();
    const start = await host.request.post(`/api/rooms/${code}/host-actions`, { headers, data: { type: 'START_GAME', actionId: crypto.randomUUID(), roundId: snapshot.roundId, expectedPhase: snapshot.phase, payload: {} } });
    expect(start.status(), await start.text()).toBe(200);
    await expect(page.locator('.phone-style-screen')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Game', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => (history.state?.__kingPrompterPanelStack ?? []).length)).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/?\?menu=1$/);
    await expect(page.getByRole('button', { name: 'Host a game', exact: true })).toBeVisible();
  } finally {
    await phone.close();
    await host.close();
  }
});
