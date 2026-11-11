"use client";

import { useEffect, useRef } from "react";
import type { PracticeGameId } from "../../lib/arcade/practice/types";
import { practiceSceneEntities } from "./practice-scene-model";

 type Dict = Record<string, unknown>;
const record = (value: unknown): Dict => value && typeof value === "object" ? value as Dict : {};
const number = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const worldPoint = (x: number, y: number, cx: number, cy: number, scale: number) => [cx + x * scale, cy + y * scale] as const;

function drawSnapshot(ctx: CanvasRenderingContext2D, gameId: PracticeGameId, raw: unknown, width: number, height: number, names?:Record<string,string>, online=false): void {
  const scene = practiceSceneEntities(gameId, raw);
  const state = scene.state, cx = width / 2, cy = height / 2, scale = Math.max(1, Math.min(width, height) / 22);
  ctx.clearRect(0, 0, width, height);
  const background = ctx.createLinearGradient(0, 0, width, height); background.addColorStop(0, "#182945"); background.addColorStop(1, "#09131f");
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  const floor = record(state.floor);
  if (Array.isArray(floor.tiles) && typeof floor.size === "number") {
    const size = number(floor.size), extent = number(floor.halfExtent, 9), tileSize = extent * 2 / Math.max(1, size);
    for (const [index, rawTile] of floor.tiles.entries()) {
      const tile = record(rawTile), col = index % size, row = Math.floor(index / size);
      ctx.fillStyle = ({ safe: "#28445b", damaged: "#9a6e44", cracking: "#ec7957", falling: "#c68a5b", destroyed: "#070c14", gone: "#070c14" } as Record<string, string>)[String(tile.state)] ?? "#28445b";
      ctx.fillRect(cx + (-extent + col * tileSize) * scale + 1, cy + (-extent + row * tileSize) * scale + 1, tileSize * scale - 2, tileSize * scale - 2);
    }
  } else if (gameId === "roller-ruckus") {
    ctx.fillStyle = "#47645e"; ctx.beginPath(); ctx.ellipse(cx, cy, scale * 9.1, scale * 6.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0a1420"; ctx.beginPath(); ctx.ellipse(cx, cy, scale * 6.7, scale * 4.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([9, 9]); ctx.strokeStyle = "#d5d7bc88"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, scale * 8.2, scale * 5.2, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  } else if (gameId === "sky-balls") {
    ctx.fillStyle = "#174c64"; ctx.fillRect(width * .12, height * .12, width * .76, height * .76);
    ctx.strokeStyle = "#b7f5ff99"; ctx.lineWidth = 3; ctx.setLineDash([9, 8]); ctx.strokeRect(width * .12, height * .12, width * .76, height * .76); ctx.setLineDash([]);
  } else {
    const radius = number(state.arenaRadius, 9.2) * scale;
    ctx.fillStyle = gameId === "sumo" ? "#335456" : "#1a3441"; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = gameId === "sumo" ? "#ffe09a" : "#8ee8d155"; ctx.lineWidth = gameId === "sumo" ? 5 : 2;
    if (number(state.collapseWarningTicks) > 0) ctx.setLineDash([10, 9]);
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  if (["twisted-system", "scratch-match", "mystery-beat", "rhythm"].includes(gameId)) {
    const lanes = gameId === "twisted-system" ? 2 : 4;
    for (let i = 0; i < lanes; i++) {
      const x = width * (.15 + (.7 * (i + .5)) / lanes); ctx.fillStyle = ["#ff6b64", "#64d4ff", "#ffe074", "#b88aff"][i]!;
      ctx.globalAlpha = .18; ctx.fillRect(x - 22, height * .17, 44, height * .66); ctx.globalAlpha = 1;
    }
  }
  for (const entity of scene.entities) {
    const kind = String(entity.sceneKind), [x, y] = worldPoint(number(entity.x), number(entity.y), cx, cy, scale);
    const r = Math.max(5, scale * number(entity.radius, number(entity.size, kind === "target" ? .55 : .23)));
    ctx.fillStyle = kind === "bombs" || kind === "mines" ? "#ff9b5b" : kind === "targets" || kind === "target" ? "#fff097" : kind === "hazards" || kind === "hazard" ? "#ff695e" : kind === "creatures" ? (entity.ownerId ? "#68e5bd" : "#ffe074") : kind === "shots" || kind === "projectiles" || kind === "specialProjectiles" ? "#a8f0ff" : "#e8bf72";
    if (["crates", "walls"].includes(kind)) { ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.strokeStyle = "#fff0c0"; ctx.lineWidth = 2; ctx.strokeRect(x - r, y - r, 2 * r, 2 * r); }
    else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const rawWall of list(state.walls)) {
    const wall = record(rawWall), [x, y] = worldPoint(number(wall.x), number(wall.y), cx, cy, scale), r = scale * .55;
    ctx.fillStyle = wall.phase === "warning" ? "#ffcc6688" : "#98a7b8"; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (const path of scene.paths) {
    if (path.length < 2) continue;
    ctx.strokeStyle = "#64d4ffb8"; ctx.lineWidth = Math.max(3, scale * .12); ctx.lineJoin = "round"; ctx.beginPath();
    path.forEach(([rawX, rawY], index) => { const [x, y] = worldPoint(rawX / 100, rawY / 100, cx, cy, scale); if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
  }
  for (const note of scene.notes) {
    const lane = Math.max(0, Math.min(3, Math.round(number(note.lane)))), now = number(gameId==="mystery-beat"?state.phaseTick:state.tick), ticksAway = number(note.tick, now + 10) - now;
    const x = width * (.15 + (.7 * (lane + .5)) / 4), y = height * .76 - Math.max(-2, Math.min(30, ticksAway)) * height * .018;
    ctx.fillStyle = ["#ff6b64", "#64d4ff", "#ffe074", "#b88aff"][lane]!; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  }
  if (gameId === "twisted-system") {
    const now = number(state.tick), hitLine = height * .68;
    ctx.strokeStyle = "#fff4d877"; ctx.setLineDash([7, 7]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(width * .16, hitLine); ctx.lineTo(width * .84, hitLine); ctx.stroke(); ctx.setLineDash([]);
    for (const [index, cue] of scene.cues.entries()) {
      const ticksAway = number(cue.hitTick, now + 20) - now;
      const progress = Math.max(0, Math.min(1, 1 - ticksAway / 45));
      const x = width * (.28 + progress * .44);
      const action = cue.requiredAction === "jump" ? "JUMP" : cue.requiredAction === "duck" ? "DUCK" : "OBSTACLE";
      ctx.fillStyle = cue.requiredAction === "jump" ? "#ffe074" : cue.requiredAction === "duck" ? "#64d4ff" : "#fff4d8";
      ctx.beginPath(); ctx.arc(x, hitLine - (index % 2) * 17, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#09131f"; ctx.font = "900 9px system-ui"; ctx.textAlign = "center"; ctx.fillText(action, x, hitLine - (index % 2) * 17 + 3);
    }
  }
  if (state.penguin) {
    const hazard = record(state.penguin), [x, y] = worldPoint(number(hazard.x), number(hazard.y), cx, cy, scale);
    ctx.fillStyle = hazard.state === "warning" ? "#ffd478" : "#f4f2dd"; ctx.beginPath(); ctx.ellipse(x, y, scale * .4, scale * .55, 0, 0, Math.PI * 2); ctx.fill();
  }
  const players = record(state.players);
  for (const [index,[id,rawPlayer]] of Object.entries(players).entries()) {
    const player = record(rawPlayer);
    const [x, y] = gameId === "twisted-system"
      ? [width * (.15 + (.7 * (number(player.laneIndex) + .5)) / 2), height * .82] as const
      : worldPoint(number(player.x), number(player.y), cx, cy, scale);
    ctx.save(); ctx.globalAlpha = player.alive === false || player.eliminated === true ? .35 : 1; ctx.fillStyle = online?["#64d4ff","#ff6b64","#ffe074","#b88aff","#68e5bd","#ffad68","#d9efff","#ff86cf","#bde785","#abafff"][index%10]! : "#64d4ff"; ctx.strokeStyle = "#f5f4df"; ctx.lineWidth = 3;
    if (gameId === "jungle-fox" || gameId === "metal-fox") { ctx.translate(x, y); ctx.rotate(number(player.heading)); ctx.fillRect(-scale * .38, -scale * .28, scale * .76, scale * .56); ctx.fillRect(0, -scale * .07, scale * .68, scale * .14); }
    else { ctx.beginPath(); ctx.arc(x, y, scale * .48, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#07131f"; ctx.font = `800 ${Math.max(10, scale * .26)}px system-ui`; ctx.textAlign = "center"; ctx.fillText(online?(names?.[id]??"BOT "+(index+1)):"YOU", x, y + 4); }
    ctx.restore();
  }
  const tick = number(state.tick); ctx.fillStyle = "#fff5d8"; ctx.font = "700 15px system-ui"; ctx.textAlign = "left"; ctx.fillText(`${online?"ONLINE":"PRACTICE"}  ·  ${Math.floor(tick / 30)}s`, 18, 28);
}

export default function ArcadePracticeScene({ gameId, snapshot, tick, online=false, playerNames }: { readonly gameId: PracticeGameId; readonly snapshot: unknown; readonly tick: number;readonly online?:boolean;readonly playerNames?:Record<string,string> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null), snapshotRef = useRef(snapshot),namesRef=useRef(playerNames);
  useEffect(() => { snapshotRef.current = snapshot;namesRef.current=playerNames; }, [snapshot,playerNames]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0, width = 0, height = 0;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
      canvas.width = Math.floor(width * dpr); canvas.height = Math.floor(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const paint = () => { drawSnapshot(ctx, gameId, snapshotRef.current, width, height,namesRef.current,online); frame = requestAnimationFrame(paint); };
    frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [gameId,online]);
  return <canvas ref={canvasRef} className="arcade-practice-canvas" role="img" aria-label={`${gameId} ${online?"online match":"solo practice arena"}`} data-practice-tick={tick} />;
}
