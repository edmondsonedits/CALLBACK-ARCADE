"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import {ScrollPanel} from "../ScrollPanel";
import Link from "next/link";
import { addOperation, DRAWING_COLORS, DRAWING_DRAFT_KEY, DRAWING_PROMPT_MAX_LENGTH, DRAWING_SIZE, drawingSize, emptyDrawing, paintDrawingOperation, parseDraft, redoDrawing, renderDrawing, screenDrawingSize, undoDrawing, type DrawingDocument, type DrawingOperation, type DrawingPoint, type DrawingTool, type SelectionOperation } from "../../../lib/drawing-studio";
import { DEFAULT_DRAWING_PROMPTS, nextDrawingPrompts } from "../../../lib/drawing-prompts";
import { EDITOR_TOOLS, OTHER_TOOLS, beginPinch, movePinch, circleEnd, colorAllowed, defaultTool, encodeSelection, operationAllowed, selectionContains, selectionRect, starterOperations, toolAllowed, type EditorTool, type Pinch, type Position, type SelectionRect } from "../../../lib/drawing-editor";
import { StudioIcon } from "./StudioIcon";
import styles from "./DrawingStudio.module.css";
import { drawingToPngBlob } from "../../../lib/drawing-export";

type Modal = "tools" | "colors" | "brush" | "options" | "idea" | "clear" | "new-page" | "review" | "help" | null;
type StudioTool = EditorTool;
const TOOL_NAMES: Record<StudioTool, string> = { pen: "Pen", eraser: "Eraser", fill: "Fill", line: "Line", rectangle: "Rectangle", ellipse: "Oval", pan: "Hand", select: "Select", spray: "Spray can" };
const MODAL_TITLES = { tools: "Shapes & tools", colors: "Ink colour", brush: "Brush & spray", options: "More options", idea: "Pick one to draw", clear: "A fresh sheet?", "new-page": "Start a new page?", review: "Your sketch is ready.", help: "Drawing help" };
const WIDTHS = [3, 8, 18, 34];

export interface DrawingStudioProps {
  draftKey?: string;
  theme?: "sorcery";
  restriction?: string;
  starter?: string;
  prompts?: readonly string[];
  fixedPrompt?: string;
  fixedPromptLabel?: string;
  deadline?: number | null;
  serverTime?: number;
  paused?: boolean;
  onSubmit?: (blob: Blob, prompt: string) => Promise<void>;
}

export function DrawingStudio(props: DrawingStudioProps = {}) {
  return <DrawingStudioCanvas key={`${props.draftKey ?? DRAWING_DRAFT_KEY}:${props.restriction ?? ""}:${props.starter ?? ""}`} {...props} />;
}

function DrawingStudioCanvas({ theme, restriction, starter, draftKey = DRAWING_DRAFT_KEY, prompts, fixedPrompt, fixedPromptLabel = "DRAW THIS CAPTION", deadline, serverTime, paused = false, onSubmit }: DrawingStudioProps) {
  const [assignment] = useState(() => ({ prompts: prompts ? prompts.map((value) => value.trim().slice(0, DRAWING_PROMPT_MAX_LENGTH)).filter(Boolean) : [...DEFAULT_DRAWING_PROMPTS], fixedPrompt: fixedPrompt?.trim().slice(0, DRAWING_PROMPT_MAX_LENGTH) || undefined }));
  const controlled = Boolean(onSubmit);
  const submitting = useRef(false);
  const autoAttempted = useRef(false);
  const serverClock = useRef<{ time: number; receivedAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const locked = paused || busy || submitted || !ready;
  const studio = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  const documentRef = useRef<DrawingDocument>(emptyDrawing());
  const active = useRef<DrawingOperation | null>(null);
  const owner = useRef<number | null>(null);
  const animation = useRef<number | null>(null);
  const dirty = useRef(false);
  const initialized = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [drawing, setDrawing] = useState<DrawingDocument>(emptyDrawing);
  const [tool, setTool] = useState<StudioTool>(() => defaultTool(restriction));
  const [color, setColor] = useState<string>(DRAWING_COLORS[0]);
  const [width, setWidth] = useState(restriction === "giant-brush" ? 48 : 8);
  const [spraySize, setSpraySize] = useState(28);
  const [opacity, setOpacity] = useState(0.45);
  const [saveStatus, setSaveStatus] = useState("Ready to draw");
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [preview, setPreview] = useState("");
  const [promptChoices, setPromptChoices] = useState<string[]>(() => assignment.prompts);
  const [customPrompt, setCustomPrompt] = useState("");
  const [view, setView] = useState<"fill" | "fit">("fit");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panOrigin = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const touches = useRef(new Map<number, Position>());
  const pinch = useRef<Pinch | null>(null);
  const gesturing = useRef(false);
  const selected = useRef<SelectionOperation | null>(null);
  const selectionDirty = useRef(false);
  const [selection, setSelection] = useState<SelectionOperation | null>(null);
  const clipboard = useRef<SelectionOperation | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);
  const [marquee, setMarquee] = useState<SelectionRect | null>(null);
  const selectionDrag = useRef<{ from: DrawingPoint; original: SelectionOperation | null } | null>(null);
  const setSelected = useCallback((next: SelectionOperation | null) => { selected.current = next; setSelection(next); }, []);
  const canSelect = toolAllowed(restriction, "select");
  const canRemove = restriction !== "no-erase";


  const paint = useCallback(() => {
    if (animation.current !== null) return;
    animation.current = requestAnimationFrame(() => {
      animation.current = null;
      const context = canvas.current?.getContext("2d");
      if (!context || !base.current) return;
      if (context.canvas.width !== base.current.width) context.canvas.width = base.current.width;
      if (context.canvas.height !== base.current.height) context.canvas.height = base.current.height;
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      context.drawImage(base.current, 0, 0);
      if (active.current && active.current.type !== "fill") paintDrawingOperation(context, active.current);
      if (selected.current) paintDrawingOperation(context, selected.current);
    });
  }, []);
  const updateDocument = useCallback((next: DrawingDocument, save = true, appended?: DrawingOperation) => {
    const previous = documentRef.current;
    documentRef.current = next; setDrawing(next); setError("");
    dirty.current ||= save;
    if (!next.cursor) setStarted(false);
    if (base.current) {
      const size = drawingSize(next);
      const resized = base.current.width !== size.width || base.current.height !== size.height;
      if (resized) { base.current.width = size.width; base.current.height = size.height; }
      const context = base.current.getContext("2d");
      if (context && (resized || previous.operations !== next.operations || previous.cursor !== next.cursor)) {
        if (appended && !resized) paintDrawingOperation(context, appended); else renderDrawing(context, next);
      }
      // An empty initial surface also needs its opaque white background.
      else if (context && !initialized.current) renderDrawing(context, next);
    }
    paint();
  }, [paint]);
  const commit = useCallback((operation: DrawingOperation) => {
    if (!operationAllowed(restriction, operation, drawingSize(documentRef.current))) { paint(); return; }
    const next = addOperation(documentRef.current, operation);
    if (next === documentRef.current) { setError("This sketch is full. Undo a few marks or save it to start another."); paint(); return; }
    updateDocument(next, true, operation);
  }, [paint, restriction, updateDocument]);
  const finishStroke = useCallback(() => {
    const operation = active.current; active.current = null; owner.current = null; panOrigin.current = null;
    if (operation) commit(operation);
    if (selected.current && selectionDirty.current) commit(selected.current);
    setSelected(null); selectionDirty.current = false; selectionDrag.current = null; setMarquee(null); paint();
  }, [commit, paint, setSelected]);
  const persist = useCallback(() => {
    if (!dirty.current) return;
    try { localStorage.setItem(draftKey, JSON.stringify(documentRef.current)); dirty.current = false; setSaveStatus("Saved on this device"); }
    catch { setSaveStatus(controlled ? "Draft not saved · keep this page open" : "Draft not saved · download to keep it"); }
  }, [controlled, draftKey]);

  useEffect(() => {
    const surface = document.createElement("canvas"); surface.width = DRAWING_SIZE; surface.height = DRAWING_SIZE; base.current = surface;
    const initialFrame = requestAnimationFrame(() => {
      let draft: DrawingDocument | null = null;
      try { draft = parseDraft(localStorage.getItem(draftKey)); } catch { /* Drawing remains available if storage is blocked. */ }
      const box = viewport.current?.getBoundingClientRect();
      const size = screenDrawingSize(box?.width ?? window.innerWidth, box?.height ?? window.innerHeight);
      const defaultPrompt = assignment.fixedPrompt ?? assignment.prompts[0] ?? DEFAULT_DRAWING_PROMPTS[0];
      const restoredPrompt = assignment.fixedPrompt ?? (draft?.prompt && (!controlled || assignment.prompts.includes(draft.prompt)) ? draft.prompt : defaultPrompt);
      let initial = draft ? { ...draft, ...(!draft.operations.length ? { size } : {}), prompt: restoredPrompt } : emptyDrawing(size, defaultPrompt);
      if (!draft) for (const operation of starterOperations(starter)) initial = addOperation(initial, operation);
      updateDocument(initial, !draft && Boolean(initial.cursor)); if (draft?.cursor) setSaveStatus("Sketch restored on this device");
      // Keep the previous full-view behaviour for legacy square drafts without changing their pixels.
      if (draft?.operations.length && !draft.size) setView("fill");
      initialized.current = true; setReady(true);
    });
    return () => { initialized.current = false; cancelAnimationFrame(initialFrame); if (animation.current !== null) cancelAnimationFrame(animation.current); animation.current = null; };
  }, [assignment, controlled, draftKey, starter, updateDocument]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(persist, 450);
    return () => clearTimeout(timer);
  }, [drawing, ready, persist]);
  useEffect(() => {
    const release = () => { touches.current.clear(); pinch.current = null; gesturing.current = false; finishStroke(); persist(); };
    const hidden = () => { if (document.hidden) release(); };
    const resize = () => {
      finishStroke(); setPan({ x: 0, y: 0 });
      const box = viewport.current?.getBoundingClientRect();
      if (initialized.current && box && !documentRef.current.operations.length) {
        const size = screenDrawingSize(box.width, box.height); const current = drawingSize(documentRef.current);
        if (size.width !== current.width || size.height !== current.height) updateDocument({ ...documentRef.current, size });
      }
    };
    window.addEventListener("blur", release); window.addEventListener("resize", resize);
    window.addEventListener("pagehide", release); document.addEventListener("visibilitychange", hidden);
    return () => {
      release();
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      animation.current = null;
      window.removeEventListener("blur", release); window.removeEventListener("resize", resize); window.removeEventListener("pagehide", release); document.removeEventListener("visibilitychange", hidden);
    };
  }, [finishStroke, persist, updateDocument]);
  useEffect(() => {
    const element = dialog.current;
    if (modal && element && !element.open) element.showModal();
    else if (!modal && element?.open) element.close();
    if (!element) return;
    const dismissBackdrop = (event: MouseEvent) => {
      if (event.target !== element) return;
      const box = element.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setModal(null);
    };
    element.addEventListener("click", dismissBackdrop);
    return () => element.removeEventListener("click", dismissBackdrop);
  }, [modal]);
  const undo = useCallback(() => { if (locked || !canRemove) return; finishStroke(); updateDocument(undoDrawing(documentRef.current)); }, [canRemove, finishStroke, locked, updateDocument]);
  const redo = useCallback(() => {
    if (locked || !canRemove) return;
    const next = documentRef.current.operations[documentRef.current.cursor];
    if (next && !operationAllowed(restriction, next, drawingSize(documentRef.current))) return;
    finishStroke(); updateDocument(redoDrawing(documentRef.current));
  }, [canRemove, finishStroke, locked, restriction, updateDocument]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (locked || (event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]") || modal) return;
      if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        if (event.key.toLowerCase() === "y" || event.shiftKey) redo(); else undo();
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const tools: Record<string, DrawingTool> = { b: "pen", e: "eraser", f: "fill", l: "line", r: "rectangle", o: "ellipse" };
        const next = tools[event.key.toLowerCase()]; if (next && toolAllowed(restriction, next)) { finishStroke(); setTool(next); }
      }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [finishStroke, locked, modal, redo, restriction, undo]);

  function point(event: Pick<PointerEvent, "clientX" | "clientY">): DrawingPoint {
    const rect = canvas.current!.getBoundingClientRect();
    const bounded = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 10_000) / 10_000;
    return { x: bounded((event.clientX - rect.left) / rect.width), y: bounded((event.clientY - rect.top) / rect.height) };
  }
  function start(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!ready || locked || event.button !== 0 || modal) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.current.size >= 2) {
        active.current = null; owner.current = null; panOrigin.current = null;
        if (selectionDrag.current) setSelected(selectionDrag.current.original);
        selectionDrag.current = null; setMarquee(null); setStarted(false); paint();
        gesturing.current = true;
        if (!pinch.current) {
          const [a, b] = [...touches.current.values()]; const area = viewport.current!.getBoundingClientRect();
          pinch.current = beginPinch(a, b, { zoom, pan }, { x: area.left + area.width / 2, y: area.top + area.height / 2 });
        }
        return;
      }
      if (gesturing.current) return;
    }
    if (owner.current !== null || !toolAllowed(restriction, tool)) return;
    owner.current = event.pointerId;
    if (tool === "pan") { panOrigin.current = { x: event.clientX, y: event.clientY, left: pan.x, top: pan.y }; return; }
    const from = point(event.nativeEvent);
    if (tool === "select") {
      const current = selected.current; const size = drawingSize(documentRef.current);
      if (current && selectionContains(current.transform, { x: from.x * size.width, y: from.y * size.height })) {
        selectionDrag.current = { from, original: current }; return;
      }
      finishStroke(); owner.current = event.pointerId;
      selectionDrag.current = { from, original: null }; setMarquee(selectionRect(from, from, size)); return;
    }
    if (!colorAllowed(restriction, color)) return;
    const brush = restriction === "giant-brush" ? 48 : width;
    active.current = tool === "fill" ? { type: "fill", color, point: from, gap: 2 }
      : tool === "spray" ? { type: "spray", color, width: spraySize, opacity, points: [from] }
      : tool === "pen" || tool === "eraser" ? { type: "stroke", tool, color, width: brush, points: [from] }
      : { type: tool, color, width: brush, from, to: from };
    setStarted(true); paint();
  }
  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (locked) return;
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesturing.current) {
      event.preventDefault();
      if (pinch.current && touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()]; const next = movePinch(pinch.current, a, b);
        setZoom(next.zoom); setPan(next.pan);
      }
      return;
    }
    if (owner.current !== event.pointerId) return;
    if (panOrigin.current && viewport.current) {
      event.preventDefault();
      setPan({ x: panOrigin.current.left + event.clientX - panOrigin.current.x, y: panOrigin.current.top + event.clientY - panOrigin.current.y }); return;
    }
    const drag = selectionDrag.current;
    if (drag && canSelect) {
      const to = point(event.nativeEvent); const size = drawingSize(documentRef.current);
      if (drag.original) {
        const transform = drag.original.transform;
        setSelected({ ...drag.original, transform: { ...transform, x: transform.x + (to.x - drag.from.x) * size.width, y: transform.y + (to.y - drag.from.y) * size.height } });
        selectionDirty.current = true; paint();
      } else setMarquee(selectionRect(drag.from, to, size));
      return;
    }
    const operation = active.current; if (!operation) return;
    event.preventDefault();
    if (operation.type === "stroke" || operation.type === "spray") {
      const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
      for (const item of events.length ? events : [event.nativeEvent]) {
        const next = point(item); const last = operation.points[operation.points.length - 1];
        if (operation.points.length < 3000 && Math.hypot(next.x - last.x, next.y - last.y) >= .0012) operation.points.push(next);
      }
    } else if (operation.type === "line" || operation.type === "rectangle" || operation.type === "ellipse") {
      const to = point(event.nativeEvent);
      operation.to = restriction === "circles" ? circleEnd(operation.from, to, drawingSize(documentRef.current)) : to;
    }
    paint();
  }
  function end(event: ReactPointerEvent<HTMLCanvasElement>) {
    touches.current.delete(event.pointerId);
    if (gesturing.current) {
      if (touches.current.size < 2) pinch.current = null;
      else {
        const [a, b] = [...touches.current.values()]; const area = viewport.current!.getBoundingClientRect();
        pinch.current = beginPinch(a, b, { zoom, pan }, { x: area.left + area.width / 2, y: area.top + area.height / 2 });
      }
      if (!touches.current.size) gesturing.current = false;
      return;
    }
    if (owner.current !== event.pointerId) return;
    if (event.type !== "pointerup" || locked) {
      active.current = null; owner.current = null; panOrigin.current = null;
      if (selectionDrag.current) setSelected(selectionDrag.current.original);
      selectionDrag.current = null; setMarquee(null); setStarted(false); paint(); return;
    }
    const drag = selectionDrag.current;
    if (drag && canSelect) {
      if (!drag.original && base.current) {
        const rect = selectionRect(drag.from, point(event.nativeEvent), drawingSize(documentRef.current));
        if (rect.width > 2 && rect.height > 2) {
          const data = base.current.getContext("2d")!.getImageData(rect.x, rect.y, rect.width, rect.height);
          try {
            setSelected({ type: "selection", source: rect, pixels: encodeSelection(data.data, rect.width, rect.height), transform: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height, rotation: 0 } });
          } catch (cause) { setError(cause instanceof Error ? cause.message : "Select a smaller area."); }
          selectionDirty.current = false;
        }
      }
      selectionDrag.current = null; owner.current = null; setMarquee(null); paint(); return;
    }
    finishStroke();
  }
  function copySelection() {
    if (locked || !canSelect || !selected.current) return;
    const { pixels, transform } = selected.current;
    clipboard.current = { type: "selection", pixels, transform: { ...transform } }; setHasClipboard(true); setSaveStatus("Selection copied · outside paper is transparent");
  }
  function pasteSelection() {
    if (locked || !canSelect || !clipboard.current) return;
    finishStroke(); const copy = clipboard.current; const size = drawingSize(documentRef.current);
    setTool("select"); setSelected({ ...copy, transform: { ...copy.transform, x: Math.min(size.width, copy.transform.x + 16), y: Math.min(size.height, copy.transform.y + 16) } });
    selectionDirty.current = true; paint();
  }
  function transformSelection(change: "smaller" | "larger" | "rotate" | "left" | "right" | "up" | "down") {
    if (locked || !canSelect || !selected.current) return;
    const current = selected.current; const transform = { ...current.transform };
    if (change === "rotate") transform.rotation = (transform.rotation + 15) % 360;
    else if (change === "smaller" || change === "larger") {
      const factor = change === "smaller" ? .9 : 1.1;
      if (transform.width * factor < 1 || transform.height * factor < 1 || transform.width * factor > 4096 || transform.height * factor > 4096) return;
      transform.width *= factor; transform.height *= factor;
    } else {
      transform.x = Math.max(-4096, Math.min(4096, transform.x + (change === "left" ? -10 : change === "right" ? 10 : 0)));
      transform.y = Math.max(-4096, Math.min(4096, transform.y + (change === "up" ? -10 : change === "down" ? 10 : 0)));
    }
    setSelected({ ...current, transform }); selectionDirty.current = true; paint();
  }
  function deleteSelection() {
    if (locked || !canRemove || !canSelect || !selected.current) return;
    const source = selected.current.source; setSelected(null); selectionDirty.current = false;
    if (source) commit({ type: "remove", source }); paint();
  }
  function review() {
    if (locked) return;
    finishStroke(); setModal(null);
    const context = base.current?.getContext("2d"); if (!context || !base.current) return;
    const pixels = context.getImageData(0, 0, base.current.width, base.current.height).data;
    let ink = false;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) { ink = true; break; }
    if (!ink) { setError("Add a few marks before finishing your sketch."); return; }
    persist(); setPreview(base.current.toDataURL("image/png")); setModal("review");
  }
  const submitSketch = useCallback(async (automatic = false) => {
    if (!onSubmit || paused || submitting.current || submitted) return;
    finishStroke();
    const surface = base.current; const context = surface?.getContext("2d");
    if (!surface || !context) return;
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    let ink = false;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) { ink = true; break; }
    if (!ink) { if (!automatic) { setModal(null); setError("Add a few marks before sending your sketch."); } return; }
    if (automatic) autoAttempted.current = true;
    submitting.current = true; setBusy(true); setError(""); persist();
    try {
      // Preserve this screen-shaped canvas in a square without stretching or cropping.
      const output = document.createElement("canvas"); output.width = 480; output.height = 480;
      const target = output.getContext("2d");
      if (!target) throw new Error("The sketch could not be prepared. Please try again.");
      target.fillStyle = "#FFFFFF"; target.fillRect(0, 0, 480, 480);
      const scale = 480 / Math.max(surface.width, surface.height);
      const width = surface.width * scale; const height = surface.height * scale;
      target.drawImage(surface, (480 - width) / 2, (480 - height) / 2, width, height);
      const blob = await drawingToPngBlob(output);
      await onSubmit(blob, documentRef.current.prompt ?? assignment.prompts[0]);
      setSubmitted(true); setSaveStatus("Sketch sent · waiting for everyone"); setModal(null);
    } catch (cause) {
      setModal(null); setError(cause instanceof Error ? cause.message : "Your sketch could not be sent. Please try again.");
    } finally { submitting.current = false; setBusy(false); }
  }, [assignment, finishStroke, onSubmit, paused, persist, setModal, submitted]);
  useEffect(() => {
    if (!paused) return;
    const frame = requestAnimationFrame(() => { finishStroke(); setModal(null); });
    return () => cancelAnimationFrame(frame);
  }, [finishStroke, paused]);
  useEffect(() => {
    if (serverTime !== undefined) serverClock.current = { time: serverTime, receivedAt: Date.now() };
  }, [serverTime]);
  useEffect(() => {
    if (!controlled || !deadline) return;
    const tick = () => {
      if (paused || !serverClock.current) return;
      const remaining = Math.max(0, deadline - (serverClock.current.time + Date.now() - serverClock.current.receivedAt));
      setClock(remaining);
      if (remaining <= 4000 && !autoAttempted.current) void submitSketch(true);
    };
    const frame = requestAnimationFrame(tick); const timer = window.setInterval(tick, 250);
    return () => { cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [controlled, deadline, paused, submitSketch]);
  function chooseTool(next: StudioTool) { if (locked || !toolAllowed(restriction, next)) return; finishStroke(); setTool(next); setModal(null); }
  function setCanvasView(next: "fill" | "fit") { finishStroke(); setView(next); setZoom(1); setPan({ x: 0, y: 0 }); }
  function setCanvasZoom(next: number) { finishStroke(); setZoom(next); setPan({ x: 0, y: 0 }); }
  async function fullscreen(showError = true, toggle = true) {
    try {
      if (document.fullscreenElement) { if (toggle) await document.exitFullscreen(); }
      else if (studio.current?.requestFullscreen && document.fullscreenEnabled) await studio.current.requestFullscreen({ navigationUI: "hide" });
      else if (showError) setError("Your browser keeps its controls visible. The canvas already fills the page.");
    } catch { if (showError) setError("Full screen is unavailable here. The canvas still fills the page."); }
  }
  function choosePrompt(value: string) {
    if (locked || assignment.fixedPrompt) return;
    const next = value.trim().replace(/\s+/g, " ").slice(0, 100);
    if (!next) return;
    finishStroke(); updateDocument({ ...documentRef.current, prompt: next }); persist(); setModal(null);
    // Prompt selection supplies the user gesture required by the Fullscreen API.
    void fullscreen(false, false);
  }
  const prompt = drawing.prompt ?? DEFAULT_DRAWING_PROMPTS[0];
  const size = drawingSize(drawing);
  const canUndo = canRemove && drawing.cursor > 0;
  const canRedo = canRemove && drawing.cursor < drawing.operations.length && operationAllowed(restriction, drawing.operations[drawing.cursor], size);
  const canFinish = !locked && ready && drawing.cursor > 0 && drawing.operations[drawing.cursor - 1].type !== "clear";

  return <main ref={studio} className={[styles.studio, focusMode ? styles.focusMode : ""].join(" ")} data-testid="drawing-studio" data-theme={theme} onContextMenu={event => { if (!(event.target instanceof Element) || !event.target.closest('input, textarea, [contenteditable="true"]')) event.preventDefault(); }}>
    <h1 className={styles.srOnly}>Drawing studio</h1>
    <div ref={viewport} className={styles.paperArea} aria-label="Sketch workspace">
      <div className={styles.paper} data-view={view} data-ready={ready} style={{ "--doc-width": size.width, "--doc-height": size.height, "--zoom": zoom, "--pan-x": pan.x + "px", "--pan-y": pan.y + "px" } as React.CSSProperties}>
        <canvas ref={canvas} width={size.width} height={size.height} className={[styles.canvas, tool === "pan" ? styles.panCanvas : ""].join(" ")} data-testid="sketch-canvas" tabIndex={0} aria-label="Drawing canvas. Use your finger, a stylus or a mouse." onContextMenu={(event) => event.preventDefault()} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} />
        {marquee && <div className={styles.selectionOutline} style={{ left: `${marquee.x / size.width * 100}%`, top: `${marquee.y / size.height * 100}%`, width: `${marquee.width / size.width * 100}%`, height: `${marquee.height / size.height * 100}%` }} />}
        {selection && <div className={styles.selectionOutline} style={{ left: `${selection.transform.x / size.width * 100}%`, top: `${selection.transform.y / size.height * 100}%`, width: `${selection.transform.width / size.width * 100}%`, height: `${selection.transform.height / size.height * 100}%`, transform: `translate(-50%, -50%) rotate(${selection.transform.rotation}deg)` }} />}
        {!drawing.cursor && !started && <div className={styles.emptyHint} aria-hidden="true"><StudioIcon name="pen" /><span>{theme === "sorcery" ? "Talent optional. Mischief encouraged." : "Draw it your way."}</span></div>}
      </div>
    </div>
    <header className={styles.header}>
      <button type="button" className={styles.idea} data-testid="prompt-picker-trigger" aria-labelledby="drawing-prompt-copy" aria-describedby={assignment.fixedPrompt ? undefined : "prompt-choice-hint"} aria-haspopup="dialog" aria-expanded={modal === "idea"} disabled={Boolean(assignment.fixedPrompt) || locked} onClick={() => setModal("idea")}><span className={styles.promptIcon}><StudioIcon name="pen" /></span><span className={styles.promptCopy} id="drawing-prompt-copy"><small>{assignment.fixedPrompt ? fixedPromptLabel : "DRAW THIS"}{controlled && clock !== null ? ` · ${Math.ceil(clock / 1000)}s` : ""}</small><strong>{prompt}</strong></span>{!assignment.fixedPrompt && <span className={styles.choicesHint} id="prompt-choice-hint">3 ideas<StudioIcon name="chevron" /></span>}</button>
      <button type="button" className={styles.finish} disabled={!canFinish} onClick={review}>{submitted ? "Sent" : busy ? "Sending…" : "Done"}<StudioIcon name="check" /></button>
    </header>
    <div className={styles.controls}>
      {tool === "select" && <div className={styles.selectionBar} role="group" aria-label="Selection actions">
        <span>{selection ? "Drag to move" : "Drag a box to select"}</span>
        <button type="button" disabled={locked || !canSelect || !selection} onClick={copySelection}>Copy</button>
        <button type="button" disabled={locked || !canSelect || !hasClipboard} onClick={pasteSelection}>Paste</button>
        {selection && <>
          <button type="button" disabled={locked || !canSelect} aria-label="Shrink selection" onClick={() => transformSelection("smaller")}>−</button>
          <button type="button" disabled={locked || !canSelect} aria-label="Enlarge selection" onClick={() => transformSelection("larger")}>+</button>
          <button type="button" disabled={locked || !canSelect} onClick={() => transformSelection("rotate")}>Rotate 15°</button>
          {(["left", "right", "up", "down"] as const).map((direction) => <button type="button" key={direction} disabled={locked || !canSelect} aria-label={`Move selection ${direction}`} onClick={() => transformSelection(direction)}>{{ left: "←", right: "→", up: "↑", down: "↓" }[direction]}</button>)}
          <button type="button" disabled={locked || !canRemove || !canSelect} onClick={deleteSelection}>Delete</button>
          <button type="button" disabled={locked} onClick={finishStroke}>Apply</button>
          <button type="button" disabled={locked} onClick={() => { setSelected(null); selectionDirty.current = false; paint(); }}>Cancel</button>
        </>}
      </div>}
      <div className={styles.toolRow} role="toolbar" aria-label="Drawing tools">{EDITOR_TOOLS.map((item) => <button type="button" key={item} className={styles.dockButton} disabled={locked || !toolAllowed(restriction, item)} aria-label={TOOL_NAMES[item]} aria-pressed={tool === item} onClick={() => chooseTool(item)}><StudioIcon name={item} /><span>{item === "ellipse" && restriction === "circles" ? "Circle" : item === "rectangle" ? "Rect" : TOOL_NAMES[item]}</span></button>)}</div>
      <div className={styles.dock} role="toolbar" aria-label="Drawing settings">
        <button type="button" className={styles.dockButton} disabled={locked} aria-label="Ink colour" aria-haspopup="dialog" aria-expanded={modal === "colors"} onClick={() => setModal("colors")}><span className={styles.inkSample} style={{ background: color }} /><span>Ink</span></button>
        <button type="button" className={styles.dockButton} disabled={locked || restriction === "giant-brush"} aria-label="Brush size" aria-haspopup="dialog" aria-expanded={modal === "brush"} onClick={() => setModal("brush")}><span className={styles.brushSample}><span style={{ width: Math.min(22, width), height: Math.min(22, width) }} /></span><span>Size</span></button>
        <button type="button" className={styles.dockButton} aria-label="Undo" disabled={locked || !canUndo} onClick={undo}><StudioIcon name="undo" /><span>Undo</span></button>
        <button type="button" className={styles.dockButton} aria-label="Redo" disabled={locked || !canRedo} onClick={redo}><StudioIcon name="redo" /><span>Redo</span></button>
        <button type="button" className={styles.dockButton} disabled={locked} aria-label="Canvas options" aria-describedby="drawing-tool-status" aria-haspopup="dialog" aria-expanded={modal === "options"} onClick={() => setModal("options")}><StudioIcon name="more" /><span>More</span></button>
      </div>
    </div>
    <button type="button" className={styles.showTools} disabled={locked} aria-label="Show drawing controls" onClick={() => setFocusMode(false)}><StudioIcon name="pen" />Tools</button>
    <span className={styles.srOnly} id="drawing-tool-status" role="status">Current tool: {TOOL_NAMES[tool]}</span><span className={styles.saveStatus} role="status">{saveStatus}</span>
    {error && <p className={styles.error} role="alert">{error}<button type="button" aria-label="Dismiss message" onClick={() => setError("")}><StudioIcon name="close" /></button></p>}
    <dialog ref={dialog} className={styles.dialog} data-panel={modal && ["tools", "colors", "brush", "options"].includes(modal) ? "true" : undefined} aria-labelledby="drawing-dialog-title" onCancel={() => setModal(null)} onClose={event => { if(!event.currentTarget.open)setModal(null); }}>
      <div className={styles.dialogHeader}><h2 id="drawing-dialog-title">{modal ? MODAL_TITLES[modal] : "Drawing options"}</h2><button type="button" aria-label="Close menu" onClick={() => setModal(null)}><StudioIcon name="close" /></button></div>
      <ScrollPanel active={Boolean(modal)}>
      {modal === "tools" && <><div className={styles.toolsGrid}>{EDITOR_TOOLS.map((item) => <button type="button" key={item} disabled={locked || !toolAllowed(restriction, item)} aria-pressed={tool === item} onClick={() => chooseTool(item)}><StudioIcon name={item} /><span>{TOOL_NAMES[item]}</span>{tool === item && <StudioIcon name="check" />}</button>)}</div><h3 className={styles.otherToolsHeading}>Other</h3><div className={styles.toolsGrid}>{OTHER_TOOLS.map((item) => <button type="button" key={item} disabled={locked || !toolAllowed(restriction, item)} aria-pressed={tool === item} onClick={() => chooseTool(item)}><StudioIcon name={item} /><span>{TOOL_NAMES[item]}</span>{tool === item && <StudioIcon name="check" />}</button>)}</div></>}
      {modal === "colors" && <><div className={styles.colors} role="group" aria-label="Ink colour">{DRAWING_COLORS.map((item, index) => <button key={item} type="button" style={{ "--swatch": item } as React.CSSProperties} className={styles.swatch} disabled={locked || !colorAllowed(restriction, item)} aria-label={["Ink", "White", "Coral", "Orange", "Yellow", "Green", "Blue", "Purple"][index]} aria-pressed={color.toLowerCase() === item.toLowerCase()} onClick={() => { if (locked || !colorAllowed(restriction, item)) return; setColor(item); if (tool === "eraser") setTool("pen"); setModal(null); }}>{color.toLowerCase() === item.toLowerCase() && <StudioIcon name="check" />}</button>)}</div>{restriction !== "limited-palette" && restriction !== "no-erase" && <details className={styles.disclosure}><summary>Custom colour</summary><label className={styles.customColor}>Choose any colour<input type="color" aria-label="Custom ink colour" value={color} onChange={(event) => { if (locked || !colorAllowed(restriction, event.target.value)) return; setColor(event.target.value); if (tool === "eraser") setTool("pen"); }} /></label></details>}</>}
      {modal === "brush" && <><div className={styles.widths} role="group" aria-label="Brush size">{WIDTHS.map((item, index) => <button type="button" key={item} disabled={locked || restriction === "giant-brush" || tool === "spray"} aria-label={["Fine brush", "Medium brush", "Thick brush", "Extra thick brush"][index]} aria-pressed={width === item} onClick={() => { if (locked || restriction === "giant-brush" || tool === "spray") return; setWidth(item); setModal(null); }}><span style={{ width: 4 + index * 5, height: 4 + index * 5 }} /><small>{["Fine", "Medium", "Thick", "Bold"][index]}</small></button>)}</div><label className={styles.rangeLabel}>{tool === "spray" ? "Spray size" : "Custom size"}<output>{tool === "spray" ? spraySize : width}</output><input type="range" min={tool === "spray" ? 6 : 1} max={tool === "spray" ? 96 : 48} value={tool === "spray" ? spraySize : width} aria-label={tool === "spray" ? "Spray size" : "Custom brush size"} disabled={locked || restriction === "giant-brush"} onChange={(event) => { if (locked || restriction === "giant-brush") return; if (tool === "spray") setSpraySize(Number(event.target.value)); else setWidth(Number(event.target.value)); }} /></label>{tool === "spray" && <label className={styles.rangeLabel}>Spray opacity <output>{Math.round(opacity * 100)}%</output><input type="range" min="5" max="100" value={Math.round(opacity * 100)} aria-label="Spray opacity" disabled={locked} onChange={(event) => setOpacity(Number(event.target.value) / 100)} /></label>}</>}
      {modal === "options" && <div className={styles.options}>
        <button type="button" className={styles.optionRow} onClick={() => setModal("brush")}><StudioIcon name="pen" />Brush size<span>{width}</span></button>
        <button type="button" className={styles.optionRow} onClick={() => setModal("tools")}><StudioIcon name="rectangle" />Shapes &amp; tools</button>
        <details className={styles.disclosure}><summary>View &amp; zoom</summary><div className={styles.viewChoices}><button type="button" aria-pressed={view === "fit"} onClick={() => setCanvasView("fit")}><StudioIcon name="rectangle" />Whole drawing</button><button type="button" aria-pressed={view === "fill"} onClick={() => setCanvasView("fill")}><StudioIcon name="expand" />Fill view</button></div><label className={styles.rangeLabel}>Zoom <output>{Math.round(zoom * 100)}%</output><input type="range" min="0.5" max="4" step="0.05" value={zoom} aria-label="Canvas zoom" onChange={(event) => setCanvasZoom(Number(event.target.value))} /></label><p className={styles.hint}>Whole drawing shows every edge. Hand moves the paper when zoomed in.</p><button type="button" className={styles.optionRow} onClick={() => { setFocusMode(true); setModal(null); }}><StudioIcon name="eye" />Hide toolbar</button><button type="button" className={styles.optionRow} onClick={() => { setModal(null); void fullscreen(); }}><StudioIcon name="expand" />Full screen</button></details>
        <details className={styles.disclosure}><summary>{controlled ? "Review & clear" : "Save & clear"}</summary><button type="button" className={styles.optionRow} disabled={!canFinish} onClick={review}><StudioIcon name={controlled ? "check" : "download"} />{controlled ? "Review & send sketch" : "Preview & save PNG"}</button><button type="button" className={[styles.optionRow, styles.danger].join(" ")} disabled={locked || !canRemove} onClick={() => { if (!locked && canRemove) setModal("clear"); }}><StudioIcon name="trash" />Clear the canvas</button>{!controlled && <button type="button" className={styles.optionRow} disabled={locked || !canRemove} onClick={() => { if (!locked && canRemove) setModal("new-page"); }}><StudioIcon name="page" />New page for this screen</button>}<p className={styles.hint}>{saveStatus}. Your prompt saves with your sketch.</p></details>
        <button type="button" className={styles.optionRow} onClick={() => setModal("help")}><StudioIcon name="help" />Drawing help</button>
        {!controlled && <Link href="/?menu=1" className={styles.optionRow}><StudioIcon name="back" />Back to Callback</Link>}
      </div>}
      {modal === "clear" && <><p>This clears the whole sketch. You can bring it back with Undo.</p><div className={styles.dialogActions}><button type="button" onClick={() => setModal(null)}>Keep drawing</button><button type="button" className={styles.primary} disabled={locked || !canRemove} onClick={() => { if (locked || !canRemove) return; finishStroke(); commit({ type: "clear" }); setModal(null); }}>Clear canvas</button></div></>}
      {modal === "new-page" && <><p>This starts a blank page sized for this screen. Save your current sketch first if you want to keep it.</p><div className={styles.dialogActions}><button type="button" onClick={() => setModal(null)}>Keep this page</button><button type="button" className={styles.primary} disabled={locked || !canRemove} onClick={() => { if (locked || !canRemove) return; finishStroke(); const box = viewport.current!.getBoundingClientRect(); updateDocument(emptyDrawing(screenDrawingSize(box.width, box.height), prompt)); persist(); setCanvasView("fit"); setModal(null); }}>Start new page</button></div>{canFinish && <button type="button" className={styles.optionRow} onClick={review}><StudioIcon name="download" />Preview &amp; save first</button>}</>}
      {modal === "review" && <><div className={styles.preview} style={{ "--preview-aspect": size.width / size.height } as React.CSSProperties}><Image src={preview} alt="Your completed sketch" width={size.width} height={size.height} unoptimized /></div><p>{controlled ? "Ready to send your sketch? You can keep drawing until you send it." : "Your whole sketch, ready to save."}</p><div className={styles.dialogActions}><button type="button" onClick={() => setModal(null)}>Keep drawing</button>{controlled ? <button type="button" className={styles.primary} disabled={locked} onClick={() => void submitSketch()}>{busy ? "Sending…" : "Send sketch"}</button> : <a className={styles.primary} href={preview} download="callback-sketch.png"><StudioIcon name="download" />Save PNG</a>}</div></>}
      {modal === "idea" && <div className={styles.promptPicker}>
        <p className={styles.pickerIntro}>Choose something you can picture.</p>
        <div className={styles.promptChoices} role="group" aria-label="Three drawing ideas">{promptChoices.map((choice, index) => <button type="button" key={choice} aria-pressed={prompt === choice} onClick={() => choosePrompt(choice)}><span className={styles.choiceNumber}>{index + 1}</span><strong>{choice}</strong><StudioIcon name={prompt === choice ? "check" : "arrow"} /></button>)}</div>
        {!controlled && <button type="button" className={styles.refreshPrompts} onClick={() => setPromptChoices(nextDrawingPrompts([...promptChoices, prompt]))}><StudioIcon name="refresh" />Three new ideas</button>}
        {drawing.cursor > 0 && <p className={styles.hint}>Changing the idea keeps your drawing.</p>}
        {!controlled && <details className={styles.disclosure}><summary>Write my own</summary><form className={styles.helpContent} onSubmit={(event) => { event.preventDefault(); choosePrompt(customPrompt); }}><label>Your drawing idea<input maxLength={100} value={customPrompt} placeholder="Something simple…" onChange={(event) => setCustomPrompt(event.target.value)} /></label><button type="submit" className={styles.primary} disabled={!customPrompt.trim()}>Use this idea</button></form></details>}
      </div>}
      {modal === "help" && <div className={styles.helpContent}><p>Draw with your finger, stylus or mouse. New pages fill your screen from the start. {assignment.fixedPrompt ? "Your assignment is fixed for this round. Follow the prompt at the top of your screen." : "Tap the prompt for three easy ideas."} Tools stay below the drawing. Fill closes small gaps. Select a box to copy transparent ink, then move, resize or rotate it. Game restrictions disable unavailable tools.</p><details className={styles.disclosure}><summary>Moving around</summary><p>Pinch with two fingers to zoom and pan. Use Hand to move the paper. More → View & zoom → Whole drawing shows everything, including after rotation. Zoom changes your view, keeping your drawing’s proportions.</p></details><details className={styles.disclosure}><summary>Saving &amp; shortcuts</summary><p>Your sketch saves on this device. Your prompt stays with the draft. {controlled ? "Done previews the whole sketch before you send it. Sending locks your drawing." : "Done previews the whole sketch and lets you save a PNG."} Undo works after Clear too.</p><p>B pen · E eraser · F fill · L line · R rectangle · O oval · Ctrl/⌘ Z undo.</p></details><button type="button" className={styles.primary} onClick={() => setModal(null)}>Let’s draw</button></div>}
    </ScrollPanel></dialog>
    {locked && <div className={styles.lockedOverlay} role="status"><strong>{paused ? "Game paused" : busy ? "Sending your sketch…" : "Sketch sent!"}</strong><span>{paused ? "Your sketch is safe. Drawing resumes with the game." : busy ? "Keep this page open while it sends." : "Waiting for everyone to finish."}</span></div>}
  </main>;
}
