"use client";

import type { DisplaySnapshot, HostAction, HostSnapshot } from "../../lib/contracts";
import styles from "./DrawGuess.module.css";

export type DrawGuessPoint = { x: number; y: number };
export type DrawGuessStroke = { color: string; width: number; points: DrawGuessPoint[] };
type Result = { outcome: "guessed" | "timeout" | "host_reveal"; artistId: string; prompt: string; drawing?: DrawGuessStroke[]; guesses: Array<{ playerId: string; text: string; correct: boolean }>; scores: Record<string, number>; winnerId: string | null };
export type DrawGuessMatch = { matchId: string; round: number; phase: "drawing" | "guessing" | "revealed"; players: string[]; artistId: string; drawing?: DrawGuessStroke[]; guessCount: number; attempt?: number; ownGuesses?: string[]; assignment?: { role: "artist" | "guesser"; prompt?: string }; submitted?: boolean; result?: Result };
type HostView = HostSnapshot | DisplaySnapshot;
type HostViewWithDrawGuess = HostView & { drawGuess?: DrawGuessMatch | null };

export function DrawGuessHost({ snapshot, remaining, act, readOnly = false }: {
  snapshot: HostViewWithDrawGuess;
  remaining: number | null;
  act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
}) {
  const match = snapshot.drawGuess;
  if (!match) return <section className={`arcade-host ${styles.stage}`} role="status"><p>Loading the drawing round…</p></section>;
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const result = match.result;
  const reveal = (snapshot.phase === "ARCADE_RESULTS" || match.phase === "revealed") && result;

  if (reveal) return <section className={`arcade-host ${styles.stage}`} aria-label="Draw and Guess results">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>DRAW &amp; GUESS · REVEAL</span><span>ROOM {snapshot.code}</span></header>
    <section className={`${styles.board} ${styles.results}`} aria-live="polite">
      <p className="arcade-kicker">{result.outcome === "guessed" ? "The room got it!" : result.outcome === "timeout" ? "Time is up!" : "Round ended by host"}</p>
      <h1>{result.outcome === "guessed" ? `${names.get(result.winnerId ?? "") ?? "A player"} guessed it` : "Drawing revealed"}</h1>
      {result.drawing && <Drawing strokes={result.drawing} label="Revealed drawing" />}
      <div className={styles.secret}><span>The secret prompt</span><strong>{result.prompt}</strong></div>
      <section className={styles.guesses} aria-label="Revealed guesses"><h2>Guesses</h2>
        {result.guesses.map((guess, index) => <p className={guess.correct ? styles.correct : ""} key={`${guess.playerId}:${index}`}><span>{names.get(guess.playerId) ?? "Player"}</span><strong>{guess.text}</strong>{guess.correct && <b>GOT IT</b>}</p>)}
        {!result.guesses.length && <p>No guesses were submitted.</p>}
      </section>
      <Scores players={players} scores={result.scores} winnerId={result.winnerId} />
      {!readOnly && <button className="arcade-action" type="button" onClick={() => void act("PLAY_AGAIN")}>Play again</button>}
      {readOnly && <p role="status">The host controls the next round.</p>}
    </section>
  </section>;

  return <section className={`arcade-host ${styles.stage}`} aria-label="Draw and Guess host screen">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>DRAW &amp; GUESS · ROUND {match.round}</span><span>ROOM {snapshot.code}</span></header>
    <section className={styles.board} aria-live="polite">
      <p className="arcade-kicker">{match.phase === "drawing" ? "Sketch time" : "Make your guess"}</p>
      <h1>{match.phase === "drawing" ? "What is the artist drawing?" : "Can you guess the picture?"}</h1>
      <p className={styles.directions}><strong>{names.get(match.artistId) ?? "The artist"}</strong> has the secret prompt. Everyone else, send a guess from your phone.</p>
      {match.phase === "guessing" && match.drawing ? <Drawing strokes={match.drawing} label="Live drawing" /> : <div className={styles.canvasPlaceholder} aria-label="The drawing will appear here once submitted"><span aria-hidden="true">✎</span><strong>{match.phase === "drawing" ? "The artist is sketching…" : "Waiting for the drawing…"}</strong></div>}
      <div className={styles.stats}><span><strong>{match.guessCount}</strong> guesses</span><span><strong>{players.length}</strong> players</span></div>
      <div className={styles.timer} role="timer" aria-label={`${remaining === null ? "Unknown" : Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}>{remaining === null ? "—" : `${Math.max(0, Math.ceil(remaining / 1000))}s`}</div>
      <p className="arcade-connection">The prompt and guesses stay private until reveal.</p>
      {!readOnly && match.phase !== "revealed" && <button className="arcade-action" type="button" disabled={snapshot.paused} onClick={() => void act("ADVANCE_DRAW_GUESS" as unknown as HostAction["type"], { matchId: match.matchId, round: match.round })}>Reveal round</button>}
    </section>
  </section>;
}

export function Drawing({ strokes, label }: { strokes: DrawGuessStroke[]; label: string }) {
  return <svg className={styles.drawing} viewBox="0 0 1000 1000" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
    <rect width="1000" height="1000" rx="24" fill="#fffdf5" />
    {strokes.map((stroke, index) => <polyline key={index} points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}

function Scores({ players, scores, winnerId }: { players: Array<{ id: string; nickname: string }>; scores: Record<string, number>; winnerId: string | null }) {
  return <div className={styles.scores} aria-label="Match scores">{players.map((player) => <p key={player.id}><span>{player.nickname}</span><strong>{scores[player.id] ?? 0}</strong>{player.id === winnerId && <b>ROUND WINNER</b>}</p>)}</div>;
}
