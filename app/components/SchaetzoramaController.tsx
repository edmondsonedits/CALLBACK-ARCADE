"use client";

import { useState } from "react";
import type { AudienceSnapshot, PlayerAction, PlayerSnapshot, SnapshotBase, SnapshotSchaetzorama } from "../../lib/contracts";

type PhoneSnapshot = PlayerSnapshot | AudienceSnapshot;

export function isSchaetzoramaPhoneSnapshot(snapshot: Pick<SnapshotBase, "phase" | "schaetzorama">): boolean {
  return snapshot.phase !== "LOBBY" && Boolean(snapshot.schaetzorama);
}

export function SchaetzoramaController({ snapshot, remaining, act }: {
  snapshot: PhoneSnapshot;
  remaining: number | null;
  act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void>;
}) {
  const match = snapshot.schaetzorama;
  if (!match) return <section className="arcade-phone-card schaetzorama-phone" role="status"><p>Loading the question…</p></section>;
  const isPlayer = snapshot.role === "player";
  const isResults = snapshot.phase === "ARCADE_RESULTS" || match.phase === "completed";
  const revealed = match.phase === "revealing" || match.phase === "completed";
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));

  if (isResults) {
    const scoreRows = players.map((player) => ({ id: player.id, name: player.nickname, score: Number(match.scores[player.id] ?? 0) })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const winnerIds = serverSchaetzoramaWinners(snapshot.arcade?.result);
    const champions = scoreRows.filter((player) => winnerIds.includes(player.id));
    return <section className="arcade-phone-card schaetzorama-phone schaetzorama-phone-results" aria-live="polite">
      <p className="arcade-kicker">Final results</p><h1>{champions.map((player) => player.name).join(" & ") || "Match complete"}</h1>
      <p>{champions.length === 1 ? "takes the Crown" : "share the Crown"}</p>
      <div className="schaetzorama-scores" aria-label="Match scores">{scoreRows.map((player) => <div className="schaetzorama-score" key={player.id}><span>{player.name}</span><strong>{player.score}</strong></div>)}</div>
      <p role="status">The host can start another match from the big screen.</p>
    </section>;
  }

  if (revealed) return <section className="arcade-phone-card schaetzorama-phone" aria-live="polite">
    <p className="arcade-kicker">Round {match.round} revealed</p><h1>{match.question}</h1>
    <div className="schaetzorama-answer"><span>The answer</span><strong>{match.answer?.toLocaleString() ?? "—"}</strong><em>{match.unit}</em></div>
    <p className="schaetzorama-own-estimate">Your estimate: <strong>{match.estimate?.toLocaleString() ?? "Not submitted"}</strong></p>
    <div className="schaetzorama-phone-estimates">{match.estimates.map((row) => <div key={row.playerId}><span>{names.get(row.playerId) ?? "Player"}</span><strong>{row.estimate.toLocaleString()}</strong>{match.winners.includes(row.playerId) && <b>WINNER</b>}</div>)}</div>
    <p role="status">The host will move to the next question.</p>
  </section>;

  if (!isPlayer) return <section className="arcade-phone-card schaetzorama-phone" aria-live="polite">
    <p className="arcade-kicker">Spectator</p><h1>{match.question}</h1>
    <p>Players are entering private estimates. The answer and guesses appear after the reveal.</p>
    <p role="status">{remaining === null ? "Waiting for the round…" : `${Math.ceil(remaining / 1000)} seconds remaining`}</p>
  </section>;

  if (match.submitted) return <section className="arcade-phone-card schaetzorama-phone" aria-live="polite">
    <p className="arcade-kicker">Round {match.round} of {match.roundCount}</p><h1>Estimate locked</h1>
    <p className="schaetzorama-own-estimate">Your estimate is locked: <strong>{match.estimate?.toLocaleString() ?? "—"} {match.unit}</strong></p>
    <p>Other guesses stay secret until everyone has finished or time runs out.</p>
    <p role="status">{remaining === null ? "Waiting for the reveal…" : `${Math.ceil(remaining / 1000)} seconds remaining`}</p>
  </section>;

  return <SchaetzoramaEstimateEntry key={schaetzoramaEstimateInputKey(match)} match={match} remaining={remaining} act={act} />;
}

function SchaetzoramaEstimateEntry({ match, remaining, act }: { match: SnapshotSchaetzorama; remaining: number | null; act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void> }) {
  const [estimate, setEstimate] = useState(match.estimate === undefined ? "" : String(match.estimate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const parsed = estimate.trim() === "" ? NaN : Number(estimate);
  const valid = Number.isSafeInteger(parsed) && parsed >= match.min && parsed <= match.max;
  const submit = async () => {
    if (!valid || busy || match.submitted || match.phase !== "estimating") return;
    setBusy(true);
    setError("");
    try {
      await act("SUBMIT_SCHAETZORAMA_ESTIMATE", createSchaetzoramaEstimatePayload(match, parsed));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your estimate could not be sent. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return <section className="arcade-phone-card schaetzorama-phone">
    <p className="arcade-kicker">Round {match.round} of {match.roundCount}</p><h1>{match.question}</h1>
    <p>Enter a whole number from <strong>{match.min.toLocaleString()}</strong> to <strong>{match.max.toLocaleString()}</strong> {match.unit}.</p>
    <label className="schaetzorama-estimate-label" htmlFor="schaetzorama-estimate">Your estimate <span>({match.unit})</span></label>
    <input id="schaetzorama-estimate" className="schaetzorama-estimate-input" type="number" inputMode="numeric" step="1" min={match.min} max={match.max} value={estimate} disabled={busy || match.phase !== "estimating"} aria-describedby="schaetzorama-range schaetzorama-time" onChange={(event) => setEstimate(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submit(); } }} />
    <p id="schaetzorama-range" className="schaetzorama-range-note">Whole numbers only · {match.min.toLocaleString()}–{match.max.toLocaleString()}</p>
    <button className="arcade-action" type="button" disabled={!valid || busy || match.phase !== "estimating"} onClick={() => void submit()}>{busy ? "Locking estimate…" : "Lock in estimate"}</button>
    <p id="schaetzorama-time" role="status">{remaining === null ? "Waiting for the timer…" : `${Math.ceil(remaining / 1000)} seconds left`}</p>
    {error && <p className="schaetzorama-action-error" role="alert">{error}</p>}
  </section>;
}

export function createSchaetzoramaEstimatePayload(match: SnapshotSchaetzorama, estimate: number) {
  return { matchId: match.matchId, estimate, round: match.round };
}

export function schaetzoramaEstimateInputKey(match: SnapshotSchaetzorama) {
  return `${match.matchId}:${match.round}`;
}

function serverSchaetzoramaWinners(result: unknown): string[] {
  if (!result || typeof result !== "object" || !Array.isArray((result as { winners?: unknown }).winners)) return [];
  return (result as { winners: unknown[] }).winners.filter((id): id is string => typeof id === "string");
}
