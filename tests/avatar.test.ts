import assert from "node:assert/strict";
import test from "node:test";
import { AvatarConfigSchema } from "../lib/contracts";
import { DEFAULT_AVATAR, FAMILY_PRESETS, clone, renderAvatar } from "../lib/avatar-runtime";
import { pieceTransformAttribute } from "../lib/avatar-pieces";
import { AVATAR_PRESETS, poseForPreset, poseSequenceAt, solveTwoBoneAngles, stepPoseSpring } from "../lib/avatar-motion";
import { NEUTRAL_POSE, POSE_LIMITS } from "../lib/avatar-pose";
import { applyPlayerAction, createRoomState } from "../server/engine";

function groupContains(markup: string, joint: string, pattern: RegExp) {
  const marker = joint === "body" ? `data-puppet-frame="${joint}"` : `data-puppet-joint="${joint}"`;
  const tags = /<g\b[^>]*>|<\/g>/g;
  let jointOffset = markup.indexOf(marker);
  assert.notEqual(jointOffset, -1, `${joint} joint exists`);
  while (jointOffset !== -1) {
    const start = markup.lastIndexOf("<g", jointOffset);
    tags.lastIndex = start;
    let depth = 0;
    let match: RegExpExecArray | null;
    while ((match = tags.exec(markup))) {
      if (match[0].startsWith("</")) depth -= 1;
      else depth += 1;
      if (depth === 0) {
        if (pattern.test(markup.slice(start, tags.lastIndex))) return true;
        break;
      }
    }
    jointOffset = markup.indexOf(marker, jointOffset + marker.length);
  }
  return false;
}

function pieceContainsJoint(markup: string, piece: string, joint: string) {
  const pieceOffset = markup.indexOf(`data-avatar-piece="${piece}"`);
  assert.notEqual(pieceOffset, -1, `${piece} piece exists`);
  const start = markup.lastIndexOf("<g", pieceOffset);
  const tags = /<g\b[^>]*>|<\/g>/g;
  tags.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tags.exec(markup))) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return markup.slice(start, tags.lastIndex).includes(`data-puppet-joint="${joint}"`);
  }
  return false;
}

test("the default avatar and all 13 family presets satisfy the public payload contract", () => {
  assert.equal(Object.keys(FAMILY_PRESETS).length, 13);
  assert.equal(AvatarConfigSchema.safeParse(DEFAULT_AVATAR).success, true);
  for (const [name, preset] of Object.entries(FAMILY_PRESETS)) {
    assert.equal(AvatarConfigSchema.safeParse(preset.avatar).success, true, `${name} should be valid`);
    assert.match(renderAvatar(preset.avatar, { label: name }), /<svg[^>]+avatar-svg/);
  }
});

test("a player can authoritatively update their avatar in the lobby", () => {
  const state = createRoomState("ABCD", { gameLength: "pictures", contentMode: "party", timerAccessibility: false }, 1_000);
  state.participants.push({ id: "player-1", nickname: "Danny", nicknameNormalized: "danny", role: "player", seat: 1, avatar: 0, color: "#46DBDC", active: true, pendingActivation: false, lastSeenAt: 1_000, removedAt: null });
  const config = AvatarConfigSchema.parse(clone(FAMILY_PRESETS.Danny.avatar));
  const result = applyPlayerAction(state, "player-1", { type: "UPDATE_AVATAR", actionId: "avatar-change-1", roundId: "lobby", expectedPhase: "LOBBY", payload: { avatarConfig: config, avatarPreset: "Danny" } }, 2_000);
  assert.deepEqual(result.next.participants[0].avatarConfig, config);
  assert.equal(result.next.participants[0].avatarPreset, "Danny");
  assert.equal(result.effects[0].type, "participant_state");
});

test("avatar motion presets stay within pose bounds and spring release returns to neutral", () => {
  let current = { ...poseForPreset("cheer"), blink: 1, mouth: 1 };
  let velocity = { ...NEUTRAL_POSE };
  for (let frame = 0; frame < 300; frame += 1) {
    ({ pose: current, velocity } = stepPoseSpring(current, NEUTRAL_POSE, velocity, 1 / 60));
  }
  for (const key of Object.keys(POSE_LIMITS) as Array<keyof typeof NEUTRAL_POSE>) assert.ok(Math.abs(current[key]) < 0.1, `${key} should settle`);
});

test("reduced motion snaps every puppet coordinate to its target and clears velocity", () => {
  const pose = { ...poseForPreset("cheer"), blink: 1, mouth: 1 };
  const velocity = Object.fromEntries(Object.keys(POSE_LIMITS).map(key => [key, 60]));
  const result = stepPoseSpring(pose, NEUTRAL_POSE, velocity, 1 / 60, true);
  assert.deepEqual(result.pose, NEUTRAL_POSE);
  assert.deepEqual(result.velocity, NEUTRAL_POSE);
});

test("avatar presets animate through a timed pose path and finish neutral", () => {
  const firstWave = poseSequenceAt("wave", 400);
  const secondWave = poseSequenceAt("wave", 950);
  assert.notEqual(firstWave.rightArm, secondWave.rightArm);
  assert.ok(Math.abs(poseSequenceAt("wave", 5_000).rightArm) < 0.1);
});

test("two-bone puppet solving reaches a wrist target with bounded joint angles", () => {
  const angles = solveTwoBoneAngles({ x: 0, y: 0 }, { x: 36, y: 20 }, 35, 35, 1);
  assert.ok(Number.isFinite(angles.upper));
  assert.ok(Number.isFinite(angles.lower));
  assert.ok(angles.reach <= 70);
});

test("live poses add rig joints without replacing saved piece transforms", () => {
  const config = { ...clone(DEFAULT_AVATAR), pieceTransforms: { leftArm: { x: 7, y: 9, scale: 1, scaleX: 1, scaleY: 1, rotation: 4, flipX: false, flipY: false, hidden: false } } };
  const idle = renderAvatar(config);
  const posed = renderAvatar(config, { pose: { leftArm: 28, leftElbow: -42, gazeX: 3, blink: 1, mouth: 1 } });
  assert.match(posed, /data-puppet-joint="left-elbow"/);
  assert.match(posed, /data-puppet-joint="left-shoulder"/);
  assert.match(posed, /data-avatar-piece="leftArm"[^>]+translate\(7 9\)/);
  assert.match(posed, /data-puppet-joint="eyes"/);
  assert.match(posed, /data-puppet-joint="mouth"/);
  assert.doesNotMatch(idle, /data-live-pose="true"/);
});

test("garments and accessories inherit the joints they are attached to across presets and poses", () => {
  const longSleeveOutfits = new Set(["button", "openShirt", "overshirt", "plaid", "suit", "hoodie"]);
  for (const [name, preset] of Object.entries(FAMILY_PRESETS)) {
    const config = { ...preset.avatar, extras: [...preset.avatar.extras, "necklace", "choker", "crossbody"], signatureDetail: "starTattoos" };
    for (const motionPreset of AVATAR_PRESETS) {
      const markup = renderAvatar(config, { pose: poseForPreset(motionPreset) });
      if (["tee", "polo", ...longSleeveOutfits].includes(config.outfit)) {
        assert.ok(groupContains(markup, "left-shoulder", /data-avatar-garment="left-upper-sleeve"/), `${name}/${motionPreset}: upper sleeve follows shoulder`);
        assert.ok(groupContains(markup, "right-shoulder", /data-avatar-garment="right-upper-sleeve"/), `${name}/${motionPreset}: upper sleeve follows shoulder`);
      }
      if (longSleeveOutfits.has(config.outfit)) {
        assert.ok(groupContains(markup, "left-elbow", /data-avatar-garment="left-lower-sleeve"/), `${name}/${motionPreset}: lower sleeve follows elbow`);
        assert.ok(groupContains(markup, "right-elbow", /data-avatar-garment="right-lower-sleeve"/), `${name}/${motionPreset}: lower sleeve follows elbow`);
      }
      assert.ok(pieceContainsJoint(markup, "tattoos", "right-shoulder"), `${name}/${motionPreset}: arm tattoo follows shoulder`);
      assert.ok(groupContains(markup, "body", /data-avatar-piece="crossbody"/), `${name}/${motionPreset}: strap follows body`);
      assert.ok(groupContains(markup, "head", /data-avatar-piece="choker"/), `${name}/${motionPreset}: choker follows head`);
      assert.ok(groupContains(markup, "body", /data-avatar-piece="necklace"/), `${name}/${motionPreset}: necklace follows body`);
    }
  }
});

test("outfit affine pivots stay shared by torso, sleeves, and sleeve patterns", () => {
  const outfit = { x: 12, y: -9, scale: 1.4, scaleX: 0.8, scaleY: 1.15, rotation: 23, flipX: true, flipY: false, hidden: false };
  const decoration = { x: -3, y: 6, scale: 0.8, scaleX: 1.1, scaleY: 0.9, rotation: -11, flipX: false, flipY: false, hidden: false };
  const leftArm = { x: 8, y: -5, scale: 1.2, scaleX: 0.85, scaleY: 1.1, rotation: 17, flipX: true, flipY: false, hidden: false };
  const rightArm = { x: -6, y: 4, scale: 0.9, scaleX: 1.15, scaleY: 0.8, rotation: -13, flipX: false, flipY: true, hidden: false };
  const markup = renderAvatar({ ...DEFAULT_AVATAR, outfit: "openShirt", signatureDetail: "tropicalPrint", pieceTransforms: { outfit, outfitDecoration: decoration, leftArm, rightArm } });
  const outfitAffine = pieceTransformAttribute(outfit, 120, 269);
  const decorationAffine = pieceTransformAttribute(decoration, 120, 269);
  assert.ok(markup.includes(`data-avatar-piece="outfit" transform="${outfitAffine}"`));
  assert.ok(markup.includes(`data-avatar-piece="outfitDecoration" transform="${outfitAffine}"`));
  assert.ok(markup.includes(`data-avatar-garment-decoration="torso" transform="${decorationAffine}"`));
  assert.ok(markup.includes(`<g data-avatar-piece="outfitDecoration" transform="${outfitAffine}"><g data-avatar-garment-decoration="torso" transform="${decorationAffine}"`), "torso layers should use the same outfit-then-decoration order as sleeve patterns");
  assert.ok(markup.includes(`data-avatar-garment-transform="left-upper-sleeve-pattern" transform="${outfitAffine}"><g data-avatar-garment-decoration-transform="left-upper-sleeve-pattern" transform="${decorationAffine}"`), "sleeve layers establish the reference outfit-then-decoration order");
  for (const [joint, side, segment] of [
    ["left-shoulder", "left", "upper"], ["left-elbow", "left", "lower"],
    ["right-shoulder", "right", "upper"], ["right-elbow", "right", "lower"],
  ]) {
    const arm = side === "left" ? leftArm : rightArm;
    const armPivotX = 120 + ((side === "left" ? 82 : 158) - 120) * DEFAULT_AVATAR.bodyWidth;
    const armPivotY = 321 + (266 - 321) * DEFAULT_AVATAR.bodyHeight;
    const armAffine = pieceTransformAttribute(arm, armPivotX, armPivotY);
    assert.ok(markup.includes(`data-avatar-garment-transform="${side}-${segment}-sleeve" transform="${outfitAffine}"`), `${side} ${segment} sleeve shares the outfit pivot`);
    assert.ok(markup.includes(`data-avatar-garment-arm-transform="${side}-${segment}-sleeve" transform="${armAffine}"`), `${side} ${segment} sleeve inherits its saved arm affine`);
    assert.ok(groupContains(markup, joint, new RegExp(`data-avatar-sleeve-pattern="${side}-${segment}"`)), `${side} ${segment} print follows its joint`);
    assert.ok(markup.includes(`data-avatar-garment-decoration-transform="${side}-${segment}-sleeve-pattern" transform="${decorationAffine}"`), `${side} ${segment} print shares the decoration pivot`);
    assert.ok(markup.includes(`data-avatar-garment-decoration-transform="${side}-${segment}-sleeve-pattern" transform="${decorationAffine}"><g data-avatar-garment-arm-transform="${side}-${segment}-sleeve-pattern" transform="${armAffine}"`), `${side} ${segment} pattern applies the arm affine inside outfit and decoration`);
  }

  const geometric = renderAvatar({ ...DEFAULT_AVATAR, outfit: "openShirt", signatureDetail: "geometricTop" });
  assert.ok(groupContains(geometric, "left-shoulder", /data-avatar-sleeve-pattern="left-upper"/));
  assert.ok(groupContains(geometric, "right-elbow", /data-avatar-sleeve-pattern="right-lower"/));
  const floral = renderAvatar({ ...DEFAULT_AVATAR, outfit: "floral", signatureDetail: "sunsetFlorals" });
  assert.match(floral, /data-avatar-piece="outfitDecoration"/);
  assert.doesNotMatch(floral, /data-avatar-sleeve-pattern=/);
});

test("sleeves inherit saved arm transforms with neutral outfit and decoration transforms", () => {
  const leftArm = { x: 5, y: 3, scale: 1, scaleX: 1, scaleY: 1, rotation: 9, flipX: false, flipY: false, hidden: false };
  const rightArm = { x: -4, y: 2, scale: 1, scaleX: 1, scaleY: 1, rotation: -8, flipX: false, flipY: false, hidden: false };
  const neutral = { x: 0, y: 0, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, flipY: false, hidden: false };
  const bodyWidth = 1.16, bodyHeight = 0.9;
  const markup = renderAvatar({ ...DEFAULT_AVATAR, bodyWidth, bodyHeight, outfit: "openShirt", signatureDetail: "tropicalPrint", pieceTransforms: { leftArm, rightArm } });
  const outfitAffine = pieceTransformAttribute(neutral, 120, 321 + (269 - 321) * bodyHeight);
  const decorationAffine = pieceTransformAttribute(neutral, 120, 321 + (269 - 321) * bodyHeight);
  for (const [side, arm] of [["left", leftArm], ["right", rightArm]] as const) {
    const armPivotX = 120 + ((side === "left" ? 82 : 158) - 120) * bodyWidth;
    const armPivotY = 321 + (266 - 321) * bodyHeight;
    const armAffine = pieceTransformAttribute(arm, armPivotX, armPivotY);
    assert.ok(markup.includes(`data-avatar-garment-transform="${side}-upper-sleeve" transform="${outfitAffine}"><g data-avatar-garment-arm-transform="${side}-upper-sleeve" transform="${armAffine}"`));
    assert.ok(markup.includes(`data-avatar-garment-decoration-transform="${side}-upper-sleeve-pattern" transform="${decorationAffine}"><g data-avatar-garment-arm-transform="${side}-upper-sleeve-pattern" transform="${armAffine}"`));
  }
});

test("arm tattoos preserve their piece transform and inherit the saved right arm affine", () => {
  const rightArm = { x: -7, y: 6, scale: 1.1, scaleX: 0.9, scaleY: 1.2, rotation: 14, flipX: true, flipY: false, hidden: false };
  const tattoos = { x: 3, y: -2, scale: 0.95, scaleX: 1.1, scaleY: 0.85, rotation: -6, flipX: false, flipY: true, hidden: false };
  const markup = renderAvatar({ ...DEFAULT_AVATAR, signatureDetail: "starTattoos", pieceTransforms: { rightArm, tattoos } });
  const tattooAffine = pieceTransformAttribute(tattoos, 120 + (160 - 120) * DEFAULT_AVATAR.bodyWidth, 321 + (266 - 321) * DEFAULT_AVATAR.bodyHeight);
  const armAffine = pieceTransformAttribute(rightArm, 120 + (158 - 120) * DEFAULT_AVATAR.bodyWidth, 321 + (266 - 321) * DEFAULT_AVATAR.bodyHeight);
  assert.ok(markup.includes(`data-avatar-piece="tattoos" transform="${tattooAffine}"><g data-avatar-garment-arm-transform="tattoos" transform="${armAffine}"`));
  assert.ok(markup.includes(`data-avatar-garment-arm-transform="tattoos" transform="${armAffine}"><g transform="translate(0 0) scale(1 1)"><g data-puppet-joint="right-shoulder"`));
});
