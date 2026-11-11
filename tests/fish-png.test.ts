import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "node:buffer";
import { deflateSync, inflateSync } from "node:zlib";
import { FISH_MAX_BYTES, FishPngError, readFishPng, validateFishPng } from "../server/fish-png";

// Independent fixture encoder: correct CRCs, RGBA8, one opaque white mark in transparent water.
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function crc32(bytes: Uint8Array) { let n = 0xffffffff; for (const value of bytes) { n ^= value; for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); } return (n ^ 0xffffffff) >>> 0; }
function chunk(type: string, data = Buffer.alloc(0)) {
  const name = Buffer.from(type); const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); result.set(name, 4); result.set(data, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), result.length - 4); return result;
}
function ihdr(width = 2, height = 2, colorType = 6) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = colorType;
  return chunk("IHDR", header);
}
const raw = Buffer.from([0, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 51, 184, 140, 255]);
const compressed = deflateSync(raw);
const finish = chunk("IEND");
const fixture = () => Buffer.concat([signature, ihdr(), chunk("IDAT", compressed), finish]);
function upload(bytes: Uint8Array, contentType = "image/png") { return new Request("https://game.example/api/rooms/TEST/fish/upload", { method: "POST", headers: { "Content-Type": contentType }, body: new Blob([Uint8Array.from(bytes).buffer]) }); }

test("fish PNG upload retains transparent water and opaque white artwork byte for byte", async () => {
  const original = fixture(); const decoded = await readFishPng(upload(original));
  assert.deepEqual({ width: decoded.width, height: decoded.height }, { width: 2, height: 2 });
  assert.deepEqual([...decoded.bytes], [...original]);
  const pixels = inflateSync(compressed);
  assert.deepEqual([...pixels.subarray(1, 5)], [255, 255, 255, 255]);
  assert.deepEqual([...pixels.subarray(5, 9)], [0, 0, 0, 0]);
});

test("fish PNG rejects a damaged CRC even when the compressed image still inflates", async () => {
  const bytes = fixture(); const crcOffset = 8 + ihdr().length + 8 + compressed.length;
  bytes[crcOffset] ^= 1;
  assert.deepEqual(inflateSync(compressed), raw);
  await assert.rejects(validateFishPng(bytes), FishPngError);
});

test("fish PNG rejects unknown critical chunks, animation and noncontiguous image data", async () => {
  const midpoint = Math.floor(compressed.length / 2);
  const invalid = [
    Buffer.concat([signature, ihdr(), chunk("ABCD"), chunk("IDAT", compressed), finish]),
    Buffer.concat([signature, ihdr(), chunk("acTL", Buffer.alloc(8)), chunk("IDAT", compressed), finish]),
    Buffer.concat([signature, ihdr(), chunk("IDAT", compressed.subarray(0, midpoint)), chunk("tEXt", Buffer.from("art\0retained")), chunk("IDAT", compressed.subarray(midpoint)), finish]),
    Buffer.concat([signature, ihdr(), ihdr(), chunk("IDAT", compressed), finish]),
  ];
  for (const bytes of invalid) await assert.rejects(validateFishPng(bytes), FishPngError);
  // Ancillary metadata before the contiguous image stream is valid and is kept.
  const annotated = Buffer.concat([signature, ihdr(), chunk("tEXt", Buffer.from("artist\0private")), chunk("IDAT", compressed), finish]);
  assert.deepEqual(await validateFishPng(annotated), { width: 2, height: 2, bounds: { x: 0, y: 0, width: 1, height: 1 } });
});

test("fish PNG rejects truncated streams, trailing bytes, invalid row filters and incompatible pixels", async () => {
  const badFilter = Buffer.from(raw); badFilter[0] = 5;
  const malformed = [
    fixture().subarray(0, fixture().length - 1), Buffer.concat([fixture(), Buffer.from([0])]),
    Buffer.concat([signature, ihdr(), chunk("IDAT", Buffer.from([1, 2, 3])), finish]),
    Buffer.concat([signature, ihdr(), chunk("IDAT", deflateSync(raw.subarray(0, raw.length - 1))), finish]),
    Buffer.concat([signature, ihdr(), chunk("IDAT", deflateSync(Buffer.concat([raw, Buffer.from([0])]))), finish]),
    Buffer.concat([signature, ihdr(), chunk("IDAT", deflateSync(badFilter)), finish]),
    Buffer.concat([signature, ihdr(2, 2, 2), chunk("IDAT", compressed), finish]),
  ];
  for (const bytes of malformed) await assert.rejects(validateFishPng(bytes), FishPngError);
});

test("fish PNG requires both visible artwork and truly transparent exterior", async () => {
  const opaque = Buffer.from(raw); for (const offset of [4, 8, 13, 17]) opaque[offset] = 255;
  const empty = Buffer.alloc(raw.length);
  for (const pixels of [opaque, empty]) await assert.rejects(validateFishPng(Buffer.concat([signature, ihdr(), chunk("IDAT", deflateSync(pixels)), finish])), FishPngError);
});

test("fish PNG applies independent dimensions, byte and content-type bounds", async () => {
  const canonical = Buffer.alloc((1024 * 4 + 1) * 768); canonical.set([255, 255, 255, 255], 1);
  assert.deepEqual(await validateFishPng(Buffer.concat([signature, ihdr(1024, 768), chunk("IDAT", deflateSync(canonical)), finish])), { width: 1024, height: 768, bounds: { x: 0, y: 0, width: 1 / 1024, height: 1 / 768 } });
  for (const [width, height] of [[1025, 2], [2, 769], [0, 2]]) await assert.rejects(validateFishPng(Buffer.concat([signature, ihdr(width, height), chunk("IDAT", compressed), finish])), FishPngError);
  await assert.rejects(readFishPng(upload(Buffer.alloc(FISH_MAX_BYTES + 1))), /3 MiB/);
  await assert.rejects(validateFishPng(Buffer.alloc(FISH_MAX_BYTES + 1)), FishPngError);
  await assert.rejects(readFishPng(upload(fixture(), "image/jpeg")), /transparent PNG/);
});
