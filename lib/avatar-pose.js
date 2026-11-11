// Transient puppet coordinates. Saved character proportions and piece edits are separate.
export const POSE_LIMITS = Object.freeze({
  leftArm: [-160, 160], rightArm: [-160, 160],
  leftElbow: [-140, 140], rightElbow: [-140, 140],
  leftLeg: [-70, 70], rightLeg: [-70, 70],
  leftKnee: [-110, 110], rightKnee: [-110, 110],
  head: [-35, 35], body: [-25, 25], x: [-32, 32], y: [-55, 20],
  gazeX: [-5, 5], gazeY: [-4, 4], blink: [0, 1], mouth: [-1, 1],
});
export const NEUTRAL_POSE = Object.freeze(Object.fromEntries(Object.keys(POSE_LIMITS).map(key => [key, 0])));
export function clampPose(value = {}) {
  return Object.fromEntries(Object.entries(POSE_LIMITS).map(([key, [min, max]]) => [key,
    typeof value[key] === 'number' && Number.isFinite(value[key]) ? Math.min(max, Math.max(min, value[key])) : 0]));
}
