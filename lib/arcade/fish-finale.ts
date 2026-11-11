import { z } from "zod";

/** The bonus has an independent clock and never changes the completed match's scores. */
export const FISH_DRAWING_SECONDS = [90, 120, 180, 240, 300, 360] as const;
export const FishDrawingSecondsSchema = z.union([z.literal(90), z.literal(120), z.literal(180), z.literal(240), z.literal(300), z.literal(360)]);
export type FishDrawingSeconds = z.infer<typeof FishDrawingSecondsSchema>;
export const FISH_FINALE_PHASES = ["configure", "tutorial", "drawing", "grace", "readiness", "reveal", "voting", "cinematic", "champion", "artists", "aquarium", "closed"] as const;
export const FishFinalePhaseSchema = z.enum(FISH_FINALE_PHASES);
export type FishFinalePhase = z.infer<typeof FishFinalePhaseSchema>;
export const FishFinaleModeSchema = z.enum(["peaceful", "shark"]);
export type FishFinaleMode = z.infer<typeof FishFinaleModeSchema>;
const id = z.string().min(1).max(200);
const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
export const FishArtMetadataSchema = z.object({
  width: z.number().int().min(1).max(1024), height: z.number().int().min(1).max(1024),
  anchors: z.object({ head: point, body: point, tail: point }).strict(),
  bounds: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict(),
}).strict();
export type FishArtMetadata = z.infer<typeof FishArtMetadataSchema>;
export const FISH_ART_DEFAULTS: FishArtMetadata = { width: 512, height: 512, anchors: { head: { x: 0.75, y: 0.5 }, body: { x: 0.5, y: 0.5 }, tail: { x: 0.2, y: 0.5 } }, bounds: { x: 0, y: 0, width: 1, height: 1 } };
const PlayerSchema = z.object({ id, name: z.string().min(1).max(100), bot: z.boolean() }).strict();
const EntrySchema = FishArtMetadataSchema.extend({ id, playerId: id, assetId: id.optional(), practice: z.boolean(), appearanceSeed: z.number().int().nonnegative(), submittedAt: z.number().nonnegative() }).strict();
const BallotSchema = z.object({ playerId: id, ranking: z.array(id).max(3), lockedAt: z.number().nonnegative() }).strict();
const ResultRowSchema = z.object({ entryId: id, points: z.number().int().nonnegative(), firsts: z.number().int().nonnegative(), seconds: z.number().int().nonnegative(), tieDraw: z.boolean() }).strict();
const ResultSchema = z.object({ kind: z.enum(["voted", "lucky", "showcase", "no-votes", "solo"]), ranking: z.array(ResultRowSchema).max(10), championEntryId: id.optional(), lockedAt: z.number().nonnegative(), receivedBallots: z.number().int().min(0).max(10), expectedBallots: z.number().int().min(0).max(10), selections: z.number().int().nonnegative() }).strict();
/** Persisted authority, never a client projection.
 * players freezes the named roster available to this bonus; participantIds activates it at FISH_START.
 * entries are immutable accepted art receipts, including unavailable art retained after readiness.
 * unavailableEntryIds/readinessChecked record the service's bounded object-storage reconciliation.
 * eligibleEntryIds and revealOrder freeze together after reconciliation; only their owners may vote.
 * ballots are immutable after acknowledgement. result stores the entire seeded outcome before playback.
 * seed, owners, ballots and future results MUST cross the client boundary through fishFinaleSnapshot only.
 * deadline=0 denotes untimed configure/aquarium/closed phases; pause shifts the bonus clock on resume.
 */
export const FishFinaleStateSchema = z.object({
  version: z.literal(1), matchId: id, finaleId: id, seed: z.string().min(1).max(200), revision: z.number().int().nonnegative(),
  presentationKey: z.string().max(2000).optional(),
  phase: FishFinalePhaseSchema, mode: FishFinaleModeSchema, drawingSeconds: FishDrawingSecondsSchema,
  createdAt: z.number().nonnegative(), updatedAt: z.number().nonnegative(), phaseStartedAt: z.number().nonnegative(), deadline: z.number().nonnegative(),
  pausedAt: z.number().nonnegative().optional(), players: z.array(PlayerSchema).min(1).max(10), participantIds: z.array(id).max(10), eligibleEntryIds: z.array(id).max(10),
  entries: z.array(EntrySchema).max(10), unavailableEntryIds: z.array(id).max(10), readinessChecked: z.boolean(), revealOrder: z.array(id).max(10), ballots: z.array(BallotSchema).max(10), result: ResultSchema.optional(),
  earlyCloseAt: z.number().nonnegative().optional(), graceExtended: z.boolean(), showcaseOnly: z.boolean(), closedReason: z.enum(["finished", "abandoned", "no-fish"]).optional(),
}).strict();
export type FishFinaleState = z.infer<typeof FishFinaleStateSchema>;
export type FishFinaleEntry = FishFinaleState["entries"][number];
export type FishFinaleResult = NonNullable<FishFinaleState["result"]>;

const bound = z.object({ matchId: id, finaleId: id, phase: FishFinalePhaseSchema });
const action = <T extends string, S extends z.ZodRawShape>(type: T, fields: S) => z.object({ type: z.literal(type), payload: bound.extend(fields).strict() }).strict();
export const FishFinaleActionSchema = z.discriminatedUnion("type", [
  action("FISH_CONFIGURE", { mode: FishFinaleModeSchema, drawingSeconds: FishDrawingSecondsSchema }),
  action("FISH_START", {}), action("FISH_BACK", {}), action("FISH_ADVANCE", {}), action("FISH_ADD_TIME", {}), action("FISH_EXTEND_GRACE", {}),
  action("FISH_PAUSE", {}), action("FISH_RESUME", {}), action("FISH_SKIP", {}), action("FISH_EXIT", {}), action("FISH_SHOWCASE", {}),
  action("FISH_BALLOT", { ranking: z.array(id).max(3) }),
]);
export type FishFinaleAction = z.infer<typeof FishFinaleActionSchema>;
export interface FishFinaleActor { id?: string; host: boolean }
export interface FishFinalePublicEntry extends FishArtMetadata {
  id: string; label: string; assetId?: string; practice: boolean; appearanceSeed: number;
  /** Present only for the champion at its reveal, and for everyone from artists onward. */
  artistName?: string; playerId?: string;
}
export interface FishFinaleCinematicEvent {
  id: string; kind: "tension" | "shark-entry" | "hunt" | "final-two" | "charge" | "peaceful-awards";
  startedAt: number; durationMs: number; elapsedMs: number; targetEntryId?: string; biteAtMs?: number;
}
export interface FishFinaleSnapshot {
  version: 1; matchId: string; finaleId: string; revision: number; phase: FishFinalePhase; mode: FishFinaleMode;
  drawingSeconds: FishDrawingSeconds; phaseStartedAt: number; deadline: number; serverNow: number; paused: boolean; elapsedMs: number;
  participantCount: number; submittedCount: number; eligibleCount: number; unavailableCount: number; ballotCount: number; expectedBallotCount: number; rankLimit: number;
  entries: FishFinalePublicEntry[]; revealEntryId?: string; revealedEntryIds: string[];
  self?: { participant: boolean; submitted: boolean; ownEntryId?: string; eligible: boolean; ballotLocked: boolean; ranking?: string[]; ballotOptions: string[] };
  cinematic?: { event?: FishFinaleCinematicEvent; durationMs: number; eliminatedEntryIds: string[] };
  champion?: { entryId: string; artistName: string; label: "Tank Champion" | "Lucky Tank Champion" };
  /** Only after the staged champion/all-artist reveal, never during voting or cinema. */
  result?: FishFinaleResult;
  notice?: string; canChooseShowcase: boolean; graceExtended: boolean; closedReason?: "finished" | "abandoned" | "no-fish";
}
