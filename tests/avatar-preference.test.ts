import assert from "node:assert/strict";
import test from "node:test";
import { FAMILY_PRESETS } from "../lib/avatar-runtime";
import { parseAvatarPreference } from "../lib/avatar-preference";

test("saved family avatar preferences round-trip", () => {
  const saved = JSON.stringify({ avatarConfig: FAMILY_PRESETS.Ruth.avatar, avatarPreset: "Ruth" });
  const preference = parseAvatarPreference(saved);
  assert.equal(preference?.serializationVersion, 2);
  assert.equal(preference?.avatarConfig.schemaVersion, 2);
  assert.equal(preference?.avatarPreset, "Ruth");
  assert.equal(preference?.avatarConfig.hairStyle, FAMILY_PRESETS.Ruth.avatar.hairStyle);
});

test("malformed and unknown avatar preferences are ignored", () => {
  assert.equal(parseAvatarPreference("not-json"), null);
  assert.equal(parseAvatarPreference(JSON.stringify({ avatarConfig: {}, avatarPreset: "Nobody" })), null);
});
