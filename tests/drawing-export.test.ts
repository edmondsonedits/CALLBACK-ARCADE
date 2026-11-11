import assert from "node:assert/strict";
import test from "node:test";
import { drawingToPngBlob } from "../lib/drawing-export";

test("PNG export resolves the actual encoded blob", async () => {
  const blob = new Blob(["encoded drawing"], { type: "image/png" });
  const result = await drawingToPngBlob({ toBlob(callback, type) { assert.equal(type, "image/png"); callback(blob); } });
  assert.equal(result, blob);
});
test("PNG export rejects a missing image and synchronous encoder failure", async () => {
  await assert.rejects(drawingToPngBlob({ toBlob(callback) { callback(null); } }), /prepared/);
  await assert.rejects(drawingToPngBlob({ toBlob() { throw new Error("encoder unavailable"); } }), /encoder unavailable/);
});
test("a stalled encoder unlocks submission with a retry message and ignores its late callback", { timeout: 200 }, async () => {
  let callback: BlobCallback | undefined;
  const result = drawingToPngBlob({ toBlob(done) { callback = done; } }, 10);
  await assert.rejects(result, /drawing is saved.*try.*again/i);
  callback!(new Blob(["late image"], { type: "image/png" }));
});
