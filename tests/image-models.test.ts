import assert from "node:assert/strict";
import test from "node:test";
import { CLOUDFLARE_FLUX2_MODEL_IDS, confirmedImageContentType, imageJobLeaseMs, imageModelFallbackOrder, imageModelForAttempt, nextImageModel, selectedImageModelForJob } from "../server/image-models";
import { createRoomSchema, HostActionSchema } from "../lib/contracts";
import { createRoomState, applyHostAction } from "../server/engine";
import { serializeRoomState, deserializeRoomState } from "../server/serialization";
import { hostSnapshot } from "../server/snapshots";

test("OpenAI low survives room creation, persistence, and host configuration", () => {
  const parsed = createRoomSchema.safeParse({ gameLength: "pictures", imageModel: "openai-low" });
  assert.equal(parsed.success, true, "the host must be able to select OpenAI low");
  if (!parsed.success) return;
  const state = createRoomState("TEST", parsed.data, 1000);
  const restored = deserializeRoomState(serializeRoomState(state));
  assert.equal(hostSnapshot(restored, 1001).imageModel, "openai-low");
  const action = HostActionSchema.parse({ type: "SET_CONFIG", actionId: "openai-choice", roundId: "lobby", expectedPhase: "LOBBY", payload: { imageModel: "openai-low" } });
  assert.equal(applyHostAction(createRoomState("TEST", { ...parsed.data, imageModel: "flux-1-schnell" }, 1000), action, 1001).next.imageModel, "openai-low");
});

test("OpenAI low makes one attempt and then uses a concept card", () => {
  const selected = "openai-low" as Parameters<typeof imageModelFallbackOrder>[0];
  assert.deepEqual(imageModelFallbackOrder(selected), ["openai-low"]);
  assert.equal(imageModelForAttempt(selected, 0), "openai-low");
  assert.equal(nextImageModel(selected, 0), null);
  assert.equal(imageModelForAttempt(selected, 1), null);
  assert.equal(imageModelForAttempt(selected, 3), null);
});

test("comic jobs preserve OpenAI selection and keep its lease longer than the API timeout", () => {
  assert.equal(selectedImageModelForJob("COMIC_PANEL_IMAGE", "openai-low"), "openai-low");
  assert.equal(selectedImageModelForJob("COMIC_PANEL_IMAGE", "flux-1-schnell"), "flux-2-fast");
  assert.equal(selectedImageModelForJob("KING_PROMPT_IMAGE", undefined), "flux-1-schnell");
  assert.ok(imageJobLeaseMs("COMIC_PANEL_IMAGE", "openai-low", 0) > 120_000);
  assert.equal(imageJobLeaseMs("COMIC_PANEL_IMAGE", "flux-2-fast", 0), 50_000);
  assert.equal(imageJobLeaseMs("LORE_ANALYSIS", "openai-low", 0), 25_000);
});

test("Cloudflare model IDs match the supported FLUX.2 endpoints", () => {
  assert.equal(CLOUDFLARE_FLUX2_MODEL_IDS["flux-2-fast"], "@cf/black-forest-labs/flux-2-klein-4b");
  assert.equal(CLOUDFLARE_FLUX2_MODEL_IDS["flux-2-quality"], "@cf/black-forest-labs/flux-2-klein-9b");
});

test("quality failures fall back to fast and then original", () => {
  assert.deepEqual(imageModelFallbackOrder("flux-2-quality"), ["flux-2-quality", "flux-2-fast", "flux-1-schnell"]);
  assert.equal(imageModelForAttempt("flux-2-quality", 0), "flux-2-quality");
  assert.equal(nextImageModel("flux-2-quality", 0), "flux-2-fast");
  assert.equal(imageModelForAttempt("flux-2-quality", 2), "flux-1-schnell");
  assert.equal(nextImageModel("flux-2-quality", 2), null);
});

test("each selected model receives three distinct attempts", () => {
  for (const selected of ["flux-1-schnell", "flux-2-fast", "flux-2-quality"] as const) {
    const order = imageModelFallbackOrder(selected);
    assert.equal(order[0], selected);
    assert.equal(order.length, 3);
    assert.equal(new Set(order).size, 3);
  }
});

test("image confirmation accepts known formats and rejects empty or non-image bytes", () => {
  const jpeg = new Uint8Array(1024); jpeg.set([0xff, 0xd8, 0xff]);
  const png = new Uint8Array(1024); png.set([0x89, 0x50, 0x4e, 0x47]);
  const webp = new Uint8Array(1024); webp.set([0x52, 0x49, 0x46, 0x46], 0); webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(confirmedImageContentType(jpeg), "image/jpeg");
  assert.equal(confirmedImageContentType(png), "image/png");
  assert.equal(confirmedImageContentType(webp), "image/webp");
  assert.throws(() => confirmedImageContentType(new Uint8Array(32)), /INVALID_IMAGE_BYTES/);
  assert.throws(() => confirmedImageContentType(new Uint8Array(1024)), /UNSUPPORTED_IMAGE_BYTES/);
});

test("Sketch & Sorcery can change only its image generator in the lobby", () => {
  const options = createRoomSchema.parse({ gameLength: "arcade", arcadeGameId: "sketch-relay" });
  const state = createRoomState("SKCH", options, 1000);
  const action = HostActionSchema.parse({ type: "SET_CONFIG", actionId: "sketch-image-change", roundId: "lobby", expectedPhase: "LOBBY", payload: { imageModel: "openai-low" } });
  const changed = applyHostAction(state, action, 1001).next;
  assert.equal(changed.imageModel, "openai-low");
  assert.equal(changed.arcadeGameId, "sketch-relay");
  assert.deepEqual(changed.roundPlan, state.roundPlan);
  const other = createRoomState("OTHR", createRoomSchema.parse({ gameLength: "arcade", arcadeGameId: "drift-racer" }), 1000);
  assert.throws(() => applyHostAction(other, action, 1001), /ARCADE_CONFIG_LOCKED/);
  const mixed = HostActionSchema.parse({ ...action, payload: { imageModel: "openai-low", gameLength: "pictures" } });
  assert.throws(() => applyHostAction(state, mixed, 1001), /ARCADE_CONFIG_LOCKED/);
  assert.throws(() => applyHostAction({ ...state, phase: "ANSWERING" }, action, 1001));
});
