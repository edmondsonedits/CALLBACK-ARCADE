"use client";

import { useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import type { ArcadeWireSnapshot } from "./ArcadeHost";

export function ArcadeController({ game, connection, role, paused = false, onInput }: { game: ArcadeWireSnapshot | null; connection: string; role: "player" | "spectator" | "host" | undefined; paused?: boolean; onInput: (x: number, y: number) => void }) {
  const padRef = useRef<HTMLButtonElement>(null),pointerId=useRef<number|null>(null);
  const positionRef = useRef({ x: 0.5, y: 0.5 });
  const latestRef = useRef({ x: 0.5, y: 0.5 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentAtRef = useRef(0);
  const players = game?.state.players as string[] | undefined;
  const score = game?.state.score as Record<string, number> | undefined;
  const canControl = role === "player" && game?.state.status === "active" && !paused && connection === "live";
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const sendPosition = (x: number, y: number) => {
    const position = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    positionRef.current = position;
    latestRef.current = position;
    const elapsed = performance.now() - lastSentAtRef.current;
    if (elapsed >= 34) { lastSentAtRef.current = performance.now(); onInput(position.x, position.y); return; }
    if (!timerRef.current) timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (canControl) { lastSentAtRef.current = performance.now(); onInput(latestRef.current.x, latestRef.current.y); }
    }, Math.max(0, 34 - elapsed));
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (!canControl || !padRef.current || pointerId.current!==event.pointerId) return;
    const bounds = padRef.current.getBoundingClientRect();
    sendPosition((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  };
  useEffect(()=>{if(!canControl){pointerId.current=null;if(timerRef.current){clearTimeout(timerRef.current);timerRef.current=null;}}},[canControl]);
  const release=(event:PointerEvent<HTMLButtonElement>)=>{if(pointerId.current===event.pointerId)pointerId.current=null;};
  useEffect(()=>{const clear=()=>{pointerId.current=null;if(timerRef.current){clearTimeout(timerRef.current);timerRef.current=null;}};const visibility=()=>{if(document.hidden)clear();};document.addEventListener("visibilitychange",visibility);window.addEventListener("blur",clear);window.addEventListener("arcade:controls-reset",clear);return()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("blur",clear);window.removeEventListener("arcade:controls-reset",clear);};},[]);
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!canControl) return;
    const position = moveArcadePaddleByKey(positionRef.current, event.key);
    if (!position) return;
    event.preventDefault();
    sendPosition(position.x, position.y);
  };
  if (role !== "player") return <section className="arcade-phone-card" aria-live="polite"><p className="arcade-kicker">{role === "spectator" ? "SPECTATOR" : "CONNECTING"}</p><h1>Watch the match</h1><p>Controller seats rotate by room order between matches. This phone is read-only for this round.</p><div className="arcade-phone-score">{players?.map((id) => <span key={id}>{Number(score?.[id] ?? 0)}</span>)}</div><p role="status">{connection === "live" ? "Live match updates" : "Reconnecting to the match…"}</p></section>;
  return <section className="arcade-phone-card arcade-controller"><p className="arcade-kicker">AIR HOCKEY</p><div className="arcade-phone-score" aria-label="Current score">{players?.map((id) => <span key={id}>{Number(score?.[id] ?? 0)}</span>)}</div><p id="arcade-control-hint">Drag within the control pad, or focus it and use the arrow keys or WASD to move.</p><button ref={padRef} type="button" data-arcade-control="" className="arcade-touch-pad" aria-label="Move your air hockey paddle" aria-describedby="arcade-control-hint" disabled={!canControl} onKeyDown={handleKeyDown} onPointerDown={(event) => { if (!canControl||pointerId.current!==null) return;event.preventDefault();pointerId.current=event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}><span aria-hidden="true">DRAG OR USE ARROWS</span></button><p className="arcade-connection" role="status">{connection === "live" ? "Connected" : "Reconnecting…"}</p></section>;
}

export function moveArcadePaddleByKey(position: { x: number; y: number }, key: string, step = 0.06): { x: number; y: number } | null {
  const normalized = key.toLowerCase();
  const delta = normalized === "arrowleft" || normalized === "a" ? [-step, 0]
    : normalized === "arrowright" || normalized === "d" ? [step, 0]
      : normalized === "arrowup" || normalized === "w" ? [0, -step]
        : normalized === "arrowdown" || normalized === "s" ? [0, step] : null;
  return delta ? { x: Math.max(0, Math.min(1, position.x + delta[0]!)), y: Math.max(0, Math.min(1, position.y + delta[1]!)) } : null;
}
