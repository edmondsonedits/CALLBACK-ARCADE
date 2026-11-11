import { z } from "zod";
import { AvatarConfigSchema, AvatarPresetSchema } from "./contracts";
import { DEFAULT_AVATAR } from "./avatar-runtime";
import type { AvatarConfig } from "./avatar-runtime";

export const CHARACTER_HISTORY_LIMIT = 80;
const CharacterSchema = z.object({ avatarConfig: AvatarConfigSchema, avatarPreset: AvatarPresetSchema.nullable() }).strict();
export type CharacterState = { avatarConfig: AvatarConfig; avatarPreset: string | null };
export const CharacterStateSchema = CharacterSchema;
export const CharacterProfileSchema = z.object({
  avatarConfig: AvatarConfigSchema,
  avatarPreset: AvatarPresetSchema.nullable(),
  baseline: CharacterSchema,
  default: CharacterSchema,
  past: z.array(CharacterSchema).max(CHARACTER_HISTORY_LIMIT),
  future: z.array(CharacterSchema).max(CHARACTER_HISTORY_LIMIT),
}).strict().superRefine((profile, ctx) => {
  if (profile.past.length + profile.future.length > CHARACTER_HISTORY_LIMIT) ctx.addIssue({ code: "custom", message: "History exceeds the 80 step limit." });
});
export type CharacterProfile = CharacterState & { baseline: CharacterState; default: CharacterState; past: CharacterState[]; future: CharacterState[] };

const cloneCharacter = (character: CharacterState): CharacterState => ({ avatarConfig: structuredClone(character.avatarConfig), avatarPreset: character.avatarPreset });
export function defaultCharacterProfile(candidate?: CharacterState): CharacterProfile {
  const baseline = CharacterSchema.parse(candidate ?? { avatarConfig: DEFAULT_AVATAR, avatarPreset: null });
  return { ...cloneCharacter(baseline), baseline, default: { avatarConfig: structuredClone(DEFAULT_AVATAR), avatarPreset: null }, past: [], future: [] };
}
export function changeCharacter(profile: CharacterProfile, avatarConfig: AvatarConfig, avatarPreset: string | null): CharacterProfile {
  const next = CharacterSchema.parse({ avatarConfig, avatarPreset });
  if (JSON.stringify(next) === JSON.stringify({ avatarConfig: profile.avatarConfig, avatarPreset: profile.avatarPreset })) return profile;
  return CharacterProfileSchema.parse({ ...profile, ...cloneCharacter(next), past: [...profile.past, { avatarConfig: structuredClone(profile.avatarConfig), avatarPreset: profile.avatarPreset }].slice(-CHARACTER_HISTORY_LIMIT), future: [] });
}
export function undoCharacter(profile: CharacterProfile): CharacterProfile {
  const previous = profile.past.at(-1);
  if (!previous) return profile;
  return CharacterProfileSchema.parse({ ...profile, ...cloneCharacter(previous), past: profile.past.slice(0, -1), future: [...profile.future, { avatarConfig: structuredClone(profile.avatarConfig), avatarPreset: profile.avatarPreset }] });
}
export function redoCharacter(profile: CharacterProfile): CharacterProfile {
  const next = profile.future.at(-1);
  if (!next) return profile;
  return CharacterProfileSchema.parse({ ...profile, ...cloneCharacter(next), past: [...profile.past, { avatarConfig: structuredClone(profile.avatarConfig), avatarPreset: profile.avatarPreset }].slice(-CHARACTER_HISTORY_LIMIT), future: profile.future.slice(0, -1) });
}
export function restoreCharacter(profile: CharacterProfile, target: "baseline" | "default"): CharacterProfile {
  const character = target === "baseline" ? profile.baseline : profile.default;
  return changeCharacter(profile, character.avatarConfig, character.avatarPreset);
}

const CODE = /^[A-HJ-KM-NP-Z2-9]{4}$/;
export function resolveScannedJoin(value: string, origin: string): string | null {
  const trimmed = value.trim();
  if (CODE.test(trimmed.toUpperCase())) return trimmed.toUpperCase();
  try {
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) return null;
    const direct = url.pathname.match(/^\/session\/([A-HJ-KM-NP-Z2-9]{4})\/play\/?$/i);
    if (direct) return direct[1]!.toUpperCase();
    const legacy = url.pathname.match(/^\/play\/([A-HJ-KM-NP-Z2-9]{4})\/?$/i);
    return legacy ? legacy[1]!.toUpperCase() : null;
  } catch { return null; }
}
