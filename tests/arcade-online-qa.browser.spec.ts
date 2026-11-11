import { expect, test } from "@playwright/test";
import { ONLINE_HOSTED_GAMES } from "../lib/arcade/online/catalog";
import type { OnlineSnapshot } from "../app/components/online/online-client";

test("older realtime game setup links open the current phone-room service", async ({ page }) => {
  for (const gameId of ["air-hockey", "light-trails"]) {
    await page.goto(`/host/new?gameLength=arcade&arcadeGameId=${gameId}`);
    await expect(page).toHaveURL(`/arcade/online/new?game=${gameId}`);
    await expect(page.getByRole("heading", { name: "Play together", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Game", exact: true })).toHaveValue(gameId);
  }
});

for (const game of ONLINE_HOSTED_GAMES.filter(game => game.id !== "sumo")) {
  test(`${game.id}: two phone controllers join, play, pause and reconnect`, async ({ browser, baseURL }) => {
    const settings = { baseURL, extraHTTPHeaders: { Origin: baseURL!, "X-Callback-Test-Mode": "deterministic-matrix" } };
    const host = await browser.newContext({ ...settings, viewport: { width: 1366, height: 768 } });
    const first = await browser.newContext({ ...settings, viewport: { width: 390, height: 844 } });
    const second = await browser.newContext({ ...settings, viewport: { width: 390, height: 844 } });
    let sessionCode='';
    try {
      const created=await host.request.post('/api/sessions',{data:{}});expect(created.status()).toBe(201);sessionCode=(await created.json()).code;
      for(const [i,c] of [first,second].entries())expect((await c.request.post('/api/sessions/'+sessionCode+'/join',{data:{nickname:i?'Phone Two':'Phone One'}})).ok()).toBeTruthy();
      const parent=await(await host.request.get('/api/sessions/'+sessionCode)).json();
      const launch=await host.request.post('/api/sessions/'+sessionCode+'/host',{data:{operation:'launch',version:parent.version,game:{kind:'online',gameId:game.id}}});expect(launch.ok(),await launch.text()).toBeTruthy();
      const child=(await launch.json()).activeGame;const room={code:child.code,hostUrl:child.hostPath};
      await host.request.get('/api/sessions/'+sessionCode);await first.request.get('/api/sessions/'+sessionCode+'?role=player');await second.request.get('/api/sessions/'+sessionCode+'?role=player');
      const tv = await host.newPage(), phone = await first.newPage(), other = await second.newPage();
      let inputAcks=0;let latest:OnlineSnapshot|null=null;
      phone.on('websocket',ws=>ws.on('framereceived',e=>{try{const v=JSON.parse(String(e.payload));if(v.type==='input-ack'&&v.accepted)inputAcks++;if(v.snapshot)latest=v.snapshot;}catch{/* Ignore non-JSON transport frames. */}}));
      const errors: string[] = [];
      for (const page of [tv, phone, other]) page.on("pageerror", (error) => errors.push(error.message));
      await tv.goto(room.hostUrl);
      await phone.goto(`/arcade/online/join/${room.code}`);
      await expect(phone.getByText("Waiting for the host", { exact: false })).toBeVisible();
      await other.goto(`/arcade/online/join/${room.code}`);
      await expect(other.getByText("Phone Two", { exact: true })).toBeVisible();
      await expect(tv.getByText("Phone One", { exact: true })).toBeVisible();
      await expect(tv.getByText("Phone Two", { exact: true })).toBeVisible();
      await tv.getByRole("button", { name: "Start match", exact: true }).click();
      await expect(tv.locator(".online-host")).toHaveClass(/is-playing/);
      await expect.poll(()=>latest?.status).toBe('PLAYING');
      const state=latest! as OnlineSnapshot;
      expect(state.status).toBe("PLAYING");
      expect(state.players).toHaveLength(2);
      await phone.bringToFront();
      await expect(phone.getByText(/Connected ·/)).toBeVisible();
      const control = state.controls.find((item) => item.action !== "move");
      if (control) {
        const before=inputAcks;const ack=expect.poll(()=>inputAcks).toBeGreaterThan(before);
        if (control.hold) {
          const box = await phone.getByRole("button", { name: control.label, exact: true }).boundingBox();
          expect(box).not.toBeNull();
          await phone.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
          await phone.mouse.down();
          await ack;
          await phone.mouse.up();
        } else await phone.getByRole("button", { name: control.label, exact: true }).click();
        await ack;
      } else {
        const before=inputAcks;const ack=expect.poll(()=>inputAcks).toBeGreaterThan(before);
        const joystick = phone.getByRole("button", { name: "Move your contestant", exact: true });
        await expect(joystick).toBeEnabled();
        const stick = await joystick.boundingBox();
        expect(stick).not.toBeNull();
        await phone.mouse.move(stick!.x + stick!.width * 0.8, stick!.y + stick!.height / 2);
        await phone.mouse.down();
        await ack;
        await phone.mouse.up();
      }
      await expect.poll(()=>latest?.game).not.toBeNull();
      expect(await tv.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await phone.setViewportSize(viewport);
        const controls = await phone.locator(".online-controller").boundingBox();
        expect(controls).not.toBeNull();
        expect(controls!.x).toBeGreaterThanOrEqual(0);
        expect(controls!.x + controls!.width).toBeLessThanOrEqual(viewport.width);
        expect(controls!.y + controls!.height).toBeLessThanOrEqual(viewport.height);
      }
      await tv.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(phone.getByText(/Paused ·/)).toBeVisible();
      await expect(phone.locator(".online-controller button").first()).toBeDisabled();
      await tv.getByRole("button", { name: "Resume", exact: true }).first().click();
      await phone.reload();
      await expect(phone.getByText("Phone One", { exact: true })).toBeVisible();
      await expect(phone.getByText(/Connected ·/)).toBeVisible();
      if (["sumo", "rhythm", "jungle-bash", "light-trails"].includes(game.id)) {
        await phone.setViewportSize({ width: 390, height: 844 });
        await phone.screenshot({ path: `.logs/qa-online/${game.id}-phone.png` });
        await tv.screenshot({ path: `.logs/qa-online/${game.id}-host.png` });
      }
      expect(errors).toEqual([]);
    } finally {if(sessionCode){const parent=await(await host.request.get('/api/sessions/'+sessionCode)).json();await host.request.post('/api/sessions/'+sessionCode+'/host',{data:{operation:'close',version:parent.version}});}await Promise.allSettled([host.close(), first.close(), second.close()]); }
  });
}
