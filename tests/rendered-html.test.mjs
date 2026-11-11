import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/", assetContent) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => assetContent ? new Response(assetContent,{headers:{'content-type':'text/html'}}) : new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test('production Worker serves retained and pilot game assets after archive checks',async()=>{
  const config=JSON.parse(await readFile(new URL('../dist/server/wrangler.json',import.meta.url),'utf8'));assert.equal(config.assets.html_handling,'none','game iframe URLs must retain .html so their frame permission and archive guards match');
  for(const path of ['/arcade-games/royal-scratch-match/online-v65.html?online=1','/arcade-games/royal-sumo/realtime-pilot.html']){
    const response=await render(path,'Retained game asset');assert.equal(response.status,200);assert.equal(await response.text(),'Retained game asset');assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');
  }
  const archived=await render('/arcade-games/space-bash/index.html','Retained game asset');assert.equal(archived.status,410);assert.match(await archived.text(),/is archived/);
});

test("production Arcade routes embed the retained full games with an available Exit", async () => {
  for (const [id, slug] of [["sumo", "royal-sumo"], ["twisted-system", "royal-twisted"], ["roller-ruckus", "royal-roller-ruckus"], ["scratch-match", "royal-scratch-match"]]) {
    const response = await render(`/arcade/practice/${id}`);
    assert.equal(response.status, 200, id);
    const html = await response.text();
    assert.match(html, /<iframe\b/);
    assert.ok(html.includes(`/arcade-games/${slug}/index.html`), id);
    assert.ok(html.includes("Exit"), id);
    assert.doesNotMatch(html, /This game is a placeholder/);
  }
});

test("the production main menu links to Party Games alongside the existing Arcade", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<a[^>]*href="\/party-games"[^>]*aria-label="Party Games"/);
  assert.match(html, /<a[^>]*href="\/arcade"[^>]*aria-label="Arcade"/);
});

test("the production Party Games route offers separate launch and source links without a room", async () => {
  const response = await render("/party-games");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<h1[^>]*>Party Games<\/h1>/);
  for (const destination of ["https://doot.games", "https://jammers.dilger.dev/host", "https://garticphone.com/", "https://skribbl.io/", "https://www.airconsole.com/"]) {
    const anchor = html.match(new RegExp(`<a[^>]*href="${destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`))?.[0];
    assert.ok(anchor, `Missing launch link: ${destination}`);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener noreferrer"/);
  }
  assert.match(html, /href="https:\/\/github.com\/virgilvox\/doot-games"/);
  assert.match(html, /href="https:\/\/github.com\/cdilga\/multiplayer-racer"/);
  assert.match(html, /href="\/\?menu=1"/);
    assert.match(html, /Each site has its own rooms and joining instructions/);
  assert.doesNotMatch(html, /<iframe\b/);
});

test("production Worker server-renders the branded Callback title screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Callback — One lobby. Every game./);
  assert.match(html, /Press anywhere to begin/);
  assert.match(html, /CALLBACK/);
  assert.match(html, /LIVE FROM THE GRAND HALL/);
  assert.match(html, /Start Game/);
  assert.match(html, /Join Game/);
  assert.match(html, /Join Host Display/);
  assert.match(html, /href="\/host\/new\?game=comic"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("the disposable Sites starter skeleton is absent from the finished app", async () => {
  const [page, layout, css, menu, intro, music] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/GrandHallMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/TVIntroMenu.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/HostMusicProvider.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<TVIntroMenu \/>/);
  assert.doesNotMatch(page, /landing-shell|LandingAvatarStudio|3–10 players/);
  assert.match(layout, /Callback — One lobby. Every game./);
  assert.match(layout, /<HostMusicProvider>/);
  assert.deepEqual(Array.from(menu.matchAll(/data-menu-action="([^"]+)"/g), (match) => match[1]), ["Start Game", "Join Game", "Bowl of Fools", "Royal Rumours", "Royal Frame-Up", "Comic", "Arcade", "Party Games", "How to Play", "Avatar Studio", "History Books", "Settings", "Join Host Display"]);
  assert.match(menu, /href="\/play"/);
  assert.doesNotMatch(menu, /href="\/birthday(?:\/new)?"|Royal War Room/);
  assert.doesNotMatch(menu, /tv-hotspot/);
  assert.doesNotMatch(intro, /title-loop\.mp4/);
  assert.match(intro, /grand-hall-menu-loop\.mp4/);
  assert.doesNotMatch(intro, /<audio\b|SOUNDTRACK_TRACKS|menu-soundtrack/);
  assert.match(intro, /tv-intro-video" muted/);
  assert.match(intro, /tv-loop-video" muted/);
  assert.match(intro, /router\.push\(href\)/);
  assert.match(music, /approvedMusicGain/);
  assert.match(music, /sequentialMusicFadeLevels/);
  assert.match(music, /buildMusicPlaylist/);
  assert.match(music, /className="host-music-deck"/);
  assert.match(music, /createPortal/);
  assert.match(music, /data-host-music-control/);
  assert.match(music, /session-game-frame/);
  assert.match(music, /Mute host music/);
  assert.match(intro, /<picture className="grand-hall-poster">/);
  assert.match(intro, /poster-2560x1440\.avif/);
  assert.match(intro, /poster-phone-tall-780x1688\.webp/);
  assert.match(intro, /data-poster-failed/);
  assert.match(intro, /type EntryStage = "gate" \| "intro" \| "menu"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--kp-night:\s*#101a3b/);
  assert.doesNotMatch(css, /tv-hotspot/);
  assert.match(css, /coded Grand Hall gradient\/frame|grand-hall-poster/);
  assert.match(css, /100dvh/);
  await assert.rejects(readdir(new URL("../app/_sites-preview", import.meta.url)), { code: "ENOENT" });
});

test("production Arcade exposes the five retained phone games and the dedicated controller entry", async () => {
  const response=await render('/arcade');assert.equal(response.status,200);
  const html=await response.text();
  for(const id of ['royal-sumo','royal-scratch-match','royal-roller-ruckus','royal-twisted','blind-crown'])assert.ok(html.includes(`href="/arcade-games/${id}/index.html"`),id);
  for(const id of ['royal-ballistix','space-bash','snow-bash','drain-bash','jungle-bash','tie-breaker','manic-panic','rubble-alliance','dragon-drop','volt-vault'])assert.ok(!html.includes(`href="/arcade-games/${id}/index.html"`),id);
  assert.match(html,/href="\/arcade-games\/phone\/controller\.html"/);
  assert.doesNotMatch(html,/href="\/arcade\/practice\/blind-crown"/);
  const join=await render('/play');assert.equal(join.status,200);assert.match(await join.text(),/href="\/arcade-games\/phone\/controller\.html"/);
});

test("production Arcade lists online phone launches and renders its controller pages", async () => {
 const response=await render('/arcade/practice');assert.equal(response.status,200);const html=await response.text();
 assert.equal((html.match(/href="\/arcade\/online\/new\?game=/g)||[]).length,5);assert.match(html,/up to 10 phones/);
 const main=await render('/arcade');assert.equal(main.status,200);assert.match(await main.text(),/href="\/arcade\/online\/join"/);
 for(const path of ['/arcade/online/new?game=sumo','/arcade/online/join','/arcade/online/host/ABCD','/arcade/online/join/ABCD']){const r=await render(path);assert.equal(r.status,200,path);const body=await r.text();assert.doesNotMatch(body,/Internal Server Error|Not Found/);}
 const setup=await render('/arcade/online/new');const setupHTML=await setup.text();
 for(const id of ['sumo','twisted-system','roller-ruckus','scratch-match','tailblazer','air-hockey','light-trails'])assert.ok(setupHTML.includes(`<option value="${id}"`),id);
 for(const id of ['space-bash','snow-bash','tap-race','rhythm','sky-balls'])assert.ok(!setupHTML.includes(`<option value="${id}"`),id);
});


test("production local prototype offers the shared larger-control setting",async()=>{const response=await render('/arcade/practice/tailblazer');assert.equal(response.status,200);const html=await response.text();assert.match(html,/Larger controls/);assert.match(html,/data-arcade-tool/);});


test("production home advertises its installable manifest and Apple icon", async () => {
 const response=await render('/');assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/<link[^>]*rel="manifest"[^>]*href="\/manifest.webmanifest"/);
 assert.match(html,/<link[^>]*rel="apple-touch-icon"[^>]*href="\/icons\/apple-touch-icon.png"/);
 const manifest=JSON.parse(await readFile(new URL('../dist/client/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const bytes=await readFile(new URL('../dist/client'+icon.src,import.meta.url));const size=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
});
