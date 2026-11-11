"use client";

import { useState } from "react";
import type { AudienceSnapshot, PlayerAction, PlayerSnapshot, SnapshotBase } from "../../lib/contracts";

type PhoneSnapshot = PlayerSnapshot | AudienceSnapshot;
type ImposterPhoneMatch = NonNullable<SnapshotBase["imposter"]>;

export function isImposterPhoneSnapshot(snapshot: Pick<SnapshotBase, "phase" | "imposter">): boolean {
  return snapshot.phase !== "LOBBY" && Boolean(snapshot.imposter);
}

export function createImposterCluePayload(match: ImposterPhoneMatch, clue: string) {
  return { matchId: match.matchId, round: match.round, clue: clue.trim() };
}

export function createImposterVotePayload(match: ImposterPhoneMatch, targetPlayerId: string) {
  return { matchId: match.matchId, round: match.round, targetPlayerId };
}

export function ImposterController({ snapshot, remaining, act }: {
  snapshot: PhoneSnapshot;
  remaining: number | null;
  act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void>;
}) {
  const match = snapshot.imposter;
  if (!match) return <section className="arcade-phone-card imposter-phone" role="status"><p>Loading the match…</p></section>;
  const isPlayer = snapshot.role === "player" && match.players.includes(snapshot.selfId);
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));

  if (match.phase === "revealed") return <section className="arcade-phone-card imposter-phone" aria-live="polite">
    <p className="arcade-kicker">The reveal</p>
    <h1>{match.result?.winner === "civilians" ? "Imposter found!" : "The imposter got away!"}</h1>
    <p className="imposter-phone-secret">The word was <strong>{match.result?.word ?? "—"}</strong><span>{match.result?.category}</span></p>
    {match.result?.roles.map((entry) => <div className="imposter-phone-row" key={entry.playerId}><span>{names.get(entry.playerId) ?? "Player"}</span><strong>{entry.role === "imposter" ? "IMPOSTER" : "CIVILIAN"}</strong></div>)}
    <p role="status">The host can start another match from the big screen.</p>
  </section>;

  if (!isPlayer) return <section className="arcade-phone-card imposter-phone" aria-live="polite">
    <p className="arcade-kicker">Spectator</p><h1>Find the imposter</h1>
    <p>Players are sharing clues and deciding who to trust. Roles and the secret word will be revealed after the vote.</p>
    {match.phase === "voting" && <ImposterClueList clues={match.clues} names={names} />}
    <p role="status">{remaining === null ? "Waiting for the room…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}</p>
  </section>;

  if (match.phase === "cluing" && match.assignment) {
    if (match.submitted) return <section className="arcade-phone-card imposter-phone" aria-live="polite">
      <p className="arcade-kicker">Clue locked</p><h1>Blend in</h1>
      <p>Your clue: <strong>“{match.ownClue}”</strong></p><p>Your role stays private. Clues appear when everyone is ready.</p>
      <ImposterAssignment assignment={match.assignment} />
      <ImposterClock remaining={remaining} />
    </section>;
    return <ImposterClueEntry key={`${match.matchId}:${match.round}`} match={match} remaining={remaining} act={act} />;
  }

  if (match.phase === "voting") {
    if (match.submitted) return <section className="arcade-phone-card imposter-phone" aria-live="polite"><p className="arcade-kicker">Vote locked</p><h1>Wait for the reveal</h1><ImposterClueList clues={match.clues} names={names} /><ImposterClock remaining={remaining} /></section>;
    return <ImposterVoteEntry key={`${match.matchId}:${match.round}`} match={match} selfId={snapshot.selfId} names={names} clues={match.clues} remaining={remaining} act={act} />;
  }
  return <section className="arcade-phone-card imposter-phone" role="status"><p>Loading your role…</p></section>;
}

function ImposterAssignment({ assignment }: { assignment: NonNullable<ImposterPhoneMatch["assignment"]> }) {
  return <div className="imposter-assignment"><span>Your role · {assignment.role === "imposter" ? "IMPOSTER" : "CIVILIAN"}</span><strong>{assignment.role === "imposter" ? "You don’t know the word" : assignment.word}</strong><small>Category: {assignment.category}</small></div>;
}

function ImposterClueEntry({ match, remaining, act }: { match: ImposterPhoneMatch; remaining: number | null; act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void> }) {
  const [clue, setClue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const assignment = match.assignment;
  const valid = clue.trim().length > 0 && clue.trim().length <= 80;
  const submit = async () => {
    if (!valid || busy || match.phase !== "cluing") return;
    setBusy(true); setError("");
    try { await act("SUBMIT_IMPOSTER_CLUE", createImposterCluePayload(match, clue)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your clue could not be sent. Try again."); }
    finally { setBusy(false); }
  };
  return <section className="arcade-phone-card imposter-phone">
    <p className="arcade-kicker">Secret clue · round {match.round}</p><h1>Give one clue</h1>
    {assignment && <ImposterAssignment assignment={assignment} />}
    <p>Write one short clue that fits the word. Don’t say the word itself.</p>
    <label htmlFor="imposter-clue">Your clue</label>
    <textarea id="imposter-clue" className="imposter-input" rows={3} maxLength={80} value={clue} disabled={busy} onChange={(event) => setClue(event.target.value)} />
    <span className="imposter-char-count">{clue.length}/80</span>
    <button className="arcade-action" type="button" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "Locking clue…" : "Lock my clue"}</button>
    {error && <p role="alert">{error}</p>}
    <ImposterClock remaining={remaining} />
  </section>;
}

function ImposterVoteEntry({ match, selfId, names, clues, remaining, act }: { match: ImposterPhoneMatch; selfId: string; names: Map<string, string>; clues: ImposterPhoneMatch["clues"]; remaining: number | null; act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void> }) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligible = match.players.filter((id) => id !== selfId);
  const submit = async () => {
    if (!target || !eligible.includes(target) || busy) return;
    setBusy(true); setError("");
    try { await act("SUBMIT_IMPOSTER_VOTE", createImposterVotePayload(match, target)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your vote could not be sent. Try again."); }
    finally { setBusy(false); }
  };
  return <section className="arcade-phone-card imposter-phone">
    <p className="arcade-kicker">Discussion & vote</p><h1>Who is the imposter?</h1>
    <ImposterClueList clues={clues} names={names} />
    <label htmlFor="imposter-vote">Choose one player</label>
    <select id="imposter-vote" className="imposter-input" value={target} disabled={busy} onChange={(event) => setTarget(event.target.value)}>
      <option value="">Select a player</option>{eligible.map((id) => <option key={id} value={id}>{names.get(id) ?? "Player"}</option>)}
    </select>
    <button className="arcade-action" type="button" disabled={!target || busy} onClick={() => void submit()}>{busy ? "Locking vote…" : "Lock my vote"}</button>
    {error && <p role="alert">{error}</p>}
    <ImposterClock remaining={remaining} />
  </section>;
}

function ImposterClueList({ clues, names }: { clues: ImposterPhoneMatch["clues"]; names: Map<string, string> }) {
  return <div className="imposter-phone-clues" aria-label="Player clues">{clues.map((clue) => <div key={clue.playerId}><span>{names.get(clue.playerId) ?? "Player"}</span><strong>“{clue.clue}”</strong></div>)}</div>;
}

function ImposterClock({ remaining }: { remaining: number | null }) {
  return <p className="imposter-clock" role="timer">{remaining === null ? "Waiting for the room…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}</p>;
}
