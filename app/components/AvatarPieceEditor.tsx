"use client";

import { useRef, useState } from "react";
import type { PointerEvent, KeyboardEvent } from "react";
import type { AvatarConfig } from "../../lib/avatar-runtime";
import { renderAvatar } from "../../lib/avatar-runtime";
import { AVATAR_PIECES, DEFAULT_PIECE_TRANSFORM, PIECE_LIMITS, availableAvatarPieces, getPieceTransform } from "../../lib/avatar-pieces";
import type { AvatarPieceId, PieceTransform } from "../../lib/avatar-pieces";

type Change = (config: AvatarConfig, record?: boolean) => void;
const clampPosition = (v: number) => Math.max(-PIECE_LIMITS.position, Math.min(PIECE_LIMITS.position, Math.round(v * 10) / 10));
function withTransform(value: AvatarConfig, piece: AvatarPieceId, next: Partial<PieceTransform>): AvatarConfig {
  return { ...value, pieceTransforms: { ...value.pieceTransforms, [piece]: { ...getPieceTransform(value, piece), ...next } } };
}

export function AvatarPieceCanvas({ value, selected, onSelect, onChange, onBegin, label }: {
  value: AvatarConfig; selected: AvatarPieceId; onSelect: (id: AvatarPieceId) => void; onChange: Change; onBegin: () => void; label: string;
}) {
  const gesture = useRef<{ pointer: number; piece: AvatarPieceId; avatar: AvatarConfig; start: DOMPoint; inverse: DOMMatrix; recorded: boolean } | null>(null);
  const [zoom, setZoom] = useState(false);
  const selectedLabel = AVATAR_PIECES.find(p => p.id === selected)?.label ?? "Piece";
  const markup = renderAvatar(value, { animation: "still", label, editor: true, selectedPiece: selected }).replace('viewBox="0 0 240 390"', zoom ? 'viewBox="50 45 140 180"' : 'viewBox="0 0 240 390"');
  const start = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gesture.current) return;
    const svg = event.currentTarget.querySelector('svg');
    const matrix = svg?.getScreenCTM();
    if (!matrix) return;
    const hit = (event.target as Element).closest('[data-avatar-piece]')?.getAttribute('data-avatar-piece') as AvatarPieceId | null;
    const piece = hit ?? selected;
    onSelect(piece);
    const inverse = matrix.inverse();
    gesture.current = { pointer: event.pointerId, piece, avatar: value, start: new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse), inverse, recorded: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || event.pointerId !== g.pointer) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(g.inverse);
    const dx = p.x - g.start.x, dy = p.y - g.start.y;
    if (!g.recorded && Math.hypot(dx, dy) < .5) return;
    if (!g.recorded) { onBegin(); g.recorded = true; }
    const original = getPieceTransform(g.avatar, g.piece);
    onChange(withTransform(g.avatar, g.piece, { x: clampPosition(original.x + dx), y: clampPosition(original.y + dy) }), false);
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointer !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = directions[event.key];
    if (!d) return;
    event.preventDefault();
    const t = getPieceTransform(value, selected), step = event.shiftKey ? 10 : 1;
    onChange(withTransform(value, selected, { x: clampPosition(t.x + d[0] * step), y: clampPosition(t.y + d[1] * step) }));
  };
  return <div className="avatar-canvas-shell">
    {/* This focusable graphics workspace implements its advertised arrow-key editing; it is not a static container. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
    <div className={`avatar-piece-canvas${zoom ? ' zoom-face' : ''}`} role="application" aria-roledescription="character editing canvas" tabIndex={0}
      aria-label={`${selectedLabel} selected. Drag a piece to move it, or use arrow keys. Shift moves ten steps.`}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { gesture.current = null; }} onKeyDown={key}>
      <span className="callback-avatar avatar-large" dangerouslySetInnerHTML={{ __html: markup }} />
    </div>
    <div className="avatar-canvas-tools"><span>{selectedLabel}</span><button type="button" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? 'Full character' : 'Zoom face'}</button></div>
    <p>Tap a piece, then drag. Use the list for small or hidden pieces.</p>
  </div>;
}

export function AvatarPieceControls({ value, selected, onSelect, onChange, onBegin, onChooseStyle }: {
  value: AvatarConfig; selected: AvatarPieceId; onSelect: (id: AvatarPieceId) => void; onChange: Change; onBegin: () => void; onChooseStyle: () => void;
}) {
  const pieces = availableAvatarPieces(value);
  const t = getPieceTransform(value, selected);
  const active = pieces.some(p => p.id === selected);
  const update = (patch: Partial<PieceTransform>, record = true) => onChange(withTransform(value, selected, patch), record);
  const resetPiece = () => {
    const pieceTransforms = { ...value.pieceTransforms };
    delete pieceTransforms[selected];
    onChange({ ...value, pieceTransforms });
  };
  const nudge = (dx: number, dy: number) => update({ x: clampPosition(t.x + dx), y: clampPosition(t.y + dy) });
  return <div className="avatar-piece-panel">
    <div className="avatar-piece-heading"><strong>Move, resize & rotate</strong><span>Left and right refer to the screen.</span></div>
    <label className="avatar-piece-select">Character piece
      <select value={selected} onChange={event => onSelect(event.target.value as AvatarPieceId)}>
        {AVATAR_PIECES.map(p => <option value={p.id} key={p.id}>{p.label}{!pieces.some(v => v.id === p.id) ? ' — not added' : getPieceTransform(value, p.id).hidden ? ' — hidden' : ''}</option>)}
      </select>
    </label>
    {!active ? <div className="avatar-piece-empty"><p>This character does not have that piece yet.</p><button type="button" onClick={onChooseStyle}>Choose it in Fine-tune</button></div> : <>
      <div className="avatar-piece-nudge" aria-label="Move selected piece">
        <button type="button" onClick={() => nudge(-1, 0)} aria-label="Move piece left">←</button>
        <button type="button" onClick={() => nudge(0, -1)} aria-label="Move piece up">↑</button>
        <button type="button" onClick={() => nudge(0, 1)} aria-label="Move piece down">↓</button>
        <button type="button" onClick={() => nudge(1, 0)} aria-label="Move piece right">→</button>
        <button type="button" onClick={() => update({ x: 0, y: 0 })}>Centre</button>
      </div>
      <TransformRange label="Horizontal" value={t.x} min={-390} max={390} step={.1} unit="" onBegin={onBegin} onChange={(x, record) => update({ x }, record)} />
      <TransformRange label="Vertical" value={t.y} min={-390} max={390} step={.1} unit="" onBegin={onBegin} onChange={(y, record) => update({ y }, record)} />
      <TransformRange label="Size" value={t.scale * 100} min={10} max={400} step={1} unit="%" onBegin={onBegin} onChange={(scale, record) => update({ scale: scale / 100 }, record)} />
      <TransformRange label="Rotation" value={t.rotation} min={-180} max={180} step={1} unit="°" onBegin={onBegin} onChange={(rotation, record) => update({ rotation }, record)} />
      <details className="avatar-piece-stretch"><summary>Stretch & flip</summary>
        <TransformRange label="Width" value={t.scaleX * 100} min={10} max={400} step={1} unit="%" onBegin={onBegin} onChange={(scaleX, record) => update({ scaleX: scaleX / 100 }, record)} />
        <TransformRange label="Height" value={t.scaleY * 100} min={10} max={400} step={1} unit="%" onBegin={onBegin} onChange={(scaleY, record) => update({ scaleY: scaleY / 100 }, record)} />
        <div className="avatar-piece-actions"><button type="button" aria-pressed={t.flipX} onClick={() => update({ flipX: !t.flipX })}>Flip horizontal</button><button type="button" aria-pressed={t.flipY} onClick={() => update({ flipY: !t.flipY })}>Flip vertical</button></div>
      </details>
      <div className="avatar-piece-actions"><button type="button" aria-pressed={t.hidden} onClick={() => update({ hidden: !t.hidden })}>{t.hidden ? 'Show piece' : 'Hide piece'}</button><button type="button" onClick={resetPiece}>Reset this piece</button></div>
    </>}
    <button type="button" className="avatar-reset-all" onClick={() => onChange({ ...value, pieceTransforms: {} })}>Reset all piece adjustments</button>
    <p className="avatar-piece-note">Size starts at {DEFAULT_PIECE_TRANSFORM.scale * 100}% of your chosen style. Reset keeps the character’s styles and colours.</p>
  </div>;
}

function TransformRange({ label, value, min, max, step, unit, onChange, onBegin }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number, record: boolean) => void; onBegin: () => void;
}) {
  const sliding = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const shown = Math.round(value * 10) / 10;
  return <div className="avatar-transform-range">
    <span>{label}</span>
    <input type="range" aria-label={`${label} slider`} aria-valuetext={`${shown}${unit}`} min={min} max={max} step={step} value={shown}
      onPointerDown={() => { sliding.current = true; onBegin(); }} onPointerUp={() => { sliding.current = false; }} onPointerCancel={() => { sliding.current = false; }} onBlur={() => { sliding.current = false; }}
      onChange={event => onChange(Number(event.target.value), !sliding.current)} />
    <label><input aria-label={label} type="number" min={min} max={max} step={step} value={draft ?? shown}
      onFocus={() => setDraft(String(shown))}
      onChange={event => { setDraft(event.target.value); const next = event.target.valueAsNumber; if (Number.isFinite(next) && next >= min && next <= max) onChange(next, true); }}
      onBlur={() => { if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onChange(Math.max(min, Math.min(max, Number(draft))), true); setDraft(null); }} /><span>{unit}</span></label>
  </div>;
}
