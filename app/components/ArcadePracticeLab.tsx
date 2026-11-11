"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getPracticeGame } from "../../lib/arcade/practice/catalog";
import { ARCADE_PLACEHOLDER_NOTE } from "../../lib/arcade/catalog";
import {
  advancePracticeSession, createPracticeSession, disposePracticeSession, resetPracticeSession,
  setPracticeSessionInput, setPracticeSessionPaused, type PracticeFrame, type PracticeSession,
} from "../../lib/arcade/practice/runner";
import type { PracticeGameId, PracticeGameModule, PracticeInput } from "../../lib/arcade/practice/types";
import ArcadePracticeControls from "./ArcadePracticeControls";
import ArcadePracticeScene from "./ArcadePracticeScene";
import { getFullArcadeGame } from "../../lib/arcade/full-games";
import FullArcadeGame from "./FullArcadeGame";
import ArcadeTouchTools from "./ArcadeTouchTools";

function makeSeed(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) return crypto.getRandomValues(new Uint32Array(1))[0]! | 0;
  return Date.now() | 0;
}

export default function ArcadePracticeLab({ gameId }: { readonly gameId: PracticeGameId }) {
  const fullGame = getFullArcadeGame(gameId);
  return fullGame ? <FullArcadeGame game={fullGame} /> : <PrototypePracticeLab gameId={gameId} />;
}

function PrototypePracticeLab({ gameId }: { readonly gameId: PracticeGameId }) {
  const game = getPracticeGame(gameId)!;
  const sessionRef = useRef<PracticeSession<unknown, unknown> | null>(null);
  const [frame, setFrame] = useState<PracticeFrame<unknown> | null>(null);
  const [seed, setSeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const resetCueRef = useRef(false);

  const playCue = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined" || !("AudioContext" in window)) return;
    const context = audioRef.current ?? new AudioContext();
    audioRef.current = context;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.17);
  }, [soundEnabled]);

  useEffect(() => {
    const pending = Boolean(frame?.resetPending);
    if (pending && !resetCueRef.current) playCue();
    resetCueRef.current = pending;
  }, [frame?.resetPending, playCue]);

  const onInput = useCallback((input: Omit<PracticeInput, "sequence">) => {
    if (sessionRef.current) setPracticeSessionInput(sessionRef.current, input);
  }, []);

  useEffect(() => {
    let active = true, raf = 0, previous = 0, lastPublishedTick = -1, lastResetRemaining = -1;
    let session: PracticeSession<unknown, unknown> | null = null;
    const visibility = () => {
      if (!session) return;
      const hidden = document.visibilityState !== "visible";
      setPracticeSessionPaused(session, hidden);
      if (hidden) setPracticeSessionInput(session, { x: 0, y: 0, buttons: {} });
      previous = 0;
    };
    void game.load().then((module: PracticeGameModule<unknown, unknown>) => {
      if (!active) return;
      const nextSeed = makeSeed(); setSeed(nextSeed);
      session = createPracticeSession(module, { playerId: "practice-player", seed: nextSeed });
      sessionRef.current = session;
      setFrame(advancePracticeSession(session, 0)); setLoading(false);
      const animate = (time: number) => {
        if (!active || !session) return;
        if (previous === 0) previous = time;
        const nextFrame = advancePracticeSession(session, Math.min(250, time - previous));
        previous = time;
        if (nextFrame.tick !== lastPublishedTick || nextFrame.resetPending !== (lastResetRemaining > 0) || (nextFrame.resetPending && Math.abs(nextFrame.resetRemainingMs - lastResetRemaining) > 30)) {
          setFrame(nextFrame); lastPublishedTick = nextFrame.tick; lastResetRemaining = nextFrame.resetRemainingMs;
        }
        raf = requestAnimationFrame(animate);
      };
      raf = requestAnimationFrame(animate);
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "This practice game could not be loaded."); setLoading(false);
    });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", visibility);
      if (session) disposePracticeSession(session);
      if (sessionRef.current === session) sessionRef.current = null;
      if (audioRef.current) { void audioRef.current.close(); audioRef.current = null; }
    };
  }, [game]);

  const reset = () => {
    const session = sessionRef.current; if (!session) return;
    const nextSeed = makeSeed(); setSeed(nextSeed); setFrame(resetPracticeSession(session, nextSeed));
  };

  return <main className="arcade-practice-page" aria-labelledby="practice-title">
    <header className="arcade-practice-header">
      <div><p className="arcade-practice-kicker">KING PROMPTER · PRACTICE LAB</p><h1 id="practice-title">{game.title}</h1>{game.placeholder && <p>{ARCADE_PLACEHOLDER_NOTE}</p>}<p>{game.instructions}</p></div>
      <nav className="arcade-practice-actions" aria-label="Practice actions"><ArcadeTouchTools/>
        <button type="button" aria-pressed={soundEnabled} onClick={() => {
          if (!soundEnabled && "AudioContext" in window) { audioRef.current ??= new AudioContext(); void audioRef.current.resume(); }
          setSoundEnabled((enabled) => !enabled);
        }} disabled={loading || Boolean(error)}>{soundEnabled ? "Sound on" : "Sound off"}</button>
        <button type="button" onClick={reset} disabled={loading || Boolean(error)}>Reset</button>
        <Link href="/arcade/practice">Exit</Link>
      </nav>
    </header>
    <div className="arcade-practice-stage">
      <div className="arcade-practice-arena" aria-busy={loading}>
        {frame ? <ArcadePracticeScene gameId={gameId} snapshot={frame.state} tick={frame.tick} /> : <div className="arcade-practice-message" role="status">{loading ? "Loading your practice arena…" : error}</div>}
        {frame?.resetPending && <div className="arcade-practice-reset" role="status">Resetting practice…</div>}
        {error && <p className="arcade-practice-error" role="alert">{error}</p>}
      </div>
      <ArcadePracticeControls controls={game.controls} onInput={onInput} disabled={loading || Boolean(error)} />
    </div>
    <footer className="arcade-practice-footer">
      <span>Solo practice · no bots · progress is not saved</span>
      <details><summary>Practice details</summary><span>Seed {seed || "—"} · {game.tuningVersion} · 30 simulation steps/second</span></details>
    </footer>
  </main>;
}
