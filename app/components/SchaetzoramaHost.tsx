"use client";

import { useEffect, useRef, useState } from "react";
import type { DisplaySnapshot, HostAction, HostSnapshot, SnapshotSchaetzorama } from "../../lib/contracts";

type HostView = HostSnapshot | DisplaySnapshot;

export function SchaetzoramaHost({ snapshot, remaining, act, readOnly = false }: {
  snapshot: HostView;
  remaining: number | null;
  act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
}) {
  const match = snapshot.schaetzorama;
  const actRef = useRef(act);
  const dispatchedRef = useRef("");
  const [actionError, setActionError] = useState("");
  const [automaticPending, setAutomaticPending] = useState(false);
  useEffect(() => { actRef.current = act; }, [act]);

  const deadlineKey = match ? `${match.matchId}:${match.round}` : "";
  useEffect(() => {
    if (!shouldAutoRevealSchaetzorama({ readOnly, paused: snapshot.paused, roomPhase: snapshot.phase, matchPhase: match?.phase, remaining }) || !match || dispatchedRef.current === deadlineKey) return;
    dispatchedRef.current = deadlineKey;
    setAutomaticPending(true);
    void actRef.current("ADVANCE_ARCADE", { matchId: match.matchId, round: match.round, transition: "reveal" }).catch(() => {
      setActionError("The round could not reveal automatically. Use Reveal round to retry.");
    }).finally(() => setAutomaticPending(false));
  }, [deadlineKey, match, readOnly, remaining, snapshot.paused, snapshot.phase]);

  if (!match) return <section className="schaetzorama-host" role="status"><p>Loading the match…</p></section>;
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const scoreRows = players
    .map((player) => ({ id: player.id, name: player.nickname, score: Number(match.scores[player.id] ?? 0) }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  if (snapshot.phase === "ARCADE_RESULTS" || match.phase === "completed") {
    const winnerIds = serverSchaetzoramaWinners(snapshot.arcade?.result);
    const champions = scoreRows.filter((player) => winnerIds.includes(player.id));
    return <section className="arcade-host schaetzorama-stage" aria-label="Schaetzorama final results">
      <header className="arcade-topbar"><span>KING PROMPTER</span><span>SCHÄTZORAMA · FINAL RESULTS</span><span>ROOM {snapshot.code}</span></header>
      <section className="arcade-host-card schaetzorama-card arcade-results">
        <p className="arcade-kicker">Match complete · {match.roundCount} rounds</p>
        <h1>Final results</h1>
        <p>{champions.length ? `${champions.map((player) => player.name).join(" & ")} ${champions.length === 1 ? "takes" : "share"} the Crown.` : "The match is complete."}</p>
        <ScoreRows rows={scoreRows} winners={champions.map((player) => player.id)} />
        {!readOnly && <button className="arcade-action" disabled={snapshot.paused} onClick={() => void act("PLAY_AGAIN")}>Play again</button>}
        {readOnly && <p className="arcade-connection" role="status">The host controls the next match.</p>}
      </section>
    </section>;
  }

  const revealed = match.phase === "revealing";
  return <section className="arcade-host schaetzorama-stage" aria-label="Schaetzorama host screen">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>SCHÄTZORAMA · ROUND {match.round} OF {match.roundCount}</span><span>ROOM {snapshot.code}</span></header>
    <section className="schaetzorama-board" aria-live="polite">
      <div className="schaetzorama-board-head"><p className="arcade-kicker">{revealed ? "Answer revealed" : "Make your estimate"}</p><span className="schaetzorama-round">{match.round} / {match.roundCount}</span></div>
      <h1>{match.question}</h1>
      <p className="schaetzorama-range">Between <strong>{match.min.toLocaleString()}</strong> and <strong>{match.max.toLocaleString()}</strong> {match.unit}</p>
      {revealed ? <>
        <div className="schaetzorama-answer"><span>The answer</span><strong>{match.answer?.toLocaleString() ?? "—"}</strong><em>{match.unit}</em></div>
        <h2>Estimates</h2>
        <div className="schaetzorama-estimates" aria-label="Revealed estimates">
          {match.estimates.map((estimate) => <div className="schaetzorama-estimate" key={estimate.playerId}>
            <span>{names.get(estimate.playerId) ?? "Player"}</span><strong>{estimate.estimate.toLocaleString()}</strong>
            {match.winners.includes(estimate.playerId) && <b>ROUND WINNER</b>}
          </div>)}
          {!match.estimates.length && <p>No estimates were submitted this round.</p>}
        </div>
        {!readOnly && <button className="arcade-action" disabled={snapshot.paused} onClick={() => void act("ADVANCE_ARCADE", { matchId: match.matchId, round: match.round, transition: "advance" })}>
          {match.round >= match.roundCount ? "Finish match" : "Next question"}
        </button>}
        {readOnly && <p className="arcade-connection" role="status">Waiting for the host to continue.</p>}
      </> : <>
        <div className="schaetzorama-waiting"><strong>{remaining === null ? "—" : `${Math.ceil(remaining / 1000)}s`}</strong><span>Time left</span></div>
        <p className="schaetzorama-wait-copy" role="status">Players are entering estimates on their phones. Guesses stay secret until the round reveals.</p>
        {!readOnly && <button className="arcade-action" disabled={automaticPending || !canManuallyRevealSchaetzorama({ paused: snapshot.paused, remaining, readOnly })} onClick={() => void act("ADVANCE_ARCADE", { matchId: match.matchId, round: match.round, transition: "reveal" })}>{automaticPending ? "Revealing…" : actionError ? "Retry reveal" : "Reveal round"}</button>}
      </>}
      {actionError && !readOnly && <p className="schaetzorama-action-error" role="alert">{actionError}</p>}
    </section>
    <footer className="schaetzorama-host-scores"><ScoreRows rows={scoreRows} winners={[]} compact /></footer>
  </section>;
}

function ScoreRows({ rows, winners, compact = false }: { rows: Array<{ id: string; name: string; score: number }>; winners: string[]; compact?: boolean }) {
  return <div className={`schaetzorama-scores ${compact ? "schaetzorama-scores-compact" : ""}`} aria-label="Match scores">
    {rows.map((player) => <div className="schaetzorama-score" key={player.id}>
      <span>{player.name}</span><strong>{player.score}</strong>{winners.includes(player.id) && <b>WINNER</b>}
    </div>)}
  </div>;
}

export type { SnapshotSchaetzorama };

export function shouldAutoRevealSchaetzorama(input: { readOnly: boolean; paused: boolean; roomPhase: string; matchPhase?: string; remaining: number | null }) {
  return !input.readOnly && !input.paused && input.roomPhase === "ARCADE_ACTIVE" && input.matchPhase === "estimating" && input.remaining !== null && input.remaining <= 0;
}

export function canManuallyRevealSchaetzorama(input: { readOnly: boolean; paused: boolean; remaining: number | null }) {
  return !input.readOnly && !input.paused && input.remaining !== null && input.remaining <= 0;
}

function serverSchaetzoramaWinners(result: unknown): string[] {
  if (!result || typeof result !== "object" || !Array.isArray((result as { winners?: unknown }).winners)) return [];
  return (result as { winners: unknown[] }).winners.filter((id): id is string => typeof id === "string");
}
