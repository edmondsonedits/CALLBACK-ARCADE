export type HostMusicPreference = { muted: boolean; music: boolean; musicVolume: number };
export type MenuMusicPreference = { soundEnabled: boolean; volume: number };

export function applyCanonicalMenuMusicPreferences<T extends HostMusicPreference>(
  settings: T,
  preferences: MenuMusicPreference,
): T {
  return {
    ...settings,
    muted: !preferences.soundEnabled,
    music: preferences.soundEnabled,
    musicVolume: clampVolume(preferences.volume),
  };
}

export function menuMusicPreferencesFromHostSettings(settings: HostMusicPreference): MenuMusicPreference {
  return { soundEnabled: settings.music && !settings.muted, volume: clampVolume(settings.musicVolume) };
}

function clampVolume(volume: number) {
  return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.2;
}
