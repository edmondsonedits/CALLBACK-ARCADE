"use client";
import type { DisplaySnapshot, HostAction, HostSnapshot } from "../../lib/contracts";
import styles from "./ChaosKommando.module.css";

export function ChaosKommandoHost({ snapshot, remaining, act, readOnly = false }: { snapshot: HostSnapshot | DisplaySnapshot; remaining: number | null; act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>; readOnly?: boolean }) {
  const match = snapshot.chaosKommando;
  const players = new Map(snapshot.players.filter((player) => player.role === "player").map((player) => [player.id, player.nickname]));
  if (!match) return <section className={styles.stage}><p>Loading mission control…</p></section>;
  if (snapshot.phase === "ARCADE_RESULTS" && match.result) return <section className={styles.stage}><div className={styles.panel}><p className={styles.eyebrow}>Chaos-Kommando · debrief</p><h1>{match.result.outcome === "contained" ? "City secured" : "Critical situation"}</h1><p>Team score: {match.result.score.toLocaleString()} / {match.result.maxScore.toLocaleString()}</p><div className={styles.results}>{match.result.missions.map((mission) => <div className={styles.resultRow} key={mission.missionId}><strong>{mission.missionId.replaceAll("-", " ")}</strong><span className={mission.score ? styles.ok : styles.bad}>{mission.outcome === "timeout" ? "Timeout · 0" : mission.score ? "Contained · 1,000" : `${mission.missingTags.join(", ") || "Team coverage"} missed`}</span></div>)}</div><p>All four outcomes are saved in this King Prompter room.</p>{!readOnly && <button className={styles.button} onClick={() => void act("PLAY_AGAIN")}>Play again</button>}</div></section>;
  const reveal = match.phase === "choosing";
  const submitted = match.submissionCount;
  const current = match.missionResults.at(-1);
  return <section className={styles.stage} aria-label="Chaos-Kommando mission control"><div className={styles.panel}>
    <p className={styles.eyebrow}>Mission {match.missionNumber} of {match.missionCount} · team command</p><h1>{match.mission.title}</h1><p className={styles.briefing}>{match.mission.briefing}</p>
    <div className={styles.missions}>{Array.from({ length: match.missionCount }, (_, index) => <div key={index} className={`${styles.missionPip} ${index + 1 === match.missionNumber ? styles.missionPipActive : ""}`}>Mission {index + 1}</div>)}</div>
    {reveal ? <><p>Phones locked: {submitted} / {match.players.length}. Team tool choices stay private until you reveal.</p><p className={styles.clock}>{snapshot.paused ? "Timer paused" : remaining === null ? "Waiting for timer…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds`}</p>{!readOnly && <button className={styles.button} disabled={snapshot.paused || (submitted < match.players.length && (remaining ?? 0) > 0)} onClick={() => void act("ADVANCE_CHAOS_KOMMANDO", { matchId: match.matchId, missionNumber: match.missionNumber, transition: "reveal" })}>{submitted === match.players.length ? "Reveal mission" : remaining === 0 ? "Resolve timeout" : "Waiting for team"}</button>}</> : <>
      <h2 className={current?.score ? styles.ok : styles.bad}>{current?.outcome === "timeout" ? "Mission timed out" : current?.score ? "Mission contained" : "Coverage missed"}</h2>
      <div className={styles.status}>{match.mission.requiredTags.map((tag) => <span key={tag} className={current?.coveredTags.includes(tag) ? styles.ok : styles.bad}>{tag}: {current?.coveredTags.includes(tag) ? "covered" : "missing"}</span>)}</div>
      <div className={styles.results}>{current?.submissions.map((entry) => <div className={styles.resultRow} key={entry.playerId}><strong>{players.get(entry.playerId) ?? "Player"}</strong><span>{match.mission.tools.find((tool) => tool.id === entry.toolId)?.label ?? "No tool submitted"}</span></div>)}</div>
      {!readOnly && match.missionNumber < match.missionCount && <button className={styles.button} onClick={() => void act("ADVANCE_CHAOS_KOMMANDO", { matchId: match.matchId, missionNumber: match.missionNumber, transition: "next" })}>Next mission</button>}
    </>}
  </div></section>;
}
