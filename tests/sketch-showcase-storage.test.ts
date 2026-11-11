import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";
import { deflateSync } from "node:zlib";
import { convertV4MiniflareOptions, Miniflare, type V4MiniflareOptions } from "miniflare";
import { createShowdown } from "../server/arcade/sketch_showdown";
import { fishPngCrc, readFishPng } from "../server/fish-png";
import type { RoomState } from "../server/types";

const ROOM_ID = "showcase-qa-room-only";
const MATCH_ID = "showcase-qa-match-only";
let miniflare: Miniflare | undefined;
let bindings: { DB: D1Database; MEDIA: R2Bucket } | undefined;
let copiedKeys: string[] = [];

function png(side: number, seed: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); result.write(type, 4); result.set(data, 8);
    result.writeUInt32BE(fishPngCrc(Buffer.concat([Buffer.from(type), Buffer.from(data)])), result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(side); header.writeUInt32BE(side, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc(side * (side * 4 + 1));
  const mid = Math.floor(side / 2);
  for (let y = 0; y < side; y++) {
    const row = y * (side * 4 + 1); pixels[row] = 0;
    for (let x = 0; x < side; x++) {
      const offset = row + 1 + x * 4;
      const body = x >= 2 && x <= side - 3 && Math.abs(y - mid) <= 1;
      const tail = x === 1 && y === mid;
      const eye = x === side - 3 && y === mid - 1;
      pixels[offset] = (seed + x * 11) % 256;
      pixels[offset + 1] = (seed + y * 17) % 256;
      pixels[offset + 2] = (seed + x * 3 + y * 5) % 256;
      pixels[offset + 3] = body || tail || eye ? 255 : 0;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", new Uint8Array()),
  ]);
}

function completedFixture(original: Uint8Array): RoomState {
  const match = createShowdown({ matchId: MATCH_ID, players: ["qa-artist", "qa-voter-b", "qa-voter-c"], now: 100, rulesVersion: 3 });
  match.round = 3; match.phase = "complete"; match.updatedAt = 500;
  match.showdown!.orders = [1, 2, 3].map(round => match.chains.filter(chain => chain.round === round).map(chain => chain.chainId));
  const winnerChain = match.chains.find(chain => chain.round === 1 && chain.originalPlayerId === "qa-artist")!;
  const originalAssetId = "qa-only-original-asset";
  const transformedAssetId = "qa-only-derived-asset";
  winnerChain.drawing = {
    playerId: "qa-artist", assetId: originalAssetId, submittedAt: 120,
    source: { assetId: originalAssetId, objectKey: `rooms/${ROOM_ID}/${originalAssetId}`, width: 8, height: 8, byteSize: original.byteLength, contentType: "image/png" },
    image: { status: "READY", jobId: transformedAssetId, assetId: transformedAssetId },
  };
  match.showdown!.ballots = [{ round: 1, playerId: "qa-voter-b", ranking: [winnerChain.chainId] }];
  return {
    id: ROOM_ID, code: "QAFC", matchNumber: 1, gameLength: "arcade", arcadeGameId: "sketch-relay",
    status: "COMPLETE", phase: "ARCADE_RESULTS", updatedAt: 900,
    arcadeMatch: { id: MATCH_ID, gameId: "sketch-relay", matchNumber: 1, status: "COMPLETE", startedAt: 100, endedAt: 500, result: {} },
    sketchRelay: match,
    participants: [
      { id: "qa-artist", nickname: "QA-only Artist", role: "player", active: true, bot: false, removedAt: null },
      { id: "qa-voter-b", nickname: "QA-only Voter B", role: "player", active: true, bot: false, removedAt: null },
      { id: "qa-voter-c", nickname: "QA-only Voter C", role: "player", active: true, bot: false, removedAt: null },
    ],
  } as unknown as RoomState;
}

after(async () => {
  if (!miniflare) return;
  try {
    const env = bindings ?? await miniflare.getBindings<{ DB: D1Database; MEDIA: R2Bucket }>();
    await env.DB.prepare("DELETE FROM jobs WHERE room_id = ?").bind(ROOM_ID).run();
    for (const prefix of [`rooms/${ROOM_ID}/`, ...copiedKeys.map(key => key.slice(0, key.lastIndexOf("/") + 1))]) {
      let cursor: string | undefined;
      do {
        const page = await env.MEDIA.list({ prefix, cursor });
        for (const object of page.objects) await env.MEDIA.delete(object.key);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    }
  } finally {
    await miniflare.dispose();
  }
});

test("Miniflare D1/R2 archive one opted-in QA winner; public routes serve durable copies and honor withdrawal", async () => {
  const localOptions: V4MiniflareOptions = {
    modules: true,
    script: "export default { async fetch() { return new Response('local showcase storage fixture'); } }",
    d1Databases: { DB: "showcase-storage-test-db" }, r2Buckets: ["MEDIA"],
    compatibilityDate: "2026-08-22",
  };
  miniflare = new Miniflare(convertV4MiniflareOptions(localOptions));
  bindings = await miniflare.getBindings<{ DB: D1Database; MEDIA: R2Bucket }>();
  (globalThis as typeof globalThis & { __showcaseEnv?: unknown }).__showcaseEnv = bindings;
  const hook = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env=globalThis.__showcaseEnv", shortCircuit: true };
      return next(specifier, context);
    },
  });
  const [{ ensureDatabase, cleanupExpiredRooms }, showcase, feedRoute, mediaRoute] = await Promise.all([
    import("../server/database"),
    import("../server/sketch-showcase"),
    import("../app/api/showcase/sketch-winners/route"),
    import("../app/api/showcase/sketch-winners/[id]/[kind]/route"),
  ]);
  hook.deregister();

  await ensureDatabase();
  const originalBytes = png(8, 31); const transformedBytes = png(8, 173);
  for (const bytes of [originalBytes, transformedBytes]) {
    const decoded = await readFishPng(new Request("https://game.test/upload", { method: "POST", headers: { "Content-Type": "image/png" }, body: new Blob([Uint8Array.from(bytes).buffer]) }));
    assert.deepEqual({ width: decoded.width, height: decoded.height }, { width: 8, height: 8 });
    assert.deepEqual(Buffer.from(decoded.bytes), Buffer.from(bytes));
  }
  const originalAssetId = "qa-only-original-asset"; const transformedAssetId = "qa-only-derived-asset";
  const originalKey = `rooms/${ROOM_ID}/${originalAssetId}`; const transformedKey = `rooms/${ROOM_ID}/${transformedAssetId}`;
  const originalHash = await showcase.showcaseImageHash(originalBytes);
  await bindings.MEDIA.put(originalKey, originalBytes, { httpMetadata: { contentType: "image/png" } });
  await bindings.MEDIA.put(transformedKey, transformedBytes, { httpMetadata: { contentType: "image/png" } });
  const state = completedFixture(originalBytes);
  await bindings.DB.prepare("INSERT INTO rooms (id, code, host_token_hash, phase, state_json, status, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(ROOM_ID, "QAFC", "qa-only-not-a-credential", "ARCADE_RESULTS", JSON.stringify(state), "COMPLETE", 900, 1000).run();
  const winner = state.sketchRelay!.chains.find(chain => chain.round === 1 && chain.originalPlayerId === "qa-artist")!;
  await bindings.DB.prepare("INSERT INTO jobs (id, room_id, round_id, kind, status, prompt_hash, prompt_json, object_key, content_type, byte_size, updated_at) VALUES (?, ?, ?, ?, 'READY', ?, ?, ?, ?, ?, ?)")
    .bind(originalAssetId, ROOM_ID, `${MATCH_ID}-r1`, "SKETCH_UPLOAD", "qa-upload-hash", JSON.stringify({ matchId: MATCH_ID, round: 1, chainId: winner.chainId, leg: "drawing", playerId: "qa-artist", assetId: originalAssetId, objectKey: originalKey, byteSize: originalBytes.byteLength, contentType: "image/png", width: 8, height: 8, sha256: originalHash }), originalKey, "image/png", originalBytes.byteLength, 1).run();
  await bindings.DB.prepare("INSERT INTO jobs (id, room_id, round_id, kind, status, prompt_hash, prompt_json, object_key, content_type, byte_size, updated_at) VALUES (?, ?, ?, ?, 'READY', ?, ?, ?, ?, ?, ?)")
    .bind(transformedAssetId, ROOM_ID, `${MATCH_ID}-r1`, "SKETCH_TRANSFORM", "qa-transform-hash", JSON.stringify({ kind: "SKETCH_TRANSFORM", matchId: MATCH_ID, round: 1, chainId: winner.chainId, leg: "drawing", sourceAssetId: originalAssetId, jobId: transformedAssetId }), transformedKey, "image/png", transformedBytes.byteLength, 1).run();

  await showcase.setSketchShowcasePreference(ROOM_ID, "qa-artist", true, 1000);
  await showcase.archiveSketchShowcase(state);
  await showcase.archiveSketchShowcase(state);
  const firstFeedResponse = await feedRoute.GET(new Request("https://game.test/api/showcase/sketch-winners"));
  assert.equal(firstFeedResponse.status, 200);
  const firstFeed = await firstFeedResponse.json() as { entries: Array<Record<string, unknown>>; nextOffset: number | null };
  assert.equal(firstFeed.entries.length, 1, "repeat projection must not duplicate the opt-in winner");
  assert.equal(firstFeed.nextOffset, null);
  assert.deepEqual(Object.keys(firstFeed.entries[0]!).sort(), ["artistName", "completedAt", "id", "originalUrl", "round", "tiedCount", "transformedUrl"]);
  assert.equal(firstFeed.entries[0]!.artistName, "QA-only Artist");
  assert.equal(firstFeed.entries[0]!.round, 1);
  const id = String(firstFeed.entries[0]!.id);
  assert.match(id, /^skw_[a-f0-9]{64}$/u);

  const mediaRequest = (kind: string) => mediaRoute.GET(new Request(`https://game.test/api/showcase/sketch-winners/${id}/${kind}`), { params: Promise.resolve({ id, kind }) });
  for (const [kind, expected] of [["original", originalBytes], ["transformed", transformedBytes]] as const) {
    const response = await mediaRequest(kind);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(expected));
  }

  assert.equal(await cleanupExpiredRooms(), 1);
  assert.equal(await bindings.DB.prepare("SELECT id FROM rooms WHERE id = ?").bind(ROOM_ID).first(), null);
  assert.equal((await bindings.MEDIA.list({ prefix: `rooms/${ROOM_ID}/` })).objects.length, 0);
  copiedKeys = [`showcase/sketch/${id}/original`, `showcase/sketch/${id}/transformed`];
  assert.equal((await bindings.DB.prepare("SELECT COUNT(*) AS count FROM jobs WHERE room_id = ?").bind(ROOM_ID).first<{ count: number }>())!.count, 0);
  for (const key of copiedKeys) assert.ok(await bindings.MEDIA.head(key), `durable copy should remain: ${key}`);
  for (const kind of ["original", "transformed"]) assert.equal((await mediaRequest(kind)).status, 200, "showcase media must survive live room cleanup");

  assert.equal(await showcase.withdrawSketchShowcase(ROOM_ID, "qa-artist", id, 2000), true);
  assert.equal((await (await feedRoute.GET(new Request("https://game.test/api/showcase/sketch-winners"))).json() as { entries: unknown[] }).entries.length, 0);
  for (const kind of ["original", "transformed"]) assert.equal((await mediaRequest(kind)).status, 404);
  await showcase.archiveSketchShowcase(state);
  assert.equal((await (await feedRoute.GET(new Request("https://game.test/api/showcase/sketch-winners"))).json() as { entries: unknown[] }).entries.length, 0, "archive retry must not revive a withdrawn record");
  assert.equal((await bindings.DB.prepare("SELECT state FROM sketch_showcase_entries WHERE id = ?").bind(id).first<{ state: string }>())!.state, "withdrawn");
});
