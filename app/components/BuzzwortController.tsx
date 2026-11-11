"use client";

import { useState } from "react";
import type { AudienceSnapshot, PlayerAction, PlayerSnapshot, SnapshotBuzzwort } from "../../lib/contracts";

type PhoneSnapshot = (PlayerSnapshot | AudienceSnapshot) & { buzzwort?: SnapshotBuzzwort | null };
type BuzzwortAction = Extract<PlayerAction["type"], "SUBMIT_BUZZWORT_CLUE" | "SUBMIT_BUZZWORT_GUESS">;

export function isBuzzwortPhoneSnapshot(snapshot: Pick<PhoneSnapshot, "phase" | "buzzwort">): boolean {
  return snapshot.phase !== "LOBBY" && Boolean(snapshot.buzzwort);
}

export function createBuzzwortCluePayload(match: SnapshotBuzzwort, text: string) {
  return { matchId: match.matchId, round: match.round, attempt: match.attempt, text: text.trim() };
}

export function createBuzzwortGuessPayload(match: SnapshotBuzzwort, guess: string) {
  return { matchId: match.matchId, round: match.round, attempt: match.attempt, guess: guess.trim() };
}

export function BuzzwortController({ snapshot, remaining, act }: {
  snapshot: PhoneSnapshot;
  remaining: number | null;
  act: (type: BuzzwortAction, payload: Record<string, unknown>) => Promise<void>;
}) {
  const match = snapshot.buzzwort;
  if (!match) return <section className="arcade-phone-card buzzwort-phone" role="status"><p>Loading the match…</p></section>;
  const isPlayer = snapshot.role === "player" && match.players.includes(snapshot.selfId);
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));

  if (match.phase === "revealed" && match.result) return <section className="arcade-phone-card buzzwort-phone" aria-live="polite">
    <p className="arcade-kicker">Buzzwort · reveal</p>
    <h1 className={`buzzwort-team buzzwort-team-${match.result.winnerTeam}`}>{teamName(match.result.winnerTeam)} wins</h1>
    <p className="buzzwort-phone-card">The word was <strong>{match.result.card.word}</strong><span>Taboo: {match.result.card.tabooWords.join(" · ")}</span></p>
    <TeamScores scores={match.result.scores} />
    <div className="buzzwort-phone-log"><h2>Clue trail</h2>{match.result.clues.map((clue, index) => <p key={`${clue.attempt}:${index}`}><span>{names.get(clue.playerId) ?? "Player"}</span><strong>“{clue.text}”</strong></p>)}<h2>Guesses</h2>{match.result.guesses.map((guess, index) => <p key={`${guess.attempt}:${index}`}><span>{guess.correct ? "✓" : "×"} {names.get(guess.playerId) ?? "Player"}</span><strong>“{guess.text}”</strong></p>)}</div>
    <p role="status">The host will choose what comes next.</p>
  </section>;

  if (!isPlayer) return <section className="arcade-phone-card buzzwort-phone" aria-live="polite">
    <p className="arcade-kicker">Spectator</p><h1>Buzzwort is live</h1>
    <p>The host screen has the active clue. Watch the teams race to guess before time runs out.</p>
    {match.phase === "guess" && match.currentClue && <p className="buzzwort-phone-current">Current clue: <strong>“{match.currentClue}”</strong></p>}
    <PhoneClock remaining={remaining} />
  </section>;

  const assignment = match.assignment;
  if (!assignment) return <section className="arcade-phone-card buzzwort-phone" role="status"><p>Loading your team role…</p></section>;
  if (match.submitted && assignment.role === "clue_giver") return <section className="arcade-phone-card buzzwort-phone" aria-live="polite">
    <p className="arcade-kicker">Clue sent · {teamName(assignment.team)}</p><h1>Now watch the guesser</h1>
    {assignment.card && <BuzzwortCard card={assignment.card} />}
    <p>Your clue is live on the big screen. Keep the taboo words out of the conversation.</p><PhoneClock remaining={remaining} />
  </section>;
  if (match.submitted && assignment.role === "guesser") return <section className="arcade-phone-card buzzwort-phone" aria-live="polite">
    <p className="arcade-kicker">Guess locked · {teamName(assignment.team)}</p><h1>Wait for the result</h1>
    {match.currentClue && <p className="buzzwort-phone-current">Clue: <strong>“{match.currentClue}”</strong></p>}
    <p>Your guess has been sent to the host screen.</p><PhoneClock remaining={remaining} />
  </section>;

  if (assignment.role === "clue_giver" && match.phase === "clue" && assignment.card)
    return <BuzzwortClueForm key={`${match.matchId}:${match.round}:${match.attempt}`} match={match} assignment={assignment} remaining={remaining} act={act} />;
  if (assignment.role === "guesser" && match.phase === "guess" && match.currentClue)
    return <BuzzwortGuessForm key={`${match.matchId}:${match.round}:${match.attempt}`} match={match} assignment={assignment} remaining={remaining} act={act} />;

  return <section className="arcade-phone-card buzzwort-phone" aria-live="polite">
    <p className="arcade-kicker">{teamName(assignment.team)} team · {roleName(assignment.role)}</p>
    <h1>{match.phase === "clue" ? "Watch the clue giver" : "Listen to the clue"}</h1>
    {match.phase === "guess" && match.currentClue && <p className="buzzwort-phone-current">Current clue: <strong>“{match.currentClue}”</strong></p>}
    <p>{assignment.role === "watcher" ? "You are on the watching team. Keep an eye out for a taboo word." : "Your teammate is the designated guesser. Help them think it through."}</p>
    <PhoneClock remaining={remaining} />
  </section>;
}

function BuzzwortCard({ card }: { card: { word: string; tabooWords: string[] } }) {
  return <div className="buzzwort-secret-card"><span>Describe this word</span><strong>{card.word}</strong><div><span>Never say</span>{card.tabooWords.map((word) => <b key={word}>{word}</b>)}</div></div>;
}

function BuzzwortClueForm({ match, assignment, remaining, act }: { match: SnapshotBuzzwort; assignment: NonNullable<SnapshotBuzzwort["assignment"]>; remaining: number | null; act: (type: BuzzwortAction, payload: Record<string, unknown>) => Promise<void> }) {
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const valid = text.trim().length > 0 && text.trim().length <= 120;
  const submit = async () => { if (!valid || busy) return; setBusy(true); setError(""); try { await act("SUBMIT_BUZZWORT_CLUE", createBuzzwortCluePayload(match, text)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Your clue could not be sent. Try again."); } finally { setBusy(false); } };
  return <section className="arcade-phone-card buzzwort-phone">
    <p className="arcade-kicker">Clue giver · {teamName(assignment.team)}</p><h1>Describe it without saying it</h1>
    {assignment.card && <BuzzwortCard card={assignment.card} />}
    <label htmlFor="buzzwort-clue">Give your team a clue</label><textarea id="buzzwort-clue" className="buzzwort-input" rows={2} maxLength={120} value={text} disabled={busy} onChange={(event) => setText(event.target.value)} />
    <span className="buzzwort-count">{text.length}/120</span><button className="arcade-action" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "Sending clue…" : "Send clue"}</button>
    {error && <p role="alert">{error}</p>}<PhoneClock remaining={remaining} />
  </section>;
}

function BuzzwortGuessForm({ match, assignment, remaining, act }: { match: SnapshotBuzzwort; assignment: NonNullable<SnapshotBuzzwort["assignment"]>; remaining: number | null; act: (type: BuzzwortAction, payload: Record<string, unknown>) => Promise<void> }) {
  const [guess, setGuess] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const valid = guess.trim().length > 0 && guess.trim().length <= 120;
  const submit = async () => { if (!valid || busy) return; setBusy(true); setError(""); try { await act("SUBMIT_BUZZWORT_GUESS", createBuzzwortGuessPayload(match, guess)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Your guess could not be sent. Try again."); } finally { setBusy(false); } };
  return <section className="arcade-phone-card buzzwort-phone">
    <p className="arcade-kicker">Guesser · {teamName(assignment.team)}</p><h1>What’s the word?</h1>
    <p className="buzzwort-phone-current">Clue: <strong>“{match.currentClue}”</strong></p>
    <label htmlFor="buzzwort-guess">Your guess</label><input id="buzzwort-guess" className="buzzwort-input" maxLength={120} value={guess} disabled={busy} onChange={(event) => setGuess(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submit(); } }} />
    <span className="buzzwort-count">{guess.length}/120</span><button className="arcade-action" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "Sending guess…" : "Lock my guess"}</button>
    {error && <p role="alert">{error}</p>}<PhoneClock remaining={remaining} />
  </section>;
}

function TeamScores({ scores }: { scores: Record<"ember" | "cobalt", number> }) {
  return <div className="buzzwort-scores" aria-label="Team scores"><span className="buzzwort-team-ember">EMBER <strong>{scores.ember}</strong></span><span className="buzzwort-team-cobalt">COBALT <strong>{scores.cobalt}</strong></span></div>;
}
function PhoneClock({ remaining }: { remaining: number | null }) { return <p className="buzzwort-phone-clock" role="timer">{remaining === null ? "Waiting for the round…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}</p>; }
function teamName(team: "ember" | "cobalt") { return team === "ember" ? "Ember" : "Cobalt"; }
function roleName(role: string) { return role === "teammate" ? "teammate" : "watcher"; }
