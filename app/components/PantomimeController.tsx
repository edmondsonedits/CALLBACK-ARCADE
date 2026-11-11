"use client";

import { useState } from "react";
import type { AudienceSnapshot, PlayerAction, PlayerSnapshot } from "../../lib/contracts";

type PhoneSnapshot = PlayerSnapshot | AudienceSnapshot;
type PantomimeAction = Extract<PlayerAction["type"], "SUBMIT_PANTOMIME_GUESS">;
type Match = NonNullable<PhoneSnapshot["pantomime"]>;

export function isPantomimePhoneSnapshot(snapshot: Pick<PhoneSnapshot, "phase" | "pantomime">): boolean {
  return snapshot.phase !== "LOBBY" && Boolean(snapshot.pantomime);
}

export function PantomimeController({ snapshot, remaining, act }: {
  snapshot: PhoneSnapshot;
  remaining: number | null;
  act: (type: PantomimeAction, payload: Record<string, unknown>) => Promise<void>;
}) {
  const match = snapshot.pantomime;
  if (!match) return <section className="arcade-phone-card pantomime-phone" role="status"><p>Loading the round…</p></section>;
  const isPlayer = snapshot.role === "player" && match.players.includes(snapshot.selfId);
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const result = match.result;

  if ((snapshot.phase === "ARCADE_RESULTS" || match.phase === "revealed") && result) return <section className="arcade-phone-card pantomime-phone" aria-live="polite">
    <p className="arcade-kicker">Pantomime · reveal</p><h1>{result.outcome === "guessed" ? `${names.get(result.winnerId ?? "") ?? "A player"} got it!` : result.outcome === "timeout" ? "Time is up!" : "The host ended the round"}</h1>
    <div className="pantomime-prompt-reveal"><span>The prompt</span><strong>{result.prompt}</strong></div>
    <p>Performed by <strong>{names.get(result.performerId) ?? "Player"}</strong></p>
    <div className="pantomime-phone-guesses" aria-label="Revealed guesses">{result.guesses.map((guess, index) => <p className={guess.correct ? "is-correct" : ""} key={`${guess.playerId}:${index}`}><span>{names.get(guess.playerId) ?? "Player"}</span><strong>{guess.text}</strong>{guess.correct && <b>GOT IT</b>}</p>)}</div>
    <div className="pantomime-scores" aria-label="Match scores">{players.map((player) => <p key={player.id}><span>{player.nickname}</span><strong>{result.scores[player.id] ?? 0}</strong></p>)}</div>
    <p role="status">The host will choose what comes next.</p>
  </section>;

  if (!isPlayer) return <section className="arcade-phone-card pantomime-phone" aria-live="polite">
    <p className="arcade-kicker">Spectator</p><h1>Pantomime is live</h1>
    <p>{match.performanceCue ? `Bot practice cue: ${match.performanceCue}` : "Watch the performance on the big screen. The prompt and guesses stay hidden until the reveal."}</p>
    <PhoneClock remaining={remaining} />
  </section>;

  const assignment = match.assignment;
  if (!assignment) return <section className="arcade-phone-card pantomime-phone" role="status"><p>Loading your role…</p></section>;
  if (assignment.role === "performer") return <section className="arcade-phone-card pantomime-phone" aria-live="polite">
    <p className="arcade-kicker">You’re up · performer</p><h1>Act it out!</h1>
    {assignment.prompt ? <div className="pantomime-private-prompt"><span>Your secret prompt</span><strong>{assignment.prompt}</strong></div> : <p role="status">Your prompt is being dealt…</p>}
    <p>Use gestures only. No talking, spelling, or pointing at letters.</p><PhoneClock remaining={remaining} />
  </section>;

  if (match.attempt > 5 || match.phase !== "acting") return <section className="arcade-phone-card pantomime-phone" role="status"><p>The room is preparing the reveal…</p></section>;
  return <section className="pantomime-guess-turn">
    {match.performanceCue && <p className="pantomime-directions"><strong>Bot practice cue:</strong> {match.performanceCue}</p>}
    {match.ownGuesses?.length ? <div className="pantomime-own-guesses" aria-label="Your private guesses"><p>YOUR GUESSES</p>{match.ownGuesses.map((guess, index) => <span key={`${index}:${guess}`}>{guess}</span>)}</div> : null}
    <GuessEntry key={`${match.matchId}:${match.round}:${match.attempt}`} match={match} remaining={remaining} act={act} />
  </section>;
}

function GuessEntry({ match, remaining, act }: { match: Match; remaining: number | null; act: (type: PantomimeAction, payload: Record<string, unknown>) => Promise<void> }) {
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = guess.trim().length > 0 && guess.trim().length <= 100;
  const submit = async () => {
    if (!valid || busy || match.attempt > 5) return;
    setBusy(true); setError("");
    try { await act("SUBMIT_PANTOMIME_GUESS", createPantomimeGuessPayload(match, guess)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your guess could not be sent. Please try again."); }
    finally { setBusy(false); }
  };
  return <section className="arcade-phone-card pantomime-phone">
    <p className="arcade-kicker">Guess {match.attempt} of 5</p><h1>What are they acting out?</h1>
    <p>Send a guess to the host. Only the performer knows the prompt.</p>
    <label htmlFor="pantomime-guess">Your guess</label>
    <input id="pantomime-guess" className="pantomime-input" type="text" autoComplete="off" maxLength={100} value={guess} disabled={busy} onChange={(event) => setGuess(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submit(); } }} />
    <span className="pantomime-count">{guess.length}/100</span>
    <button className="arcade-action" type="button" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "Sending guess…" : "Send guess"}</button>
    {error && <p role="alert">{error}</p>}<PhoneClock remaining={remaining} />
  </section>;
}

export function createPantomimeGuessPayload(match: Match, guess: string) {
  return { matchId: match.matchId, round: match.round, attempt: match.attempt, guess: guess.trim() };
}

function PhoneClock({ remaining }: { remaining: number | null }) {
  return <p className="pantomime-clock" role="timer">{remaining === null ? "Waiting for the round…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}</p>;
}
