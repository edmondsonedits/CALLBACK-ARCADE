import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { setupFish, completeMain, openScreens, reloadScreen, mainResult, read, finale, openFish, fishAction, drawEditorFish, inspectFishPixels, uploadFish, art, toReveal, waitFishPhase, finishPresentation, noNewJobs, noOverflow, type Harness } from "./fixtures/fish-room";

// These checks use a no-provider managed preview. They do not require a test clock,
// mock a room snapshot, or reopen the completed main match.
test("independent fish setup survives reload and can return to the lobby without starting", async ({ browser }) => {
  const h=await setupFish(browser);
  try {
    await openScreens(h);
    await expect(h.tv!.getByRole('heading',{name:'Play to the death?',exact:true})).toBeVisible();
    const first=await finale(h.host,h.code);expect(first.phase).toBe('configure');
    await reloadScreen(h,h.tv!);expect((await finale(h.host,h.code)).finaleId).toBe(first.finaleId);
    expect((await read(h.host,h.code)).sketchRelay).toBeNull();
    await h.tv!.getByRole('button',{name:'Return to lobby',exact:true}).click();
    await expect.poll(async()=>(await read(h.host,h.code)).phase).toBe('LOBBY');
    expect((await read(h.host,h.code)).fishGame).toBeNull();await noNewJobs(h);
    for(const page of [h.tv!,...h.pages])await noOverflow(page);expect(h.errors).toEqual([]);
  }finally{await h.close();}
});

test("three authenticated artists lock transparent fish and partial peaceful ballots without altering main scores", async ({ browser }) => {
  test.setTimeout(240_000);
  const h = await setupFish(browser);
  try {
    await completeMain(h); const original = mainResult(await read(h.host, h.code)); await openScreens(h); await openFish(h, "peaceful");
    await fishAction(h.host, h.code, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90 }, 409);
    await fishAction(h.phones[0]!, h.code, "FISH_ADD_TIME", {}, 401);
    const { bytes, actionId, assetId } = await drawEditorFish(h.pages[0]!);
    await inspectFishPixels(h.fixture, bytes);
    const retry = await uploadFish(h, h.phones[0]!, bytes, actionId); expect((await retry.json() as { assetId: string }).assetId).toBe(assetId);
    await uploadFish(h, h.phones[0]!, await art(h.fixture, true, 1), actionId, 409);
    await uploadFish(h, h.phones[0]!, bytes, crypto.randomUUID(), 409);
    const privateState = await finale(h.host, h.code);
    expect(privateState.entries).toEqual([]); expect(JSON.stringify(privateState)).not.toContain(assetId);
    for (let index = 1; index < 3; index++) await uploadFish(h, h.phones[index]!, await art(h.fixture, true, index));
    await reloadScreen(h, h.pages[0]!); expect((await finale(h.phones[0]!, h.code)).self!.submitted).toBe(true);
    await toReveal(h); const revealed = await finale(h.host, h.code);
    expect(revealed.entries).toHaveLength(3); expect(revealed.entries.every(entry => !entry.artistName && !entry.playerId)).toBe(true);
    await waitFishPhase(h, ["voting"]);
    const phone = await finale(h.phones[0]!, h.code); expect(phone.phase).toBe("voting"); expect(phone.rankLimit).toBe(2);
    await fishAction(h.phones[0]!, h.code, "FISH_BALLOT", { ranking: [phone.self!.ownEntryId!] }, 409);
    const other = phone.self!.ballotOptions[0]!;
    await fishAction(h.phones[0]!, h.code, "FISH_BALLOT", { ranking: [other, other] }, 409);
    await fishAction(h.host, h.code, "FISH_BALLOT", { ranking: [other] }, 401);
    const lockId = crypto.randomUUID(); await fishAction(h.phones[0]!, h.code, "FISH_BALLOT", { ranking: [other] }, 200, lockId);
    await fishAction(h.phones[0]!, h.code, "FISH_BALLOT", { ranking: [] }, 409);
    for (const context of h.phones.slice(1)) await fishAction(context, h.code, "FISH_BALLOT", { ranking: [] });
    const locked = await waitFishPhase(h, ["cinematic"]); expect(locked.result).toBeUndefined(); expect(locked.champion).toBeUndefined();
    expect(locked.cinematic!.event!.kind).toBe("peaceful-awards"); expect(locked.cinematic!.eliminatedEntryIds).toEqual([]);
    const final = await finishPresentation(h); expect(final.phase).toBe("aquarium"); expect(final.mode).toBe("peaceful");
    expect(final.result!.kind).toBe("voted"); expect(final.result!.ranking[0]!.entryId).toBe(other); expect(final.result!.ranking[0]!.points).toBe(2);
    expect(final.result!.receivedBallots).toBe(3); expect(final.result!.selections).toBe(1);
    expect(new Set(final.entries.map(entry => entry.id)).size).toBe(3); expect(final.entries.map(entry => entry.artistName).sort()).toEqual([...h.names].sort());
    const stored = await h.phones[0]!.request.get(`/api/rooms/${h.code}/media/${assetId}`); expect(stored.status()).toBe(200); expect(await stored.body()).toEqual(bytes);
    await reloadScreen(h, h.tv!); await reloadScreen(h, h.pages[0]!); expect((await finale(h.host, h.code)).result).toEqual(final.result);
    await h.tv!.bringToFront();
    await expect(h.tv!.getByTestId("fish-tank")).toHaveAttribute("data-phase", "aquarium");
    // Host button defaults must not turn this full-tank hit layer opaque.
    const hitPlane = h.tv!.getByRole("button", { name: "Select a swimming fish to meet its artist" });
    await expect(hitPlane).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(hitPlane).toHaveCSS("border-width", "0px");
    await h.tv!.waitForTimeout(1000);
    await mkdir(".logs/fish-acceptance", { recursive: true });
    await h.tv!.screenshot({ path: `.logs/fish-acceptance/peaceful-${browser.browserType().name()}.png` });
    expect(mainResult(await read(h.host, h.code))).toEqual(original); await noNewJobs(h);
    for (const page of [h.tv!, ...h.pages]) await noOverflow(page);
    expect(h.errors).toEqual([]);
  } finally { await h.close(); }
});

test("zero, one and two valid fish in three-seat rooms preserve drafts, skip forced ballots and retain the lucky result", async ({ browser }) => {
  test.setTimeout(300_000);
  const rooms: Harness[] = [];
  try {
    // Start their real deadlines together, keeping the reduced-entry cases economical.
    for (let count = 0; count <= 2; count++) { const h = await setupFish(browser); rooms.push(h); await completeMain(h); }
    const baselines = await Promise.all(rooms.map(async h => mainResult(await read(h.host, h.code))));
    for (const [count, h] of rooms.entries()) { await openFish(h, "shark"); for (let index = 0; index < count; index++) await uploadFish(h, h.phones[index]!, await art(h.fixture, true, index)); }
    const states = await Promise.all(rooms.map(toReveal));
    expect(states[0]!.phase).toBe("closed"); expect(states[0]!.closedReason).toBe("no-fish");
    for (const [count, h] of rooms.entries()) {
      if (count === 0) continue;
      const state = states[count]!; expect(state.phase).toBe("reveal"); expect(state.entries).toHaveLength(count); expect(state.expectedBallotCount).toBe(0);
      expect((await finale(h.phones[2]!, h.code)).self!.eligible).toBe(false);
      await fishAction(h.phones[2]!, h.code, "FISH_BALLOT", { ranking: [] }, 409);
      if (count === 2) expect(state.notice).toContain("lucky draw, not a vote");
      await fishAction(h.host, h.code, "FISH_ADVANCE");
      const presentation = await finale(h.host, h.code); expect(presentation.phase).not.toBe("voting");
      if (count === 1) { expect(presentation.mode).toBe("peaceful"); expect(presentation.champion).toBeUndefined(); }
      const final = await finishPresentation(h); expect(final.phase).toBe("aquarium"); expect(final.result!.kind).toBe(count === 1 ? "solo" : "lucky");
      expect(final.entries).toHaveLength(count); expect(new Set(final.entries.map(entry => entry.id)).size).toBe(count);
      if (count === 2) { expect(final.champion!.label).toBe("Lucky Tank Champion"); const result = final.result; for (let poll = 0; poll < 3; poll++) expect((await finale(h.host, h.code)).result).toEqual(result); }
      expect(mainResult(await read(h.host, h.code))).toEqual(baselines[count]); await noNewJobs(h);
    }
    expect(mainResult(await read(rooms[0]!.host, rooms[0]!.code))).toEqual(baselines[0]); await noNewJobs(rooms[0]!);
  } finally { await Promise.allSettled(rooms.map(h => h.close())); }
});
