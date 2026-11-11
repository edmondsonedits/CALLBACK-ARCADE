import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getFullArcadeGame as getOnlineFullGame } from "../lib/arcade/online/full-games";
import { PHONE_GAMES } from "../server/arcade-phone/contracts";
import { FULL_ARCADE_GAMES, getFullArcadeGame, isFullArcadeFrame } from "../lib/arcade/full-games";
import { isArchivedArcadeGame } from "../lib/arcade/archived-games";

test("full arcade games are an allowlisted same-origin replacement for known practice IDs",()=>{
 assert.equal(getFullArcadeGame("sumo")?.id,"royal-sumo");
 for(const id of ["../sumo","sumo?room=x","https://example.com","unknown"]){assert.equal(getFullArcadeGame(id),null)}
 for(const g of FULL_ARCADE_GAMES){assert.match(g.href,/^\/arcade-games\/[a-z-]+\/index\.html$/);assert.ok(g.maps.length>=3);assert.equal(g.maxContestants,10)}
});

test("only exact full-game entry paths can be embedded",()=>{
 assert.equal(isFullArcadeFrame("/arcade-games/royal-sumo/index.html"),true);
 for(const path of ["/host/ABCD","/play/ABCD","/api/rooms","/arcade-games/unknown/index.html","/arcade-games/royal-sumo/original/royal_sumo_crownfall_v1.3.0.html"]){assert.equal(isFullArcadeFrame(path),false)}
});

test("full-game source packages match their recorded import hashes",async()=>{
 for(const g of FULL_ARCADE_GAMES){
  const dir=`public/arcade-games/${g.id}`;const m=JSON.parse(await readFile(`${dir}/provenance.json`,"utf8"));
  for(const f of m.files){assert.equal(createHash("sha256").update(await readFile(`${dir}/${f.path}`)).digest("hex"),f.sha256,`${g.id}/${f.path}`)}
  const html=await readFile(`${dir}/index.html`,"utf8");
  const source=html.includes("from './simulation.js'")?html+await readFile(`${dir}/simulation.js`,"utf8")+await readFile('public/arcade-games/shared/arena-runtime.js','utf8'):html;
  assert.ok(source.length>30000);assert.ok(g.maps.every(map=>source.includes(map.id)),g.id);
 }
});

test("every advertised phone game has an authenticated room backend",()=>{
 assert.deepEqual(FULL_ARCADE_GAMES.filter(game=>game.phoneRooms && !isArchivedArcadeGame(game.practiceId) && !isArchivedArcadeGame(game.id)).map(game=>game.id).sort(),PHONE_GAMES.filter(id=>!isArchivedArcadeGame(id)).sort());
});


test("concurrent server-rendered online games retain their matching view and map catalog", async () => {
 for (const id of ["sumo", "sky-balls", "roller-ruckus", "scratch-match", "twisted-system", "space-bash"]) {
  const game = getOnlineFullGame(id);
  assert.ok(game);
  assert.match(game.href, /^\/arcade-games\/[a-z-]+\/online-v65\.html$/);
  const html = await readFile("public" + game.href, "utf8");
  assert.ok(html.includes("CallbackOnlineView"), id);
  assert.ok(game.maps.every(map => html.includes(map.id)), id + " online maps");
  assert.equal(html.includes("phone/host.js"), false, "server view must not launch a second TV simulation");
  const featured = getFullArcadeGame(id);
  assert.ok(featured?.phoneRooms);
  assert.ok((await readFile("public" + featured.href, "utf8")).includes("phone/host.js"));
 }
 const builder = await readFile("scripts/build-imported-online.mjs", "utf8");
 assert.ok(builder.includes("m.folder,'online-v65.html'"), "server engine extraction stays pinned to its matching view");
});
