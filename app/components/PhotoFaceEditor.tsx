"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AvatarConfig } from "../../lib/avatar-runtime";
import { Avatar } from "./Avatar";
import "../photo-face-layout.css";

async function inspectPhoto(file: File): Promise<{ width: number; height: number }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP photo smaller than 12 MB.");
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height || image.width * image.height > 24_000_000) throw new Error("Choose a smaller photo (up to 24 megapixels).");
    return { width: image.width, height: image.height };
  } finally { image.close(); }
}

async function makeFaceCrop(file: File, source: { width: number; height: number }, zoom: number, horizontal: number, vertical: number, chin: number, curve: number): Promise<Blob> {
  const image = await createImageBitmap(file);
  try {
    const size = Math.min(source.width, source.height) / zoom;
    const x = (source.width - size) / 2 + (source.width - size) / 2 * horizontal / 100;
    const y = (source.height - size) / 2 + (source.height - size) / 2 * vertical / 100;
    const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 768;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare your photo.");
    context.drawImage(image, x, y, size, size, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let px = 0; px < canvas.width; px++) {
      const boundary = Math.floor(canvas.height * (chin - curve * (2 * px / (canvas.width - 1) - 1) ** 2) / 100);
      for (let py = Math.max(0, boundary); py < canvas.height; py++) pixels.data[(py * canvas.width + px) * 4 + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not prepare this photo.")), "image/png"));
    if (blob.size > 2 * 1024 * 1024) throw new Error("This crop is too detailed. Zoom in and try again.");
    return blob;
  } finally { image.close(); }
}

export function PhotoFaceEditor({ avatar, onApply, onCancel, initialFaceId }: { avatar: AvatarConfig; onApply: (faceId: string) => void; onCancel: () => void; initialFaceId?: string }) {
  const inputId = useId();
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ file: File; url: string; width: number; height: number; blob?: Blob; key?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [faceId, setFaceId] = useState<string | null>(initialFaceId ?? null);
  const [sourceFaceId, setSourceFaceId] = useState<string | null>(initialFaceId ?? null);
  const [trimming, setTrimming] = useState(false);
  const [cutoffPercent, setCutoffPercent] = useState(70);
  const [curvePercent, setCurvePercent] = useState(20);
  const [terminalFailure, setTerminalFailure] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [referenceChin, setReferenceChin] = useState(85);
  const [referenceCurve, setReferenceCurve] = useState(20);
  const [setupPage, setSetupPage] = useState<"frame" | "chin">("frame");
  const [frameSize, setFrameSize] = useState(280);
  const frame = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; horizontal: number; vertical: number } | null>(null);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>('button:not(:disabled), input:not([type="range"]):not([hidden]):not(:disabled)')?.focus();
    return () => { document.body.style.overflow = oldOverflow; before?.focus(); };
  }, []);
  const photoUrl = photo?.url;
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);
  useEffect(() => {
    const node = frame.current; if (!node) return;
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width) setFrameSize(width); });
    observer.observe(node); return () => observer.disconnect();
  }, [photo]);

  const choose = async (file?: File) => {
    if (!file || locked.current) return;
    const current = ++generation.current;
    setBusy(true); locked.current = true; setError(""); setStatus(""); setFaceId(null); setSourceFaceId(null); setImageReady(false); setTerminalFailure(false); setPhoto(null);
    try {
      const dimensions = await inspectPhoto(file);
      if (current === generation.current) { setPhoto({ file, ...dimensions, url: URL.createObjectURL(file) }); setZoom(1); setHorizontal(0); setVertical(0); setReferenceChin(85); setReferenceCurve(20); setSetupPage("frame"); }
    } catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : "Could not open this photo. Try a JPG or PNG."); }
    finally { if (current === generation.current) { setBusy(false); locked.current = false; } }
  };
  const generate = async () => {
    if (!photo || locked.current) return;
    const current = generation.current;
    locked.current = true; setBusy(true); setError(""); setStatus("Cartoonifying your face… This can take up to two minutes.");
    let attempt = terminalFailure ? { ...photo, blob: undefined, key: undefined } : photo;
    if (!attempt.blob || !attempt.key) {
      try { attempt = { ...attempt, blob: await makeFaceCrop(attempt.file, attempt, zoom, horizontal, vertical, referenceChin, referenceCurve), key: crypto.randomUUID() }; if (current !== generation.current) return; setPhoto(attempt); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Could not prepare this photo."); setBusy(false); locked.current = false; return; }
    }
    if (terminalFailure) { setPhoto(attempt); setTerminalFailure(false); }
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await fetch("/api/profile/face", { method: "POST", headers: { "Content-Type": "image/png", "Idempotency-Key": attempt.key! }, body: attempt.blob!, signal: controller.signal });
      const body = await response.json() as { faceId?: string; message?: string; terminal?: boolean };
      if (current !== generation.current) return;
      if (response.status === 202) { setStatus("Your face is still being made. Tap Generate cartoon face again to check the same request."); return; }
      if (body.terminal) setTerminalFailure(true);
      if (!response.ok || !body.faceId || !/^[0-9a-f-]{36}$/i.test(body.faceId)) throw new Error(body.message ?? "Your face could not be generated. Your current character is unchanged.");
      setSourceFaceId(body.faceId); setCutoffPercent(referenceChin); setCurvePercent(referenceCurve);
      setStatus("Finishing the head at your chin curve…");
      const finishResponse = await fetch("/api/profile/face/trim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ faceId: body.faceId, cutoffPercent: referenceChin, curvePercent: referenceCurve }), signal: controller.signal });
      const finished = await finishResponse.json() as { faceId?: string; message?: string };
      if (current !== generation.current) return;
      if (!finishResponse.ok || !finished.faceId || !/^[0-9a-f-]{36}$/i.test(finished.faceId)) {
        setFaceId(body.faceId); setTrimming(true);
        throw new Error(finished.message ?? "Adjust the chin curve and save the trimmed head to finish.");
      }
      setFaceId(finished.faceId); setImageReady(false); setTrimming(false); setStatus("Head finished at your chin curve. Check the preview; Trim neck lets you adjust it using the original image.");
    } catch (reason) {
      if (current === generation.current && !controller.signal.aborted) { setStatus(""); setError(reason instanceof Error ? reason.message : "Connection lost. Try again to check the same request."); }
    } finally { if (current === generation.current) { locked.current = false; setBusy(false); } }
  };

  const saveTrim = async () => {
    if (!sourceFaceId || locked.current) return;
    const current = generation.current, controller = new AbortController(); request.current = controller;
    locked.current = true; setBusy(true); setError(""); setStatus("Saving a trimmed copy of your face…");
    try {
      const response = await fetch("/api/profile/face/trim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ faceId: sourceFaceId, cutoffPercent, curvePercent }), signal: controller.signal });
      const body = await response.json() as { faceId?: string; message?: string };
      if (generation.current !== current) return;
      if (!response.ok || !body.faceId || !/^[0-9a-f-]{36}$/i.test(body.faceId)) throw new Error(body.message ?? "The trimmed face could not be saved.");
      setFaceId(body.faceId); setImageReady(false); setTrimming(false); setStatus("Trim saved as a separate face. Your original remains available.");
    } catch (reason) { if (generation.current === current && !controller.signal.aborted) { setStatus(""); setError(reason instanceof Error ? reason.message : "The trim could not be saved. Try again shortly."); } }
    finally { if (generation.current === current) { request.current = null; locked.current = false; setBusy(false); } }
  };

  const trimBoundaryY = (xPercent: number) => Math.max(0, Math.min(100, cutoffPercent - curvePercent * (2 * xPercent / 100 - 1) ** 2));
  const trimBoundaryPoints = Array.from({ length: 257 }, (_, index) => ({ x: index / 256 * 100, y: trimBoundaryY(index / 256 * 100) }));
  const trimBoundaryPath = `M ${trimBoundaryPoints.map(({ x, y }) => `${x} ${y}`).join(" L ")}`;
  const trimClipPolygon = `polygon(0 0, 100% 0, ${trimBoundaryPoints.slice().reverse().map(({ x, y }) => `${x}% ${y}%`).join(", ")})`;

  return <div role="presentation" onKeyDown={event => {
    if (event.key === "Escape") { event.stopPropagation(); onCancel(); }
    if (event.key === "Tab") {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, summary, [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}><section ref={dialog} className="photo-face-editor" role="dialog" aria-modal="true" aria-labelledby={`${inputId}-heading`} aria-busy={busy}>
    <h3 id={`${inputId}-heading`}>Make a cartoon of your face</h3>
    <details className="photo-face-disclosure"><summary>Photo privacy and tips</summary><p>Choose a clear photo of just you, facing forward. Generating sends it to OpenAI. The game saves only the cartoon, which is visible wherever your character appears. Cartoons remain available for saved characters and game history; switching to a drawn face does not delete them.</p></details>
    {!photo && !faceId ? <div className="photo-face-chooser">
      <p>Choose a clear, front-facing photo. You can crop and align your chin before anything is sent.</p>
      <div className="photo-face-chooser-actions">
        <button type="button" className="button button-primary" disabled={busy} onClick={() => cameraInput.current?.click()}>Take a photo</button>
        <button type="button" className="button button-secondary" disabled={busy} onClick={() => uploadInput.current?.click()}>Upload photo</button>
      </div>
    </div> : <div className="photo-face-source-actions">
      <button type="button" className="button button-secondary" disabled={busy} onClick={() => cameraInput.current?.click()}>Take another photo</button>
      <button type="button" className="button button-secondary" disabled={busy} onClick={() => uploadInput.current?.click()}>Upload a different photo</button>
    </div>}
    <input ref={cameraInput} aria-label="Take a photo with camera" type="file" accept="image/*" capture="user" hidden disabled={busy} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
    <input ref={uploadInput} aria-label="Your face photo (JPG, PNG or WebP)" type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
    <div className="photo-face-workspace">
    {photo && !faceId && <div className="photo-face-steps" role="group" aria-label="Photo setup steps">
      <button type="button" aria-pressed={setupPage === "frame"} onClick={() => setSetupPage("frame")}>1 · Crop & position</button>
      <button type="button" aria-pressed={setupPage === "chin"} onClick={() => setSetupPage("chin")}>2 · Set chin line</button>
    </div>}
    {photo && !faceId && <div className="photo-face-crop-controls">
      <p>Fit your whole head inside the circle, then place the curved line just under your chin. The shaded area is removed before the photo is sent.</p>
      <div ref={frame} className="photo-face-crop-frame" role="img" aria-label="Circular face crop guide. Drag and zoom to fit your whole head inside the circle." onPointerDown={event => { if (busy || event.button !== 0) return; drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, horizontal, vertical }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const active = drag.current; if (busy || !active || active.pointerId !== event.pointerId) return; const renderedWidth = frameSize * Math.max(1, photo.width / photo.height) * zoom; const renderedHeight = frameSize * Math.max(1, photo.height / photo.width) * zoom; setHorizontal(Math.max(-100, Math.min(100, active.horizontal - (event.clientX - active.x) * 200 / Math.max(1, renderedWidth - frameSize)))); setVertical(Math.max(-100, Math.min(100, active.vertical - (event.clientY - active.y) * 200 / Math.max(1, renderedHeight - frameSize)))); setPhoto(current => current ? { ...current, blob: undefined, key: undefined } : current); }} onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <img src={photo.url} alt="" draggable={false} style={{ width: frameSize * Math.max(1, photo.width / photo.height) * zoom, height: frameSize * Math.max(1, photo.height / photo.width) * zoom, left: `calc(50% - ${frameSize * Math.max(1, photo.width / photo.height) * zoom / 2}px + ${-horizontal / 100 * (frameSize * Math.max(1, photo.width / photo.height) * zoom - frameSize) / 2}px)`, top: `calc(50% - ${frameSize * Math.max(1, photo.height / photo.width) * zoom / 2}px + ${-vertical / 100 * (frameSize * Math.max(1, photo.height / photo.width) * zoom - frameSize) / 2}px)` }} />
        <span aria-hidden="true" />
        <svg className="photo-face-reference-chin" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={'M 0 '+(referenceChin-referenceCurve)+' Q 50 '+(referenceChin+referenceCurve)+' 100 '+(referenceChin-referenceCurve)+' L 100 100 L 0 100 Z'} fill="rgba(20,20,40,.65)" /><path d={'M 0 '+(referenceChin-referenceCurve)+' Q 50 '+(referenceChin+referenceCurve)+' 100 '+(referenceChin-referenceCurve)} fill="none" stroke="#ffdc55" strokeWidth="1" /></svg>
      </div>
      <div className="photo-face-adjustments">
        {setupPage === "frame" ? <>
          <label>Face zoom <input aria-label="Face zoom" disabled={busy} type="range" min="1" max="3" step="0.05" value={zoom} onChange={event => { setZoom(Number(event.target.value)); setPhoto(current => current ? { ...current, blob: undefined, key: undefined } : current); }} /></label>
          <label>Horizontal face position <input aria-label="Horizontal face position" disabled={busy} type="range" min="-100" max="100" step="1" value={horizontal} onChange={event => { setHorizontal(Number(event.target.value)); setPhoto(current => current ? { ...current, blob: undefined, key: undefined } : current); }} /></label>
          <label>Vertical face position <input aria-label="Vertical face position" disabled={busy} type="range" min="-100" max="100" step="1" value={vertical} onChange={event => { setVertical(Number(event.target.value)); setPhoto(current => current ? { ...current, blob: undefined, key: undefined } : current); }} /></label>
        </> : <>
          <label>Photo chin height <input aria-label="Photo chin height" disabled={busy} type="range" min="30" max="95" step="1" value={referenceChin} onChange={event => { setReferenceChin(Number(event.target.value)); setPhoto(current => current ? { ...current, blob: undefined, key: undefined } : current); }} /></label>
          <label>Photo chin curve <input aria-label="Photo chin curve" disabled={busy} type="range" min="0" max="30" step="1" value={referenceCurve} onChange={event => { setReferenceCurve(Number(event.target.value)); setPhoto(current => current ? { ...current, blob: undefined, key: undefined } : current); }} /></label>
        </>}
      </div>
    </div>}
    {faceId && <div className="photo-face-result">
      <Avatar config={{ ...avatar, photoFaceId: faceId }} index={0} color="#46DBDC" size="large" label="Your cartoon face on your character" animation="still" />
      <img className="photo-face-cutout" src={`/api/profile/face/${faceId}`} alt="Generated cartoon head on a transparent background" onLoad={() => setImageReady(true)} onError={() => { setImageReady(false); setError("The cartoon could not be loaded. Choose your photo again to recover it."); }} />
      <p>Your body and outfit stay yours. The cartoon head moves with your character; its facial expression stays as drawn.</p>
    </div>}
    {faceId && sourceFaceId && <div className="photo-face-trim-controls">
      {!trimming ? <button type="button" className="button button-secondary" disabled={busy} onClick={() => { setTrimming(true); }}>Trim neck</button> : <>
        <p>Set the chin height, then curve the cut upward at the edges. The overlay and transparent preview show the saved boundary.</p>
        <div className="photo-face-trim-source" role="img" aria-label={`Original face with curved chin boundary centered at ${cutoffPercent}%, rising ${curvePercent}% at the edges`}>
          <img src={`/api/profile/face/${sourceFaceId}`} alt="Original face before trimming" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={trimBoundaryPath} /></svg>
        </div>
        <label>Chin height: {cutoffPercent}% from top <input aria-label="Chin height" disabled={busy} type="range" min="20" max="95" step="1" value={cutoffPercent} onChange={event => setCutoffPercent(Number(event.target.value))} /></label>
        <label>Curve: {curvePercent}% edge lift <input aria-label="Chin curve" disabled={busy} type="range" min="0" max="40" step="1" value={curvePercent} onChange={event => setCurvePercent(Number(event.target.value))} /></label>
        <div className="photo-face-trim-result" role="img" aria-label={`Trim preview with a curved boundary centered at ${cutoffPercent}%, rising ${curvePercent}% at the edges; pixels below are transparent`}>
          <img src={`/api/profile/face/${sourceFaceId}`} alt="Trim preview with transparent area below the curved cut" style={{ clipPath: trimClipPolygon }} />
        </div>
        <div className="photo-face-actions">
          <button type="button" className="button button-primary" disabled={busy} onClick={() => void saveTrim()}>{busy ? "Saving trim…" : "Save trimmed face"}</button>
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => { if (faceId !== sourceFaceId) { setFaceId(sourceFaceId); setImageReady(false); setStatus("Original face restored. The saved trim remains a separate asset."); } setTrimming(false); }}>Keep original</button>
        </div>
      </>}
    </div>}
    {status && <p role="status">{status}</p>}
    {error && <p className="character-profile-error" role="alert">{error}</p>}
    {terminalFailure && <p>The previous attempt ended. Trying again starts a new image generation.</p>}
    </div>
    <div className="photo-face-actions">
      {!faceId && photo && <button type="button" className="button button-primary" disabled={busy} onClick={() => void generate()}>{busy ? "Preparing your face…" : terminalFailure ? "Generate a new cartoon" : "Generate cartoon face"}</button>}
      {faceId && !trimming && <button type="button" className="button button-primary" disabled={!imageReady || busy} onClick={() => onApply(faceId)}>Use this face</button>}
      <button type="button" className="button button-secondary" onClick={onCancel}>Cancel photo</button>
    </div>
    <small>You can always customize your character without a photo.</small>
  </section></div>;
}
