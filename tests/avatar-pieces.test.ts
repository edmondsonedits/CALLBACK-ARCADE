import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AvatarConfigSchema } from "../lib/contracts";
import { AVATAR_PIECES, DEFAULT_PIECE_TRANSFORM, availableAvatarPieces, getPieceTransform, pieceTransformAttribute } from "../lib/avatar-pieces";
import { DEFAULT_AVATAR, FAMILY_PRESETS, OPTIONS, renderAvatar } from "../lib/avatar-runtime";
import { parseAvatarPreference } from "../lib/avatar-preference";
import { applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot } from "../server/snapshots";
import { AvatarEditor } from "../app/components/AvatarEditor";

const transform = { ...DEFAULT_PIECE_TRANSFORM, x: -43.5, y: 27, scale: 1.8, rotation: -55, scaleX: .75, scaleY: 1.25, flipX: true };

test("every available part in every family preset renders exactly once with its own transform", () => {
  for (const [name, preset] of Object.entries(FAMILY_PRESETS)) {
    const config = { ...preset.avatar, pieceTransforms: Object.fromEntries(AVATAR_PIECES.map(p => [p.id, transform])) };
    const validated = AvatarConfigSchema.parse(config);
    assert.deepEqual(validated.pieceTransforms, config.pieceTransforms);
    const markup = renderAvatar(config);
    const ids = [...markup.matchAll(/data-avatar-piece="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${name}: no duplicated pieces`);
    assert.deepEqual(ids.sort(), availableAvatarPieces(config).map(p => p.id).sort(), `${name}: all pieces are reachable`);
    assert.equal([...markup.matchAll(/data-avatar-piece="[^"]+"[^>]*transform="translate\(-43.5 27\)/g)].length, ids.length);
    assert.doesNotMatch(markup, /NaN|undefined|Infinity/);
  }
});

test("independent eyes survive every eye style and animated expression", () => {
  for (const eyeStyle of OPTIONS.eyeStyle) for (const expression of ['normal', 'laugh', 'sad', 'shock']) {
    const markup = renderAvatar({ ...DEFAULT_AVATAR, eyeStyle, pieceTransforms: { leftEye: transform } }, { expression });
    assert.match(markup, /data-avatar-piece="leftEye" transform="translate\(-43.5 27\)/);
    assert.match(markup, /data-avatar-piece="rightEye" transform="translate\(0 0\)/);
  }
});

test("transform geometry keeps its pivot fixed, applies screen-axis translation and flips locally", () => {
  const t = { ...transform, x: 12, y: -9 };
  assert.equal(pieceTransformAttribute(t, 102, 134), 'translate(12 -9) translate(102 134) rotate(-55) scale(-1.35 2.25) translate(-102 -134)');
  assert.deepEqual(getPieceTransform(DEFAULT_AVATAR, 'face'), DEFAULT_PIECE_TRANSFORM);
});

test("legacy characters remain valid and new part transforms persist through device, server, reconnect and host paths", () => {
  const avatar = { ...FAMILY_PRESETS.Danny.avatar, pieceTransforms: { leftEye: transform, hat: { ...DEFAULT_PIECE_TRANSFORM, hidden: true } } };
  assert.equal(AvatarConfigSchema.safeParse(DEFAULT_AVATAR).success, true);
  const preference = parseAvatarPreference(JSON.stringify({ avatarConfig: avatar, avatarPreset: null }));
  assert.deepEqual(preference?.avatarConfig.pieceTransforms, avatar.pieceTransforms);
  const state = createRoomState("ABCD", { gameLength: "pictures", contentMode: "party", timerAccessibility: false }, 1000);
  state.participants.push({ id: "player-1", nickname: "Danny", nicknameNormalized: "danny", role: "player", seat: 1, avatar: 0, color: "#46DBDC", active: true, pendingActivation: false, lastSeenAt: 1000, removedAt: null });
  const result = applyPlayerAction(state, 'player-1', { type: 'UPDATE_AVATAR', actionId: 'pieces-1', roundId: 'lobby', expectedPhase: 'LOBBY', payload: { avatarConfig: AvatarConfigSchema.parse(avatar), avatarPreset: null } }, 2000);
  const restored = deserializeRoomState(serializeRoomState(result.next));
  assert.deepEqual(restored.participants[0].avatarConfig?.pieceTransforms, avatar.pieceTransforms);
  const host = hostSnapshot(restored, 2000);
  assert.match(JSON.stringify(host), /"leftEye":\{"x":-43.5/);
});

test("server rejects invalid transforms, injected properties and unknown piece IDs", () => {
  for (const invalid of [{ ...transform, x: Infinity }, { ...transform, y: NaN }, { ...transform, scale: 0 }, { ...transform, scaleX: 5 }, { ...transform, rotation: 181 }, { ...transform, onclick: 'bad' }, { ...transform, x: '1" onclick="bad' }]) {
    assert.equal(AvatarConfigSchema.safeParse({ ...DEFAULT_AVATAR, pieceTransforms: { face: invalid } }).success, false);
  }
  assert.equal(AvatarConfigSchema.safeParse({ ...DEFAULT_AVATAR, pieceTransforms: { unknown: transform } }).success, false);
});

test("hidden parts retain transform data and editor selection never leaks into gameplay", () => {
  const config = { ...DEFAULT_AVATAR, pieceTransforms: { nose: { ...transform, hidden: true } } };
  assert.match(renderAvatar(config), /data-avatar-piece="nose"[^>]+visibility="hidden"/);
  assert.doesNotMatch(renderAvatar(config), /data-selected/);
  assert.match(renderAvatar(config, { editor: true, selectedPiece: 'nose' }), /data-avatar-piece="nose" data-selected="true"/);
});

test("editor opens directly on usable piece controls with undo and accessible numeric fields", () => {
  const markup = renderToStaticMarkup(createElement(AvatarEditor, { value: DEFAULT_AVATAR, preset: null, playerName: 'Danny', onChange() {}, onPresetChange() {}, onDone() {}, onCancel() {} }));
  for (const name of ['Move pieces', 'Horizontal', 'Vertical', 'Size', 'Rotation', 'Reset this piece', 'Undo', 'Redo', 'Zoom face']) assert.ok(markup.includes(name), name);
  assert.match(markup, /aria-label="Horizontal" type="number"/);
});
