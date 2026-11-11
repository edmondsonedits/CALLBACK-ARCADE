"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarConfig } from "../../lib/avatar-runtime";
import { DEFAULT_AVATAR, clone } from "../../lib/avatar-runtime";
import { changeCharacter, defaultCharacterProfile, type CharacterProfile } from "../../lib/character-profile";
import { loadAvatarPreference } from "../../lib/avatar-preference";
import { Avatar } from "./Avatar";
import { AvatarEditor } from "./AvatarEditor";
import { PhotoFaceEditor } from "./PhotoFaceEditor";
import { useHistoryPanel } from "./useHistoryPanel";
import "../character-profile.css";

export function CharacterProfileEditor({ nickname, onSaved, onProfileLoaded, onProfileReady, onDraftChange, onDirtyChange, onClose }: { nickname: string; onSaved?: (avatarConfig: AvatarConfig, avatarPreset: string | null) => void; onProfileLoaded?: (avatarConfig: AvatarConfig, avatarPreset: string | null) => void; onProfileReady?: () => void; onDraftChange?: (avatarConfig: AvatarConfig, avatarPreset: string | null) => void; onDirtyChange?: (dirty: boolean) => void; onClose?: () => void }) {
  const [profile, setProfile] = useState<CharacterProfile>(() => defaultCharacterProfile());
  const [version, setVersion] = useState(1);
  const [ready, setReady] = useState(false);
  const [trimFaceId, setTrimFaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editStartRef = useRef<CharacterProfile | null>(null);
  const editStartDirtyRef = useRef(false);
  const keepEditRef = useRef(false);
  const editingActiveRef = useRef(false);
  const [editing, setEditing] = useHistoryPanel(false, value => {
    if(value){
      if(!editingActiveRef.current){editStartRef.current=profile;editStartDirtyRef.current=dirty;keepEditRef.current=false;}
      editingActiveRef.current=true;
      return;
    }
    if(!editingActiveRef.current)return;
    editingActiveRef.current=false;
    if(!keepEditRef.current){
      if(editStartRef.current)setProfile(editStartRef.current);
      setDirty(editStartDirtyRef.current);
    }
    keepEditRef.current=false;
  });
  const [photoEditing, setPhotoEditing] = useHistoryPanel(false, value => { if (!value) setTrimFaceId(null); });
  const loadedCallback = useRef(onProfileLoaded);
  const readyCallback = useRef(onProfileReady);
  const draftCallback = useRef(onDraftChange);
  const dirtyCallback = useRef(onDirtyChange);

  useEffect(() => {
    loadedCallback.current = onProfileLoaded;
    readyCallback.current = onProfileReady;
    draftCallback.current = onDraftChange;
    dirtyCallback.current = onDirtyChange;
  }, [onProfileLoaded, onProfileReady, onDraftChange, onDirtyChange]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/profile", { cache: "no-store" }).then(async response => {
      const body = await response.json() as { version?: number; created?: boolean } & Partial<CharacterProfile>;
      if (!response.ok || !body.version) throw new Error("Could not load your saved character.");
      if (cancelled) return;
      const loaded = body as { version: number; created?: boolean } & CharacterProfile;
      let current: CharacterProfile;
      if (loaded.created) {
        const legacy = loadAvatarPreference();
        if (legacy) {
          // A new private cookie cannot own a face from the previous profile.
          const legacyAvatar = { ...legacy.avatarConfig }; delete legacyAvatar.photoFaceId;
          const base = defaultCharacterProfile({ avatarConfig: legacyAvatar, avatarPreset: legacy.avatarPreset });
          current = base; setProfile(base); setDirty(true);
        } else { current = defaultCharacterProfile(); setProfile(current); }
      } else { current = { avatarConfig: loaded.avatarConfig, avatarPreset: loaded.avatarPreset, baseline: loaded.baseline, default: loaded.default ?? { avatarConfig: clone(DEFAULT_AVATAR), avatarPreset: null }, past: loaded.past, future: loaded.future }; setProfile(current); }
      loadedCallback.current?.(current.avatarConfig, current.avatarPreset);
      setVersion(loaded.version); setReady(true);
      readyCallback.current?.();
    }).catch(reason => { if (!cancelled) { setError(reason instanceof Error ? reason.message : "Could not load your saved character."); setReady(true); readyCallback.current?.(); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (ready) draftCallback.current?.(profile.avatarConfig, profile.avatarPreset); }, [ready, profile.avatarConfig, profile.avatarPreset]);
  useEffect(() => { if (ready) dirtyCallback.current?.(dirty); }, [ready, dirty]);

  const save = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, profile }) });
      const body = await response.json() as { version?: number; message?: string };
      if (!response.ok || !body.version) throw new Error(body.message ?? "Your character could not be saved. Your draft is still here.");
      setVersion(body.version); setDirty(false); setMessage("Character saved to this browser's private profile.");
      onSaved?.(profile.avatarConfig, profile.avatarPreset);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your character could not be saved. Your draft is still here."); }
    finally { setSaving(false); }
  };
  const updateCharacter = (avatarConfig: AvatarConfig, avatarPreset: string | null) => { setProfile(current => ({ ...current, avatarConfig, avatarPreset })); setDirty(true); };

  return <section className="character-profile-card" aria-labelledby="character-profile-title">
    <div className="character-profile-copy"><h2 id="character-profile-title">Your character</h2><p>Ready for every game on this browser.</p></div>
    {onClose && <button className="character-profile-close" type="button" aria-label="Close character editor" onClick={onClose}>×</button>}
    <div className="character-profile-preview"><Avatar index={0} color="#46DBDC" config={ready ? profile.avatarConfig : DEFAULT_AVATAR} size="large" label={`${nickname || "Your"} character`} animation="still" /><strong>{nickname || "Your player"}</strong></div>
    {!ready ? <p role="status">Loading your saved character…</p> : <div className="character-profile-actions">
      <button className="button button-secondary" type="button" onClick={() => { setError(""); setMessage(""); editStartRef.current = profile; editStartDirtyRef.current = dirty; editingActiveRef.current = true; setEditing(true); }}>Customize character</button>
      <button className="button button-secondary" type="button" disabled={photoEditing} onClick={() => { setTrimFaceId(null); setPhotoEditing(true); }}>Use a face photo</button>
      {profile.avatarConfig.photoFaceId && <button className="button button-secondary" type="button" disabled={photoEditing} onClick={() => { setError(""); setMessage(""); setTrimFaceId(profile.avatarConfig.photoFaceId ?? null); setPhotoEditing(true); }}>Trim neck</button>}
      {profile.avatarConfig.photoFaceId && <button className="button button-secondary" type="button" onClick={() => { setProfile(current => { const avatarConfig = { ...current.avatarConfig }; delete avatarConfig.photoFaceId; return changeCharacter(current, avatarConfig, null); }); setDirty(true); }}>Use drawn face</button>}
      <button className="button button-primary" type="button" disabled={saving || !dirty} onClick={() => void save()}>{saving ? "Saving…" : dirty ? "Save character" : "Character saved"}</button>
    </div>}
    {photoEditing && <PhotoFaceEditor key={trimFaceId ?? "new-photo"} avatar={profile.avatarConfig} initialFaceId={trimFaceId ?? undefined} onCancel={() => { setPhotoEditing(false); setTrimFaceId(null); }} onApply={faceId => { setProfile(current => changeCharacter(current, { ...current.avatarConfig, photoFaceId: faceId }, null)); setDirty(true); setPhotoEditing(false); setTrimFaceId(null); setMessage("Face added. Save your character to keep it."); }} />}
    <details className="character-profile-help"><summary>How your character is saved</summary><p>Your character uses a private browser cookie, without an account. Clearing it or changing devices means this character cannot be recovered automatically.</p></details>
    {message && <p className="character-profile-status" role="status">{message}</p>}{error && <p className="character-profile-error" role="alert">{error}</p>}
    {editing && <AvatarEditor value={profile.avatarConfig} preset={profile.avatarPreset} playerName={nickname} onChange={avatarConfig => updateCharacter(avatarConfig, profile.avatarPreset)} onPresetChange={avatarPreset => updateCharacter(profile.avatarConfig, avatarPreset)} onCharacterChange={updateCharacter} history={{ past: profile.past, future: profile.future }} baseline={profile.baseline} defaultCharacter={profile.default} onHistoryChange={({ past, future }) => { setProfile(current => ({ ...current, past, future })); setDirty(true); }} onRestoreBaseline={() => { setProfile(current => changeCharacter(current, current.baseline.avatarConfig, current.baseline.avatarPreset)); setDirty(true); }} onRestoreDefault={() => { setProfile(current => changeCharacter(current, current.default.avatarConfig, current.default.avatarPreset)); setDirty(true); }} onDone={() => { keepEditRef.current = true; setEditing(false); }} onCancel={() => { if (editStartRef.current) setProfile(editStartRef.current); setDirty(editStartDirtyRef.current); setEditing(false); }} />}
  </section>;
}
