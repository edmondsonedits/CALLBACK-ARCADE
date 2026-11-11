import type {WorkshopSnapshot} from "../sorcery-workshop";
import type { FishFinaleSnapshot } from "./fish-finale";
import { z } from "zod";

export const SKETCH_RELAY_REVEAL_MS = 12_000;
export const SKETCH_RELAY_TIMERS: Record<SketchRelayPhase, number> = { "prompt-writing": 120_000, "prompt-voting": 60_000, showcase: 4_000, "laughter-voting": 40_000, "artist-guessing": 35_000, halfway: 8_000, "curse-selection": 15_000, "final-preparation": 30_000, drawing: 60_000, transforming: 35_000, captioning: 20_000, redrawing: 40_000, "transforming-redraw": 35_000, revealing: SKETCH_RELAY_REVEAL_MS, "round-results": 5_000, complete: 0 };
export const SKETCH_RELAY_PHASES = ["prompt-writing", "prompt-voting", "showcase", "laughter-voting", "artist-guessing", "halfway", "curse-selection", "final-preparation", "drawing", "transforming", "captioning", "redrawing", "transforming-redraw", "revealing", "round-results", "complete"] as const;
export const SketchRelayPhaseSchema = z.enum(SKETCH_RELAY_PHASES);
export type SketchRelayPhase = z.infer<typeof SketchRelayPhaseSchema>;
export const SketchRelayLegSchema = z.enum(["drawing", "redraw"]);
export type SketchRelayLeg = z.infer<typeof SketchRelayLegSchema>;
export const SketchRelayBoundSchema = z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(3), chainId: z.string().min(1).max(160) });
export const SelectSketchPromptSchema = SketchRelayBoundSchema.extend({ promptIndex: z.number().int().min(0).max(2) }).strict();
export const SubmitSketchCaptionSchema = SketchRelayBoundSchema.extend({ caption: z.string().trim().min(1).max(140) }).strict();
export const SubmitSketchApplauseSchema = SketchRelayBoundSchema.extend({ leg: SketchRelayLegSchema }).strict();
export const AdvanceSketchRelaySchema = z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(3), phase: SketchRelayPhaseSchema, transition: z.enum(["next", "replay"]) }).strict();
export interface SketchRelayImage { status: "QUEUED" | "READY" | "FALLBACK" | "MISSING"; assetId?: string; jobId?: string }
export interface SketchRelaySnapshotLeg { playerId: string; assetId?: string; practice?: boolean; image: SketchRelayImage }
export interface SketchRelaySnapshotChain { chainId: string; round: number; prompt: string; originalPlayerId: string; captionPlayerId: string; redrawPlayerId: string; drawing?: SketchRelaySnapshotLeg; caption?: string; redraw?: SketchRelaySnapshotLeg }
export interface SnapshotSketchRelay {
  fishTest?: boolean;
  finale?: FishFinaleSnapshot;
  matchId: string; round: number; totalRounds: 2 | 3; phase: SketchRelayPhase; deadline: number;
  players: string[]; totalPlayers: number; submittedCount: number; scores: Record<string, number>;
  revealIndex: number; revealTotal: number;
  self?: { chainId: string; submitted: boolean; promptChoices?: string[]; prompt?: string; restriction?: SketchCurse; starter?: SketchStarter; sourceImage?: SketchRelayImage; caption?: string; practice?: boolean };
  reveal?: SketchRelaySnapshotChain; chains?: SketchRelaySnapshotChain[];
  applauseOptions: Array<{ chainId: string; playerId: string; leg: SketchRelayLeg }>; applauded: boolean;
  showdown?: SketchShowdownSnapshot;
}
export interface SketchRelayUploadReceipt { matchId: string; round: number; chainId: string; leg: SketchRelayLeg; promptIndex?: number; assetId: string; width: number; height: number; byteSize: number; contentType: "image/png"; objectKey: string }
export interface SketchRelayTransformPayload { kind: "SKETCH_TRANSFORM"; matchId: string; round: number; chainId: string; leg: SketchRelayLeg; sourceAssetId: string; jobId: string; prompt?: string }

const showdownBound = z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(3) });
export const SKETCH_CURSES = ["circles", "giant-brush", "no-erase", "limited-palette", "no-fill", "lines"] as const;
export type SketchCurse = typeof SKETCH_CURSES[number];
export const SKETCH_CURSE_LABELS: Record<SketchCurse, string> = { circles: "Circles only", "giant-brush": "Giant brush", "no-erase": "No erasing", "limited-palette": "Limited palette", "no-fill": "No fill", lines: "Straight lines only" };
export const SKETCH_STARTERS = ["sword", "shield", "crown", "person", "dragon"] as const;
export type SketchStarter = typeof SKETCH_STARTERS[number];
export const SKETCH_MODIFIERS = [
  { id: "banquet", label: "At a royal banquet", suffix: "at a royal banquet" },
  { id: "tiny", label: "Inside a tiny teacup", suffix: "inside a tiny teacup" },
  { id: "rescue", label: "Saving the kingdom", suffix: "saving the kingdom" },
] as const;
export const ChooseSketchCurseSchema = showdownBound.extend({ curse: z.enum(SKETCH_CURSES) }).strict();
export const PrepareSketchFinalSchema = showdownBound.extend({ modifier: z.enum(["banquet", "tiny", "rescue"]), starter: z.enum(SKETCH_STARTERS) }).strict();
export const SubmitShowdownPromptSchema = showdownBound.extend({ prompt: z.string().trim().min(3).max(140), exampleId: z.string().max(80).optional() }).strict();
export const RankShowdownSchema = showdownBound.extend({ ranking: z.array(z.string().min(1).max(200)).max(3) }).strict();
export const GuessShowdownSchema = showdownBound.extend({ guesses: z.array(z.object({ entryId: z.string().min(1).max(200), playerId: z.string().min(1).max(200) }).strict()).max(3) }).strict();
export const SKETCH_EMOTES = ["dance", "cheer", "wave", "bow", "shrug", "facepalm"] as const;
export const ShowdownEmoteSchema = showdownBound.extend({ entryId: z.string().min(1).max(200), emote: z.enum(SKETCH_EMOTES) }).strict();
export const SHOWDOWN_TIMERS: Record<SketchRelayPhase, number> = { ...SKETCH_RELAY_TIMERS, showcase: 10_000, drawing: 240_000, transforming: 140_000, revealing: 20_000, "round-results": 8_000 };
export interface ShowdownPromptOption { id: string; text: string; original: boolean }
export interface ShowdownEntry { entryId: string; letter: string; image: SketchRelayImage; practice?: boolean; playerId?: string; originalAssetId?: string; laughterPoints?: number; votes?: number; place?: number; practiceStyle?: { restriction?: SketchCurse; starter?: SketchStarter }; prompt?: string; starter?: SketchStarter; round?: number }
export interface SketchShowdownSnapshot {
  workshop?: WorkshopSnapshot; sorceryLength?: "quick" | "long";
  multiplier?: number; curse?: { chooserId: string; options: SketchCurse[]; selected?: SketchCurse }; finalChoice?: { modifier: string; starter: SketchStarter };
  phaseStartedAt: number; phaseDuration: number; prompt?: string; examples: ShowdownPromptOption[];
  promptOptions?: ShowdownPromptOption[]; ownPromptId?: string; promptSubmitted?: boolean; promptRanking?: string[];
  entries: ShowdownEntry[]; ownEntryId?: string; laughterRanking?: string[]; guesses?: Array<{ entryId: string; playerId: string }>;
  submitted: boolean; pendingPlayers: string[]; revealEntry?: ShowdownEntry; revealedEntries: ShowdownEntry[];
  emote?: { name: typeof SKETCH_EMOTES[number]; playerId: string; expiresAt: number; sequence: number };
  guessResults?: Array<{ entryId: string; correct: boolean; points: number }>; fallback: boolean; champions: string[];
}
