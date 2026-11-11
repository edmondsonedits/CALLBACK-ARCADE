"use client";

import type { DisplaySnapshot, HostAction, HostSnapshot } from "../../lib/contracts";

type HostView = HostSnapshot | DisplaySnapshot;

export function PantomimeHost({ snapshot, remaining, act, readOnly = false }: {
  snapshot: HostView;
  remaining: number | null;
  act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
}) {
  const match = snapshot.pantomime;
  if (!match) return <section className="arcade-host pantomime-stage" role="status"><p>Loading the round…</p></section>;

  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const result = match.result;
  const isResults = snapshot.phase === "ARCADE_RESULTS" || match.phase === "revealed";
  if (isResults && result) return <section className="arcade-host pantomime-stage" aria-label="Pantomime results">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>PANTOMIME · REVEAL</span><span>ROOM {snapshot.code}</span></header>
    <section className="pantomime-board pantomime-reveal" aria-live="polite">
      <p className="arcade-kicker">{result.outcome === "guessed" ? "The room got it!" : result.outcome === "timeout" ? "Time is up!" : "Round ended by host"}</p>
      <h1>{result.outcome === "guessed" ? `${names.get(result.winnerId ?? "") ?? "A player"} guessed it` : result.outcome === "timeout" ? "The mime ran out of time" : "The host ended the round"}</h1>
      <div className="pantomime-prompt-reveal"><span>The prompt</span><strong>{result.prompt}</strong></div>
      <p className="pantomime-performer">Performed by <strong>{names.get(result.performerId) ?? "Player"}</strong></p>
      <section className="pantomime-guess-list" aria-label="Revealed guesses"><h2>Guesses</h2>
        {result.guesses.map((guess, index) => <p className={guess.correct ? "is-correct" : ""} key={`${guess.playerId}:${index}`}><span>{names.get(guess.playerId) ?? "Player"}</span><strong>{guess.text}</strong>{guess.correct && <b>GOT IT</b>}</p>)}
        {!result.guesses.length && <p>No guesses were submitted.</p>}
      </section>
      <ScoreRows players={players} scores={result.scores} winnerId={result.winnerId} />
      {!readOnly && <button className="arcade-action" type="button" onClick={() => void act("PLAY_AGAIN")}>Play again</button>}
      {readOnly && <p className="arcade-connection" role="status">The host controls the next round.</p>}
    </section>
  </section>;

  return <section className="arcade-host pantomime-stage" aria-label="Pantomime host screen">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>PANTOMIME · ROUND {match.round}</span><span>ROOM {snapshot.code}</span></header>
    <section className="pantomime-board" aria-live="polite">
      <p className="arcade-kicker">{match.phase === "acting" ? "No words. All drama." : "Round revealed"}</p>
      {match.phase === "acting" ? <>
        <h1>Can the room guess what’s being acted out?</h1>
        <p className="pantomime-directions"><strong>{names.get(match.performerId) ?? "The performer"}</strong> is acting. Everyone else, send a guess from your phone.</p>
        {match.performanceCue && <p className="pantomime-directions"><strong>Bot practice cue:</strong> {match.performanceCue}</p>}
        <div className="pantomime-stage-mark" aria-hidden="true">🎭</div>
        <div className="pantomime-live-stats"><span><strong>{match.guessCount}</strong> guesses</span><span><strong>{match.attempt}</strong> of 5 attempts</span></div>
        <div className="pantomime-timer" role="timer" aria-label={`${remaining === null ? "Unknown" : Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}>{remaining === null ? "—" : `${Math.max(0, Math.ceil(remaining / 1000))}s`}</div>
        <p className="arcade-connection" role="status">Guesses and the secret prompt stay private until the reveal.</p>
        {!readOnly && <button className="arcade-action" type="button" disabled={snapshot.paused} onClick={() => void act("ADVANCE_PANTOMIME", { matchId: match.matchId, round: match.round })}>Reveal round</button>}
      </> : <>
        <h1>Round complete</h1><p>The reveal is syncing to the host screen.</p>
      </>}
    </section>
  </section>;
}

function ScoreRows({ players, scores, winnerId }: { players: Array<{ id: string; nickname: string }>; scores: Record<string, number>; winnerId: string | null }) {
  return <div className="pantomime-scores" aria-label="Match scores">
    {[...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || a.nickname.localeCompare(b.nickname)).map((player) => <p key={player.id}>
      <span>{player.nickname}</span><strong>{scores[player.id] ?? 0}</strong>{player.id === winnerId && <b>ROUND WINNER</b>}
    </p>)}
  </div>;
}
