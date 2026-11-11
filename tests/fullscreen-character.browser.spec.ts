import { expect, test } from '@playwright/test';
import { defaultCharacterProfile } from '../lib/character-profile';

test('character and photo editors keep primary actions visible and secondary controls scroll reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/api/profile', route => route.fulfill({ json: { version: 1, ...defaultCharacterProfile(), created: false } }));
  await page.goto('/play');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'Your character', exact: true }).click();
  await page.getByRole('button', { name: 'Customize character', exact: true }).click();
  const avatar = page.getByRole('dialog', { name: 'Make it look like you.' });
  await expect(avatar).toBeVisible();
  await expect.poll(() => avatar.boundingBox()).toMatchObject({ x: 0, y: 0, width: 320, height: 568 });
  const sizes = [{ width: 320, height: 568 }, { width: 390, height: 568 }, { width: 844, height: 390 }, { width: 1366, height: 568 }, { width: 1366, height: 768 }, { width: 683, height: 384 }];
  const checkBounds = async (dialog: typeof avatar, inputs: string) => {
    const size = page.viewportSize()!;
    const primary = dialog.getByRole('button', { name: /Use this avatar|Generate cartoon|Close/ }).first();
    if (await primary.count()) await expect(primary).toBeInViewport();
    for (const control of await dialog.locator(inputs).all()) {
      if (!await control.isVisible()) continue;
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      expect(box, 'visible editor control has a box').not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
    }
    await expect(dialog).toBeInViewport({ratio:1});
  };
  for (const size of sizes) {
    await page.setViewportSize(size);
    await checkBounds(avatar, 'button, input, select, summary');
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.screenshot({ path: test.info().outputPath('character-phone-320.png') });
  await page.setViewportSize({ width: 1366, height: 568 });
  await page.screenshot({ path: test.info().outputPath('character-desktop-1366x568.png') });
  await avatar.getByRole('button', { name: 'Style', exact: true }).click();
  const feature = avatar.getByLabel('Change a feature');
  const featureValues = await feature.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).filter(Boolean));
  expect(featureValues.length).toBeGreaterThan(30);
  for (const value of featureValues) {
    await feature.selectOption(value);
    expect(await avatar.locator('.avatar-mobile-controls input:not([type="hidden"]), .avatar-mobile-controls select, .avatar-mobile-controls button').count()).toBeGreaterThanOrEqual(2);
  }
  await avatar.getByRole('button', { name: 'Pieces', exact: true }).click();
  const adjustment = avatar.locator('.avatar-mobile-controls select').nth(1);
  for (const axis of ['x', 'y', 'scale', 'scaleX', 'scaleY', 'rotation']) {
    await adjustment.selectOption(axis);
    await expect(avatar.getByRole('slider', { name: 'Selected piece adjustment' })).toBeVisible();
  }
  await checkBounds(avatar, 'button, input, select, summary');
  await page.keyboard.press('Escape');
  await expect(avatar).toHaveCount(0);

  await page.getByRole('button', { name: 'Use a face photo', exact: true }).click();
  const photo = page.getByRole('dialog', { name: 'Make a cartoon of your face' });
  await expect(photo).toBeVisible();
  const data = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128; const context = canvas.getContext('2d')!; context.fillStyle = '#d89970'; context.beginPath(); context.ellipse(64, 60, 40, 54, 0, 0, Math.PI * 2); context.fill(); return canvas.toDataURL('image/png').split(',')[1]!; });
  await photo.getByLabel('Your face photo (JPG, PNG or WebP)').setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
  await expect(photo.getByRole('img', { name: /Circular face crop guide/ })).toBeVisible();
  for (const size of sizes) {
    await page.setViewportSize(size);
    await expect.poll(() => photo.boundingBox()).toMatchObject({ x: 0, y: 0, width: size.width, height: size.height });
    await checkBounds(photo, 'button, input, select');
    await expect(photo.getByRole('slider', { name: 'Face zoom' })).toBeVisible();
    if (size.width === 320) await page.screenshot({ path: test.info().outputPath('photo-crop-phone-320.png') });
    await photo.getByRole('button', { name: /Set chin line/ }).click();
    await expect(photo.getByRole('slider', { name: 'Photo chin height' })).toBeVisible();
    await expect(photo.getByRole('slider', { name: 'Photo chin curve' })).toBeVisible();
    await checkBounds(photo, 'button, input, select');
    await photo.getByRole('button', { name: /Crop & position/ }).click();
  }
});
