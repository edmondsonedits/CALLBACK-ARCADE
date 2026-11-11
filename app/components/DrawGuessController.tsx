"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AudienceSnapshot, PlayerAction, PlayerSnapshot } from "../../lib/contracts";
import { Drawing, type DrawGuessMatch, type DrawGuessStroke } from "./DrawGuessHost";
import styles from "./DrawGuess.module.css";

type PhoneView = (PlayerSnapshot | AudienceSnapshot) & { drawGuess?: DrawGuessMatch | null };
type DrawGuessPlayerAction = PlayerAction["type"];
const COLORS = ["#17213d", "#e44852", "#2679d8", "#26936f", "#e4a21c"];
const MAX_STROKES = 40;
const MAX_POINTS = 900;
const MAX_POINTS_PER_STROKE = 80;

export function isDrawGuessPhoneSnapshot(snapshot: Pick<PhoneView, "phase" | "drawGuess">): boolean {
  return snapshot.phase !== "LOBBY" && Boolean(snapshot.drawGuess);
}

export function createDrawGuessDrawingPayload(match: Pick<DrawGuessMatch, "matchId" | "round">, strokes: DrawGuessStroke[]) {
  let remaining = MAX_POINTS;
  return { matchId: match.matchId, round: match.round, drawing: strokes.slice(0, MAX_STROKES).map((stroke) => {
    const points = stroke.points.slice(0, Math.min(MAX_POINTS_PER_STROKE, remaining));
    remaining -= points.length;
    return { color: COLORS.includes(stroke.color) ? stroke.color : COLORS[0], width: 6,
      points: points.map(({ x, y }) => ({ x: Math.round(clamp01(x) * 1000), y: Math.round(clamp01(y) * 1000) })) };
  }).filter((stroke) => stroke.points.length > 0) };
}

export function DrawGuessController({ snapshot, remaining, act }: {
  snapshot: PhoneView;
  remaining: number | null;
  act: (type: DrawGuessPlayerAction, payload: Record<string, unknown>) => Promise<void>;
}) {
  const match = snapshot.drawGuess;
  if (!match) return <section className={`arcade-phone-card ${styles.phone}`} role="status"><p>Loading the drawing round…</p></section>;
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const result = match.result;
  if ((snapshot.phase === "ARCADE_RESULTS" || match.phase === "revealed") && result) return <section className={`arcade-phone-card ${styles.phone}`} aria-live="polite">
    <p className="arcade-kicker">Draw &amp; Guess · reveal</p>
    <h1>{result.outcome === "guessed" ? `${names.get(result.winnerId ?? "") ?? "A player"} got it!` : result.outcome === "timeout" ? "Time is up!" : "The host ended the round"}</h1>
    {result.drawing && <Drawing strokes={result.drawing} label="Revealed drawing" />}
    <div className={styles.secret}><span>The secret prompt</span><strong>{result.prompt}</strong></div>
    <div className={styles.guesses} aria-label="Revealed guesses">{result.guesses.map((guess, index) => <p className={guess.correct ? styles.correct : ""} key={`${guess.playerId}:${index}`}><span>{names.get(guess.playerId) ?? "Player"}</span><strong>{guess.text}</strong>{guess.correct && <b>GOT IT</b>}</p>)}</div>
    <div className={styles.scores} aria-label="Match scores">{players.map((player) => <p key={player.id}><span>{player.nickname}</span><strong>{result.scores[player.id] ?? 0}</strong>{player.id === result.winnerId && <b>ROUND WINNER</b>}</p>)}</div>
    <p role="status">The host will choose what comes next.</p>
  </section>;

  const isPlayer = snapshot.role === "player" && match.players.includes(snapshot.selfId);
  if (!isPlayer) return <section className={`arcade-phone-card ${styles.phone}`} aria-live="polite">
    <p className="arcade-kicker">Spectator</p><h1>Draw &amp; Guess is live</h1>
    <p>Watch the big screen. The prompt and guesses stay hidden until reveal.</p><Clock remaining={remaining} />
  </section>;

  if (match.phase === "drawing" && match.assignment?.role === "artist") return <ArtistCanvas key={`${match.matchId}:${match.round}`} match={match} prompt={match.assignment.prompt} remaining={remaining} act={act} />;
  if (match.phase === "drawing") return <section className={`arcade-phone-card ${styles.phone}`} aria-live="polite">
    <p className="arcade-kicker">Artist is sketching</p><h1>Get ready to guess</h1><p>The drawing will appear here when the artist submits it.</p><Clock remaining={remaining} />
  </section>;
  if (match.phase === "guessing" && match.assignment?.role === "artist") return <section className={`arcade-phone-card ${styles.phone}`} aria-live="polite">
    <p className="arcade-kicker">Drawing submitted</p><h1>Your drawing is on the big screen</h1><p>Watch the guesses come in. Your prompt remains secret until reveal.</p><Clock remaining={remaining} />
  </section>;
  if (match.phase !== "guessing") return <section className={`arcade-phone-card ${styles.phone}`} role="status"><p>The round is preparing its reveal…</p></section>;
  return <GuessForm key={`${match.matchId}:${match.round}:${match.attempt ?? 1}`} match={match} remaining={remaining} ownGuesses={match.ownGuesses ?? []} attempt={match.attempt ?? 1} act={act} />;
}

function ArtistCanvas({ match, prompt, remaining, act }: { match: DrawGuessMatch; prompt?: string; remaining: number | null; act: (type: DrawGuessPlayerAction, payload: Record<string, unknown>) => Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<DrawGuessStroke[]>([]);
  const active = useRef<DrawGuessStroke | null>(null);
  const pointerId=useRef<number|null>(null);
  const pointCountRef = useRef(0);
  const [color, setColor] = useState(COLORS[0]);
  const [pointCount, setPointCount] = useState(0);
  const [strokeCount, setStrokeCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.max(320, Math.floor(canvas.clientWidth * ratio));
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fffdf5";
    context.fillRect(0, 0, size, size);
    const all = active.current ? [...strokes.current, active.current] : strokes.current;
    for (const stroke of all) drawStroke(context, stroke, size);
  }, [revision]);

  useEffect(()=>{const release=()=>{pointerId.current=null;if(active.current){strokes.current=[...strokes.current,active.current];active.current=null;setStrokeCount(strokes.current.length);setPointCount(pointCountRef.current);}};const visibility=()=>{if(document.hidden)release();};window.addEventListener("blur",release);window.addEventListener("arcade:controls-reset",release);document.addEventListener("visibilitychange",visibility);return()=>{window.removeEventListener("blur",release);window.removeEventListener("arcade:controls-reset",release);document.removeEventListener("visibilitychange",visibility);};},[]);
  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.round(clamp01((event.clientX - rect.left) / rect.width) * 1000), y: Math.round(clamp01((event.clientY - rect.top) / rect.height) * 1000) };
  };
  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (busy || active.current || strokes.current.length >= MAX_STROKES || pointCountRef.current >= MAX_POINTS) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerId.current=event.pointerId;
    active.current = { color, width: 6, points: [point(event)] };
    pointCountRef.current += 1;
    paintStrokeToCanvas(canvasRef.current, active.current, true);
    setPointCount(pointCountRef.current);
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const stroke = active.current;
    if (!stroke || pointerId.current!==event.pointerId) return;
    const p = point(event);
    const last = stroke.points[stroke.points.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 10) return;
    if (stroke.points.length >= MAX_POINTS_PER_STROKE || pointCountRef.current >= MAX_POINTS) return;
    const previous = stroke.points[stroke.points.length - 1];
    stroke.points.push(p);
    pointCountRef.current += 1;
    paintSegment(canvasRef.current, previous, p, stroke.color);
    if (pointCountRef.current % 16 === 0 || pointCountRef.current === MAX_POINTS) setPointCount(pointCountRef.current);
  };
  const end = (event?:ReactPointerEvent<HTMLCanvasElement>) => {
    if (event&&pointerId.current!==event.pointerId)return;
    pointerId.current=null;
    if (!active.current) return;
    strokes.current = [...strokes.current, active.current];
    active.current = null;
    setStrokeCount(strokes.current.length);
    setPointCount(pointCountRef.current);
  };
  const clear = () => { pointerId.current=null;active.current = null; strokes.current = []; pointCountRef.current = 0; setPointCount(0); setStrokeCount(0); setError(""); setRevision((value) => value + 1); };
  const undo = () => { pointerId.current=null;active.current = null; const next = strokes.current.slice(0, -1); strokes.current = next; pointCountRef.current = next.reduce((sum, stroke) => sum + stroke.points.length, 0); setPointCount(pointCountRef.current); setStrokeCount(next.length); setRevision((value) => value + 1); };
  const submit = async () => {
    if (busy || !strokes.current.length || pointCount > MAX_POINTS) return;
    setBusy(true); setError("");
    try { await act("SUBMIT_DRAW_GUESS_DRAWING" as unknown as DrawGuessPlayerAction, createDrawGuessDrawingPayload(match, strokes.current)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your drawing could not be sent. Please try again."); }
    finally { setBusy(false); }
  };

  return <section className={`arcade-phone-card ${styles.phone} ${styles.artist}`}>
    <p className="arcade-kicker">Your turn · artist</p><h1>Draw the secret prompt</h1>
    {prompt ? <div className={styles.secret}><span>Your secret prompt</span><strong>{prompt}</strong></div> : <p role="status">Your prompt is being dealt…</p>}
    <p className={styles.help}>Keep it simple. No letters, numbers, or words. Your sketch is sent only when you submit.</p>
    <div className={styles.palette} role="group" aria-label="Pen color">{COLORS.map((entry, index) => <button key={entry} type="button" className={color === entry ? styles.selected : ""} aria-label={`${["Navy", "Red", "Blue", "Green", "Gold"][index]} pen`} aria-pressed={color === entry} style={{ "--pen-color": entry } as React.CSSProperties} onClick={() => setColor(entry)} />)}</div>
    <canvas ref={canvasRef} data-arcade-control="" className={styles.canvas} tabIndex={0} aria-label="Drawing canvas. Draw with a finger or stylus." onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
    <div className={styles.canvasTools}><span>{pointCount}/{MAX_POINTS} points</span><button type="button" disabled={!strokeCount || busy} onClick={undo}>Undo</button><button type="button" disabled={!pointCount || busy} onClick={clear}>Clear</button></div>
    <button className="arcade-action" type="button" disabled={!pointCount || busy || strokeCount > MAX_STROKES} onClick={() => void submit()}>{busy ? "Sending drawing…" : "Submit drawing"}</button>
    {error && <p role="alert">{error}</p>}<Clock remaining={remaining} />
  </section>;
}

function GuessForm({ match, remaining, ownGuesses, attempt, act }: { match: DrawGuessMatch; remaining: number | null; ownGuesses: string[]; attempt: number; act: (type: DrawGuessPlayerAction, payload: Record<string, unknown>) => Promise<void> }) {
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = guess.trim().length > 0 && guess.trim().length <= 80;
  const submit = async () => {
    if (!valid || busy || attempt > 5) return;
    setBusy(true); setError("");
    try { await act("SUBMIT_DRAW_GUESS" as unknown as DrawGuessPlayerAction, { matchId: match.matchId, round: match.round, attempt, guess: guess.trim() }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your guess could not be sent. Please try again."); }
    finally { setBusy(false); }
  };
  return <section className={`arcade-phone-card ${styles.phone}`}>
    <p className="arcade-kicker">Draw &amp; Guess · attempt {Math.min(attempt, 5)} of 5</p><h1>What is the picture?</h1>
    {ownGuesses.length > 0 && <div className={styles.ownGuesses} aria-label="Your previous guesses">{ownGuesses.map((item, index) => <p key={`${index}:${item}`}>Your guess {index + 1}: <strong>{item}</strong></p>)}</div>}
    {attempt > 5 ? <p className={styles.ownGuess} role="status">You’ve used all five guesses. Watch the big screen for the reveal.</p> : <>
      <label htmlFor="draw-guess-input">Your guess</label>
      <input id="draw-guess-input" className={styles.input} type="text" autoComplete="off" maxLength={80} value={guess} disabled={busy} onChange={(event) => setGuess(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submit(); } }} />
      <span className={styles.count}>{guess.length}/80</span>
      <button className="arcade-action" type="button" disabled={!valid || busy} onClick={() => void submit()}>{busy ? "Sending guess…" : "Send guess"}</button>
      {error && <p role="alert">{error}</p>}
    </>}
    <Clock remaining={remaining} />
  </section>;
}

function Clock({ remaining }: { remaining: number | null }) {
  return <p className={styles.clock} role="timer">{remaining === null ? "Waiting for the round…" : `${Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}</p>;
}

function drawStroke(context: CanvasRenderingContext2D, stroke: DrawGuessStroke, size: number) {
  const [first, ...rest] = stroke.points;
  if (!first) return;
  context.beginPath(); context.moveTo(first.x * size / 1000, first.y * size / 1000);
  for (const point of rest) context.lineTo(point.x * size / 1000, point.y * size / 1000);
  if (rest.length === 0) context.lineTo(first.x * size / 1000 + 0.1, first.y * size / 1000 + 0.1);
  context.strokeStyle = stroke.color; context.lineWidth = Math.max(3, size * stroke.width / 1000); context.lineCap = "round"; context.lineJoin = "round"; context.stroke();
}

function paintStrokeToCanvas(canvas: HTMLCanvasElement | null, stroke: DrawGuessStroke, dot: boolean) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const size = canvas.width;
  if (dot) {
    const point = stroke.points[0];
    context.beginPath(); context.arc(point.x * size / 1000, point.y * size / 1000, Math.max(2, size * stroke.width / 2000), 0, Math.PI * 2);
    context.fillStyle = stroke.color; context.fill();
  }
}

function paintSegment(canvas: HTMLCanvasElement | null, from: { x: number; y: number }, to: { x: number; y: number }, color: string) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const size = canvas.width;
  context.beginPath(); context.moveTo(from.x * size / 1000, from.y * size / 1000); context.lineTo(to.x * size / 1000, to.y * size / 1000);
  context.strokeStyle = color; context.lineWidth = Math.max(3, size * 0.006); context.lineCap = "round"; context.lineJoin = "round"; context.stroke();
}

function clamp01(value: number) { return Math.max(0, Math.min(1, value)); }
