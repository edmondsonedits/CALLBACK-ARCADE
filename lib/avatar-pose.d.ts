export interface AvatarPose {
  leftArm: number; rightArm: number; leftElbow: number; rightElbow: number;
  leftLeg: number; rightLeg: number; leftKnee: number; rightKnee: number;
  head: number; body: number; x: number; y: number;
  gazeX: number; gazeY: number; blink: number; mouth: number;
}
export const POSE_LIMITS: Readonly<Record<keyof AvatarPose, readonly [number, number]>>;
export const NEUTRAL_POSE: Readonly<AvatarPose>;
export function clampPose(value?: Partial<AvatarPose>): AvatarPose;
