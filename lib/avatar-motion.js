import { clampPose, NEUTRAL_POSE, POSE_LIMITS } from "./avatar-pose.js";

const PRESETS = Object.freeze({
  wave: { rightArm: -118, rightElbow: 28, gazeX: 2, mouth: 0.2 },
  jump: { leftArm: 145, rightArm: -145, leftLeg: -25, rightLeg: 25, y: -44, body: -5, mouth: 0.8 },
  cheer: { leftArm: 138, rightArm: -138, leftElbow: -24, rightElbow: 24, y: -14, mouth: 0.8 },
  cry: { leftArm: 32, rightArm: -32, head: 12, gazeY: 3, blink: 0.55, mouth: -0.8 },
  funny: { leftArm: 65, rightArm: -30, leftElbow: 85, rightElbow: -105, head: -24, body: 18, gazeX: -3, mouth: 0.8 },
  dance: { leftArm: 90, rightArm: -118, leftLeg: -24, rightLeg: 24, body: -18, head: 12, mouth: 0.4 },
  facepalm: { rightArm: -72, rightElbow: -118, head: 18, gazeY: 2, mouth: -0.35 },
  laugh: { leftArm: 32, rightArm: -32, body: 10, head: -8, gazeY: -1, mouth: 1 },
  wobble: { leftArm: 108, rightArm: -92, leftLeg: 15, rightLeg: -17, body: 25, head: -30, x: 18, mouth: 0.35 },
});

export const AVATAR_PRESETS = Object.freeze(Object.keys(PRESETS));

const TIMED_POSES = Object.freeze({
  wave: { duration: 1_650, frames: [[0, {}], [220, { rightArm: -92, rightElbow: 58 }], [480, { rightArm: -132, rightElbow: 16 }], [740, { rightArm: -92, rightElbow: 58 }], [1_000, { rightArm: -132, rightElbow: 16 }], [1_280, {}]] },
  jump: { duration: 1_350, frames: [[0, {}], [220, { body: 8, leftLeg: 16, rightLeg: -16 }], [420, { leftArm: 145, rightArm: -145, leftLeg: -25, rightLeg: 25, y: -48, mouth: 0.8 }], [720, { leftArm: 142, rightArm: -142, leftLeg: -20, rightLeg: 20, y: -44, mouth: 0.8 }], [900, { y: 8, body: -8 }], [1_200, {}]] },
  cheer: { duration: 1_900, frames: [[0, {}], [240, { leftArm: 138, rightArm: -138, leftElbow: -24, rightElbow: 24, y: -14, mouth: 0.8 }], [660, { leftArm: 124, rightArm: -124, leftElbow: 18, rightElbow: -18, y: -8, mouth: 0.8 }], [980, {}], [1_180, { leftArm: 138, rightArm: -138, y: -12, mouth: 0.8 }], [1_520, {}]] },
  cry: { duration: 2_100, frames: [[0, {}], [220, { leftArm: 32, rightArm: -32, head: 12, gazeY: 3, blink: 0.55, mouth: -0.8 }], [650, { leftArm: 39, rightArm: -40, head: 15, gazeY: 3.5, blink: 0.7, mouth: -0.8 }], [920, { leftArm: 32, rightArm: -32, head: 12, gazeY: 3, blink: 0.55, mouth: -0.8 }], [1_480, {}]] },
  funny: { duration: 1_900, frames: [[0, {}], [220, { leftArm: 65, rightArm: -30, leftElbow: 85, rightElbow: -105, head: -24, body: 18, gazeX: -3, mouth: 0.8 }], [680, { leftArm: 42, rightArm: -58, leftElbow: 112, rightElbow: -80, head: 24, body: -18, gazeX: 3, mouth: 0.8 }], [1_060, { leftArm: 65, rightArm: -30, leftElbow: 85, rightElbow: -105, head: -24, body: 18, gazeX: -3, mouth: 0.8 }], [1_420, {}]] },
  dance: { duration: 2_250, frames: [[0, {}], [180, { leftArm: 90, rightArm: -118, leftLeg: -24, rightLeg: 24, body: -18, head: 12, mouth: 0.4 }], [510, { leftArm: 118, rightArm: -80, leftLeg: 24, rightLeg: -24, body: 18, head: -12, mouth: 0.4 }], [850, { leftArm: 90, rightArm: -118, leftLeg: -24, rightLeg: 24, body: -18, head: 12, mouth: 0.4 }], [1_190, { leftArm: 118, rightArm: -80, leftLeg: 24, rightLeg: -24, body: 18, head: -12, mouth: 0.4 }], [1_600, {}]] },
  facepalm: { duration: 1_750, frames: [[0, {}], [220, { rightArm: -72, rightElbow: -118, head: 18, gazeY: 2, mouth: -0.35 }], [580, { rightArm: -80, rightElbow: -110, head: 14, gazeY: 2, mouth: -0.35 }], [1_000, { rightArm: -72, rightElbow: -118, head: 18, gazeY: 2, mouth: -0.35 }], [1_350, {}]] },
  laugh: { duration: 2_000, frames: [[0, {}], [180, { leftArm: 32, rightArm: -32, body: 10, head: -8, gazeY: -1, mouth: 1 }], [500, { leftArm: 25, rightArm: -25, body: -12, head: 6, gazeY: -1, mouth: 1 }], [820, { leftArm: 32, rightArm: -32, body: 10, head: -8, gazeY: -1, mouth: 1 }], [1_180, { leftArm: 25, rightArm: -25, body: -12, head: 6, gazeY: -1, mouth: 1 }], [1_500, {}]] },
  wobble: { duration: 2_050, frames: [[0, {}], [170, { leftArm: 108, rightArm: -92, leftLeg: 15, rightLeg: -17, body: 25, head: -30, x: 18, mouth: 0.35 }], [470, { leftArm: 70, rightArm: -125, leftLeg: -22, rightLeg: 20, body: -25, head: 30, x: -18, mouth: 0.35 }], [790, { leftArm: 112, rightArm: -88, leftLeg: 16, rightLeg: -18, body: 24, head: -28, x: 16, mouth: 0.35 }], [1_120, { leftArm: 75, rightArm: -120, leftLeg: -20, rightLeg: 18, body: -24, head: 27, x: -16, mouth: 0.35 }], [1_500, {}]] },
});

export function poseForPreset(name) {
  return clampPose(PRESETS[name] ?? NEUTRAL_POSE);
}

export function poseSequenceDuration(name) {
  return TIMED_POSES[name]?.duration ?? 0;
}

export function poseSequenceAt(name, elapsedMs) {
  const sequence = TIMED_POSES[name];
  if (!sequence || elapsedMs >= sequence.duration) return clampPose(NEUTRAL_POSE);
  const time = Math.max(0, elapsedMs);
  const frames = sequence.frames;
  for (let index = 1; index < frames.length; index += 1) {
    const [endAt, endValues] = frames[index];
    const [startAt, startValues] = frames[index - 1];
    if (time > endAt) continue;
    const from = clampPose(startValues);
    const to = clampPose(endValues);
    const progress = Math.max(0, Math.min(1, (time - startAt) / Math.max(1, endAt - startAt)));
    const eased = progress * progress * (3 - 2 * progress);
    return clampPose(Object.fromEntries(Object.keys(from).map(key => [key, from[key] + (to[key] - from[key]) * eased])));
  }
  return clampPose(NEUTRAL_POSE);
}

const VELOCITY_LIMIT = Object.freeze({ x: 240, y: 360, gazeX: 32, gazeY: 32, blink: 8, mouth: 8 });

export function stepPoseSpring(current = NEUTRAL_POSE, target = NEUTRAL_POSE, velocity = NEUTRAL_POSE, dt = 1 / 60, reducedMotion = false) {
  if (reducedMotion) return { pose: clampPose(target), velocity: clampPose(NEUTRAL_POSE) };
  const pose = {};
  const nextVelocity = {};
  const step = Math.max(0, Math.min(0.05, Number.isFinite(dt) ? dt : 0));
  const safeCurrent = clampPose(current);
  const safeTarget = clampPose(target);
  const safeVelocity = Object.fromEntries(Object.keys(POSE_LIMITS).map(key => [key, Number.isFinite(velocity[key]) ? Math.max(-(VELOCITY_LIMIT[key] ?? 720), Math.min(VELOCITY_LIMIT[key] ?? 720, velocity[key])) : 0]));
  for (const key of Object.keys(POSE_LIMITS)) {
    const acceleration = (safeTarget[key] - safeCurrent[key]) * 90 - safeVelocity[key] * 17;
    const maxSpeed = VELOCITY_LIMIT[key] ?? 720;
    nextVelocity[key] = Math.max(-maxSpeed, Math.min(maxSpeed, safeVelocity[key] + acceleration * step));
    pose[key] = safeCurrent[key] + nextVelocity[key] * step;
  }
  return { pose: clampPose(pose), velocity: nextVelocity };
}

export function solveTwoBoneAngles(origin, target, upperLength, lowerLength, bendDirection = 1) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const upper = Math.max(1, Number.isFinite(upperLength) ? upperLength : 1);
  const lower = Math.max(1, Number.isFinite(lowerLength) ? lowerLength : 1);
  const reach = Math.max(Math.abs(upper - lower) + 0.01, Math.min(upper + lower - 0.01, distance || 0.01));
  const direction = bendDirection < 0 ? -1 : 1;
  const shoulder = Math.acos(Math.max(-1, Math.min(1, (upper * upper + reach * reach - lower * lower) / (2 * upper * reach))));
  const elbow = Math.acos(Math.max(-1, Math.min(1, (upper * upper + lower * lower - reach * reach) / (2 * upper * lower))));
  const targetBearing = Math.atan2(dy, dx) * 180 / Math.PI;
  const baseBearing = Math.atan2(1, 0) * 180 / Math.PI;
  return {
    upper: targetBearing - baseBearing + direction * shoulder * 180 / Math.PI,
    lower: -direction * (Math.PI - elbow) * 180 / Math.PI,
    reach,
  };
}

export { NEUTRAL_POSE, clampPose };
