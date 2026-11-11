import type { SketchRelayMatch } from "./arcade/sketch_relay";
import type { FishFinaleState } from "../lib/arcade/fish-finale";
import type { AvatarConfig, BowlEnvironment, BowlRoundTwo, BowlStroke, BowlTeam, ContentMode, FoolPerformance, FoolPlayMode, FoolTeam, GameLength, ImageModel, JobStatus, MemoryKind, MemoryRelation, Role, RoomPhase, RoundKind, WarTeam } from "../lib/contracts";
import type { ArcadeGameId } from "../lib/arcade/contracts";
import type { SchaetzoramaMatch } from "./arcade/schaetzorama";
import type { ImposterMatch } from "./arcade/imposter";
import type { BuzzwortMatch } from "./arcade/buzzwort";
import type { PantomimeMatch } from "./arcade/pantomime";
import type { DrawGuessMatch } from "./arcade/draw_guess";
import type { ArenaSurvivorMatch } from "./arcade/arena_survivor";
import type { ChaosMatch } from "./arcade/chaos_kommando";
import type { MagicArenaMatch } from "./arcade/magic_arena";
import type { MagicDuellMatch } from "./arcade/magic_duell";
import type { MinionsTdMatch } from "./arcade/minions_td";
import type { KartentischMatch } from "./arcade/kartentisch";
import type { DungeonPartyMatch } from "./arcade/dungeon_party";
import type { FlatterfluffMatch } from "./arcade/flatterfluff";
import type { DriftRacerMatch } from "./arcade/drift_racer";
import type { WordTilesMatch } from "./arcade/word_tiles";
import type { SchattenjagdMatch } from "./arcade/schattenjagd";
import type { CatchModifier } from "../lib/content/library";

export interface ParticipantState {
  id: string;
  nickname: string;
  nicknameNormalized: string;
  role: Exclude<Role, "host" | "display">;
  seat: number;
  /** Stable active-lobby position; independent from immutable historical/D1 seat. */
  lobbySlot?: number;
  avatar: number;
  avatarConfig?: AvatarConfig;
  avatarPreset?: string | null;
  color: string;
  active: boolean;
  pendingActivation: boolean;
  bot?: boolean;
  lastSeenAt: number;
  removedAt: number | null;
}

export interface AnswerState {
  id: string;
  playerId: string;
  text: string;
  hidden: boolean;
  submittedAt: number;
  sourceLoreIds?: string[];
  sourceAnswerId?: string;
}

export interface VoteState {
  voterId: string;
  answerIds: string[];
  audience: boolean;
}

export interface FeedbackVoteState {
  playerId: string;
  pairId: string;
  choiceId: "a" | "b";
  votedAt: number;
  matchNumber: number;
}

export interface ScoreEventState {
  id: string;
  eventKey: string;
  roundId: string;
  playerId: string;
  kind: string;
  points: number;
  detail: Record<string, unknown>;
}

export interface LoreState {
  id: string;
  sourceAnswerId: string;
  sourceAuthorId: string;
  text: string;
  shortMeaning: string;
  kind: MemoryKind;
  originalPrompt: string;
  winner: true;
  quality: number;
  callbackPotential: number;
  visualStrength: number;
  canSpeak: boolean;
  tags: string[];
  safe: boolean;
  used: boolean;
}

export interface MemoryEdgeState {
  id: string;
  fromLoreId: string;
  relation: MemoryRelation;
  toLoreId: string;
  roundId: string;
}

export interface CallbackCandidateState {
  id: string;
  sourceMemoryIds: string[];
  setup: string;
  question: string;
  prompt: string;
  coherence: number;
  answerability: number;
  surprise: number;
  used: boolean;
  sourceRoundId?: string;
  usageCount?: number;
  lastUsedRoundIndex?: number | null;
}

export interface RemixCandidateState extends CallbackCandidateState {
  purpose: "REMIX";
}

export interface ImageState {
  jobId?: string;
  status: JobStatus;
  assetId?: string;
  conceptTitle: string;
  conceptCaption: string;
}

export interface ImageGenerationNotice {
  kind: "RETRYING" | "FAILED";
  failedModel: ImageModel;
  nextModel?: ImageModel;
  updatedAt: number;
  reason?: "ALLOWANCE_STOP";
}

export interface ComicFrameState {
  frameNumber: 1 | 2 | 3;
  roundId: string;
  answerId: string;
  authorId: string;
  prompt: string;
  image: ImageState;
}

export interface KingMysteryDecoyState {
  id: string;
  playerId: string;
  text: string;
  submittedAt: number;
  sealed: boolean;
}

export interface KingMysteryResultState {
  realChoiceId: string;
  originalRequest: string;
  originalAuthorId: string;
  votes: Record<string, string>;
  choiceAuthors: Record<string, string | null>;
  correctPlayerIds: string[];
  fooledByChoice: Record<string, string[]>;
  sealedChoiceIds: string[];
}

export interface RoyalRumourGuessState {
  id: string;
  playerId: string;
  sourceAnswerId: string;
  text: string;
  submittedAt: number;
}

export interface FoolScrollState { id: string; playerId: string; text: string; submittedAt: number }
export interface FoolStrokeState { id: string; playerId: string; points: Array<{ x: number; y: number }> }
export interface FoolUndoState { team: FoolTeam; scrollId: string; roundNumber: 1 | 2 | 3; previousPhase: RoomPhase }

export interface RoundState {
  id: string;
  index: number;
  kind: RoundKind;
  label: string;
  promptId: string;
  prompt: string;
  instruction: string | null;
  catchModifier: CatchModifier | null;
  choiceOptions: Array<{ id: string; label: string }>;
  callbackSourceLoreIds: string[];
  startedAt: number;
  answers: AnswerState[];
  votes: VoteState[];
  personalChoices: Record<string, string>;
  kingPollEvents: Array<{ playerId: string; choiceId: string; votedAt: number }>;
  predictions: Record<string, number[]>;
  authorAssignments: Record<string, string[]>;
  authorGuesses: Record<string, Record<string, string>>;
  authorGuessesScored: boolean;
  authorGuessResults: Record<string, number>;
  wagers: Record<string, { targetPlayerId: string; wager: 100 | 250 | 500 }>;
  voteStage: "PROMPT" | "IMAGE" | "FINAL" | null;
  scored: boolean;
  results: Record<string, unknown> | null;
  image: ImageState | null;
  featuredAnswerId: string | null;
  developerScoreCap: number | null;
  kingMysteryOrder: string[];
  kingMysteryIndex: number;
  /** Private per-turn mapping from internal answer/decoy IDs to public ballot IDs. */
  kingMysteryPublicIds?: Record<string, { turnId: string; choices: Record<string, string> }>;
  kingMysteryDecoys: Record<string, KingMysteryDecoyState[]>;
  kingMysterySealUsedByPlayer: Record<string, string>;
  kingMysteryVotes: Record<string, Record<string, string>>;
  kingMysteryResults: Record<string, KingMysteryResultState>;
  royalRumourAssignments: Record<string, string>;
  royalRumourGuesses: Record<string, RoyalRumourGuessState>;
  royalRumourRevealOrder: string[];
  royalRumourRevealIndex: number;
  warRankings: Record<string, string[]>;
  warTrueOrder: string[];
  warTargetRanks: number[];
  warPlacements: Record<string, number>;
  warClues: Array<{ choiceId: string; guessedRank: number; direction: "EARLIER" | "LATER"; team: WarTeam; scout?: boolean }>;
  warTurnTeam: WarTeam;
  warTurnNumber: number;
  warMaxTurns: number;
  warLastMove: null | { playerId: string; team: WarTeam; choiceId: string | null; guessedRank: number | null; correct: boolean; actualRank?: number; skipped?: boolean };
  foolScrolls: FoolScrollState[];
  foolRoundNumber: 1 | 2 | 3;
  foolPool: string[];
  foolTurnTeam: FoolTeam;
  foolClueGiverId: string | null;
  foolTeamTurns: Record<FoolTeam, number>;
  foolPassUsed: boolean;
  foolCurrentScrollId: string | null;
  foolOneWord: string | null;
  foolSpokenClue: string | null;
  foolPerformanceCue: string | null;
  foolBotClueAt: number | null;
  foolStrokes: FoolStrokeState[];
  foolLastResult: null | { team: FoolTeam; correct: boolean };
  foolSuddenDeath: boolean;
  foolUndo: FoolUndoState | null;
}

export interface BowlScrollState { id: string; authorId: string; text: string }
export interface BowlUndoState {
  bowl: Omit<BowlState, "undo">;
  phase: RoomPhase;
  status: RoomState["status"];
  phaseStartedAt: number;
  deadlineAt: number | null;
  roundIndex: number;
  currentRound: RoundState | null;
  scoreEventKey: string;
  scoringPlayerId: string;
}
export interface BowlState {
  environment: BowlEnvironment;
  roundTwo: BowlRoundTwo;
  scrollsPerPlayer: number;
  builtInVoice: boolean;
  openingTutorial: boolean;
  teams: Record<string, BowlTeam>;
  submissions: Record<string, string[]>;
  scrolls: BowlScrollState[];
  remainingIds: string[];
  activeScrollId: string | null;
  activeTeam: BowlTeam | null;
  clueGiverId: string | null;
  teamOrders: Record<BowlTeam, string[]>;
  clueIndexes: Record<BowlTeam, number>;
  passUsed: boolean;
  scores: Record<BowlTeam, number>;
  roundNumber: number;
  lastEmptyingTeam: BowlTeam | null;
  drawing: BowlStroke[];
  clueWord: string | null;
  suddenDeath: boolean;
  suddenDeathOccurred: boolean;
  suddenDeathScrollId: string | null;
  winnerTeam: BowlTeam | null;
  undo: BowlUndoState | null;
}

export interface RoomState {
  serializationVersion: 1;
  id: string;
  code: string;
  version: number;
  phase: RoomPhase;
  phaseStartedAt: number;
  deadlineAt: number | null;
  paused: boolean;
  remainingMs: number | null;
  joiningLocked: boolean;
  gameLength: GameLength;
  arcadeGameId: ArcadeGameId | null;
  arcadeMatch: ArcadeMatchState | null;
  schaetzorama: SchaetzoramaMatch | null;
  imposter: ImposterMatch | null;
  buzzwort: BuzzwortMatch | null;
  pantomime: PantomimeMatch | null;
  drawGuess: DrawGuessMatch | null;
  arenaSurvivor: ArenaSurvivorMatch | null;
  chaosKommando: ChaosMatch | null;
  magicArena: MagicArenaMatch | null;
  magicDuell: MagicDuellMatch | null;
  minionsTd: MinionsTdMatch | null;
  kartentisch: KartentischMatch | null;
  dungeonParty: DungeonPartyMatch | null;
  flatterfluff: FlatterfluffMatch | null;
  driftRacer: DriftRacerMatch | null;
  wordTiles: WordTilesMatch | null;
  sketchRelay: SketchRelayMatch | null;
  fishGame: FishFinaleState | null;
  schattenjagd: SchattenjagdMatch | null;
  contentMode: ContentMode;
  timerAccessibility: boolean;
  sorceryLength?: "quick" | "long";
  sorceryHostProfileHash?: string;
  soloMode: boolean;
  soloLiveImages: boolean;
  imageModel: ImageModel;
  imageGenerationNotice: ImageGenerationNotice | null;
  developerMode: boolean;
  bowl: BowlState | null;
  soloPlayerId: string | null;
  foolHostPlayerId: string | null;
  birthdayName: string | null;
  birthdayPersonId: string | null;
  status: "LOBBY" | "ACTIVE" | "COMPLETE" | "ENDED";
  matchNumber: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  /** Lobby preferences for physical player seats that should be filled by bots whenever empty. */
  botSeats: number[];
  participants: ParticipantState[];
  roundPlan: Array<{ kind: RoundKind; label: string }>;
  roundIndex: number;
  currentRound: RoundState | null;
  promptHistory: string[];
  answerHistory: AnswerState[];
  lore: LoreState[];
  memoryEdges: MemoryEdgeState[];
  primaryMemoryIds: Partial<Record<MemoryKind, string>>;
  callbackCandidates: CallbackCandidateState[];
  remixCandidates: RemixCandidateState[];
  anchorImage: ImageState | null;
  finalImage: ImageState | null;
  kingImages: Record<string, ImageState>;
  kingFinalists: string[];
  kingRounds: RoundState[];
  kingRoundTwoRequestId: string | null;
  kingRestorationBase: string | null;
  kingRestorationAssignments: Record<string, string>;
  comicTheme: string | null;
  comicFrames: ComicFrameState[];
  feedbackVotes: FeedbackVoteState[];
  feedbackTallies: Record<string, { a: number; b: number }>;
  scoreEvents: ScoreEventState[];
  encoreScoreEvents: ScoreEventState[];
  awards: Array<{ title: string; playerIds: string[]; caption: string }>;
  roomLore: string[];
  warCampaign: "ATTACK" | "DEFEND";
  warTeams: Record<string, WarTeam>;
  warTeamScores: Record<WarTeam, number>;
  warScoutUsed: Record<WarTeam, boolean>;
  foolPlayMode: FoolPlayMode;
  foolPerformance: FoolPerformance;
  foolScrollsPerPlayer: number;
  foolVoiceEnabled: boolean;
  foolTeams: Record<string, FoolTeam>;
  foolReadyPlayerIds: string[];
  foolTeamScores: Record<FoolTeam, number>;
  foolWinner: FoolTeam | null;
  actionCount: number;
}

export interface ArcadeMatchState {
  id: string;
  gameId: ArcadeGameId;
  matchNumber: number;
  status: "ACTIVE" | "COMPLETE";
  startedAt: number;
  endedAt: number | null;
  result: Record<string, unknown> | null;
  /** Controller seats are fixed for real-time matches, even if a participant is later removed. */
  controllerIds?: string[];
}

export interface ArcadeEventState {
  eventId: string;
  matchId: string;
  type: "goal" | "result";
  playerId: string | null;
  points: number;
  occurredAt: number;
  payload?: Record<string, unknown>;
}

export type DbEffect =
  | { type: "answer"; answer: AnswerState; roundId: string }
  | { type: "hide_answer"; answerId: string }
  | { type: "vote"; roundId: string; voterId: string; answerId: string; rank: number; weight: number; audience: boolean }
  | { type: "prediction"; roundId: string; playerId: string; kind: string; payload: unknown }
  | { type: "feedback_vote"; eventKey: string; pairId: string; choiceId: "a" | "b" }
  | { type: "score"; event: ScoreEventState }
  | { type: "lore"; lore: LoreState; roundId: string }
  | { type: "lore_update"; lore: LoreState }
  | { type: "memory_edge"; edge: MemoryEdgeState }
  | { type: "callback"; callback: CallbackCandidateState; roundId: string; sourceAuthorId?: string }
  | { type: "round"; round: RoundState }
  | { type: "arcade_match"; match: ArcadeMatchState }
  | { type: "arcade_finalize"; match: ArcadeMatchState; event: ArcadeEventState }
  | { type: "job"; id: string; roundId: string; kind: string; promptHash: string; prompt: unknown; now: number }
  | { type: "sketch_source"; kind?: "FISH_UPLOAD"; id: string; roundId: string; promptHash: string; prompt: unknown; objectKey: string; byteSize: number; now: number }
  | { type: "sketch_job_complete"; id: string; leaseOwner: string; status: "READY" | "FALLBACK"; objectKey?: string; contentType?: string; byteSize?: number; errorCode?: string; now: number }
  | { type: "participant_add"; participant: ParticipantState; tokenHash: string }
  | { type: "participant_state"; participant: ParticipantState };
