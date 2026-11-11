import { expect, test } from '@playwright/test';

test('House Edmondson opens as an accessible modal and returns focus on compact screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Callback', exact: true }).click();
  const trigger = page.getByRole('button', { name: 'House Edmondson', exact: true });
  await expect(trigger).toBeVisible();

  for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'House Edmondson' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
    await expect(dialog.getByText('By royal decree: no one admits they drew the potato.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close this page' })).toBeInViewport();

    await dialog.getByRole('button', { name: 'Close this page' }).focus();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  await expect(page.getByRole('button', { name: 'Host a game', exact: true })).toBeVisible();
});

test('Sketch & Sorcery guide is available in Party Games and reachable on phone layouts', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const response = await page.request.post('/api/sessions', { data: {} });
  expect(response.status(), await response.text()).toBe(201);
  const { code } = await response.json() as { code: string };
  await page.goto(`/session/${code}/host`);
  const partyTab = page.getByRole('button', { name: /^Party Games/ }).first();
  await expect(partyTab).toHaveAttribute('aria-pressed', 'true');
  const trigger = page.getByRole('button', { name: 'How Sketch & Sorcery works', exact: true });
  const gameGridCard = page.locator('.game-menu-grid > button').filter({ hasText: 'Sketch & Sorcery' });
  await expect(gameGridCard).toBeVisible();
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();

  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Sketch & Sorcery' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Last place picks the curse/i)).toBeVisible();
  await expect(dialog.getByText(/private prompt twist and starter sketch/i)).toBeVisible();
  await expect(dialog.getByText(/guess their artists/i)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close this page' })).toBeVisible();

  for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    await expect(dialog.getByRole('button', { name: 'Close this page' })).toBeInViewport();
    const guideContent = dialog.locator('.sketch-guide-content');
    const lastStep = guideContent.locator('.sketch-guide-note');
    await lastStep.scrollIntoViewIfNeeded();
    await expect(lastStep).toBeInViewport();
    await expect(dialog.getByRole('button', { name: /^(Previous|Next) screen$/ })).toHaveCount(0);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(gameGridCard).toBeVisible();
});
