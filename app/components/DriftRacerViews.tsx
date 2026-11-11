"use client";

import { useState } from "react";
import type { AudienceSnapshot, DisplaySnapshot, HostAction, HostSnapshot, PlayerAction, PlayerSnapshot } from "../../lib/contracts";
import styles from "./DriftRacerViews.module.css";

type HostView = HostSnapshot | DisplaySnapshot;
type PhoneView = PlayerSnapshot | AudienceSnapshot;
type DriveInput = { throttle: "accelerate" | "coast" | "brake"; steer: -1 | 0 | 1; drift: boolean; boost: boolean };

export function DriftRacerHost({ snapshot, remaining, act, readOnly = false }: { snapshot: HostView; remaining: number | null; act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>; readOnly?: boolean }) {
  const race = snapshot.driftRacer;
  if (!race) return <section className={styles.host}><h1>Setting up the starting grid…</h1></section>;
  const names = new Map(snapshot.players.map((player) => [player.id, player.nickname]));
  if (snapshot.phase === "ARCADE_RESULTS" && race.result) return <section className={styles.host} aria-label="Drift Racer final results"><div className={styles.results}><p className={styles.kicker}>{race.result.outcome === "practice" ? "DRIFT RACER · SOLO PRACTICE" : "DRIFT RACER · FINISH"}</p><h1>{race.result.outcome === "practice" ? "Practice run complete" : race.result.winnerPlayerId ? `${names.get(race.result.winnerPlayerId) ?? "A driver"} takes the crown` : "Dead heat at the line"}</h1><Standings standings={race.result.standings} names={names} /><p className={styles.copy}>{race.result.outcome === "practice" ? "No winner needed. Run it again whenever you are ready." : "The next race is ready whenever the room is."}</p>{!readOnly && <button className={styles.primary} onClick={() => void act("PLAY_AGAIN")}>Play again</button>}</div></section>;
  return <section className={styles.host} aria-label="Drift Racer host screen">
    <header className={styles.header}><div><p className={styles.kicker}>KING PROMPTER ARCADE</p><h1>Drift Racer <span>TURN {race.turn} / 8</span></h1></div><div className={styles.timer} role="timer">{snapshot.paused ? "PAUSED" : remaining === null ? "SYNCING" : `${Math.max(0, Math.ceil(remaining / 1000))}s`}</div></header>
    <div className={styles.layout}><div className={styles.track} aria-label="Race standings">
      {race.players.map((id, index) => { const driver = race.drivers[id]!; const percent = Math.min(100, driver.distance / 8); const corner = driver.distance < 250 ? { distance: 250, lane: 2 } : driver.distance < 500 ? { distance: 500, lane: 0 } : driver.distance < 750 ? { distance: 750, lane: 1 } : null;
        return <article className={styles.driver} key={id}><div className={styles.driverHeader}><span className={styles.colorDot} data-seat={index} /><strong>{names.get(id) ?? `Driver ${index + 1}`}</strong><span>LANE {driver.lane + 1} · {driver.speed} km/h</span></div><div className={styles.trackLine}><div className={styles.progress} style={{ width: `${percent}%` }} /><span className={styles.car} style={{ left: `${percent}%` }} aria-label={`${driver.distance} meters`}><span aria-hidden="true">◆</span></span><span className={styles.finish} /></div><div className={styles.driverMeta}><span>{driver.distance} / 800 m</span><span>{driver.boosts} boosts · {driver.cornerRewards} clean corners{corner ? ` · next bend lane ${corner.lane + 1} at ${corner.distance} m` : " · final straight"}</span></div></article>;
      })}
    </div><aside className={styles.side}>
      <p className={styles.kicker}>HIDDEN INPUTS</p><strong className={styles.lockCount}>{race.inputCount} <small>/ {race.players.length}</small></strong><p className={styles.copy}>Each driver locks one move. Inputs stay private until the server resolves the turn.</p>
      <div className={styles.tip}><b>READ THE BENDS</b><span>Match the lane and drift at each corner for a clean-line bonus and a boost.</span></div>
      {!readOnly && <button className={styles.primary} disabled={snapshot.paused || race.inputCount < race.players.length} onClick={() => void act("ADVANCE_DRIFT_RACER", { matchId: race.matchId, turn: race.turn })}>{race.inputCount < race.players.length ? "Waiting for drivers" : "Resolve turn"}</button>}
      {readOnly && <p className={styles.copy}>Live race display</p>}
    </aside></div>
  </section>;
}

export function DriftRacerController({ snapshot, remaining, act }: { snapshot: PhoneView; remaining: number | null; act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void> }) {
  const race = snapshot.driftRacer;
  const [input, setInput] = useState<DriveInput>({ throttle: "accelerate", steer: 0, drift: false, boost: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!race) return <section className={styles.phone}><h1>Joining the grid…</h1></section>;
  const playerId = snapshot.role === "player" ? snapshot.selfId : "";
  const seated = Boolean(playerId && race.players.includes(playerId));
  const driver = race.drivers[playerId];
  if (snapshot.phase === "ARCADE_RESULTS" && race.result) return <section className={styles.phone} aria-label="Drift Racer results"><p className={styles.kicker}>{race.result.outcome === "practice" ? `SOLO PRACTICE · TURN ${race.turn}` : `FINISH · TURN ${race.turn}`}</p><h1>{race.result.outcome === "practice" ? "Practice run complete" : race.result.winnerPlayerId === playerId ? "You won the race!" : race.result.winnerPlayerId ? "Race complete" : "A photo finish"}</h1><Standings standings={race.result.standings} names={new Map(snapshot.players.map((player) => [player.id, player.nickname]))} /><p className={styles.copy}>{race.result.outcome === "practice" ? "No winner needed. Rejoin the room when you are ready to practice again." : "Stay in this room to race again."}</p></section>;
  if (!seated) return <section className={styles.phone}><p className={styles.kicker}>SPECTATOR</p><h1>Drift Racer</h1><p className={styles.copy}>Watch the lanes on the big screen. Turn inputs stay hidden until the host resolves them.</p></section>;
  if (snapshot.paused) return <section className={styles.phone}><p className={styles.kicker}>RACE PAUSED</p><h1>Take a breath.</h1><p className={styles.copy}>Your car is safe. The host will resume the countdown.</p></section>;
  if (race.phase !== "racing") return <section className={styles.phone}><p className={styles.kicker}>RACE COMPLETE</p><h1>Check the big screen</h1></section>;
  if (race.submitted) return <section className={styles.phone}><p className={styles.kicker}>TURN {race.turn} · INPUT LOCKED</p><h1>Line set.</h1><p className={styles.copy}>Your throttle, lane and boost choice stay private until the turn resolves.</p><DriverStatus driver={driver} remaining={remaining} /></section>;
  const submit = async () => { if (busy) return; setBusy(true); setError(""); try { await act("SUBMIT_DRIFT_RACER_INPUT", { matchId: race.matchId, turn: race.turn, ...input }); } catch (cause) { setError(cause instanceof Error ? cause.message : "Your move could not be locked."); } finally { setBusy(false); } };
  const corner = driver && driver.distance < 250 ? { distance: 250, lane: 2 } : driver && driver.distance < 500 ? { distance: 500, lane: 0 } : driver && driver.distance < 750 ? { distance: 750, lane: 1 } : null;
  return <section className={styles.phone} aria-label="Drift Racer phone controller"><p className={styles.kicker}>TURN {race.turn} / 8 · YOUR MOVE</p><h1>Choose your line.</h1><DriverStatus driver={driver} remaining={remaining} />
    <fieldset className={styles.field}><legend>Throttle</legend><div className={styles.choices}>{(["brake", "coast", "accelerate"] as const).map((throttle) => <button key={throttle} type="button" aria-pressed={input.throttle === throttle} onClick={() => setInput((current) => ({ ...current, throttle }))}>{throttle === "accelerate" ? "Accelerate" : throttle[0]!.toUpperCase() + throttle.slice(1)}</button>)}</div></fieldset>
    <fieldset className={styles.field}><legend>Steer</legend><div className={styles.choices}>{([-1, 0, 1] as const).map((steer) => <button key={steer} type="button" aria-pressed={input.steer === steer} onClick={() => setInput((current) => ({ ...current, steer }))}>{steer < 0 ? "Left" : steer > 0 ? "Right" : "Stay"}{corner && steer === corner.lane - (driver?.lane ?? 1) ? " · bend" : ""}</button>)}</div></fieldset>
    <div className={styles.toggles}><label><input type="checkbox" checked={input.drift} onChange={(event) => setInput((current) => ({ ...current, drift: event.target.checked }))} /> Drift through the bend</label><label><input type="checkbox" checked={input.boost} disabled={(driver?.boosts ?? 0) < 1} onChange={(event) => setInput((current) => ({ ...current, boost: event.target.checked }))} /> Spend a boost <span>({driver?.boosts ?? 0} left)</span></label></div>
    <button className={styles.primary} disabled={busy} onClick={() => void submit()}>{busy ? "Locking move…" : "Lock this move"}</button>{error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}

function DriverStatus({ driver, remaining }: { driver?: { distance: number; speed: number; lane: number; boosts: number; cornerRewards: number }; remaining: number | null }) {
  return <div className={styles.status}><div><span>DISTANCE</span><strong>{driver?.distance ?? 0}<small> m</small></strong></div><div><span>SPEED</span><strong>{driver?.speed ?? 50}<small> km/h</small></strong></div><div><span>TIME</span><strong>{remaining === null ? "—" : `${Math.max(0, Math.ceil(remaining / 1000))}s`}</strong></div></div>;
}

function Standings({ standings, names }: { standings: Array<{ playerId: string; place: number; distance: number; speed: number; cornerRewards: number }>; names: Map<string, string> }) {
  return <div className={styles.standings}>{standings.map((row) => <div key={row.playerId}><b>#{row.place}</b><strong>{names.get(row.playerId) ?? "Driver"}</strong><span>{row.distance} m · {row.cornerRewards} clean bends</span></div>)}</div>;
}
