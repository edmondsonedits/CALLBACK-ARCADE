import type { AvatarPose } from "./avatar-pose";
export { NEUTRAL_POSE, clampPose } from "./avatar-pose";
export const AVATAR_PRESETS: readonly string[];
export function poseForPreset(name: string): AvatarPose;
export function poseSequenceDuration(name: string): number;
export function poseSequenceAt(name: string, elapsedMs: number): AvatarPose;
export function stepPoseSpring(current?: Partial<AvatarPose>, target?: Partial<AvatarPose>, velocity?: Partial<AvatarPose>, dt?: number, reducedMotion?: boolean): { pose: AvatarPose; velocity: AvatarPose };
export function solveTwoBoneAngles(origin: { x: number; y: number }, target: { x: number; y: number }, upperLength: number, lowerLength: number, bendDirection?: number): { upper: number; lower: number; reach: number };
