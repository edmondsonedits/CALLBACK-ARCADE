import {reachScreenControl} from "./helpers/screen-navigation";
import { expect, test, type BrowserContext } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {OwnedPartyRooms} from './helpers/owned-party-rooms';
const ownedRooms=new OwnedPartyRooms();
test.afterEach(()=>ownedRooms.closeAll());
import { baseURL, headers, drawEditorFish, fishAction, finale, ordinaryAction, read } from "./fixtures/fish-room";

test("host lobby starts a temporary fish drawing test and returns everyone to the lobby", async ({ browser }) => {
  test.setTimeout(90_000);
  const host = await browser.newContext({ baseURL, viewport: { width: 1366, height: 768 } });
  const phones: BrowserContext[] = [];
  const errors: string[] = [];
  try {
    const created = await host.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false, imageModel: "flux-1-schnell" } });
    expect(created.status(), await created.text()).toBe(201);
    const { code } = await created.json() as { code: string };
    await ownedRooms.track(host,code,baseURL);
    for (let seat = 1; seat <= 3; seat++) {
      const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      phones.push(phone);
      const joined = await phone.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: `Fish tester ${seat}` } });
      expect(joined.status(), await joined.text()).toBe(201);
    }

    const hostPage = await host.newPage();
    hostPage.setDefaultTimeout(15_000);
    hostPage.on("pageerror", error => errors.push(error.message));
    await hostPage.goto(`/host/${code}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const start = hostPage.getByRole("button", { name: "Test fish drawing (temporary)", exact: true });
    await expect(start).toBeEnabled();
    await start.click();
    await expect(hostPage.getByLabel("Temporary fish drawing test", { exact: true })).toBeVisible();
    await expect(hostPage.getByTestId("fish-tank")).toHaveAttribute("data-phase", "drawing", { timeout: 15_000 });
    await expect(hostPage.getByRole("button", { name: "Return to lobby", exact: true })).toBeVisible();

    const phonePage = await phones[0]!.newPage();
    phonePage.setDefaultTimeout(15_000);
    phonePage.on("pageerror", error => errors.push(error.message));
    await phonePage.goto(`/play/${code}`);
    await expect(phonePage.getByRole("region", { name: "Fish drawing editor", exact: true })).toBeVisible({ timeout: 15_000 });
    await phonePage.getByRole("button",{name:"Tools",exact:true}).click();
    await expect(phonePage.getByRole("button", { name: "Spray can", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(phonePage.getByRole("slider", { name: "Spray size" })).toBeVisible();
    await expect(phonePage.getByRole("slider", { name: "Spray opacity" })).toBeVisible();
    await phonePage.getByRole("button",{name:"Back to drawing",exact:true}).click();
    const phoneStage = phonePage.getByLabel("Fish canvas", { exact: true });
    await expect(phonePage.getByText("Start with the spray can", { exact: true })).toBeVisible();
    await phoneStage.click({ position: { x: 90, y: 90 } });
    await expect(phonePage.getByText("Start with the spray can", { exact: true })).toHaveCount(0);
    const freeDrawing = phonePage.getByRole("button", { name: "Free drawing", exact: true });
    await freeDrawing.click(); await expect(freeDrawing).toHaveAttribute("aria-pressed", "true");
    await phonePage.setViewportSize({ width: 320, height: 568 });
    await phonePage.getByRole("button",{name:"Tools",exact:true}).click();
    const tools=phonePage.getByRole("dialog",{name:"Fish drawing tools",exact:true});await expect(tools).toBeVisible();expect(await tools.evaluate(el=>{const r=el.getBoundingClientRect();return r.x===0&&r.y===0&&r.width===innerWidth&&r.height===innerHeight;})).toBe(true);
    await (await reachScreenControl(phonePage,tools.getByRole("slider",{name:"Spray opacity"}))).fill("60");
    await phonePage.getByRole("button",{name:"Back to drawing",exact:true}).click();

    const active = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
    expect(active.status()).toBe(200);
    const activeState = await active.json() as { phase: string; arcade: unknown; sketchRelay?: { fishTest?: boolean; finale?: { phase: string } } };
    expect(activeState.phase).toBe("LOBBY");
    expect(activeState.arcade).toBeNull();
    expect(activeState.sketchRelay?.fishTest).toBe(true);
    expect(activeState.sketchRelay?.finale?.phase).toBe("drawing");

    await hostPage.getByRole("button", { name: "Return to lobby", exact: true }).click();
    await expect(start).toBeVisible({ timeout: 15_000 });
    const returned = await host.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
    expect(returned.status()).toBe(200);
    const lobby = await returned.json() as { phase: string; arcade: unknown; sketchRelay?: unknown };
    expect(lobby.phase).toBe("LOBBY");
    expect(lobby.arcade).toBeNull();
    expect(lobby.sketchRelay).toBeNull();
    await ordinaryAction(host, code, "START_GAME", {}, true);
    const normal = await read(host, code);
    expect(normal.phase).toBe("ARCADE_ACTIVE");
    expect(normal.sketchRelay?.fishTest).not.toBe(true);
    expect(normal.sketchRelay?.phase).toBe("prompt-writing");
    expect(errors).toEqual([]);
  } finally {
    await host.close();
    await Promise.all(phones.map(phone => phone.close()));
  }
});

test("fish-test solo drawing, voting, shark, revival and lobby exit use the real runtime", async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto("/fish-test");
    await expect(page.getByRole("heading", { name: "Fish drawing test", exact: true })).toBeVisible();
    await expect(page.getByLabel("Image generator", { exact: true })).toHaveCount(0);
    await expect(page.locator("form[data-hydrated]")).toHaveAttribute("data-hydrated", "true");
    await page.getByRole("slider", { name: "Bot opponents" }).fill("2");
    await page.getByRole("button", { name: "Create fish test room", exact: true }).click();
    await expect(page).toHaveURL(/\/play\/[A-HJ-KM-NP-Z2-9]{4}$/);
    await expect(page.getByRole("combobox", { name: "Fish test mode" })).toHaveValue("shark");
    await page.getByRole("button", { name: "Test fish drawing (temporary)", exact: true }).click();
    await expect(page.getByRole("region", { name: "Fish drawing editor", exact: true })).toBeVisible({ timeout: 15_000 });
    await ownedRooms.track(context,new URL(page.url()).pathname.split("/").at(-1)!,baseURL);
    const code = new URL(page.url()).pathname.split("/").at(-1)!;
    const synced = await page.request.post(`/api/rooms/${code}/sync`, { headers, data: { version: 0 } });
    expect(synced.status(), await synced.text()).toBe(200);
    const state = await synced.json() as { phase: string; arcade: unknown; sketchRelay?: { fishTest?: boolean; finale?: { mode?: string; phase?: string } } };
    expect(state.phase).toBe("LOBBY");
    expect(state.arcade).toBeNull();
    expect(state.sketchRelay?.fishTest).toBe(true);
    expect(state.sketchRelay?.finale).toMatchObject({ mode: "shark", phase: "drawing" });
    const hostPage = await context.newPage();
    await hostPage.setViewportSize({ width: 1280, height: 720 });
    hostPage.setDefaultTimeout(15_000);
    hostPage.on("pageerror", error => errors.push(error.message));
    await hostPage.goto(`/host/${code}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const tank = hostPage.getByTestId("fish-tank");
    await expect(tank).toHaveAttribute("data-phase", "drawing");
    await expect(page.getByRole("link", { name: "Open aquarium screen ↗", exact: true })).toHaveAttribute("href", `/host/${code}`);
    await drawEditorFish(page);
    await expect(page.getByRole("region", { name: "Your fish aquarium", exact: true })).toBeVisible();
    await expect(page.getByTestId("fish-tank")).toBeVisible();
    await expect.poll(async () => {
      const response = await context.request.post(`/api/rooms/${code}/sync`, { headers: { ...headers, "X-Callback-Role": "player" }, data: { version: 0 } });
      expect(response.status()).toBe(200);
      const snapshot = (await response.json()).sketchRelay.finale;
      return snapshot.entries.some((entry: { id: string; assetId?: string }) => entry.id === snapshot.self?.ownEntryId && Boolean(entry.assetId));
    }).toBe(true);
    await expect.poll(async () => (await finale(context, code)).phase, { timeout: 180_000, intervals: [500, 1000] }).toBe("voting");
    await expect(page.getByRole("heading", { name: "Which fish do you love?", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Fish [A-Z].*\+$/ }).first().click();
    await page.getByRole("button", { name: "Lock 1 favourite", exact: true }).click();
    await expect(tank).toHaveAttribute("data-phase", "cinematic", { timeout: 20_000 });
    let sawPaintFragments = false;
    await expect.poll(async () => {
      const fragments = Number(await hostPage.locator("[data-fish-renderer]").getAttribute("data-fish-fragments"));
      sawPaintFragments ||= fragments > 0;
      return (await finale(context, code)).phase;
    }, { timeout: 80_000, intervals: [100] }).toBe("champion");
    expect(sawPaintFragments, "A bite scatters the submitted fish artwork").toBe(true);
    const champion = await finale(context, code);
    expect(champion.entries).toHaveLength(3);
    expect(champion.result?.kind).toBe("voted");
    await fishAction(context, code, "FISH_ADVANCE");
    await fishAction(context, code, "FISH_ADVANCE");
    await expect(tank).toHaveAttribute("data-phase", "aquarium");
    await expect(page.getByRole("heading", { name: "Everyone's back!", exact: true })).toBeVisible();
    await hostPage.screenshot({ path: ".logs/fish-acceptance/shortcut/solo-aquarium.png" });
    expect((await read(context, code)).sketchImageJobs ?? []).toEqual([]);
    const jobs = await context.request.post(`/api/rooms/${code}/jobs/run`, { headers, data: {} });
    expect(jobs.status()).toBe(204);
    await page.getByRole("button", { name: "Return to lobby", exact: true }).click();
    await expect(hostPage.getByRole("button", { name: "Test fish drawing (temporary)", exact: true })).toBeVisible();
    const lobby = await read(context, code);
    expect(lobby.phase).toBe("LOBBY");
    expect(lobby.arcade).toBeNull();
    expect(lobby.sketchRelay).toBeNull();
    expect(lobby.joiningLocked).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test("solo fish editor supports blank artwork and stays reachable across phone rotations", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  try {
    await page.goto("/fish-test");
    await page.getByRole("button", { name: "Create fish test room", exact: true }).click();
    const phoneSelection = await page.locator(".phone-shell").evaluate(element => getComputedStyle(element).getPropertyValue("-webkit-user-select"));
    expect(phoneSelection).toBe("none");
    await page.getByRole("button", { name: "Test fish drawing (temporary)", exact: true }).click();
    await expect(page.getByRole("region", { name: "Fish drawing editor", exact: true })).toBeVisible();
    await ownedRooms.track(context,new URL(page.url()).pathname.split("/").at(-1)!,baseURL);
    await expect(page.getByRole("navigation", { name: "Fish test controls", exact: true })).toBeVisible();
    await page.getByRole("button",{name:"Tools",exact:true}).click();
    await expect(page.getByRole("button", { name: "Spray can", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("slider", { name: "Spray size" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Spray opacity" })).toBeVisible();
    await page.getByRole("button",{name:"Back to drawing",exact:true}).click();
    const blank = page.getByRole("button", { name: "Use blank canvas", exact: true });
    await blank.click();
    await expect(page.getByRole("button", { name: "Use fish template", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-fish-editor='true']")).toHaveAttribute("data-fish-template", "blank");
    const alphaAt = (x:number,y:number) => page.locator("[data-fish-editor='true'] canvas").evaluate((canvas, point) => {
      const context=(canvas as HTMLCanvasElement).getContext("2d")!;
      return context.getImageData(point.x,point.y,1,1).data[3];
    }, { x,y });
    await expect.poll(() => alphaAt(512,384)).toBe(0);
    const useFish = page.getByRole("button", { name: "Use fish template", exact: true });
    await useFish.click();
    await expect(page.getByRole("button", { name: "Use blank canvas", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-fish-editor='true']")).toHaveAttribute("data-fish-template", "fish");
    await expect.poll(() => alphaAt(512,384)).toBe(255);
    await page.getByRole("button", { name: "Use blank canvas", exact: true }).click();
    await expect.poll(() => alphaAt(512,384)).toBe(0);
    const selectionStyles = await page.locator("[data-fish-editor='true']").evaluate(editor => {
      const input=document.createElement("input"); input.type="text"; input.value="editable"; editor.appendChild(input); input.select();
      const result={ editor:getComputedStyle(editor).getPropertyValue("-webkit-user-select"), input:getComputedStyle(input).getPropertyValue("-webkit-user-select"), selection:[input.selectionStart,input.selectionEnd] };
      input.remove(); return result;
    });
    expect(selectionStyles).toEqual({ editor:"none", input:"text", selection:[0,8] });
    await page.getByRole("button", { name: "Got it", exact: true }).click();
    await page.getByRole("button",{name:"Tools",exact:true}).click();await page.getByRole("button", { name: "Brush", exact: true }).click();await page.getByRole("button",{name:"Back to drawing",exact:true}).click();
    const canvasBox=await page.locator("[data-fish-editor='true'] canvas").boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.move(canvasBox!.x+canvasBox!.width/2-20,canvasBox!.y+canvasBox!.height/2);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x+canvasBox!.width/2+20,canvasBox!.y+canvasBox!.height/2,{steps:4});
    await page.mouse.up();
    await expect.poll(() => alphaAt(512,384)).toBeGreaterThan(0);
    await page.getByRole("button",{name:"Tools",exact:true}).click();await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(() => alphaAt(512,384)).toBe(0);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect.poll(() => alphaAt(512,384)).toBeGreaterThan(0);
    await page.getByRole("button",{name:"Back to drawing",exact:true}).click();
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.locator("[data-fish-editor='true']")).toHaveAttribute("data-fish-template", "blank");
    await expect.poll(() => alphaAt(512,384)).toBeGreaterThan(0);
    for(const [width,height] of [[320,568],[390,844],[320,480],[375,600],[390,664],[412,700],[844,390],[568,320]] as const){
      await page.setViewportSize({width,height});await page.getByRole('button',{name:'Tools',exact:true}).click();
      const tools=page.getByRole('dialog',{name:'Fish drawing tools',exact:true});await expect(tools).toBeVisible();
      expect(await tools.evaluate(el=>{const r=el.getBoundingClientRect();return r.x===0&&r.y===0&&r.bottom<=innerHeight+1&&r.right<=innerWidth;})).toBe(true);
      await reachScreenControl(page,tools.getByRole('slider',{name:'Spray opacity',exact:true}));
      expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
      await page.getByRole('button',{name:'Back to drawing',exact:true}).click();
      const send=page.getByRole('button',{name:'Send fish',exact:true});expect(await send.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
    }
    await page.screenshot({path:'.logs/fullscreen/fish-editor-rotated.png'});
  } finally { await context.close(); }
});

test("desktop fish test lobby keeps the launch control reachable without general-game paging", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1342, height: 964 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  try {
    await page.goto("/fish-test");
    await page.getByRole("button", { name: "Create fish test room", exact: true }).click();
    await expect(page.getByRole("region", { name: "Fish test lobby", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Game pack", exact: true })).toHaveCount(0);
    await expect(page.getByText("rank your entry first", { exact: false })).toHaveCount(0);
    await page.getByRole("button", { name: "Test fish drawing (temporary)", exact: true }).click();
    await expect(page.getByRole("region", { name: "Fish drawing editor", exact: true })).toBeVisible();
    await ownedRooms.track(context,new URL(page.url()).pathname.split("/").at(-1)!,baseURL);
    await page.getByRole("button", { name: "Return to lobby", exact: true }).click();
    await expect(page.getByRole("region", { name: "Fish test lobby", exact: true })).toBeVisible();
    await page.screenshot({ path: ".logs/fish-acceptance/shortcut/desktop-lobby.png" });
  } finally { await context.close(); }
});

test("solo fish test host controls and aquarium work in portrait while normal hosts retain the rotate guard", async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  try {
    await page.goto("/fish-test");
    await page.getByRole("button", { name: "Create fish test room", exact: true }).click();
    await expect(page).toHaveURL(/\/play\/[A-HJ-KM-NP-Z2-9]{4}$/);
    const code = new URL(page.url()).pathname.split("/").at(-1)!;
    const hostPage = await context.newPage();
    hostPage.setDefaultTimeout(15_000);
    await hostPage.goto(`/host/${code}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const shell = hostPage.locator(".host-shell");
    await expect(shell).toHaveClass(/solo-fish-test/);
    const overlayContent = () => shell.evaluate(element => getComputedStyle(element, "::after").content);
    expect(await overlayContent()).toBe("none");
    const launch = hostPage.getByRole("button", { name: "Test fish drawing (temporary)", exact: true });
    await expect(launch).toBeVisible();
    const startRequest = hostPage.waitForResponse(response => response.url().includes(`/api/rooms/${code}/host-actions`) && response.request().method() === "POST");
    await launch.click();
    const startResponse = await startRequest;
    expect(startResponse.status(), await startResponse.text()).toBe(200);
    const tank = hostPage.getByTestId("fish-tank");
    await expect(tank).toBeVisible();
    await expect(tank).toHaveAttribute("data-phase", "drawing");
    await expect(shell).toHaveClass(/solo-fish-test/);
    expect(await overlayContent()).toBe("none");
    await hostPage.screenshot({ path: ".logs/fish-acceptance/shortcut/portrait-aquarium-390.png" });
    const pause = hostPage.getByRole("button", { name: "Pause", exact: true });
    const exit = hostPage.getByRole("button", { name: "Return to lobby", exact: true });
    await expect(pause).toBeVisible();
    await expect(exit).toBeVisible();
    await pause.click();
    await expect(hostPage.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
    await hostPage.getByRole("button", { name: "Resume", exact: true }).click();
    await exit.click();
    await expect(launch).toBeVisible();
    await expect(shell).toHaveClass(/solo-fish-test/);
    expect(await overlayContent()).toBe("none");
    await launch.click();
    await expect(tank).toHaveAttribute("data-phase", "drawing");
    await hostPage.getByRole("button", { name: "Return to lobby", exact: true }).click();

    await hostPage.setViewportSize({ width: 320, height: 568 });
    await launch.click();
    await expect(tank).toHaveAttribute("data-phase", "drawing");
    expect(await overlayContent()).toBe("none");
    expect(await shell.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const smallPause = hostPage.getByRole("button", { name: "Pause", exact: true });
    const smallExit = hostPage.getByRole("button", { name: "Return to lobby", exact: true });
    for (const button of [smallPause, smallExit]) {
      await button.scrollIntoViewIfNeeded();
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(568);
    }
    await hostPage.screenshot({ path: ".logs/fish-acceptance/shortcut/portrait-aquarium-320.png" });
    await smallPause.click();
    await expect(hostPage.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
    await hostPage.getByRole("button", { name: "Resume", exact: true }).click();
    await smallExit.click();
    await hostPage.setViewportSize({ width: 390, height: 844 });
    const normal = await context.request.post("/api/rooms", { headers, data: { gameLength: "standard", contentMode: "party", timerAccessibility: false } });
    expect(normal.status(), await normal.text()).toBe(201);
    const { code: normalCode } = await normal.json() as { code: string };
    await hostPage.goto(`/host/${normalCode}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const normalShell = hostPage.locator(".host-shell");
    await expect(normalShell).toBeVisible();
    expect(await normalShell.evaluate(element => getComputedStyle(element, "::after").content)).toContain("Rotate this display for the host view");
  } finally { await context.close(); }
});

for (const template of ["fish", "blank"] as const) test(`free spray draws with ${template} canvas, survives undo and redo, and exports transparent PNG alpha`, async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  try {
    await page.goto("/fish-test");
    await page.getByRole("button", { name: "Create fish test room", exact: true }).click();
    await page.getByRole("button", { name: "Test fish drawing (temporary)", exact: true }).click();
    const editor=page.getByRole("region",{name:"Fish drawing editor",exact:true}); await expect(editor).toBeVisible();
    await ownedRooms.track(context,new URL(page.url()).pathname.split("/").at(-1)!,baseURL);
    await page.getByRole("button",{name:"Got it",exact:true}).click();
    if (template === "blank") await editor.getByRole("button",{name:"Use blank canvas",exact:true}).click();
    await editor.getByRole("button",{name:"Free drawing",exact:true}).click();
    await editor.getByRole("button",{name:"Tools",exact:true}).click();
    await expect(editor.getByText("Draw beyond the body. Erase to clear your additions.", { exact: true })).toBeVisible();
    await (await reachScreenControl(page,page.getByRole("slider",{name:"Spray size",exact:true}))).fill("96");
    await (await reachScreenControl(page,page.getByRole("slider",{name:"Spray opacity",exact:true}))).fill("50");
    await editor.getByRole("button",{name:"Back to drawing",exact:true}).click();
    const canvas=editor.getByRole("img",{name:"Your fish. Its head faces right and tail faces left.",exact:true});
    const box=(await canvas.boundingBox())!; const scaleX=box.width/1024,scaleY=box.height/768;
    const x=box.x+60*scaleX,y=box.y+100*scaleY;
    await page.mouse.move(x,y); await page.mouse.down();
    for(let index=1;index<=14;index++) await page.mouse.move(x+index*3*scaleX,y+index*.7*scaleY);
    await page.mouse.up();
    await editor.getByRole("button",{name:"Tools",exact:true}).click();
    await expect(editor.getByRole("button",{name:"Undo",exact:true})).toBeEnabled();
    await mkdir(".logs/fish-acceptance/editor",{recursive:true});
    await page.screenshot({path:".logs/fish-acceptance/editor/fish-free-spray-320.png"});
    await editor.getByRole("button",{name:"Undo",exact:true}).click();
    await editor.getByRole("button",{name:"Back to drawing",exact:true}).click();
    await expect(editor.getByRole("button",{name:"Send fish",exact:true})).toBeDisabled();
    await editor.getByRole("button",{name:"Tools",exact:true}).click();
    await editor.getByRole("button",{name:"Redo",exact:true}).click();
    await editor.getByRole("button",{name:"Back to drawing",exact:true}).click();
    await expect(editor.getByRole("button",{name:"Send fish",exact:true})).toBeEnabled();
    const code=new URL(page.url()).pathname.split("/").at(-1)!;
    await editor.getByRole("button",{name:"Send fish",exact:true}).click();
    await expect(page.getByRole("region",{name:"Your fish aquarium",exact:true})).toBeVisible();
    await expect(page.getByTestId("fish-tank")).toBeVisible();
    const readPlayerFinale=async()=>{
      const response=await context.request.post(`/api/rooms/${code}/sync`,{headers:{...headers,"X-Callback-Role":"player"},data:{version:0}});
      expect(response.status()).toBe(200);
      return (await response.json() as {sketchRelay?:{finale?:{entries:Array<{id:string;assetId?:string}>;self?:{ownEntryId?:string}}}}).sketchRelay!.finale!;
    };
    await expect.poll(async()=>{
      const snapshot=await readPlayerFinale();
      return snapshot.entries.find(entry=>entry.id===snapshot.self?.ownEntryId)?.assetId??"";
    }).not.toBe("");
    const snapshot=await readPlayerFinale(); const own=snapshot.entries.find(entry=>entry.id===snapshot.self?.ownEntryId)!;
    expect(own.assetId).toBeTruthy();
    const response=await page.request.get(`/api/rooms/${code}/media/${own.assetId}`); expect(response.status()).toBe(200);
    const encoded=Buffer.from(await response.body()).toString("base64");
    const alpha=await page.evaluate(async(png)=>{
      const image=new Image(); image.src=`data:image/png;base64,${png}`; await image.decode();
      const canvas=document.createElement("canvas"); canvas.width=image.width; canvas.height=image.height;
      const context=canvas.getContext("2d")!; context.drawImage(image,0,0); const data=context.getImageData(0,0,image.width,image.height).data;
      let outsideMarks=0; for(let py=50;py<155;py++) for(let px=8;px<158;px++) if(data[(py*image.width+px)*4+3]!>0) outsideMarks++;
      return {width:image.width,height:image.height,outsideMarks,cornerAlpha:data[3],centerAlpha:data[(384*image.width+512)*4+3]};
    },encoded);
    expect(alpha.width).toBe(1024); expect(alpha.height).toBe(768);
    expect(alpha.outsideMarks,"free spray should leave authored pixels beyond the fish silhouette").toBeGreaterThan(0);
    expect(alpha.centerAlpha).toBe(template === "blank" ? 0 : 255);
    expect(alpha.cornerAlpha,"the untouched PNG corner should remain transparent").toBe(0);
  } finally { await context.close(); }
});
