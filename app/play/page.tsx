"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Brand } from "../components/Brand";
import { CharacterProfileEditor } from "../components/CharacterProfileEditor";
import { ScrollPanel } from "../components/ScrollPanel";

const CODE = /^[A-HJ-KM-NP-Z2-9]{4}$/;
const subscribe=()=>()=>undefined;

export default function EnterCodePage() {
  const [screen,setScreen]=useState<'join'|'style'>('join');
  const ready=useSyncExternalStore(subscribe,()=>true,()=>false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("Player");
  const [checking, setChecking] = useState(false);
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = code.toUpperCase().replace(/[^A-HJ-KM-NP-Z2-9]/g, "").slice(0, 4);
    if (!CODE.test(normalized)) { setError("Enter the four-character room code."); return; }
    setCode(normalized); setChecking(true); setError("");
    try {
      const nicknameQuery = `?nickname=${encodeURIComponent(nickname.trim().slice(0, 24) || "Player")}`;
      const response = await fetch(`/api/sessions/${normalized}?lookup=1`, { cache: "no-store" });
      if (response.ok) {
        const result = await response.json() as { exists?: boolean };
        if (result.exists) { window.location.href = `/session/${normalized}/play${nicknameQuery}`; return; }
        window.location.href = `/play/${normalized}${nicknameQuery}`; return;
      }
      if (response.status === 404) { window.location.href = `/play/${normalized}${nicknameQuery}`; return; }
      setError("We could not check that code. Please try again.");
    } catch { setError("We could not check that code. Please try again."); }
    finally { setChecking(false); }
  };
  return <main className="phone-shell phone-entry fullscreen-join">
    <Brand platform />
    <ScrollPanel><section className="phone-card join-code-card" hidden={screen!=='join'}>
      <p className="eyebrow">Join the CALLBACK lobby</p><h1>Find your group</h1>
      <form onSubmit={event => void submit(event)}>
        <label htmlFor="room-code">Four-character code</label>
        <input id="room-code" className="code-input" autoComplete="off" inputMode="text" disabled={!ready || checking} value={code} onChange={event => { setCode(event.target.value.toUpperCase().replace(/[^A-HJ-KM-NP-Z2-9]/g, "").slice(0, 4)); setError(""); }} maxLength={4} placeholder="B4CK" aria-describedby={error ? "code-error" : undefined} />
        <label htmlFor="profile-nickname">Your nickname</label><input id="profile-nickname" disabled={!ready || checking} value={nickname} maxLength={24} onChange={event => setNickname(event.target.value)} />
        {error && <p className="form-error" id="code-error" role="alert">{error}</p>}
        <button className="button button-primary phone-button" type="submit" disabled={!ready || checking}>{checking ? "Checking code…" : "Join game"} <span aria-hidden="true">→</span></button>
      </form>
      <details className="join-legacy-help"><summary>Joining an older Arcade room?</summary><p><Link href="/arcade-games/phone/controller.html">Open its phone controller →</Link></p></details>
    </section>
    <div hidden={screen!=='style'}><CharacterProfileEditor nickname={nickname.trim() || "Your player"} /></div>
    </ScrollPanel>
    <nav className="join-screen-links" aria-label="Join screens">{screen!=='join'?<button type="button" className="button button-secondary" onClick={()=>setScreen('join')}>Back</button>:<><button disabled={!ready} type="button" className="button button-secondary" onClick={()=>setScreen('style')}>Your character</button><Link className="button button-secondary" href="/?menu=1">Home</Link></>}</nav>
    <p className="phone-footnote">No account or app needed.</p>
  </main>;
}
