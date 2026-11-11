"use client";

import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import {ScrollPanel} from "./ScrollPanel";
import { SOUNDTRACK_VOLUME } from "../../lib/game/soundtrack";
import { menuMusicPreferencesFromHostSettings, type HostMusicPreference } from "../../lib/game/hostAudioPreferences";

export type MenuMotionPreference = "system" | "default" | "reduced";

export type MenuPreferences = {
  version: 1;
  soundEnabled: boolean;
  volume: number;
  motion: MenuMotionPreference;
};

export const MENU_PREFERENCES_STORAGE_KEY = "king-prompter-menu-preferences:v3";
export const LEGACY_MENU_PREFERENCES_STORAGE_KEY = "king-prompter-menu-preferences:v2";

export const DEFAULT_MENU_PREFERENCES: MenuPreferences = {
  version: 1,
  soundEnabled: true,
  volume: SOUNDTRACK_VOLUME,
  motion: "system",
};

export function parseMenuPreferences(value: string | null): MenuPreferences {
  if (!value) return DEFAULT_MENU_PREFERENCES;
  try {
    const candidate = JSON.parse(value) as Partial<MenuPreferences>;
    if (
      candidate.version !== 1
      || typeof candidate.soundEnabled !== "boolean"
      || typeof candidate.volume !== "number"
      || !Number.isFinite(candidate.volume)
      || !["system", "default", "reduced"].includes(candidate.motion ?? "")
    ) return DEFAULT_MENU_PREFERENCES;
    return {
      version: 1,
      soundEnabled: candidate.soundEnabled,
      volume: Math.max(0, Math.min(1, candidate.volume)),
      motion: candidate.motion as MenuMotionPreference,
    };
  } catch {
    return DEFAULT_MENU_PREFERENCES;
  }
}

export function loadMenuPreferences(storage: Pick<Storage, "getItem">): MenuPreferences {
  try {
    const current = storage.getItem(MENU_PREFERENCES_STORAGE_KEY);
    if (current !== null) return parseMenuPreferences(current);
    const legacy = parseMenuPreferences(storage.getItem(LEGACY_MENU_PREFERENCES_STORAGE_KEY));
    return { ...DEFAULT_MENU_PREFERENCES, motion: legacy.motion };
  } catch {
    return DEFAULT_MENU_PREFERENCES;
  }
}

export function updateMenuAudioPreferences(
  current: MenuPreferences,
  audio: Pick<MenuPreferences, "soundEnabled" | "volume">,
): MenuPreferences {
  const volume = Math.max(0, Math.min(1, audio.volume));
  if (current.soundEnabled === audio.soundEnabled && current.volume === volume) return current;
  return { ...current, soundEnabled: audio.soundEnabled, volume };
}

export function persistMenuAudioPreferencesFromHost(
  storage: Pick<Storage, "getItem" | "setItem">,
  settings: HostMusicPreference,
): MenuPreferences {
  const current = loadMenuPreferences(storage);
  const audio = menuMusicPreferencesFromHostSettings(settings);
  const updated = updateMenuAudioPreferences(current, audio);
  if (updated !== current) storage.setItem(MENU_PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

type MenuSettingsDialogProps = {
  open: boolean;
  preferences: MenuPreferences;
  replayDisabled: boolean;
  onChange: Dispatch<SetStateAction<MenuPreferences>>;
  onClose: () => void;
  onReplayIntro: () => void;
};

export function MenuSettingsDialog({ open, preferences, replayDisabled, onChange, onClose, onReplayIntro }: MenuSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("#menu-sound")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="menu-settings-dialog"
      aria-labelledby="menu-settings-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
    >
      <ScrollPanel active={open}><div className="menu-settings-heading">
        <div><span>DEVICE SETTINGS</span><h2 id="menu-settings-title">Set the stage</h2></div>
        <button type="button" className="menu-settings-close" onClick={onClose} aria-label="Close settings">×</button>
      </div>

      <div className="menu-settings-toggle">
        <input
          id="menu-sound"
          type="checkbox"
          checked={preferences.soundEnabled}
          onChange={(event) => onChange((current) => ({ ...current, soundEnabled: event.target.checked }))}
        />
        <label htmlFor="menu-sound"><strong>Menu sound</strong><small>Music and effects stay on this device.</small></label>
      </div>

      <div className="menu-volume-control">
        <span><label htmlFor="menu-volume"><strong>Volume</strong></label><output htmlFor="menu-volume">{Math.round(preferences.volume * 100)}%</output></span>
        <input
          id="menu-volume"
          type="range"
          min="0"
          max="100"
          step="5"
          value={Math.round(preferences.volume * 100)}
          disabled={!preferences.soundEnabled}
          onChange={(event) => onChange((current) => ({ ...current, volume: Number(event.target.value) / 100 }))}
        />
      </div>

      <fieldset className="menu-motion-options">
        <legend>Motion</legend>
        {([
          ["system", "Use device setting"],
          ["default", "Full stage motion"],
          ["reduced", "Reduced motion"],
        ] as const).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="menu-motion"
              value={value}
              checked={preferences.motion === value}
              onChange={() => onChange((current) => ({ ...current, motion: value }))}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="menu-settings-actions">
        <button type="button" className="menu-replay-button" disabled={replayDisabled} onClick={onReplayIntro}>Replay Intro</button>
        <button type="button" className="menu-done-button" onClick={onClose}>Done</button>
      </div>
      {replayDisabled && <p className="menu-settings-note">Intro video stays off while reduced motion is active.</p>}
    </ScrollPanel></dialog>
  );
}
