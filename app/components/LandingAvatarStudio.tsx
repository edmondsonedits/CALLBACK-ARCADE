"use client";

import { useSyncExternalStore } from "react";
import { saveAvatarPreference } from "../../lib/avatar-preference";
import { CharacterProfileEditor } from "./CharacterProfileEditor";

export function LandingAvatarStudio() {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  if (!mounted) return <section className="landing-avatar-studio landing-avatar-loading" aria-label="Loading your saved character"><span>✦</span><strong>Getting your character ready…</strong></section>;
  return <section className="landing-avatar-studio" aria-label="Your saved character">
    <CharacterProfileEditor nickname="Your player" onSaved={(avatarConfig, avatarPreset) => { saveAvatarPreference(avatarConfig, avatarPreset); }} />
  </section>;
}
