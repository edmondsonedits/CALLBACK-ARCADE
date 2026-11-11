/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { OwnedPartyRooms } from "./helpers/owned-party-rooms";
const ownedRooms = new OwnedPartyRooms();
test.afterEach(() => ownedRooms.closeAll());

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const jsonHeaders = { "Content-Type": "application/json", Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };
const fullscreenQa = process.env.CALLBACK_TEST_FULLSCREEN === "1" || process.env.CALLBACK_QA_FULLSCREEN === "1";
const transientFullscreenPhases = new Set([
  "INTRO", "ROUND_INTRO", "ANSWER_LOCK", "VOTE_LOCK", "IMAGE_REVEAL", "REVEAL", "ROUND_RESULTS", "FINAL_RESULTS",
  "MYSTERY_REVEAL", "RUMOUR_IMAGE_REVEAL", "RUMOUR_REVEAL", "WAR_TURN_REVEAL", "WAR_ROUND_REVEAL", "FOOL_ROUND_REVEAL",
]);
const phonePhaseLabels: Record<string, string> = {
  MYSTERY_DECOYS: "FILE COVER STORIES", MYSTERY_VOTING: "FIND THE TRUE REPORT", MYSTERY_REVEAL: "CASE CLOSED",
  RUMOUR_GUESSING: "WHAT DO YOU SEE?", RUMOUR_IMAGE_REVEAL: "AI IS RETELLING IT", RUMOUR_REVEAL: "FOLLOW THE RUMOUR",
  RUMOUR_VOTING: "CROWN THE BEST MUTATION", WAR_RANKING: "RANK THE ORDERS", WAR_COUNCIL: "COUNCIL COMMAND",
  WAR_TURN_REVEAL: "INTELLIGENCE CHECK", WAR_ROUND_REVEAL: "PLAN REVEALED", FOOL_TEAM_SETUP: "CHOOSE YOUR FOOLS",
  FOOL_WRITING: "FILL THE BOWL", FOOL_TURN: "YOUR TEAM'S TURN", FOOL_ROUND_REVEAL: "NEXT ROUND", FOOL_SUDDEN_DEATH: "SUDDEN DEATH",
};
function phonePhaseLabel(phase: string) { return phonePhaseLabels[phase] ?? phase.replaceAll("_", " "); }

type FullscreenProbe = Awaited<ReturnType<typeof createFullscreenProbe>>;

async function createFullscreenProbe(host: BrowserContext, player: BrowserContext, code: string, mode: string) {
  const hostPage = await host.newPage();
  await hostPage.setViewportSize({ width: 1366, height: 768 });
  await hostPage.goto(`/host/${code}`);
  const phonePage = await player.newPage();
  await phonePage.setViewportSize({ width: 320, height: 568 });
  await phonePage.goto(`/play/${code}`);
  console.log(`[fullscreen-room] ${mode} ${code} host=${hostPage.url()} phone=${phonePage.url()}`);
  const directory = `.logs/fullscreen/${mode}`;
  await mkdir(directory, { recursive: true });
  const captured = new Set<string>();
  const missed: Array<{ phase: string; advancedTo: string }> = [];
  let navigationChecks = 0;
  let draftChecks = 0;
  let reachableActions = 0;

  return {
    hasPhase(phase: string) { return captured.has(phase); },
    async check(phase: string) {
      const phaseClass = `phase-${phase.toLowerCase().replaceAll("_", "-")}`;
      const phonePhase = phonePage.locator(".phone-phase-row .phase-pill");
      const transient = transientFullscreenPhases.has(phase);
      if (transient) {
        let rendered = false;
        const endAt = Date.now() + 7_000;
        while (Date.now() < endAt) {
          try {
            await expect(hostPage.locator(`.host-shell.${phaseClass}`)).toBeVisible({ timeout: 350 });
            await expect(phonePhase).toHaveText(phonePhaseLabel(phase), { timeout: 350 });
            rendered = true;
            break;
          } catch {
            const latest = await sync(host, code);
            if (latest.phase !== phase) {
              missed.push({ phase, advancedTo: latest.phase });
              console.log(`[fullscreen-missed] ${code} transient=${phase} authoritative=${latest.phase}`);
              return false;
            }
          }
        }
        if (!rendered) throw new Error(`${mode} host/phone did not render transient ${phase} before the authoritative phase advanced`);
      } else {
        await expect(hostPage.locator(`.host-shell.${phaseClass}`), `${mode} host did not render ${phase}`).toBeVisible({ timeout: 20_000 });
        await expect(phonePhase).toHaveText(phonePhaseLabel(phase), { timeout: 20_000 });
      }
      const dimensions = { host: { width: 1366, height: 768 }, phone: { width: 320, height: 568 } };
      if(mode==='king-mystery' && phase==='MYSTERY_REVEAL'){
        const stage=hostPage.locator('.mystery-stage.phase-mystery-reveal');
        await expect(stage).toBeVisible();
        await expect.poll(()=>stage.evaluate(el=>{for(let node:Element|null=el;node;node=node.parentElement)if(Number(getComputedStyle(node).opacity)<.99)return false;return true;})).toBe(true);
        for(const card of await stage.locator('.mystery-real-request,.mystery-results-grid article,.score-strip').all())await expect(card).toBeInViewport({ratio:.99});
      }
      for (const [name, page, viewport] of [["host", hostPage, dimensions.host], ["phone", phonePage, dimensions.phone]] as const) {
        const result = await page.evaluate(() => {
          const root = document.documentElement;
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const internal = [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((element) => {
              if (!element.getClientRects().length || element.closest(".sr-only,[aria-hidden='true'],[hidden]")) return false;
              if (element.matches("textarea,select,input")) return false;
              const style = getComputedStyle(element);
              const scrollY = ["auto", "scroll"].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 2;
              const scrollX = ["auto", "scroll"].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 2;
              return scrollX || scrollY;
            })
            .map((element) => ({
              selector: element.id ? `#${element.id}` : `${element.tagName.toLowerCase()}${[...element.classList].slice(0, 3).map((name) => `.${name}`).join("")}`,
              overflowX: getComputedStyle(element).overflowX,
              overflowY: getComputedStyle(element).overflowY,
              client: `${element.clientWidth}x${element.clientHeight}`,
              scroll: `${element.scrollWidth}x${element.scrollHeight}`,
            }));
          return {
            viewport: `${viewportWidth}x${viewportHeight}`,
            root: `${root.clientWidth}x${root.clientHeight}`,
            page: `${root.scrollWidth}x${root.scrollHeight}`,
            internal,
          };
        });
        expect(result.viewport, `${mode} ${phase} ${name} viewport`).toBe(`${viewport.width}x${viewport.height}`);
        if(name === "host") expect(result.internal, `${mode} ${phase} host has user-scrollable internal panels`).toEqual([]);
        const [pageWidth, pageHeight] = result.page.split("x").map(Number);
        expect(pageWidth, `${mode} ${phase} ${name} horizontal page overflow: ${JSON.stringify(result)}`).toBeLessThanOrEqual(viewport.width);
        expect(pageHeight, `${mode} ${phase} ${name} vertical page overflow: ${JSON.stringify(result)}`).toBeLessThanOrEqual(viewport.height);
      }

      await expect(phonePage.getByRole("button", {name: /^(Next area|Back area|Next screen)$/})).toHaveCount(0);
      const controls = phonePage.locator(".phone-game-screen:not([hidden]) .phone-content :is(button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled])):visible");
      for (const control of await controls.all()) {
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport();
        reachableActions += 1;
      }
      navigationChecks += 1;
      await phonePage.locator(".phone-content:visible").first().evaluate(el => {el.scrollTop=0;}).catch(()=>{});

      if (draftChecks === 0) {
        const field = phonePage.locator(".phone-task-pages textarea:visible, .phone-task-pages input:visible:not([type=hidden]):not([type=checkbox]):not([type=radio]), .phone-content textarea:visible, .phone-content input:visible:not([type=hidden]):not([type=checkbox]):not([type=radio])").first();
        if (await field.count()) {
          const original = await field.inputValue();
          const draft = `fullscreen draft ${mode}`;
          await field.fill(draft);
          const character=phonePage.getByRole("button",{name:"Character",exact:true});
          if(await character.isVisible()) {await character.click();await phonePage.getByRole("button",{name:"Game",exact:true}).click();}
          await expect(field).toHaveValue(draft);
          draftChecks += 1;
          // This test owns only the local UI draft; restore the previous value before the API driver continues.
          await field.fill(original);
        }
      }

      if (!captured.has(phase)) {
        await hostPage.screenshot({ path: `${directory}/${phase.toLowerCase()}.host-1366x768.png`, caret: "initial", animations:"disabled" });
        await phonePage.screenshot({ path: `${directory}/${phase.toLowerCase()}.phone-320x568.png`, caret: "initial", animations:"disabled" });
        captured.add(phase);
      }
      return true;
    },
    report() {
      return { mode, phases: [...captured], missedTransientPhases: missed, navigationChecks, reachableActions, draftChecks };
    },
  };
}

async function createRoom(browser: Browser, gameLength: "standard" | "pictures" | "comic" | "king-mystery" | "royal-rumours" | "bowl-of-fools") {
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 }, extraHTTPHeaders: { Origin: baseURL } });
  const response = await host.request.post("/api/rooms", { headers: jsonHeaders, data: { gameLength, contentMode: "party", timerAccessibility: false, ...(gameLength === "bowl-of-fools" ? { foolHostName: "Host Player", foolScrollsPerPlayer: 1, foolVoiceEnabled: false } : {}) } });
  expect(response.status()).toBe(201);
  const body = await response.json() as { code: string };
  await ownedRooms.track(host, body.code, baseURL);
  return { host, code: body.code };
}

async function createSoloRoom(browser: Browser, gameLength: "standard" | "pictures" | "comic" | "king-mystery" | "royal-rumours", soloLiveImages = false) {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
  const response = await context.request.post("/api/rooms", { headers: jsonHeaders, data: { gameLength, contentMode: "party", timerAccessibility: false, soloMode: true, soloLiveImages, soloPlayerName: "Alex", botCount: 2 } });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json() as { code: string };
  await ownedRooms.track(context, body.code, baseURL);
  return { context, code: body.code };
}

async function joinPlayers(browser: Browser, code: string, count: number) {
  const contexts: BrowserContext[] = [];
  for (let index = 0; index < count; index += 1) {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
    const response = await context.request.post(`/api/rooms/${code}/join`, { headers: jsonHeaders, data: { nickname: `Player ${index + 1}` } });
    expect(response.status()).toBe(201);
    contexts.push(context);
  }
  return contexts;
}

async function sync(context: BrowserContext, code: string) {
  const response = await context.request.post(`/api/rooms/${code}/sync`, { headers: jsonHeaders, data: { version: 0 } });
  expect(response.status()).toBe(200);
  return response.json() as Promise<any>;
}

async function syncAs(context: BrowserContext, code: string, role: "host" | "player") {
  const response = await context.request.post(`/api/rooms/${code}/sync`, { headers: { ...jsonHeaders, "X-Callback-Role": role }, data: { version: 0 } });
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<any>;
}

async function hostAction(host: BrowserContext, code: string, snapshot: any, type: string, payload: Record<string, unknown> = {}, tolerateStale = false) {
  const response = await host.request.post(`/api/rooms/${code}/host-actions`, { headers: jsonHeaders, data: { type, actionId: crypto.randomUUID(), roundId: snapshot.roundId, expectedPhase: snapshot.phase, payload } });
  const body = await response.text();
  if ((tolerateStale || fullscreenQa) && response.status() === 409 && body.includes("STALE_PHASE")) {
    console.log(`[fullscreen-stale-action] host ${code} phase=${snapshot.phase} action=${type}`);
    return false;
  }
  expect(response.status(), body).toBe(200);
  return true;
}

async function playerAction(player: BrowserContext, code: string, snapshot: any, type: string, payload: Record<string, unknown>, tolerateStale = false) {
  const response = await player.request.post(`/api/rooms/${code}/player-actions`, { headers: jsonHeaders, data: { type, actionId: crypto.randomUUID(), roundId: snapshot.roundId, expectedPhase: snapshot.phase, payload } });
  const body = await response.text();
  if ((tolerateStale || fullscreenQa) && response.status() === 409 && body.includes("STALE_PHASE")) {
    console.log(`[fullscreen-stale-action] player ${code} phase=${snapshot.phase} action=${type}`);
    return false;
  }
  expect(response.status(), body).toBe(200);
  return true;
}

async function skipCompletedGraceWindow(host: BrowserContext, code: string, phase: string) {
  const latest = await sync(host, code);
  if (latest.phase === phase) await hostAction(host, code, latest, "SKIP");
}

function requiredVoteCount(phone: any): number {
  const eligible = phone.answerOrder.filter((answer: any) => answer.voteEligible !== false);
  if (phone.role === "audience") return Math.min(1, eligible.length);
  if (["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL"].includes(phone.roundKind)) return Math.min(1, eligible.length);
  if (phone.roundKind === "COMIC_FRAME") return Math.min(3, eligible.length);
  const activePlayers = phone.players.filter((player: any) => player.role === "player" && player.active).length;
  return activePlayers >= 4 && phone.answerOrder.length >= 3 ? Math.min(2, eligible.length) : Math.min(1, eligible.length);
}

function validCatchAnswer(instruction: string | null, playerIndex: number) {
  if (!instruction) return `Callback answer ${playerIndex + 1} 🎉`;
  const exact = instruction.match(/exactly (\d+) words/i); if (exact) return Array.from({ length: Number(exact[1]) }, (_, index) => ["bold", "tiny", "robot", "moon", "duck", "joke", "wins", "now"][index]).join(" ");
  if (/no more than/i.test(instruction)) return "Bold tiny robot";
  if (/question mark/i.test(instruction)) return "Could tiny ducks run this?";
  if (/exclamation/i.test(instruction)) return "Tiny ducks win!";
  if (/word banana/i.test(instruction)) return "A banana runs the meeting";
  if (/word actually/i.test(instruction)) return "Well actually the moon won";
  if (/word meanwhile/i.test(instruction)) return "Meanwhile tiny ducks celebrate";
  if (/capitalized name/i.test(instruction)) return "Gerald runs the moon";
  if (/letter A/i.test(instruction) && /Start/i.test(instruction)) return "Always trust tiny ducks";
  if (/letter B/i.test(instruction) && /Start/i.test(instruction)) return "Bold ducks win";
  if (/letter S/i.test(instruction) && /Start/i.test(instruction)) return "Sure tiny robots win";
  if (/letter E/i.test(instruction) && /not/i.test(instruction)) return "Bold tiny robot";
  if (/letter A/i.test(instruction) && /not/i.test(instruction)) return "Tiny robot wins";
  if (/letter S/i.test(instruction) && /not/i.test(instruction)) return "Tiny robot won";
  return "Bold tiny robot";
}

async function driveMatch(host: BrowserContext, players: BrowserContext[], code: string, encore = false, fullscreenProbe?: FullscreenProbe) {
  let snapshot = await sync(host, code);
  if (!encore) await hostAction(host, code, snapshot, "START_GAME");
  else await hostAction(host, code, snapshot, "START_ENCORE");
  for (let step = 0; step < 180; step += 1) {
    snapshot = await sync(host, code);
    if (snapshot.phase === "POST_GAME") return snapshot;
    if (fullscreenProbe && !fullscreenProbe.hasPhase(snapshot.phase)) {
      console.log(`[fullscreen-render] ${code} step=${step} phase=${snapshot.phase} jobsPending=${Boolean(snapshot.imageJobsPending)}`);
      await fullscreenProbe.check(snapshot.phase);
      const refreshed = await sync(host, code);
      if (refreshed.phase !== snapshot.phase) {
        console.log(`[fullscreen-phase-advanced] ${code} rendered=${snapshot.phase} current=${refreshed.phase}`);
        continue;
      }
      snapshot = refreshed;
    }
    if (snapshot.imageJobsPending) {
      if (fullscreenProbe) console.log(`[fullscreen-jobs] ${code} step=${step} phase=${snapshot.phase} jobsPending=true`);
      const jobs = await Promise.all(players.map(() => host.request.post(`/api/rooms/${code}/jobs/run`, { headers: jsonHeaders, data: {} })));
      if (fullscreenProbe) console.log(`[fullscreen-jobs] ${code} step=${step} responses=${jobs.map((job) => job.status()).join(",")}`);
      jobs.forEach((job) => expect([200, 202, 204, 429]).toContain(job.status()));
      continue;
    }
    if (["INTRO", "ROUND_INTRO", "ANSWER_LOCK", "VOTE_LOCK", "IMAGE_REVEAL", "REVEAL", "ROUND_RESULTS", "FINAL_RESULTS", "ENCORE_IMAGE", "MYSTERY_REVEAL", "RUMOUR_IMAGE_REVEAL", "RUMOUR_REVEAL", "WAR_TURN_REVEAL", "WAR_ROUND_REVEAL", "FOOL_ROUND_REVEAL"].includes(snapshot.phase)) {
      await hostAction(host, code, snapshot, "SKIP");
      continue;
    }
    if (["ANSWERING", "FINAL_ANSWERING", "ENCORE_CONTRIBUTING", "ENCORE_FOLLOWUP"].includes(snapshot.phase)) {
      await Promise.all(players.map(async (player, index) => { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) await playerAction(player, code, phone, "SUBMIT_ANSWER", { answer: validCatchAnswer(phone.instruction, index) }); }));
      continue;
    }
    if (snapshot.phase === "PERSONAL_CHOICE") {
      await Promise.all(players.map(async (player, index) => { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) await playerAction(player, code, phone, "SUBMIT_PERSONAL_CHOICE", { choiceId: phone.choices[index % phone.choices.length].id }); }));
      await skipCompletedGraceWindow(host, code, snapshot.phase);
      continue;
    }
    if (snapshot.phase === "ROOM_PREDICTION") {
      await Promise.all(players.map(async (player) => { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) { const count = phone.taskData?.predictionLabels?.length ?? 10; const base = Math.floor(100 / count); const values = Array.from({ length: count }, (_value, index) => base + (index < 100 - base * count ? 1 : 0)); await playerAction(player, code, phone, "SUBMIT_PREDICTION", { values }); } }));
      await skipCompletedGraceWindow(host, code, snapshot.phase);
      continue;
    }
    if (snapshot.phase === "AUTHOR_GUESSING") {
      await Promise.all(players.map(async (player) => { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) { const guesses = Object.fromEntries((phone.taskData?.answers ?? []).map((answer: any, index: number) => [answer.id, phone.taskData.authors[index % phone.taskData.authors.length]?.id])); await playerAction(player, code, phone, "SUBMIT_AUTHOR_GUESSES", { guesses }); } }));
      await skipCompletedGraceWindow(host, code, snapshot.phase);
      continue;
    }
    if (snapshot.phase === "FINAL_WAGER") {
      await Promise.all(players.map(async (player) => { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) await playerAction(player, code, phone, "SUBMIT_WAGER", { targetPlayerId: phone.taskData.targets[0].id, wager: 250 }); }));
      await skipCompletedGraceWindow(host, code, snapshot.phase);
      continue;
    }
    if (["VOTING", "FINAL_VOTING"].includes(snapshot.phase)) {
      expect(snapshot.answers.every((answer: any) => !("authorId" in answer))).toBe(true);
      await Promise.all(players.map(async (player) => { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) { const eligible = phone.answerOrder.filter((answer: any) => answer.voteEligible !== false); const required = requiredVoteCount(phone); if (required > 0) await playerAction(player, code, phone, "SUBMIT_VOTE", { answerIds: eligible.slice(0, required).map((answer: any) => answer.id) }); } }));
      continue;
    }
    if (snapshot.phase === "MYSTERY_DECOYS") {
      expect(snapshot.answers).toHaveLength(0);
      expect(snapshot.mystery.options).toHaveLength(0);
      await Promise.all(players.map(async (player, index) => { const phone = await sync(player, code); if (!phone.taskData?.kingMystery?.originalAuthor && !phone.submitted) await playerAction(player, code, phone, "SUBMIT_KING_DECOY", { decoy: `The King ordering suspicious banquet portrait ${snapshot.mystery.turnNumber}-${index + 1}` }); }));
      await skipCompletedGraceWindow(host, code, snapshot.phase);
      continue;
    }
    if (snapshot.phase === "MYSTERY_VOTING") {
      expect(snapshot.answers).toHaveLength(0);
      expect(snapshot.mystery.options.length).toBeGreaterThanOrEqual(2);
      expect(snapshot.mystery.result).toBeNull();
      await Promise.all(players.map(async (player) => { const phone = await sync(player, code); if (!phone.taskData?.kingMystery?.originalAuthor && !phone.submitted) await playerAction(player, code, phone, "SUBMIT_KING_MYSTERY_VOTE", { choiceId: phone.taskData.kingMystery.options[0].id }); }));
      await skipCompletedGraceWindow(host, code, snapshot.phase);
      continue;
    }
    if (snapshot.phase === "RUMOUR_GUESSING") {
      for (const [index, player] of players.entries()) { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) await playerAction(player, code, phone, "SUBMIT_ROYAL_RUMOUR_GUESS", { guess: `The royal pigeon misplaced a golden spoon ${index + 1}` }); }
      continue;
    }
    if (snapshot.phase === "RUMOUR_VOTING") {
      for (const player of players) { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted && phone.taskData?.royalRumours?.voteOptions.length) await playerAction(player, code, phone, "SUBMIT_VOTE", { answerIds: [phone.taskData.royalRumours.voteOptions[0]] }); }
      await skipCompletedGraceWindow(host, code, snapshot.phase);
      continue;
    }
    if (snapshot.phase === "WAR_RANKING") {
      for (const player of players) { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) await playerAction(player, code, phone, "SUBMIT_WAR_RANKING", { orderedChoiceIds: phone.taskData.royalWarRoom.choices.map((choice: any) => choice.id) }); }
      continue;
    }
    if (snapshot.phase === "WAR_COUNCIL") {
      for (const player of players) { const phone = await sync(player, code); if (phone.taskData?.royalWarRoom?.commander) { const war = phone.warRoom; const rank = war.targetRanks.find((value: number) => !Object.values(war.placements).includes(value)); await playerAction(player, code, phone, "SUBMIT_WAR_GUESS", { choiceId: war.choices[rank - 1].id, rank }); break; } }
      continue;
    }
    if (snapshot.phase === "FOOL_TEAM_SETUP") {
      for (const player of players) { const phone = await sync(player, code); if (phone.phase === snapshot.phase) await playerAction(player, code, phone, "SET_FOOL_READY", { ready: true }); }
      continue;
    }
    if (snapshot.phase === "FOOL_WRITING") {
      for (const [index, player] of players.entries()) { const phone = await sync(player, code); if (phone.phase === snapshot.phase && !phone.submitted) await playerAction(player, code, phone, "SUBMIT_FOOL_SCROLLS", { scrolls: Array.from({ length: phone.foolBowl.scrollsPerPlayer }, (_, slot) => `Goose ${index + 1} spoon ${slot + 1}`) }); }
      continue;
    }
    if (["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(snapshot.phase)) {
      for (const player of players) { const phone = await sync(player, code); if (phone.selfId === phone.foolBowl?.clueGiverId) { await playerAction(player, code, phone, "FOOL_CORRECT", {}); break; } }
      continue;
    }
    throw new Error(`Unhandled phase ${snapshot.phase}`);
  }
  throw new Error("Match exceeded transition budget");
}

async function driveSoloMatch(context: BrowserContext, code: string) {
  let snapshot = await syncAs(context, code, "host");
  await hostAction(context, code, snapshot, "START_GAME");
  for (let step = 0; step < 180; step += 1) {
    snapshot = await syncAs(context, code, "host");
    if (snapshot.phase === "POST_GAME") return snapshot;
    if (snapshot.imageJobsPending) {
      const jobs = await Promise.all(Array.from({ length: 3 }, () => context.request.post(`/api/rooms/${code}/jobs/run`, { headers: jsonHeaders, data: {} })));
      jobs.forEach((job) => expect([200, 202, 204, 429]).toContain(job.status()));
      continue;
    }
    if (["INTRO", "ROUND_INTRO", "ANSWER_LOCK", "VOTE_LOCK", "IMAGE_REVEAL", "REVEAL", "ROUND_RESULTS", "FINAL_RESULTS"].includes(snapshot.phase)) {
      await hostAction(context, code, snapshot, "SKIP");
      continue;
    }
    const phone = await syncAs(context, code, "player");
    if (["ANSWERING", "FINAL_ANSWERING"].includes(snapshot.phase)) {
      if (!phone.submitted) await playerAction(context, code, phone, "SUBMIT_ANSWER", { answer: validCatchAnswer(phone.instruction, 0) });
      continue;
    }
    if (snapshot.phase === "PERSONAL_CHOICE") {
      if (!phone.submitted) await playerAction(context, code, phone, "SUBMIT_PERSONAL_CHOICE", { choiceId: phone.choices[0].id });
      else await hostAction(context, code, snapshot, "SKIP");
      continue;
    }
    if (snapshot.phase === "ROOM_PREDICTION") {
      if (!phone.submitted) { const count = phone.taskData?.predictionLabels?.length ?? 10; const base = Math.floor(100 / count); const values = Array.from({ length: count }, (_value, index) => base + (index < 100 - base * count ? 1 : 0)); await playerAction(context, code, phone, "SUBMIT_PREDICTION", { values }); }
      else await hostAction(context, code, snapshot, "SKIP");
      continue;
    }
    if (snapshot.phase === "AUTHOR_GUESSING") {
      if (!phone.submitted) { const guesses = Object.fromEntries((phone.taskData?.answers ?? []).map((answer: any, index: number) => [answer.id, phone.taskData.authors[index % phone.taskData.authors.length]?.id])); await playerAction(context, code, phone, "SUBMIT_AUTHOR_GUESSES", { guesses }); }
      else await hostAction(context, code, snapshot, "SKIP");
      continue;
    }
    if (snapshot.phase === "FINAL_WAGER") {
      if (!phone.submitted) await playerAction(context, code, phone, "SUBMIT_WAGER", { targetPlayerId: phone.taskData.targets[0].id, wager: 250 });
      else await hostAction(context, code, snapshot, "SKIP");
      continue;
    }
    if (["VOTING", "FINAL_VOTING"].includes(snapshot.phase)) {
      if (!phone.submitted && phone.answerOrder.length > 0) {
        const eligible = phone.answerOrder.filter((answer: any) => answer.voteEligible !== false);
        if (phone.roundKind === "PROMPT_AND_CIRCUMSTANCE" && snapshot.phase === "FINAL_VOTING") {
          expect(phone.answerOrder).toHaveLength(3);
          expect(phone.answerOrder.filter((answer: any) => answer.voteEligible === false)).toHaveLength(1);
          expect(phone.answerOrder.every((answer: any) => answer.image)).toBe(true);
        }
        if (phone.roundKind === "KING_PROMPTER_FINAL") {
          expect(phone.answerOrder).toHaveLength(phone.players.filter((player: any) => player.role === "player" && player.active).length);
          expect(phone.answerOrder.filter((answer: any) => answer.voteEligible === false)).toHaveLength(1);
          expect(phone.answerOrder.every((answer: any) => answer.image)).toBe(true);
        }
        const required = requiredVoteCount(phone);
        if (required > 0) await playerAction(context, code, phone, "SUBMIT_VOTE", { answerIds: eligible.slice(0, required).map((answer: any) => answer.id) });
      }
      continue;
    }
    throw new Error(`Unhandled solo phase ${snapshot.phase}`);
  }
  throw new Error("Solo match exceeded transition budget");
}

test("grand hall menu is complete, ordered, keyboard accessible, and persists local settings", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/?menu=1&legacy=1");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: "King Prompter" })).toBeVisible();

  const actions = page.locator("[data-menu-action]");
  await expect(actions).toHaveCount(13);
  expect(await actions.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-menu-action")))).toEqual(["Start Game", "Join Game", "Bowl of Fools", "Royal Rumours", "Royal Frame-Up", "Comic", "Arcade", "Party Games", "How to Play", "Avatar Studio", "History Books", "Settings", "Join Host Display"]);
  await expect(page.getByRole("link", { name: "Start Game", exact: true })).toHaveAttribute("href", "/host/new");
  await expect(page.getByRole("link", { name: "Join Game", exact: true })).toHaveAttribute("href", "/play");
  await expect(page.getByRole("link", { name: "Royal Rumours", exact: true })).toHaveAttribute("href", "/host/new?game=royal-rumours");
  await expect(page.getByRole("link", { name: "The Royal Frame-Up", exact: true })).toHaveAttribute("href", "/host/new?game=king-mystery");
  await expect(page.getByRole("link", { name: "Comic", exact: true })).toHaveAttribute("href", "/host/new?game=comic");
  await expect(page.getByRole("link", { name: "Royal War Room", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Birthday", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Arcade", exact: true })).toHaveAttribute("href", "/arcade");
  await expect(page.getByRole("link", { name: "Party Games", exact: true })).toHaveAttribute("href", "/party-games");
  await expect(page.getByRole("link", { name: "How to Play", exact: true })).toHaveAttribute("href", "/how-to-play");
  await expect(page.getByRole("link", { name: "Avatar Studio", exact: true })).toHaveAttribute("href", "/avatar-studio");
  for (const name of ["Start Game", "Join Game", "Bowl of Fools", "Royal Rumours", "The Royal Frame-Up", "Comic", "Arcade", "Party Games", "How to Play", "Avatar Studio", "History Books", "Settings"]) await expect(page.getByLabel(name, { exact: true })).toHaveCount(1);

  const focusOrder: string[] = [];
  for (let index = 0; index < 13; index += 1) {
    await page.keyboard.press("Tab");
    focusOrder.push(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute("aria-label") || (document.activeElement as HTMLElement).id));
  }
  expect(focusOrder).toEqual(["Start Game", "Join Game", "Bowl of Fools", "Royal Rumours", "The Royal Frame-Up", "Comic", "Arcade", "Party Games", "How to Play", "Avatar Studio", "History Books", "Settings", "home-display-code"]);
  expect(await page.evaluate(() => getComputedStyle(document.activeElement as HTMLElement).outlineStyle)).not.toBe("none");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Set the stage" })).toBeVisible();
  await page.getByLabel("Volume").fill("35");
  await page.getByLabel("Full stage motion").check();
  await page.getByRole("button", { name: "Replay Intro" }).click();
  await expect(page.locator(".tv-entry")).toHaveAttribute("data-entry-stage", "intro");

  await page.goto("/?menu=1&legacy=1");
  await expect(page.getByRole("heading", { name: "King Prompter" })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Volume")).toHaveValue("35");
  await expect(page.getByLabel("Full stage motion")).toBeChecked();
  await page.getByLabel("Use device setting").check();
  await page.getByLabel("Menu sound").uncheck();
  await page.getByLabel("Reduced motion").check();
  await expect(page.getByRole("button", { name: "Replay Intro" })).toBeDisabled();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { name: "King Prompter" })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Menu sound")).not.toBeChecked();
  await expect(page.getByLabel("Volume")).toHaveValue("35");
  await expect(page.getByLabel("Reduced motion")).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();

  await page.getByLabel("Four-character host code").fill("B");
  await page.getByRole("button", { name: /Watch/ }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter the four-character code shown on the main host screen.");
  await page.getByLabel("Four-character host code").fill("B4CK");
  await page.getByRole("button", { name: /Watch/ }).click();
  await page.waitForURL("**/display/B4CK");
});

test("Callback entry reaches role selection through skip, media failure, play rejection, and reduced motion", async ({ page, browser }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Start Callback" }).click();
  await expect(page.getByRole("button", { name: /Skip Intro/ })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: /Skip Intro/ }).click();
  await expect(page.getByRole("heading", { name: "Get everyone together.", exact: true })).toBeVisible();
  await expect(page.locator(".tv-loop-video")).toHaveAttribute("src", "/media/grand-hall/grand-hall-menu-loop.mp4");

  await page.route("**/intro.mp4", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Start Callback" }).click();
  await expect(page.getByRole("heading", { name: "Get everyone together.", exact: true })).toBeVisible();
  await expect(page.locator(".tv-entry")).toHaveAttribute("data-intro-failed", "true");
  await page.unroute("**/intro.mp4");

  await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Playback rejected", "NotAllowedError")); });
  await page.goto("/");
  await page.getByRole("button", { name: "Start Callback" }).click();
  await expect(page.getByRole("heading", { name: "Get everyone together.", exact: true })).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Start Callback" }).click();
  await expect(page.getByRole("heading", { name: "Get everyone together.", exact: true })).toBeVisible();
  await expect(page.locator(".tv-entry")).toHaveAttribute("data-effective-motion", "reduced");
  expect(await page.locator(".tv-intro-video").evaluate((video: HTMLVideoElement) => video.paused && video.currentTime === 0)).toBe(true);
  expect(await page.locator(".tv-loop-video").evaluate((video: HTMLVideoElement) => video.paused && getComputedStyle(video).display === "none")).toBe(true);

  const posterFailureContext = await browser.newContext({baseURL:new URL(page.url()).origin});
  const posterFailurePage = await posterFailureContext.newPage();
  await posterFailurePage.route("**/media/grand-hall/poster-*", (route) => route.abort());
  await posterFailurePage.goto("/?menu=1&legacy=1");
  await expect(posterFailurePage.locator(".tv-entry")).toHaveAttribute("data-poster-failed", "true");
  await expect(posterFailurePage.getByRole("link", { name: "Start Game", exact: true })).toBeVisible();
  await posterFailureContext.close();

  const loopFailureContext = await browser.newContext();
  const loopFailurePage = await loopFailureContext.newPage();
  await loopFailurePage.route("**/media/grand-hall/grand-hall-menu-loop.mp4", (route) => route.abort());
  await loopFailurePage.goto("/?menu=1&legacy=1");
  await expect(loopFailurePage.locator(".tv-entry")).toHaveAttribute("data-loop-failed", "true");
  await expect(loopFailurePage.getByRole("link", { name: "Start Game", exact: true })).toBeVisible();
  await expect(loopFailurePage.locator(".grand-hall-poster")).toBeVisible();
  await loopFailureContext.close();
});

test("landing and join composition fit all release viewports", async ({ page }) => {
  const errors: string[] = []; page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const menuViewports = [{ width: 1366, height: 768, file: "grand-hall-loop-1366x768.png" }, { width: 1920, height: 1080, file: "grand-hall-loop-1920x1080.png" }, { width: 2560, height: 1440, file: "grand-hall-loop-2560x1440.png" }, { width: 390, height: 844, file: "grand-hall-loop-390x844.png", source: "poster-phone-tall-780x1688" }, { width: 375, height: 450, file: "grand-hall-loop-375x450.png", source: "poster-phone-short-750x900" }];
  for (const viewport of menuViewports) {
    await page.setViewportSize(viewport); await page.goto("/?menu=1&legacy=1"); await expect(page.getByRole("heading", { name: "King Prompter" })).toBeVisible();
    await expect(page.locator(".tv-entry")).toHaveAttribute("data-poster-ready", "true");
    await expect(page.locator(".tv-entry")).toHaveAttribute("data-loop-failed", "false");
    expect(await page.locator(".tv-loop-video").evaluate((video: HTMLVideoElement) => !video.paused && video.currentTime >= 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (viewport.width >= 1366) expect(await page.locator(".grand-hall-menu").evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    else expect((await page.locator(".grand-hall-primary-actions").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length))).toBe(1);
    if (viewport.source) expect(await page.locator(".grand-hall-poster img").evaluate((image: HTMLImageElement) => image.currentSrc)).toContain(viewport.source);
    if (viewport.width === 375) { const box = await page.getByRole("link", { name: "Join Game", exact: true }).boundingBox(); expect(box && box.y + box.height <= viewport.height).toBe(true); }
    await page.screenshot({ path: `.logs/${viewport.file}`, caret: "initial" });
  }
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.goto("/birthday"); await expect(page.getByRole("heading", { name: "30th Birthday is unavailable." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto("/birthday/new");
  await expect(page.getByText("This pack has been removed from active play.")).toBeVisible();
  for (const viewport of [{ width: 360, height: 640 }, { width: 412, height: 915 }, { width: 375, height: 667 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport); await page.goto("/play"); await expect(page.getByRole("heading", { name: "Find your group" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator("#room-code").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize) >= 16)).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 450 }); await page.locator("#room-code").focus(); await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
  await page.screenshot({ path: ".logs/phone-375.png", fullPage: true, caret: "initial" });
  expect(errors).toEqual([]);
});

test("one phone can configure, start, play, control, and reveal a free solo room", async ({ page }) => {
  const errors: string[] = []; page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/host/new");
  await expect(page.locator(".room-setup-form")).toHaveAttribute("data-hydrated", "true");
  await page.locator("#game-pack").selectOption("standard");
  await page.getByRole("checkbox", { name: "Play solo with local bots" }).check();
  await page.getByLabel("Your player name").fill("Danny");
  await page.locator("#bot-count").fill("2");
  await page.getByRole("button", { name: "Start solo playtest" }).click();
  await expect(page).toHaveURL(/\/play\/[A-HJ-KM-NP-Z2-9]{4}$/);
  await expect(page.getByText("ONE-PHONE MODE")).toBeVisible();
  await expect(page.getByText("Deadpan", { exact: true })).toBeVisible();
  await expect(page.getByText("Wildcard", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".logs/solo-phone-lobby.png", fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: /Start game/ }).click();
  await expect(page.locator(".phone-phase-row")).toContainText("INTRO");
  const summary = page.locator(".solo-host-dock summary");
  await summary.click();
  await page.getByRole("button", { name: /Skip phase/ }).click();
  await expect(page.locator(".phone-phase-row")).toContainText("ROUND INTRO");
  await page.getByRole("button", { name: /Skip phase/ }).click();
  await expect(page.locator("#creative-answer")).toBeVisible();
  await page.locator("#creative-answer").fill("A goose with a loyalty card");
  await page.getByRole("button", { name: "Lock answer" }).click();
  await expect(page.locator(".phone-phase-row")).toContainText("ANSWER LOCK");
  if (!(await page.getByRole("button", { name: /Skip phase/ }).isVisible())) await summary.click();
  await page.getByRole("button", { name: /Skip phase/ }).click();
  await expect(page.locator(".phone-answer-list button").first()).toBeVisible();
  await page.locator(".phone-answer-list button").first().click();
  await page.getByRole("button", { name: "Lock vote" }).click();
  await expect(page.locator(".phone-phase-row")).toContainText("VOTE LOCK");
  if (!(await page.getByRole("button", { name: /Skip phase/ }).isVisible())) await summary.click();
  await page.getByRole("button", { name: /Skip phase/ }).click();
  await expect(page.getByRole("heading", { name: "The room has spoken." })).toBeVisible();
  await expect(page.locator(".solo-reveal-answers article")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".logs/solo-phone-reveal.png", fullPage: true, caret: "initial" });
  expect(errors).toEqual([]);
});

test("tester workbench shows the real host and phone while developer edits remain authoritative", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/developer");
  await expect(page.getByRole("heading", { name: "See both sides. Test every beat." })).toBeVisible();
  await expect(page.locator(".developer-launcher")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByLabel("Game pack").locator("option")).toHaveCount(6);
  await page.getByLabel("Game pack").selectOption("standard");
  await page.getByLabel("Developer name").fill("Danny");
  await page.getByRole("button", { name: /Launch test bench/ }).click();
  await expect(page).toHaveURL(/\/developer\/[A-HJ-KM-NP-Z2-9]{4}$/);
  await expect(page.locator(".tester-host-pane iframe")).toBeVisible();
  await expect(page.locator(".tester-phone-pane iframe")).toBeVisible();
  const host = page.frameLocator(".tester-host-pane iframe");
  const phone = page.frameLocator(".tester-phone-pane iframe");
  await expect(host.locator(".host-shell")).toBeVisible();
  await expect(phone.getByText("DEVELOPER MODE")).toBeVisible();
  await page.getByRole("button", { name: /Start game/ }).click();
  await page.getByRole("button", { name: /Pause/ }).click();
  await expect(page.locator(".tester-room-status")).toContainText("Paused");
  await page.getByRole("button", { name: "+60 sec" }).click();
  await page.getByRole("button", { name: /Resume/ }).click();
  await page.getByRole("button", { name: /Skip phase/ }).click();
  await expect(phone.locator(".phone-phase-row")).toContainText("ROUND INTRO");
  await expect(phone.locator(".solo-host-dock")).toHaveCount(0);
  await phone.getByRole("button", { name: /Open studio/ }).click();
  await expect(phone.getByRole("dialog", { name: "Developer studio" })).toBeVisible();
  await phone.getByRole("textbox", { name: "Prompt", exact: true }).fill("Invent the worst possible emergency mascot.");
  await phone.getByLabel("Score cap").fill("750");
  await phone.getByLabel("Change note").fill("This should get players answering faster.");
  await phone.getByRole("button", { name: "Apply live + capture" }).click();
  await expect(phone.getByText("2 live changes applied and captured.")).toBeVisible();
  await phone.getByRole("button", { name: "Close developer studio" }).click();
  await page.getByRole("button", { name: /Skip phase/ }).click();
  await expect(phone.getByRole("heading", { name: "Invent the worst possible emergency mascot." })).toBeVisible();
  await phone.getByRole("button", { name: /2 captured/ }).click();
  await expect(phone.getByText("2 items saved on this device")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("callback-developer-changes-v1") ?? "[]").length)).toBe(2);
});

test("developer playtest offers only the active six game packs", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/developer");
  await expect(page.locator(".developer-launcher")).toHaveAttribute("data-hydrated", "true");
  const options = await page.locator("#developer-game-pack option").evaluateAll((elements) => elements.map((element) => (element as HTMLOptionElement).value));
  expect(options).toEqual(["royal-rumours", "king-mystery", "pictures", "comic", "bowl-of-fools", "standard"]);
});

test("a live-image solo King Prompter match generates bot canvases and crowns the human image", async ({ browser }, testInfo) => {
  testInfo.setTimeout(150_000);
  const { context, code } = await createSoloRoom(browser, "pictures", true);
  const lobby = await syncAs(context, code, "player");
  expect(lobby.soloLiveImages).toBe(true);
  const humanId = lobby.selfId;
  const results = await driveSoloMatch(context, code);
  expect(results.phase).toBe("POST_GAME");
  expect(results.answers).toHaveLength(3);
  expect(results.results.winnerIds).toContain(humanId);
  expect(results.players.find((player: any) => player.id === humanId).score).toBeGreaterThan(results.players.filter((player: any) => player.bot).reduce((high: number, player: any) => Math.max(high, player.score), 0));
  await context.close();
});

test("a live-image solo comic match draws bot panels and locks the human into all three frames", async ({ browser }, testInfo) => {
  testInfo.setTimeout(150_000);
  const { context, code } = await createSoloRoom(browser, "comic", true);
  const lobby = await syncAs(context, code, "player");
  expect(lobby.soloLiveImages).toBe(true);
  const humanId = lobby.selfId;
  const results = await driveSoloMatch(context, code);
  expect(results.phase).toBe("POST_GAME");
  expect(results.comicFrames).toHaveLength(3);
  expect(results.comicFrames.every((frame: any) => frame.authorId === humanId)).toBe(true);
  expect(results.results.winnerIds).toContain(humanId);
  await context.close();
});

test("three isolated phone UIs complete the creative vertical slice and restore", async ({ browser }) => {
  const { host, code } = await createRoom(browser, "standard");
  // These explicit HTTP status assertions exercise fallback. Party realtime has its own matrix.
  await host.route('**/realtime', route => route.fulfill({json:{}}));
  const hostPage = await host.newPage(); const consoleErrors: string[] = []; hostPage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await hostPage.goto(`/host/${code}`);
  const phoneContexts: BrowserContext[] = []; const phones = [];
  for (const nickname of ["Zoë 🎉", "Alex", "Riley"]) {
    const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    await context.route('**/realtime', route => route.fulfill({json:{}}));
    const page = await context.newPage();
    await page.goto(`/play/${code}`); await page.getByLabel("Nickname").fill(nickname); await page.getByRole("button", { name: "Join as this player" }).click(); await expect(page.getByText("YOU'RE IN")).toBeVisible();
    phoneContexts.push(context); phones.push(page);
  }
  await expect(hostPage.getByText("3/10 players")).toBeVisible();
  await expect(hostPage.locator('[data-castle-room="grand-hall"]')).toBeVisible();
  expect(await hostPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  const lobbyOverlap = await hostPage.evaluate(() => {
    const pigeon = document.querySelector(".pigeon-host")?.getBoundingClientRect();
    const qr = document.querySelector(".lobby-qr")?.getBoundingClientRect();
    return Boolean(pigeon && qr && pigeon.left < qr.right && pigeon.right > qr.left && pigeon.top < qr.bottom && pigeon.bottom > qr.top);
  });
  expect(lobbyOverlap).toBe(false);
  await hostPage.screenshot({ path: ".logs/host-lobby-1366.png", caret: "initial" });
  const startResponse = hostPage.waitForResponse((response) => response.url().includes("/host-actions") && response.request().method() === "POST");
  await hostPage.getByRole("button", { name: /Start the game/ }).click(); expect((await startResponse).status()).toBe(200);
  const answers = ["A goose with admin access", "The moon owes me ten dollars", "Soup, but make it formal"];
  await expect(phones[0].locator("#creative-answer")).toBeVisible({ timeout: 15_000 });
  await expect(hostPage.locator('[data-castle-room="hall-of-echoes"]')).toBeVisible();
  expect(await phones[0].locator(".phone-content").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await phones[0].locator("#creative-answer").fill(answers[0]); const firstAnswerResponse = phones[0].waitForResponse((response) => response.url().includes("/player-actions") && response.request().method() === "POST"); await phones[0].getByRole("button", { name: "Lock answer" }).click(); expect((await firstAnswerResponse).status()).toBe(200);
  await phones[0].reload(); await expect(phones[0].getByText(/Locked in/i)).toBeVisible(); const feedback = phones[0].getByLabel("Steer upcoming game rounds"); await expect(feedback).toBeVisible(); const feedbackResponse = phones[0].waitForResponse((response) => response.url().includes("/player-actions") && response.request().method() === "POST"); await feedback.getByRole("button").first().click(); expect((await feedbackResponse).status()).toBe(200); await expect(feedback.getByText(/Next vote in/i)).toBeVisible(); await expect(feedback.getByText(/\+25 points/i)).toBeVisible();
  for (let index = 1; index < phones.length; index += 1) { await expect(phones[index].locator("#creative-answer")).toBeVisible(); await phones[index].locator("#creative-answer").fill(answers[index]); const actionResponse = phones[index].waitForResponse((response) => response.url().includes("/player-actions") && response.request().method() === "POST"); await phones[index].getByRole("button", { name: "Lock answer" }).click(); expect((await actionResponse).status()).toBe(200); }
  for (const phone of phones) { await expect(phone.locator(".phone-answer-list button").first()).toBeVisible({ timeout: 12_000 }); expect(await phone.locator(".phone-content").evaluate((element) => getComputedStyle(element).animationName)).toBe("none"); await phone.locator(".phone-answer-list button").first().click(); const actionResponse = phone.waitForResponse((response) => response.url().includes("/player-actions") && response.request().method() === "POST"); await phone.getByRole("button", { name: "Lock vote" }).click(); expect((await actionResponse).status()).toBe(200); }
  await expect(hostPage.locator(".answers-revealed")).toBeVisible({ timeout: 12_000 }); await hostPage.waitForTimeout(800); await hostPage.screenshot({ path: ".logs/host-reveal-1366.png", caret: "initial" });
  expect(consoleErrors).toEqual([]);
  await Promise.all(phoneContexts.map((context) => context.close())); await host.close();
});

for (const configuration of [
  { mode: "standard" as const, players: 3, replay: true, encore: false },
  { mode: "standard" as const, players: 6, replay: false, encore: true },
  { mode: "standard" as const, players: 10, replay: false, encore: false },
  { mode: "pictures" as const, players: 3, replay: true, encore: false },
  { mode: "king-mystery" as const, players: 3, replay: true, encore: false },
  { mode: "comic" as const, players: 3, replay: true, encore: false },
  { mode: "royal-rumours" as const, players: 3, replay: true, encore: false },
  { mode: "bowl-of-fools" as const, players: 4, replay: true, encore: false },
]) {
  test(`${configuration.mode} API-driven browser match with ${configuration.players} isolated players`, async ({ browser }, testInfo) => {
    testInfo.setTimeout(fullscreenQa ? 600_000 : configuration.encore ? 240_000 : 120_000);
    const { host, code } = await createRoom(browser, configuration.mode); const players = await joinPlayers(browser, code, configuration.players - (configuration.mode === "bowl-of-fools" ? 1 : 0));
    if (configuration.mode === "bowl-of-fools") {
      const hostPhone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, extraHTTPHeaders: { Origin: baseURL } });
      await hostPhone.addCookies((await host.cookies()).filter((cookie) => cookie.name.startsWith("callback_seat_")));
      players.push(hostPhone);
    }
    const fullscreenProbe = fullscreenQa
      ? await createFullscreenProbe(host, players[0]!, code, configuration.mode)
      : undefined;
    const visualResults = configuration.mode === "standard" && configuration.players === 6 || ["comic", "king-mystery"].includes(configuration.mode) ? await host.newPage() : null; const visualErrors: string[] = [];
    if (visualResults) { visualResults.on("console", (message) => { if (message.type() === "error") visualErrors.push(message.text()); }); await visualResults.goto(`/host/${code}`); }
    const results = await driveMatch(host, players, code, false, fullscreenProbe); expect(results.phase).toBe("POST_GAME"); expect(results.players.filter((player: any) => player.role === "player")).toHaveLength(configuration.players);
    if (fullscreenProbe) {
      const report = fullscreenProbe.report();
      expect(report.phases.length, `${configuration.mode} captured no rendered phases`).toBeGreaterThan(0);
      expect(report.navigationChecks, `${configuration.mode} never checked a coherent task interface`).toBeGreaterThan(0);
      expect(report.draftChecks, `${configuration.mode} had no preserved text draft`).toBeGreaterThan(0);
      console.log(`[fullscreen-qa] ${JSON.stringify(report)}`);
    }
    if (configuration.mode === "bowl-of-fools") expect(["BELLS", "MOTLEY"]).toContain(results.foolBowl.winner);
    else expect(results.results.winnerIds.length).toBeGreaterThan(0);
    if (visualResults) {
      const expectedHeading = configuration.mode === "comic" ? "Setup. Escalation. Punchline." : configuration.mode === "king-mystery" ? "The evidence was framed. So were several innocent turnips." : "Tonight's Lore";
      await expect(visualResults.getByRole("heading", { name: expectedHeading })).toBeVisible({ timeout: 12_000 });
      await visualResults.waitForTimeout(800);
      expect(await visualResults.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
      const screenshot = configuration.mode === "comic" ? ".logs/host-comic-results-1366.png" : configuration.mode === "king-mystery" ? ".logs/host-king-mystery-results-1366.png" : ".logs/host-tonights-lore-1366.png";
      await visualResults.screenshot({ path: screenshot, caret: "initial" });
      expect(visualErrors).toEqual([]);
    }
    if (configuration.replay) { await hostAction(host, code, results, "PLAY_AGAIN"); expect((await sync(host, code)).phase).toBe("LOBBY"); }
    if (configuration.encore) { const encoreResults = await driveMatch(host, players, code, true); expect(encoreResults.phase).toBe("POST_GAME"); expect(encoreResults.results.monsterMvpIds.length).toBeGreaterThan(0); }
    await Promise.all(players.map((context) => context.close())); await host.close();
  });
}
