"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { HostAction, HostSnapshot } from "../../lib/contracts";
import { randomUuid } from "../../lib/game/random";
import { Brand } from "./Brand";
import { useCountdown, useRoomSync } from "./useRoomSync";

type PaneMode = "both" | "host" | "phone";

const PHASE_LABELS: Record<string, string> = {
  LOBBY: "Lobby",
  INTRO: "Game intro",
  ROUND_INTRO: "Round intro",
  ANSWERING: "Answering",
  FINAL_ANSWERING: "Final answering",
  ANSWER_LOCK: "Answer lock",
  VOTE_LOCK: "Vote lock",
  VOTING: "Voting",
  FINAL_VOTING: "Final voting",
  REVEAL: "Reveal",
  ROUND_RESULTS: "Round results",
  FINAL_RESULTS: "Final results",
  POST_GAME: "Post game",
  ENDED: "Ended",
};

function formatTime(milliseconds: number | null) {
  if (milliseconds === null) return "No active timer";
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function TesterWorkbench({ code }: { code: string }) {
  const { snapshot: rawSnapshot, error, reconnecting, send, reset } = useRoomSync(code, "host");
  const snapshot = rawSnapshot?.role === "host" ? (rawSnapshot as HostSnapshot) : null;
  const remaining = useCountdown(snapshot);
  const [paneMode, setPaneMode] = useState<PaneMode>("both");
  const [hostKey, setHostKey] = useState(0);
  const [phoneKey, setPhoneKey] = useState(0);
  const [pending, setPending] = useState<HostAction["type"] | null>(null);
  const [localError, setLocalError] = useState("");
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const act = async (type: HostAction["type"], payload: Record<string, unknown> = {}) => {
    if (!snapshot || pending) return;
    setPending(type);
    setLocalError("");
    try {
      await send({
        type,
        actionId: randomUuid(),
        roundId: snapshot.roundId,
        expectedPhase: snapshot.phase,
        payload,
      } as HostAction);
      reset();
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "That tester control did not go through.");
    } finally {
      setPending(null);
    }
  };

  const players = snapshot?.players.filter((player) => player.role === "player") ?? [];
  const finished = snapshot ? ["FINAL_RESULTS", "POST_GAME"].includes(snapshot.phase) : false;
  const timerActive = Boolean(snapshot?.deadlineAt || snapshot?.paused);
  const canSkip = Boolean(snapshot && !["LOBBY", "POST_GAME", "ENDED"].includes(snapshot.phase));
  const phaseLabel = snapshot ? (PHASE_LABELS[snapshot.phase] ?? snapshot.phase.replaceAll("_", " ")) : "Connecting";
  const joinUrl = useMemo(() => `/play/${code}`, [code]);

  const copyJoinLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${joinUrl}`);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setLocalError("The browser could not copy the join link. Open the phone pane in a new tab instead.");
    }
  };

  if (error?.status === 401) {
    return <main className="tester-gate"><Brand /><section><p className="eyebrow">Tester workbench</p><h1>Open this from the host browser.</h1><p>This browser does not hold the host key for room {code}.</p><Link className="button button-primary" href="/developer">Create a testing room</Link></section></main>;
  }

  return (
    <main className={`tester-workbench tester-view-${paneMode}`}>
      <header className="tester-toolbar">
        <div className="tester-brand"><Brand compact /><span>TEST BENCH</span></div>
        <div className="tester-room-status" role="status">
          <span>ROOM <strong>{code}</strong></span>
          <span>{phaseLabel}</span>
          <span>{snapshot?.paused ? "Paused" : formatTime(remaining)}</span>
          <span className={reconnecting || error ? "is-offline" : "is-live"}>{reconnecting ? "Reconnecting" : error ? "Needs attention" : snapshot ? "Live" : "Connecting"}</span>
        </div>
        <nav className="tester-view-switch" aria-label="Preview layout">
          {(["both", "host", "phone"] as const).map((mode) => <button key={mode} type="button" aria-pressed={paneMode === mode} onClick={() => setPaneMode(mode)}>{mode === "both" ? "Both" : mode === "host" ? "Host" : "Phone"}</button>)}
        </nav>
        <Link className="tester-exit" href="/developer">New room</Link>
      </header>

      <section className="tester-controls" aria-label="Authoritative tester controls">
        {snapshot?.phase === "LOBBY" && <button className="tester-primary" disabled={Boolean(pending)} onClick={() => void act("START_GAME")}>▶ Start game</button>}
        {finished && <button className="tester-primary" disabled={Boolean(pending)} onClick={() => void act("PLAY_AGAIN")}>↶ Play again</button>}
        <button disabled={!timerActive || Boolean(pending)} onClick={() => void act(snapshot?.paused ? "RESUME" : "PAUSE")}>{snapshot?.paused ? "▶ Resume" : "Ⅱ Pause"}</button>
        <button disabled={!timerActive || Boolean(pending)} onClick={() => void act("ADD_TIME", { seconds: 15 })}>+15 sec</button>
        <button disabled={!timerActive || Boolean(pending)} onClick={() => void act("ADD_TIME", { seconds: 60 })}>+60 sec</button>
        <button disabled={!canSkip || Boolean(pending)} onClick={() => void act("SKIP")}>Skip phase →</button>
        {snapshot?.phase === "LOBBY" && snapshot.gameLength !== "bowl" && <button disabled={players.length >= 10 || Boolean(pending)} onClick={() => void act("ADD_BOT")}>+ Test bot</button>}
        <button disabled={!snapshot || Boolean(pending)} onClick={() => void act("LOCK_JOINING", { locked: !snapshot?.joiningLocked })}>{snapshot?.joiningLocked ? "Unlock joining" : "Lock joining"}</button>
        {snapshot?.bowl && <button disabled={!snapshot.bowl.lastCorrectUndoAvailable || Boolean(pending)} onClick={() => void act("UNDO_BOWL_CORRECT")}>Undo Correct</button>}
        <button onClick={() => { setHostKey((value) => value + 1); setPhoneKey((value) => value + 1); reset(); }}>↻ Refresh panes</button>
        <button onClick={() => void copyJoinLink()}>{copied ? "Copied" : "Copy join link"}</button>
        <details className="tester-danger">
          <summary>More</summary>
          <button disabled={!snapshot || snapshot.phase === "ENDED" || Boolean(pending)} onClick={() => { if (window.confirm("End this testing game for every connected screen?")) void act("END_GAME"); }}>End game</button>
        </details>
      </section>

      {(localError || (error && error.status !== 401)) && <div className="tester-error" role="alert">{localError || error?.message}</div>}
      {snapshot?.gameLength === "bowl" && players.length < 4 && <div className="tester-note" role="status"><strong>Bowl needs four human players.</strong> The phone pane is your first seat; copy the join link for three more devices or private browser windows.</div>}

      <section className="tester-stage" aria-label="Host and phone previews">
        <article className="tester-pane tester-host-pane">
          <header><div><span>HOST SCREEN</span><small>16:9 television preview</small></div><a href={`/host/${code}`} target="_blank" rel="noreferrer">Open full size ↗</a></header>
          <div className="tester-host-frame"><iframe key={`host-${hostKey}`} title={`Host screen for room ${code}`} src={`/host/${code}?tester=1`} allow="autoplay; fullscreen" /></div>
        </article>
        <article className="tester-pane tester-phone-pane">
          <header><div><span>PHONE CONTROLLER</span><small>390px-wide live preview</small></div><a href={joinUrl} target="_blank" rel="noreferrer">Open separately ↗</a></header>
          <div className="tester-phone-frame"><iframe key={`phone-${phoneKey}`} title={`Phone controller for room ${code}`} src={`${joinUrl}?tester=1`} allow="camera; microphone" /></div>
        </article>
      </section>
    </main>
  );
}
