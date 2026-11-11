"use client";

import type { DisplaySnapshot, HostAction, HostSnapshot, SnapshotBase } from "../../lib/contracts";
import styles from "./ArenaSurvivor.module.css";

export type ArenaScenario = NonNullable<SnapshotBase["arenaSurvivor"]>["scenario"];
export type ArenaSurvivorResult = NonNullable<NonNullable<SnapshotBase["arenaSurvivor"]>["result"]>;
export type ArenaSurvivorMatch = NonNullable<SnapshotBase["arenaSurvivor"]>;
type HostView = HostSnapshot | DisplaySnapshot;

export function ArenaSurvivorHost({ snapshot, remaining, act, readOnly = false }: {
  snapshot: HostView;
  remaining: number | null;
  act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
}) {
  const match = snapshot.arenaSurvivor;
  if (!match) return <section className={`arcade-host ${styles.stage}`} role="status"><p>Loading the scenario…</p></section>;
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const result = match.result;
  if ((snapshot.phase === "ARCADE_RESULTS" || match.phase === "revealed") && result) {
    const winnerText = result.winners.length ? result.winners.map((id) => names.get(id) ?? "Player").join(" & ") : "No one";
    return <section className={`arcade-host ${styles.stage}`} aria-label="Arena Survivor results">
      <header className="arcade-topbar"><span>KING PROMPTER</span><span>ARENA SURVIVOR · REVEAL</span><span>ROOM {snapshot.code}</span></header>
      <section className={`${styles.board} ${styles.reveal}`} aria-live="polite">
        <p className="arcade-kicker">{result.outcome === "timeout" ? "Scenario closed" : "The arena is decided"}</p>
        <h1>{result.winners.length ? `${winnerText} survived` : "The moment of truth"}</h1>
        <ScenarioCard scenario={result.scenario} />
        <div className={styles.answerReveal}>
          <span>The best choice</span><strong>{result.scenario.choices.find((choice) => choice.id === result.correctChoiceId)?.text ?? "Answer unavailable"}</strong>
          <p>{result.explanation}</p>
        </div>
        <ChoiceResults choices={result.scenario.choices} choiceCounts={result.choiceCounts} correctChoiceId={result.correctChoiceId} />
        <Scoreboard players={players} scores={result.scores} winners={result.winners} />
        {!readOnly && <button className="arcade-action" type="button" onClick={() => void act("PLAY_AGAIN")}>Play again</button>}
        {readOnly && <p className="arcade-connection" role="status">The host controls the next round.</p>}
      </section>
    </section>;
  }

  return <section className={`arcade-host ${styles.stage}`} aria-label="Arena Survivor host screen">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>ARENA SURVIVOR · ROUND {match.round}</span><span>ROOM {snapshot.code}</span></header>
    <section className={styles.board} aria-live="polite">
      <p className="arcade-kicker">Survival scenario</p>
      <h1>{match.scenario.title}</h1>
      <p className={styles.description}>{match.scenario.description}</p>
      <div className={styles.choices} aria-label="Possible choices">{match.scenario.choices.map((choice, index) => <article key={choice.id}><span>{String.fromCharCode(65 + index)}</span><strong>{choice.text}</strong></article>)}</div>
      <div className={styles.progress}><strong>{match.answerCount}</strong><span>of {match.players.length} players have chosen</span></div>
      <div className={styles.timer} role="timer" aria-label={`${remaining === null ? "Unknown" : Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}>{remaining === null ? "—" : `${Math.max(0, Math.ceil(remaining / 1000))}s`}</div>
      <p className="arcade-connection">The winning answer stays secret until the reveal.</p>
      {!readOnly && <button className="arcade-action" type="button" disabled={snapshot.paused} onClick={() => void act("ADVANCE_ARENA_SURVIVOR", { matchId: match.matchId, round: match.round })}>Reveal the outcome</button>}
    </section>
  </section>;
}

function ScenarioCard({ scenario }: { scenario: ArenaScenario }) {
  return <div className={styles.scenarioCard}><span>THE SCENARIO</span><h2>{scenario.title}</h2><p>{scenario.description}</p></div>;
}

function ChoiceResults({ choices, choiceCounts, correctChoiceId }: { choices: ArenaScenario["choices"]; choiceCounts: ArenaSurvivorResult["choiceCounts"]; correctChoiceId: string }) {
  const rows = choices.map((choice) => ({ ...choice, count: choiceCounts[choice.id] ?? 0 }));
  const max = Math.max(1, ...rows.map((choice) => choice.count));
  return <section className={styles.choiceResults} aria-label="Vote breakdown"><h2>How the room chose</h2>{rows.map((choice) => <div className={choice.id === correctChoiceId ? styles.correct : ""} key={choice.id}>
    <span>{choice.text}</span><div className={styles.barTrack} aria-label={`${choice.count} votes`}><i style={{ width: `${Math.round(choice.count / max * 100)}%` }} /></div><strong>{choice.count}</strong>{choice.id === correctChoiceId && <b>BEST CHOICE</b>}
  </div>)}</section>;
}

function Scoreboard({ players, scores, winners }: { players: Array<{ id: string; nickname: string }>; scores: Record<string, number>; winners: string[] }) {
  return <div className={styles.scores} aria-label="Match scores">{[...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0) || a.nickname.localeCompare(b.nickname)).map((player) => <p key={player.id}><span>{player.nickname}</span><strong>{scores[player.id] ?? 0}</strong>{winners.includes(player.id) && <b>SURVIVED</b>}</p>)}</div>;
}
