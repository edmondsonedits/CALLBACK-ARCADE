import { expect, test } from '@playwright/test';
import { ARCHIVED_ARCADE_GAMES } from '../lib/arcade/archived-games';

test('the curated shared picker excludes every marked title and retained online choices still load', async ({ page, baseURL }) => {
  const created = await page.request.post('/api/sessions', { data: {}, headers: { Origin: baseURL! } });
  expect(created.status()).toBe(201); const session = await created.json() as { code: string };
  await page.goto(`/session/${session.code}/host`);
  await expect(page.getByRole('img', { name: `Scan to join room ${session.code}` })).toBeVisible();
  await page.getByRole('button', { name: /Arcade/ }).click();
  await expect(page.locator('.session-games-grid')).toBeVisible();
  const titles:string[]=[];
  for(let screen=0;screen<30;screen++){
    titles.push(...await page.locator('.session-games-grid button strong').allTextContents());
    for(const game of ARCHIVED_ARCADE_GAMES)await expect(page.getByRole('button',{name:new RegExp(game.title.split(' · ')[0])})).toHaveCount(0);
    const next=page.getByRole('button',{name:'Next games',exact:true});if(!await next.isVisible()||await next.isDisabled())break;await next.click();
  }
  for(const title of ['Royal Sumo','Royal Twisted','Air Hockey'])expect(titles.some(value=>value.includes(title))).toBe(true);
  await page.screenshot({ path: '.logs/qa-curation/picker.png', fullPage: true });
});

test('all archived entry links show an archive notice instead of a playable canvas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const archivedIds = ARCHIVED_ARCADE_GAMES.flatMap(game => [game.id, ...game.aliases]);
  const entries = [...archivedIds.map(id => `/arcade-games/${id}/index.html`), ...['space-bash', 'royal-ballistix'].map(id => `/arcade-games/${id}/online-v65.html?online=1`)];
  for (const entry of entries) {
    const response = await page.goto(entry);
    // Sites serves the built static notice as 200; Worker entry checks use 410.
    expect([200, 410]).toContain(response?.status());
    await expect(page.getByText(/archived/i).first()).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Return to the active Arcade' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('researched hosted alternatives have usable external links on phone and desktop', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport); await page.goto('/party-games');
    for (const [name, href] of [['Open Gartic Phone', 'https://garticphone.com/'], ['Open skribbl.io', 'https://skribbl.io/'], ['Open AirConsole', 'https://www.airconsole.com/']]) {
      const link = page.getByRole('link', { name: new RegExp(name) });
      await expect(link).toHaveAttribute('href', href); await expect(link).toHaveAttribute('target', '_blank');
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
