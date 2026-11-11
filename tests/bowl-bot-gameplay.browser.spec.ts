import { expect, test } from '@playwright/test';
import { BOWL_BOT_SCROLLS } from '../server/engine';

test('four Bowl bots stay connected, reject wrong guesses and score a matching public clue once', async ({ browser, baseURL }) => {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL! } });
  try {
    const created = await host.request.post('/api/rooms', { data: { gameLength: 'bowl-of-fools', contentMode: 'party', timerAccessibility: false, foolHostName: 'QA Host', foolScrollsPerPlayer: 1 } });
    expect(created.status()).toBe(201); const { code } = await created.json() as { code: string };
    const sync = async () => {
      const response = await host.request.post(`/api/rooms/${code}/sync`, { data: { version: 0 } });
      expect(response.status(), await response.text()).toBe(200);
      return response.json() as Promise<{ phase: string; roundId: string; players: { id: string; bot?: boolean }[]; foolBowl: { spokenClue: string | null; teamScores: Record<string, number> } }>;
    };
    const act = async (type: string, payload: Record<string, unknown>) => {
      const state = await sync(); return host.request.post(`/api/rooms/${code}/host-actions`, { data: { type, actionId: crypto.randomUUID(), roundId: state.roundId, expectedPhase: state.phase, payload } });
    };
    const creator = (await sync()).players.find(player => !player.bot)!;
    for (let seat = 2; seat <= 5; seat++) expect((await act('SET_BOT_SEAT', { seat, enabled: true })).status()).toBe(200);
    expect((await act('REMOVE_PLAYER', { playerId: creator.id })).status()).toBe(200);
    const tv = await host.newPage(); await tv.goto(`/host/${code}`);
    expect((await act('START_GAME', {})).status()).toBe(200);
    await expect.poll(async () => (await sync()).foolBowl?.spokenClue, { timeout: 60_000 }).toBeTruthy();
    await expect(tv.locator('.fool-public-clue')).toBeVisible();
    await expect.poll(async () => tv.evaluate(() => {
      const score = document.querySelector('.fool-scoreboard')!.getBoundingClientRect();
      const card = document.querySelector('.fool-turn-card')!.getBoundingClientRect();
      const rail = document.querySelector('.player-rail')!.getBoundingClientRect();
      return score.top >= 72 && score.bottom < card.top && card.bottom + 6 <= rail.top && rail.bottom <= innerHeight;
    })).toBe(true);
    const before = await sync();
    const knownAnswer = Object.entries(BOWL_BOT_SCROLLS).find(([, entry]) => entry.clue === before.foolBowl.spokenClue)?.[0];
    expect(knownAnswer, 'a practice clue should identify a familiar word').toBeTruthy();
    const wrong = tv.waitForResponse(response => response.url().endsWith('/host-actions') && response.request().postDataJSON()?.type === 'JUDGE_BOT_FOOL');
    await tv.getByRole('textbox', { name: "Team's guess" }).fill('definitely the wrong answer');
    await tv.getByRole('button', { name: 'Judge correct', exact: true }).click();
    expect((await wrong).status()).toBeGreaterThanOrEqual(400);
    await expect(tv.getByText('That guess does not match the current scroll. Listen and try again.', { exact: true })).toBeVisible();
    await expect(tv.getByRole('dialog', { name: 'Unhandled Promise Rejection' })).toHaveCount(0);
    expect((await sync()).foolBowl.teamScores).toEqual(before.foolBowl.teamScores);
    const correct = tv.waitForResponse(response => response.url().endsWith('/host-actions') && response.request().postDataJSON()?.type === 'JUDGE_BOT_FOOL');
    await tv.getByRole('textbox', { name: "Team's guess" }).fill(knownAnswer!);
    await tv.getByRole('button', { name: 'Judge correct', exact: true }).click();
    expect((await correct).status()).toBe(200);
    const after = await sync();
    expect(Object.values(after.foolBowl.teamScores).reduce((a, b) => a + b, 0)).toBe(Object.values(before.foolBowl.teamScores).reduce((a, b) => a + b, 0) + 1);
    await expect(tv.getByText(/Reconnecting|Could not reach the room/)).toHaveCount(0);
    expect(await tv.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await tv.screenshot({ path: '.logs/qa-bots/bowl-verified-guess.png' });
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await tv.setViewportSize(viewport);
      await expect.poll(async () => tv.evaluate(() => {
        const score = document.querySelector('.fool-scoreboard')!.getBoundingClientRect();
        const controls = document.querySelector('.fool-answer-buttons')!.getBoundingClientRect();
        const rail = document.querySelector('.player-rail')!.getBoundingClientRect();
        return score.top >= 72 && controls.bottom + 6 <= rail.top && rail.bottom <= innerHeight;
      })).toBe(true);
    }
  } finally { await host.close(); }
});
