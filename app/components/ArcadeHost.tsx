"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { HostAction, HostSnapshot } from "../../lib/contracts";
import { arcadeHostResultScore, arcadeLobbySeatLabel } from "../../lib/arcade/presentation";
import type { ArcadeWireSnapshot } from "../../lib/arcade/presentation";
import { ARCADE_GAMES, getArcadeMinimumPlayers } from "../../lib/arcade/catalog";
import BotSwitch from "./BotSwitch";
export type { ArcadeWireSnapshot } from "../../lib/arcade/presentation";

const NATIVE_BOT_GAMES = new Set([
  "arena-survivor", "buzzwort", "chaos-kommando", "drift-racer", "flatterfluff", "kartentisch",
  "magic-arena", "magic-duell", "minions-td", "zeichnen-und-erraten", "imposter", "pantomime",
  "schaetzorama", "schattenjagd", "dungeon-party", "word-tiles",
]);

export function ArcadeHost({ snapshot, game, connection, act, busy = false }: {
  snapshot: HostSnapshot;
  game: ArcadeWireSnapshot | null;
  connection: string;
  act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>;
  busy?: boolean;
}) {
  const players = snapshot.players.filter((player) => player.role === "player");
  const state = game?.state ?? {};
  const { resultIds, score } = arcadeHostResultScore(snapshot, game);
  const controllerIds = (snapshot as HostSnapshot & { arcadeControllerIds?: string[] }).arcadeControllerIds ?? [];
  const botSeats = snapshot.botSeats ?? [];
  const nativeBotGame = Boolean(snapshot.arcadeGameId && NATIVE_BOT_GAMES.has(snapshot.arcadeGameId));
  const humanLobbySlots = new Set(players.filter((player) => player.active && !player.bot && Number.isInteger(player.lobbySlot)).map((player) => player.lobbySlot));
  const controllerCount = controllerIds.length;
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const minimumPlayers = getArcadeMinimumPlayers(snapshot.arcadeGameId ?? "air-hockey");
  const result = snapshot.arcade?.result && typeof snapshot.arcade.result === "object" ? snapshot.arcade.result as { winners?: unknown; tied?: unknown } : {};
  const winnerNames = Array.isArray(result.winners) ? result.winners.filter((id): id is string => typeof id === "string").map((id) => names.get(id) ?? "Player") : [];
  return <section className="arcade-host" aria-label="Arcade host screen">
    <header className="arcade-topbar"><Link href="/" aria-label="Return to King Prompter home">KING PROMPTER</Link><span>ARCADE · {snapshot.arcadeGameId ?? "Game"}</span><span>ROOM {snapshot.code}</span></header>
    {snapshot.phase === "LOBBY" ? <section className="arcade-host-card">
      <p className="arcade-kicker">KING PROMPTER ARCADE</p>
      <h1>{title(snapshot.arcadeGameId)}</h1>
      <p>{nativeBotGame ? "Players join on their phones. Local bots fill open seats for practice; the big screen stays in King Prompter." : "Players join on their phones. The big screen stays in King Prompter."}</p>
      <div className="arcade-seat-list">{players.map((player) => <span key={player.id}>{arcadeLobbySeatLabel(player, controllerIds)} · {player.nickname}</span>)}</div>
      {nativeBotGame && <div aria-label="Local bot seats" className="lobby-bot-seat-list">{Array.from({ length: 10 }, (_, index) => index + 1).filter((seat) => !humanLobbySlots.has(seat)).map((seat) => {
        const enabled = botSeats.includes(seat);
        return <BotSwitch key={seat} number={seat} enabled={enabled} disabled={!enabled && controllerCount >= 10} onChange={(next) => void act("SET_BOT_SEAT", { seat, enabled: next })} />;
      })}</div>}
      <button className="arcade-action" disabled={busy || controllerCount < minimumPlayers} onClick={() => void act("START_GAME")}>{controllerCount < minimumPlayers ? `Waiting for ${minimumPlayers} players` : "Start Game"}</button>
      <p className="arcade-connection" role="status">{nativeBotGame ? "Native game ready in this room; bot turns are deterministic." : connection === "unavailable" ? "Realtime game service unavailable" : connection === "live" ? "Ready" : "Connecting to game…"}</p>
    </section> : snapshot.phase === "ARCADE_RESULTS" ? <section className="arcade-host-card arcade-results"><p className="arcade-kicker">Match complete</p><h1>{snapshot.arcadeGameId === "light-trails" ? "Final ride" : "Final score"}</h1>{result.tied === true ? <p>It’s a tie!</p> : winnerNames.length > 0 ? <p>{winnerNames.join(" & ")} {winnerNames.length > 1 ? "win" : "wins"}!</p> : null}<ScoreCards ids={resultIds} score={score} names={names} /><p>Choose Play again to return to this room’s lobby.</p><button className="arcade-action" disabled={busy} onClick={() => void act("PLAY_AGAIN")}>Play again</button></section> : <section className="arcade-live"><div className="arcade-scoreboard"><ScoreCards ids={(state.players as string[] | undefined) ?? []} score={score} names={names} /></div><ArcadeCanvas snapshot={game} label={`${title(snapshot.arcadeGameId)} match`} /><div className="arcade-host-controls"><span role="status" className="arcade-connection">{connection === "live" ? "LIVE" : connection === "unavailable" ? "RECONNECTING" : "CONNECTING"}</span><button onClick={() => void act(snapshot.paused ? "RESUME" : "PAUSE")} disabled={busy}>{snapshot.paused ? "Resume" : "Pause"}</button></div></section>}
  </section>;
}

function ScoreCards({ ids, score, names }: { ids: string[]; score: Record<string, number>; names: Map<string, string> }) {
  return <div className="arcade-scores">{ids.map((id) => <div className="arcade-score" key={id}><span>{names.get(id) ?? "Player"}</span><strong>{Number(score[id] ?? 0)}</strong></div>)}</div>;
}

export function ArcadeCanvas({ snapshot, label }: { snapshot: ArcadeWireSnapshot | null; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousRef = useRef<ArcadeWireSnapshot | null>(null);
  const currentRef = useRef<ArcadeWireSnapshot | null>(snapshot);
  const currentAtRef = useRef(0);
  useEffect(() => { if (snapshot && snapshot !== currentRef.current) { previousRef.current = currentRef.current; currentRef.current = snapshot; currentAtRef.current = performance.now(); } }, [snapshot]);
  useEffect(() => {
    const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (!canvas || !context) return;
    let animation = 0;
    const render = (now: number) => {
      const current = currentRef.current; const state = current?.state;
      const width = canvas.clientWidth || 1000; const height = canvas.clientHeight || 600;
      if (canvas.width !== Math.round(width * devicePixelRatio) || canvas.height !== Math.round(height * devicePixelRatio)) { canvas.width = Math.round(width * devicePixelRatio); canvas.height = Math.round(height * devicePixelRatio); }
      context.setTransform(canvas.width / 1000, 0, 0, canvas.height / 600, 0, 0);
      context.clearRect(0, 0, 1000, 600); context.fillStyle = "#072d2a"; context.fillRect(0, 0, 1000, 600);
      context.strokeStyle = "rgba(255,255,255,.55)"; context.lineWidth = 5; context.strokeRect(8, 8, 984, 584); context.beginPath(); context.moveTo(500, 8); context.lineTo(500, 592); context.stroke(); context.beginPath(); context.arc(500, 300, 92, 0, Math.PI * 2); context.stroke();
      const puck = state?.puck as { x: number; y: number } | undefined; const paddles = state?.paddles as Array<{ x: number; y: number }> | undefined;
      if (puck && paddles) {
        const priorState = previousRef.current?.state; const priorPuck = priorState?.puck as typeof puck | undefined; const priorPaddles = priorState?.paddles as typeof paddles | undefined; const blend = Math.min(1, Math.max(0, (now - currentAtRef.current) / 50));
        const mix = (a: number, b: number) => a + (b - a) * blend;
        paddles.forEach((pad, i) => { const before = priorPaddles?.[i] ?? pad; context.beginPath(); context.fillStyle = i % 2 ? "#ffd84b" : "#46dbdc"; context.arc(mix(before.x, pad.x), mix(before.y, pad.y), 32, 0, Math.PI * 2); context.fill(); });
        context.beginPath(); context.fillStyle = "#fff8df"; context.arc(mix(priorPuck?.x ?? puck.x, puck.x), mix(priorPuck?.y ?? puck.y, puck.y), 16, 0, Math.PI * 2); context.fill();
      }
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render); return () => cancelAnimationFrame(animation);
  }, []);
  return <canvas ref={canvasRef} className="arcade-table" aria-label={label} role="img" />;
}

function title(id: string | null | undefined) { return ARCADE_GAMES.find((game) => game.id === id)?.title ?? "Arcade game"; }
