import { z } from 'zod';
import { POSE_LIMITS, type AvatarPose } from './avatar-pose';

export const AVATAR_POSE_TTL_MS = 3000;
export const avatarPoseSchema = z.object(Object.fromEntries(
  Object.entries(POSE_LIMITS).map(([key, [min, max]]) => [key, z.number().min(min).max(max)]),
) as Record<keyof AvatarPose, z.ZodNumber>).strict();
export const avatarPoseRequestSchema = z.object({
  sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  pose: avatarPoseSchema,
}).strict();
export interface LiveAvatarPose { playerId: string; sequence: number; pose: AvatarPose; expiresAt: number }
export interface AvatarPoseSnapshot { poses: LiveAvatarPose[]; serverTime: number }
