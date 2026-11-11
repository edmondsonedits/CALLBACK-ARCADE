import { Buffer } from "node:buffer";
/** Run with tsx against the managed no-provider preview; no browser or application test controls. */
import { request, type APIRequestContext } from "@playwright/test";
import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import type { HostSnapshot, PlayerSnapshot } from "../../lib/contracts";
import type { FishFinaleSnapshot } from "../../lib/arcade/fish-finale";
const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://terminal.local:4173";
const headers = { Origin: baseURL, "X-Callback-Test-Mode": "deterministic-matrix" };
type Snap = HostSnapshot | PlayerSnapshot;
interface Room { code: string; host: APIRequestContext; phones: APIRequestContext[]; ids: string[]; main?: unknown }
const sessions: APIRequestContext[] = [];
const records: Array<Record<string, unknown>> = [];
const output = "/workspace/scratch/38a6fecc02f4/fish-transport-observed.json";
function crc(bytes: Buffer) { let n = 0xffffffff; for (const b of bytes) { n ^= b; for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; }
function chunk(kind: string, data: Buffer) { const type = Buffer.from(kind); const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length, 0); out.set(type, 4); out.set(data, 8); out.writeUInt32BE(crc(Buffer.concat([type, data])), out.length - 4); return out; }
function png(fish: boolean, index = 0) {
  const width = fish ? 1024 : 480, height = fish ? 768 : 480;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    const body = ((x / width - .52) / .26) ** 2 + ((y / height - .5) / .23) ** 2 <= 1;
    const fin = y / height >= .15 && y / height < .4 && Math.abs(x / width - .52) < (y / height - .15) * .35;
    if (body || fin) raw.set([[82, 154, 255], [255, 111, 97], [51, 184, 140]][index % 3]!.concat(255), offset);
    else if (!fish) raw.set([255, 255, 255, 255], offset);
    if ((x / width - .68) ** 2 + (y / height - .45) ** 2 < .0009) raw.set([255, 255, 255, 255], offset);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
async function ctx() { const c = await request.newContext({ baseURL, extraHTTPHeaders: headers, ...(process.env.HTTP_PROXY ? { proxy: { server: process.env.HTTP_PROXY } } : {}) }); sessions.push(c); return c; }
async function checked(c: APIRequestContext, path: string, data: unknown, expected = 200) { const r = await c.post(path, { data }); assert.equal(r.status(), expected, `${path}: ${await r.text()}`); return r; }
async function read(c: APIRequestContext, code: string): Promise<Snap> { return (await checked(c, `/api/rooms/${code}/sync`, { version: 0 })).json(); }
async function fish(c: APIRequestContext, code: string): Promise<FishFinaleSnapshot> { const f = (await read(c, code)).sketchRelay?.finale; assert.ok(f); return f; }
async function mainAction(r: Room, c: APIRequestContext, type: string, payload: Record<string, unknown> = {}, host = false) {
  const s = await read(c, r.code), m = s.sketchRelay!;
  return checked(c, `/api/rooms/${r.code}/${host ? "host" : "player"}-actions`, { actionId: crypto.randomUUID(), type, roundId: s.roundId, expectedPhase: s.phase, payload: { ...(host ? {} : { matchId: m.matchId, round: m.round }), ...payload } });
}
async function fAction(r: Room, c: APIRequestContext, type: string, fields: Record<string, unknown> = {}, expected = 200, actionId = crypto.randomUUID()) {
  const f = await fish(c, r.code);
  return checked(c, `/api/rooms/${r.code}/fish`, { actionId, type, payload: { matchId: f.matchId, finaleId: f.finaleId, phase: f.phase, ...fields } }, expected);
}
async function upload(r: Room, c: APIRequestContext, bytes: Buffer, actionId: string, expected = 200) {
  const f = await fish(c, r.code);
  const response = await c.post(`/api/rooms/${r.code}/fish/upload`, { headers: { "Content-Type": "image/png", "X-Fish-Match": f.matchId, "X-Fish-Finale": f.finaleId, "X-Fish-Action-Id": actionId }, data: bytes });
  assert.equal(response.status(), expected, await response.text()); return response;
}
function mainResult(s: Snap) { const m = { ...s.sketchRelay! }; delete m.finale; return { main: m, arcade: s.arcade, results: s.results, phase: s.phase }; }
async function drain(r: Room) {
  for (let i = 0; i < 12; i++) { const response = await r.host.post(`/api/rooms/${r.code}/jobs/run`, { data: {} }); if (response.status() === 204) return; assert.equal(response.status(), 200, await response.text()); assert.notEqual((await response.json() as { live?: boolean }).live, true); }
  throw new Error("Jobs did not drain");
}
async function complete(r: Room) {
  const expected = Object.fromEntries(r.ids.map(id => [id, 0]));
  for (let step = 0; step < 110; step++) {
    const s = await read(r.host, r.code), m = s.sketchRelay!;
    switch (m.phase) {
      case "complete": assert.equal(s.phase, "ARCADE_RESULTS"); assert.equal(m.round, 3); assert.equal(m.totalRounds, 3); assert.deepEqual(m.scores, expected); assert.equal(m.finale, undefined); await drain(r); r.main = mainResult(s); return;
      case "prompt-writing": for (const [i, p] of r.phones.entries()) await mainAction(r, p, "SUBMIT_SKETCH_PROMPT", { prompt: `A wizard delivering suspicious sandwich number ${i}` }); break;
      case "prompt-voting": for (const p of r.phones) { const d = (await read(p, r.code)).sketchRelay!.showdown!; await mainAction(r, p, "RANK_SKETCH_PROMPTS", { ranking: d.promptOptions!.filter(x => x.id !== d.ownPromptId).slice(0, 3).map(x => x.id) }); } break;
      case "curse-selection": { const c = m.showdown!.curse!; await mainAction(r, r.phones[r.ids.indexOf(c.chooserId)]!, "CHOOSE_SKETCH_CURSE", { curse: c.options[0] }); break; }
      case "final-preparation": for (const p of r.phones) await mainAction(r, p, "PREPARE_SKETCH_FINAL", { modifier: "tiny", starter: "shield" }); break;
      case "drawing": for (const p of r.phones) { const x = (await read(p, r.code)).sketchRelay!; const response = await p.post(`/api/rooms/${r.code}/sketch`, { headers: { "Content-Type": "image/png", "X-Sketch-Match": x.matchId, "X-Sketch-Round": String(x.round), "X-Sketch-Chain": x.self!.chainId, "X-Sketch-Leg": "drawing", "X-Sketch-Prompt-Index": "0", "X-Sketch-Action-Id": crypto.randomUUID() }, data: png(false) }); assert.equal(response.status(), 200, await response.text()); } break;
      case "transforming": await drain(r); break;
      case "laughter-voting": {
        const owner = new Map<string, string>(); for (const p of r.phones) { const x = await read(p, r.code) as PlayerSnapshot; owner.set(x.sketchRelay!.showdown!.ownEntryId!, x.selfId); }
        for (const p of r.phones) { const d = (await read(p, r.code)).sketchRelay!.showdown!; const ranking = d.entries.filter(x => x.entryId !== d.ownEntryId).slice(0, 3).map(x => x.entryId); for (const [i, id] of ranking.entries()) expected[owner.get(id)!]! += [100, 75, 50][i]! * m.round; await mainAction(r, p, "RANK_SKETCH_LAUGHTER", { ranking }); } break;
      }
      case "artist-guessing": for (const p of r.phones) await mainAction(r, p, "GUESS_SKETCH_ARTISTS", { guesses: [] }); break;
      default: await mainAction(r, r.host, "ADVANCE_SKETCH_RELAY", { matchId: m.matchId, round: m.round, phase: m.phase, transition: "next" }, true);
    }
  }
  throw new Error("Main completion stalled");
}
async function setup(): Promise<Room> {
  const host = await ctx(); const created = await checked(host, "/api/rooms", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false, imageModel: "flux-1-schnell" }, 201);
  const { code } = await created.json() as { code: string }; const phones: APIRequestContext[] = [], ids: string[] = [];
  for (const nickname of ["Zoë Longname 🐟", "Morgan", "Sam"]) { const p = await ctx(); phones.push(p); await checked(p, `/api/rooms/${code}/join`, { nickname }, 201); ids.push((await read(p, code) as PlayerSnapshot).selfId); }
  const r = { host, phones, ids, code }; await mainAction(r, host, "START_GAME", {}, true); await complete(r); console.log(`Main completed: ${code}`); return r;
}
let saveQueue = Promise.resolve();
async function save() { const payload = JSON.stringify({ baseURL, observedAt: new Date().toISOString(), records }, null, 2); saveQueue = saveQueue.then(() => writeFile(output, payload)); await saveQueue; }
async function run(count: number) {
  const r = await setup(); const record: Record<string, unknown> = { code: r.code, eligibleCount: count, original: r.main }; records.push(record); await save();
  const m = (await read(r.host, r.code)).sketchRelay!;
  await checked(r.host, `/api/rooms/${r.code}/fish`, { actionId: crypto.randomUUID(), type: "FISH_OPEN", payload: { matchId: m.matchId } });
  await fAction(r, r.host, "FISH_CONFIGURE", { mode: count === 3 ? "peaceful" : "shark", drawingSeconds: 90 }); await fAction(r, r.host, "FISH_START"); await fAction(r, r.host, "FISH_ADVANCE");
  await fAction(r, r.host, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90 }, 409);
  await fAction(r, r.phones[0]!, "FISH_ADD_TIME", {}, 401);
  for (let i = 0; i < count; i++) {
    const bytes = png(true, i), actionId = crypto.randomUUID(); const result = await upload(r, r.phones[i]!, bytes, actionId); const { assetId } = await result.json() as { assetId: string };
    await upload(r, r.phones[i]!, bytes, actionId); await upload(r, r.phones[i]!, png(true, i + 1), actionId, 409); await upload(r, r.phones[i]!, bytes, crypto.randomUUID(), 409);
    assert.equal((await r.host.get(`/api/rooms/${r.code}/media/${assetId}`)).status(), 404);
    const media = await r.phones[i]!.get(`/api/rooms/${r.code}/media/${assetId}`); assert.equal(media.status(), 200); assert.deepEqual(await media.body(), bytes);
  }
  assert.equal((await fish(r.host, r.code)).entries.length, 0);
  record.drawing = await fish(r.host, r.code); await save(); console.log(`Fish drawing: ${r.code}, ${count} uploaded`);
  const stop = Date.now() + 125000;
  while (!["reveal", "closed"].includes((await fish(r.host, r.code)).phase)) { assert.ok(Date.now() < stop, "Real fish clocks stalled"); await new Promise(resolve => setTimeout(resolve, 1000)); }
  let f = await fish(r.host, r.code); record.reveal = f; await save(); assert.equal(f.eligibleCount, count);
  if (count === 0) { assert.equal(f.phase, "closed"); assert.equal(f.closedReason, "no-fish"); }
  else {
    assert.ok(f.entries.every(e => !e.artistName && !e.playerId));
    if (count === 2) assert.match(f.notice!, /lucky draw, not a vote/);
    await fAction(r, r.host, "FISH_ADVANCE");
    if (count === 3) {
      f = await fish(r.phones[0]!, r.code); assert.equal(f.phase, "voting"); assert.equal(f.rankLimit, 2); const target = f.self!.ballotOptions[0]!; record.target = target;
      await fAction(r, r.phones[0]!, "FISH_BALLOT", { ranking: [f.self!.ownEntryId] }, 409); await fAction(r, r.phones[0]!, "FISH_BALLOT", { ranking: [target, target] }, 409); await fAction(r, r.host, "FISH_BALLOT", { ranking: [target] }, 401);
      await fAction(r, r.phones[0]!, "FISH_BALLOT", { ranking: [target] }); await fAction(r, r.phones[0]!, "FISH_BALLOT", { ranking: [] }, 409);
      for (const p of r.phones.slice(1)) await fAction(r, p, "FISH_BALLOT", { ranking: [] });
      while ((await fish(r.host, r.code)).phase === "voting") await new Promise(resolve => setTimeout(resolve, 500));
      f = await fish(r.host, r.code); assert.equal(f.cinematic!.event!.kind, "peaceful-awards"); assert.deepEqual(f.cinematic!.eliminatedEntryIds, []); assert.equal(f.result, undefined);
    }
    f = await fish(r.host, r.code); if (f.phase === "cinematic") await fAction(r, r.host, "FISH_SKIP");
    f = await fish(r.host, r.code); if (f.phase === "artists") await fAction(r, r.host, "FISH_ADVANCE");
    f = await fish(r.host, r.code); assert.equal(f.phase, "aquarium"); assert.equal(f.result!.kind, count === 1 ? "solo" : count === 2 ? "lucky" : "voted");
    if (count === 3) { assert.equal(f.result!.ranking[0]!.entryId, record.target); assert.equal(f.result!.ranking[0]!.points, 2); }
    if (count === 2) assert.equal(f.champion!.label, "Lucky Tank Champion");
    if (count === 1) { assert.equal(f.mode, "peaceful"); assert.equal(f.champion, undefined); }
    assert.equal(new Set(f.entries.map(e => e.id)).size, count); assert.ok(f.entries.every(e => e.artistName));
    for (let i = 0; i < 3; i++) assert.deepEqual((await fish(r.host, r.code)).result, f.result);
  }
  assert.deepEqual(mainResult(await read(r.host, r.code)), r.main); assert.equal((await r.host.post(`/api/rooms/${r.code}/jobs/run`, { data: {} })).status(), 204);
  record.final = await fish(r.host, r.code); record.passed = true; await save(); console.log(`PASS ${r.code}: ${count} fish, main unchanged, media preserved, jobs empty`);
}
try { await Promise.all([3, 2, 1, 0].map(run)); console.log(output); }
catch (error) { records.push({ error: String(error), stack: error instanceof Error ? error.stack : undefined }); await save(); console.error(error); process.exitCode = 1; }
finally { await Promise.allSettled(sessions.map(s => s.dispose())); }
