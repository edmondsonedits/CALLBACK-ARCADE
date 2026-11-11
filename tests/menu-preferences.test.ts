import assert from "node:assert/strict";
import test from "node:test";
import { loadMenuPreferences, MENU_PREFERENCES_STORAGE_KEY, persistMenuAudioPreferencesFromHost, updateMenuAudioPreferences } from "../app/components/MenuSettingsDialog";

test("legacy menu settings keep motion preference and use the new default audio settings", () => {
  const values: Record<string, string> = {
    "king-prompter-menu-preferences:v2": JSON.stringify({ version: 1, soundEnabled: false, volume: 0.25, motion: "reduced" }),
  };
  const preferences = loadMenuPreferences({ getItem: (key) => values[key] ?? null });
  assert.equal(MENU_PREFERENCES_STORAGE_KEY, "king-prompter-menu-preferences:v3");
  assert.deepEqual(preferences, { version: 1, soundEnabled: true, volume: 0.2, motion: "reduced" });
});

test("current menu settings retain an explicit mute and volume choice", () => {
  const values: Record<string, string> = {
    "king-prompter-menu-preferences:v3": JSON.stringify({ version: 1, soundEnabled: false, volume: 0.45, motion: "default" }),
    "king-prompter-menu-preferences:v2": JSON.stringify({ version: 1, soundEnabled: true, volume: 0.25, motion: "reduced" }),
  };
  const preferences = loadMenuPreferences({ getItem: (key) => values[key] ?? null });
  assert.deepEqual(preferences, { version: 1, soundEnabled: false, volume: 0.45, motion: "default" });
});

test("menu audio self-echoes preserve the existing settings without creating a new preference value", () => {
  const current = { version: 1 as const, soundEnabled: true, volume: 0.35, motion: "default" as const };
  const echoed = updateMenuAudioPreferences(current, { soundEnabled: true, volume: 0.35 });
  assert.equal(echoed, current);
  assert.deepEqual(updateMenuAudioPreferences(current, { soundEnabled: false, volume: 0.35 }), {
    version: 1, soundEnabled: false, volume: 0.35, motion: "default",
  });
});

test("host mute and music volume changes persist to canonical menu preferences", () => {
  const values: Record<string, string> = {
    [MENU_PREFERENCES_STORAGE_KEY]: JSON.stringify({ version: 1, soundEnabled: true, volume: 0.2, motion: "reduced" }),
    "callback-host-audio-v3": JSON.stringify({ muted: true, music: false, musicVolume: 0.45 }),
  };
  const storage = {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = value; },
  };

  const muted = persistMenuAudioPreferencesFromHost(storage, { muted: true, music: true, musicVolume: 0.45 });
  assert.deepEqual(muted, { version: 1, soundEnabled: false, volume: 0.45, motion: "reduced" });
  assert.deepEqual(JSON.parse(values[MENU_PREFERENCES_STORAGE_KEY]), muted);

  const unmuted = persistMenuAudioPreferencesFromHost(storage, { muted: false, music: true, musicVolume: 0.35 });
  assert.deepEqual(unmuted, { version: 1, soundEnabled: true, volume: 0.35, motion: "reduced" });
  assert.deepEqual(JSON.parse(values[MENU_PREFERENCES_STORAGE_KEY]), unmuted);
});
