"use client";

import type { HostAction, HostSnapshot, DisplaySnapshot } from "../../lib/contracts";

type HostView = HostSnapshot | DisplaySnapshot;
type ImposterResult = NonNullable<NonNullable<HostView["imposter"]>["result"]>;

export function ImposterHost({ snapshot, remaining, act, readOnly = false }: {
  snapshot: HostView;
  remaining: number | null;
  act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
}) {
  const match = snapshot.imposter;
  if (!match) return <section className="arcade-host imposter-stage" role="status"><p>Loading the match…</p></section>;
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const result = match.result;

  if (snapshot.phase === "ARCADE_RESULTS" || match.phase === "revealed") return <section className="arcade-host imposter-stage" aria-label="Imposter results">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>IMPOSTER · REVEAL</span><span>ROOM {snapshot.code}</span></header>
    <section className="imposter-board imposter-reveal" aria-live="polite">
      <p className="arcade-kicker">The room has voted</p>
      <h1>{result?.winner === "civilians" ? "Imposter found!" : "The imposter got away!"}</h1>
      <p className="imposter-secret">The word was <strong>{result?.word ?? "—"}</strong><span>{result?.category}</span></p>
      <div className="imposter-reveal-grid">
        <div><h2>Who was who</h2>{(result?.roles ?? []).map((role) => <p className="imposter-person" key={role.playerId}><span>{names.get(role.playerId) ?? "Player"}</span><strong>{role.role === "imposter" ? "IMPOSTER" : "CIVILIAN"}</strong></p>)}</div>
        <div><h2>Clues & votes</h2>{(result?.clues ?? []).map((clue) => <p className="imposter-person" key={clue.playerId}><span>{names.get(clue.playerId) ?? "Player"}: “{clue.clue}”</span><strong>{result?.voteCounts[clue.playerId] ?? 0} votes</strong></p>)}</div>
      </div>
      {!readOnly && <button className="arcade-action" onClick={() => void act("PLAY_AGAIN")}>Play again</button>}
      {readOnly && <p className="arcade-connection" role="status">The host controls the next match.</p>}
    </section>
  </section>;

  const isVoting = match.phase === "voting";
  return <section className="arcade-host imposter-stage" aria-label="Imposter host screen">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>IMPOSTER · {isVoting ? "DISCUSS & VOTE" : "SECRET CLUES"}</span><span>ROOM {snapshot.code}</span></header>
    <section className="imposter-board" aria-live="polite">
      <p className="arcade-kicker">{isVoting ? "Everyone has given a clue" : "One of you is the imposter"}</p>
      <h1>{isVoting ? "Who doesn’t know the word?" : "Give a clue. Find the imposter."}</h1>
      <p>{isVoting ? "Read the clues, talk it out, then vote on your phone." : "Players see their secret word on their phones. The imposter only sees its category."}</p>
      {isVoting && <div className="imposter-clues" aria-label="Player clues">{match.clues.map((clue) => <article className="imposter-clue" key={clue.playerId}><span>{names.get(clue.playerId) ?? "Player"}</span><strong>“{clue.clue}”</strong></article>)}</div>}
      <div className="imposter-progress"><strong>{isVoting ? match.voteCount : match.clueCount}</strong><span> / {players.length} {isVoting ? "votes" : "clues"} locked</span></div>
      <div className="imposter-timer" role="timer" aria-label={`${remaining === null ? "Unknown" : Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}>{remaining === null ? "—" : `${Math.max(0, Math.ceil(remaining / 1000))}s`}</div>
      <p className="arcade-connection" role="status">{isVoting ? "Votes stay secret until the reveal." : "Clues stay hidden until discussion starts."}</p>
    </section>
  </section>;
}

export type { ImposterResult };
