import type { AvatarConfig } from "./avatar-runtime";
import { AvatarConfigSchema, AvatarPresetSchema } from "./contracts";

export const AVATAR_PREFERENCE_KEY = "callback.avatar.v2";
export const LEGACY_AVATAR_PREFERENCE_KEY = "callback.avatar.v1";

export interface AvatarPreference {
  serializationVersion: 2;
  avatarConfig: AvatarConfig;
  avatarPreset: string | null;
}

export function parseAvatarPreference(value: string | null): AvatarPreference | null {
  if (!value) return null;
  try {
    const stored = JSON.parse(value) as { avatarConfig?: unknown; avatarPreset?: unknown };
    const avatarConfig = AvatarConfigSchema.safeParse(stored.avatarConfig);
    const avatarPreset = AvatarPresetSchema.nullable().safeParse(stored.avatarPreset ?? null);
    if (!avatarConfig.success || !avatarPreset.success) return null;
    return { serializationVersion: 2, avatarConfig: avatarConfig.data as AvatarConfig, avatarPreset: avatarPreset.data };
  } catch {
    return null;
  }
}

export function loadAvatarPreference(): AvatarPreference | null {
  if (typeof window === "undefined") return null;
  try {
    const current = parseAvatarPreference(window.localStorage.getItem(AVATAR_PREFERENCE_KEY));
    if (current) return current;
    const legacy = parseAvatarPreference(window.localStorage.getItem(LEGACY_AVATAR_PREFERENCE_KEY));
    if (legacy) window.localStorage.setItem(AVATAR_PREFERENCE_KEY, JSON.stringify(legacy));
    return legacy;
  } catch {
    return null;
  }
}

export function saveAvatarPreference(avatarConfig: AvatarConfig, avatarPreset: string | null): boolean {
  if (typeof window === "undefined") return false;
  const validated = parseAvatarPreference(JSON.stringify({ avatarConfig, avatarPreset }));
  if (!validated) return false;
  try {
    window.localStorage.setItem(AVATAR_PREFERENCE_KEY, JSON.stringify(validated));
    return true;
  } catch {
    return false;
  }
}
