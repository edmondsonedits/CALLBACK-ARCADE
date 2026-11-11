import { FishDrawingSecondsSchema } from "./arcade/fish-finale";
import type { FishFinaleSnapshot } from "./arcade/fish-finale";
import { ChooseSketchCurseSchema, PrepareSketchFinalSchema, SubmitShowdownPromptSchema, RankShowdownSchema, GuessShowdownSchema, ShowdownEmoteSchema } from "./arcade/sketch-relay";
import { AdvanceSketchRelaySchema, SelectSketchPromptSchema, SubmitSketchCaptionSchema, SubmitSketchApplauseSchema, type SnapshotSketchRelay } from "./arcade/sketch-relay";
export type { SnapshotSketchRelay } from "./arcade/sketch-relay";
import { z } from "zod";
import { isArchivedGamePack } from "./game/archived-packs";
import { AVATAR_PIECE_IDS, PIECE_LIMITS } from "./avatar-pieces";
import { ArcadeGameIdSchema } from "./arcade/contracts";

export const roles = ["host", "player", "audience", "display"] as const;
export const gameLengths = ["standard", "birthday", "pictures", "comic", "king-mystery", "royal-rumours", "royal-war-room", "bowl", "bowl-of-fools", "arcade"] as const;
export const contentModes = ["family", "party"] as const;
export const imageModels = ["flux-1-schnell", "flux-2-fast", "flux-2-quality", "openai-low"] as const;
export const roomPhases = ["LOBBY", "INTRO", "ROUND_INTRO", "ANSWERING", "ANSWER_LOCK", "PERSONAL_CHOICE", "ROOM_PREDICTION", "AUTHOR_GUESSING", "IMAGE_REVEAL", "VOTING", "VOTE_LOCK", "REVEAL", "ROUND_RESULTS", "FINAL_WAGER", "FINAL_ANSWERING", "FINAL_VOTING", "FINAL_RESULTS", "POST_GAME", "ENCORE_CONTRIBUTING", "ENCORE_IMAGE", "ENCORE_FOLLOWUP", "MYSTERY_DECOYS", "MYSTERY_VOTING", "MYSTERY_REVEAL", "RUMOUR_GUESSING", "RUMOUR_IMAGE_REVEAL", "RUMOUR_REVEAL", "RUMOUR_VOTING", "WAR_RANKING", "WAR_COUNCIL", "WAR_TURN_REVEAL", "WAR_ROUND_REVEAL", "BOWL_TUTORIAL", "BOWL_SCROLL_WRITING", "BOWL_TURN", "BOWL_INTERMISSION", "BOWL_SUDDEN_DEATH", "FOOL_TEAM_SETUP", "FOOL_WRITING", "FOOL_TURN", "FOOL_ROUND_REVEAL", "FOOL_SUDDEN_DEATH", "ARCADE_ACTIVE", "ARCADE_RESULTS", "ENDED"] as const;
export const roundKinds = ["THE_SEED", "READ_THE_ROOM", "MAKE_IT_REAL", "THE_CATCH", "CROWD_CONTROL", "CALLBACK", "THE_REMIX", "FIRST_IMPRESSIONS", "WHO_SAID_THAT", "FINAL_READ", "BIRTHDAY_BETS", "MONSTER_FACTORY", "PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL", "COMIC_FRAME", "KING_REQUEST_MYSTERY", "ROYAL_RUMOURS", "ROYAL_WAR_ROOM", "BOWL_SPEAK", "BOWL_DRAW_OR_PERFORM", "BOWL_ONE_WORD", "BOWL_SUDDEN_DEATH", "BOWL_OF_FOOLS"] as const;
export const memoryKinds = ["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"] as const;
export const memoryRelations = ["SAYS", "COLLIDES_WITH", "CAUSES", "ESCALATES_TO"] as const;
export const jobStatuses = ["QUEUED", "GENERATING", "READY", "FAILED", "FALLBACK"] as const;

export type Role = (typeof roles)[number];
export type GameLength = (typeof gameLengths)[number];
export type ContentMode = (typeof contentModes)[number];
export type ImageModel = (typeof imageModels)[number];
export type RoomPhase = (typeof roomPhases)[number];
export type RoundKind = (typeof roundKinds)[number];
export type MemoryKind = (typeof memoryKinds)[number];
export type MemoryRelation = (typeof memoryRelations)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type FoolTeam = "BELLS" | "MOTLEY";
export type FoolPlayMode = "SAME_TABLE" | "REMOTE_LIVE";
export type FoolPerformance = "DRAWING" | "CHARADES";
export type BowlTeam = "bells" | "motley";
export type BowlEnvironment = "same_table" | "remote_live";
export type BowlRoundTwo = "drawing" | "charades";

export const roomMediaViewerRoles: Role[] = ["host", "player", "audience", "display"];

export const RoleSchema = z.enum(roles);
export const GameLengthSchema = z.enum(gameLengths);
export const ContentModeSchema = z.enum(contentModes);
export const ImageModelSchema = z.enum(imageModels);
export const RoomPhaseSchema = z.enum(roomPhases);
export const RoundKindSchema = z.enum(roundKinds);
export const MemoryKindSchema = z.enum(memoryKinds);
export const MemoryRelationSchema = z.enum(memoryRelations);
export const JobStatusSchema = z.enum(jobStatuses);

export const avatarPresetNames = ["Virginia", "Gregory", "Aaron", "Liv", "Danny", "Kristin", "Doug", "Ruth", "Judy", "Brandon", "Emily", "Jaclyne", "Alex"] as const;
export const AvatarPresetSchema = z.enum(avatarPresetNames);
export const PieceTransformSchema = z.object({
  x: z.number().finite().min(-PIECE_LIMITS.position).max(PIECE_LIMITS.position),
  y: z.number().finite().min(-PIECE_LIMITS.position).max(PIECE_LIMITS.position),
  scale: z.number().finite().min(PIECE_LIMITS.minScale).max(PIECE_LIMITS.maxScale),
  scaleX: z.number().finite().min(PIECE_LIMITS.minScale).max(PIECE_LIMITS.maxScale),
  scaleY: z.number().finite().min(PIECE_LIMITS.minScale).max(PIECE_LIMITS.maxScale),
  rotation: z.number().finite().min(-PIECE_LIMITS.rotation).max(PIECE_LIMITS.rotation),
  flipX: z.boolean(), flipY: z.boolean(), hidden: z.boolean(),
}).strict();
export const AvatarConfigSchema = z.object({
  photoFaceId: z.string().uuid().optional(),
  pieceTransforms: z.partialRecord(z.enum(AVATAR_PIECE_IDS), PieceTransformSchema).optional(),
  schemaVersion: z.literal(2).default(2),
  faceShape: z.enum(["round", "oval", "long", "square", "heart", "softSquare", "diamond"]),
  skin: z.enum(["porcelain", "fair", "rosy", "warm", "tan", "brown", "deep"]),
  ageDetail: z.enum(["none", "smileLines", "forehead", "mature"]),
  faceWidth: z.number().min(.86).max(1.14), faceHeight: z.number().min(.9).max(1.12),
  hairStyle: z.enum(["none", "buzz", "crop", "spikyCrop", "sidepart", "sweptUp", "receding", "waves", "bob", "layeredBob", "pixie", "shortCurls", "tightCurls", "shoulderCurls", "long", "lowPony", "ponytail", "bun", "braid"]),
  hairColor: z.enum(["black", "espresso", "darkBrown", "brown", "auburn", "copper", "strawberry", "blonde", "ashBlonde", "gray", "white"]),
  hairFlip: z.boolean(), hairline: z.number().int().min(-6).max(8),
  browStyle: z.enum(["soft", "straight", "arched", "thick", "fine", "raised"]),
  browColor: z.enum(["black", "espresso", "darkBrown", "brown", "auburn", "copper", "strawberry", "blonde", "ashBlonde", "gray", "white"]),
  browAngle: z.number().int().min(-18).max(18), browHeight: z.number().int().min(-8).max(8), browSpacing: z.number().int().min(-8).max(10),
  eyeStyle: z.enum(["round", "almond", "narrow", "happy", "wide", "soft", "lashes"]),
  eyeColor: z.enum(["blue", "grayBlue", "green", "hazel", "brown", "dark"]),
  eyeSize: z.number().min(.78).max(1.24), eyeSpacing: z.number().int().min(-7).max(10), eyeHeight: z.number().int().min(-7).max(7), eyeTilt: z.number().int().min(-10).max(10),
  noseStyle: z.enum(["dot", "small", "round", "straight", "wide", "long", "button"]),
  noseSize: z.number().min(.8).max(1.22), noseHeight: z.number().int().min(-7).max(8),
  mouthStyle: z.enum(["smile", "toothy", "wideSmile", "smirk", "softSmile", "open", "neutral", "thinSmile"]),
  mouthWidth: z.number().min(.8).max(1.24), mouthHeight: z.number().int().min(-7).max(9),
  glasses: z.enum(["none", "square", "softSquare", "round", "catEye", "sunglasses"]),
  glassesColor: z.enum(["black", "brown"]), glassesSize: z.number().min(.86).max(1.16), glassesHeight: z.number().int().min(-6).max(7),
  facialHair: z.enum(["none", "stubble", "moustache", "goatee", "shortBeard", "fullBeard"]),
  facialHairColor: z.enum(["black", "espresso", "darkBrown", "brown", "auburn", "copper", "strawberry", "blonde", "ashBlonde", "gray", "white"]),
  facialHairSize: z.number().min(.8).max(1.15),
  outfit: z.enum(["tee", "tank", "polo", "button", "openShirt", "overshirt", "plaid", "floral", "dress", "suit", "hoodie", "vest", "pfd"]),
  outfitColor: z.enum(["navy", "blue", "teal", "charcoal", "black", "red", "green", "gray", "cream", "white"]),
  outfitAccent: z.enum(["yellow", "green", "blue", "teal", "red", "gray", "brown", "black"]),
  hat: z.enum(["none", "blackCap", "grayCap", "sunHat", "bucketHat", "beanie"]),
  extras: z.array(z.enum(["freckles", "earrings", "necklace", "crossbody", "choker"])).max(5).refine((items) => new Set(items).size === items.length, "Avatar extras must be distinct"),
  bodyBuild: z.enum(["slim", "average", "broad"]), bodyHeight: z.number().min(.88).max(1.12), bodyWidth: z.number().min(.86).max(1.14),
  personality: z.enum(["none", "glasses", "beard", "hat", "curls"]),
  signatureDetail: z.enum(["none", "sunsetFlorals", "capPatch", "redCapMark", "wovenStrap", "tropicalPrint", "starTattoos", "outdoorStrap", "geometricTop", "blueFrames"]).optional().default("none"),
}).strict();
export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;

export const roomCodeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-KM-NP-Z2-9]{4}$/);
export const createRoomSchema = z.object({
  gameLength: GameLengthSchema.default("pictures"),
  arcadeGameId: ArcadeGameIdSchema.optional(),
  contentMode: ContentModeSchema.default("party"),
  timerAccessibility: z.boolean().default(false),
  sorceryLength: z.enum(["quick", "long"]).default("long"),
  birthdayName: z.string().trim().min(1).max(40).optional(),
  soloMode: z.boolean().default(false),
  fishTestOnly: z.boolean().default(false),
  soloLiveImages: z.boolean().default(false),
  imageModel: ImageModelSchema.default("flux-1-schnell"),
  developerMode: z.boolean().default(false),
  soloPlayerName: z.string().trim().min(1).max(20).optional(),
  botCount: z.number().int().min(2).max(5).default(3),
  foolPlayMode: z.enum(["SAME_TABLE", "REMOTE_LIVE"]).default("SAME_TABLE"),
  foolPerformance: z.enum(["DRAWING", "CHARADES"]).default("DRAWING"),
  foolScrollsPerPlayer: z.number().int().min(1).max(5).default(3),
  foolVoiceEnabled: z.boolean().default(true),
  foolHostName: z.string().trim().min(1).max(80).optional(),
  foolHostAvatarConfig: AvatarConfigSchema.optional(),
  foolHostAvatarPreset: AvatarPresetSchema.nullable().optional(),
  playEnvironment: z.enum(["same_table", "remote_live"]).default("same_table"),
  bowlRoundTwo: z.enum(["drawing", "charades"]).default("drawing"),
  scrollsPerPlayer: z.number().int().min(1).max(5).default(3),
  builtInVoice: z.boolean().default(false),
  openingTutorial: z.boolean().default(true),
}).strict().superRefine((value, context) => {
  if (isArchivedGamePack(value.gameLength)) context.addIssue({ code: "custom", path: ["gameLength"], message: "This game pack is archived and unavailable for new rooms." });
  if (value.gameLength === "birthday" && !value.birthdayName) context.addIssue({ code: "custom", path: ["birthdayName"], message: "Add the birthday person's first name." });
  if (value.gameLength === "arcade" && !value.arcadeGameId) context.addIssue({ code: "custom", path: ["arcadeGameId"], message: "Choose an Arcade game." });
  if (value.gameLength !== "arcade" && value.arcadeGameId) context.addIssue({ code: "custom", path: ["arcadeGameId"], message: "Arcade games require an Arcade room." });
  if (value.gameLength === "arcade" && ((value.soloMode && (value.arcadeGameId !== "sketch-relay" || !value.fishTestOnly)) || value.developerMode || value.soloLiveImages)) context.addIssue({ code: "custom", path: ["soloMode"], message: "Only the temporary Sketch & Sorcery fish test supports solo rooms." });
  if (value.fishTestOnly && (value.gameLength !== "arcade" || value.arcadeGameId !== "sketch-relay" || !value.soloMode)) context.addIssue({ code: "custom", path: ["fishTestOnly"], message: "Fish-test-only rooms must be solo Sketch & Sorcery rooms." });
  if (value.soloMode && !value.soloPlayerName) context.addIssue({ code: "custom", path: ["soloPlayerName"], message: "Add your playtest nickname." });
  if (value.developerMode && !value.soloMode) context.addIssue({ code: "custom", path: ["developerMode"], message: "Developer mode must use an isolated solo playtest room." });
  if (value.soloLiveImages && (!value.soloMode || !["pictures", "comic", "king-mystery", "royal-rumours"].includes(value.gameLength))) context.addIssue({ code: "custom", path: ["soloLiveImages"], message: "Live solo images require a visual-game solo room." });
  if (value.gameLength === "bowl-of-fools" && value.soloMode) context.addIssue({ code: "custom", path: ["soloMode"], message: "Bowl of Fools needs four or more human players." });
  if (value.gameLength === "bowl-of-fools" && !value.foolHostName?.trim()) context.addIssue({ code: "custom", path: ["foolHostName"], message: "Add your player name." });
  if (value.gameLength === "bowl" && (value.soloMode || value.developerMode)) context.addIssue({ code: "custom", path: ["soloMode"], message: "Bowl of Fools requires four to ten human players." });
  if (value.gameLength === "bowl" && value.builtInVoice && value.playEnvironment !== "remote_live") context.addIssue({ code: "custom", path: ["builtInVoice"], message: "Built-in voice is available only for Remote Live." });
});
export const joinRoomSchema = z.object({
  nickname: z.string().trim().min(1).max(80),
  audience: z.boolean().optional().default(false),
  avatarConfig: AvatarConfigSchema.optional(),
  avatarPreset: AvatarPresetSchema.nullable().optional(),
}).strict();
export const syncRequestSchema = z.object({ version: z.number().int().nonnegative() }).strict();

const actionBase = z.object({ actionId: z.string().min(8).max(100), roundId: z.string().min(1).max(100), expectedPhase: RoomPhaseSchema }).strict();
export const PlayerActionSchema = z.discriminatedUnion("type", [
  actionBase.extend({ type: z.literal("CHOOSE_SKETCH_CURSE"), payload: ChooseSketchCurseSchema }),
  actionBase.extend({ type: z.literal("PREPARE_SKETCH_FINAL"), payload: PrepareSketchFinalSchema }),
  actionBase.extend({ type: z.literal("SUBMIT_SKETCH_PROMPT"), payload: SubmitShowdownPromptSchema }),
  actionBase.extend({ type: z.literal("RANK_SKETCH_PROMPTS"), payload: RankShowdownSchema }),
  actionBase.extend({ type: z.literal("RANK_SKETCH_LAUGHTER"), payload: RankShowdownSchema }),
  actionBase.extend({ type: z.literal("GUESS_SKETCH_ARTISTS"), payload: GuessShowdownSchema }),
  actionBase.extend({ type: z.literal("SKETCH_REVEAL_EMOTE"), payload: ShowdownEmoteSchema }),
  actionBase.extend({ type: z.literal("SELECT_SKETCH_PROMPT"), payload: SelectSketchPromptSchema }),
  actionBase.extend({ type: z.literal("SUBMIT_SKETCH_CAPTION"), payload: SubmitSketchCaptionSchema }),
  actionBase.extend({ type: z.literal("SUBMIT_SKETCH_APPLAUSE"), payload: SubmitSketchApplauseSchema }),
  actionBase.extend({ type: z.literal("UPDATE_AVATAR"), payload: z.object({ avatarConfig: AvatarConfigSchema, avatarPreset: AvatarPresetSchema.nullable() }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_ANSWER"), payload: z.object({ answer: z.string().max(500), sourceLoreIds: z.array(z.string()).max(2).optional() }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_KING_REQUEST_VOTE"), payload: z.object({ choiceId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_VOTE"), payload: z.object({ answerIds: z.array(z.string()).min(1).max(3).refine((ids) => new Set(ids).size === ids.length, "Votes must be distinct") }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_FEEDBACK_VOTE"), payload: z.object({ pairId: z.string().min(1).max(100), choiceId: z.union([z.literal("a"), z.literal("b")]) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_PERSONAL_CHOICE"), payload: z.object({ choiceId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_PREDICTION"), payload: z.object({ values: z.array(z.number().int().min(0).max(100)).min(2).max(10) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_AUTHOR_GUESSES"), payload: z.object({ guesses: z.record(z.string(), z.string()) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_KING_DECOY"), payload: z.object({ decoy: z.string().trim().min(1).max(180), useRoyalSeal: z.boolean().optional() }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_KING_MYSTERY_VOTE"), payload: z.object({ choiceId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_ROYAL_RUMOUR_GUESS"), payload: z.object({ guess: z.string().trim().min(1).max(180) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_WAR_RANKING"), payload: z.object({ orderedChoiceIds: z.array(z.string().min(1).max(100)).length(6).refine((ids) => new Set(ids).size === ids.length, "Ranking choices must be distinct") }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_WAR_GUESS"), payload: z.object({ choiceId: z.string().min(1).max(100), rank: z.number().int().min(1).max(6) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_WAR_SCOUT"), payload: z.object({ choiceId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_FOOL_SCROLLS"), payload: z.object({ scrolls: z.array(z.string().trim().min(1).max(80)).min(1).max(5) }).strict() }),
  actionBase.extend({ type: z.literal("SET_FOOL_READY"), payload: z.object({ ready: z.boolean() }).strict() }),
  actionBase.extend({ type: z.literal("FOOL_CORRECT"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("FOOL_PASS"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_FOOL_ONE_WORD"), payload: z.object({ word: z.string().trim().min(1).max(30) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_FOOL_CLUE"), payload: z.object({ clue: z.string().trim().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_FOOL_PERFORMANCE_CUE"), payload: z.object({ cue: z.string().trim().min(1).max(120) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_FOOL_STROKE"), payload: z.object({ points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()).min(2).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_WAGER"), payload: z.object({ targetPlayerId: z.string().min(1), wager: z.union([z.literal(100), z.literal(250), z.literal(500)]) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_BOWL_SCROLLS"), payload: z.object({ scrolls: z.array(z.string().trim().min(1).max(80)).min(1).max(5) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_SCHAETZORAMA_ESTIMATE"), payload: z.object({ estimate: z.number().int().safe(), round: z.number().int().min(1).max(5), matchId: z.string().min(1).max(120) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_IMPOSTER_CLUE"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1), clue: z.string().trim().min(1).max(80) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_IMPOSTER_VOTE"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1), targetPlayerId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_BUZZWORT_CLUE"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1), attempt: z.number().int().min(1).max(200), text: z.string().trim().min(1).max(120) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_BUZZWORT_GUESS"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1), attempt: z.number().int().min(1).max(200), guess: z.string().trim().min(1).max(120) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_PANTOMIME_GUESS"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1), attempt: z.number().int().min(1).max(5), guess: z.string().trim().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_PANTOMIME_PERFORMANCE"), payload: z.object({ matchId: z.string().min(1).max(120), cue: z.string().trim().min(1).max(120) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_DRAW_GUESS_DRAWING"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1), drawing: z.array(z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), width: z.number().int().min(1).max(20), points: z.array(z.object({ x: z.number().int().min(0).max(1000), y: z.number().int().min(0).max(1000) }).strict()).min(1).max(300) }).strict()).min(1).max(80).superRefine((strokes, context) => { if (strokes.reduce((count, stroke) => count + stroke.points.length, 0) > 3000) context.addIssue({ code: "custom", message: "Drawings are limited to 3000 points." }); }) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_DRAW_GUESS"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1), attempt: z.number().int().min(1).max(5), guess: z.string().trim().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_ARENA_SURVIVOR_CHOICE"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1), choiceId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_CHAOS_TOOL"), payload: z.object({ matchId: z.string().min(1).max(120), missionNumber: z.number().int().min(1).max(4), toolId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_MAGIC_ARENA_ACTION"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(5), action: z.enum(["strike", "guard", "focus"]) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_MAGIC_DUELL_LOADOUT"), payload: z.object({ matchId: z.string().min(1).max(120), spellIds: z.array(z.string().min(1).max(80)).length(3) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_MAGIC_DUELL_CAST"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(5), spellId: z.string().min(1).max(80), stroke: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()).min(5).max(32) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_MINIONS_TD_ORDER"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(6), order: z.discriminatedUnion("type", [z.object({ type: z.literal("deploy"), unitId: z.enum(["runner", "brute", "siege"]) }).strict(), z.object({ type: z.enum(["upgrade", "brace", "hold"]) }).strict()]) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_KARTENTISCH_CARD"), payload: z.object({ matchId: z.string().min(1).max(120), trick: z.number().int().min(1).max(5), cardId: z.string().regex(/^(?:[2-9]|1[0-4])[CDHS]$/) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_DUNGEON_PARTY_ACTION"), payload: z.object({ matchId: z.string().min(1).max(120), encounter: z.number().int().min(1).max(3), actionId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_FLATTERFLUFF_SHOT"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(5), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_DRIFT_RACER_INPUT"), payload: z.object({ matchId: z.string().min(1).max(120), turn: z.number().int().min(1).max(8), throttle: z.enum(["accelerate", "coast", "brake"]), steer: z.number().int().min(-1).max(1), drift: z.boolean(), boost: z.boolean() }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_WORD_TILES_WORD"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(5), word: z.string().trim().max(7).regex(/^[A-Za-z]{3,7}$/).nullable() }).strict() }),
  actionBase.extend({ type: z.literal("SUBMIT_SCHATTENJAGD_VOTE"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(4), suspectId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("BOWL_CORRECT"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("BOWL_PASS"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("BOWL_ONE_WORD"), payload: z.object({ word: z.string().trim().min(1).max(30).regex(/^\S+$/u) }).strict() }),
  actionBase.extend({ type: z.literal("BOWL_DRAWING_STROKES"), payload: z.object({ strokes: z.array(z.object({ id: z.string().min(1).max(80), color: z.enum(["ink", "red", "blue", "gold"]), width: z.number().min(.002).max(.04), points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()).min(2).max(160) }).strict()).min(1).max(12) }).strict() }),
  actionBase.extend({ type: z.literal("HEARTBEAT"), payload: z.object({}).strict() }),
]);
export const HostActionSchema = z.discriminatedUnion("type", [
  actionBase.extend({ type: z.literal("ADVANCE_SKETCH_RELAY"), payload: AdvanceSketchRelaySchema }),
  actionBase.extend({ type: z.literal("START_FISH_TEST"), payload: z.object({ mode: z.enum(["shark", "peaceful"]).optional(), drawingSeconds: FishDrawingSecondsSchema.optional() }).strict() }),
  actionBase.extend({ type: z.literal("START_GAME"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_ARCADE"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(5), transition: z.enum(["reveal", "advance"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_PANTOMIME"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_DRAW_GUESS"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_ARENA_SURVIVOR"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.literal(1) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_CHAOS_KOMMANDO"), payload: z.object({ matchId: z.string().min(1).max(120), missionNumber: z.number().int().min(1).max(4), transition: z.enum(["reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_MAGIC_ARENA"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(5), transition: z.enum(["reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_MAGIC_DUELL"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(0).max(5), transition: z.enum(["begin", "reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_MINIONS_TD"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(6), transition: z.enum(["reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_KARTENTISCH"), payload: z.object({ matchId: z.string().min(1).max(120), trick: z.number().int().min(1).max(5), transition: z.enum(["reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_DUNGEON_PARTY"), payload: z.object({ matchId: z.string().min(1).max(120), encounter: z.number().int().min(1).max(3), transition: z.enum(["reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_FLATTERFLUFF"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(5), transition: z.enum(["reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_DRIFT_RACER"), payload: z.object({ matchId: z.string().min(1).max(120), turn: z.number().int().min(1).max(8) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_WORD_TILES"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(5), transition: z.enum(["reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADVANCE_SCHATTENJAGD"), payload: z.object({ matchId: z.string().min(1).max(120), round: z.number().int().min(1).max(4), transition: z.enum(["reveal", "next"]) }).strict() }),
  actionBase.extend({ type: z.literal("ADD_BOT"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("SET_BOT_SEAT"), payload: z.object({ seat: z.number().int().min(1).max(10), enabled: z.boolean() }).strict() }),
  actionBase.extend({ type: z.literal("PAUSE"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("RESUME"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("ADD_TIME"), payload: z.object({ seconds: z.union([z.literal(15), z.literal(60)]).default(15) }).strict() }),
  actionBase.extend({ type: z.literal("SKIP"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("HIDE_ANSWER"), payload: z.object({ answerId: z.string().min(1) }).strict() }),
  actionBase.extend({ type: z.literal("REMOVE_PLAYER"), payload: z.object({ playerId: z.string().min(1) }).strict() }),
  actionBase.extend({ type: z.literal("LOCK_JOINING"), payload: z.object({ locked: z.boolean() }).strict() }),
  actionBase.extend({ type: z.literal("END_GAME"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("PLAY_AGAIN"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("START_ENCORE"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("SET_BIRTHDAY_PERSON"), payload: z.object({ playerId: z.string().min(1).max(100) }).strict() }),
  actionBase.extend({ type: z.literal("SET_FOOL_TEAM"), payload: z.object({ playerId: z.string().min(1), team: z.enum(["BELLS", "MOTLEY"]) }).strict() }),
  actionBase.extend({ type: z.literal("SHUFFLE_FOOL_TEAMS"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("ADJUST_FOOL_SCORE"), payload: z.object({ team: z.enum(["BELLS", "MOTLEY"]), delta: z.union([z.literal(-1), z.literal(1)]) }).strict() }),
  actionBase.extend({ type: z.literal("UNDO_FOOL_POINT"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("JUDGE_BOT_FOOL"), payload: z.discriminatedUnion("decision", [
    z.object({ decision: z.literal("correct"), guess: z.string().trim().min(1).max(100) }).strict(),
    z.object({ decision: z.literal("pass") }).strict(),
  ]) }),
  actionBase.extend({ type: z.literal("SET_BOWL_TEAM"), payload: z.object({ playerId: z.string().min(1).max(100), team: z.enum(["bells", "motley"]) }).strict() }),
  actionBase.extend({ type: z.literal("UNDO_BOWL_CORRECT"), payload: z.object({}).strict() }),
  actionBase.extend({ type: z.literal("SET_CONFIG"), payload: z.object({ gameLength: GameLengthSchema.optional(), contentMode: ContentModeSchema.optional(), timerAccessibility: z.boolean().optional(), sorceryLength: z.enum(["quick", "long"]).optional(), soloLiveImages: z.boolean().optional(), imageModel: ImageModelSchema.optional(), playEnvironment: z.enum(["same_table", "remote_live"]).optional(), bowlRoundTwo: z.enum(["drawing", "charades"]).optional(), scrollsPerPlayer: z.number().int().min(1).max(5).optional(), builtInVoice: z.boolean().optional(), openingTutorial: z.boolean().optional() }).strict() }),
  actionBase.extend({ type: z.literal("SET_DEVELOPER_ROUND"), payload: z.object({
    prompt: z.string().trim().min(1).max(500).optional(),
    instruction: z.string().trim().max(240).nullable().optional(),
    choiceLabels: z.array(z.string().trim().min(1).max(80)).min(2).max(10).optional(),
    scoreCap: z.number().int().min(0).max(10_000).nullable().optional(),
    phaseSeconds: z.number().int().min(1).max(600).optional(),
  }).strict() }),
]);

export type PlayerAction = z.infer<typeof PlayerActionSchema>;
export type HostAction = z.infer<typeof HostActionSchema>;
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export interface PublicPlayer { id: string; nickname: string; role: "player" | "audience"; seat: number; lobbySlot?: number; avatar: number; avatarConfig?: AvatarConfig; avatarPreset?: string | null; color: string; connected: boolean; active: boolean; pendingActivation: boolean; bot?: boolean; birthdayVip?: boolean; score?: number }
export interface DeveloperRoundContext { promptId: string; roundLabel: string; choiceOptions: Array<{ id: string; label: string }>; scoreCap: number | null; phaseSeconds: number | null }
export interface SnapshotImage { status: JobStatus; assetId?: string; conceptTitle?: string; conceptCaption?: string }
export interface SnapshotImageGenerationNotice { kind: "RETRYING" | "FAILED"; failedModel: ImageModel; nextModel?: ImageModel; reason?: "ALLOWANCE_STOP"; updatedAt: number }
export interface SnapshotAnswer { id: string; text: string; image?: SnapshotImage; voteEligible?: boolean }
export interface SnapshotComicFrame { frameNumber: 1 | 2 | 3; prompt: string; authorId: string; image: SnapshotImage }
export interface BowlStroke { id: string; color: "ink" | "red" | "blue" | "gold"; width: number; points: Array<{ x: number; y: number }> }
export interface BowlSnapshot { environment: BowlEnvironment; roundTwo: BowlRoundTwo; scrollsPerPlayer: number; builtInVoice: boolean; openingTutorial: boolean; teams: Record<string, BowlTeam>; scores: Record<BowlTeam, number>; activeTeam: BowlTeam | null; clueGiverId: string | null; remainingScrolls: number; totalScrolls: number; passAvailable: boolean; roundNumber: number; roundLabel: string; drawing: BowlStroke[]; clueWord: string | null; submittedPlayerIds: string[]; suddenDeath: boolean; suddenDeathOccurred: boolean; winnerTeam: BowlTeam | null; lastCorrectUndoAvailable: boolean; activeScroll?: string }
export interface SnapshotRestoration { base: string; slots: Array<{ id: string; label: string; x: number; y: number; width: number; height: number; clipPath: string; objectPosition: string; rotate: number; answerId?: string; playerId?: string; prompt?: string; image?: SnapshotImage }>; winningAnswerIds: string[] }
export interface SnapshotKingMystery { turnNumber: number; totalTurns: number; turnId: string; featuredImage: SnapshotImage; options: Array<{ id: string; text: string }>; decoyCount: number; eligibleDecoyCount: number; result: null | { realChoiceId: string; originalRequest: string; originalAuthorId: string; votes: Record<string, string>; choiceAuthors: Record<string, string | null>; correctPlayerIds: string[]; fooledByChoice: Record<string, string[]>; sealedChoiceIds: string[] } }
export interface SnapshotRoyalRumourChain { sourceAnswerId: string; originalText: string; originalAuthorId: string; firstImage: SnapshotImage; guessId: string; guessText: string; guessAuthorId: string; secondImage: SnapshotImage; votes: number; winner: boolean }
export interface SnapshotRoyalRumours { revealIndex: number; totalChains: number; chains: SnapshotRoyalRumourChain[] }
export interface SnapshotSchaetzorama { matchId: string; round: number; roundCount: number; phase: "estimating" | "revealing" | "completed"; question: string; unit: string; min: number; max: number; deadline: number; version: number; submitted: boolean; estimate?: number; answer?: number; estimates: Array<{ playerId: string; estimate: number }>; winners: string[]; scores: Record<string, number> }
export interface SnapshotImposter { matchId: string; round: number; phase: "cluing" | "voting" | "revealed"; players: string[]; deadline: number; version: number; clueCount: number; voteCount: number; submitted: boolean; ownClue?: string; assignment?: { role: "civilian" | "imposter"; category: string; word?: string }; clues: Array<{ playerId: string; clue: string }>; result?: { matchId: string; round: number; category: string; word: string; imposterId: string; winner: "civilians" | "imposter"; accusedPlayerIds: string[]; voteCounts: Record<string, number>; clues: Array<{ playerId: string; clue: string }>; roles: Array<{ playerId: string; role: "civilian" | "imposter" }> } }
export interface SnapshotBuzzwort { matchId: string; round: number; phase: "clue" | "guess" | "revealed"; attempt: number; players: string[]; activeTeam: "ember" | "cobalt"; watcherTeam: "ember" | "cobalt"; clueGiverId: string; guesserId: string; deadline: number; version: number; clueCount: number; submitted: boolean; currentClue?: string; clues: Array<{ playerId: string; attempt: number; text: string }>; assignment?: { role: "clue_giver" | "guesser" | "teammate" | "watcher"; team: "ember" | "cobalt"; card?: { word: string; tabooWords: string[] } }; result?: { matchId: string; round: number; outcome: "guessed" | "taboo" | "timeout"; winnerTeam: "ember" | "cobalt"; activeTeam: "ember" | "cobalt"; watcherTeam: "ember" | "cobalt"; card: { id: string; word: string; tabooWords: string[] }; scores: Record<"ember" | "cobalt", number>; teams: Record<string, "ember" | "cobalt">; roles: Record<string, "clue_giver" | "guesser" | "teammate" | "watcher">; clues: Array<{ playerId: string; attempt: number; text: string }>; guesses: Array<{ playerId: string; attempt: number; text: string; correct: boolean }> } }
export interface SnapshotBase { sorceryLength?: "quick" | "long"; fishGame?: FishFinaleSnapshot | null; sketchRelay?: SnapshotSketchRelay | null; imposter?: SnapshotImposter | null }
export interface SnapshotBase { sorceryLength?: "quick" | "long"; buzzwort?: SnapshotBuzzwort | null }
export interface SnapshotPantomime { matchId: string; round: 1; phase: "acting" | "revealed"; players: string[]; performerId: string; deadline: number; version: number; attempt: number; guessCount: number; submitted: boolean; performanceCue?: string; ownGuesses?: string[]; assignment?: { role: "performer" | "guesser"; prompt?: string }; result?: { matchId: string; round: 1; outcome: "guessed" | "timeout" | "host_reveal"; prompt: string; performerId: string; winnerId: string | null; scores: Record<string, number>; guesses: Array<{ playerId: string; text: string; correct: boolean }> } }
export interface SnapshotDrawGuessStroke { color: string; width: number; points: Array<{ x: number; y: number }> }
export interface SnapshotDrawGuess { matchId: string; round: 1; phase: "drawing" | "guessing" | "revealed"; players: string[]; artistId: string; deadline: number; version: number; submitted: boolean; attempt: number; guessCount: number; ownGuesses?: string[]; assignment?: { role: "artist" | "guesser"; prompt?: string }; drawing?: SnapshotDrawGuessStroke[]; result?: { matchId: string; round: 1; outcome: "guessed" | "timeout" | "host_reveal"; artistId: string; prompt: string; drawing?: SnapshotDrawGuessStroke[]; winnerId: string | null; scores: Record<string, number>; guesses: Array<{ playerId: string; attempt: number; text: string; correct: boolean }> } }
export interface SnapshotArenaSurvivor { matchId: string; round: 1; phase: "answering" | "revealed"; players: string[]; scenario: { id: string; title: string; description: string; choices: Array<{ id: string; text: string }> }; deadline: number; version: number; submitted: boolean; answerCount: number; ownChoiceId?: string; assignment?: { role: "survivor" }; result?: { matchId: string; round: 1; outcome: "revealed" | "timeout"; scenario: { id: string; title: string; description: string; choices: Array<{ id: string; text: string }> }; correctChoiceId: string; explanation: string; submissions: Array<{ playerId: string; choiceId: string | null; survived: boolean }>; choiceCounts: Record<string, number>; winners: string[]; scores: Record<string, number> } }
export interface SnapshotChaosKommando { matchId: string; missionNumber: number; missionCount: 4; phase: "choosing" | "revealed"; players: string[]; mission: { id: string; title: string; briefing: string; requiredTags: string[]; tools: Array<{ id: string; label: string }> }; deadline: number; version: number; submissionCount: number; submitted: boolean; ownToolId?: string; missionResults: Array<{ missionNumber: number; missionId: string; outcome: "contained" | "uncontained" | "timeout"; coveredTags: string[]; missingTags: string[]; submissions: Array<{ playerId: string; toolId: string | null }>; score: number }>; submissions?: Array<{ playerId: string; toolId: string | null }>; result?: { matchId: string; missions: Array<{ missionNumber: number; missionId: string; outcome: "contained" | "uncontained" | "timeout"; coveredTags: string[]; missingTags: string[]; submissions: Array<{ playerId: string; toolId: string | null }>; score: number }>; score: number; maxScore: number; outcome: "contained" | "critical" } }
export interface SnapshotMagicArena { matchId: string; players: string[]; round: number; roundCount: 5; phase: "choosing" | "revealed" | "complete"; health: Record<string, number>; energy: Record<string, number>; deadline: number; version: number; submissionCount: number; submitted: boolean; ownAction?: "strike" | "guard" | "focus"; roundResults: Array<{ round: number; actions: Record<string, "strike" | "guard" | "focus">; health: Record<string, number>; energy: Record<string, number>; damage: Record<string, number>; outcome: "hit" | "blocked" | "no-damage" | "knockout" | "timeout" }>; result?: { matchId: string; winnerPlayerId: string | null; outcome: "knockout" | "points" | "draw"; health: Record<string, number>; energy: Record<string, number>; roundsPlayed: number } }
export interface SnapshotKartentischCard { id: string; rank: number; suit: "clubs" | "diamonds" | "hearts" | "spades" }
export interface SnapshotKartentisch { matchId: string; players: string[]; trick: number; trickCount: 5; phase: "playing" | "revealed" | "complete"; trumpSuit: "clubs" | "diamonds" | "hearts" | "spades"; leaderPlayerId: string; turnPlayerId: string | null; deadline: number; version: number; scores: Record<string, number>; handCounts: Record<string, number>; playsCount: number; submitted: boolean; leadSuit?: "clubs" | "diamonds" | "hearts" | "spades"; ownHand?: SnapshotKartentischCard[]; trickResult?: { trick: number; leaderPlayerId: string; ledSuit: "clubs" | "diamonds" | "hearts" | "spades"; trumpSuit: "clubs" | "diamonds" | "hearts" | "spades"; plays: Array<{ playerId: string; card: SnapshotKartentischCard }>; winnerPlayerId: string; scores: Record<string, number>; timedOut: boolean }; trickResults: Array<NonNullable<SnapshotKartentisch["trickResult"]>>; result?: { matchId: string; scores: Record<string, number>; winners: string[]; tricksPlayed: number; hands: Record<string, SnapshotKartentischCard[]> } }
export interface SnapshotDungeonParty { matchId: string; players: string[]; encounter: number; encounterCount: 3; phase: "choosing" | "revealed" | "complete"; definition: { id: string; title: string; briefing: string; target: number; threat: number; fallbackActionId: string; actions: Array<{ id: string; label: string; progress: number; guard: number; healing: number }> }; health: number; score: number; deadline: number; version: number; submissionCount: number; submitted: boolean; ownActionId?: string; encounterResults: Array<{ encounter: number; encounterId: string; success: boolean; timedOut: boolean; progress: number; target: number; guard: number; healing: number; damage: number; health: number; scoreEarned: number; actions: Array<{ playerId: string; actionId: string; timedOut: boolean }> }>; encounterResult?: SnapshotDungeonParty["encounterResults"][number]; result?: { matchId: string; outcome: "escaped" | "survived" | "fallen"; health: number; score: number; maxScore: number; completedEncounters: number; successfulEncounters: number } }
export interface SnapshotFlatterfluff { matchId: string; round: number; roundTotal: 5; phase: "aiming" | "revealed" | "complete"; players: string[]; targets: Array<{ id: string; x: number; y: number; radius: number; points: number }>; deadline: number; version: number; submitted: boolean; submittedCount: number; ownShot?: { x: number; y: number }; result?: { round: number; outcome: "revealed" | "timeout"; targets: Array<{ id: string; x: number; y: number; radius: number; points: number }>; shots: Array<{ playerId: string; x: number; y: number; hitTargetId: string | null; points: number; timedOut: boolean }>; scores: Record<string, number>; winners: string[]; roundResults: Array<{ round: number; outcome: "revealed" | "timeout"; targets: Array<{ id: string; x: number; y: number; radius: number; points: number }>; shots: Array<{ playerId: string; x: number; y: number; hitTargetId: string | null; points: number; timedOut: boolean }>; scores: Record<string, number> }> } }
export interface SnapshotWordTiles { matchId: string; players: string[]; round: number; roundCount: 5; phase: "choosing" | "revealed" | "complete"; letters: string; scores: Record<string, number>; deadline: number; version: number; submissionCount: number; submitted: boolean; ownWord?: string | null; roundResults: Array<{ round: number; letters: string; timedOut: boolean; submissions: Array<{ playerId: string; word: string | null; timedOut: boolean; tileScore: number; bonus: number; scoreEarned: number }>; scores: Record<string, number>; leaders: string[] }>; roundResult?: SnapshotWordTiles["roundResults"][number]; result?: { matchId: string; scores: Record<string, number>; winners: string[]; roundsPlayed: number; rounds: SnapshotWordTiles["roundResults"] } }
export interface SnapshotSchattenjagd { matchId: string; players: string[]; round: number; roundCount: 4; phase: "choosing" | "revealed" | "complete"; caseId: string; title: string; briefing: string; suspects: Array<{ id: string; name: string; trace: string; route: string }>; clues?: Array<{ id: string; text: string; field: "trace" | "route"; value: string }>; ownClue?: { id: string; text: string; field: "trace" | "route"; value: string }; targetId?: string; ownSuspectId?: string; scores: Record<string, number>; deadline: number; version: number; submissionCount: number; submitted: boolean; caseResults: Array<{ round: number; caseId: string; targetId: string; timedOut: boolean; correctCount: number; teamBonusApplied: boolean; votes: Array<{ playerId: string; suspectId: string | null; timedOut: boolean; correct: boolean; points: number }>; scores: Record<string, number> }>; caseResult?: SnapshotSchattenjagd["caseResults"][number]; result?: { matchId: string; scores: Record<string, number>; winners: string[]; casesPlayed: number; cases: SnapshotSchattenjagd["caseResults"] } }
export interface SnapshotMinionsTd { matchId: string; players: string[]; round: number; roundCount: 6; phase: "choosing" | "revealed" | "complete"; health: Record<string, number>; gold: Record<string, number>; towerLevels: Record<string, number>; waves: Record<string, Array<{ id: string; unitId: string; health: number; position: number; speed: number; damage: number }>>; towerHits: Record<string, number>; units: Array<{ id: string; name: string; cost: number; health: number; speed: number; damage: number; description: string }>; deadline: number; version: number; submissionCount: number; submitted: boolean; ownOrder?: { type: "deploy"; unitId: string } | { type: "upgrade" | "brace" | "hold" }; roundResults: Array<{ round: number; choices: Record<string, { order: { type: "deploy"; unitId: string } | { type: "upgrade" | "brace" | "hold" }; timedOut: boolean }>; towerHits: Record<string, number>; baseDamage: Record<string, number>; health: Record<string, number>; gold: Record<string, number>; towerLevels: Record<string, number>; waves: Record<string, Array<{ id: string; unitId: string; health: number; position: number; speed: number; damage: number }>>; timedOut: boolean }>; roundResult?: SnapshotMinionsTd["roundResults"][number]; result?: { matchId: string; winnerPlayerId: string | null; outcome: "knockout" | "points" | "draw"; health: Record<string, number>; gold: Record<string, number>; roundsPlayed: number } }
export interface SnapshotMagicDuell { matchId: string; players: string[]; phase: "drafting" | "casting" | "revealed" | "complete"; round: number; roundCount: 5; spells: Array<{ id: string; name: string; description: string; kind: "attack" | "guard" | "focus"; glyph: "bolt" | "shield" | "loop"; cost: number; strength: number }>; health: Record<string, number>; mana: Record<string, number>; deadline: number; version: number; draftSubmissionCount: number; submissionCount: number; submitted: boolean; draftSubmitted: boolean; ownLoadout?: string[]; ownSpellId?: string; roundResults: Array<{ round: number; casts: Record<string, { spellId: string; gesture: "bolt" | "shield" | "loop"; timedOut: boolean }>; health: Record<string, number>; mana: Record<string, number>; damage: Record<string, number>; timedOut: boolean }>; result?: { matchId: string; winnerPlayerId: string | null; outcome: "knockout" | "points" | "draw"; health: Record<string, number>; mana: Record<string, number>; roundsPlayed: number } }
export interface SnapshotDriftRacer { matchId: string; players: string[]; turn: number; phase: "racing" | "results"; drivers: Record<string, { distance: number; speed: number; lane: 0 | 1 | 2; boosts: number; cornerRewards: number }>; deadline: number; version: number; submitted: boolean; inputCount: number; ownInput?: { throttle: "accelerate" | "coast" | "brake"; steer: -1 | 0 | 1; drift: boolean; boost: boolean }; result?: { matchId: string; winnerPlayerId: string | null; outcome: "finish" | "time_limit" | "tie" | "practice"; standings: Array<{ playerId: string; place: number; distance: number; speed: number; cornerRewards: number }> } }
export interface SnapshotBase { sorceryLength?: "quick" | "long"; pantomime?: SnapshotPantomime | null; drawGuess?: SnapshotDrawGuess | null; arenaSurvivor?: SnapshotArenaSurvivor | null; chaosKommando?: SnapshotChaosKommando | null; magicArena?: SnapshotMagicArena | null; magicDuell?: SnapshotMagicDuell | null; minionsTd?: SnapshotMinionsTd | null; kartentisch?: SnapshotKartentisch | null; dungeonParty?: SnapshotDungeonParty | null; flatterfluff?: SnapshotFlatterfluff | null; driftRacer?: SnapshotDriftRacer | null; wordTiles?: SnapshotWordTiles | null; schattenjagd?: SnapshotSchattenjagd | null }
export type WarTeam = "LION" | "RAVEN";
export interface SnapshotWarRoom { campaign: "ATTACK" | "DEFEND"; teams: Record<string, WarTeam>; teamScores: Record<WarTeam, number>; scoutUsed: Record<WarTeam, boolean>; choices: Array<{ id: string; label: string }>; activeTeam: WarTeam | null; commanderId: string | null; targetRanks: number[]; placements: Record<string, number>; clues: Array<{ choiceId: string; guessedRank: number; direction: "EARLIER" | "LATER"; team: WarTeam; scout?: boolean }>; lastMove: null | { playerId: string; team: WarTeam; choiceId: string | null; guessedRank: number | null; correct: boolean; actualRank?: number; skipped?: boolean }; trueOrder: string[] | null; turnNumber: number; maxTurns: number }
export interface SnapshotBase { sorceryLength?: "quick" | "long"; arcade?: { gameId: z.infer<typeof ArcadeGameIdSchema>; matchId: string; startedAt: number; endedAt: number | null; result: unknown } | null; arcadeControllerIds?: string[]; schaetzorama?: SnapshotSchaetzorama | null; kartentisch?: SnapshotKartentisch | null; foolBowl?: SnapshotFoolBowl | null; role: Role; code: string; version: number; stateVersion: number; serverTime: number; phase: RoomPhase; deadlineAt: number | null; paused: boolean; joiningLocked: boolean; soloMode: boolean; soloLiveImages: boolean; imageModel: ImageModel; imageGenerationNotice: SnapshotImageGenerationNotice | null; developerMode: boolean; imageJobsPending: boolean; sketchImageJobs?: string[]; comicTheme: string | null; comicFrames: SnapshotComicFrame[]; restoration: SnapshotRestoration | null; mystery: SnapshotKingMystery | null; rumours: SnapshotRoyalRumours | null; warRoom: SnapshotWarRoom | null; bowl: BowlSnapshot | null; roundId: string; roundKind: RoundKind | null; roundNumber: number; roundTotal: number; players: PublicPlayer[]; audienceCount: number }
export interface HostSnapshot extends SnapshotBase { role: "host"; gameLength: GameLength; arcadeGameId?: z.infer<typeof ArcadeGameIdSchema> | null; botSeats: number[]; contentMode: ContentMode; timerAccessibility: boolean; birthdayName: string | null; birthdayPersonId: string | null; prompt: string | null; instruction: string | null; memoryTrail: Array<{ id: string; kind: MemoryKind; text: string }>; answers: Array<SnapshotAnswer & { authorId?: string; hidden: boolean; applause: number; audienceFavorites: number }>; submittedPlayerIds: string[]; respondedVoterIds: string[]; results: unknown; image: SnapshotImage | null }
export interface DisplaySnapshot extends Omit<HostSnapshot, "role"> { role: "display" }
export interface SnapshotFoolBowl { playMode: FoolPlayMode; performance: FoolPerformance; voiceEnabled: boolean; scrollsPerPlayer: number; teams: Record<string, FoolTeam>; readyPlayerIds: string[]; turnOrder: Record<FoolTeam, string[]>; teamScores: Record<FoolTeam, number>; submittedPlayerIds: string[]; gameRound: 1 | 2 | 3; activeTeam: FoolTeam | null; clueGiverId: string | null; poolRemaining: number; totalScrolls: number; passUsed: boolean; oneWord: string | null; spokenClue: string | null; performanceCue: string | null; strokes: Array<{ id: string; points: Array<{ x: number; y: number }> }>; lastResult: null | { team: FoolTeam; correct: boolean }; suddenDeath: boolean; winner: FoolTeam | null; secretScroll?: string }
export interface PlayerSnapshot extends SnapshotBase { role: "player"; selfId: string; isHostPlayer: boolean; botSeats?: number[]; gameLength: GameLength; arcadeGameId?: z.infer<typeof ArcadeGameIdSchema> | null; contentMode: ContentMode; timerAccessibility: boolean; birthdayName: string | null; prompt: string | null; instruction: string | null; developerContext: DeveloperRoundContext | null; submitted: boolean; locked: boolean; answerOrder: SnapshotAnswer[]; revealAnswers: Array<SnapshotAnswer & { authorId: string; applause: number }>; choices: Array<{ id: string; label: string }>; ownAnswer: string | null; wager: { targetPlayerId: string; wager: 100 | 250 | 500 } | null; feedback: { pair: { id: string; question: string; options: Array<{ id: "a" | "b"; text: string }> } | null; nextAvailableAt: number; rewardPoints: number; completedCount: number; totalCount: number }; taskData: unknown; results: unknown; image: SnapshotImage | null }
export interface AudienceSnapshot extends SnapshotBase { role: "audience"; selfId: string; prompt: string | null; instruction: string | null; submitted: boolean; answerOrder: SnapshotAnswer[]; taskData: unknown; results: unknown; image: SnapshotImage | null }
export type RoleSnapshot = HostSnapshot | DisplaySnapshot | PlayerSnapshot | AudienceSnapshot;

export const apiError = (code: string, message: string, status = 400, detail?: unknown) => Response.json({ error: { code, message, detail } }, { status });
