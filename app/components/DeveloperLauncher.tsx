"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import type { GameLength } from "../../lib/contracts";

const subscribeHydration = () => () => undefined;

export function DeveloperLauncher() {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [gameLength, setGameLength] = useState<GameLength>("pictures");
  const [contentMode, setContentMode] = useState<"family" | "party">("party");
  const [timerAccessibility, setTimerAccessibility] = useState(false);
  const [playerName, setPlayerName] = useState("Developer");
  const [botCount, setBotCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { localStorage.setItem("callback-developer-mode", "enabled"); }, []);

  const launch = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameLength, contentMode, timerAccessibility,
          soloMode: true,
          developerMode: true,
          soloPlayerName: playerName,
          botCount,
        }),
      });
      const body = await response.json() as { code?: string; error?: { message?: string } };
      if (!response.ok || !body.code) throw new Error(body.error?.message ?? "Could not create the developer playtest.");
      window.location.assign(`/developer/${body.code}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create the developer playtest."); setBusy(false); }
  };

  return <form className="developer-launcher" data-hydrated={hydrated} onSubmit={launch}>
    <div className="developer-launch-grid">
      <label htmlFor="developer-game-pack"><span>Game pack</span><select id="developer-game-pack" value={gameLength} onChange={(event) => setGameLength(event.target.value as GameLength)}><option value="royal-rumours">Royal Rumours · AI picture telephone</option><option value="king-mystery">The Royal Frame-Up · bluff and investigate</option><option value="pictures">King Prompter · 2 canvases + final</option><option value="comic">Let&apos;s Make a Comic · 3 panels</option><option value="bowl-of-fools">Bowl of Fools · phone and TV play</option><option value="standard">Legacy Standard · 7 rounds</option></select></label>
      <label htmlFor="developer-name"><span>Developer name</span><input id="developer-name" value={playerName} maxLength={20} onChange={(event) => setPlayerName(event.target.value)} /></label>
      <label htmlFor="developer-content"><span>Content</span><select id="developer-content" value={contentMode} onChange={(event) => setContentMode(event.target.value as "family" | "party")}><option value="party">Party</option><option value="family">Family</option></select></label>
      <label className="developer-bot-count" htmlFor="developer-bot-count"><span>Local bots <b>{botCount}</b></span><input id="developer-bot-count" type="range" min={2} max={5} value={botCount} onChange={(event) => setBotCount(Number(event.target.value))} /></label>
    </div>
    <label className="developer-launch-toggle" htmlFor="developer-extended-time" aria-label="More thinking time"><input id="developer-extended-time" type="checkbox" checked={timerAccessibility} onChange={(event) => setTimerAccessibility(event.target.checked)} /><span><strong>More thinking time</strong><small>Start with the normal 1.5× accessibility timers.</small></span></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="button button-primary" disabled={!hydrated || busy || !playerName.trim()}>{busy ? "Preparing test bench…" : "Launch test bench →"}</button>
  </form>;
}
