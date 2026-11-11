"use client";
import {useReturningArt,drawReturningArt} from "./useReturningArt";
/* eslint-disable @next/next/no-img-element -- Authenticated original art must preserve alpha and use the existing room-media authorization. */

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { FishFinalePublicEntry, FishFinaleSnapshot } from "../../../lib/arcade/fish-finale";
import { clamp, crossedFishCue, directedVictim, fishSeed, mix, sampleSwim, separateFish, sharkAt, chaseFeint, advanceSwimTime, sharkMouth, smooth, swimPersonality, type FishPose, type FishTankCue, type SharkPose } from "../../../lib/fish-motion";
import styles from "./FishTank.module.css";
import { FishMesh, fishSize } from "./FishMesh";
import { drawFishBurst, drawFishRelease, drawSharkWake } from "./FishEffects";

export type { FishTankCue } from "../../../lib/fish-motion";
export interface FishTankProps {
  snapshot: FishFinaleSnapshot;
  code: string;
  reducedMotion?: boolean;
  muted?: boolean;
  className?: string;
  compact?: boolean;
  /** One existing host audio owner can consume these; this component has no soundtrack. */
  onCue?: (cue: FishTankCue) => void;
  onAssetStatus?: (entryId: string, status: "ready" | "error") => void;
}

const media = (code: string, assetId: string) => `/api/rooms/${encodeURIComponent(code)}/media/${encodeURIComponent(assetId)}`;
const subscribeMotion = (callback: () => void) => { const query = window.matchMedia("(prefers-reduced-motion: reduce)"); query.addEventListener("change", callback); return () => query.removeEventListener("change", callback); };
const reducedSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Only explicitly marked practice entries use this original, deterministic art. */
function practiceArt(entry: FishFinalePublicEntry): string {
  const hue = fishSeed(entry.appearanceSeed) % 360;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768"><g stroke="#132642" stroke-width="13" stroke-linejoin="round"><path d="M330 382 158 240Q135 384 158 525Z" fill="hsl(${hue} 66% 65%)"/><path d="M446 268Q450 159 610 218L633 292M465 470Q490 578 630 529L650 448" fill="hsl(${(hue + 25) % 360} 70% 55%)"/><path d="M270 383C320 207 691 200 817 384 700 566 320 557 270 383Z" fill="hsl(${hue} 74% 70%)"/><path d="M389 319Q433 382 389 447M474 290Q518 382 474 474" fill="none" opacity=".25"/><ellipse cx="699" cy="338" rx="48" ry="53" fill="#fff9e9"/><ellipse cx="715" cy="340" rx="18" ry="25" fill="#132642"/><path d="M745 421Q775 437 788 405" fill="none" stroke-linecap="round"/></g><circle cx="703" cy="328" r="7" fill="white"/></svg>`)}`;
}

function artSource(entry: FishFinalePublicEntry, code: string): string | undefined { return entry.assetId ? media(code, entry.assetId) : entry.practice ? practiceArt(entry) : undefined; }

function drawSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, entry: FishFinalePublicEntry, pose: FishPose, width: number, height: number) {
  const size = fishSize(entry, pose, width, height);
  ctx.save(); ctx.translate(pose.x * width, pose.y * height); ctx.rotate(pose.pitch * pose.facing); ctx.scale(pose.facing * Math.max(.035, pose.yaw), 1); ctx.globalAlpha = pose.opacity;
  const left = -(entry.bounds.x + entry.bounds.width / 2) * size.width, top = -(entry.bounds.y + entry.bounds.height / 2) * size.height;
  if (pose.amplitude === 0) ctx.drawImage(image, left, top, size.width, size.height);
  else {
    // Fallback edges meet continuously: each strip shears from the same sampled
    // displacement as its neighbour. Screen-space overlap also covers raster
    // antialiasing during yaw, avoiding transparent hairlines through the body.
    const strips = width < 700 ? 14 : 24, sourceWidth = image.naturalWidth, sourceHeight = image.naturalHeight;
    const wave = (u: number) => { const along = clamp((u - entry.anchors.tail.x) / Math.max(.1, entry.anchors.head.x - entry.anchors.tail.x)); return Math.sin(pose.tailPhase + along * 5.2) * Math.pow(1 - along, 1.4) * size.width * pose.amplitude; };
    for (let i = 0; i < strips; i++) {
      const u = i / strips, next = (i + 1) / strips, dy = wave(u), end = wave(next);
      const overlap = sourceWidth / Math.max(1, size.width * Math.max(.035, pose.yaw)) * .85;
      const sourceStart = Math.max(0, u * sourceWidth - overlap), sourceEnd = Math.min(sourceWidth, next * sourceWidth + overlap);
      const padding = (u * sourceWidth - sourceStart) / sourceWidth * size.width;
      ctx.save(); ctx.translate(left + u * size.width, dy); ctx.transform(1, (end - dy) / (size.width / strips), 0, 1, 0, 0);
      ctx.drawImage(image, sourceStart, 0, sourceEnd - sourceStart, sourceHeight, -padding, top, (sourceEnd - sourceStart) / sourceWidth * size.width, size.height); ctx.restore();
    }
  }
  ctx.restore();
}

/** Original vector character: reusable tail, brow, gills, mouth and hinged jaw. */
function drawShark(ctx: CanvasRenderingContext2D, shark: SharkPose, width: number, height: number, front = false) {
  const open = shark.open;
  ctx.save(); ctx.translate(shark.x * width, shark.y * height); ctx.rotate(shark.pitch); ctx.scale(shark.size * width * shark.facing * shark.yaw, shark.size * width); ctx.globalAlpha = shark.opacity;
  ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = .025; ctx.strokeStyle = "#132844";
  const fillPath = (draw: () => void, fill: string | CanvasGradient, stroke = true) => { ctx.beginPath(); draw(); ctx.fillStyle = fill; ctx.fill(); if (stroke) ctx.stroke(); };
  if (!front) {
    const tail = Math.sin(shark.tailPhase) * .11;
    fillPath(() => { ctx.moveTo(-.88, .05); ctx.quadraticCurveTo(-1.25, -.2 + tail, -1.5, -.55 + tail); ctx.quadraticCurveTo(-1.52, -.1 + tail, -1.34, .04); ctx.quadraticCurveTo(-1.55, .23 + tail, -1.52, .53 + tail); ctx.quadraticCurveTo(-1.13, .32, -.88, .09); }, "#488b9d");
    fillPath(() => { ctx.moveTo(-.56, -.3); ctx.quadraticCurveTo(-.31, -.59, -.24, -.95); ctx.quadraticCurveTo(.02, -.88, .24, -.36); }, "#5793a4");
    const body = () => { ctx.moveTo(-1.08, .01); ctx.bezierCurveTo(-.6, -.5, .3, -.63, .87, -.26); ctx.quadraticCurveTo(1.22, -.05, 1.17, .13); ctx.quadraticCurveTo(1.07, .55, .28, .5); ctx.bezierCurveTo(-.43, .55, -.92, .23, -1.08, .01); };
    const skin = ctx.createLinearGradient(0, -.5, 0, .5); skin.addColorStop(0, "#92bdc8"); skin.addColorStop(.5, "#5f9eaf"); skin.addColorStop(1, "#32748e");
    fillPath(body, skin);
    ctx.save(); ctx.beginPath(); body(); ctx.clip();
    fillPath(() => { ctx.moveTo(-1.1, .03); ctx.bezierCurveTo(-.45, .28, .26, .16, 1.2, .07); ctx.lineTo(1.3, .7); ctx.lineTo(-1.2, .7); }, "#d6e6df", false);
    ctx.strokeStyle = "rgba(224,250,244,.4)"; ctx.lineWidth = .025; ctx.beginPath(); ctx.moveTo(-.68, -.23); ctx.quadraticCurveTo(-.03, -.48, .57, -.3); ctx.stroke();
    ctx.restore();
    fillPath(() => { ctx.moveTo(-.13, .22); ctx.quadraticCurveTo(.03, .6, .49, .72); ctx.quadraticCurveTo(.32, .4, .23, .18); }, "#43849b");
    ctx.strokeStyle = "#2e6076"; ctx.lineWidth = .022;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(.03 + i * .1, -.1); ctx.quadraticCurveTo(-.02 + i * .1, .02, .045 + i * .1, .15); ctx.stroke(); }
    // The cavity is behind the artwork mesh. The front layer closes over it.
    ctx.fillStyle = "#17263e"; ctx.beginPath(); ctx.ellipse(.88, .16, .305, .025 + open * .285, -.05, 0, Math.PI * 2); ctx.fill();
    if (open > .1) { ctx.fillStyle = "#6a7790"; ctx.beginPath(); ctx.ellipse(.84, .24 + open * .13, .19, open * .065, 0, 0, Math.PI * 2); ctx.fill(); }
    // One oversized expressive eye keeps the character theatrical and readable.
    ctx.strokeStyle = "#18384c"; ctx.lineWidth = .025;
    fillPath(() => ctx.ellipse(.64, -.19, .14, .155, -.12, 0, Math.PI * 2), "#fff5d8");
    ctx.fillStyle = "#17384b"; ctx.beginPath(); ctx.ellipse(.69, -.18, .054, .079, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(.706, -.21, .018, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = .039; ctx.beginPath(); ctx.moveTo(.48, -.36); ctx.quadraticCurveTo(.63, -.4, .79, -.3); ctx.stroke();
    ctx.fillStyle = "#32677b"; ctx.beginPath(); ctx.ellipse(1.04, -.065, .035, .021, -.2, 0, Math.PI * 2); ctx.fill();
  } else {
    // Thin lips and separate lower jaw preserve spatial contact at every bite.
    const top = .135 - open * .245, bottom = .19 + open * .275;
    ctx.strokeStyle = "#163a50"; ctx.lineWidth = .035;
    ctx.beginPath(); ctx.moveTo(.59, .16); ctx.quadraticCurveTo(.78, top - .06, 1.16, top + .04); ctx.stroke();
    ctx.fillStyle = "#f7f0d7"; ctx.strokeStyle = "#c3d9d4"; ctx.lineWidth = .008;
    for (let i = 0; i < 6; i++) { const x = .65 + i * .08; ctx.beginPath(); ctx.moveTo(x, top + .008); ctx.lineTo(x + .034, top + .07 + open * .015); ctx.lineTo(x + .068, top + .004); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    fillPath(() => { ctx.moveTo(.57, .18); ctx.quadraticCurveTo(.88, bottom + .15, 1.16, bottom - .025); ctx.lineTo(1.16, bottom + .05); ctx.quadraticCurveTo(.91, bottom + .29, .59, .36); }, "#b5d7d5");
    ctx.fillStyle = "#fff8df";
    for (let i = 0; i < 6; i++) { const x = .65 + i * .08; ctx.beginPath(); ctx.moveTo(x, bottom + .04); ctx.lineTo(x + .034, bottom - .025 - open * .025); ctx.lineTo(x + .068, bottom + .034); ctx.closePath(); ctx.fill(); }
    if (open < .15) { ctx.strokeStyle = "#173a4d"; ctx.lineWidth = .021; ctx.beginPath(); ctx.moveTo(.59, .165); ctx.quadraticCurveTo(.88, .25, 1.14, .17); ctx.stroke(); }
  }
  ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, reduced: boolean, tense: boolean) {
  ctx.clearRect(0, 0, width, height);
  // Restrained edge plants leave a broad, high-contrast exhibition in the middle.
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 7; i++) {
      const x = (side ? .975 - i * .014 : .025 + i * .014) * width;
      const h = height * (.12 + (i % 3) * .07), sway = reduced ? 0 : Math.sin(time * .46 + i * 1.7) * width * .008;
      ctx.beginPath(); ctx.moveTo(x, height); ctx.bezierCurveTo(x - width * .035, height - h * .35, x + sway + width * .03, height - h * .7, x + sway, height - h); ctx.bezierCurveTo(x + sway + width * .055, height - h * .6, x + width * .014, height - h * .2, x + width * .01, height); ctx.closePath();
      ctx.fillStyle = i % 2 ? "rgba(58,139,132,.36)" : "rgba(39,104,119,.45)"; ctx.fill();
    }
  }
  if (tense) { ctx.fillStyle = "rgba(6,13,32,.23)"; ctx.fillRect(0, 0, width, height); }
}

const bubbleSeeds = Array.from({ length: 21 }, (_, i) => fishSeed(`bubble:${i}`));

function drawBubbles(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, reduced: boolean) {
  ctx.strokeStyle = "rgba(173,229,226,.23)"; ctx.lineWidth = 1;
  for (let i = 0; i < (reduced ? 7 : 21); i++) {
    const seed = bubbleSeeds[i]!, speed = .012 + (seed % 13) * .001;
    const y = 1 - ((i * .1618 + time * speed) % 1), x = ((seed % 1000) / 1000) + Math.sin(time * .31 + i) * .008;
    const radius = 1.6 + (seed % 4);
    ctx.beginPath(); ctx.arc(x * width, y * height, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(234,255,248,.28)"; ctx.beginPath(); ctx.arc(x * width - radius * .28, y * height - radius * .3, .7, 0, Math.PI * 2); ctx.fill();
  }
}

function caption(snapshot: FishFinaleSnapshot): { eyebrow: string; title: string; detail: string } {
  if (["drawing", "grace", "readiness"].includes(snapshot.phase)) return { eyebrow: "YOUR LIVING DRAWING", title: "Into the aquarium", detail: "Your fish is ready. Waiting for the rest of the school." };
  if (snapshot.phase === "reveal") return { eyebrow: "THE LIVING EXHIBITION", title: snapshot.revealEntryId ? `Meet fish ${snapshot.entries.find(e => e.id === snapshot.revealEntryId)?.label ?? ""}` : "A tank full of character", detail: "Your original drawings. A little swimming magic." };
  if (snapshot.phase === "voting") return { eyebrow: "ON YOUR PHONES", title: "Rank your favourite fish", detail: `Your top ${snapshot.rankLimit} earn ${Array.from({ length: snapshot.rankLimit }, (_, i) => snapshot.rankLimit - i).join(", ")} points. Exact ties use a draw.` };
  if (snapshot.phase === "cinematic") {
    const kind = snapshot.cinematic?.event?.kind;
    if (kind === "peaceful-awards") return { eyebrow: "THE PEACEFUL TANK", title: "A little applause for every fish", detail: "Every original stays in the aquarium." };
    if (kind === "final-two") return { eyebrow: "THE LAST TWO SWIMMING", title: "Two fish. One dramatic shark.", detail: "Keep your eyes on the water…" };
    if (kind === "charge") return { eyebrow: "A VERY UNEXPECTED TWIST", title: "The little fish has other ideas", detail: "The shark has remembered an urgent appointment." };
    return { eyebrow: "THE LAST FISH SWIMMING", title: kind === "tension" ? "Something is stirring…" : kind === "shark-entry" ? "An uninvited dinner guest" : "A splash of suspense", detail: "Cartoon chomps. Everyone returns for the final aquarium." };
  }
  if (snapshot.phase === "aquarium") return { eyebrow: "THE ENCHANTED AQUARIUM", title: "A very fine school of fish", detail: "Choose a fish to meet its artist." };
  return { eyebrow: "SKETCH & SORCERY", title: "The Last Fish Swimming", detail: "A little colour. A little character. Your own fish." };
}

export function FishTank({ snapshot, code, reducedMotion, muted = false, className = "", compact = false, onCue, onAssetStatus }: FishTankProps) {
  const systemReduced = useSyncExternalStore(subscribeMotion, reducedSnapshot, () => false);
  const reduced = reducedMotion ?? systemReduced;
  const rearCanvas = useRef<HTMLCanvasElement>(null), meshCanvas = useRef<HTMLCanvasElement>(null), frontCanvas = useRef<HTMLCanvasElement>(null), surface = useRef<HTMLDivElement>(null);
  const returningArt=useReturningArt(code);const returningRef=useRef(returningArt);useEffect(()=>{returningRef.current=returningArt;},[returningArt]);
  const current = useRef({ snapshot, received: 0, reduced, muted, onCue, onAssetStatus });
  const mesh = useRef<FishMesh | null>(null), images = useRef(new Map<string, HTMLImageElement>()), hitAreas = useRef<Array<{ id: string; x: number; y: number; radius: number }>>([]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [simpleView, setSimpleView] = useState(false), [failed, setFailed] = useState<string[]>([]), [retry, setRetry] = useState(0), [selected, setSelected] = useState<string | null>(null), [readyCount, setReadyCount] = useState(0);
  const entryKey = JSON.stringify(snapshot.entries.map(e => [e.id, e.assetId, e.practice, e.appearanceSeed]));
  useEffect(() => { current.current = { ...current.current, snapshot, received: performance.now() }; }, [snapshot]);
  useEffect(() => { current.current = { ...current.current, reduced, muted, onCue, onAssetStatus }; }, [reduced, muted, onCue, onAssetStatus]);
  useEffect(() => { queueMicrotask(() => setSelected(null)); }, [snapshot.finaleId]);
  useEffect(() => {
    if (!selected || snapshot.phase !== "aquarium") return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("keydown", escape); before?.focus(); };
  }, [selected, snapshot.phase]);

  useEffect(() => {
    const entries = JSON.parse(entryKey) as Array<[string, string | undefined, boolean, number]>;
    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const owned: HTMLImageElement[] = [];
    const ids = new Set(entries.map(e => e[0]));
    for (const [id, image] of images.current) if (!ids.has(id)) { image.src = ""; images.current.delete(id); }
    queueMicrotask(() => { if (!cancelled) { setFailed([]); setReadyCount(images.current.size); } });
    for (const [id] of entries) {
      const entry = current.current.snapshot.entries.find(e => e.id === id); if (!entry) continue;
      const existing = images.current.get(id); if (existing?.complete && existing.naturalWidth && !retry) continue;
      const source = artSource(entry, code);
      if (!source) { queueMicrotask(() => { if (!cancelled) { setFailed(previous => previous.includes(id) ? previous : [...previous, id]); current.current.onAssetStatus?.(id, "error"); } }); continue; }
      const image = new Image(); image.decoding = "async"; owned.push(image);
      let finished = false, rasterized = false;
      const failure = () => { if (cancelled || finished) return; finished = true; setFailed(previous => previous.includes(id) ? previous : [...previous, id]); current.current.onAssetStatus?.(id, "error"); };
      const timer = setTimeout(failure, 10000); timers.push(timer);
      image.onload = () => {
        if (cancelled || finished) return;
        // Practice vectors are rasterized once, so the render loop samples PNGs
        // just like a real submission instead of repainting SVGs 400 times/frame.
        if (!rasterized && (entry.practice && !entry.assetId || image.naturalWidth > 512)) {
          rasterized = true;
          const raster = document.createElement("canvas"); raster.width = 512; raster.height = 384;
          const context = raster.getContext("2d");
          if (context) { context.drawImage(image, 0, 0, 512, 384); image.src = raster.toDataURL("image/png"); return; }
        }
        finished = true; clearTimeout(timer); images.current.set(id, image); setReadyCount(images.current.size); try { mesh.current?.texture(id, image, entry); } catch (error) { mesh.current?.dispose(); mesh.current = null; setSimpleView(true); if (surface.current) { surface.current.dataset.fishRenderer = "canvas"; delete surface.current.dataset.fishVolume; surface.current.dataset.fishRendererReason = error instanceof Error ? error.message : "Artwork mesh unavailable"; } } current.current.onAssetStatus?.(id, "ready");
      };
      image.onerror = failure; image.src = source;
    }
    return () => { cancelled = true; timers.forEach(clearTimeout); for (const image of owned) { image.onload = null; image.onerror = null; if (!image.complete) image.src = ""; } };
  }, [entryKey, code, retry, snapshot.finaleId]);

  useEffect(() => {
    const rear = rearCanvas.current, middle = meshCanvas.current, front = frontCanvas.current, host = surface.current;
    if (!rear || !middle || !front || !host) return;
    const back = rear.getContext("2d"), top = front.getContext("2d"); if (!back || !top) return;
    let width = 1, height = 1, frame = 0, previousTime = performance.now(), cosmeticTime = current.current.snapshot.elapsedMs / 1000, disposed = false;
    let previousEvent: { id: string; elapsedMs: number } | null = null, previousPhase = current.current.snapshot.phase;
    const consumed = new Set<string>();
    const personalities = new Map<string, ReturnType<typeof swimPersonality>>();
    const arrivals = new Map<string, number>();
    let lastStillSnapshot: FishFinaleSnapshot | null = null, lastStillReduced = false, dirty = true;
    let quality = 1, samples = 0, intervalSum = 0, renderSum = 0;
    let lastShark: SharkPose | undefined, sharkFrom: SharkPose | undefined, sharkEvent = "";
    const traitsFor = (entry: FishFinalePublicEntry) => {
      let traits = personalities.get(entry.id);
      if (!traits) { traits = swimPersonality(`${current.current.snapshot.finaleId}:${entry.appearanceSeed}:${entry.id}`); personalities.set(entry.id, traits); }
      return traits;
    };
    const cue = (event: FishTankCue) => { if (consumed.has(event.id)) return; consumed.add(event.id); if (consumed.size > 100) consumed.delete(consumed.values().next().value!); if (!current.current.muted) current.current.onCue?.(event); };
    const createMesh = () => {
      dirty = true;
      try { mesh.current?.dispose(); mesh.current = new FishMesh(middle); for (const [id, image] of images.current) { const entry = current.current.snapshot.entries.find(e => e.id === id); if (entry) mesh.current.texture(id, image, entry); } host.dataset.fishRenderer = "webgl"; host.dataset.fishVolume = "single-png"; delete host.dataset.fishRendererReason; queueMicrotask(() => { if (!disposed) setSimpleView(false); }); }
      catch (error) { mesh.current?.dispose(); mesh.current = null; delete host.dataset.fishVolume; host.dataset.fishRenderer = "canvas"; host.dataset.fishRendererReason = error instanceof Error ? error.message : "Graphics unavailable"; queueMicrotask(() => { if (!disposed) setSimpleView(true); }); }
    };
    const lost = (event: Event) => { dirty = true; event.preventDefault(); mesh.current?.dispose(); mesh.current = null; host.dataset.fishRenderer = "canvas"; delete host.dataset.fishVolume; setSimpleView(true); };
    const restored = () => createMesh();
    middle.addEventListener("webglcontextlost", lost); middle.addEventListener("webglcontextrestored", restored); createMesh();
    const resize = () => { const bounds = host.getBoundingClientRect(); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height); const dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 1.5, 1280 / width, 720 / height) * quality; dirty = true; for (const canvas of [rear, middle, front]) { const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr); if (canvas.width !== pixelWidth) canvas.width = pixelWidth; if (canvas.height !== pixelHeight) canvas.height = pixelHeight; } back.setTransform(dpr, 0, 0, dpr, 0, 0); top.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(host);
    const visibility = () => {
      previousTime = performance.now(); previousEvent = null;
      if (!document.hidden) {
        const state = current.current;
        const elapsed = state.snapshot.elapsedMs + (state.snapshot.paused ? 0 : Math.max(0, previousTime - state.received));
        cosmeticTime = elapsed / 1000; dirty = true;
      }
    };
    document.addEventListener("visibilitychange", visibility);
    const draw = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(draw);
      const state = current.current, game = state.snapshot;
      const dt = Math.max(0, (now - previousTime) / 1000); previousTime = now;
      if (document.hidden) return;
      cosmeticTime = advanceSwimTime(cosmeticTime, dt, game.paused || state.reduced);
      const still = game.paused || state.reduced;
      if (still && !dirty && lastStillSnapshot === game && lastStillReduced === state.reduced && images.current.size === arrivals.size) return;
      dirty = false; lastStillSnapshot = game; lastStillReduced = state.reduced;
      const renderStart = performance.now();
      const delta = game.paused ? 0 : Math.max(0, now - state.received);
      const elapsed = Math.min(game.elapsedMs + delta, game.deadline > game.phaseStartedAt ? game.deadline - game.phaseStartedAt : Infinity);
      const event = game.cinematic?.event ? { ...game.cinematic.event, elapsedMs: Math.min(game.cinematic.event.durationMs, game.cinematic.event.elapsedMs + delta) } : undefined;
      const tense = game.phase === "cinematic" && game.mode === "shark" && event?.kind !== "peaceful-awards";
      drawWater(back, width, height, cosmeticTime, state.reduced, tense);
      drawReturningArt(back,returningRef.current,game,elapsed,width,height,state.reduced);
      top.clearRect(0, 0, width, height); drawBubbles(top, width, height, cosmeticTime, state.reduced);
      if (event && !game.paused) { if (previousPhase !== "cinematic" && !previousEvent) previousEvent = { id: `before:${previousPhase}`, elapsedMs: 0 }; const nextCue = crossedFishCue(previousEvent, event); if (nextCue) cue(nextCue); previousEvent = { id: event.id, elapsedMs: event.elapsedMs }; }
      if (previousPhase !== game.phase) {
        if (!game.paused && elapsed < 1000 && game.phase === "champion") cue({ id: `${game.finaleId}:champion`, kind: "champion", intensity: 1 });
        if (!game.paused && elapsed < 1000 && game.phase === "aquarium") cue({ id: `${game.finaleId}:revival`, kind: "revival", intensity: .7 });
        previousPhase = game.phase;
      }
      let shark = tense ? sharkAt(event, cosmeticTime, width / height, state.reduced) : undefined;
      mesh.current?.begin(width, height);
      hitAreas.current = [];
      const visible = game.entries.filter(entry => game.phase !== "reveal" || game.revealedEntryIds.includes(entry.id) || game.revealEntryId === entry.id);
      const traits = visible.map(traitsFor);
      const free = separateFish(traits.map(p => sampleSwim(p, cosmeticTime, state.reduced)));
      if (shark && event && !state.reduced) {
        const school = free.filter((_, i) => visible[i]!.id !== event.targetEntryId && !game.cinematic?.eliminatedEntryIds.includes(visible[i]!.id));
        shark = chaseFeint(shark, event, school, width / height);
        if (sharkEvent !== event.id) { sharkFrom = lastShark; sharkEvent = event.id; }
        if (sharkFrom && event.elapsedMs < 550) {
          const blend = smooth(event.elapsedMs / 550);
          const yaw = mix(sharkFrom.facing * sharkFrom.yaw, shark.facing * shark.yaw, blend);
          shark = { ...shark, x: mix(sharkFrom.x, shark.x, blend), y: mix(sharkFrom.y, shark.y, blend), facing: yaw >= 0 ? 1 : -1, yaw: Math.abs(yaw), pitch: mix(sharkFrom.pitch, shark.pitch, blend) };
        }
        lastShark = shark;
        drawSharkWake(back, shark, width, height, cosmeticTime); drawShark(back, shark, width, height);
      }
      const poses = visible.map((entry, i) => {
        let pose = free[i]!;
        if (images.current.has(entry.id) && !arrivals.has(entry.id)) arrivals.set(entry.id, cosmeticTime);
        if (["drawing", "grace", "readiness"].includes(game.phase) && images.current.has(entry.id) && !state.reduced) {
          const drop = smooth((cosmeticTime - arrivals.get(entry.id)!) / 1.3);
          pose = { ...pose, x: mix(.5, pose.x, drop), y: mix(-.18, pose.y, drop), scale: mix(.85, pose.scale, drop) };
        }
        if (["champion", "artists", "closed"].includes(game.phase)) pose = { ...pose, opacity: 0 };
        if (game.phase === "reveal" && game.revealEntryId === entry.id) {
          const release = state.reduced ? 1 : smooth((elapsed % 3000) / 1500);
          pose = { ...pose, x: mix(.5, pose.x, release), y: mix(-.2, pose.y, release), scale: mix(1.25, pose.scale, release), pitch: pose.pitch * release };
        }
        if (game.phase === "cinematic") {
          const victim = event?.targetEntryId === entry.id && (event.kind === "hunt" || event.kind === "final-two");
          if (game.cinematic?.eliminatedEntryIds.includes(entry.id) && !victim) pose = { ...pose, opacity: 0 };
          if (event?.kind === "final-two" && !victim && pose.opacity > 0 && !state.reduced) { const stage = smooth(event.elapsedMs / 1700); pose = { ...pose, x: mix(pose.x, .3, stage), y: mix(pose.y, .53, stage), facing: stage > .7 ? 1 : pose.facing, yaw: mix(pose.yaw, 1, stage) }; }
          if (shark && !victim && pose.opacity > 0 && event?.kind === "hunt" && !state.reduced) { const mouth = sharkMouth(shark, width / height); const distance = Math.hypot(pose.x - mouth.x, (pose.y - mouth.y) * .65); const avoidance = smooth(1 - distance / .22); pose = { ...pose, y: clamp(pose.y + (pose.y < mouth.y ? -.12 : .12) * avoidance, .2, .78) }; }
          if (event?.kind === "peaceful-awards") {
            if (event.targetEntryId === entry.id) pose = { ...pose, scale: pose.scale * 1.16 };
          }
          if (victim && event) {
            const start = sampleSwim(traits[i]!, Math.max(0, cosmeticTime - event.elapsedMs / 1000), state.reduced);
            pose = state.reduced ? { ...pose, opacity: event.elapsedMs >= (event.biteAtMs ?? Infinity) ? 0 : 1 } : directedVictim(pose, start, event, shark, width / height);
          }
          if (event?.kind === "charge" && event.targetEntryId === entry.id) { const progress = state.reduced ? .5 : smooth(event.elapsedMs / event.durationMs); pose = { ...pose, x: mix(.3, .58, progress), y: .5, facing: 1, yaw: 1, pitch: -.04, scale: 1.18, amplitude: state.reduced ? 0 : .035 }; }
        }
        if (game.phase === "aquarium" && elapsed < 4000 && !state.reduced) {
          const drop = smooth((elapsed - i * 95) / 2600);
          pose = { ...pose, x: mix((i % 5 + .5) / Math.min(5, visible.length), pose.x, drop), y: mix(-.2 - Math.floor(i / 5) * .2, pose.y, drop), opacity: smooth(elapsed / 500), yaw: mix(1, pose.yaw, drop), facing: drop < .5 ? 1 : pose.facing };
        }
        return pose;
      });
      visible.map((entry, i) => ({ entry, pose: poses[i]! })).sort((a, b) => a.pose.depth - b.pose.depth).forEach(({ entry, pose }) => {
        const image = images.current.get(entry.id); if (!image || pose.opacity <= 0) return;
        if (mesh.current) mesh.current.draw(entry, pose, width, height); else drawSprite(back, image, entry, pose, width, height);
        if (event?.kind === "peaceful-awards" && event.targetEntryId === entry.id) {
          const size = fishSize(entry, pose, width, height);
          top.save(); top.strokeStyle = "rgba(226,215,156,.55)"; top.lineWidth = 1.5; top.beginPath(); top.ellipse(pose.x * width, pose.y * height, size.width * entry.bounds.width * .58, size.height * entry.bounds.height * .68, 0, 0, Math.PI * 2); top.stroke(); top.restore();
        }
        if (["reveal", "voting", "aquarium"].includes(game.phase) && (game.phase !== "aquarium" || elapsed < 11000)) {
          const size = fishSize(entry, pose, width, height); const y = pose.y * height + Math.min(size.height * entry.bounds.height / 2 + 20, height * .18);
          top.save(); top.globalAlpha = pose.opacity; top.font = `600 ${Math.max(13, Math.min(21, width / 65))}px "Space Grotesk Variable", sans-serif`; top.textAlign = "center"; top.textBaseline = "middle";
          const text = game.phase === "aquarium" ? entry.artistName ?? `Fish ${entry.label}` : entry.label;
          const max = width * .17, measured = top.measureText(text).width; top.fillStyle = "rgba(7,22,43,.8)"; top.beginPath(); top.roundRect(pose.x * width - Math.min(max, measured + 22) / 2, y - 14, Math.min(max, measured + 22), 28, 10); top.fill(); top.fillStyle = "#e4f8ee"; top.fillText(text, pose.x * width, y, max - 12); top.restore();
        }
        if(game.phase === "reveal" && game.revealEntryId === entry.id && !state.reduced){ const size=fishSize(entry,pose,width,height);drawFishRelease(top,width*.5,height*.51,size.width,(elapsed%3000)/1000); }
        if (game.phase === "aquarium") hitAreas.current.push({ id: entry.id, x: pose.x * width, y: pose.y * height, radius: Math.min(width * .095, height * .16) });
      });
      if (shark && !state.reduced) drawShark(top, shark, width, height, true);
      let fragments = 0;
      if (event?.biteAtMs !== undefined && event.targetEntryId && shark && !state.reduced) {
        const ageMs = event.elapsedMs - event.biteAtMs;
        if(ageMs >= 0 && ageMs < 1200){
          const index=visible.findIndex(e=>e.id===event.targetEntryId),entry=visible[index];
          const image=entry && images.current.get(entry.id);
          const atBite=sharkAt({...event,elapsedMs:event.biteAtMs},Math.max(0,cosmeticTime-ageMs/1000),width/height);
          if(entry&&image&&atBite){
            const mouth=sharkMouth(atBite,width/height);
            const pose=sampleSwim(traits[index]!,Math.max(0,cosmeticTime-ageMs/1000));
            const size=fishSize(entry,pose,width,height);
            fragments=drawFishBurst(top,image,event.id,ageMs,mouth.x*width,mouth.y*height,size.width,size.height,entry.bounds);
          }
        }
      }
      if(host.dataset.fishFragments!==String(fragments))host.dataset.fishFragments=String(fragments);
      // Bounded diagnostics and adaptive pixel cost, without skipping motion frames.
      renderSum += performance.now() - renderStart; intervalSum += dt * 1000; samples++;
      if (samples >= 90) {
        host.dataset.fishFrameMs = (intervalSum / samples).toFixed(1);
        host.dataset.fishRenderMs = (renderSum / samples).toFixed(1);
        host.dataset.fishCount = String(visible.length);
        host.dataset.fishQuality = quality.toFixed(2);
        if (!still && intervalSum / samples > 27 && renderSum / samples > 10 && quality > .55) { quality = Math.max(.55, quality - .15); resize(); }
        else if (!still && intervalSum / samples < 22 && renderSum / samples < 5 && quality < 1) { quality = Math.min(1, quality + .05); resize(); }
        samples = 0; intervalSum = 0; renderSum = 0;
      }
    };
    frame = requestAnimationFrame(draw);
    const decoded = images.current;
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); middle.removeEventListener("webglcontextlost", lost); middle.removeEventListener("webglcontextrestored", restored); mesh.current?.dispose(); mesh.current = null; for (const image of decoded.values()) { image.onload = null; image.onerror = null; image.src = ""; } decoded.clear(); hitAreas.current = []; };
  }, [snapshot.finaleId]);

  const copy = caption(snapshot), winner = snapshot.entries.find(e => e.id === snapshot.champion?.entryId);
  const chosen = snapshot.phase === "aquarium" ? snapshot.entries.find(e => e.id === selected) : undefined;
  const peaceful = snapshot.mode === "peaceful" || snapshot.cinematic?.event?.kind === "peaceful-awards" || ["showcase", "solo", "no-votes"].includes(snapshot.result?.kind ?? "");
  const final = ["artists", "aquarium"].includes(snapshot.phase);
  const lineup = snapshot.phase === "artists";
  const champion = snapshot.phase === "champion" && winner && snapshot.champion;
  return <section className={`${styles.tank} ${snapshot.phase === "cinematic" && snapshot.mode === "shark" && snapshot.cinematic?.event?.kind !== "peaceful-awards" ? styles.suspense : ""} ${className}`} data-testid="fish-tank" data-compact={compact} data-phase={snapshot.phase} data-paused={snapshot.paused} data-reduced-motion={reduced} data-event={snapshot.cinematic?.event?.kind} aria-label="The Last Fish Swimming aquarium">
    <div className={styles.water} aria-hidden="true" /><div className={styles.light} aria-hidden="true" />
    <div className={styles.renderSurface} ref={surface}>
      <canvas ref={rearCanvas} aria-hidden="true" /><canvas ref={meshCanvas} aria-hidden="true" data-testid="fish-mesh" /><canvas ref={frontCanvas} aria-hidden="true" />
      {snapshot.phase === "aquarium" && <button className={styles.hitPlane} aria-label="Select a swimming fish to meet its artist" onClick={event => { const bounds = surface.current?.getBoundingClientRect(); if (!bounds) return; const x = event.clientX - bounds.left, y = event.clientY - bounds.top; const target = event.detail === 0 ? hitAreas.current[0] : [...hitAreas.current].reverse().find(area => Math.hypot(area.x - x, area.y - y) < area.radius); if (target) setSelected(target.id); }} />}
      {snapshot.phase === "aquarium" && <div className={styles.fishTargets} aria-label="Meet the fish artists">{snapshot.entries.map((entry, index) => <button key={entry.id} onClick={() => setSelected(entry.id)} aria-label={`Meet ${entry.artistName ?? `fish ${entry.label}`}`} style={{ "--index": index } as CSSProperties}>{entry.label}</button>)}</div>}
    </div>
    {!champion && !lineup && <header className={styles.caption}><span>{copy.eyebrow}</span><h2>{copy.title}</h2><p>{snapshot.paused ? "The aquarium is paused. Every drawing is safe." : copy.detail}</p></header>}
    <span className={styles.mode}>{peaceful ? "✧ Peaceful tank" : "✦ Shark showdown"}</span>
    {snapshot.phase === "voting" && <div className={styles.ballots}><i /><strong>{snapshot.ballotCount}</strong><span>of {snapshot.expectedBallotCount}<br />ballots locked</span></div>}
    {snapshot.entries.length > 0 && readyCount === 0 && !failed.length && !champion && !lineup && <div className={styles.loading} role="status">Opening the aquarium…<small>Preparing your original artwork</small></div>}
    {snapshot.phase === "cinematic" && reduced && <div className={styles.reducedScene}><span aria-hidden="true">✦</span><p>{snapshot.cinematic?.event?.kind === "hunt" || snapshot.cinematic?.event?.kind === "final-two" ? `Fish ${snapshot.entries.find(e => e.id === snapshot.cinematic?.event?.targetEntryId)?.label ?? ""} takes a magical bubble break.` : snapshot.cinematic?.event?.kind === "charge" ? "Our last fish sends the shark on its way." : snapshot.cinematic?.event?.kind === "peaceful-awards" ? "A gentle celebration for the whole tank." : "The story continues, with calm motion."}</p></div>}
    {champion && <article className={styles.champion} data-testid="fish-champion"><div className={styles.championCopy}><span className={styles.eyebrow}>THE LAST FISH SWIMMING</span><span className={styles.crown} aria-hidden="true">♛</span><h2>{snapshot.champion!.label}</h2><p>{snapshot.champion!.artistName}</p><small>The original drawing. A well-earned bow.</small></div><div className={styles.winnerArt}><div className={styles.medallion} aria-hidden="true" />{artSource(winner, code) && <img src={artSource(winner, code)} alt={`Champion fish by ${snapshot.champion!.artistName}`} draggable={false} />}<span>FISH {winner.label}{winner.practice ? " · PRACTICE ART" : ""}</span></div></article>}
    {lineup && <div className={styles.lineupScene}><header><span className={styles.eyebrow}>THE ARTISTS, UNMASKED</span><h2>Every fish. Every imagination.</h2></header><div className={styles.lineup} style={{ "--columns": Math.min(5, Math.ceil(snapshot.entries.length / (snapshot.entries.length > 5 ? 2 : 1))) } as CSSProperties}>{snapshot.entries.map(entry => <figure key={entry.id}><div>{artSource(entry, code) && <img src={artSource(entry, code)} alt={`Fish ${entry.label}`} draggable={false} />}<b>{entry.label}</b></div><figcaption>{entry.artistName}<small>{entry.practice ? "PRACTICE ART" : "THE ORIGINAL ARTIST"}</small></figcaption></figure>)}</div></div>}
    {snapshot.phase === "aquarium" && snapshot.elapsedMs < 4000 && <div className={styles.revival} aria-live="polite">✦ {snapshot.mode === "shark" && ["voted", "lucky"].includes(snapshot.result?.kind ?? "") ? "Everyone’s back!" : "Everyone’s here!"}<small>Your artwork stays with the whole school.</small></div>}
    {chosen && <div className={styles.artistCard} role="dialog" aria-modal="false" aria-label={`Fish by ${chosen.artistName}`}><button ref={closeButton} className={styles.close} onClick={() => setSelected(null)} aria-label="Close artist card">×</button>{artSource(chosen, code) && <img src={artSource(chosen, code)} alt={`Original fish by ${chosen.artistName}`} />}<div><span>FISH {chosen.label}{chosen.practice ? " · PRACTICE ART" : ""}</span><h3>{chosen.artistName}</h3><p>The original drawing</p>{chosen.assetId && <a href={media(code, chosen.assetId)} download={`fish-${chosen.label}.png`}>Download fish ↓</a>}</div></div>}
    {failed.length > 0 && <div className={styles.renderNotice} role={failed.length ? "status" : undefined}>{failed.length ? <>Fish {failed.map(id => snapshot.entries.find(e => e.id === id)?.label).join(", ")} could not be displayed. <button onClick={() => setRetry(value => value + 1)}>Retry artwork</button></> : "Simple swimming view · your original drawings are preserved"}</div>}
    {!final && !champion && !lineup && !simpleView && <div className={styles.bottomNote} aria-hidden="true"><span>ORIGINAL ART</span><i /><span>{snapshot.entries.length ? `${snapshot.entries.length} FISH · ONE ENCHANTED TANK` : "DRAW ON YOUR PHONES"}</span></div>}
  </section>;
}
