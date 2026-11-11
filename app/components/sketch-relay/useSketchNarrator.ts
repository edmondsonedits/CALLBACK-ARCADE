"use client";

import { useEffect, useRef, useState } from "react";
import type { SnapshotSketchRelay } from "../../../lib/arcade/sketch-relay";
import { showdownCues } from "../../../lib/game/sketch-showdown-script";
import { automaticNarratorMood, createNarratorDirector, makeNarratorCue, type NarratorSelection } from "../../../lib/game/sketch-narrator";

const STORAGE_KEY = "callback:sketch-narrator:v1";

export function useSketchNarrator(game: SnapshotSketchRelay, remaining: number | null, players: Array<{ id: string; nickname: string }>, paused: boolean) {
  const [view, setView] = useState({ key: "welcome", text: "Welcome to Sketch and Sorcery.", mood: automaticNarratorMood(game.matchId), selection: "auto" as NarratorSelection, scope: "", paused });
  const runtime = useRef<{ matchId: string; director: ReturnType<typeof createNarratorDirector>; paused: boolean; phase: string; pauses: number } | null>(null);
  const candidates = showdownCues(game, remaining, players);
  const cuesJSON = JSON.stringify(candidates);
  const scope = candidates[0]?.key ?? game.matchId;
  const phase = `${game.round}:${game.phase}:${game.showdown?.phaseStartedAt}`;
  useEffect(() => {
    if (runtime.current?.matchId !== game.matchId) {
      let saved: unknown;
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw && raw.length < 2_000_000) saved = JSON.parse(raw); } catch { /* Storage is optional. */ }
      runtime.current = { matchId: game.matchId, director: createNarratorDirector(game.matchId, saved), paused: false, phase, pauses: 0 };
    }
    const current = runtime.current;
    const cues = JSON.parse(cuesJSON) as ReturnType<typeof showdownCues>;
    let special: ReturnType<typeof makeNarratorCue> | undefined;
    if (paused && !current.paused) {
      current.pauses += 1;
      special = makeNarratorCue(`${game.matchId}:pause:${current.pauses}`, "pause", "The exhibition is paused. Your work is safe.", {}, game.matchId, 90);
    } else if (!paused && current.paused && current.phase === phase) {
      special = makeNarratorCue(`${game.matchId}:resume:${current.pauses}`, "resume", "Back to the exhibition. Follow the current task.", {}, game.matchId, 85);
    }
    current.paused = paused; current.phase = phase;
    const next = special ? current.director.next([special], Date.now(), null) : paused ? null : current.director.next(cues, Date.now(), game.phase === "complete" ? null : remaining);
    const fallback = cues[0] ? current.director.present(cues[0], game.phase === "complete" ? null : remaining) : { key: "welcome", text: "Welcome to Sketch and Sorcery." };
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setView(previous => ({ ...(next ?? (previous.scope !== scope ? fallback : previous)), mood: current.director.mood(), selection: current.director.selection(), scope, paused }));
      if (next) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current.director.save())); } catch { /* Private browsing or full storage must not affect play. */ }
    });
    return () => { cancelled = true; };
  }, [game.matchId, game.phase, phase, scope, cuesJSON, paused, remaining]);

  function setSelection(selection: NarratorSelection) {
    const current = runtime.current; if (!current) return;
    current.director.setSelection(selection);
    const cues = paused ? [makeNarratorCue(`${game.matchId}:pause:${current.pauses}`, "pause", "The exhibition is paused. Your work is safe.", {}, game.matchId, 90)] : JSON.parse(cuesJSON) as ReturnType<typeof showdownCues>;
    const next = current.director.next(cues, Date.now(), game.phase === "complete" ? null : remaining) ?? (cues[0] ? current.director.present(cues[0], remaining) : view);
    setView({ ...next, mood: current.director.mood(), selection, scope, paused });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current.director.save())); } catch { /* Optional. */ }
  }
  const voiceReady = view.scope === scope && view.paused === paused;
  // Never expose or speak a prior card's caption while its replacement is scheduled.
  return { ...view, ...(voiceReady ? {} : { key: `${scope}:preparing`, text: paused ? "The exhibition is paused. Your work is safe." : candidates[0]?.facts ?? "Follow the instructions on your phone." }), voiceReady, setSelection };
}
