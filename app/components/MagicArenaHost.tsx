"use client";
import type { DisplaySnapshot, HostAction, HostSnapshot } from "../../lib/contracts";
import { magicArenaTargets } from "../../server/arcade/magic_arena";
import styles from "./MagicArena.module.css";
const moveName = (move: string | undefined) => move ? move[0]!.toUpperCase() + move.slice(1) : "No move";

export function MagicArenaHost({ snapshot, remaining, act, readOnly = false }: { snapshot: HostSnapshot | DisplaySnapshot; remaining: number | null; act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>; readOnly?: boolean }) {
  const match = snapshot.magicArena;
  if (!match) return <section className={styles.stage}><p>Loading the arena…</p></section>;
  const names = new Map(snapshot.players.map((player) => [player.id, player.nickname]));
  const targets = magicArenaTargets(match.players, match.health);
  const activeCount = match.players.filter((id) => match.health[id]! > 0).length;
  const fighters = match.players.map((id) => ({ id, name: names.get(id) ?? "Duelist", health: match.health[id] ?? 0, energy: match.energy[id] ?? 0, target: targets[id] ? names.get(targets[id]!) ?? "Duelist" : null }));
  const result = match.result;
  if (snapshot.phase === "ARCADE_RESULTS" && result) return <section className={`${styles.stage} ${(match?.players.length ?? 0) > 2 ? styles.roster : ""}`}><div className={styles.panel}><p className={styles.eyebrow}>Magic Arena · final</p><h1>{result.winnerPlayerId ? `${names.get(result.winnerPlayerId) ?? "Duelist"} wins` : "Draw match"}</h1><p>{result.outcome === "knockout" ? "The final blow decided the duel." : result.outcome === "points" ? "The five-round bell decided the duel." : "Neither duelist could be separated."}</p><Fighters fighters={fighters} /><p>{result.roundsPlayed} round{result.roundsPlayed === 1 ? "" : "s"} played · final health breaks ties first, then energy.</p>{!readOnly && <button className={styles.button} onClick={() => void act("PLAY_AGAIN")}>Play again</button>}</div></section>;
  const last = match.roundResults.at(-1);
  return <section className={`${styles.stage} ${(match?.players.length ?? 0) > 2 ? styles.roster : ""}`} aria-label="Magic Arena host screen"><div className={styles.panel}><p className={styles.eyebrow}>ROUND {match.round} / {match.roundCount} · simultaneous duel</p><h1>Magic Arena</h1><Fighters fighters={fighters} />
    {match.phase === "choosing" ? <div className={styles.center}><p>Moves locked: {match.submissionCount} / {activeCount}. Opponent actions stay secret until reveal.</p><p className={styles.clock}>{snapshot.paused ? "Timer paused" : remaining === null ? "Waiting for the round clock…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}</p>{!readOnly && <button className={styles.button} disabled={snapshot.paused || (match.submissionCount < activeCount && (remaining ?? 0) > 0)} onClick={() => void act("ADVANCE_MAGIC_ARENA", { matchId: match.matchId, round: match.round, transition: "reveal" })}>{match.submissionCount === activeCount ? "Reveal round" : remaining === 0 ? "Resolve timeout" : "Waiting for moves"}</button>}</div> : <><div className={styles.logs}><div className={styles.log}>{match.players.map((id) => <span key={id}>{names.get(id) ?? "Duelist"}: {moveName(last?.actions[id])} · {last?.damage[id] ?? 0} damage taken</span>)}</div><p className={styles.center}>{last?.outcome === "timeout" ? "Time expired · missing moves became Focus" : last?.outcome === "knockout" ? "Knockout!" : last?.outcome === "blocked" ? "Guard stopped the incoming strike." : last?.outcome === "hit" ? "A clean hit landed." : "Both duelists held their ground."}</p></div>{!readOnly && !result && <button className={styles.button} onClick={() => void act("ADVANCE_MAGIC_ARENA", { matchId: match.matchId, round: match.round, transition: "next" })}>Next round</button>}</>}
  </div></section>;
}

function Fighters({ fighters }: { fighters: Array<{ id: string; name: string; health: number; energy: number; target: string | null }> }) {
  return <div className={styles.fighters}>{fighters.map((fighter) => <div className={styles.fighter} key={fighter.id}><strong>{fighter.name}</strong><span>{fighter.target ? `Target: ${fighter.target}` : fighter.health === 0 ? "Knocked out" : "Last fighter"}</span><div className={styles.bar} aria-label={`${fighter.health} health`}><i style={{ width: `${fighter.health / 6 * 100}%` }} /></div><span>{fighter.health} HP</span><div className={styles.resources}><span>Energy {fighter.energy}/3</span></div></div>).flatMap((fighter, index) => fighters.length === 2 && index === 0 ? [fighter, <b className={styles.versus} key="versus">VS</b>] : [fighter])}</div>;
}
