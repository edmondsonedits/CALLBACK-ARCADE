/** Cosmetic presentation only: these helpers never rank, vote, or advance a room. */
export interface SwimPersonality {
  phase: number;
  speed: number;
  depth: number;
  depthRange: number;
  curiosity: number;
  tailPhase: number;
  beat: number;
  scale: number;
}

export interface FishPose {
  x: number;
  y: number;
  facing: 1 | -1;
  /** Horizontal narrowing is a yaw turn, never an upside-down rotation. */
  yaw: number;
  /** Which way the body turns through depth; both sides sample the same PNG. */
  turn?: number;
  pitch: number;
  scale: number;
  depth: number;
  tailPhase: number;
  amplitude: number;
  opacity: number;
}

export interface PresentationEvent {
  id: string;
  kind: "tension" | "shark-entry" | "hunt" | "final-two" | "charge" | "peaceful-awards";
  elapsedMs: number;
  durationMs: number;
  targetEntryId?: string;
  biteAtMs?: number;
}

export interface SharkPose {
  x: number; y: number; facing: 1 | -1; yaw: number; pitch: number;
  /** Shark body unit as a fraction of canvas width; the entire character is ~3 units. */
  size: number; open: number; tailPhase: number; opacity: number;
}

export interface FishTankCue {
  id: string;
  kind: "tension" | "arrival" | "bite" | "final-two" | "charge" | "champion" | "revival";
  intensity: number;
}

export const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function fishSeed(value: string | number): number {
  let seed = 2166136261;
  for (const c of String(value)) { seed ^= c.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  return seed >>> 0;
}

/** Stable traits depend on art identity, never on ballot score or ranking. */
export function swimPersonality(seed: string | number): SwimPersonality {
  let state = fishSeed(seed);
  const next = () => { state = Math.imul(state ^ (state >>> 15), 1 | state); state ^= state + Math.imul(state ^ (state >>> 7), 61 | state); return ((state ^ (state >>> 14)) >>> 0) / 4294967296; };
  return { phase: next() * Math.PI * 2, speed: .36 + next() * .12, depth: .31 + next() * .36, depthRange: .09 + next() * .07, curiosity: next() * Math.PI * 2, tailPhase: next() * Math.PI * 2, beat: 1.05 + next() * .55, scale: .9 + next() * .13 };
}

/**
 * A bounded analytic steering path can be sought directly after refresh/visibility
 * changes. Its derivatives are continuous; there is no frame-sized random walk,
 * unbounded integration, or accumulated mesh drift. Horizontal speed reaches zero
 * before a fish changes side. The pitch uses screen-normalized derivatives.
 */
export function sampleSwim(p: SwimPersonality, seconds: number, reducedMotion = false): FishPose {
  const time = reducedMotion ? 0 : Math.max(0, seconds);
  // Gentle phase modulation adds a brief curious slowdown and a small burst.
  // Integrate a positive varying rate analytically: accelerate, coast, then dart.
  // The same seekable function works at 15 or 120 Hz without drift.
  const pulse = time * .65 + p.curiosity;
  const phase = p.phase + time * p.speed + p.speed * .68 / .65 * (Math.sin(pulse) - Math.sin(p.curiosity));
  const rate = p.speed * (1 + .68 * Math.cos(pulse));
  const dx = .335 * Math.cos(phase) * rate;
  const dy = p.depthRange * Math.cos(time * .32 + p.curiosity) * .32 + .025 * Math.cos(phase * 1.7 + p.curiosity) * 1.7 * rate;
  const approach = .5 - .5 * Math.cos(phase);
  const effort = clamp(Math.hypot(dx, dy) / .23, 0, 1);
  return {
    x: .5 + Math.sin(phase) * .335,
    y: clamp(p.depth + Math.sin(time * .32 + p.curiosity) * p.depthRange + .025 * Math.sin(phase * 1.7 + p.curiosity), .2, .76),
    facing: reducedMotion || dx >= 0 ? 1 : -1,
    yaw: reducedMotion ? 1 : smooth(Math.abs(Math.cos(phase)) / .3),
    turn: reducedMotion ? 0 : -Math.sign(Math.sin(phase)),
    pitch: reducedMotion ? 0 : clamp(Math.atan2(dy, Math.max(.018, Math.abs(dx))) * .4, -.15, .15),
    scale: p.scale * (reducedMotion ? 1 : .76 + approach * .46), depth: p.depth + (reducedMotion ? 0 : approach * .24), tailPhase: p.tailPhase + p.beat * Math.PI * 2 * (time + .68 / .65 * (Math.sin(pulse) - Math.sin(p.curiosity))),
    amplitude: reducedMotion ? 0 : .016 + Math.pow(effort, 1.3) * .085, opacity: 1,
  };
}

/** A tiny smooth repulsion keeps different depth bands from settling in a pile. */
export function separateFish(poses: FishPose[]): FishPose[] {
  return poses.map((pose, i) => {
    let ox = 0, oy = 0;
    for (let j = 0; j < poses.length; j++) {
      if (i === j) continue;
      const other = poses[j]!;
      const dx = pose.x - other.x, dy = (pose.y - other.y) * .62;
      const distance = Math.hypot(dx, dy);
      if (distance >= .135) continue;
      const strength = smooth(1 - distance / .135) * .025;
      const sign = i > j ? 1 : -1;
      ox += (distance > .0001 ? dx / distance : sign) * strength;
      oy += (distance > .0001 ? dy / distance : sign * .3) * strength;
    }
    return { ...pose, x: clamp(pose.x + ox, .14, .86), y: clamp(pose.y + oy, .18, .8) };
  });
}

/** Original shark's mouth anchor, shared by its art and victim choreography. */
export const SHARK_MOUTH = { x: .88, y: .16 } as const;

export function sharkMouth(pose: SharkPose, aspect: number): { x: number; y: number } {
  const x = SHARK_MOUTH.x * pose.facing * pose.yaw;
  const y = SHARK_MOUTH.y;
  const cos = Math.cos(pose.pitch), sin = Math.sin(pose.pitch);
  return { x: pose.x + (x * cos - y * sin) * pose.size, y: pose.y + (x * sin + y * cos) * pose.size * aspect };
}

/** Every shot uses only the currently authorized event and its named target. */
export function sharkAt(event: PresentationEvent | undefined, seconds: number, aspect = 16 / 9, reducedMotion = false): SharkPose | undefined {
  if (!event || event.kind === "tension" || event.kind === "peaceful-awards") return undefined;
  const time = clamp(event.elapsedMs / Math.max(1, event.durationMs));
  const base: SharkPose = { x: .12, y: .62, facing: 1, yaw: 1, pitch: 0, size: .115, open: 0, tailPhase: reducedMotion ? 0 : seconds * Math.PI * 2 * 1.15, opacity: 1 };
  if (event.kind === "shark-entry") {
    const drop = smooth(time / .55), turn = smooth((time - .45) / .55);
    return { ...base, x: mix(.5, .13, turn), y: mix(-.4, .65, drop), pitch: .24 * (1 - drop), opacity: smooth(time * 5), facing: turn < .95 ? -1 : 1, yaw: .16 + .84 * smooth(Math.abs(turn - .95) / .18) };
  }
  if (event.kind === "charge") {
    const flee = smooth((time - .24) / .76);
    return { ...base, x: mix(.55, 1.38, flee), y: .62 - flee * .08, facing: time < .24 ? -1 : 1, yaw: .2 + .8 * smooth(Math.abs(time - .24) * 15), pitch: -.04, open: .1 * (1 - flee), tailPhase: seconds * Math.PI * 4.5, opacity: 1 - smooth((time - .9) / .1) };
  }
  const bite = event.biteAtMs ?? event.durationMs * .72;
  const before = clamp(event.elapsedMs / Math.max(1, bite));
  const after = clamp((event.elapsedMs - bite) / Math.max(1, event.durationMs - bite));
  const variation = fishSeed(event.id) % 3;
  const facing: 1 | -1 = variation === 1 && event.kind !== "final-two" ? -1 : 1;
  // Both mouth and fish center meet at this exact intercept, including aspect.
  const intercept = { x: facing === 1 ? .65 : .35, y: .62 + (variation - 1) * .04 };
  const targetX = intercept.x - SHARK_MOUTH.x * facing * base.size;
  const targetY = intercept.y - SHARK_MOUTH.y * base.size * aspect;
  let approach = smooth(before), startX = facing === 1 ? -.18 : 1.18;
  let yArc = Math.sin(before * Math.PI) * (variation === 2 ? -.045 : .055);
  let actualFacing = facing, yaw = 1;
  if (event.kind === "final-two" && before < .56) {
    // One near pass and a yaw return, below both finalists, then the final attack.
    const first = before < .32;
    const pass = first ? before / .32 : (before - .32) / .24;
    return { ...base, x: first ? mix(-.2, 1.12, smooth(pass)) : mix(1.12, -.18, smooth(pass)), y: .70, facing: first ? 1 : -1, yaw: .18 + .82 * smooth(Math.min(pass, 1 - pass) * 10), size: .105, open: .08 };
  }
  if (event.kind === "final-two") { approach = smooth((before - .56) / .44); startX = -.18; yArc = Math.sin(approach * Math.PI) * .055; }
  if (after > .4) { actualFacing = facing === 1 ? -1 : 1; yaw = .2 + .8 * smooth((after - .4) / .15); }
  return {
    ...base, facing: actualFacing, yaw,
    x: after <= .4 ? mix(startX, targetX, approach) : mix(targetX, event.kind === "final-two" ? .58 : facing === 1 ? .13 : .87, smooth((after - .4) / .6)),
    y: mix(.66, targetY, approach) + yArc,
    open: smooth((before - .56) / .22) * (1 - smooth(after / .23)),
  };
}

/** Full artwork enters the mouth, then closes behind the front jaw. */
export function directedVictim(pose: FishPose, start: FishPose, event: PresentationEvent, shark: SharkPose | undefined, aspect: number, reducedMotion = false): FishPose {
  if (!shark || (event.kind !== "hunt" && event.kind !== "final-two")) return pose;
  const bite = event.biteAtMs ?? event.durationMs * .72;
  const lead = event.kind === "final-two" ? Math.max(0, bite - 2500) : Math.max(0, bite - 1700);
  const progress = smooth((event.elapsedMs - lead) / Math.max(1, bite - lead));
  const mouth = sharkMouth(shark, aspect);
  const swallow = smooth((event.elapsedMs - bite + 170) / 340);
  const stage = event.kind === "final-two" ? smooth(event.elapsedMs / 1700) : 0;
  const x = event.kind === "final-two" ? mix(start.x, .68, stage) : pose.x, y = event.kind === "final-two" ? mix(start.y, .45, stage) : pose.y;
  const headingPose = event.kind === "final-two" ? start : pose;
  const heading = Math.atan2((headingPose.turn ?? 1) * Math.sqrt(Math.max(0, 1 - headingPose.yaw ** 2)), headingPose.facing * headingPose.yaw);
  const targetHeading = shark.facing === 1 ? 0 : Math.PI;
  const delta = Math.atan2(Math.sin(targetHeading - heading), Math.cos(targetHeading - heading));
  const angle = heading + delta * progress;
  return { ...pose, x: mix(x, mouth.x, progress), y: mix(y, mouth.y, progress), facing: Math.cos(angle) >= 0 ? 1 : -1, yaw: Math.abs(Math.cos(angle)), turn: Math.sign(Math.sin(angle)), pitch: mix(start.pitch, 0, progress), scale: pose.scale * (1 - swallow * .93), opacity: 1 - smooth((event.elapsedMs - bite + 20) / 100), amplitude: reducedMotion ? 0 : pose.amplitude * (1 - progress * .35) };
}

/** Reconnect/seek never emits historical audio, including a burst of past bites. */
export function crossedFishCue(previous: { id: string; elapsedMs: number } | null, event: PresentationEvent): FishTankCue | undefined {
  if (!previous) return undefined;
  if (previous.id !== event.id) {
    if (event.elapsedMs > 900) return undefined;
    const kind = event.kind === "shark-entry" ? "arrival" : event.kind === "hunt" || event.kind === "peaceful-awards" ? undefined : event.kind;
    return kind ? { id: event.id, kind, intensity: kind === "final-two" ? 1 : .65 } : undefined;
  }
  const bite = event.biteAtMs;
  if (bite !== undefined && previous.elapsedMs < bite && event.elapsedMs >= bite && event.elapsedMs - previous.elapsedMs < 1000) return { id: `${event.id}:bite`, kind: "bite", intensity: event.kind === "final-two" ? 1 : .75 };
  return undefined;
}

/** Analytic motion must not lose time when the browser misses a frame. */
export function advanceSwimTime(seconds: number, deltaSeconds: number, held: boolean): number {
  return held ? seconds : seconds + Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
}

/** Decoy passes are cosmetic; the event's server-named victim is never changed.
 * Blend back to the authored intercept before the final attack begins. */
export function chaseFeint(base: SharkPose, event: PresentationEvent, school: FishPose[], aspect: number): SharkPose {
  if (event.kind !== "hunt" || !school.length) return base;
  const lead = Math.max(1, (event.biteAtMs ?? 3000) - 1200);
  const t = clamp(event.elapsedMs / lead);
  if (t >= 1) return base;
  const index = fishSeed(event.id) % school.length;
  const first = school[index]!, second = school[(index + 1) % school.length]!;
  const turn = smooth((t - .32) / .36);
  const preyX = mix(first.x, second.x, turn), preyY = mix(first.y, second.y, turn);
  const amount = smooth(t / .18) * (1 - smooth((t - .72) / .28));
  const x = clamp(preyX - base.facing * .2, .16, .84);
  const y = clamp(preyY + .1, .2 + .95 * base.size * aspect, .98 - .75 * base.size * aspect);
  return { ...base, x: mix(base.x, x, amount), y: mix(base.y, y, amount), open: base.open * (1 - amount), tailPhase: base.tailPhase + Math.sin(t * Math.PI) * 2 };
}
