import type { AvatarConfig } from './avatar-runtime';
export type AvatarPieceId = "face" | "hair" | "fringe" | "leftEar" | "rightEar" | "leftBrow" | "rightBrow" | "leftEye" | "rightEye" | "nose" | "mouth" | "faceDetail" | "glasses" | "facialHair" | "hat" | "hatDecoration" | "outfit" | "outfitDecoration" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg" | "freckles" | "leftEarring" | "rightEarring" | "necklace" | "choker" | "crossbody" | "tattoos";
export interface PieceTransform { x: number; y: number; scale: number; scaleX: number; scaleY: number; rotation: number; flipX: boolean; flipY: boolean; hidden: boolean }
export const AVATAR_PIECES: Array<{ id: AvatarPieceId; label: string }>;
export const AVATAR_PIECE_IDS: AvatarPieceId[];
export const DEFAULT_PIECE_TRANSFORM: Readonly<PieceTransform>;
export const PIECE_LIMITS: { readonly position: 390; readonly minScale: 0.1; readonly maxScale: 4; readonly rotation: 180 };
export function getPieceTransform(config: Partial<AvatarConfig>, id: AvatarPieceId): PieceTransform;
export function pieceTransformAttribute(transform: PieceTransform, cx: number, cy: number): string;
export function availableAvatarPieces(config: AvatarConfig): typeof AVATAR_PIECES;
