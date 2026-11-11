"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AvatarConfig } from "../../lib/avatar-runtime";
import type { AvatarPose } from "../../lib/avatar-pose";
import { NEUTRAL_POSE, clampPose } from "../../lib/avatar-pose";
import { AVATAR_PRESETS, poseSequenceAt, poseSequenceDuration, solveTwoBoneAngles, stepPoseSpring } from "../../lib/avatar-motion";
import { Avatar } from "./Avatar";
import { useAvatarPoseControls } from "./AvatarPoseProvider";

type Handle = "leftHand" | "rightHand" | "leftFoot" | "rightFoot" | "head" | "body" | "eyes" | "mouth";
const SLIDERS: Array<{ key: keyof AvatarPose; label: string; min: number; max: number; step?: number }> = [
  { key: "leftArm", label: "Left shoulder", min: -160, max: 160 }, { key: "rightArm", label: "Right shoulder", min: -160, max: 160 },
  { key: "leftElbow", label: "Left elbow", min: -140, max: 140 }, { key: "rightElbow", label: "Right elbow", min: -140, max: 140 },
  { key: "leftLeg", label: "Left hip", min: -70, max: 70 }, { key: "rightLeg", label: "Right hip", min: -70, max: 70 },
  { key: "leftKnee", label: "Left knee", min: -110, max: 110 }, { key: "rightKnee", label: "Right knee", min: -110, max: 110 },
  { key: "head", label: "Head tilt", min: -35, max: 35 }, { key: "body", label: "Body lean", min: -25, max: 25 },
  { key: "gazeX", label: "Eye direction left to right", min: -5, max: 5, step: 0.1 }, { key: "gazeY", label: "Eye direction up and down", min: -4, max: 4, step: 0.1 },
  { key: "blink", label: "Eyes closed", min: 0, max: 1, step: 0.01 }, { key: "mouth", label: "Mouth expression", min: -1, max: 1, step: 0.01 },
];

export function AvatarPuppetPad({ index, color, config, playerId, label = "Your character", pose: initialPose, expanded = false, active = true }: {
  index: number;
  color: string;
  config?: AvatarConfig | null;
  playerId?: string;
  label?: string;
  pose?: Partial<AvatarPose>;
  expanded?: boolean;
  active?: boolean;
}) {
  const [open, setOpen] = useState(expanded);
  const [screen, setScreen] = useState<'drag' | 'reactions' | 'controls'>('drag');
  const [controlPage, setControlPage] = useState(0);
  const [reactionPage, setReactionPage] = useState(0);
  const [compact, setCompact] = useState(false);
  const controlsPerPage = compact ? 2 : 4;
  useEffect(() => { const media = matchMedia('(max-height: 440px)'); const update = () => setCompact(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const [pose, setPose] = useState<AvatarPose>(() => clampPose(initialPose));
  const [controlPose, setControlPose] = useState<AvatarPose>(() => clampPose(initialPose));
  const previewRef = useRef<HTMLDivElement>(null);
  const target = useRef<AvatarPose>(clampPose(initialPose));
  const current = useRef<AvatarPose>(clampPose(initialPose));
  const velocity = useRef<AvatarPose>({ ...NEUTRAL_POSE });
  const animateRef = useRef<(now: number) => void>(() => {});
  const pointerId = useRef<number | null>(null);
  const handleRef = useRef<Handle | null>(null);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);
  const handleOrigin = useRef<{ x: number; y: number } | null>(null);
  const pointerMatrix = useRef<DOMMatrix | null>(null);
  const solverOrigin = useRef<{ upper: number; lower: number } | null>(null);
  const poseOrigin = useRef<AvatarPose>({ ...NEUTRAL_POSE });
  const preset = useRef<{ name: string; startedAt: number | null } | null>(null);
  const reducedPresetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  const lastFrame = useRef(0);
  const frame = useRef<number | null>(null);
  const { publishPose } = useAvatarPoseControls();

  const setTarget = useCallback((next: Partial<AvatarPose>, snap = false) => {
    preset.current = null;
    if (reducedPresetTimer.current) clearTimeout(reducedPresetTimer.current);
    reducedPresetTimer.current = null;
    target.current = clampPose(next);
    setControlPose(target.current);
    if (snap || reducedMotionRef.current) {
      current.current = target.current;
      velocity.current = { ...NEUTRAL_POSE };
      setPose(current.current);
      publishPose(current.current, playerId);
    }
  }, [playerId, publishPose]);
  const animate = useCallback((now: number) => {
    const elapsed = lastFrame.current ? Math.min(0.05, (now - lastFrame.current) / 1000) : 1 / 60;
    lastFrame.current = now;
    if (preset.current) {
      if (preset.current.startedAt === null) preset.current.startedAt = now;
      const time = now - preset.current.startedAt;
      if (time >= poseSequenceDuration(preset.current.name)) {
        preset.current = null;
        target.current = { ...NEUTRAL_POSE };
      } else target.current = poseSequenceAt(preset.current.name, time);
    }
    const result = stepPoseSpring(current.current, target.current, velocity.current, elapsed, reducedMotionRef.current);
    current.current = result.pose;
    velocity.current = result.velocity;
    setPose(result.pose);
    publishPose(result.pose, playerId);
    const moving = Object.keys(result.pose).some(key => Math.abs(result.pose[key as keyof AvatarPose] - target.current[key as keyof AvatarPose]) > 0.08 || Math.abs(result.velocity[key as keyof AvatarPose]) > 0.1);
    if (moving || pointerId.current !== null || preset.current) frame.current = requestAnimationFrame(animateRef.current);
    else { frame.current = null; lastFrame.current = 0; }
  }, [playerId, publishPose]);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => { animateRef.current = animate; }, [animate]);
  const kick = useCallback(() => {
    if (frame.current === null) frame.current = requestAnimationFrame(animateRef.current);
  }, []);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (reducedPresetTimer.current) clearTimeout(reducedPresetTimer.current);
  }, []);

  useEffect(() => {
    if (active) return;
    pointerId.current = null;
    handleRef.current = null;
    preset.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    lastFrame.current = 0;
    setTarget(NEUTRAL_POSE, true);
    current.current = { ...NEUTRAL_POSE };
    velocity.current = { ...NEUTRAL_POSE };
    publishPose(NEUTRAL_POSE, playerId);
  }, [active, playerId, publishPose, setTarget]);

  const frameFor = (handle: Handle, target: Element) => {
    if (handle === "body") return '[data-puppet-frame="body"]';
    if (handle === "head") return '[data-puppet-frame="head"]';
    const pieceId = target.closest<SVGElement>("[data-avatar-piece]")?.dataset.avatarPiece;
    return pieceId ? `[data-avatar-piece="${pieceId}"] > g` : null;
  };
  const point = (event: ReactPointerEvent<HTMLDivElement>, matrix = pointerMatrix.current) => {
    if (!matrix || typeof DOMPoint === "undefined") return null;
    const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
    return Number.isFinite(local.x) && Number.isFinite(local.y) ? { x: local.x, y: local.y } : null;
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || !open || screen !== 'drag' || pointerId.current !== null) return;
    const targetElement = event.target as Element;
    const pieceId = targetElement.closest<SVGElement>("[data-avatar-piece]")?.dataset.avatarPiece;
    const fallback: Record<string, Handle> = {
      leftArm: "leftHand", rightArm: "rightHand", leftLeg: "leftFoot", rightLeg: "rightFoot",
      leftEye: "eyes", rightEye: "eyes", mouth: "mouth", outfit: "body", outfitDecoration: "body",
      face: "head", faceDetail: "head", hair: "head", fringe: "head", hat: "head", hatDecoration: "head",
      leftEar: "head", rightEar: "head", glasses: "head", nose: "head", leftBrow: "head", rightBrow: "head",
      freckles: "head", facialHair: "head", leftEarring: "head", rightEarring: "head", choker: "head",
      necklace: "body", crossbody: "body", tattoos: "rightHand",
    };
    const directHandle = targetElement.closest<SVGElement>("[data-puppet-handle]");
    const garment = targetElement.closest<SVGElement>('[data-avatar-garment-transform]')?.dataset.avatarGarmentTransform;
    const garmentHandle = garment?.startsWith('left') ? 'leftHand' : garment?.startsWith('right') ? 'rightHand' : undefined;
    const hit = (directHandle?.dataset.puppetHandle ?? garmentHandle ?? fallback[pieceId ?? ""]) as Handle | undefined;
    if (!hit) return;
    const svg = previewRef.current?.querySelector("svg");
    const handleElement = directHandle ?? svg?.querySelector<SVGGraphicsElement>(`[data-puppet-handle="${hit}"]`);
    if (!handleElement) return;
    const frameSelector = frameFor(hit, handleElement);
    const frame = frameSelector ? previewRef.current?.querySelector<SVGGraphicsElement>(frameSelector) : null;
    const inverse = frame?.getScreenCTM()?.inverse();
    if (!inverse) return;
    pointerMatrix.current = inverse;
    const at = point(event, inverse);
    if (!at) return;
    const cx = Number(handleElement?.getAttribute("cx"));
    const cy = Number(handleElement?.getAttribute("cy"));
    const handleCtm = (handleElement as SVGGraphicsElement).getScreenCTM();
    const centerScreen = handleCtm && Number.isFinite(cx) && Number.isFinite(cy) ? new DOMPoint(cx, cy).matrixTransform(handleCtm) : null;
    const center = centerScreen?.matrixTransform(inverse);
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) return;
    handleOrigin.current = { x: center.x, y: center.y };
    event.preventDefault();
    pointerId.current = event.pointerId;
    handleRef.current = hit;
    preset.current = null;
    pointerOrigin.current = at;
    poseOrigin.current = { ...current.current };
    if (hit.endsWith("Hand") || hit.endsWith("Foot")) {
      const left = hit.startsWith("left");
      const arm = hit.endsWith("Hand");
      const origin = arm ? { x: left ? 91 : 149, y: 230 } : { x: left ? 104 : 136, y: 307 };
      solverOrigin.current = solveTwoBoneAngles(origin, handleOrigin.current, arm ? 40 : 39, arm ? 40 : 22, left ? 1 : -1);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    kick();
  };
  const moveHandle = (handle: Handle, at: { x: number; y: number }, origin: { x: number; y: number }) => {
    const next = { ...poseOrigin.current };
    const dx = at.x - origin.x;
    const dy = at.y - origin.y;
    if (handle === "head") next.head = poseOrigin.current.head - dx * 1.25;
    else if (handle === "body") { next.x = poseOrigin.current.x + dx; next.y = poseOrigin.current.y + dy; }
    else if (handle === "eyes") { next.gazeX = poseOrigin.current.gazeX + dx; next.gazeY = poseOrigin.current.gazeY + dy; }
    else if (handle === "mouth") next.mouth = poseOrigin.current.mouth + dy / 24;
    else {
      const left = handle.startsWith("left");
      const arm = handle.endsWith("Hand");
      const origin = arm ? { x: left ? 91 : 149, y: 230 } : { x: left ? 104 : 136, y: 307 };
      const start = handleOrigin.current;
      const solverBase = solverOrigin.current;
      if (!start || !solverBase) return;
      const targetPoint = { x: start.x + dx, y: start.y + dy };
      const solved = solveTwoBoneAngles(origin, targetPoint, arm ? 40 : 39, arm ? 40 : 22, left ? 1 : -1);
      if (arm) {
        next[left ? "leftArm" : "rightArm"] = poseOrigin.current[left ? "leftArm" : "rightArm"] + solved.upper - solverBase.upper;
        next[left ? "leftElbow" : "rightElbow"] = poseOrigin.current[left ? "leftElbow" : "rightElbow"] + solved.lower - solverBase.lower;
      } else {
        next[left ? "leftLeg" : "rightLeg"] = poseOrigin.current[left ? "leftLeg" : "rightLeg"] + solved.upper - solverBase.upper;
        next[left ? "leftKnee" : "rightKnee"] = poseOrigin.current[left ? "leftKnee" : "rightKnee"] + solved.lower - solverBase.lower;
      }
    }
    setTarget(next);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId || !handleRef.current) return;
    const at = point(event);
    if (!at || !pointerOrigin.current) return;
    moveHandle(handleRef.current, at, pointerOrigin.current);
    kick();
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    handleRef.current = null;
    pointerOrigin.current = null;
    handleOrigin.current = null;
    pointerMatrix.current = null;
    solverOrigin.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* capture may already be released by the browser */ }
    setTarget(NEUTRAL_POSE);
    kick();
  };
  useEffect(() => {
    if (!open) return;
    const reset = () => {
      if (pointerId.current === null) return;
      pointerId.current = null;
      handleRef.current = null;
      pointerOrigin.current = null;
      handleOrigin.current = null;
      pointerMatrix.current = null;
      solverOrigin.current = null;
      setTarget(NEUTRAL_POSE);
      kick();
    };
    const hidden = () => { if (document.visibilityState === "hidden") reset(); };
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("blur", reset); document.removeEventListener("visibilitychange", hidden); };
  }, [kick, open, setTarget]);

  const choosePreset = (name: string) => {
    if (name === "neutral") { setTarget(NEUTRAL_POSE); kick(); return; }
    if (reducedMotionRef.current) {
      setTarget(poseSequenceAt(name, 450));
      reducedPresetTimer.current = setTimeout(() => { reducedPresetTimer.current = null; setTarget(NEUTRAL_POSE); }, poseSequenceDuration(name));
      return;
    }
    preset.current = { name, startedAt: null };
    kick();
  };
  const setJoint = (key: keyof AvatarPose, value: number) => {
    setTarget({ ...target.current, [key]: value });
    kick();
  };
  const toggleOpen = () => {
    if (open) {
      setTarget(NEUTRAL_POSE);
      kick();
    }
    setOpen(!open);
  };

  return <section className="avatar-puppet-pad">
    {!expanded && <button className="avatar-puppet-toggle" type="button" aria-expanded={open} aria-controls={`avatar-puppet-${playerId ?? index}`} onClick={toggleOpen}>
      <span aria-hidden="true">✦</span> Play with your character <b>{open ? "−" : "+"}</b>
    </button>}
    {open && <div className="avatar-puppet-panel" id={`avatar-puppet-${playerId ?? index}`}>
      <div className="avatar-puppet-screen-heading">{screen !== 'drag' && <button type="button" onClick={() => setScreen('drag')}>Back</button>}<strong>{screen === 'drag' ? 'Your character' : screen === 'reactions' ? 'Reactions' : 'Joint controls'}</strong><button type="button" onClick={() => choosePreset('neutral')}>Settle</button></div>
      <p className="avatar-puppet-hint">{screen === 'drag' ? 'Drag a hand, foot, face or body. Release to settle.' : screen === 'reactions' ? 'Tap a reaction. Everyone sees your character move.' : 'Adjust a joint with touch or your keyboard.'}</p>
      <div ref={previewRef} className="avatar-puppet-preview" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
        <Avatar index={index} color={color} config={config} size="medium" label={label} pose={active ? pose : NEUTRAL_POSE} interactive={screen === 'drag'} />
      </div>
      {screen === 'drag' && <div className="avatar-puppet-menu"><button type="button" aria-label="Reactions" onClick={() => setScreen('reactions')}>Reactions <span>9 funny moves →</span></button><button type="button" aria-label="Joint controls" onClick={() => { setTarget(current.current, true); setScreen('controls'); }}>Joint controls <span>Face, arms & legs →</span></button></div>}
      {screen === 'reactions' && <div className="avatar-puppet-reactions"><div className="avatar-puppet-presets" role="group" aria-label="Character poses">
        {(compact ? AVATAR_PRESETS.slice(reactionPage * 3, reactionPage * 3 + 3) : AVATAR_PRESETS).map(name => <button key={name} type="button" data-avatar-preset={name} onClick={() => choosePreset(name)}>{name === "wave" ? "Wave" : name === "jump" ? "Jump" : name === "cheer" ? "Cheer" : name === "cry" ? "Cry" : name === "funny" ? "Funny" : name === "dance" ? "Dance" : name === "facepalm" ? "Facepalm" : name === "laugh" ? "Laugh" : "Wobble"}</button>)}
      </div>{compact && <div className="phone-page-buttons"><button type="button" disabled={reactionPage === 0} onClick={() => setReactionPage(p => p - 1)}>Previous</button><span>{reactionPage + 1} / 3</span><button type="button" disabled={reactionPage === 2} onClick={() => setReactionPage(p => p + 1)}>Next</button></div>}</div>}
      {screen === 'controls' && <div className="avatar-puppet-keyboard">
        <div className="avatar-puppet-sliders">{SLIDERS.slice(Math.min(controlPage, Math.ceil(SLIDERS.length / controlsPerPage) - 1) * controlsPerPage, (Math.min(controlPage, Math.ceil(SLIDERS.length / controlsPerPage) - 1) + 1) * controlsPerPage).map(({ key, label: sliderLabel, min, max, step = 1 }) => <label key={key}>
          <span>{sliderLabel}</span>
          <input type="range" min={min} max={max} step={step} value={controlPose[key]} onChange={event => setJoint(key, Number(event.target.value))} aria-label={sliderLabel} />
        </label>)}</div>
        <div className="phone-page-buttons"><button type="button" disabled={controlPage === 0} onClick={() => setControlPage(p => Math.max(0, Math.min(p, Math.ceil(SLIDERS.length / controlsPerPage) - 1) - 1))}>Previous</button><span>{Math.min(controlPage + 1, Math.ceil(SLIDERS.length / controlsPerPage))} / {Math.ceil(SLIDERS.length / controlsPerPage)}</span><button type="button" disabled={(controlPage + 1) * controlsPerPage >= SLIDERS.length} onClick={() => setControlPage(p => p + 1)}>Next</button></div>
      </div>}
    </div>}
  </section>;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}
