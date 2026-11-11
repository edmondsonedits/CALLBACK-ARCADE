"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { ArcadeWireSnapshot } from "../../lib/arcade/presentation";
import styles from "./LightTrailsViews.module.css";

type Direction = "up" | "right" | "down" | "left";
type Rider = { playerId: string; x: number; y: number; direction: Direction; alive: boolean; distance: number };
type LightTrailsState = {
  width?: number;
  height?: number;
  status?: string;
  paused?: boolean;
  riders?: Rider[];
  trail?: number[] | string;
  viewer?: { role?: string; playerId?: string | null };
  result?: { winners?: string[]; tied?: boolean; distance?: Record<string, number> };
};

const COLORS = ["#46dbdc", "#ffd84b", "#ffad72", "#c9a7ff", "#81e6a5", "#ff8fab", "#91b8ff", "#fff1a6", "#a9dd73", "#d39bfb"];
const DIRECTIONS: Array<{ direction: Direction; label: string; x: number; y: number; symbol: string }> = [
  { direction: "up", label: "Steer up", x: 0.5, y: 0.08, symbol: "↑" },
  { direction: "left", label: "Steer left", x: 0.08, y: 0.5, symbol: "←" },
  { direction: "right", label: "Steer right", x: 0.92, y: 0.5, symbol: "→" },
  { direction: "down", label: "Steer down", x: 0.5, y: 0.92, symbol: "↓" },
];

export function LightTrailsHost({ game, names, connection, paused, onPauseToggle }: {
  game: ArcadeWireSnapshot | null;
  names: Record<string, string> | ReadonlyMap<string, string>;
  connection: string;
  paused: boolean;
  onPauseToggle: () => void;
}) {
  const state = (game?.state ?? {}) as LightTrailsState;
  const riders = Array.isArray(state.riders) ? state.riders.filter(isRider) : [];
  const nameFor = (id: string) => {
    const map = names as ReadonlyMap<string, string>;
    return typeof map.get === "function" ? map.get(id) ?? "Player" : (names as Record<string, string>)[id] ?? "Player";
  };
  const result = state.result;
  const winners = Array.isArray(result?.winners) ? result.winners : [];

  return <section className={styles.host} aria-label="Light Trails host screen">
    <header className={styles.header}>
      <div><p className={styles.kicker}>KING PROMPTER ARCADE</p><h1>Light Trails</h1></div>
      <span className={styles.connection} role="status">{connectionLabel(connection)}</span>
    </header>
    <div className={styles.arena}><LightTrailsCanvas game={game} label="Light Trails arena. Colored lines show each rider's trail." /></div>
    <div className={styles.footer}>
      <ul className={styles.riders} aria-label="Rider standings">
        {riders.map((rider, index) => <li key={rider.playerId}>
          <span className={styles.swatch} style={{ "--rider-color": COLORS[index % COLORS.length] } as CSSProperties} aria-hidden="true" />
          <span className={styles.riderName}>{nameFor(rider.playerId)}</span>
          <span className={styles.riderStatus}>{rider.alive ? "Riding" : "Crashed"}</span>
          <strong>{rider.distance}</strong><span className={styles.unit}>cells</span>
        </li>)}
      </ul>
      <div className={styles.hostActions}>
        <span className={styles.matchStatus} role="status">{paused || state.paused ? "Paused" : state.status === "complete" ? (result?.tied ? "It's a tie" : winners.length ? `${winners.map(nameFor).join(" & ")} wins` : "Match complete") : state.status === "active" ? "Match live" : "Waiting for match"}</span>
        <button type="button" className={styles.pauseButton} onClick={onPauseToggle} disabled={state.status === "complete"}>{paused ? "Resume" : "Pause"}</button>
      </div>
    </div>
  </section>;
}

export function LightTrailsPhone({ game, connection, role, paused, onInput }: {
  game: ArcadeWireSnapshot | null;
  connection: string;
  role: "player" | "spectator" | "host" | undefined;
  paused: boolean;
  onInput: (x: number, y: number) => void;
}) {
  const state = (game?.state ?? {}) as LightTrailsState;
  const playerId = state.viewer?.playerId;
  const me = state.riders?.find((rider) => isRider(rider) && rider.playerId === playerId);
  const canControl = role === "player" && connection === "live" && !paused && !state.paused && state.status === "active" && Boolean(me?.alive);
  const unavailableText = role !== "player" ? "This phone is watching the match." : me && !me.alive ? "Your rider crashed. Watch the rest of the match." : paused || state.paused ? "The match is paused." : connection !== "live" ? "Reconnecting to your room…" : "Waiting for your rider seat…";
  const steer = (x: number, y: number) => { if (canControl) onInput(x, y); };
  const onKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!canControl) return;
    const key = event.key.toLowerCase();
    const move = key === "arrowup" || key === "w" ? DIRECTIONS[0]
      : key === "arrowleft" || key === "a" ? DIRECTIONS[1]
        : key === "arrowright" || key === "d" ? DIRECTIONS[2]
          : key === "arrowdown" || key === "s" ? DIRECTIONS[3] : undefined;
    if (!move) return;
    event.preventDefault();
    steer(move.x, move.y);
  };

  return <section className={styles.phone} aria-label="Light Trails phone controller">
    <p className={styles.kicker}>LIGHT TRAILS</p>
    <h1>{me?.alive ? "Choose your next turn" : "Ride the light"}</h1>
    <p className={styles.instructions}>Tap a direction before the next grid step. You can also use the arrow keys or WASD.</p>
    <div className={styles.dpad} role="group" aria-label="Steering directions">
      {DIRECTIONS.map((direction) => <button
        key={direction.direction}
        type="button"
        className={`${styles.directionButton} ${styles[direction.direction]}`}
        disabled={!canControl}
        onKeyDown={onKeys}
        onClick={() => steer(direction.x, direction.y)}
        aria-label={direction.label}
      >{direction.symbol}</button>)}
    </div>
    <p className={styles.phoneStatus} role="status">{canControl ? "Connected · steer anytime" : unavailableText}</p>
    <p className={styles.phoneStatus}>{me ? `${me.distance} cells travelled` : connectionLabel(connection)}</p>
  </section>;
}

export function LightTrailsCanvas({ game, label }: { game: ArcadeWireSnapshot | null; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    const render = () => {
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const width = 1024;
      const height = 576;
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        canvas.width = width * ratio;
        canvas.height = height * ratio;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = "#071525";
      context.fillRect(0, 0, width, height);
      const state = game?.state as LightTrailsState | undefined;
      const cols = Math.max(1, Math.min(64, Number.isInteger(state?.width) ? state!.width! : 64));
      const rows = Math.max(1, Math.min(36, Number.isInteger(state?.height) ? state!.height! : 36));
      const cellW = width / cols;
      const cellH = height / rows;
      context.strokeStyle = "rgba(189,222,255,.065)";
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x <= cols; x += 1) { context.moveTo(x * cellW, 0); context.lineTo(x * cellW, height); }
      for (let y = 0; y <= rows; y += 1) { context.moveTo(0, y * cellH); context.lineTo(width, y * cellH); }
      context.stroke();
      const trail = Array.isArray(state?.trail) || typeof state?.trail === "string" ? state.trail : [];
      const riders = Array.isArray(state?.riders) ? state.riders.filter(isRider) : [];
      const cellCount = cols * rows;
      for (let i = 0; i < Math.min(cellCount, trail.length); i += 1) {
        const owner = typeof trail === "string" ? parseInt(trail[i]!, 36) : trail[i];
        if (!Number.isInteger(owner) || owner! <= 0 || owner! > riders.length) continue;
        const x = i % cols;
        const y = Math.floor(i / cols);
        context.fillStyle = COLORS[(owner! - 1) % COLORS.length]!;
        context.globalAlpha = 0.72;
        context.fillRect(x * cellW + 1.4, y * cellH + 1.4, Math.max(1, cellW - 2.8), Math.max(1, cellH - 2.8));
      }
      context.globalAlpha = 1;
      riders.forEach((rider, index) => {
        if (!rider.alive || rider.x < 0 || rider.x >= cols || rider.y < 0 || rider.y >= rows) return;
        const x = (rider.x + 0.5) * cellW;
        const y = (rider.y + 0.5) * cellH;
        context.fillStyle = COLORS[index % COLORS.length]!;
        context.shadowColor = COLORS[index % COLORS.length]!;
        context.shadowBlur = 14;
        context.beginPath();
        context.arc(x, y, Math.min(cellW, cellH) * 0.43, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
      });
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [game]);
  return <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label} />;
}

function isRider(value: unknown): value is Rider {
  if (!value || typeof value !== "object") return false;
  const rider = value as Partial<Rider>;
  return typeof rider.playerId === "string" && Number.isSafeInteger(rider.x) && Number.isSafeInteger(rider.y) && typeof rider.alive === "boolean" && Number.isFinite(rider.distance);
}

function connectionLabel(connection: string): string {
  return connection === "live" ? "LIVE" : connection === "unavailable" ? "RECONNECTING" : "CONNECTING";
}
