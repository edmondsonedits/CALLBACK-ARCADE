import { expect, test, type BrowserContext, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { HostSnapshot, PlayerAction, HostAction, PlayerSnapshot } from '../lib/contracts';
import type { SessionView } from '../lib/session-contracts';
import { SKETCH_TRANSFORM_PROMPT } from '../lib/sketch-transform-prompt';

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? 'http://127.0.0.1:3018';
const headers = { Origin: baseURL, 'Content-Type': 'application/json', 'X-Callback-Test-Mode': 'deterministic-matrix' };
const artifacts = '.logs/qa-sorcery-journey';
type Snapshot = HostSnapshot | PlayerSnapshot;
type HostOperation = 'launch' | 'reset';

async function session(context: BrowserContext, code: string) {
  const response = await context.request.get(`/api/sessions/${code}?role=host`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<SessionView>;
}

async function room(context: BrowserContext, code: string) {
  const response = await context.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<Snapshot>;
}

async function phoneRoom(context: BrowserContext, code: string) {
  const snapshot = await room(context, code);
  expect(snapshot.role).toBe('player');
  return snapshot as PlayerSnapshot;
}

async function action(context: BrowserContext, code: string, type: PlayerAction['type'] | HostAction['type'], payload: Record<string, unknown> = {}, host = false) {
  const snapshot = await room(context, code);
  const response = await context.request.post(`/api/rooms/${code}/${host ? 'host' : 'player'}-actions`, {
    headers,
    data: { type, actionId: crypto.randomUUID(), expectedPhase: snapshot.phase, roundId: snapshot.roundId ?? 'lobby', payload },
  });
  expect(response.status(), await response.text()).toBe(200);
  return response;
}

async function gameAction(context: BrowserContext, code: string, type: PlayerAction['type'], payload: Record<string, unknown>) {
  const sketch = (await room(context, code)).sketchRelay!;
  return action(context, code, type, { matchId: sketch.matchId, round: sketch.round, ...payload });
}

async function hostNext(context: BrowserContext, code: string) {
  const sketch = (await room(context, code)).sketchRelay!;
  return action(context, code, 'ADVANCE_SKETCH_RELAY', { matchId: sketch.matchId, round: sketch.round, phase: sketch.phase, transition: 'next' }, true);
}

async function waitPhase(context: BrowserContext, code: string, expected: string) {
  await expect.poll(async () => (await room(context, code)).sketchRelay?.phase, { timeout: 25_000 }).toBe(expected);
}

async function waitPhonePhase(frame: FrameLocator, expected: string) {
  if (expected === 'drawing') { await expect(frame.getByTestId('sketch-canvas')).toBeVisible(); return; }
  await expect(frame.locator(`section[aria-label="Sketch and Sorcery controller"][data-phase="${expected}"]`)).toBeVisible();
}

async function waitHostPhase(frame: FrameLocator, expected: string) {
  await expect(frame.locator(`section[aria-label="Sketch and Sorcery shared screen"][data-phase="${expected}"]`)).toBeVisible();
}

async function capture(page: Page, path: string) {
  for (const frame of page.frames()) {
    await expect.poll(() => frame.locator('img:visible').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  }
  await page.screenshot({ animations: 'disabled', path });
}

/** Menus scroll naturally; gameplay stays in its fixed outer viewport. */
async function reach(frame: FrameLocator | Locator, control: Locator) {
  await expect(frame.getByRole('button', { name: 'Next screen', exact: true })).toHaveCount(0);
  await control.scrollIntoViewIfNeeded();
  expect(await control.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1; }), 'control remains accessible inside its interface').toBe(true);
  return control;
}

async function draw(page: Page) {
  const game = page.frameLocator('iframe.session-game-frame');
  const canvas = game.getByTestId('sketch-canvas');
  await expect(canvas).toBeVisible();
  const bounds = (await canvas.boundingBox())!;
  const hint = game.getByText('Talent optional. Mischief encouraged.', { exact: true });
  if (await hint.isVisible()) expect(await hint.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const x = bounds.x + bounds.width * .28;
  const y = bounds.y + bounds.height * .34;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + bounds.width * .36, y + bounds.height * .08, { steps: 10 });
  await page.mouse.move(x + bounds.width * .12, y + bounds.height * .32, { steps: 9 });
  await page.mouse.up();
  await (await reach(game, game.getByRole('button', { name: 'Done', exact: true }))).click();
  const upload = page.waitForResponse(response => response.url().endsWith('/sketch') && response.request().method() === 'POST');
  await (await reach(game, game.getByRole('button', { name: 'Send sketch', exact: true }))).click();
  expect((await upload).status()).toBe(200);
  await expect(canvas).not.toBeVisible();
}

async function resetSession(context: BrowserContext, code: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await session(context, code);
    const response = await context.request.post(`/api/sessions/${code}/host`, { headers, data: { operation: 'reset' satisfies HostOperation, version: current.version } });
    if (response.status() === 200) return;
    expect(response.status(), await response.text()).toBe(409);
  }
  throw new Error(`Could not reset test session ${code} with a fresh version.`);
}

async function rankPromptFromApi(context: BrowserContext, code: string) {
  const sketch = (await phoneRoom(context, code)).sketchRelay!;
  const ranking = sketch.showdown!.promptOptions!.filter(option => option.id !== sketch.showdown!.ownPromptId).slice(0, 3).map(option => option.id);
  await gameAction(context, code, 'RANK_SKETCH_PROMPTS', { ranking });
}

async function rankArtFromApi(context: BrowserContext, code: string) {
  const sketch = (await phoneRoom(context, code)).sketchRelay!;
  const ranking = sketch.showdown!.entries.filter(entry => entry.entryId !== sketch.showdown!.ownEntryId).slice(0, 3).map(entry => entry.entryId);
  await gameAction(context, code, 'RANK_SKETCH_LAUGHTER', { ranking });
}

async function uiRank(frame: FrameLocator | Locator, count = 3) {
  const cards = frame.locator('section[aria-label="Sketch and Sorcery controller"] button[aria-pressed]');
  for (let index = 0; index < count; index++) await (await reach(frame, cards.nth(index))).click();
  await (await reach(frame, frame.getByRole('button', { name: new RegExp(`Lock ${count} favourites`) }))).click();
}

test('home-to-host journey completes three Sketch & Sorcery rounds with real phone tasks', async ({ browser }) => {
  test.skip(process.env.CALLBACK_QA_MANAGED !== '1', 'Requires the provider-disabled managed local QA harness.');
  test.setTimeout(240_000);
  await mkdir(artifacts, { recursive: true });
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { 'X-Callback-Test-Mode': 'deterministic-matrix' } });
  const phoneContexts: BrowserContext[] = [];
  let sessionCode = '';
  try {
    const hostPage = await host.newPage();
    await hostPage.goto('/');
    await hostPage.getByRole('button', { name: 'Start Callback', exact: true }).click();
    await hostPage.getByRole('button', { name: 'Host a game', exact: true }).click();
    await expect(hostPage).toHaveURL(/\/session\/[A-Z2-9]{4}\/host$/);
    sessionCode = new URL(hostPage.url()).pathname.split('/')[2]!;
    await expect(hostPage.getByRole('heading', { name: 'What are we playing?' })).toBeVisible();
    await capture(hostPage, `${artifacts}/01-home-to-host-lobby.png`);

    const phoneNames = ['Merriweather', 'Tamsin', 'Rowan', 'Pip'];
    const phonePages: Page[] = [];
    for (let index = 0; index < phoneNames.length; index++) {
      const phone = await browser.newContext({ baseURL, viewport: { width: index === 0 ? 320 : 390, height: 844 }, extraHTTPHeaders: { 'X-Callback-Test-Mode': 'deterministic-matrix' } });
      phoneContexts.push(phone);
      const page = await phone.newPage();
      phonePages.push(page);
      if (index === 0) {
        await page.goto(`/session/${sessionCode}/play`);
        await page.getByLabel('Your name', { exact: true }).fill(phoneNames[index]!);
        await page.getByRole('button', { name: 'Join lobby', exact: true }).click();
        await expect(page.getByRole('heading', { name: `Welcome, ${phoneNames[index]}` })).toBeVisible();
      } else {
        const joined = await phone.request.post(`/api/sessions/${sessionCode}/join`, { headers, data: { nickname: phoneNames[index] } });
        expect(joined.status(), await joined.text()).toBe(201);
        await page.goto(`/session/${sessionCode}/play`);
      }
    }
    await expect.poll(async () => (await session(host, sessionCode)).players.length).toBe(4);

    await hostPage.getByRole('button', { name: 'Party Games', exact: false }).click();
    const sketchCard = hostPage.locator('.game-menu-grid > button').filter({ hasText: 'Sketch & Sorcery' });
    await expect(sketchCard).toBeVisible();
    await (await reach(hostPage.locator('.session-picker'), sketchCard)).click();
    await expect.poll(async () => (await session(host, sessionCode)).activeGame?.title).toBe('Sketch & Sorcery');
    const hostSession = await session(host, sessionCode);
    expect(hostSession.activeGame?.title).toBe('Sketch & Sorcery');
    const roomCode = hostSession.activeGame!.code;
    const hostGame = hostPage.frameLocator('iframe.session-game-frame');
    const phoneGames = phonePages.map(page => page.frameLocator('iframe.session-game-frame'));
    await expect(hostPage.locator('iframe.session-game-frame')).toBeVisible();
    for (const page of phonePages) await expect(page.locator('iframe.session-game-frame')).toBeVisible();
    const startButton = hostGame.getByRole('button', { name: /Start the game/ });
    await expect(startButton).toBeEnabled();
    expect(await startButton.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.top >= -1 && rect.left >= -1 && rect.bottom <= innerHeight + 1 && rect.right <= innerWidth + 1;
    })).toBe(true);
    const practiceButton = hostGame.getByRole('button', { name: 'Fish practice & settings', exact: true });
    await expect(practiceButton).toBeVisible();
    await practiceButton.click();
    const practice = hostGame.getByRole('dialog', { name: 'The practice aquarium' });
    await expect(practice).toBeVisible();
    await expect(practice.getByRole('combobox', { name: 'Fish test mode' })).toBeVisible();
    await practice.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(practice).not.toBeVisible();
    await capture(hostPage, `${artifacts}/02-sketch-lobby.png`);
    await startButton.click();
    await waitPhase(host, roomCode, 'prompt-writing');
    await waitPhonePhase(phoneGames[0]!, 'prompt-writing');

    const spellbookButton = phoneGames[0]!.getByRole('button', { name: 'Spellbook', exact: true });
    await expect(spellbookButton).toBeVisible();
    await (await reach(phoneGames[0]!, spellbookButton)).click();
    const spellbook = phoneGames[0]!.getByRole('dialog', { name: 'The pocket spellbook' });
    await expect(spellbook).toBeVisible();
    await capture(phonePages[0]!, `${artifacts}/03-phone-spellbook.png`);
    await (await reach(phoneGames[0]!, spellbook.getByRole('button', { name: 'Next chapter', exact: true }))).click();
    await (await reach(phoneGames[0]!, spellbook.getByRole('button', { name: 'Back', exact: true }))).click();
    await expect(spellbook).not.toBeVisible();
    await expect(hostGame.getByText(roomCode, { exact: true }).filter({ visible: true })).toHaveCount(0);

    await waitPhonePhase(phoneGames[0]!, 'prompt-writing');
    await capture(phonePages[0]!, `${artifacts}/03-phone-prompt-writing.png`);
    await (await reach(phoneGames[0]!, phoneGames[0]!.getByLabel('Your drawing prompt'))).fill('A wizard delivering a very suspicious pizza');
    await (await reach(phoneGames[0]!, phoneGames[0]!.getByRole('button', { name: /Add my prompt/ }))).click();
    for (let index = 1; index < phoneContexts.length; index++) await gameAction(phoneContexts[index]!, roomCode, 'SUBMIT_SKETCH_PROMPT', { prompt: `A dragon negotiating with ${['a toaster', 'a sandwich', 'a parking meter'][index - 1]}` });
    await waitPhase(host, roomCode, 'prompt-voting');
    await waitPhonePhase(phoneGames[0]!, 'prompt-voting');
    await waitHostPhase(hostGame, 'prompt-voting');
    await capture(phonePages[0]!, `${artifacts}/04-phone-prompt-voting.png`);
    await uiRank(phoneGames[0]!);
    for (const phone of phoneContexts.slice(1)) await rankPromptFromApi(phone, roomCode);
    await waitPhase(host, roomCode, 'drawing');

    const owners = new Map<string, string>();
    let phoneZeroEntryId = '';
    for (let round = 1; round <= 3; round++) {
      if (round === 2) {
        await waitPhase(host, roomCode, 'curse-selection');
        await waitPhonePhase(phoneGames[0]!, 'curse-selection');
        await waitHostPhase(hostGame, 'curse-selection');
        await capture(hostPage, `${artifacts}/round-2-curse-selection.png`);
        await capture(phonePages[0]!, `${artifacts}/round-2-curse-phone.png`);
        const sketch = (await room(host, roomCode)).sketchRelay!;
        const chooserId = sketch.showdown!.curse!.chooserId;
        const chooserIndex = await Promise.all(phoneContexts.map(async context => (await phoneRoom(context, roomCode)).selfId)).then(ids => ids.indexOf(chooserId));
        if (chooserIndex === 0) {
          const curse = phoneGames[0]!.locator('section[aria-label="Sketch and Sorcery controller"] [class*="choiceGrid"] button').first();
          await (await reach(phoneGames[0]!, curse)).click();
        }
        else await gameAction(phoneContexts[chooserIndex]!, roomCode, 'CHOOSE_SKETCH_CURSE', { curse: sketch.showdown!.curse!.options[0] });
        await waitPhase(host, roomCode, 'drawing');
      }
      if (round === 3) {
        await waitPhase(host, roomCode, 'final-preparation');
        await waitPhonePhase(phoneGames[0]!, 'final-preparation');
        await waitHostPhase(hostGame, 'final-preparation');
        await capture(phonePages[0]!, `${artifacts}/round-3-final-preparation.png`);
        await (await reach(phoneGames[0]!, phoneGames[0]!.getByRole('button', { name: 'At a royal banquet', exact: true }))).click();
        await (await reach(phoneGames[0]!, phoneGames[0]!.getByRole('button', { name: 'dragon', exact: true }))).click();
        await (await reach(phoneGames[0]!, phoneGames[0]!.getByRole('button', { name: 'Lock my final assignment', exact: true }))).click();
        for (const phone of phoneContexts.slice(1)) await gameAction(phone, roomCode, 'PREPARE_SKETCH_FINAL', { modifier: 'tiny', starter: 'shield' });
        await waitPhase(host, roomCode, 'drawing');
      }

      const current = await room(host, roomCode);
      expect(current.sketchRelay?.round).toBe(round);
      await waitPhonePhase(phoneGames[0]!, 'drawing');
      await waitHostPhase(hostGame, 'drawing');
      await expect(phoneGames[0]!.getByTestId('sketch-canvas')).toBeVisible();
      await capture(phonePages[0]!, `${artifacts}/round-${round}-phone-drawing.png`);
      await capture(hostPage, `${artifacts}/round-${round}-host-drawing.png`);
      for (const page of phonePages) await draw(page);
      await waitPhase(host, roomCode, 'showcase');
      await waitPhonePhase(phoneGames[0]!, 'showcase');
      await waitHostPhase(hostGame, 'showcase');
      await capture(hostPage, `${artifacts}/round-${round}-host-showcase.png`);
      await hostNext(host, roomCode);
      await waitPhase(host, roomCode, 'laughter-voting');
      await waitPhonePhase(phoneGames[0]!, 'laughter-voting');
      await waitHostPhase(hostGame, 'laughter-voting');
      await capture(phonePages[0]!, `${artifacts}/round-${round}-phone-ranked-ballot.png`);
      await capture(hostPage, `${artifacts}/round-${round}-host-gallery.png`);

      const ballotSnapshots = await Promise.all(phoneContexts.map(context => phoneRoom(context, roomCode)));
      for (const ballot of ballotSnapshots) {
        const ownEntryId = ballot.sketchRelay!.showdown!.ownEntryId!;
        owners.set(ownEntryId, ballot.selfId);
      }
      phoneZeroEntryId = ballotSnapshots[0]!.sketchRelay!.showdown!.ownEntryId!;
      await uiRank(phoneGames[0]!);
      for (const phone of phoneContexts.slice(1)) await rankArtFromApi(phone, roomCode);
      await waitPhase(host, roomCode, 'artist-guessing');
      await waitPhonePhase(phoneGames[0]!, 'artist-guessing');
      await waitHostPhase(hostGame, 'artist-guessing');
      await capture(phonePages[0]!, `${artifacts}/round-${round}-phone-artist-guessing.png`);
      await capture(hostPage, `${artifacts}/round-${round}-host-artist-guessing.png`);

      const guessTasks = await Promise.all(phoneContexts.map(async context => phoneRoom(context, roomCode)));
      for (const entryId of guessTasks[0]!.sketchRelay!.showdown!.laughterRanking!) {
        const entry = guessTasks[0]!.sketchRelay!.showdown!.entries.find(candidate => candidate.entryId === entryId)!;
        const guess = phoneGames[0]!.getByLabel(`Who drew ${entry.letter}?`);
        await (await reach(phoneGames[0]!, guess)).selectOption(owners.get(entryId)!);
      }
      await (await reach(phoneGames[0]!, phoneGames[0]!.getByRole('button', { name: 'Lock my artist guesses', exact: true }))).click();
      for (let index = 1; index < phoneContexts.length; index++) {
        const sketch = guessTasks[index]!.sketchRelay!;
        const guesses = sketch.showdown!.laughterRanking!.map(entryId => ({ entryId, playerId: owners.get(entryId)! }));
        await gameAction(phoneContexts[index]!, roomCode, 'GUESS_SKETCH_ARTISTS', { guesses });
      }
      await waitPhase(host, roomCode, 'revealing');
      await waitPhonePhase(phoneGames[0]!, 'revealing');
      await waitHostPhase(hostGame, 'revealing');
      await capture(phonePages[0]!, `${artifacts}/round-${round}-phone-reveal.png`);
      let phoneZeroPerformed = false;
      while ((await room(host, roomCode)).sketchRelay!.phase === 'revealing') {
        const reveal = (await room(host, roomCode)).sketchRelay!.showdown!.revealEntry!;
        await capture(hostPage, `${artifacts}/round-${round}-reveal-${reveal.place ?? 'artist'}.png`);
        if (!phoneZeroPerformed && reveal.entryId === phoneZeroEntryId) {
          await expect(phoneGames[0]!.getByRole('heading', { name: 'Take the stage!' })).toBeVisible();
          await (await reach(phoneGames[0]!, phoneGames[0]!.getByRole('button', { name: 'Dance', exact: true }))).click();
          await expect(hostGame.getByTestId('revealed-artist-avatar')).toHaveAttribute('data-emote', 'dance');
          await capture(phonePages[0]!, `${artifacts}/round-${round}-phone-artist-emote.png`);
          phoneZeroPerformed = true;
        }
        await hostNext(host, roomCode);
      }
      if (round === 1) expect(phoneZeroPerformed).toBe(true);
      await waitPhase(host, roomCode, 'round-results');
      await waitPhonePhase(phoneGames[0]!, 'round-results');
      await waitHostPhase(hostGame, 'round-results');
      await capture(hostPage, `${artifacts}/round-${round}-results.png`);
      if(!(await room(host,roomCode)).sketchRelay!.showdown!.workshop!.intermission) await hostNext(host,roomCode);
      expect((await room(host,roomCode)).sketchRelay!.showdown!.workshop!.intermission).toBe(true);
      await expect(phoneGames[0]!.getByRole('heading',{name:'Which one made you laugh the most?'})).toBeVisible();
      if (round < 3) {
        await hostNext(host, roomCode);
        await waitPhase(host, roomCode, 'halfway');
        await waitPhonePhase(phoneGames[0]!, 'halfway');
        await waitHostPhase(hostGame, 'halfway');
        await capture(hostPage, `${artifacts}/round-${round}-intermission.png`);
        await hostNext(host, roomCode);
        await waitPhase(host, roomCode, round === 1 ? 'curse-selection' : 'final-preparation');
      } else {
        await hostNext(host, roomCode);
        await waitPhase(host, roomCode, 'complete');
      }
    }

    await expect(phoneGames[0]!.getByRole('heading', { name: 'Art happened. Somehow.' })).toBeVisible();
    await capture(phonePages[0]!, `${artifacts}/complete-phone-results.png`);
    const exhibition = phoneGames[0]!.getByRole('button', { name: 'Explore our exhibition', exact: true });
    await expect(exhibition).toBeVisible();
    await (await reach(phoneGames[0]!, exhibition)).click();
    const exhibitionDialog = phoneGames[0]!.getByRole('dialog', { name: 'The royal exhibition' });
    await expect(exhibitionDialog).toBeVisible();
    await capture(phonePages[0]!, `${artifacts}/complete-phone-exhibition.png`);
    await expect(exhibitionDialog.getByRole('button', { name: 'Next exhibit', exact: true })).toBeVisible();
    await (await reach(phoneGames[0]!, exhibitionDialog.getByRole('button', { name: 'Next exhibit', exact: true }))).click();
    await expect(exhibitionDialog.getByRole('button', { name: 'Previous exhibit', exact: true })).toBeVisible();
    await (await reach(phoneGames[0]!, exhibitionDialog.getByRole('button', { name: 'Previous exhibit', exact: true }))).click();
    await expect(exhibitionDialog.getByRole('button', { name: 'Original sketch', exact: true })).toBeVisible();
    await (await reach(phoneGames[0]!, exhibitionDialog.getByRole('button', { name: 'Enchanted version', exact: true }))).click();
    for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }]) {
      await phonePages[0]!.setViewportSize(viewport);
      await expect.poll(async () => exhibitionDialog.locator('[data-view="art"]').evaluate(root => {
        const box = root.getBoundingClientRect();
        const controls = [...root.querySelectorAll(':scope > select,:scope > h3,:scope > div[role="group"],:scope > button')];
        const separated = controls.every((el, index) => !index || el.getBoundingClientRect().top >= controls[index - 1]!.getBoundingClientRect().bottom - 1);
        return separated && [...root.querySelectorAll('button,select,img')].every(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1; });
      })).toBe(true);
      await expect(exhibitionDialog.locator('.screen-page-navigation')).toHaveCount(0);
      await capture(phonePages[0]!, `${artifacts}/exhibition-${viewport.width}x${viewport.height}.png`);
    }
    await phonePages[0]!.setViewportSize({ width: 320, height: 568 });
    await exhibitionDialog.getByLabel('Collection', { exact: true }).selectOption('mine');
    await expect(exhibitionDialog.getByText('EXHIBIT 1 OF 3 · ROUND 1', { exact: true })).toBeVisible();
    await exhibitionDialog.getByRole('button', { name: 'Original sketch', exact: true }).click();
    await expect(exhibitionDialog.getByRole('button', { name: 'Original sketch', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await exhibitionDialog.getByRole('button', { name: 'Drawing details & download', exact: true }).click();
    const detailsDialog = phoneGames[0]!.getByRole('dialog', { name: 'Exhibit details' });
    await (await reach(phoneGames[0]!, detailsDialog.getByText('AI transformation prompt', { exact: true }))).click();
    await expect(detailsDialog.locator('details p')).toHaveText(SKETCH_TRANSFORM_PROMPT);
    await (await reach(phoneGames[0]!, detailsDialog.getByRole('link', { name: 'Save original sketch ↓', exact: true }))).click({ trial: true });
    await detailsDialog.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(exhibitionDialog).toBeVisible();
    await capture(phonePages[0]!, `${artifacts}/complete-phone-enchanted-exhibit.png`);
    await (await reach(phoneGames[0]!, exhibitionDialog.getByRole('button', { name: 'Back', exact: true }))).click();

    const originalScores = (await room(host, roomCode)).sketchRelay!.scores;
    // Force the supported HTTP fallback for the injected replay error, then verify reload retains results.
    await host.route(`**/api/rooms/${roomCode}/realtime`, route => route.fulfill({ status: 503, json: { error: { message: 'Testing HTTP replay recovery' } } }));
    await hostPage.reload();
    await waitHostPhase(hostGame, 'complete');
    const hostActionsRoute = `**/api/rooms/${roomCode}/host-actions`;
    await host.route(hostActionsRoute, async route => {
      const request = route.request();
      if (request.method() !== 'POST') { await route.continue(); return; }
      const body = request.postDataJSON() as { type?: string };
      if (body.type === 'PLAY_AGAIN') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_UNAVAILABLE', message: 'Replay path intentionally unavailable in this test.' } }) });
        return;
      }
      await route.continue();
    });
    try {
      await hostGame.getByRole('button', { name: 'One more exhibition ↗', exact: true }).click();
      await expect(hostGame.getByRole('alert').filter({ hasText: 'The next exhibition could not start.' })).toHaveText(/The next exhibition could not start\. Your results are safe\./);
      expect((await room(host, roomCode)).sketchRelay!.scores).toEqual(originalScores);
    } finally {
      await host.unroute(hostActionsRoute);
    }

    await expect(hostGame.getByRole('button', { name: 'Play fish bonus →', exact: true })).toHaveCount(0);
    await capture(hostPage, `${artifacts}/completed-independent-sorcery.png`);
    expect((await room(host, roomCode)).sketchRelay!.phase).toBe('complete');
  } finally {
    try {
      if (sessionCode) await resetSession(host, sessionCode);
    } finally {
      await Promise.allSettled([host.close(), ...phoneContexts.map(context => context.close())]);
    }
  }
});
