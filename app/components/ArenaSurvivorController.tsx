"use client";

import { useState } from "react";
import type { AudienceSnapshot, PlayerAction, PlayerSnapshot } from "../../lib/contracts";
import type { ArenaSurvivorMatch } from "./ArenaSurvivorHost";
import styles from "./ArenaSurvivor.module.css";

type PhoneView = PlayerSnapshot | AudienceSnapshot;

export function isArenaSurvivorPhoneSnapshot(snapshot: Pick<PhoneView, "phase" | "arenaSurvivor">): boolean {
  return snapshot.phase !== "LOBBY" && Boolean(snapshot.arenaSurvivor);
}

export function createArenaSurvivorChoicePayload(match: Pick<ArenaSurvivorMatch, "matchId" | "round">, choiceId: string) {
  return { matchId: match.matchId, round: match.round, choiceId };
}

export function ArenaSurvivorController({ snapshot, remaining, act }: {
  snapshot: PhoneView;
  remaining: number | null;
  act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void>;
}) {
  const match = snapshot.arenaSurvivor;
  if (!match) return <section className={`arcade-phone-card ${styles.phone}`} role="status"><p>Loading the scenario…</p></section>;
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const isPlayer = snapshot.role === "player" && match.players.includes(snapshot.selfId);
  const result = match.result;

  if (match.phase === "revealed" && result) return <section className={`arcade-phone-card ${styles.phone} ${styles.reveal}`} aria-live="polite">
    <p className="arcade-kicker">Arena Survivor · reveal</p>
    <h1>{result.winners.length ? `${result.winners.map((id) => names.get(id) ?? "Player").join(" & ")} survived` : "No one survived this round"}</h1>
    <div className={styles.scenarioCard}><span>THE SCENARIO</span><h2>{result.scenario.title}</h2><p>{result.scenario.description}</p></div>
    <div className={styles.answerReveal}><span>The best choice</span><strong>{result.scenario.choices.find((choice) => choice.id === result.correctChoiceId)?.text ?? "Answer unavailable"}</strong><p>{result.explanation}</p></div>
    <div className={styles.scores} aria-label="Match scores">{players.map((player) => <p key={player.id}><span>{player.nickname}</span><strong>{result.scores[player.id] ?? 0}</strong>{result.winners.includes(player.id) && <b>SURVIVED</b>}</p>)}</div>
    <p role="status">The host can start another round from the big screen.</p>
  </section>;

  if (!isPlayer) return <section className={`arcade-phone-card ${styles.phone}`} aria-live="polite">
    <p className="arcade-kicker">Spectator</p><h1>Survive the scenario</h1>
    <div className={styles.scenarioCard}><span>THE SCENARIO</span><h2>{match.scenario.title}</h2><p>{match.scenario.description}</p></div>
    <p>Players are choosing their strategy. The best answer stays hidden until the reveal.</p>
    <PhoneClock remaining={remaining} />
  </section>;

  if (match.phase !== "answering") return <section className={`arcade-phone-card ${styles.phone}`} role="status"><p>The room is preparing the reveal…</p></section>;
  if (match.submitted) return <section className={`arcade-phone-card ${styles.phone}`} aria-live="polite">
    <p className="arcade-kicker">Choice locked</p><h1>Hold your ground</h1>
    <div className={styles.lockedChoice}><span>Your choice</span><strong>{match.scenario.choices.find((choice) => choice.id === match.ownChoiceId)?.text ?? "Choice submitted"}</strong></div>
    <p>The outcome stays hidden until the host reveals it.</p>
    <PhoneClock remaining={remaining} />
  </section>;
  return <ChoiceForm key={`${match.matchId}:${match.round}`} match={match} remaining={remaining} act={act} />;
}

function ChoiceForm({ match, remaining, act }: { match: ArenaSurvivorMatch; remaining: number | null; act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void> }) {
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (!match.scenario.choices.some((choice) => choice.id === selected) || busy) return;
    setBusy(true); setError("");
    try { await act("SUBMIT_ARENA_SURVIVOR_CHOICE", createArenaSurvivorChoicePayload(match, selected)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your choice could not be sent. Please try again."); }
    finally { setBusy(false); }
  };
  return <section className={`arcade-phone-card ${styles.phone}`}>
    <p className="arcade-kicker">Choose your strategy</p><h1>{match.scenario.title}</h1>
    <p className={styles.description}>{match.scenario.description}</p>
    <fieldset className={styles.choiceForm}>
      <legend>What do you do?</legend>
      {match.scenario.choices.map((choice, index) => <label className={selected === choice.id ? styles.selected : ""} key={choice.id}>
        <input type="radio" name="arena-choice" value={choice.id} checked={selected === choice.id} disabled={busy} onChange={() => setSelected(choice.id)} />
        <span className={styles.optionLetter}>{String.fromCharCode(65 + index)}</span><strong>{choice.text}</strong>
      </label>)}
    </fieldset>
    <button className="arcade-action" type="button" disabled={!selected || busy} onClick={() => void submit()}>{busy ? "Locking your choice…" : "Lock my choice"}</button>
    {error && <p role="alert">{error}</p>}
    <p className={styles.privacy}>Your choice is private until the reveal.</p>
    <PhoneClock remaining={remaining} />
  </section>;
}

function PhoneClock({ remaining }: { remaining: number | null }) {
  return <p className={styles.clock} role="timer">{remaining === null ? "Waiting for the room…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}</p>;
}
