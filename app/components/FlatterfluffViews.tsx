"use client";

import type { AudienceSnapshot, DisplaySnapshot, HostAction, HostSnapshot, PlayerAction, PlayerSnapshot, SnapshotFlatterfluff } from "../../lib/contracts";
import { useEffect,useRef,useState, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./FlatterfluffViews.module.css";

type HostView = HostSnapshot | DisplaySnapshot;
type PhoneView = PlayerSnapshot | AudienceSnapshot;
type Aim = { x: number; y: number };

export function FlatterfluffHost({ snapshot, remaining, act, readOnly = false }: { snapshot: HostView; remaining: number | null; act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>; readOnly?: boolean }) {
  const match = snapshot.flatterfluff;
  if (!match) return <section className={styles.host}><p>Setting up the gallery…</p></section>;
  const names = new Map(snapshot.players.map((player) => [player.id, player.nickname]));
  if (snapshot.phase === "ARCADE_RESULTS" && match.result) return <section className={styles.host} aria-label="Flatterfluff final results"><div className={styles.resultPanel}><p className={styles.kicker}>FLATTERFLUFF · FINAL SCORES</p><h1>That was a nice shot.</h1><div className={styles.standings}>{Object.entries(match.result.scores).sort((a, b) => b[1] - a[1]).map(([id, score], index) => <div className={styles.standing} key={id}><span className={styles.rank}>{index + 1}</span><strong>{names.get(id) ?? "Player"}</strong><b>{score.toLocaleString()}</b></div>)}</div><p className={styles.winner}>{match.result.winners.map((id) => names.get(id) ?? "Player").join(" & ")} take the top spot</p>{!readOnly && <button className={styles.primary} onClick={() => void act("PLAY_AGAIN")}>Play again</button>}</div></section>;
  const result = match.result;
  return <section className={styles.host} aria-label="Flatterfluff host screen"><div className={styles.boardColumn}>
    <p className={styles.kicker}>FLATTERFLUFF · WAVE {match.round} / {match.roundTotal}</p>
    <TargetBoard targets={match.targets} shots={result?.shots} />
  </div><aside className={styles.sidePanel}>
    <div className={styles.scoreCard}><span>ROOM SCORE</span><strong>{Math.max(0, ...Object.values(match.result?.scores ?? {})).toLocaleString()}</strong><small>Points scored so far</small></div>
    {match.phase === "aiming" ? <><h1>Find your mark.</h1><p className={styles.body}>Choose your target on your phone. Aim stays private until the reveal.</p><div className={styles.progress}><span>Shots locked</span><b>{match.submittedCount} / {match.players.length}</b></div><div className={styles.timer}>{snapshot.paused ? "Timer paused" : remaining === null ? "Waiting for the round clock…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds`}</div>{!readOnly && <button className={styles.primary} disabled={snapshot.paused || (match.submittedCount < match.players.length && (remaining ?? 0) > 0)} onClick={() => void act("ADVANCE_FLATTERFLUFF", { matchId: match.matchId, round: match.round, transition: "reveal" })}>{match.submittedCount === match.players.length ? "Reveal shots" : remaining === 0 ? "Resolve the wave" : "Waiting for players"}</button>}</> : <><h1>{result?.outcome === "timeout" ? "Time!" : "Wave complete"}</h1><p className={styles.body}>Every shot is now on the board.</p><div className={styles.shotList}>{result?.shots.map((shot) => <div key={shot.playerId}><span>{names.get(shot.playerId) ?? "Player"}{shot.timedOut ? " · missed turn" : ""}</span><b>{shot.points.toLocaleString()}</b></div>)}</div>{match.phase === "revealed" && !readOnly && <button className={styles.primary} onClick={() => void act("ADVANCE_FLATTERFLUFF", { matchId: match.matchId, round: match.round, transition: "next" })}>Next wave</button>}{match.phase === "complete" && <p className={styles.body}>Final scores are ready.</p>}</>}
  </aside></section>;
}

export function FlatterfluffController({ snapshot, remaining, act }: { snapshot: PhoneView; remaining: number | null; act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void> }) {
  const match = snapshot.flatterfluff;
  const [aim, setAim] = useState<Aim>({ x: 0.5, y: 0.5 });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!match) return <section className={styles.phone}><div className={styles.phonePanel}>Preparing your gallery…</div></section>;
  const seated = snapshot.role === "player" && match.players.includes(snapshot.selfId);
  if (snapshot.phase === "ARCADE_RESULTS" && match.result) return <section className={styles.phone}><div className={styles.phonePanel}><p className={styles.kicker}>FLATTERFLUFF · FINAL</p><h1>{match.result.winners.includes(snapshot.role === "player" ? snapshot.selfId : "") ? "Bullseye!" : "Nice round."}</h1><p>You scored <strong>{(match.result.scores[snapshot.role === "player" ? snapshot.selfId : ""] ?? 0).toLocaleString()}</strong> points.</p><p className={styles.body}>Stay in the room for another run.</p></div></section>;
  if (match.phase !== "aiming") return <section className={styles.phone}><div className={styles.phonePanel}><p className={styles.kicker}>WAVE {match.round} · REVEALED</p><h1>{match.result?.shots.find((shot) => shot.playerId === (snapshot.role === "player" ? snapshot.selfId : ""))?.points ? "Great shot!" : "Wave complete"}</h1><p>Your shot scored <strong>{match.result?.shots.find((shot) => shot.playerId === (snapshot.role === "player" ? snapshot.selfId : ""))?.points ?? 0}</strong> points.</p><p className={styles.body}>The host is setting up the next wave.</p></div></section>;
  if (!seated) return <section className={styles.phone}><div className={styles.phonePanel}><p className={styles.kicker}>SPECTATOR</p><h1>Flatterfluff</h1><p>Watch the wave on the big screen. Player aim stays secret until the reveal.</p></div></section>;
  if (match.submitted) return <section className={styles.phone}><div className={styles.phonePanel}><p className={styles.kicker}>WAVE {match.round} · SHOT LOCKED</p><h1>Ready to pop!</h1><TargetBoard targets={match.targets} ownShot={match.ownShot} /><p className={styles.body}>Your aim is locked. The room will see it after the reveal.</p><div className={styles.timer}>{remaining === null ? "Waiting for the host…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds left`}</div></div></section>;
  const updateAim = (x: number, y: number) => { setAim({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }); setDirty(true); };
  const lockShot = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { await act("SUBMIT_FLATTERFLUFF_SHOT", { matchId: match.matchId, round: match.round, x: aim.x, y: aim.y }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your shot could not be locked."); }
    finally { setBusy(false); }
  };
  return <section className={styles.phone} aria-label="Flatterfluff phone controller"><div className={styles.phonePanel}><p className={styles.kicker}>WAVE {match.round} / {match.roundTotal}</p><h1>Line it up.</h1><p className={styles.body}>Drag your crosshair onto a target, then lock your shot.</p><TargetBoard targets={match.targets} aim={aim} onAim={snapshot.paused?undefined:updateAim} /><p className={styles.hint} aria-live="polite">{dirty ? `Aim ${Math.round(aim.x * 100)}%, ${Math.round(aim.y * 100)}%` : "Touch or drag to aim. Arrow keys also work."}</p><button className={styles.primary} disabled={busy || snapshot.paused || remaining === 0} onClick={() => void lockShot()}>{busy ? "Locking shot…" : "Lock my shot"}</button>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.timer}>{snapshot.paused ? "Paused by host" : remaining === null ? "Waiting for the host…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds left`}</div></div></section>;
}

function TargetBoard({ targets, shots = [], aim, ownShot, onAim }: { targets: SnapshotFlatterfluff["targets"]; shots?: NonNullable<SnapshotFlatterfluff["result"]>["shots"]; aim?: Aim; ownShot?: Aim; onAim?: (x: number, y: number) => void }) {
  const pointerId=useRef<number|null>(null),activeAim=!!onAim;
  useEffect(()=>{if(!activeAim)pointerId.current=null;},[activeAim]);
  useEffect(()=>{const clear=()=>{pointerId.current=null;};const visibility=()=>{if(document.hidden)clear();};document.addEventListener("visibilitychange",visibility);window.addEventListener("blur",clear);window.addEventListener("arcade:controls-reset",clear);return()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("blur",clear);window.removeEventListener("arcade:controls-reset",clear);};},[]);
  const release=(event:PointerEvent<SVGSVGElement>)=>{if(pointerId.current===event.pointerId)pointerId.current=null;};
  const point = (event: PointerEvent<SVGSVGElement>) => {
    if (!onAim) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    onAim((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  };
  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!onAim || !aim) return;
    const delta = event.shiftKey ? 0.1 : 0.025;
    const offsets: Record<string, Aim> = { ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta }, ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 } };
    const offset = offsets[event.key];
    if (offset) { event.preventDefault(); onAim(aim.x + offset.x, aim.y + offset.y); }
  };
  const marker = aim ?? ownShot;
  return <svg data-testid={onAim ? "flatterfluff-aim-field" : undefined} className={styles.board} viewBox="0 0 1000 1000" role={onAim ? "application" : "img"} aria-label={onAim ? "Aim field. Drag or use arrow keys to move your crosshair." : "Flatterfluff target wave"} tabIndex={onAim ? 0 : undefined} data-arcade-control={onAim?"":undefined} onPointerDown={onAim ? (event)=>{if(pointerId.current!==null)return;event.preventDefault();pointerId.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);point(event);} : undefined} onPointerMove={onAim ? (event) => { if (pointerId.current===event.pointerId) point(event); } : undefined} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onKeyDown={keyboard}>
    <defs><pattern id="fluff-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="rgba(255,255,255,.075)" strokeWidth="2" /></pattern><radialGradient id="fluff-glow"><stop stopColor="#ffdf83" stopOpacity=".24" /><stop offset="1" stopColor="#ffdf83" stopOpacity="0" /></radialGradient></defs>
    <rect width="1000" height="1000" rx="44" fill="#17243a" /><rect width="1000" height="1000" rx="44" fill="url(#fluff-grid)" />
    {targets.map((target, index) => <g key={target.id} data-target-id={target.id} aria-label={`${target.points} point target`}><circle cx={target.x * 1000} cy={target.y * 1000} r={target.radius * 1000 * 1.45} fill="url(#fluff-glow)" /><circle cx={target.x * 1000} cy={target.y * 1000} r={target.radius * 1000} fill={index % 2 ? "#a9e6d0" : "#ffc578"} stroke="#fff2d8" strokeWidth="11" /><circle cx={target.x * 1000} cy={target.y * 1000} r={target.radius * 640} fill="none" stroke="#25364b" strokeWidth="9" /><circle cx={target.x * 1000} cy={target.y * 1000} r={target.radius * 270} fill="#fff8e9" /><text x={target.x * 1000} y={target.y * 1000 + target.radius * 1000 + 32} textAnchor="middle" className={styles.points}>{target.points}</text></g>)}
    {shots.map((shot, index) => <g key={shot.playerId} aria-label={`${shot.points} point shot`}><circle cx={shot.x * 1000} cy={shot.y * 1000} r="27" fill="none" stroke={index % 2 ? "#7ec9ff" : "#f195f5"} strokeWidth="9" /><path d={`M${shot.x * 1000 - 45} ${shot.y * 1000}h90 M${shot.x * 1000} ${shot.y * 1000 - 45}v90`} stroke="#fff" strokeWidth="6" /></g>)}
    {marker && <g className={styles.crosshair} aria-label="Your aim"><circle cx={marker.x * 1000} cy={marker.y * 1000} r="39" fill="none" stroke="#fff" strokeWidth="9" strokeDasharray="14 10" /><path d={`M${marker.x * 1000 - 60} ${marker.y * 1000}h120 M${marker.x * 1000} ${marker.y * 1000 - 60}v120`} stroke="#fff" strokeWidth="7" /></g>}
  </svg>;
}
