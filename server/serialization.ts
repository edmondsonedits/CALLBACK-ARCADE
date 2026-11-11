import { SketchRelayMatchSchema, isValidSketchRelayMatch } from "./arcade/sketch_relay";
import { z } from "zod";
import { ArcadeGameIdSchema } from "../lib/arcade/contracts";
import {
  AvatarConfigSchema,
  ContentModeSchema,
  GameLengthSchema,
  ImageModelSchema,
  JobStatusSchema,
  MemoryKindSchema,
  MemoryRelationSchema,
  RoomPhaseSchema,
  RoundKindSchema,
} from "../lib/contracts";
import type { RoomState } from "./types";
import { hydrateLobbySlots } from "./participant-seats";
import { isValidWordTilesMatch, WORD_TILES_DICTIONARY } from "./arcade/word_tiles";
import { isValidSchattenjagdMatch } from "./arcade/schattenjagd";
import { isValidMagicArenaMatch } from "./arcade/magic_arena";
import { isValidMagicDuellMatch } from "./arcade/magic_duell";
import { isValidMinionsTdMatch } from "./arcade/minions_td";
import { isValidFlatterfluffMatch } from "./arcade/flatterfluff";
import { isValidDriftRacerMatch } from "./arcade/drift_racer";
import { FishFinaleStateSchema } from "../lib/arcade/fish-finale";
import { isValidFishFinale } from "./arcade/fish_finale";

export const ROOM_STATE_SERIALIZATION_VERSION = 1 as const;

const CatchRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("exact_words"), value: z.number() }).strict(),
  z.object({ type: z.literal("max_words"), value: z.number() }).strict(),
  z.object({ type: z.literal("ending"), value: z.union([z.literal("?"), z.literal("!")]) }).strict(),
  z.object({ type: z.literal("required_word"), value: z.string() }).strict(),
  z.object({ type: z.literal("required_name") }).strict(),
  z.object({ type: z.literal("starting_letter"), value: z.string() }).strict(),
  z.object({ type: z.literal("forbidden_letter"), value: z.string() }).strict(),
]);

const CatchModifierSchema = z.object({
  id: z.string(), label: z.string(), instruction: z.string(), rule: CatchRuleSchema, validateMechanically: z.literal(true),
}).strict();

const ParticipantSchema = z.object({
  id: z.string(), nickname: z.string(), nicknameNormalized: z.string(), role: z.union([z.literal("player"), z.literal("audience")]),
  seat: z.number().int().positive(), lobbySlot: z.number().int().min(1).max(10).optional(), avatar: z.number().int().nonnegative(), avatarConfig: AvatarConfigSchema.optional(), avatarPreset: z.string().nullable().optional(),
  color: z.string(), active: z.boolean(), pendingActivation: z.boolean(), bot: z.boolean().default(false), lastSeenAt: z.number(), removedAt: z.number().nullable(),
}).strict();

const AnswerSchema = z.object({
  id: z.string(), playerId: z.string(), text: z.string(), hidden: z.boolean(), submittedAt: z.number(),
  sourceLoreIds: z.array(z.string()).optional(), sourceAnswerId: z.string().optional(),
}).strict();

const VoteSchema = z.object({ voterId: z.string(), answerIds: z.array(z.string()), audience: z.boolean() }).strict();
const FeedbackVoteSchema = z.object({ playerId: z.string(), pairId: z.string(), choiceId: z.union([z.literal("a"), z.literal("b")]), votedAt: z.number(), matchNumber: z.number().int().positive().default(1) }).strict();
const ScoreEventSchema = z.object({ id: z.string(), eventKey: z.string(), roundId: z.string(), playerId: z.string(), kind: z.string(), points: z.number(), detail: z.record(z.string(), z.unknown()) }).strict();
const ImageSchema = z.object({ jobId: z.string().optional(), status: JobStatusSchema, assetId: z.string().optional(), conceptTitle: z.string(), conceptCaption: z.string() }).strict();
const LoreSchema = z.object({
  id: z.string(), sourceAnswerId: z.string(), sourceAuthorId: z.string(), text: z.string(), shortMeaning: z.string(), kind: MemoryKindSchema,
  originalPrompt: z.string(), winner: z.literal(true), quality: z.number(), callbackPotential: z.number(), visualStrength: z.number(),
  canSpeak: z.boolean(), tags: z.array(z.string()), safe: z.boolean(), used: z.boolean(),
}).strict();
const MemoryEdgeSchema = z.object({ id: z.string(), fromLoreId: z.string(), relation: MemoryRelationSchema, toLoreId: z.string(), roundId: z.string() }).strict();
const CallbackCandidateSchema = z.object({
  id: z.string(), sourceMemoryIds: z.array(z.string()), setup: z.string(), question: z.string(), prompt: z.string(),
  coherence: z.number(), answerability: z.number(), surprise: z.number(), used: z.boolean(), sourceRoundId: z.string().optional(),
  usageCount: z.number().int().nonnegative().default(0), lastUsedRoundIndex: z.number().int().nullable().default(null),
}).strict();
const RemixCandidateSchema = CallbackCandidateSchema.extend({ purpose: z.literal("REMIX") }).strict();

const RoundSchema = z.object({
  id: z.string(), index: z.number().int(), kind: RoundKindSchema, label: z.string(), promptId: z.string(), prompt: z.string(), instruction: z.string().nullable(),
  catchModifier: CatchModifierSchema.nullable(), choiceOptions: z.array(z.object({ id: z.string(), label: z.string() }).strict()).default([]),
  callbackSourceLoreIds: z.array(z.string()), startedAt: z.number(), answers: z.array(AnswerSchema), votes: z.array(VoteSchema),
  personalChoices: z.record(z.string(), z.string()), predictions: z.record(z.string(), z.array(z.number())),
  kingPollEvents: z.array(z.object({ playerId: z.string(), choiceId: z.string(), votedAt: z.number() }).strict()).default([]),
  authorAssignments: z.record(z.string(), z.array(z.string())), authorGuesses: z.record(z.string(), z.record(z.string(), z.string())),
  authorGuessesScored: z.boolean().default(false), authorGuessResults: z.record(z.string(), z.number()).default({}),
  wagers: z.record(z.string(), z.object({ targetPlayerId: z.string(), wager: z.union([z.literal(100), z.literal(250), z.literal(500)]) }).strict()),
  voteStage: z.union([z.literal("PROMPT"), z.literal("IMAGE"), z.literal("FINAL")]).nullable(), scored: z.boolean(),
  results: z.record(z.string(), z.unknown()).nullable(), image: ImageSchema.nullable(), featuredAnswerId: z.string().nullable().default(null),
  developerScoreCap: z.number().nullable().default(null),
  kingMysteryOrder: z.array(z.string()).default([]), kingMysteryIndex: z.number().int().nonnegative().default(0),
  kingMysteryPublicIds: z.record(z.string(), z.object({ turnId: z.string(), choices: z.record(z.string(), z.string()).default({}) }).strict()).default({}),
  kingMysteryDecoys: z.record(z.string(), z.array(z.object({ id: z.string(), playerId: z.string(), text: z.string(), submittedAt: z.number(), sealed: z.boolean().default(false) }).strict())).default({}),
  kingMysterySealUsedByPlayer: z.record(z.string(), z.string()).default({}),
  kingMysteryVotes: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  kingMysteryResults: z.record(z.string(), z.object({
    realChoiceId: z.string(), originalRequest: z.string(), originalAuthorId: z.string(), votes: z.record(z.string(), z.string()),
    choiceAuthors: z.record(z.string(), z.string().nullable()), correctPlayerIds: z.array(z.string()), fooledByChoice: z.record(z.string(), z.array(z.string())), sealedChoiceIds: z.array(z.string()).default([]),
  }).strict()).default({}),
  royalRumourAssignments: z.record(z.string(), z.string()).default({}),
  royalRumourGuesses: z.record(z.string(), z.object({ id: z.string(), playerId: z.string(), sourceAnswerId: z.string(), text: z.string(), submittedAt: z.number() }).strict()).default({}),
  royalRumourRevealOrder: z.array(z.string()).default([]), royalRumourRevealIndex: z.number().int().nonnegative().default(0),
  warRankings: z.record(z.string(), z.array(z.string())).default({}), warTrueOrder: z.array(z.string()).default([]), warTargetRanks: z.array(z.number().int().min(1).max(6)).default([]),
  warPlacements: z.record(z.string(), z.number().int().min(1).max(6)).default({}),
  warClues: z.array(z.object({ choiceId: z.string(), guessedRank: z.number().int().min(1).max(6), direction: z.union([z.literal("EARLIER"), z.literal("LATER")]), team: z.union([z.literal("LION"), z.literal("RAVEN")]), scout: z.boolean().optional() }).strict()).default([]),
  warTurnTeam: z.union([z.literal("LION"), z.literal("RAVEN")]).default("LION"), warTurnNumber: z.number().int().nonnegative().default(0), warMaxTurns: z.number().int().nonnegative().default(0),
  warLastMove: z.object({ playerId: z.string(), team: z.union([z.literal("LION"), z.literal("RAVEN")]), choiceId: z.string().nullable(), guessedRank: z.number().int().min(1).max(6).nullable(), correct: z.boolean(), actualRank: z.number().int().min(1).max(6).optional(), skipped: z.boolean().optional() }).strict().nullable().default(null),
  foolScrolls: z.array(z.object({ id: z.string(), playerId: z.string(), text: z.string(), submittedAt: z.number() }).strict()).default([]),
  foolRoundNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1), foolPool: z.array(z.string()).default([]),
  foolTurnTeam: z.union([z.literal("BELLS"), z.literal("MOTLEY")]).default("BELLS"), foolClueGiverId: z.string().nullable().default(null),
  foolTeamTurns: z.object({ BELLS: z.number().int().nonnegative(), MOTLEY: z.number().int().nonnegative() }).default({ BELLS: 0, MOTLEY: 0 }),
  foolPassUsed: z.boolean().default(false), foolCurrentScrollId: z.string().nullable().default(null), foolOneWord: z.string().nullable().default(null),
  foolSpokenClue: z.string().nullable().default(null), foolPerformanceCue: z.string().nullable().default(null),
  foolBotClueAt: z.number().nullable().default(null),
  foolStrokes: z.array(z.object({ id: z.string(), playerId: z.string(), points: z.array(z.object({ x: z.number(), y: z.number() }).strict()) }).strict()).default([]),
  foolLastResult: z.object({ team: z.union([z.literal("BELLS"), z.literal("MOTLEY")]), correct: z.boolean() }).strict().nullable().default(null),
  foolSuddenDeath: z.boolean().default(false), foolUndo: z.object({ team: z.union([z.literal("BELLS"), z.literal("MOTLEY")]), scrollId: z.string(), roundNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]), previousPhase: RoomPhaseSchema }).strict().nullable().default(null),
}).strict();

const ComicFrameSchema = z.object({
  frameNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]), roundId: z.string(), answerId: z.string(), authorId: z.string(), prompt: z.string(), image: ImageSchema,
}).strict();

const BowlStrokeSchema = z.object({ id: z.string(), color: z.enum(["ink", "red", "blue", "gold"]), width: z.number().min(.002).max(.04), points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()).max(160) }).strict();
const BowlBaseSchema = z.object({
  environment: z.enum(["same_table", "remote_live"]), roundTwo: z.enum(["drawing", "charades"]), scrollsPerPlayer: z.number().int().min(1).max(5), builtInVoice: z.boolean(), openingTutorial: z.boolean(),
  teams: z.record(z.string(), z.enum(["bells", "motley"])), submissions: z.record(z.string(), z.array(z.string())),
  scrolls: z.array(z.object({ id: z.string(), authorId: z.string(), text: z.string() }).strict()), remainingIds: z.array(z.string()), activeScrollId: z.string().nullable(), activeTeam: z.enum(["bells", "motley"]).nullable(), clueGiverId: z.string().nullable(),
  teamOrders: z.object({ bells: z.array(z.string()), motley: z.array(z.string()) }).strict(), clueIndexes: z.object({ bells: z.number().int().nonnegative(), motley: z.number().int().nonnegative() }).strict(),
  passUsed: z.boolean(), scores: z.object({ bells: z.number().int().nonnegative(), motley: z.number().int().nonnegative() }).strict(), roundNumber: z.number().int().min(0).max(4), lastEmptyingTeam: z.enum(["bells", "motley"]).nullable(),
  drawing: z.array(BowlStrokeSchema).max(160), clueWord: z.string().nullable(), suddenDeath: z.boolean(), suddenDeathOccurred: z.boolean(), suddenDeathScrollId: z.string().nullable(), winnerTeam: z.enum(["bells", "motley"]).nullable(),
}).strict();
const BowlSchema = BowlBaseSchema.extend({ undo: z.object({ bowl: BowlBaseSchema, phase: RoomPhaseSchema, status: z.enum(["LOBBY", "ACTIVE", "COMPLETE", "ENDED"]), phaseStartedAt: z.number(), deadlineAt: z.number().nullable(), roundIndex: z.number().int(), currentRound: RoundSchema.nullable(), scoreEventKey: z.string(), scoringPlayerId: z.string() }).strict().nullable() }).strict();
const SchaetzoramaSchema = z.object({
  matchId: z.string().min(1).max(100), players: z.array(z.string().min(1).max(100)).min(2).max(10),
  prompts: z.array(z.object({ id: z.string(), question: z.string(), unit: z.string(), min: z.number().int().safe(), max: z.number().int().safe(), answer: z.number().int().safe(), sourceUrl: z.string().url().optional() }).strict()).length(5),
  rounds: z.array(z.object({ number: z.number().int().min(1).max(5), submissions: z.record(z.string(), z.number().int().safe()), winners: z.array(z.string()), pointsAwarded: z.record(z.string(), z.number().int().safe()) }).strict()).length(5),
  roundCount: z.literal(5), round: z.number().int().min(1).max(5), phase: z.enum(["estimating", "revealing", "completed"]),
  deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), scores: z.record(z.string(), z.number().int().nonnegative()),
}).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length) context.addIssue({ code: "custom", path: ["players"], message: "Schaetzorama player IDs must be unique." });
  if (match.prompts.some((prompt) => prompt.min > prompt.answer || prompt.answer > prompt.max)) context.addIssue({ code: "custom", path: ["prompts"], message: "Schaetzorama prompt bounds are invalid." });
  if (match.rounds.some((round, index) => round.number !== index + 1)) context.addIssue({ code: "custom", path: ["rounds"], message: "Schaetzorama round order is invalid." });
});
const ImposterRoleSchema = z.object({ playerId: z.string().min(1).max(100), role: z.enum(["civilian", "imposter"]) }).strict();
const ImposterResultSchema = z.object({
  matchId: z.string().min(1).max(100), round: z.literal(1), category: z.string().min(1).max(80), word: z.string().min(1).max(80),
  imposterId: z.string().min(1).max(100), winner: z.enum(["civilians", "imposter"]), accusedPlayerIds: z.array(z.string().min(1).max(100)).max(10),
  voteCounts: z.record(z.string(), z.number().int().nonnegative()), clues: z.array(z.object({ playerId: z.string().min(1).max(100), clue: z.string().min(1).max(80) }).strict()).max(10), roles: z.array(ImposterRoleSchema).min(3).max(10),
}).strict();
const ImposterSchema = z.object({
  matchId: z.string().min(1).max(100), players: z.array(z.string().min(1).max(100)).min(3).max(10), round: z.literal(1), phase: z.enum(["cluing", "voting", "revealed"]),
  category: z.string().min(1).max(80), word: z.string().min(1).max(80), roles: z.array(ImposterRoleSchema).min(3).max(10),
  clues: z.record(z.string(), z.string().min(1).max(80)), votes: z.record(z.string(), z.string().min(1).max(100)), deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(),
}).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length || match.roles.length !== match.players.length || new Set(match.roles.map((role) => role.playerId)).size !== match.players.length || match.roles.some((role) => !match.players.includes(role.playerId)) || match.roles.filter((role) => role.role === "imposter").length !== 1) context.addIssue({ code: "custom", path: ["roles"], message: "Imposter roles must cover every player exactly once." });
  if (Object.keys(match.clues).some((id) => !match.players.includes(id)) || Object.keys(match.votes).some((id) => !match.players.includes(id)) || Object.values(match.votes).some((id) => !match.players.includes(id))) context.addIssue({ code: "custom", path: ["players"], message: "Imposter actions must belong to assigned players." });
  if (match.phase === "cluing" && Object.keys(match.votes).length) context.addIssue({ code: "custom", path: ["votes"], message: "Voting cannot begin during clue collection." });
  if ((match.phase === "revealed" && match.deadline !== match.updatedAt) || (match.phase !== "revealed" && match.deadline < match.updatedAt)) context.addIssue({ code: "custom", path: ["deadline"], message: "Imposter deadline does not match its phase." });
});
const BuzzwortTeamSchema = z.enum(["ember", "cobalt"]);
const BuzzwortRoleSchema = z.enum(["clue_giver", "guesser", "teammate", "watcher"]);
const BuzzwortCardSchema = z.object({ id: z.string().min(1).max(100), word: z.string().min(1).max(80), tabooWords: z.array(z.string().min(1).max(80)).min(3).max(8) }).strict();
const BuzzwortClueSchema = z.object({ playerId: z.string().min(1).max(100), attempt: z.number().int().min(1).max(200), text: z.string().min(1).max(120) }).strict();
const BuzzwortGuessSchema = z.object({ playerId: z.string().min(1).max(100), attempt: z.number().int().min(1).max(200), text: z.string().min(1).max(120), correct: z.boolean() }).strict();
const BuzzwortResultSchema = z.object({
  matchId: z.string().min(1).max(100), round: z.literal(1), outcome: z.enum(["guessed", "taboo", "timeout"]), winnerTeam: BuzzwortTeamSchema,
  activeTeam: BuzzwortTeamSchema, watcherTeam: BuzzwortTeamSchema, card: BuzzwortCardSchema,
  scores: z.object({ ember: z.number().int().nonnegative(), cobalt: z.number().int().nonnegative() }).strict(),
  teams: z.record(z.string(), BuzzwortTeamSchema), roles: z.record(z.string(), BuzzwortRoleSchema),
  clues: z.array(BuzzwortClueSchema).max(200), guesses: z.array(BuzzwortGuessSchema).max(200),
}).strict();
const BuzzwortSchema = z.object({
  matchId: z.string().min(1).max(100), players: z.array(z.string().min(1).max(100)).min(3).max(10), round: z.literal(1), phase: z.enum(["clue", "guess", "revealed"]), attempt: z.number().int().min(1).max(200),
  teams: z.record(z.string(), BuzzwortTeamSchema), roles: z.record(z.string(), BuzzwortRoleSchema), activeTeam: BuzzwortTeamSchema, watcherTeam: BuzzwortTeamSchema,
  clueGiverId: z.string().min(1).max(100), guesserId: z.string().min(1).max(100), card: BuzzwortCardSchema, currentClue: z.string().min(1).max(120).optional(),
  clues: z.array(BuzzwortClueSchema).max(200), guesses: z.array(BuzzwortGuessSchema).max(200),
  scores: z.object({ ember: z.number().int().nonnegative(), cobalt: z.number().int().nonnegative() }).strict(),
  outcome: z.enum(["guessed", "taboo", "timeout"]).optional(), winnerTeam: BuzzwortTeamSchema.optional(), deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(),
}).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length || Object.keys(match.teams).length !== match.players.length || Object.keys(match.roles).length !== match.players.length || match.players.some((id) => !match.teams[id] || !match.roles[id])) context.addIssue({ code: "custom", path: ["players"], message: "Buzzwort assignments must cover all unique players." });
  if (match.activeTeam === match.watcherTeam || match.teams[match.clueGiverId] !== match.activeTeam || match.teams[match.guesserId] !== match.activeTeam || match.roles[match.clueGiverId] !== "clue_giver" || match.roles[match.guesserId] !== "guesser" || match.clueGiverId === match.guesserId) context.addIssue({ code: "custom", path: ["roles"], message: "Buzzwort active roles do not match their teams." });
  if ((match.phase === "revealed") !== Boolean(match.outcome && match.winnerTeam) || (match.phase === "revealed" && match.deadline !== match.updatedAt) || (match.phase !== "revealed" && match.deadline < match.updatedAt)) context.addIssue({ code: "custom", path: ["phase"], message: "Buzzwort result or deadline does not match its phase." });
  if (match.outcome === "guessed" && match.winnerTeam !== match.activeTeam || match.outcome && match.outcome !== "guessed" && match.winnerTeam !== match.watcherTeam) context.addIssue({ code: "custom", path: ["winnerTeam"], message: "Buzzwort winner does not match its result." });
  if (match.clues.some((clue) => !match.players.includes(clue.playerId) || clue.playerId !== match.clueGiverId) || match.guesses.some((guess) => !match.players.includes(guess.playerId) || guess.playerId !== match.guesserId)) context.addIssue({ code: "custom", path: ["clues"], message: "Buzzwort clue and guess authors must use their assigned roles." });
});
const PantomimeGuessSchema = z.object({ playerId: z.string().min(1).max(100), text: z.string().min(1).max(100), correct: z.boolean(), at: z.number().int().safe() }).strict();
const PantomimeResultSchema = z.object({
  matchId: z.string().min(1).max(100), round: z.literal(1), outcome: z.enum(["guessed", "timeout", "host_reveal"]), prompt: z.string().min(1).max(100),
  performerId: z.string().min(1).max(100), winnerId: z.string().min(1).max(100).nullable(), scores: z.record(z.string(), z.number().int().nonnegative()), guesses: z.array(PantomimeGuessSchema).max(80),
}).strict();
const PantomimeSchema = z.object({
  performanceCue: z.string().trim().min(1).max(120).optional(),
  matchId: z.string().min(1).max(100), players: z.array(z.string().min(1).max(100)).min(3).max(10), round: z.literal(1), phase: z.enum(["acting", "revealed"]),
  performerId: z.string().min(1).max(100), prompt: z.string().min(1).max(100), deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), attempt: z.number().int().min(1).max(5),
  guesses: z.array(PantomimeGuessSchema).max(80), scores: z.record(z.string(), z.number().int().nonnegative()), outcome: z.enum(["guessed", "timeout", "host_reveal"]).optional(), winnerId: z.string().min(1).max(100).nullable().optional(),
}).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length || !match.players.includes(match.performerId) || match.guesses.some((guess) => !match.players.includes(guess.playerId) || guess.playerId === match.performerId) || Object.keys(match.scores).length !== match.players.length || match.players.some((id) => match.scores[id] === undefined)) context.addIssue({ code: "custom", path: ["players"], message: "Pantomime assignments and scores must cover valid room players." });
  if ((match.phase === "revealed") !== Boolean(match.outcome) || (match.phase === "revealed" && match.deadline !== match.updatedAt) || (match.phase !== "revealed" && match.deadline < match.updatedAt)) context.addIssue({ code: "custom", path: ["phase"], message: "Pantomime result or deadline does not match its phase." });
  if (match.outcome === "guessed" && (!match.winnerId || !match.guesses.some((guess) => guess.playerId === match.winnerId && guess.correct)) || match.outcome && match.outcome !== "guessed" && match.winnerId !== null) context.addIssue({ code: "custom", path: ["winnerId"], message: "Pantomime winner does not match its result." });
});
const DrawGuessPointSchema = z.object({ x: z.number().int().min(0).max(1000), y: z.number().int().min(0).max(1000) }).strict();
const DrawGuessStrokeSchema = z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), width: z.number().int().min(1).max(20), points: z.array(DrawGuessPointSchema).min(1).max(300) }).strict();
const DrawGuessEntrySchema = z.object({ playerId: z.string().min(1).max(100), attempt: z.number().int().min(1).max(5), text: z.string().min(1).max(100), correct: z.boolean(), at: z.number().int().safe() }).strict();
const DrawGuessResultSchema = z.object({
  matchId: z.string().min(1).max(100), round: z.literal(1), outcome: z.enum(["guessed", "timeout", "host_reveal"]), artistId: z.string().min(1).max(100), prompt: z.string().min(1).max(100),
  drawing: z.array(DrawGuessStrokeSchema).min(1).max(80).optional(), winnerId: z.string().min(1).max(100).nullable(), scores: z.record(z.string(), z.number().int().nonnegative()), guesses: z.array(DrawGuessEntrySchema).max(80),
}).strict();
const DrawGuessSchema = z.object({
  matchId: z.string().min(1).max(100), players: z.array(z.string().min(1).max(100)).min(3).max(10), round: z.literal(1), phase: z.enum(["drawing", "guessing", "revealed"]),
  artistId: z.string().min(1).max(100), prompt: z.string().min(1).max(100), drawing: z.array(DrawGuessStrokeSchema).min(1).max(80).optional(),
  deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), guesses: z.array(DrawGuessEntrySchema).max(80), scores: z.record(z.string(), z.number().int().nonnegative()),
  outcome: z.enum(["guessed", "timeout", "host_reveal"]).optional(), winnerId: z.string().min(1).max(100).nullable().optional(),
}).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length || !match.players.includes(match.artistId) || match.guesses.some((guess) => !match.players.includes(guess.playerId) || guess.playerId === match.artistId) || Object.keys(match.scores).length !== match.players.length || match.players.some((id) => match.scores[id] === undefined)) context.addIssue({ code: "custom", path: ["players"], message: "Draw & Guess assignments and scores must cover valid room players." });
  if (match.phase === "drawing" && (match.drawing || match.guesses.length || match.outcome || match.winnerId !== undefined) || match.phase === "guessing" && (!match.drawing || match.outcome || match.winnerId !== undefined) || (match.phase === "revealed") !== Boolean(match.outcome)) context.addIssue({ code: "custom", path: ["phase"], message: "Draw & Guess phase data does not match its lifecycle." });
  if ((match.phase === "revealed" && match.deadline !== match.updatedAt) || (match.phase !== "revealed" && match.deadline < match.updatedAt)) context.addIssue({ code: "custom", path: ["deadline"], message: "Draw & Guess deadline does not match its phase." });
  if (match.outcome === "guessed" && (!match.winnerId || !match.guesses.some((guess) => guess.playerId === match.winnerId && guess.correct)) || match.outcome && match.outcome !== "guessed" && match.winnerId !== null) context.addIssue({ code: "custom", path: ["winnerId"], message: "Draw & Guess winner does not match its result." });
  if (match.players.some((id) => match.scores[id] !== (match.outcome === "guessed" && id === match.winnerId ? 1_000 : match.outcome === "guessed" && id === match.artistId ? 500 : 0))) context.addIssue({ code: "custom", path: ["scores"], message: "Draw & Guess scores must match the finalized result." });
  if (match.drawing && match.drawing.reduce((count, stroke) => count + stroke.points.length, 0) > 3000) context.addIssue({ code: "custom", path: ["drawing"], message: "Draw & Guess drawings are limited to 3000 points." });
});
const ArenaSurvivorChoiceSchema = z.object({ id: z.string().min(1).max(100), text: z.string().min(1).max(160) }).strict();
const ArenaSurvivorPublicScenarioSchema = z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(120), description: z.string().min(1).max(400), choices: z.array(ArenaSurvivorChoiceSchema).length(3) }).strict();
const ArenaSurvivorScenarioSchema = ArenaSurvivorPublicScenarioSchema.extend({ correctChoiceId: z.string().min(1).max(100), explanation: z.string().min(1).max(400) }).strict().superRefine((scenario, context) => {
  if (!scenario.choices.some((choice) => choice.id === scenario.correctChoiceId)) context.addIssue({ code: "custom", path: ["correctChoiceId"], message: "Arena Survivor answer key must match one of its choices." });
});
const ArenaSurvivorEntrySchema = z.object({ playerId: z.string().min(1).max(100), choiceId: z.string().min(1).max(100).nullable(), survived: z.boolean() }).strict();
const ArenaSurvivorResultSchema = z.object({ matchId: z.string().min(1).max(100), round: z.literal(1), outcome: z.enum(["revealed", "timeout"]), scenario: ArenaSurvivorPublicScenarioSchema,
  correctChoiceId: z.string().min(1).max(100), explanation: z.string().min(1).max(400), submissions: z.array(ArenaSurvivorEntrySchema).min(3).max(10), choiceCounts: z.record(z.string(), z.number().int().nonnegative()), winners: z.array(z.string().min(1).max(100)), scores: z.record(z.string(), z.number().int().nonnegative()),
}).strict();
const ArenaSurvivorSchema = z.object({ matchId: z.string().min(1).max(100), players: z.array(z.string().min(1).max(100)).min(3).max(10), round: z.literal(1), phase: z.enum(["answering", "revealed"]),
  scenario: ArenaSurvivorScenarioSchema, successfulChoiceId: z.string().min(1).max(100), choices: z.record(z.string(), z.string().min(1).max(100)), deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), scores: z.record(z.string(), z.number().int().nonnegative()), outcome: z.enum(["revealed", "timeout"]).optional(), entries: z.array(ArenaSurvivorEntrySchema).min(3).max(10).optional(),
}).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length || !match.scenario.choices.some((choice) => choice.id === match.successfulChoiceId) || match.scenario.correctChoiceId !== match.successfulChoiceId || Object.keys(match.choices).some((id) => !match.players.includes(id)) || Object.values(match.choices).some((id) => !match.scenario.choices.some((choice) => choice.id === id)) || Object.keys(match.scores).length !== match.players.length || match.players.some((id) => match.scores[id] === undefined)) context.addIssue({ code: "custom", path: ["players"], message: "Arena Survivor assignments must cover valid room players and match the answer key." });
  if (match.phase === "answering" && (match.outcome || match.entries || match.deadline < match.updatedAt) || match.phase === "revealed" && (!match.outcome || !match.entries || match.entries.length !== match.players.length || match.deadline !== match.updatedAt)) context.addIssue({ code: "custom", path: ["phase"], message: "Arena Survivor result or deadline does not match its phase." });
  if (match.entries && (new Set(match.entries.map((entry) => entry.playerId)).size !== match.players.length || match.players.some((id) => !match.entries!.some((entry) => entry.playerId === id && entry.choiceId === (match.choices[id] ?? null) && entry.survived === (entry.choiceId !== null && entry.choiceId === match.successfulChoiceId))))) context.addIssue({ code: "custom", path: ["entries"], message: "Arena Survivor results must match each private choice." });
  if (match.players.some((id) => match.scores[id] !== (match.entries?.some((entry) => entry.playerId === id && entry.survived) ? 1_000 : 0))) context.addIssue({ code: "custom", path: ["scores"], message: "Arena Survivor scores must match the revealed choices." });
});
const ChaosToolSchema = z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(120), tags: z.array(z.string().min(1).max(40)).min(1).max(4) }).strict();
const ChaosMissionSchema = z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(120), briefing: z.string().min(1).max(400), requiredTags: z.array(z.string().min(1).max(40)).min(2).max(4), tools: z.array(ChaosToolSchema).min(3).max(8) }).strict();
const ChaosSubmissionSchema = z.object({ playerId: z.string().min(1).max(100), toolId: z.string().min(1).max(100).nullable() }).strict();
const ChaosMissionResultSchema = z.object({ missionNumber: z.number().int().min(1).max(4), missionId: z.string().min(1).max(100), outcome: z.enum(["contained", "uncontained", "timeout"]), coveredTags: z.array(z.string().min(1).max(40)), missingTags: z.array(z.string().min(1).max(40)), submissions: z.array(ChaosSubmissionSchema).min(3).max(10), score: z.union([z.literal(0), z.literal(1_000)]) }).strict();
const ChaosKommandoSchema = z.object({ matchId: z.string().min(1).max(100), players: z.array(z.string().min(1).max(100)).min(3).max(10), missionNumber: z.number().int().min(1).max(4), phase: z.enum(["choosing", "revealed"]), mission: ChaosMissionSchema, choices: z.record(z.string(), z.string().min(1).max(100)), deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), missionResults: z.array(ChaosMissionResultSchema).max(4), result: z.object({ matchId: z.string().min(1).max(100), missions: z.array(ChaosMissionResultSchema).length(4), score: z.number().int().min(0).max(4_000), maxScore: z.literal(4_000), outcome: z.enum(["contained", "critical"]) }).strict().optional() }).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length || Object.keys(match.choices).some((id) => !match.players.includes(id)) || Object.values(match.choices).some((id) => !match.mission.tools.some((item) => item.id === id)) || match.missionResults.length !== (match.phase === "revealed" ? match.missionNumber : match.missionNumber - 1) || match.missionResults.some((result, index) => result.missionNumber !== index + 1 || result.submissions.length !== match.players.length || new Set(result.submissions.map((entry) => entry.playerId)).size !== match.players.length)) context.addIssue({ code: "custom", path: ["missionResults"], message: "Chaos-Kommando mission data must match the match sequence." });
  if ((match.phase === "revealed") !== (match.deadline === match.updatedAt) || (match.phase === "choosing" && match.deadline < match.updatedAt) || (match.result && (match.phase !== "revealed" || match.missionNumber !== 4 || match.result.missions.length !== 4))) context.addIssue({ code: "custom", path: ["phase"], message: "Chaos-Kommando result or deadline does not match its phase." });
  if (match.result && (match.result.score !== match.result.missions.reduce((sum, result) => sum + result.score, 0) || match.result.outcome !== (match.result.score >= 3_000 ? "contained" : "critical"))) context.addIssue({ code: "custom", path: ["result"], message: "Chaos-Kommando final score does not match the mission results." });
});
const MagicArenaStatsSchema = z.record(z.string().min(1).max(100), z.number().int().min(0).max(6));
const MagicArenaEnergySchema = z.record(z.string().min(1).max(100), z.number().int().min(0).max(3));
const MagicArenaRoundResultSchema = z.object({ round: z.number().int().min(1).max(5), actions: z.record(z.string().min(1).max(100), z.enum(["strike", "guard", "focus"])), health: MagicArenaStatsSchema, energy: MagicArenaEnergySchema, damage: z.record(z.string().min(1).max(100), z.number().int().min(0).max(2)), outcome: z.enum(["hit", "blocked", "no-damage", "knockout", "timeout"]) }).strict();
const MagicArenaSchema = z.object({ matchId: z.string().min(1).max(100), players: z.array(z.string().min(1).max(100)).min(2).max(10), round: z.number().int().min(1).max(5), roundCount: z.literal(5), phase: z.enum(["choosing", "revealed", "complete"]), choices: z.record(z.string().min(1).max(100), z.enum(["strike", "guard", "focus"])), health: MagicArenaStatsSchema, energy: MagicArenaEnergySchema, deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), roundResults: z.array(MagicArenaRoundResultSchema).max(5), result: z.object({ matchId: z.string().min(1).max(100), winnerPlayerId: z.string().min(1).max(100).nullable(), outcome: z.enum(["knockout", "points", "draw"]), health: MagicArenaStatsSchema, energy: MagicArenaEnergySchema, roundsPlayed: z.number().int().min(1).max(5) }).strict().optional() }).strict().superRefine((match, context) => {
  if (!isValidMagicArenaMatch(match)) context.addIssue({ code: "custom", path: ["magicArena"], message: "Magic Arena roster, choices, round history, resources or result are inconsistent." });
});
const MagicDuellStatsSchema = z.record(z.string().min(1).max(100), z.number().int().min(0).max(12));
const MagicDuellManaSchema = z.record(z.string().min(1).max(100), z.number().int().min(0).max(5));
const MagicDuellGestureSchema = z.enum(["bolt", "shield", "loop"]);
const MagicDuellChoiceSchema = z.object({ spellId: z.string().min(1).max(80), gesture: MagicDuellGestureSchema }).strict();
const MagicDuellCastSchema = MagicDuellChoiceSchema.extend({ timedOut: z.boolean() }).strict();
const MagicDuellRoundResultSchema = z.object({ round: z.number().int().min(1).max(5), casts: z.record(z.string().min(1).max(100), MagicDuellCastSchema), health: MagicDuellStatsSchema, mana: MagicDuellManaSchema, damage: z.record(z.string().min(1).max(100), z.number().int().min(0).max(3)), timedOut: z.boolean() }).strict();
const MagicDuellSchema = z.object({ matchId: z.string().min(1).max(120), players: z.array(z.string().min(1).max(100)).min(2).max(10), phase: z.enum(["drafting", "casting", "revealed", "complete"]), round: z.number().int().min(0).max(5), roundCount: z.literal(5), loadouts: z.record(z.string().min(1).max(100), z.array(z.string().min(1).max(80)).length(3)), choices: z.record(z.string().min(1).max(100), MagicDuellChoiceSchema), health: MagicDuellStatsSchema, mana: MagicDuellManaSchema, deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), roundResults: z.array(MagicDuellRoundResultSchema).max(5), result: z.object({ matchId: z.string().min(1).max(120), winnerPlayerId: z.string().min(1).max(100).nullable(), outcome: z.enum(["knockout", "points", "draw"]), health: MagicDuellStatsSchema, mana: MagicDuellManaSchema, roundsPlayed: z.number().int().min(1).max(5) }).strict().optional() }).strict().superRefine((match, context) => {
  if (!isValidMagicDuellMatch(match)) context.addIssue({ code: "custom", path: ["magicDuell"], message: "Magic Duell loadouts, casts, resources, round history, or result are inconsistent." });
});
const MinionsTdSchema = z.unknown().nullable().default(null).superRefine((match, context) => {
  if (match !== null && !isValidMinionsTdMatch(match)) context.addIssue({ code: "custom", path: ["minionsTd"], message: "Minions TD orders, lane state, round history, or result are inconsistent." });
});
const FlatterfluffSchema = z.unknown().nullable().default(null).superRefine((match, context) => {
  if (match !== null && !isValidFlatterfluffMatch(match)) context.addIssue({ code: "custom", path: ["flatterfluff"], message: "Flatterfluff aim, target waves, scores, or round history are inconsistent." });
});
const DriftRacerSchema = z.unknown().nullable().default(null).superRefine((match, context) => {
  if (match !== null && !isValidDriftRacerMatch(match)) context.addIssue({ code: "custom", path: ["driftRacer"], message: "Drift Racer turn inputs, driver state, or result history are inconsistent." });
});
const KartentischSuitSchema = z.enum(["clubs", "diamonds", "hearts", "spades"]);
const KartentischCardSchema = z.object({ id: z.string().regex(/^(?:[2-9]|1[0-4])[CDHS]$/), rank: z.number().int().min(2).max(14), suit: KartentischSuitSchema }).strict().superRefine((card, context) => { if (card.id !== `${card.rank}${card.suit[0]!.toUpperCase()}`) context.addIssue({ code: "custom", path: ["id"], message: "Card id must match its rank and suit." }); });
const KartentischHandsSchema = z.record(z.string().min(1).max(100), z.array(KartentischCardSchema).max(5));
const KartentischScoreSchema = z.record(z.string().min(1).max(100), z.number().int().min(0).max(5));
const KartentischTrickResultSchema = z.object({ trick: z.number().int().min(1).max(5), leaderPlayerId: z.string().min(1).max(100), ledSuit: KartentischSuitSchema, trumpSuit: KartentischSuitSchema, plays: z.array(z.object({ playerId: z.string().min(1).max(100), card: KartentischCardSchema }).strict()).min(3).max(10), winnerPlayerId: z.string().min(1).max(100), scores: KartentischScoreSchema, timedOut: z.boolean() }).strict();
const KartentischSchema = z.object({ matchId: z.string().min(1).max(120), players: z.array(z.string().min(1).max(100)).min(3).max(10), trick: z.number().int().min(1).max(5), phase: z.enum(["playing", "revealed", "complete"]), trumpSuit: KartentischSuitSchema, leaderPlayerId: z.string().min(1).max(100), turnPlayerId: z.string().min(1).max(100).nullable(), hands: KartentischHandsSchema, initialHands: z.record(z.string().min(1).max(100), z.array(KartentischCardSchema).length(5)), plays: z.record(z.string().min(1).max(100), KartentischCardSchema), scores: KartentischScoreSchema, deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), trickResults: z.array(KartentischTrickResultSchema).max(5), seed: z.number().int().safe(), result: z.object({ matchId: z.string().min(1).max(120), scores: KartentischScoreSchema, winners: z.array(z.string().min(1).max(100)).min(1).max(10), tricksPlayed: z.literal(5), hands: z.record(z.string().min(1).max(100), z.array(KartentischCardSchema).length(5)) }).strict().optional() }).strict().superRefine((match, context) => {
  const ids = Object.values(match.initialHands).flat().map((card) => card.id);
  if (new Set(match.players).size !== match.players.length || match.players.some((id) => !match.initialHands[id] || !match.hands[id] || match.scores[id] === undefined) || Object.keys(match.initialHands).length !== match.players.length || Object.keys(match.hands).length !== match.players.length || Object.keys(match.plays).some((id) => !match.players.includes(id)) || new Set(ids).size !== ids.length || Object.keys(match.plays).length > match.players.length || match.trickResults.length !== match.trick - (match.phase === "playing" ? 1 : 0) || match.trickResults.some((result, index) => result.trick !== index + 1 || result.plays.length !== match.players.length || !match.players.includes(result.winnerPlayerId))) context.addIssue({ code: "custom", path: ["players"], message: "Kartentisch requires a unique deal and complete trick records." });
  if ((match.phase === "playing" && ((match.turnPlayerId === null) !== (Object.keys(match.plays).length === match.players.length) || match.deadline < match.updatedAt || match.result)) || (match.phase === "revealed" && (match.turnPlayerId !== null || match.deadline !== match.updatedAt || Object.keys(match.plays).length !== match.players.length || match.result)) || (match.phase === "complete" && (!match.result || match.turnPlayerId !== null || match.trickResults.length !== 5 || match.result.matchId !== match.matchId || match.result.tricksPlayed !== 5))) context.addIssue({ code: "custom", path: ["phase"], message: "Kartentisch lifecycle or final reveal is inconsistent." });
  if (match.result && (Object.keys(match.result.hands).length !== match.players.length || match.players.some((id) => !match.result!.hands[id] || match.result!.scores[id] !== match.scores[id]))) context.addIssue({ code: "custom", path: ["result"], message: "Kartentisch final reveal must match the completed deal and scores." });
});
const DungeonActionSchema = z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(120), progress: z.number().int().min(0).max(2), guard: z.number().int().min(0).max(1), healing: z.number().int().min(0).max(1) }).strict();
const DungeonResultSchema = z.object({ encounter: z.number().int().min(1).max(3), encounterId: z.string().min(1).max(100), success: z.boolean(), timedOut: z.boolean(), progress: z.number().int().nonnegative(), target: z.number().int().positive(), guard: z.number().int().nonnegative(), healing: z.number().int().nonnegative(), damage: z.number().int().nonnegative(), health: z.number().int().min(0).max(10), scoreEarned: z.number().int().min(0).max(1_000), actions: z.array(z.object({ playerId: z.string().min(1).max(100), actionId: z.string().min(1).max(100), timedOut: z.boolean() }).strict()).min(3).max(10) }).strict();
const DungeonPartySchema = z.object({ matchId: z.string().min(1).max(120), players: z.array(z.string().min(1).max(100)).min(3).max(10), encounter: z.number().int().min(1).max(3), phase: z.enum(["choosing", "revealed", "complete"]), definition: z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(120), briefing: z.string().min(1).max(400), target: z.number().int().positive(), threat: z.number().int().positive(), fallbackActionId: z.string().min(1).max(100), actions: z.array(DungeonActionSchema).min(3).max(5) }).strict(), choices: z.record(z.string().min(1).max(100), z.string().min(1).max(100)), health: z.number().int().min(0).max(10), score: z.number().int().min(0).max(3_000), deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), encounterResults: z.array(DungeonResultSchema).max(3), result: z.object({ matchId: z.string().min(1).max(120), outcome: z.enum(["escaped", "survived", "fallen"]), health: z.number().int().min(0).max(10), score: z.number().int().min(0).max(3_000), maxScore: z.literal(3_000), completedEncounters: z.number().int().min(1).max(3), successfulEncounters: z.number().int().min(0).max(3) }).strict().optional() }).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length || Object.keys(match.choices).some((id) => !match.players.includes(id)) || Object.values(match.choices).some((id) => !match.definition.actions.some((action) => action.id === id)) || match.encounterResults.length !== (match.phase === "choosing" ? match.encounter - 1 : match.encounter) || match.encounterResults.some((result, index) => result.encounter !== index + 1 || result.actions.length !== match.players.length || new Set(result.actions.map((entry) => entry.playerId)).size !== match.players.length)) context.addIssue({ code: "custom", path: ["encounterResults"], message: "Dungeon Party encounters must be in order with one result for every player." });
  if ((match.phase === "choosing" && (match.deadline < match.updatedAt || match.result)) || (match.phase !== "choosing" && match.deadline !== match.updatedAt) || (match.phase === "complete") !== Boolean(match.result)) context.addIssue({ code: "custom", path: ["phase"], message: "Dungeon Party lifecycle or deadline is inconsistent." });
  if (match.result && (match.result.matchId !== match.matchId || match.result.score !== match.score || match.result.health !== match.health || match.result.completedEncounters !== match.encounterResults.length)) context.addIssue({ code: "custom", path: ["result"], message: "Dungeon Party result must match the persisted encounter history." });
});
const WordTilesRoundDataSchema = z.object({ letters: z.string().regex(/^[A-Z]{7}$/), solutionWord: z.string().min(3).max(7).refine((word) => WORD_TILES_DICTIONARY.has(word)) }).strict();
function wordTilesCanBuild(letters: string, word: string): boolean {
  const counts = new Map<string, number>();
  for (const letter of letters.toLowerCase()) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  for (const letter of word) { const count = counts.get(letter) ?? 0; if (count < 1) return false; counts.set(letter, count - 1); }
  return true;
}
const WordTilesEntrySchema = z.object({ playerId: z.string().min(1).max(100), word: z.string().regex(/^[a-z]{3,7}$/).nullable(), timedOut: z.boolean(), tileScore: z.number().int().min(0).max(70), bonus: z.number().int().min(0).max(3), scoreEarned: z.number().int().min(0).max(76) }).strict();
const WordTilesRoundResultSchema = z.object({ round: z.number().int().min(1).max(5), letters: z.string().regex(/^[A-Z]{7}$/), timedOut: z.boolean(), submissions: z.array(WordTilesEntrySchema).min(2).max(10), scores: z.record(z.string().min(1).max(100), z.number().int().nonnegative()), leaders: z.array(z.string().min(1).max(100)).max(10) }).strict();
const WordTilesSchema = z.object({ matchId: z.string().min(1).max(120), players: z.array(z.string().min(1).max(100)).min(2).max(10), round: z.number().int().min(1).max(5), phase: z.enum(["choosing", "revealed", "complete"]), roundData: z.array(WordTilesRoundDataSchema).length(5), choices: z.record(z.string().min(1).max(100), z.string().regex(/^[a-z]{3,7}$/).nullable()), scores: z.record(z.string().min(1).max(100), z.number().int().nonnegative()), deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), roundResults: z.array(WordTilesRoundResultSchema).max(5), result: z.object({ matchId: z.string().min(1).max(120), scores: z.record(z.string().min(1).max(100), z.number().int().nonnegative()), winners: z.array(z.string().min(1).max(100)).min(1).max(10), roundsPlayed: z.literal(5), rounds: z.array(WordTilesRoundResultSchema).length(5) }).strict().optional() }).strict().superRefine((match, context) => {
  if (new Set(match.players).size !== match.players.length || Object.keys(match.choices).some((id) => !match.players.includes(id)) || Object.keys(match.scores).length !== match.players.length || match.players.some((id) => match.scores[id] === undefined) || match.roundResults.length !== (match.phase === "choosing" ? match.round - 1 : match.round) || match.roundResults.some((result, index) => result.round !== index + 1 || result.submissions.length !== match.players.length || new Set(result.submissions.map((entry) => entry.playerId)).size !== match.players.length || result.submissions.some((entry) => !match.players.includes(entry.playerId)))) context.addIssue({ code: "custom", path: ["roundResults"], message: "Word Tiles must contain ordered results for every player." });
  if ((match.phase === "choosing" && (match.deadline < match.updatedAt || match.result)) || (match.phase !== "choosing" && match.deadline !== match.updatedAt) || (match.phase === "complete") !== Boolean(match.result)) context.addIssue({ code: "custom", path: ["phase"], message: "Word Tiles deadline or lifecycle is inconsistent." });
  if (match.result && (match.result.matchId !== match.matchId || JSON.stringify(match.result.scores) !== JSON.stringify(match.scores) || match.result.rounds.length !== 5)) context.addIssue({ code: "custom", path: ["result"], message: "Word Tiles final result must match its stored scores and rounds." });
  if (match.roundData.some((round) => !wordTilesCanBuild(round.letters, round.solutionWord)) || Object.values(match.choices).some((word) => word !== null && !wordTilesCanBuild(match.roundData[match.round - 1]!.letters, word))) context.addIssue({ code: "custom", path: ["roundData"], message: "Word Tiles must use words constructible from their current letter racks." });
  if (!isValidWordTilesMatch(match)) context.addIssue({ code: "custom", path: ["wordTiles"], message: "Word Tiles choices, round results, scores, or final result are inconsistent." });
});
const SchattenjagdCaseSchema = z.object({ id: z.string().min(1).max(100), title: z.string().min(1).max(120), briefing: z.string().min(1).max(500), suspects: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(100), trace: z.string().min(1).max(100), route: z.string().min(1).max(100) }).strict()).length(3), clues: z.array(z.object({ id: z.string().min(1).max(100), text: z.string().min(1).max(300), field: z.enum(["trace", "route"]), value: z.string().min(1).max(100) }).strict()).length(2), targetId: z.string().min(1).max(100) }).strict();
const SchattenjagdVoteSchema = z.object({ playerId: z.string().min(1).max(100), suspectId: z.string().min(1).max(100).nullable(), timedOut: z.boolean(), correct: z.boolean(), points: z.number().int().min(0).max(150) }).strict();
const SchattenjagdCaseResultSchema = z.object({ round: z.number().int().min(1).max(4), caseId: z.string().min(1).max(100), targetId: z.string().min(1).max(100), timedOut: z.boolean(), correctCount: z.number().int().min(0).max(10), teamBonusApplied: z.boolean(), votes: z.array(SchattenjagdVoteSchema).min(2).max(10), scores: z.record(z.string().min(1).max(100), z.number().int().nonnegative()) }).strict();
const SchattenjagdSchema = z.object({ matchId: z.string().min(1).max(120), players: z.array(z.string().min(1).max(100)).min(2).max(10), round: z.number().int().min(1).max(4), phase: z.enum(["choosing", "revealed", "complete"]), cases: z.array(SchattenjagdCaseSchema).length(4), choices: z.record(z.string().min(1).max(100), z.string().min(1).max(100)), scores: z.record(z.string().min(1).max(100), z.number().int().nonnegative()), deadline: z.number().int().safe(), updatedAt: z.number().int().safe(), version: z.number().int().nonnegative(), caseResults: z.array(SchattenjagdCaseResultSchema).max(4), result: z.object({ matchId: z.string().min(1).max(120), scores: z.record(z.string().min(1).max(100), z.number().int().nonnegative()), winners: z.array(z.string().min(1).max(100)).min(1).max(10), casesPlayed: z.literal(4), cases: z.array(SchattenjagdCaseResultSchema).length(4) }).strict().optional() }).strict().superRefine((match, context) => {
  if (!isValidSchattenjagdMatch(match)) context.addIssue({ code: "custom", path: ["schattenjagd"], message: "Schattenjagd choices, case results, scores, or final result are inconsistent." });
});
const ImageGenerationNoticeSchema = z.object({
  kind: z.union([z.literal("RETRYING"), z.literal("FAILED")]),
  failedModel: ImageModelSchema,
  nextModel: ImageModelSchema.optional(),
  reason: z.literal("ALLOWANCE_STOP").optional(),
  updatedAt: z.number(),
}).strict();

export const RoomStatePersistenceSchema = z.object({
  serializationVersion: z.literal(ROOM_STATE_SERIALIZATION_VERSION),
  id: z.string(), code: z.string(), version: z.number().int().positive(), phase: RoomPhaseSchema, phaseStartedAt: z.number(), deadlineAt: z.number().nullable(),
  paused: z.boolean(), remainingMs: z.number().nullable(), joiningLocked: z.boolean(), gameLength: GameLengthSchema, arcadeGameId: ArcadeGameIdSchema.nullable().default(null),
  arcadeMatch: z.object({ id: z.string(), gameId: ArcadeGameIdSchema, matchNumber: z.number().int().positive(), status: z.enum(["ACTIVE", "COMPLETE"]), startedAt: z.number(), endedAt: z.number().nullable(), result: z.record(z.string(), z.unknown()).nullable(), controllerIds: z.array(z.string().min(1).max(120)).max(16).optional() }).strict().nullable().default(null), schaetzorama: SchaetzoramaSchema.nullable().default(null), imposter: ImposterSchema.nullable().default(null), buzzwort: BuzzwortSchema.nullable().default(null), pantomime: PantomimeSchema.nullable().default(null), drawGuess: DrawGuessSchema.nullable().default(null), arenaSurvivor: ArenaSurvivorSchema.nullable().default(null), chaosKommando: ChaosKommandoSchema.nullable().default(null), magicArena: MagicArenaSchema.nullable().default(null), magicDuell: MagicDuellSchema.nullable().default(null), minionsTd: MinionsTdSchema, kartentisch: KartentischSchema.nullable().default(null), dungeonParty: DungeonPartySchema.nullable().default(null), flatterfluff: FlatterfluffSchema, driftRacer: DriftRacerSchema, wordTiles: WordTilesSchema.nullable().default(null), sketchRelay: SketchRelayMatchSchema.refine(isValidSketchRelayMatch, "Invalid Sketch & Sorcery match").nullable().default(null), fishGame: FishFinaleStateSchema.nullable().default(null), schattenjagd: SchattenjagdSchema.nullable().default(null), contentMode: ContentModeSchema,
  timerAccessibility: z.boolean(), sorceryLength:z.enum(["quick","long"]).optional(), sorceryHostProfileHash:z.string().regex(/^[a-f0-9]{64}$/).optional(), soloMode: z.boolean().default(false), soloLiveImages: z.boolean().default(false), imageModel: ImageModelSchema.default("flux-1-schnell"), imageGenerationNotice: ImageGenerationNoticeSchema.nullable().default(null), developerMode: z.boolean().default(false),
  bowl: BowlSchema.nullable().default(null),
  soloPlayerId: z.string().nullable().default(null), foolHostPlayerId: z.string().nullable().default(null), birthdayName: z.string().nullable(), birthdayPersonId: z.string().nullable().default(null),
  status: z.union([z.literal("LOBBY"), z.literal("ACTIVE"), z.literal("COMPLETE"), z.literal("ENDED")]), matchNumber: z.number().int().positive().default(1),
  createdAt: z.number(), updatedAt: z.number(), expiresAt: z.number(), botSeats: z.array(z.number().int().min(1).max(10)).max(10).default([]), participants: z.array(ParticipantSchema),
  roundPlan: z.array(z.object({ kind: RoundKindSchema, label: z.string() }).strict()), roundIndex: z.number().int(), currentRound: RoundSchema.nullable(),
  promptHistory: z.array(z.string()), answerHistory: z.array(AnswerSchema), lore: z.array(LoreSchema), memoryEdges: z.array(MemoryEdgeSchema),
  primaryMemoryIds: z.object({ ANCHOR: z.string().optional(), VOICE: z.string().optional(), WORLD: z.string().optional(), CONSEQUENCE: z.string().optional() }).strict(),
  callbackCandidates: z.array(CallbackCandidateSchema), remixCandidates: z.array(RemixCandidateSchema), anchorImage: ImageSchema.nullable().default(null),
  finalImage: ImageSchema.nullable().default(null), kingImages: z.record(z.string(), ImageSchema).default({}), kingFinalists: z.array(z.string()).default([]),
  kingRounds: z.array(RoundSchema).default([]), kingRoundTwoRequestId: z.string().nullable().default(null),
  kingRestorationBase: z.string().nullable().default(null), kingRestorationAssignments: z.record(z.string(), z.string()).default({}),
  comicTheme: z.string().nullable().default(null), comicFrames: z.array(ComicFrameSchema).default([]), feedbackVotes: z.array(FeedbackVoteSchema).default([]),
  feedbackTallies: z.record(z.string(), z.object({ a: z.number(), b: z.number() }).strict()).default({}), scoreEvents: z.array(ScoreEventSchema),
  encoreScoreEvents: z.array(ScoreEventSchema), awards: z.array(z.object({ title: z.string(), playerIds: z.array(z.string()), caption: z.string() }).strict()),
  roomLore: z.array(z.string()), warCampaign: z.union([z.literal("ATTACK"), z.literal("DEFEND")]).default("ATTACK"),
  warTeams: z.record(z.string(), z.union([z.literal("LION"), z.literal("RAVEN")])).default({}),
  warTeamScores: z.object({ LION: z.number().int().nonnegative(), RAVEN: z.number().int().nonnegative() }).default({ LION: 0, RAVEN: 0 }),
  warScoutUsed: z.object({ LION: z.boolean(), RAVEN: z.boolean() }).default({ LION: false, RAVEN: false }), actionCount: z.number().int().nonnegative(),
  foolPlayMode: z.enum(["SAME_TABLE", "REMOTE_LIVE"]).default("SAME_TABLE"),
  foolPerformance: z.enum(["DRAWING", "CHARADES"]).default("DRAWING"),
  foolScrollsPerPlayer: z.number().int().min(1).max(5).default(3), foolVoiceEnabled: z.boolean().default(true),
  foolTeams: z.record(z.string(), z.enum(["BELLS", "MOTLEY"])).default({}),
  foolReadyPlayerIds: z.array(z.string()).default([]),
  foolTeamScores: z.object({ BELLS: z.number().int().nonnegative(), MOTLEY: z.number().int().nonnegative() }).default({ BELLS: 0, MOTLEY: 0 }),
  foolWinner: z.enum(["BELLS", "MOTLEY"]).nullable().default(null),
}).strict().superRefine((state, context) => {
  if (state.gameLength === "arcade" && !state.arcadeGameId) context.addIssue({ code: "custom", path: ["arcadeGameId"], message: "Arcade rooms require a game ID." });
  if (state.gameLength !== "arcade" && (state.arcadeGameId || state.arcadeMatch)) context.addIssue({ code: "custom", path: ["arcadeGameId"], message: "Creative rooms cannot contain Arcade state." });
  if (state.gameLength === "arcade" && ["ARCADE_ACTIVE", "ARCADE_RESULTS"].includes(state.phase) && !state.arcadeMatch) context.addIssue({ code: "custom", path: ["arcadeMatch"], message: "Active Arcade phases require a match record." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "schaetzorama" && state.phase === "ARCADE_ACTIVE" && !state.schaetzorama) context.addIssue({ code: "custom", path: ["schaetzorama"], message: "An active Schaetzorama game requires its typed match state." });
  if (state.schaetzorama && (state.arcadeGameId !== "schaetzorama" || state.arcadeMatch?.id !== state.schaetzorama.matchId)) context.addIssue({ code: "custom", path: ["schaetzorama"], message: "Schaetzorama state must match the room game and Arcade match." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "imposter" && state.phase === "ARCADE_ACTIVE" && !state.imposter) context.addIssue({ code: "custom", path: ["imposter"], message: "An active Imposter game requires its typed match state." });
  if (state.imposter && (state.arcadeGameId !== "imposter" || state.arcadeMatch?.id !== state.imposter.matchId)) context.addIssue({ code: "custom", path: ["imposter"], message: "Imposter state must match the room game and Arcade match." });
  if (state.arcadeGameId === "imposter" && state.phase === "ARCADE_RESULTS" && !ImposterResultSchema.safeParse(state.arcadeMatch?.result).success) context.addIssue({ code: "custom", path: ["arcadeMatch", "result"], message: "Completed Imposter matches require a validated result." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "buzzwort" && state.phase === "ARCADE_ACTIVE" && !state.buzzwort) context.addIssue({ code: "custom", path: ["buzzwort"], message: "An active Buzzwort game requires its typed match state." });
  if (state.buzzwort && (state.arcadeGameId !== "buzzwort" || state.arcadeMatch?.id !== state.buzzwort.matchId)) context.addIssue({ code: "custom", path: ["buzzwort"], message: "Buzzwort state must match the room game and Arcade match." });
  if (state.arcadeGameId === "buzzwort" && state.phase === "ARCADE_RESULTS" && !BuzzwortResultSchema.safeParse(state.arcadeMatch?.result).success) context.addIssue({ code: "custom", path: ["arcadeMatch", "result"], message: "Completed Buzzwort matches require a validated result." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "pantomime" && state.phase === "ARCADE_ACTIVE" && !state.pantomime) context.addIssue({ code: "custom", path: ["pantomime"], message: "An active Pantomime game requires its typed match state." });
  if (state.pantomime && (state.arcadeGameId !== "pantomime" || state.arcadeMatch?.id !== state.pantomime.matchId)) context.addIssue({ code: "custom", path: ["pantomime"], message: "Pantomime state must match the room game and Arcade match." });
  if (state.arcadeGameId === "pantomime" && state.phase === "ARCADE_RESULTS" && !PantomimeResultSchema.safeParse(state.arcadeMatch?.result).success) context.addIssue({ code: "custom", path: ["arcadeMatch", "result"], message: "Completed Pantomime matches require a validated result." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "zeichnen-und-erraten" && state.phase === "ARCADE_ACTIVE" && !state.drawGuess) context.addIssue({ code: "custom", path: ["drawGuess"], message: "An active Draw & Guess game requires its typed match state." });
  if (state.drawGuess && (state.arcadeGameId !== "zeichnen-und-erraten" || state.arcadeMatch?.id !== state.drawGuess.matchId)) context.addIssue({ code: "custom", path: ["drawGuess"], message: "Draw & Guess state must match the room game and Arcade match." });
  if (state.arcadeGameId === "zeichnen-und-erraten" && state.phase === "ARCADE_RESULTS" && !DrawGuessResultSchema.safeParse(state.arcadeMatch?.result).success) context.addIssue({ code: "custom", path: ["arcadeMatch", "result"], message: "Completed Draw & Guess matches require a validated result." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "arena-survivor" && state.phase === "ARCADE_ACTIVE" && !state.arenaSurvivor) context.addIssue({ code: "custom", path: ["arenaSurvivor"], message: "An active Arena Survivor game requires its typed match state." });
  if (state.arenaSurvivor && (state.arcadeGameId !== "arena-survivor" || state.arcadeMatch?.id !== state.arenaSurvivor.matchId)) context.addIssue({ code: "custom", path: ["arenaSurvivor"], message: "Arena Survivor state must match the room game and Arcade match." });
  if (state.arcadeGameId === "arena-survivor" && state.phase === "ARCADE_RESULTS" && !ArenaSurvivorResultSchema.safeParse(state.arcadeMatch?.result).success) context.addIssue({ code: "custom", path: ["arcadeMatch", "result"], message: "Completed Arena Survivor matches require a validated result." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "chaos-kommando" && state.phase === "ARCADE_ACTIVE" && !state.chaosKommando) context.addIssue({ code: "custom", path: ["chaosKommando"], message: "An active Chaos-Kommando game requires its typed match state." });
  if (state.chaosKommando && (state.arcadeGameId !== "chaos-kommando" || state.arcadeMatch?.id !== state.chaosKommando.matchId)) context.addIssue({ code: "custom", path: ["chaosKommando"], message: "Chaos-Kommando state must match the room game and Arcade match." });
  if (state.arcadeGameId === "chaos-kommando" && state.phase === "ARCADE_RESULTS" && !ChaosKommandoSchema.safeParse(state.chaosKommando).success) context.addIssue({ code: "custom", path: ["chaosKommando"], message: "Completed Chaos-Kommando matches require all four validated mission results." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "magic-arena" && state.phase === "ARCADE_ACTIVE" && !state.magicArena) context.addIssue({ code: "custom", path: ["magicArena"], message: "An active Magic Arena game requires its typed match state." });
  if (state.magicArena && (state.arcadeGameId !== "magic-arena" || state.arcadeMatch?.id !== state.magicArena.matchId)) context.addIssue({ code: "custom", path: ["magicArena"], message: "Magic Arena state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "magic-arena" && state.phase === "ARCADE_RESULTS") !== Boolean(state.magicArena?.result)) context.addIssue({ code: "custom", path: ["magicArena"], message: "Magic Arena results require its final two-player match result." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "magic-duell" && state.phase === "ARCADE_ACTIVE" && !state.magicDuell) context.addIssue({ code: "custom", path: ["magicDuell"], message: "An active Magic Duell game requires its typed match state." });
  if (state.magicDuell && (state.arcadeGameId !== "magic-duell" || state.arcadeMatch?.id !== state.magicDuell.matchId)) context.addIssue({ code: "custom", path: ["magicDuell"], message: "Magic Duell state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "magic-duell" && state.phase === "ARCADE_RESULTS") !== Boolean(state.magicDuell?.result)) context.addIssue({ code: "custom", path: ["magicDuell"], message: "Magic Duell results require its final duel result." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "minions-td" && state.phase === "ARCADE_ACTIVE" && !state.minionsTd) context.addIssue({ code: "custom", path: ["minionsTd"], message: "An active Minions TD game requires its typed match state." });
  const minionsTd = state.minionsTd as RoomState["minionsTd"];
  if (minionsTd && (state.arcadeGameId !== "minions-td" || state.arcadeMatch?.id !== minionsTd.matchId)) context.addIssue({ code: "custom", path: ["minionsTd"], message: "Minions TD state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "minions-td" && state.phase === "ARCADE_RESULTS") !== Boolean(minionsTd?.result)) context.addIssue({ code: "custom", path: ["minionsTd"], message: "Minions TD results require its final core-health result." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "kartentisch" && state.phase === "ARCADE_ACTIVE" && !state.kartentisch) context.addIssue({ code: "custom", path: ["kartentisch"], message: "An active Kartentisch game requires its typed match state." });
  if (state.kartentisch && (state.arcadeGameId !== "kartentisch" || state.arcadeMatch?.id !== state.kartentisch.matchId)) context.addIssue({ code: "custom", path: ["kartentisch"], message: "Kartentisch state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "kartentisch" && state.phase === "ARCADE_RESULTS") !== Boolean(state.kartentisch?.result)) context.addIssue({ code: "custom", path: ["kartentisch"], message: "Kartentisch results require its final hand reveal." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "dungeon-party" && state.phase === "ARCADE_ACTIVE" && !state.dungeonParty) context.addIssue({ code: "custom", path: ["dungeonParty"], message: "An active Dungeon Party game requires its typed match state." });
  if (state.dungeonParty && (state.arcadeGameId !== "dungeon-party" || state.arcadeMatch?.id !== state.dungeonParty.matchId)) context.addIssue({ code: "custom", path: ["dungeonParty"], message: "Dungeon Party state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "dungeon-party" && state.phase === "ARCADE_RESULTS") !== Boolean(state.dungeonParty?.result)) context.addIssue({ code: "custom", path: ["dungeonParty"], message: "Dungeon Party results require its final encounter reveal." });
  const flatterfluff = state.flatterfluff as RoomState["flatterfluff"];
  if (state.gameLength === "arcade" && state.arcadeGameId === "flatterfluff" && state.phase === "ARCADE_ACTIVE" && !flatterfluff) context.addIssue({ code: "custom", path: ["flatterfluff"], message: "An active Flatterfluff game requires its typed match state." });
  if (flatterfluff && (state.arcadeGameId !== "flatterfluff" || state.arcadeMatch?.id !== flatterfluff.matchId)) context.addIssue({ code: "custom", path: ["flatterfluff"], message: "Flatterfluff state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "flatterfluff" && state.phase === "ARCADE_RESULTS") !== Boolean(flatterfluff?.phase === "complete")) context.addIssue({ code: "custom", path: ["flatterfluff"], message: "Flatterfluff results require its final target wave." });
  const driftRacer = state.driftRacer as RoomState["driftRacer"];
  if (state.gameLength === "arcade" && state.arcadeGameId === "drift-racer" && state.phase === "ARCADE_ACTIVE" && !driftRacer) context.addIssue({ code: "custom", path: ["driftRacer"], message: "An active Drift Racer game requires its typed match state." });
  if (driftRacer && (state.arcadeGameId !== "drift-racer" || state.arcadeMatch?.id !== driftRacer.matchId)) context.addIssue({ code: "custom", path: ["driftRacer"], message: "Drift Racer state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "drift-racer" && state.phase === "ARCADE_RESULTS") !== Boolean(driftRacer?.phase === "results")) context.addIssue({ code: "custom", path: ["driftRacer"], message: "Drift Racer results require its final standings." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "sketch-relay" && state.phase === "ARCADE_ACTIVE" && !state.sketchRelay) context.addIssue({ code: "custom", path: ["sketchRelay"], message: "An active Sketch & Sorcery game requires its match state." });
  if (state.sketchRelay?.fishTest) {
    if (state.gameLength !== "arcade" || state.arcadeGameId !== "sketch-relay" || state.phase !== "LOBBY" || state.status !== "LOBBY" || state.arcadeMatch !== null || state.deadlineAt !== null || state.sketchRelay.phase !== "prompt-writing" || state.sketchRelay.showdown?.version !== 3 || !state.sketchRelay.finale || !isValidSketchRelayMatch(state.sketchRelay)) context.addIssue({ code: "custom", path: ["sketchRelay"], message: "Fish test mode must remain an isolated lobby lifecycle." });
  } else if (state.sketchRelay && (state.arcadeGameId !== "sketch-relay" || state.arcadeMatch?.id !== state.sketchRelay.matchId || (state.phase === "ARCADE_RESULTS") !== (state.sketchRelay.phase === "complete") || (state.phase === "ARCADE_ACTIVE" && !state.paused && state.deadlineAt !== state.sketchRelay.deadline))) context.addIssue({ code: "custom", path: ["sketchRelay"], message: "Sketch & Sorcery state must match its Arcade lifecycle and deadline." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "fish-tank" && ["ARCADE_ACTIVE", "ARCADE_RESULTS"].includes(state.phase) && !state.fishGame) context.addIssue({ code: "custom", path: ["fishGame"], message: "An active Fish Tank match requires its typed state." });
  if (state.fishGame && (state.gameLength !== "arcade" || state.arcadeGameId !== "fish-tank" || state.arcadeMatch?.id !== state.fishGame.matchId || !isValidFishFinale(state.fishGame) || !["ARCADE_ACTIVE", "ARCADE_RESULTS"].includes(state.phase) || (state.phase === "ARCADE_RESULTS") !== (state.arcadeMatch?.status === "COMPLETE"))) context.addIssue({ code: "custom", path: ["fishGame"], message: "Fish Tank state must match its Arcade lifecycle." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "word-tiles" && state.phase === "ARCADE_ACTIVE" && !state.wordTiles) context.addIssue({ code: "custom", path: ["wordTiles"], message: "An active Word Tiles game requires its typed match state." });
  if (state.wordTiles && (state.arcadeGameId !== "word-tiles" || state.arcadeMatch?.id !== state.wordTiles.matchId)) context.addIssue({ code: "custom", path: ["wordTiles"], message: "Word Tiles state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "word-tiles" && state.phase === "ARCADE_RESULTS") !== Boolean(state.wordTiles?.result)) context.addIssue({ code: "custom", path: ["wordTiles"], message: "Word Tiles results require its final round reveal." });
  if (state.gameLength === "arcade" && state.arcadeGameId === "schattenjagd" && state.phase === "ARCADE_ACTIVE" && !state.schattenjagd) context.addIssue({ code: "custom", path: ["schattenjagd"], message: "An active Schattenjagd game requires its typed match state." });
  if (state.schattenjagd && (state.arcadeGameId !== "schattenjagd" || state.arcadeMatch?.id !== state.schattenjagd.matchId)) context.addIssue({ code: "custom", path: ["schattenjagd"], message: "Schattenjagd state must match the room game and Arcade match." });
  if ((state.arcadeGameId === "schattenjagd" && state.phase === "ARCADE_RESULTS") !== Boolean(state.schattenjagd?.result)) context.addIssue({ code: "custom", path: ["schattenjagd"], message: "Schattenjagd results require its final case reveal." });
});

function migrateLegacyState(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const migrated = structuredClone(value) as Record<string, unknown>;
  migrated.serializationVersion ??= ROOM_STATE_SERIALIZATION_VERSION;
  return migrated;
}

export function deserializeRoomState(serialized: string): RoomState {
  const parsed = JSON.parse(serialized) as unknown;
  return hydrateLobbySlots(RoomStatePersistenceSchema.parse(migrateLegacyState(parsed)) as RoomState);
}

export function serializeRoomState(state: RoomState): string {
  return JSON.stringify(RoomStatePersistenceSchema.parse(state));
}
