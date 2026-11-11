import { createHash } from "node:crypto";
import { submitShowdownAction } from "./arcade/sketch_showdown";
import { advanceSketchRelay, replaySketchRelayReveal, canAdvanceSketchRelay, createSketchRelayMatch, selectSketchPrompt, submitSketchCaption, submitSketchApplause, syncSketchRelayRoom } from "./arcade/sketch_relay";
import { PlayerActionSchema, type FoolTeam, type HostAction, type MemoryKind, type MemoryRelation, type PlayerAction, type RoomPhase, type WarTeam } from "../lib/contracts";
import type { ArcadeGameId } from "../lib/arcade/contracts";
import { birthdayChoiceQuestion, birthdayCreativePrompt } from "../lib/content/birthday";
import { CATCH_MODIFIERS, MONSTER_COMPONENTS, MONSTER_FOLLOWUPS, pickPrompt } from "../lib/content/library";
import { FEEDBACK_COOLDOWN_MS, FEEDBACK_PAIRS, FEEDBACK_REWARD_POINTS, feedbackDeckForPlayer, feedbackPair, leadingComedyTastes } from "../lib/content/feedback";
import type { FeedbackPurpose } from "../lib/content/feedback";
import { comicPrompt, comicTheme } from "../lib/content/comics";
import { drawKingRequests, kingRequestById } from "../lib/content/king-prompter";
import { campaignForMatch, warScenario } from "../lib/content/royal-war-room";
import { restorationBase, restorationLayout } from "../lib/game/restoration-layouts";
import { NON_INTERACTIVE_SECONDS, ROUND_PLANS, SCORE_CAPS, phaseDurationMs } from "../lib/game/config";
import { creativeScore, distributionPredictionScore, maximumPossibleApplause, readTheRoomScore, winnersFromTotals } from "../lib/game/scoring";
import { deterministicShuffle, makeId, randomUuid, stableHash } from "../lib/game/random";
import type { FishFinaleAction } from "../lib/arcade/fish-finale";
import { applyFishFinaleAction, createFishFinale } from "./arcade/fish_finale";
import { validateAnswer, validateCatch } from "../lib/game/validators";
import { createLobbyBot, runBotTurns } from "./bots";
import { chooseLobbySlot } from "./participant-seats";
import { promptHash } from "./crypto";
import type { AnswerState, DbEffect, LoreState, RoomState, RoundState, ScoreEventState } from "./types";
import { advanceBowlState, applyBowlHostAction, applyBowlPlayerAction, createBowlState, rebalanceBowlTeams, startBowlGame } from "./bowl";
import { createArcadeMatch } from "./arcade/room";
import { selectArcadeControllerIds } from "./arcade/tickets";
import { arcadeBotAction } from "./arcade/bot-turns";
import { advanceSchaetzorama, createSchaetzoramaMatch, getSchaetzoramaResult, submitSchaetzoramaEstimate } from "./arcade/schaetzorama";
import { advanceImposter, createImposterMatch, getImposterResult, submitImposterClue, submitImposterVote } from "./arcade/imposter";
import { advanceBuzzwort, createBuzzwortMatch, getBuzzwortResult, submitBuzzwortClue, submitBuzzwortGuess } from "./arcade/buzzwort";
import { advancePantomime, createPantomimeMatch, getPantomimeResult, revealPantomime, submitPantomimeGuess } from "./arcade/pantomime";
import { advanceDrawGuess, createDrawGuessMatch, getDrawGuessResult, revealDrawGuess, submitDrawGuess, submitDrawGuessDrawing } from "./arcade/draw_guess";
import { advanceArenaSurvivor, chooseArenaSurvivor, createArenaSurvivorMatch, getArenaSurvivorResult, revealArenaSurvivor } from "./arcade/arena_survivor";
import { advanceChaosMission, chooseChaosTool, createChaosMatch, finishChaosMatch, nextChaosMission } from "./arcade/chaos_kommando";
import { advanceMagicArenaRound, chooseMagicArenaAction, createMagicArenaMatch, revealMagicArenaRound } from "./arcade/magic_arena";
import { advanceMagicDuellRound, beginMagicDuell, chooseMagicDuellCast, chooseMagicDuellLoadout, createMagicDuellMatch, revealMagicDuellRound } from "./arcade/magic_duell";
import { advanceMinionsTdRound, createMinionsTdMatch, resolveMinionsTdRound, submitMinionsTdOrder } from "./arcade/minions_td";
import { advanceKartentischTrick, chooseKartentischCard, createKartentischMatch, revealKartentischTrick } from "./arcade/kartentisch";
import { chooseDungeonPartyAction, createDungeonPartyMatch, nextDungeonPartyEncounter, revealDungeonPartyEncounter } from "./arcade/dungeon_party";
import { advanceFlatterfluffRound, createFlatterfluffMatch, fireFlatterfluffShot, getFlatterfluffResult, nextFlatterfluffRound, revealFlatterfluffRound } from "./arcade/flatterfluff";
import { advanceDriftRacer, createDriftRacerMatch, getDriftRacerResult, submitDriftRacerInput } from "./arcade/drift_racer";
import { chooseWordTilesWord, createWordTilesMatch, nextWordTilesRound, revealWordTilesRound } from "./arcade/word_tiles";
import { chooseSchattenjagdSuspect, createSchattenjagdMatch, nextSchattenjagdCase, revealSchattenjagdCase } from "./arcade/schattenjagd";

const clone = <T>(value: T): T => structuredClone(value);
const nowPlus = (now: number, milliseconds: number) => now + milliseconds;
const ARCADE_SYNC_TIMEOUT_RECOVERY_MS = 2_000;

export function createRoomState(code: string, options: { gameLength: RoomState["gameLength"]; arcadeGameId?: ArcadeGameId; contentMode: RoomState["contentMode"]; timerAccessibility: boolean; sorceryLength?: "quick" | "long"; birthdayName?: string; soloMode?: boolean; soloLiveImages?: boolean; imageModel?: RoomState["imageModel"]; developerMode?: boolean; feedbackTallies?: RoomState["feedbackTallies"]; foolPlayMode?: RoomState["foolPlayMode"]; foolPerformance?: RoomState["foolPerformance"]; foolScrollsPerPlayer?: number; foolVoiceEnabled?: boolean; playEnvironment?: "same_table" | "remote_live"; bowlRoundTwo?: "drawing" | "charades"; scrollsPerPlayer?: number; builtInVoice?: boolean; openingTutorial?: boolean }, now = Date.now()): RoomState {
  if (options.gameLength === "arcade" && !options.arcadeGameId) throw new Error("ARCADE_GAME_REQUIRED");
  if (options.gameLength !== "arcade" && options.arcadeGameId) throw new Error("ARCADE_GAME_MISMATCH");
  return {
    serializationVersion: 1, id: makeId("room"), code, version: 1, phase: "LOBBY", phaseStartedAt: now, deadlineAt: null,
    paused: false, remainingMs: null, joiningLocked: false, gameLength: options.gameLength, arcadeGameId: options.arcadeGameId ?? null, arcadeMatch: null, schaetzorama: null, imposter: null, buzzwort: null, pantomime: null, drawGuess: null, arenaSurvivor: null, chaosKommando: null, magicArena: null, magicDuell: null, minionsTd: null, kartentisch: null, dungeonParty: null, flatterfluff: null, driftRacer: null, wordTiles: null, sketchRelay: null, fishGame: null, schattenjagd: null, contentMode: options.contentMode,
    timerAccessibility: options.timerAccessibility, sorceryLength: options.sorceryLength ?? "long", soloMode: options.soloMode ?? false, soloLiveImages: options.soloLiveImages ?? false, imageModel: options.imageModel ?? "flux-1-schnell", imageGenerationNotice: null, developerMode: options.developerMode ?? false, soloPlayerId: null,
    bowl: options.gameLength === "bowl" ? createBowlState(options) : null,
    foolHostPlayerId: null,
    birthdayName: options.gameLength === "birthday" ? options.birthdayName?.trim() || "Birthday Legend" : null,
    birthdayPersonId: null, status: "LOBBY", matchNumber: 1,
    createdAt: now, updatedAt: now, expiresAt: nowPlus(now, 2 * 60 * 60 * 1000), botSeats: [], participants: [],
    roundPlan: clone(ROUND_PLANS[options.gameLength]), roundIndex: -1, currentRound: null, promptHistory: [],
    answerHistory: [], lore: [], memoryEdges: [], primaryMemoryIds: {}, callbackCandidates: [], remixCandidates: [], anchorImage: null, finalImage: null,
    kingImages: {}, kingFinalists: [], kingRounds: [], kingRoundTwoRequestId: null, kingRestorationBase: null, kingRestorationAssignments: {}, comicTheme: null, comicFrames: [], feedbackVotes: [], feedbackTallies: options.feedbackTallies ?? {},
    scoreEvents: [], encoreScoreEvents: [], awards: [], roomLore: [], warCampaign: campaignForMatch(1), warTeams: {}, warTeamScores: { LION: 0, RAVEN: 0 }, warScoutUsed: { LION: false, RAVEN: false },
    foolPlayMode: options.foolPlayMode ?? "SAME_TABLE", foolPerformance: options.foolPerformance ?? "DRAWING", foolScrollsPerPlayer: options.foolScrollsPerPlayer ?? 3, foolVoiceEnabled: options.foolVoiceEnabled ?? true,
    foolTeams: {}, foolReadyPlayerIds: [], foolTeamScores: { BELLS: 0, MOTLEY: 0 }, foolWinner: null, actionCount: 0,
  };
}

export const scoringPlayers = (state: RoomState) => state.participants.filter((participant) => participant.role === "player" && participant.active && !participant.removedAt);
export const audienceMembers = (state: RoomState) => state.participants.filter((participant) => participant.role === "audience" && !participant.removedAt);

const BOT_SUPPORTED_PACKS = new Set<RoomState["gameLength"]>(["standard", "pictures", "comic", "king-mystery", "royal-rumours", "bowl-of-fools"]);
export const NATIVE_ARCADE_BOT_GAMES = new Set<NonNullable<RoomState["arcadeGameId"]>>(["arena-survivor", "buzzwort", "chaos-kommando", "drift-racer", "flatterfluff", "kartentisch", "magic-arena", "magic-duell", "minions-td", "zeichnen-und-erraten", "imposter", "pantomime", "schaetzorama", "schattenjagd", "dungeon-party", "word-tiles", "sketch-relay"]);
export const supportsLobbyBots = (state: { gameLength: RoomState["gameLength"]; arcadeGameId?: RoomState["arcadeGameId"] }) => BOT_SUPPORTED_PACKS.has(state.gameLength) || (state.gameLength === "arcade" && Boolean(state.arcadeGameId && NATIVE_ARCADE_BOT_GAMES.has(state.arcadeGameId)));

function reconcileBotSeat(state: RoomState, seat: number, effects: DbEffect[], now: number): void {
  const occupant = state.participants.find((participant) => participant.role === "player" && participant.lobbySlot === seat && !participant.removedAt);
  const desired = state.botSeats.includes(seat);
  if (!desired && occupant?.bot) {
    occupant.active = false;
    occupant.removedAt = now;
    effects.push({ type: "participant_state", participant: occupant });
  } else if (desired && !occupant && supportsLobbyBots(state)) {
    const bot = createLobbyBot(state, now, seat);
    state.participants.push(bot.participant);
    effects.push({ type: "participant_add", ...bot });
  }
}
export function scoreTotals(state: RoomState): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const player of state.participants.filter((participant) => participant.role === "player")) totals[player.id] = 0;
  for (const event of state.scoreEvents) totals[event.playerId] = (totals[event.playerId] ?? 0) + event.points;
  return totals;
}

function setPhase(state: RoomState, phase: RoomPhase, now: number, customDurationMs?: number): void {
  state.phase = phase;
  state.phaseStartedAt = now;
  const duration = customDurationMs ?? phaseDurationMs(state.gameLength, phase, state.timerAccessibility);
  state.deadlineAt = duration > 0 ? nowPlus(now, duration) : null;
}

function buildAssignments(state: RoomState, round: RoundState): void {
  if (round.kind !== "WHO_SAID_THAT") return;
  const pool = state.answerHistory.filter((answer) => !answer.hidden);
  const perPlayer = scoringPlayers(state).length <= 3 ? 2 : 3;
  for (const player of scoringPlayers(state)) {
    const eligible = pool.filter((answer) => answer.playerId !== player.id);
    round.authorAssignments[player.id] = deterministicShuffle(eligible, `${state.code}:${round.id}:${player.id}:authors`).slice(0, perPlayer).map((answer) => answer.id);
  }
}

function buildImageAuthorAssignments(state: RoomState, round: RoundState): void {
  if (!["PROMPT_AND_CIRCUMSTANCE", "COMIC_FRAME"].includes(round.kind)) return;
  const answerIds = round.answers.filter((answer) => !answer.hidden).map((answer) => answer.id);
  for (const player of scoringPlayers(state)) {
    round.authorAssignments[player.id] = deterministicShuffle(answerIds, `${state.code}:${round.id}:${player.id}:prompt-authors`);
  }
}

const memoryKindForRound = (kind: RoundState["kind"]): MemoryKind | null => ({
  THE_SEED: "ANCHOR", MAKE_IT_REAL: "VOICE", THE_CATCH: "WORLD", CALLBACK: "CONSEQUENCE",
} as Partial<Record<RoundState["kind"], MemoryKind>>)[kind] ?? null;

function primaryMemory(state: RoomState, kind: MemoryKind): LoreState | null {
  const id = state.primaryMemoryIds[kind];
  return state.lore.find((item) => item.id === id && item.safe) ?? state.lore.find((item) => item.kind === kind && item.safe) ?? null;
}

function voicePrompt(state: RoomState): string {
  const anchor = primaryMemory(state, "ANCHOR");
  if (!anchor) return "The room's winning invention just got a marketing budget. What's its slogan?";
  return `${anchor.text} has been hired for a wildly inappropriate advertising campaign. What's the slogan?`;
}

export function fallbackCallbackPrompt(state: RoomState): string {
  const anchor = primaryMemory(state, "ANCHOR")?.text ?? "tonight's strangest invention";
  const voice = primaryMemory(state, "VOICE")?.text;
  const world = primaryMemory(state, "WORLD")?.text;
  const setup = voice && world
    ? `After campaigning on “${voice},” ${anchor} is put in charge of enforcing this new rule: “${world}.”`
    : world ? `${anchor} is suddenly put in charge of enforcing this new rule: “${world}.”`
      : voice ? `${anchor} becomes famous for saying “${voice}” and is given far too much authority.`
        : `${anchor} is given a budget, a uniform, and absolutely no supervision.`;
  return `${setup} What goes wrong on day one?`;
}

export function fallbackRemixPrompt(_state: RoomState): string {
  void _state;
  return "Write the final headline for the story your room built tonight.";
}

function feedbackStrength(state: RoomState, pairId: string, choiceId: "a" | "b"): number {
  const inherited = state.feedbackTallies?.[pairId]?.[choiceId] ?? 0;
  return inherited + (state.feedbackVotes ?? []).filter((vote) => vote.pairId === pairId && vote.choiceId === choiceId).length;
}

function preferredFeedbackOption(state: RoomState, purpose: FeedbackPurpose, seed: string, usedIds: readonly string[] = []) {
  const candidates = FEEDBACK_PAIRS.filter((pair) => pair.purpose === purpose).flatMap((pair) => pair.options.map((option) => ({
    id: `${pair.id}-${option.id}`, text: option.text, votes: feedbackStrength(state, pair.id, option.id), tastes: option.tastes,
  })));
  const fresh = candidates.filter((candidate) => !usedIds.includes(candidate.id));
  const pool = fresh.length ? fresh : candidates;
  return [...pool].sort((left, right) => {
    const leftScore = left.votes * 10_000 + stableHash(`${seed}:${left.id}`) % 10_000;
    const rightScore = right.votes * 10_000 + stableHash(`${seed}:${right.id}`) % 10_000;
    return rightScore - leftScore;
  })[0];
}
function setupRound(state: RoomState, index: number, now: number, encore = false): RoundState {
  const plan = encore ? { kind: "MONSTER_FACTORY" as const, label: "Monster Factory" } : state.roundPlan[index];
  const gameSeed = `${state.id}:match-${state.matchNumber}:${index}`;
  const birthdayQuestion = !encore && plan.kind === "BIRTHDAY_BETS" ? birthdayChoiceQuestion(gameSeed, state.promptHistory) : null;
  const war = !encore && plan.kind === "ROYAL_WAR_ROOM" ? warScenario(state.warCampaign, (index + 1) as 1 | 2 | 3, state.id, state.matchNumber) : null;
  const birthdayPrompt = !encore && state.gameLength === "birthday" && ["FIRST_IMPRESSIONS", "THE_CATCH", "CROWD_CONTROL", "FINAL_READ"].includes(plan.kind)
    ? birthdayCreativePrompt(plan.kind as "FIRST_IMPRESSIONS" | "THE_CATCH" | "CROWD_CONTROL" | "FINAL_READ", state.birthdayName ?? "the birthday legend", gameSeed, state.promptHistory)
    : null;
  const promptEntry = birthdayQuestion
    ? { id: birthdayQuestion.id, text: birthdayQuestion.prompt(state.birthdayName ?? "The birthday legend"), contentMode: "family" as const, category: "birthday-choice", localeDependent: false, weight: 1, recentUseSuppression: 12 }
    : birthdayPrompt
      ? { ...birthdayPrompt, contentMode: "family" as const, category: "birthday", localeDependent: false, weight: 1, recentUseSuppression: 8 }
      : encore
    ? { id: "monster-components", text: "Build one impossible creature together.", contentMode: "family" as const, category: "encore", localeDependent: false, weight: 1, recentUseSuppression: 0 }
    : plan.kind === "KING_PROMPTER_FINAL"
      ? { id: "royal-restoration", text: "Restore the King’s torn royal portrait.", contentMode: "family" as const, category: "king-prompter", localeDependent: false, weight: 1, recentUseSuppression: 0 }
      : plan.kind === "COMIC_FRAME"
        ? { id: `comic-frame-${index + 1}`, text: "Build the next panel of the room's comic.", contentMode: "party" as const, category: "comic", localeDependent: false, weight: 1, recentUseSuppression: 0 }
      : plan.kind === "KING_REQUEST_MYSTERY"
        ? { id: "royal-frame-up", text: "File a ridiculous incident report from somewhere inside the royal castle.", contentMode: "party" as const, category: "king-mystery", localeDependent: false, weight: 1, recentUseSuppression: 0 }
      : plan.kind === "ROYAL_RUMOURS"
        ? { id: "royal-rumours", text: "Start one ridiculous rumour that can be pictured.", contentMode: "party" as const, category: "royal-rumours", localeDependent: false, weight: 1, recentUseSuppression: 0 }
      : plan.kind === "ROYAL_WAR_ROOM" && war
        ? { id: war.id, text: war.prompt, contentMode: "party" as const, category: "royal-war-room", localeDependent: false, weight: 1, recentUseSuppression: 3 }
      : plan.kind === "BOWL_OF_FOOLS"
        ? { id: "bowl-of-fools", text: "Fill the royal bowl with memorable fools, places, objects, and phrases.", contentMode: "party" as const, category: "bowl-of-fools", localeDependent: false, weight: 1, recentUseSuppression: 0 }
      : pickPrompt(plan.kind, gameSeed, state.contentMode, state.promptHistory);
  const callbackLore = ["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"].flatMap((kind) => {
    const item = primaryMemory(state, kind as MemoryKind); return item ? [item] : [];
  }).slice(0, plan.kind === "THE_REMIX" ? 4 : 3);
  let prompt = promptEntry.text;
  let instruction = plan.kind === "PROMPT_AND_CIRCUMSTANCE" ? "Under 20 words: character, place, visual problem." : plan.kind === "KING_PROMPTER_FINAL" ? "Both canvas winners stay visible. Choose one favorite; you still cannot vote for your own image." : plan.kind === "COMIC_FRAME" ? comicPrompt((index + 1) as 1 | 2 | 3, comicTheme(`${state.id}:comic-theme`, state.matchNumber - 1), state.comicFrames.map((frame) => frame.prompt)).instruction : null;
  const catchModifier = plan.kind === "THE_CATCH" ? CATCH_MODIFIERS[(stableHash(`${state.id}:${index}:catch`) + state.matchNumber - 1) % CATCH_MODIFIERS.length] : null;
  if (plan.kind === "PROMPT_AND_CIRCUMSTANCE") {
    if (index === 0) {
      const requests = drawKingRequests(gameSeed, state.promptHistory, 4);
      const request = requests[0];
      promptEntry.id = request.id;
      prompt = `The King requests: ${request.text}.`;
      promptEntry.text = request.text;
      state.kingRoundTwoRequestId = null;
    } else {
      const request = state.kingRoundTwoRequestId ? kingRequestById(state.kingRoundTwoRequestId) : null;
      const fallback = drawKingRequests(`${gameSeed}:fallback`, state.promptHistory, 1)[0];
      const selected = request ?? fallback;
      promptEntry.id = selected.id;
      promptEntry.text = selected.text;
      prompt = `The King requests: ${selected.text}.`;
    }
  } else if (plan.kind === "KING_PROMPTER_FINAL") {
    prompt = "The King found one last portrait—ripped to pieces. Describe what your Royal Squire should restore inside your assigned missing section.";
  } else if (plan.kind === "KING_REQUEST_MYSTERY") {
    prompt = "What ridiculous incident happened somewhere inside the royal castle?";
    instruction = "Under 18 words. Name a subject, a strange action, and one vivid clue for the enchanted evidence frame.";
  } else if (plan.kind === "ROYAL_RUMOURS") {
    prompt = "Start a ridiculous royal rumour.";
    instruction = "Under 18 words. Make it visual: a clear subject, action, and strange detail.";
  } else if (plan.kind === "ROYAL_WAR_ROOM" && war) {
    prompt = war.prompt;
    instruction = index === 0 ? "Secretly rank every order. The councils will uncover only the room’s top three priorities." : index === 1 ? "Secretly rank the complete plan. The councils must reconstruct all six positions." : "Secretly rank the plan. The final battle uncovers the outside positions first, then closes toward the middle.";
  } else if (plan.kind === "BOWL_OF_FOOLS") {
    prompt = "Write your secret scrolls for the Bowl of Fools.";
    instruction = `${state.foolScrollsPerPlayer} scrolls each · 1–5 words per scroll · authors stay secret forever.`;
  } else if (plan.kind === "COMIC_FRAME") {
    const theme = comicTheme(`${state.id}:comic-theme`, state.matchNumber - 1);
    state.comicTheme ??= `${theme.title}: ${theme.setup}`;
    const comic = comicPrompt((index + 1) as 1 | 2 | 3, theme, state.comicFrames.map((frame) => frame.prompt));
    prompt = comic.prompt;
    const direction = index === 1 ? preferredFeedbackOption(state, "COMIC_ESCALATION", `${gameSeed}:comic-direction`) : index === 2 ? preferredFeedbackOption(state, "COMIC_PUNCHLINE", `${gameSeed}:comic-direction`) : null;
    instruction = direction && feedbackStrength(state, direction.id.slice(0, -2), direction.id.endsWith("-a") ? "a" : "b") > 0 ? `${comic.instruction} Room vote: ${direction.text}.` : comic.instruction;
  }
  if (plan.kind === "CALLBACK") {
    prompt = fallbackCallbackPrompt(state);
    const stakes = preferredFeedbackOption(state, "STANDARD_STAKES", `${gameSeed}:stakes`);
    if (stakes && feedbackStrength(state, stakes.id.slice(0, -2), stakes.id.endsWith("-a") ? "a" : "b") > 0) instruction = `Room direction: ${stakes.text}.`;
  } else if (plan.kind === "MAKE_IT_REAL") {
    prompt = voicePrompt(state);
  } else if (plan.kind === "THE_CATCH" && state.gameLength === "standard") {
    const anchor = primaryMemory(state, "ANCHOR")?.text ?? "tonight's winning creation";
    const setting = preferredFeedbackOption(state, "STANDARD_SETTING", `${gameSeed}:setting`);
    prompt = `${anchor} has changed daily life. Write the one ridiculous rule everyone must now obey.`;
    if (setting && feedbackStrength(state, setting.id.slice(0, -2), setting.id.endsWith("-a") ? "a" : "b") > 0) instruction = `${catchModifier?.instruction ?? "Keep it concise."} Set it in ${setting.text.toLocaleLowerCase()}.`;
  } else if (plan.kind === "THE_REMIX") {
    prompt = fallbackRemixPrompt(state);
    const tone = preferredFeedbackOption(state, "STANDARD_TONE", `${gameSeed}:tone`);
    instruction = `Use the Hero, Motto, Rule, and Disaster shown below.${tone && feedbackStrength(state, tone.id.slice(0, -2), tone.id.endsWith("-a") ? "a" : "b") > 0 ? ` Aim for ${tone.text.toLocaleLowerCase()}.` : ""}`;
  } else if (state.gameLength === "birthday" && ["FIRST_IMPRESSIONS", "THE_CATCH", "CROWD_CONTROL", "FINAL_READ"].includes(plan.kind)) {
    const purpose: FeedbackPurpose = plan.kind === "FINAL_READ" ? "BIRTHDAY_FINALE" : "BIRTHDAY_SPOTLIGHT";
    const direction = preferredFeedbackOption(state, purpose, `${gameSeed}:birthday-direction`);
    if (direction && feedbackStrength(state, direction.id.slice(0, -2), direction.id.endsWith("-a") ? "a" : "b") > 0) instruction = `Room direction: ${direction.text}.`;
  }
  const round: RoundState = {
    id: makeId(encore ? "encore" : "round"), index, kind: plan.kind, label: plan.label, promptId: promptEntry.id, prompt,
    instruction: plan.kind === "PROMPT_AND_CIRCUMSTANCE" ? "Under 20 words. Describe one original, funny picture for your highly trained, completely human Royal Squire." : plan.kind === "KING_PROMPTER_FINAL" ? "Under 20 words. Your square image will sit beneath a reusable torn-paper mask and be fitted around the unchanged King." : instruction ?? catchModifier?.instruction ?? null, catchModifier, choiceOptions: war?.choices ?? birthdayQuestion?.choices.map((label, choiceIndex) => ({ id: String(choiceIndex), label })) ?? [],
    callbackSourceLoreIds: callbackLore.map((item) => item.id), startedAt: now, answers: [], votes: [], personalChoices: {}, kingPollEvents: [], predictions: {},
    authorAssignments: {}, authorGuesses: {}, authorGuessesScored: false, authorGuessResults: {}, wagers: {}, voteStage: null, scored: false, results: null,
    image: plan.kind === "MONSTER_FACTORY" ? { status: "FALLBACK", conceptTitle: "The Room Creature", conceptCaption: "The art department is sketching something unreasonably ambitious." } : null,
    featuredAnswerId: null, developerScoreCap: null, kingMysteryOrder: [], kingMysteryIndex: 0, kingMysteryPublicIds: {}, kingMysteryDecoys: {}, kingMysterySealUsedByPlayer: {}, kingMysteryVotes: {}, kingMysteryResults: {},
    royalRumourAssignments: {}, royalRumourGuesses: {}, royalRumourRevealOrder: [], royalRumourRevealIndex: 0,
    warRankings: {}, warTrueOrder: [], warTargetRanks: index === 0 ? [1, 2, 3] : index === 1 ? [1, 2, 3, 4, 5, 6] : [1, 6, 2, 5, 3, 4], warPlacements: {}, warClues: [], warTurnTeam: index % 2 === 0 ? "LION" : "RAVEN", warTurnNumber: 0, warMaxTurns: index === 0 ? 10 : 18, warLastMove: null,
    foolScrolls: [], foolRoundNumber: 1, foolPool: [], foolTurnTeam: "BELLS", foolClueGiverId: null, foolTeamTurns: { BELLS: 0, MOTLEY: 0 }, foolPassUsed: false, foolCurrentScrollId: null, foolOneWord: null, foolSpokenClue: null, foolPerformanceCue: null, foolBotClueAt: null, foolStrokes: [], foolLastResult: null, foolSuddenDeath: false, foolUndo: null,
  };
  if (plan.kind === "PROMPT_AND_CIRCUMSTANCE" && index === 0) {
    const requests = drawKingRequests(gameSeed, state.promptHistory, 4).filter((request) => request.id !== round.promptId).slice(0, 3);
    round.choiceOptions = requests.map((request) => ({ id: request.id, label: request.text }));
  }
  if (plan.kind === "KING_PROMPTER_FINAL") {
    const players = deterministicShuffle(scoringPlayers(state), `${gameSeed}:restoration-seats`);
    const slots = restorationLayout(players.length);
    state.kingRestorationBase = restorationBase(state.matchNumber);
    state.kingRestorationAssignments = Object.fromEntries(players.map((player, slotIndex) => [player.id, slots[slotIndex].id]));
  }
  if (!encore) state.promptHistory.push(promptEntry.id);
  buildAssignments(state, round);
  state.currentRound = round;
  state.roundIndex = index;
  return round;
}

function assignWarTeams(state: RoomState): void {
  const players = deterministicShuffle(scoringPlayers(state), `${state.id}:match-${state.matchNumber}:war-teams`);
  state.warTeams = Object.fromEntries(players.map((player, index) => [player.id, index % 2 === 0 ? "LION" : "RAVEN"]));
}

const otherFoolTeam = (team: FoolTeam): FoolTeam => team === "BELLS" ? "MOTLEY" : "BELLS";

function assignFoolTeams(state: RoomState, shuffleKey = "initial"): void {
  const players = deterministicShuffle(scoringPlayers(state), `${state.id}:match-${state.matchNumber}:fool-teams:${shuffleKey}`);
  state.foolTeams = Object.fromEntries(players.map((player, index) => [player.id, index % 2 === 0 ? "BELLS" : "MOTLEY"]));
  state.foolReadyPlayerIds = [];
}

function foolTeamPlayers(state: RoomState, team: FoolTeam) {
  return scoringPlayers(state).filter((player) => state.foolTeams[player.id] === team).sort((left, right) => left.seat - right.seat);
}

function foolTurnOrder(state: RoomState, team: FoolTeam) {
  return deterministicShuffle(foolTeamPlayers(state, team), `${state.id}:match-${state.matchNumber}:fool-turn-order:${team}`);
}

function foolClueGiver(state: RoomState, round: RoundState, team = round.foolTurnTeam): string | null {
  const players = foolTurnOrder(state, team);
  return players.length ? players[round.foolTeamTurns[team] % players.length].id : null;
}

function setFoolTurn(state: RoomState, round: RoundState, team: FoolTeam, now: number, suddenDeath = false): void {
  round.foolTurnTeam = team;
  round.foolClueGiverId = foolClueGiver(state, round, team);
  round.foolCurrentScrollId = round.foolPool[0] ?? null;
  round.foolPassUsed = false;
  round.foolOneWord = null;
  round.foolSpokenClue = null;
  round.foolPerformanceCue = null;
  round.foolBotClueAt = null;
  round.foolStrokes = [];
  round.foolLastResult = null;
  setPhase(state, suddenDeath ? "FOOL_SUDDEN_DEATH" : "FOOL_TURN", now);
}

function startFoolRounds(state: RoomState, round: RoundState, now: number): void {
  round.foolRoundNumber = 1;
  round.foolPool = deterministicShuffle(round.foolScrolls.map((scroll) => scroll.id), `${state.id}:${round.id}:fool-round-1`);
  round.foolTeamTurns = { BELLS: 0, MOTLEY: 0 };
  const first: FoolTeam = stableHash(`${state.id}:${state.matchNumber}:fool-first`) % 2 ? "BELLS" : "MOTLEY";
  setFoolTurn(state, round, first, now);
}

function finishFoolGame(state: RoomState, round: RoundState, winner: FoolTeam, now: number): void {
  state.foolWinner = winner;
  round.scored = true;
  round.results = { kind: "bowl_of_fools", teamScores: state.foolTeamScores, winner, suddenDeath: round.foolSuddenDeath };
  state.awards = [{ title: "Crowned Fools", playerIds: foolTeamPlayers(state, winner).map((player) => player.id), caption: "Remembered the royal nonsense best." }];
  state.status = "COMPLETE";
  setPhase(state, "FINAL_RESULTS", now);
}

function finishFoolPool(state: RoomState, round: RoundState, now: number): void {
  const emptyingTeam = round.foolTurnTeam;
  if (round.foolRoundNumber < 3) {
    round.foolRoundNumber = (round.foolRoundNumber + 1) as 2 | 3;
    round.foolPool = deterministicShuffle(round.foolScrolls.map((scroll) => scroll.id), `${state.id}:${round.id}:fool-round-${round.foolRoundNumber}`);
    const scores = state.foolTeamScores;
    round.foolTurnTeam = scores.BELLS === scores.MOTLEY ? otherFoolTeam(emptyingTeam) : scores.BELLS < scores.MOTLEY ? "BELLS" : "MOTLEY";
    round.foolCurrentScrollId = null;
    round.foolClueGiverId = null;
    round.foolLastResult = { team: emptyingTeam, correct: true };
    setPhase(state, "FOOL_ROUND_REVEAL", now);
    return;
  }
  if (state.foolTeamScores.BELLS === state.foolTeamScores.MOTLEY) {
    round.foolSuddenDeath = true;
    round.foolPool = deterministicShuffle(round.foolScrolls.map((scroll) => scroll.id), `${state.id}:${round.id}:sudden-death`).slice(0, 1);
    const starter = otherFoolTeam(emptyingTeam);
    setFoolTurn(state, round, starter, now, true);
    return;
  }
  finishFoolGame(state, round, state.foolTeamScores.BELLS > state.foolTeamScores.MOTLEY ? "BELLS" : "MOTLEY", now);
}

function warTeamPlayers(state: RoomState, team: WarTeam) {
  return scoringPlayers(state).filter((player) => state.warTeams[player.id] === team).sort((left, right) => left.seat - right.seat);
}

function warCommanderId(state: RoomState, round: RoundState): string | null {
  const team = warTeamPlayers(state, round.warTurnTeam);
  return team.length ? team[Math.floor(round.warTurnNumber / 2) % team.length].id : null;
}

function calculateWarOrder(state: RoomState, round: RoundState): string[] {
  const rankings = Object.values(round.warRankings);
  return [...round.choiceOptions].sort((left, right) => {
    const leftScore = rankings.reduce((sum, ranking) => sum + ranking.indexOf(left.id), 0);
    const rightScore = rankings.reduce((sum, ranking) => sum + ranking.indexOf(right.id), 0);
    return leftScore - rightScore || stableHash(`${state.id}:${round.id}:${left.id}`) - stableHash(`${state.id}:${round.id}:${right.id}`);
  }).map((choice) => choice.id);
}

function warRoundComplete(round: RoundState): boolean {
  const filledRanks = new Set(Object.values(round.warPlacements));
  return round.warTargetRanks.every((rank) => filledRanks.has(rank)) || round.warTurnNumber >= round.warMaxTurns;
}

function awardWarPlacement(state: RoomState, effects: DbEffect[], round: RoundState, team: WarTeam, choiceId: string, rank: number): void {
  const banners = round.index + 1;
  const points = [250, 400, 600][round.index] ?? 250;
  state.warTeamScores[team] += banners;
  for (const player of warTeamPlayers(state, team)) addScore(state, effects, round.id, player.id, `war_order:${team}:${choiceId}:${rank}`, points, { team, choiceId, rank, banners });
}

function finalizeWarRoom(state: RoomState): void {
  finalizeRoom(state);
}

function addScore(state: RoomState, effects: DbEffect[], roundId: string, playerId: string, kind: string, points: number, detail: Record<string, unknown> = {}, encore = false): void {
  const collection = encore ? state.encoreScoreEvents : state.scoreEvents;
  const eventKey = `${roundId}:${kind}:${playerId}`;
  if (collection.some((event) => event.eventKey === eventKey)) return;
  const event: ScoreEventState = { id: makeId("score"), eventKey, roundId, playerId, kind, points, detail };
  collection.push(event);
  if (!encore) effects.push({ type: "score", event });
}

function voteStats(round: RoundState) {
  const official: Record<string, number> = {};
  const audience: Record<string, number> = {};
  for (const vote of round.votes) vote.answerIds.forEach((answerId, index) => {
    const target = vote.audience ? audience : official;
      target[answerId] = (target[answerId] ?? 0) + (vote.audience ? 1 : vote.answerIds.length - index);
  });
  return { official, audience };
}

function addMemoryEdge(state: RoomState, effects: DbEffect[], roundId: string, fromLoreId: string | undefined, relation: MemoryRelation, toLoreId: string | undefined): void {
  if (!fromLoreId || !toLoreId || fromLoreId === toLoreId) return;
  if (state.memoryEdges.some((edge) => edge.fromLoreId === fromLoreId && edge.relation === relation && edge.toLoreId === toLoreId)) return;
  const edge = { id: makeId("memory-edge"), fromLoreId, relation, toLoreId, roundId };
  state.memoryEdges.push(edge);
  effects.push({ type: "memory_edge", edge });
}

function rememberWinningAnswers(state: RoomState, effects: DbEffect[], round: RoundState, winningAnswerIds: string[]): void {
  const kind = memoryKindForRound(round.kind);
  if (!kind) return;
  const winners = deterministicShuffle(
    round.answers.filter((answer) => !answer.hidden && winningAnswerIds.includes(answer.id)),
    `${state.id}:${round.id}:${kind}:co-winners`,
  );
  const newNodes: LoreState[] = [];
  for (const answer of winners) {
    if (state.lore.some((item) => item.sourceAnswerId === answer.id)) continue;
    const lore: LoreState = {
      id: makeId("lore"), sourceAnswerId: answer.id, sourceAuthorId: answer.playerId, text: answer.text,
      shortMeaning: answer.text.slice(0, 110), kind, originalPrompt: round.prompt, winner: true,
      quality: 0.7, callbackPotential: kind === "ANCHOR" || kind === "WORLD" ? 0.8 : 0.74,
      visualStrength: kind === "ANCHOR" ? 0.82 : 0.55, canSpeak: kind === "ANCHOR", tags: [], safe: true, used: false,
    };
    state.lore.push(lore); newNodes.push(lore); effects.push({ type: "lore", lore, roundId: round.id });
  }
  if (!state.primaryMemoryIds[kind] && newNodes[0]) state.primaryMemoryIds[kind] = newNodes[0].id;
  const anchorId = state.primaryMemoryIds.ANCHOR;
  const voiceId = state.primaryMemoryIds.VOICE;
  const worldId = state.primaryMemoryIds.WORLD;
  const consequenceId = state.primaryMemoryIds.CONSEQUENCE;
  if (kind === "VOICE") addMemoryEdge(state, effects, round.id, anchorId, "SAYS", voiceId);
  if (kind === "WORLD") addMemoryEdge(state, effects, round.id, worldId, "COLLIDES_WITH", anchorId);
  if (kind === "CONSEQUENCE") {
    addMemoryEdge(state, effects, round.id, worldId ?? anchorId, "CAUSES", consequenceId);
    addMemoryEdge(state, effects, round.id, anchorId, "ESCALATES_TO", consequenceId);
  }
}

function scoreCreativeRound(state: RoomState, effects: DbEffect[]): void {
  const round = state.currentRound;
  if (!round || round.scored) return;
  const visibleAnswers = round.answers.filter((answer) => !answer.hidden);
  const players = scoringPlayers(state);
  const ranked = players.length >= 4 && visibleAnswers.length >= 3;
  const { official, audience } = voteStats(round);
  const maximum = maximumPossibleApplause(Math.max(0, players.length - 1), ranked);
  const cap = round.developerScoreCap ?? SCORE_CAPS[round.kind] ?? (round.kind === "MONSTER_FACTORY" ? 1000 : 1000);
  for (const answer of visibleAnswers) {
    const points = creativeScore(cap, official[answer.id] ?? 0, maximum);
    addScore(state, effects, round.id, answer.playerId, "creative", points, { applause: official[answer.id] ?? 0, maximum, cap }, round.kind === "MONSTER_FACTORY");
  }
  if (round.kind === "CALLBACK") {
    const top = Math.max(0, ...Object.values(official));
    const awarded = new Map<string, number>();
    for (const answer of visibleAnswers.filter((item) => (official[item.id] ?? 0) === top && top > 0)) {
      for (const loreId of answer.sourceLoreIds?.length ? answer.sourceLoreIds : round.callbackSourceLoreIds) {
        const source = state.lore.find((item) => item.id === loreId);
        if (!source || source.sourceAuthorId === answer.playerId) continue;
        const next = Math.min(200, (awarded.get(source.sourceAuthorId) ?? 0) + 100);
        awarded.set(source.sourceAuthorId, next);
      }
    }
    for (const [playerId, points] of awarded) addScore(state, effects, round.id, playerId, "callback_royalty", points, { topApplause: top });
  }
  const winningAnswerIds = visibleAnswers.filter((answer) => (official[answer.id] ?? 0) === Math.max(0, ...Object.values(official))).map((answer) => answer.id);
  const monsterTotals = round.kind === "MONSTER_FACTORY" ? Object.fromEntries(scoringPlayers(state).map((player) => [player.id, state.encoreScoreEvents.filter((event) => event.playerId === player.id).reduce((sum, event) => sum + event.points, 0)])) : null;
  round.results = { kind: "creative", official, audience, winningAnswerIds, ...(monsterTotals ? { monsterTotals, monsterMvpIds: winnersFromTotals(monsterTotals) } : {}) };
  rememberWinningAnswers(state, effects, round, winningAnswerIds);
  const memoryKind = memoryKindForRound(round.kind);
  if (memoryKind) round.results = { ...round.results, rememberedMemoryIds: state.lore.filter((item) => item.kind === memoryKind && winningAnswerIds.includes(item.sourceAnswerId)).map((item) => item.id), memoryKind };
  round.scored = true;
  if (round.kind === "FINAL_READ") {
    const winningAuthors = new Set(visibleAnswers.filter((answer) => winningAnswerIds.includes(answer.id)).map((answer) => answer.playerId));
    for (const [playerId, wager] of Object.entries(round.wagers)) addScore(state, effects, round.id, playerId, "final_wager", winningAuthors.has(wager.targetPlayerId) ? wager.wager : -wager.wager, { ...wager, correct: winningAuthors.has(wager.targetPlayerId) });
  }
}

function rankedTotals(round: RoundState): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const vote of round.votes.filter((item) => !item.audience)) {
    vote.answerIds.forEach((answerId, index) => { totals[answerId] = (totals[answerId] ?? 0) + vote.answerIds.length - index; });
  }
  return totals;
}

function resolveKingRequestPoll(state: RoomState, round: RoundState): string {
  const choices = round.choiceOptions.map((choice) => choice.id);
  const finalVotes = Object.entries(round.personalChoices).filter(([, choiceId]) => choices.includes(choiceId));
  if (!finalVotes.length) return deterministicShuffle(choices, `${state.id}:${round.id}:no-poll-votes`)[0];
  const counts = Object.fromEntries(choices.map((choiceId) => [choiceId, finalVotes.filter(([, selected]) => selected === choiceId).length]));
  const high = Math.max(...Object.values(counts));
  const tied = choices.filter((choiceId) => counts[choiceId] === high);
  if (tied.length === 1) return tied[0];
  return [...tied].sort((left, right) => {
    const reachedAt = (choiceId: string) => round.kingPollEvents.filter((event) => event.choiceId === choiceId && round.personalChoices[event.playerId] === choiceId).sort((a, b) => a.votedAt - b.votedAt)[high - 1]?.votedAt ?? Number.MAX_SAFE_INTEGER;
    return reachedAt(left) - reachedAt(right) || left.localeCompare(right);
  })[0];
}

function scoreKingBallot(state: RoomState, effects: DbEffect[], stage: "prompt" | "image" | "final"): void {
  const round = state.currentRound;
  if (!round || !["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL"].includes(round.kind)) return;
  const pointsPerVote = round.kind === "KING_PROMPTER_FINAL" ? 300 : round.index === 0 ? 100 : 150;
  const visible = round.answers.filter((answer) => !answer.hidden);
  for (const vote of round.votes.filter((item) => !item.audience)) {
    vote.answerIds.forEach((answerId, index) => {
      const answer = visible.find((item) => item.id === answerId);
      const points = index === 0 ? pointsPerVote : 0;
      if (answer && points > 0) addScore(state, effects, round.id, answer.playerId, `king_${stage}:${vote.voterId}:${index + 1}`, points, { answerId, voterId: vote.voterId, rank: index + 1, stage });
    });
  }
  const totals = rankedTotals(round);
  const high = Math.max(0, ...visible.map((answer) => totals[answer.id] ?? 0));
  const winningAnswerIds = visible.filter((answer) => (totals[answer.id] ?? 0) === high).map((answer) => answer.id);
  if (round.kind === "PROMPT_AND_CIRCUMSTANCE") {
    const sourceWinningAnswerIds = winningAnswerIds.map((answerId) => visible.find((answer) => answer.id === answerId)?.sourceAnswerId ?? answerId);
    state.kingFinalists = [...new Set([...(state.kingFinalists ?? []), ...sourceWinningAnswerIds])];
    round.results = { kind: "king_canvas", canvasNumber: round.index + 1, pointsPerVote, imageTotals: totals, imageWinningAnswerIds: winningAnswerIds, sourceWinningAnswerIds };
    round.scored = true;
    return;
  }
  round.results = { kind: "king_restoration", pointsPerVote, finalTotals: totals, finalWinningAnswerIds: winningAnswerIds };
  round.scored = true;
}

function scoreComicBallot(state: RoomState, effects: DbEffect[]): void {
  const round = state.currentRound;
  if (!round || round.kind !== "COMIC_FRAME" || round.scored) return;
  const frameNumber = Math.min(3, round.index + 1) as 1 | 2 | 3;
  const pointsByRank = frameNumber === 1 ? [300, 200, 100] : frameNumber === 2 ? [500, 300, 150] : [1000, 600, 300];
  const visible = round.answers.filter((answer) => !answer.hidden);
  for (const vote of round.votes.filter((item) => !item.audience)) {
    vote.answerIds.forEach((answerId, index) => {
      const answer = visible.find((item) => item.id === answerId);
      const points = pointsByRank[index] ?? 0;
      if (answer && points > 0) addScore(state, effects, round.id, answer.playerId, `comic_frame_${frameNumber}:${vote.voterId}:${index + 1}`, points, { answerId, voterId: vote.voterId, rank: index + 1, frameNumber });
    });
  }
  const totals = rankedTotals(round);
  const high = Math.max(0, ...visible.map((answer) => totals[answer.id] ?? 0));
  const winningAnswerIds = visible.filter((answer) => (totals[answer.id] ?? 0) === high).map((answer) => answer.id);
  const selectedAnswerId = deterministicShuffle(winningAnswerIds, `${state.id}:${round.id}:comic-frame-winner`)[0] ?? visible[0]?.id ?? null;
  const selected = selectedAnswerId ? visible.find((answer) => answer.id === selectedAnswerId) : null;
  const selectedImage = selected ? state.kingImages[selected.id] : null;
  if (selected && selectedImage) {
    state.comicFrames = [...state.comicFrames.filter((frame) => frame.frameNumber !== frameNumber), {
      frameNumber, roundId: round.id, answerId: selected.id, authorId: selected.playerId, prompt: selected.text, image: selectedImage,
    }].sort((a, b) => a.frameNumber - b.frameNumber);
  }
  round.results = { kind: "comic_frame", frameNumber, imageTotals: totals, imageWinningAnswerIds: winningAnswerIds, selectedAnswerId, pointsByRank, authorGuessCorrectByPlayer: round.authorGuessResults };
  round.scored = true;
}

function featuredMysteryAnswer(state: RoomState): AnswerState | null {
  const round = state.currentRound;
  if (!round || round.kind !== "KING_REQUEST_MYSTERY") return null;
  const answerId = round.kingMysteryOrder[round.kingMysteryIndex] ?? round.featuredAnswerId;
  return round.answers.find((answer) => answer.id === answerId && !answer.hidden) ?? null;
}

function mysteryEligiblePlayers(state: RoomState): ReturnType<typeof scoringPlayers> {
  const featured = featuredMysteryAnswer(state);
  return featured ? scoringPlayers(state).filter((player) => player.id !== featured.playerId) : [];
}

function privateIdAlias(prefix: "turn" | "ballot", seed: string): string {
  const digest = createHash("sha256").update(`king-mystery-public-id-v1:${prefix}:${seed}`).digest("hex");
  return `${prefix}_${digest.slice(0, 32)}`;
}

/** Stable fallback aliases cover rooms created before the alias map was persisted. */
export function mysteryPublicIdsForRound(round: RoundState, featuredAnswerId: string, randomizeMissing = false): { turnId: string; choices: Record<string, string> } {
  round.kingMysteryPublicIds ??= {};
  const aliases = round.kingMysteryPublicIds[featuredAnswerId] ?? {
    turnId: randomizeMissing ? makeId("turn") : privateIdAlias("turn", `${round.id}:${featuredAnswerId}`),
    choices: {},
  };
  const choiceIds = [featuredAnswerId, ...(round.kingMysteryDecoys[featuredAnswerId] ?? []).map((decoy) => decoy.id)];
  for (const choiceId of choiceIds) {
    if (!aliases.choices[choiceId]) aliases.choices[choiceId] = randomizeMissing
      ? makeId("ballot")
      : privateIdAlias("ballot", `${round.id}:${featuredAnswerId}:${choiceId}`);
  }
  round.kingMysteryPublicIds[featuredAnswerId] = aliases;
  return aliases;
}

function prepareMysteryTurn(state: RoomState, now: number): void {
  const round = state.currentRound;
  if (!round || round.kind !== "KING_REQUEST_MYSTERY") return;
  const answerId = round.kingMysteryOrder[round.kingMysteryIndex];
  round.featuredAnswerId = answerId ?? null;
  if (!answerId) return;
  round.kingMysteryDecoys[answerId] ??= [];
  round.kingMysteryVotes[answerId] ??= {};
  mysteryPublicIdsForRound(round, answerId, true);
  setPhase(state, "MYSTERY_DECOYS", now);
}

function mysteryChoices(state: RoomState) {
  const round = state.currentRound;
  const featured = featuredMysteryAnswer(state);
  if (!round || !featured) return [];
  const decoys = round.kingMysteryDecoys[featured.id] ?? [];
  return deterministicShuffle([
    { id: featured.id, text: featured.text, playerId: featured.playerId, real: true },
    ...decoys.map((decoy) => ({ id: decoy.id, text: decoy.text, playerId: decoy.playerId, real: false })),
  ], `${state.id}:${round.id}:${featured.id}:mystery-choices`);
}

function scoreMysteryTurn(state: RoomState, effects: DbEffect[]): void {
  const round = state.currentRound;
  const featured = featuredMysteryAnswer(state);
  if (!round || !featured || round.kingMysteryResults[featured.id]) return;
  mysteryPublicIdsForRound(round, featured.id);
  const choices = mysteryChoices(state);
  const votes = round.kingMysteryVotes[featured.id] ?? {};
  const correctPlayerIds = Object.entries(votes).filter(([, choiceId]) => choiceId === featured.id).map(([playerId]) => playerId);
  const fooledByChoice: Record<string, string[]> = {};
  const sealedChoiceIds: string[] = [];
  for (const choice of choices.filter((item) => !item.real)) {
    const fooled = Object.entries(votes).filter(([, choiceId]) => choiceId === choice.id).map(([playerId]) => playerId);
    fooledByChoice[choice.id] = fooled;
    const sealed = (round.kingMysteryDecoys[featured.id] ?? []).some((decoy) => decoy.id === choice.id && decoy.sealed);
    if (sealed) sealedChoiceIds.push(choice.id);
    fooled.forEach((voterId, index) => addScore(state, effects, round.id, choice.playerId, `mystery_bluff:${featured.id}:${voterId}:${index}`, sealed ? 750 : 500, { featuredAnswerId: featured.id, choiceId: choice.id, voterId, sealed }));
  }
  for (const playerId of correctPlayerIds) addScore(state, effects, round.id, playerId, `mystery_correct:${featured.id}`, 500, { featuredAnswerId: featured.id });
  addScore(state, effects, round.id, featured.playerId, `mystery_clarity:${featured.id}`, Math.min(750, correctPlayerIds.length * 250), { featuredAnswerId: featured.id, correctGuesses: correctPlayerIds.length });
  round.kingMysteryResults[featured.id] = {
    realChoiceId: featured.id, originalRequest: featured.text, originalAuthorId: featured.playerId, votes: { ...votes },
    choiceAuthors: Object.fromEntries(choices.map((choice) => [choice.id, choice.real ? null : choice.playerId])), correctPlayerIds, fooledByChoice, sealedChoiceIds,
  };
  round.results = { kind: "king_request_mystery", currentAnswerId: featured.id, currentResult: round.kingMysteryResults[featured.id], completedTurns: Object.keys(round.kingMysteryResults).length, totalTurns: round.kingMysteryOrder.length };
}

function prepareRoyalRumourAssignments(state: RoomState): void {
  const round = state.currentRound;
  if (!round || round.kind !== "ROYAL_RUMOURS") return;
  const players = deterministicShuffle(scoringPlayers(state), `${state.id}:${round.id}:rumour-pass`);
  const answersByPlayer = new Map(round.answers.filter((answer) => !answer.hidden).map((answer) => [answer.playerId, answer.id]));
  round.royalRumourAssignments = Object.fromEntries(players.flatMap((player, index) => {
    const sourcePlayer = players[(index + 1) % players.length];
    const sourceAnswerId = answersByPlayer.get(sourcePlayer?.id);
    return sourceAnswerId ? [[player.id, sourceAnswerId]] : [];
  }));
}

async function queueRoyalRumourGuessImages(state: RoomState, effects: DbEffect[], now: number): Promise<void> {
  const round = state.currentRound;
  if (!round || round.kind !== "ROYAL_RUMOURS") return;
  state.imageGenerationNotice = null;
  for (const [index, guess] of Object.values(round.royalRumourGuesses).entries()) {
    if (["QUEUED", "GENERATING", "READY", "FALLBACK"].includes(state.kingImages[guess.id]?.status ?? "")) continue;
    const conceptTitle = `Retold Rumour ${index + 1}`;
    const conceptCaption = "The AI illustrated what the next player thought they saw.";
    if (state.soloMode && !state.soloLiveImages) {
      state.kingImages[guess.id] = { status: "FALLBACK", conceptTitle, conceptCaption };
      continue;
    }
    const jobId = makeId("job");
    const payload = { kind: "KING_PROMPT_IMAGE", roomId: state.id, roundId: round.id, answerId: guess.id, imageModel: state.imageModel, visualBrief: guess.text };
    const hash = await promptHash(payload);
    state.kingImages[guess.id] = { jobId, status: "QUEUED", conceptTitle, conceptCaption };
    effects.push({ type: "job", id: jobId, roundId: round.id, kind: "KING_PROMPT_IMAGE", promptHash: hash, prompt: payload, now });
  }
}

function scoreRoyalRumours(state: RoomState, effects: DbEffect[]): void {
  const round = state.currentRound;
  if (!round || round.kind !== "ROYAL_RUMOURS" || round.scored) return;
  const totals: Record<string, number> = {};
  for (const vote of round.votes.filter((item) => !item.audience)) {
    const sourceAnswerId = vote.answerIds[0];
    const original = round.answers.find((answer) => answer.id === sourceAnswerId && !answer.hidden);
    const guess = round.royalRumourGuesses[sourceAnswerId];
    if (!original || !guess) continue;
    totals[sourceAnswerId] = (totals[sourceAnswerId] ?? 0) + 1;
    addScore(state, effects, round.id, guess.playerId, `rumour_interpreter:${vote.voterId}`, 500, { sourceAnswerId, guessId: guess.id, voterId: vote.voterId });
    addScore(state, effects, round.id, original.playerId, `rumour_starter:${vote.voterId}`, 250, { sourceAnswerId, guessId: guess.id, voterId: vote.voterId });
  }
  const eligible = round.royalRumourRevealOrder;
  const high = Math.max(0, ...eligible.map((id) => totals[id] ?? 0));
  const winningSourceAnswerIds = eligible.filter((id) => (totals[id] ?? 0) === high && high > 0);
  round.results = { kind: "royal_rumours", chainVotes: totals, winningSourceAnswerIds, pointsPerVote: { interpreter: 500, starter: 250 } };
  round.scored = true;
}

function scoreReadTheRoom(state: RoomState, effects: DbEffect[]): void {
  const round = state.currentRound;
  if (!round || round.scored) return;
  const players = scoringPlayers(state);
  const crowdControl = round.kind === "CROWD_CONTROL";
  const choiceIds = crowdControl ? players.map((player) => player.id) : Array.from({ length: 10 }, (_, index) => String(index));
  const choiceIndex = new Map(choiceIds.map((id, index) => [id, index]));
  const counts = Array.from({ length: choiceIds.length }, () => 0);
  for (const choice of Object.values(round.personalChoices)) {
    const index = choiceIndex.get(choice); if (index !== undefined) counts[index] += 1;
  }
  const actual = counts.map((count) => players.length ? count * 100 / players.length : 0);
  for (const player of players) {
    const predicted = round.predictions[player.id] ?? Array.from({ length: choiceIds.length }, (_, index) => Math.floor(100 / choiceIds.length) + (index < 100 % choiceIds.length ? 1 : 0));
    const result = crowdControl ? distributionPredictionScore(predicted, actual) : readTheRoomScore(predicted, actual);
    addScore(state, effects, round.id, player.id, crowdControl ? "crowd_prediction" : "room_prediction", result.points, { error: result.error, accuracy: result.accuracy });
  }
  const winningChoiceIds = choiceIds.filter((_, index) => counts[index] === Math.max(0, ...counts));
  round.results = { kind: crowdControl ? "crowd_control" : "room_prediction", actual, choiceIds, winningChoiceIds };
  round.scored = true;
}

function scoreBirthdayBets(state: RoomState, effects: DbEffect[]): void {
  const round = state.currentRound;
  if (!round || round.scored || round.kind !== "BIRTHDAY_BETS") return;
  const players = scoringPlayers(state);
  const birthdayPersonId = state.birthdayPersonId && players.some((player) => player.id === state.birthdayPersonId) ? state.birthdayPersonId : players[0]?.id;
  if (!birthdayPersonId) return;
  const fallbackChoiceId = round.choiceOptions[stableHash(`${state.id}:${round.id}:vip-fallback`) % Math.max(1, round.choiceOptions.length)]?.id ?? "0";
  const correctChoiceId = round.personalChoices[birthdayPersonId] ?? fallbackChoiceId;
  const correctPlayerIds: string[] = [];
  for (const player of players) {
    if (player.id === birthdayPersonId) continue;
    const correct = round.personalChoices[player.id] === correctChoiceId;
    if (correct) correctPlayerIds.push(player.id);
    addScore(state, effects, round.id, player.id, "birthday_prediction", correct ? 900 : 0, { correct, choiceId: round.personalChoices[player.id] ?? null });
  }
  const fooledCount = players.filter((player) => player.id !== birthdayPersonId && round.personalChoices[player.id] && round.personalChoices[player.id] !== correctChoiceId).length;
  addScore(state, effects, round.id, birthdayPersonId, "birthday_mystery", Math.min(900, fooledCount * 200), { fooledCount });
  const counts = Object.fromEntries(round.choiceOptions.map((choice) => [choice.id, players.filter((player) => player.id !== birthdayPersonId && round.personalChoices[player.id] === choice.id).length]));
  round.results = { kind: "birthday_bets", birthdayPersonId, birthdayName: state.birthdayName, correctChoiceId, correctPlayerIds, counts, options: round.choiceOptions };
  round.scored = true;
}

function scoreAuthorGuesses(state: RoomState, effects: DbEffect[]): void {
  const round = state.currentRound;
  const imageIntermission = round && ["PROMPT_AND_CIRCUMSTANCE", "COMIC_FRAME"].includes(round.kind);
  if (!round || (imageIntermission ? round.authorGuessesScored : round.scored)) return;
  const answerPool = imageIntermission ? round.answers : state.answerHistory;
  const historical = new Map(answerPool.map((answer) => [answer.id, answer]));
  const disguise = new Map<string, number>();
  const correctByPlayer: Record<string, number> = {};
  for (const [guesserId, guesses] of Object.entries(round.authorGuesses)) {
    let correct = 0;
    for (const [answerId, guessedAuthorId] of Object.entries(guesses)) {
      const answer = historical.get(answerId);
      if (!answer) continue;
      if (answer.playerId === guessedAuthorId) correct += 1;
      else disguise.set(answer.playerId, Math.min(200, (disguise.get(answer.playerId) ?? 0) + 50));
    }
    correctByPlayer[guesserId] = correct;
    addScore(state, effects, round.id, guesserId, imageIntermission ? "prompt_author_guess" : "author_guess", correct * (imageIntermission ? 100 : 250), { correct });
  }
  if (!imageIntermission) for (const [playerId, points] of disguise) addScore(state, effects, round.id, playerId, "disguise_bonus", points, { wrongAttributions: points / 50 });
  if (imageIntermission) {
    round.authorGuessResults = correctByPlayer;
    round.authorGuessesScored = true;
  } else {
    round.results = { kind: "author_guess", correctByPlayer, disguise: Object.fromEntries(disguise) };
    round.scored = true;
  }
}

function finalizeRoom(state: RoomState): void {
  const totals = scoreTotals(state);
  const winners = winnersFromTotals(totals);
  const topPrediction = state.scoreEvents.filter((event) => ["room_prediction", "crowd_prediction", "birthday_prediction"].includes(event.kind)).sort((a, b) => b.points - a.points)[0];
  const topDisguise = state.scoreEvents.filter((event) => event.kind === "disguise_bonus").sort((a, b) => b.points - a.points)[0];
  const topRoyalty = state.scoreEvents.filter((event) => event.kind === "callback_royalty").sort((a, b) => b.points - a.points)[0];
  const topCreative = state.scoreEvents.filter((event) => event.kind === "creative").sort((a, b) => b.points - a.points)[0];
  const mysteryLeader = (prefix: string) => {
    const totalsByPlayer = state.scoreEvents.filter((event) => event.kind.startsWith(prefix)).reduce<Record<string, number>>((playerTotals, event) => { playerTotals[event.playerId] = (playerTotals[event.playerId] ?? 0) + event.points; return playerTotals; }, {});
    return Object.entries(totalsByPlayer).sort((a, b) => b[1] - a[1])[0] ?? null;
  };
  const topDetective = mysteryLeader("mystery_correct:");
  const topForger = mysteryLeader("mystery_bluff:");
  const topCommissioner = mysteryLeader("mystery_clarity:");
  const topInterpreter = mysteryLeader("rumour_interpreter:");
  const topStarter = mysteryLeader("rumour_starter:");
  const warHigh = Math.max(state.warTeamScores.LION, state.warTeamScores.RAVEN);
  const warWinningTeams = (["LION", "RAVEN"] as WarTeam[]).filter((team) => state.warTeamScores[team] === warHigh);
  const warWinners = scoringPlayers(state).filter((player) => warWinningTeams.includes(state.warTeams[player.id])).map((player) => player.id);
  const awards = (state.gameLength === "royal-war-room" ? [
    { title: state.warCampaign === "ATTACK" ? "Castle Conquerors" : "Castle Defenders", playerIds: warWinners, caption: state.warCampaign === "ATTACK" ? "Reconstructed the room’s takeover plan" : "Reconstructed the room’s survival plan" },
    { title: "Royal Intelligence", playerIds: warWinners, caption: `${warHigh} campaign banners recovered` },
  ] : state.gameLength === "royal-rumours" ? [
    topInterpreter && { title: "Rumour Mill", playerIds: [topInterpreter[0]], caption: "Created the funniest AI-powered misunderstanding" },
    topStarter && { title: "Loose Lips", playerIds: [topStarter[0]], caption: "Started the rumours that travelled furthest" },
  ] : state.gameLength === "king-mystery" ? [
    topDetective && { title: "Royal Detective", playerIds: [topDetective[0]], caption: "Found the most genuine incident reports" },
    topForger && { title: "Master Framer", playerIds: [topForger[0]], caption: "Pinned the most convincing stories on the evidence" },
    topCommissioner && { title: "Star Witness", playerIds: [topCommissioner[0]], caption: "Filed the reports the room reconstructed most accurately" },
  ] : [
    topCreative && { title: "Crowd Favorite", playerIds: [topCreative.playerId], caption: "Most explosive single creative round" },
    topPrediction && { title: state.gameLength === "birthday" ? `Knows ${state.birthdayName ?? "Him"} Best` : "Human Barometer", playerIds: [topPrediction.playerId], caption: state.gameLength === "birthday" ? "Read the birthday mind with alarming precision" : "Read the room with alarming precision" },
    topDisguise && { title: "Voice Changer", playerIds: [topDisguise.playerId], caption: "Fooled the most friends" },
    topRoyalty && { title: "Callback Royalty", playerIds: [topRoyalty.playerId], caption: "Their joke had a second life" },
  ]).filter(Boolean) as RoomState["awards"];
  state.awards = awards.slice(0, 4);
  const galleryNodes = (["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"] as MemoryKind[]).flatMap((kind) => {
    const item = primaryMemory(state, kind); return item ? [{ id: item.id, kind: item.kind, text: item.text, sourceAuthorId: item.sourceAuthorId }] : [];
  });
  state.roomLore = galleryNodes.map((item) => item.text);
  const galleryIds = new Set(galleryNodes.map((item) => item.id));
  const loreGallery = { nodes: galleryNodes, edges: state.memoryEdges.filter((edge) => galleryIds.has(edge.fromLoreId) && galleryIds.has(edge.toLoreId)) };
  state.currentRound = state.currentRound ? { ...state.currentRound, results: { ...(state.currentRound.results ?? {}), totals, winnerIds: winners, awards: state.awards, roomLore: state.roomLore, loreGallery } } : null;
  state.status = "COMPLETE";
}

function allPlayersHave(state: RoomState, collection: Record<string, unknown> | Set<string>): boolean {
  const keys = collection instanceof Set ? collection : new Set(Object.keys(collection));
  const players = scoringPlayers(state);
  return players.length > 0 && players.every((player) => keys.has(player.id));
}

function earlyLock(state: RoomState, now: number): void {
  const round = state.currentRound;
  if (!round) return;
  const submitted = new Set(round.answers.map((answer) => answer.playerId));
  if (["ANSWERING", "FINAL_ANSWERING", "ENCORE_CONTRIBUTING", "ENCORE_FOLLOWUP"].includes(state.phase) && allPlayersHave(state, submitted)) setPhase(state, "ANSWER_LOCK", now, state.gameLength === "pictures" ? 3000 : 2000);
  if (["VOTING", "FINAL_VOTING"].includes(state.phase)) {
    const voters = new Set(round.votes.filter((vote) => !vote.audience).map((vote) => vote.voterId));
    const visible = round.answers.filter((answer) => !answer.hidden);
    const requiredPlayers = scoringPlayers(state).filter((player) => visible.some((answer) => answer.playerId !== player.id));
    if (requiredPlayers.length > 0 && requiredPlayers.every((player) => voters.has(player.id))) {
      round.voteStage = round.kind === "PROMPT_AND_CIRCUMSTANCE" ? "IMAGE" : round.kind === "KING_PROMPTER_FINAL" ? "FINAL" : round.kind === "COMIC_FRAME" ? "IMAGE" : null;
      setPhase(state, "VOTE_LOCK", now, state.gameLength === "pictures" ? 3000 : 2000);
    }
  }
  if (state.phase === "PERSONAL_CHOICE" && allPlayersHave(state, round.personalChoices)) state.deadlineAt = Math.min(state.deadlineAt ?? Infinity, now + 2000);
  if (state.phase === "ROOM_PREDICTION" && allPlayersHave(state, round.predictions)) state.deadlineAt = Math.min(state.deadlineAt ?? Infinity, now + 2000);
  if (state.phase === "AUTHOR_GUESSING" && allPlayersHave(state, round.authorGuesses)) state.deadlineAt = Math.min(state.deadlineAt ?? Infinity, now + 2000);
  if (state.phase === "MYSTERY_DECOYS") {
    const featured = featuredMysteryAnswer(state);
    const submitted = new Set(featured ? (round.kingMysteryDecoys[featured.id] ?? []).map((decoy) => decoy.playerId) : []);
    const eligible = mysteryEligiblePlayers(state);
    if (eligible.length > 0 && eligible.every((player) => submitted.has(player.id))) state.deadlineAt = Math.min(state.deadlineAt ?? Infinity, now + 1500);
  }
  if (state.phase === "MYSTERY_VOTING") {
    const featured = featuredMysteryAnswer(state);
    const votes = featured ? round.kingMysteryVotes[featured.id] ?? {} : {};
    const eligible = mysteryEligiblePlayers(state);
    if (eligible.length > 0 && eligible.every((player) => Boolean(votes[player.id]))) state.deadlineAt = Math.min(state.deadlineAt ?? Infinity, now + 1500);
  }
  if (state.phase === "RUMOUR_GUESSING") {
    const submitted = new Set(Object.values(round.royalRumourGuesses).map((guess) => guess.playerId));
    const eligible = scoringPlayers(state).filter((player) => Boolean(round.royalRumourAssignments[player.id]));
    if (eligible.length > 0 && eligible.every((player) => submitted.has(player.id))) state.deadlineAt = Math.min(state.deadlineAt ?? Infinity, now + 1500);
  }
  if (state.phase === "RUMOUR_VOTING") {
    const voters = new Set(round.votes.filter((vote) => !vote.audience).map((vote) => vote.voterId));
    const eligible = scoringPlayers(state).filter((player) => round.royalRumourRevealOrder.some((sourceAnswerId) => {
      const original = round.answers.find((answer) => answer.id === sourceAnswerId);
      const guess = round.royalRumourGuesses[sourceAnswerId];
      return original && guess && original.playerId !== player.id && guess.playerId !== player.id;
    }));
    if (eligible.length > 0 && eligible.every((player) => voters.has(player.id))) setPhase(state, "VOTE_LOCK", now, 2000);
  }
  if (state.phase === "WAR_RANKING" && allPlayersHave(state, round.warRankings)) state.deadlineAt = Math.min(state.deadlineAt ?? Infinity, now + 1500);
  if (state.phase === "FINAL_WAGER" && allPlayersHave(state, round.wagers)) state.deadlineAt = Math.min(state.deadlineAt ?? Infinity, now + 2000);
}

export const BOWL_BOT_SCROLLS: Readonly<Record<string, { clue: string; performance: string }>> = {
  apple: { clue: "crunchy fruit", performance: "Pretend to pick a round fruit, polish it, and take a crisp bite." },
  bicycle: { clue: "pedals and two wheels", performance: "Hold invisible handlebars and pedal, wobbling around a turn." },
  blanket: { clue: "warm bedtime cover", performance: "Unfold a large cover, wrap up, and shiver less." },
  boat: { clue: "floats on water", performance: "Row an invisible boat, then rock gently with the waves." },
  book: { clue: "pages and a story", performance: "Open a thick volume, turn pages, and react to a surprising story." },
  bottle: { clue: "holds a drink", performance: "Unscrew a cap, pour a drink, and take a refreshing sip." },
  camera: { clue: "captures a picture", performance: "Look through a viewfinder, focus, and take a picture." },
  candle: { clue: "small flame and wax", performance: "Strike a match, light a small flame, and carefully blow it out." },
  castle: { clue: "stone home for royalty", performance: "Raise a drawbridge, climb a tall tower, and wave like royalty." },
  cat: { clue: "purrs and chases string", performance: "Stretch like a house pet, groom a paw, and chase a toy." },
  chair: { clue: "something to sit on", performance: "Pull out a seat, sit down, then tip back and catch your balance." },
  clock: { clue: "keeps track of time", performance: "Wind a timepiece, swing like a pendulum, and point to the hour." },
  cloud: { clue: "floats across the sky", performance: "Drift slowly overhead, then gather and release a soft shower." },
  crown: { clue: "royal headwear", performance: "Lift a jeweled circlet, place it on your head, and wave regally." },
  dog: { clue: "barks and fetches", performance: "Scratch behind an ear, wag excitedly, and fetch an imaginary ball." },
  dolphin: { clue: "clever ocean mammal", performance: "Swim in a smooth arc, leap above the waves, and splash back down." },
  dragon: { clue: "mythical creature with wings", performance: "Flap heavy wings, then mime a small puff of fire." },
  drum: { clue: "percussion instrument", performance: "Hold two sticks and play a lively rhythm on an invisible drum." },
  elephant: { clue: "large animal with a trunk", performance: "Stomp with heavy steps and swing an imaginary trunk." },
  feather: { clue: "light bird covering", performance: "Float gently downward like a feather, then tickle your nose." },
  fish: { clue: "lives underwater", performance: "Swim with your hands like fins, then open and close your mouth." },
  flower: { clue: "colorful garden bloom", performance: "Plant a seed, watch it grow, then smell a fresh bloom." },
  guitar: { clue: "stringed music maker", performance: "Strum an invisible instrument and rock along to the music." },
  hat: { clue: "worn on your head", performance: "Try on a tall hat, tip its brim, and shield your eyes from sun." },
  heart: { clue: "beats inside your chest", performance: "Feel a heartbeat, then make a heart shape with your hands." },
  house: { clue: "place to live", performance: "Unlock a front door, step inside, and wave from a window." },
  icecream: { clue: "cold frozen dessert", performance: "Scoop a frozen treat, lick it, and react to a brain freeze." },
  island: { clue: "land surrounded by water", performance: "Swim ashore, brush sand off, and scan the horizon for a boat." },
  jacket: { clue: "outer layer for chilly weather", performance: "Put on a warm outer layer and zip it up against the cold." },
  key: { clue: "opens a lock", performance: "Search your pockets, find a small key, and turn it in a lock." },
  kite: { clue: "flies on a windy day", performance: "Run into the wind, let a toy soar, and pull its string." },
  ladder: { clue: "climbs to a high place", performance: "Set up climbing rungs, climb carefully, and look down from above." },
  lamp: { clue: "lights up a room", performance: "Reach for a switch, turn on a light, and read comfortably." },
  lighthouse: { clue: "beacon beside the coast", performance: "Stand tall, sweep one arm like a beacon, and rock as waves pass." },
  lion: { clue: "king of the jungle", performance: "Shake a shaggy mane, prowl, and give a silent roar." },
  mirror: { clue: "shows your reflection", performance: "Look into a reflective glass and copy your own movements." },
  moon: { clue: "glows in the night sky", performance: "Look up at night, trace a crescent overhead, and slowly orbit." },
  mountain: { clue: "high rocky peak", performance: "Climb a steep slope, reach the summit, and celebrate the view." },
  mushroom: { clue: "grows in a shady patch", performance: "Crouch under a tiny cap, then pop up as if growing after rain." },
  necklace: { clue: "jewelry worn around the neck", performance: "Fasten a sparkling chain around your neck and admire it." },
  owl: { clue: "night bird with wide eyes", performance: "Turn your head sharply, blink wide eyes, and silently flap at night." },
  paintbrush: { clue: "tool for making art", performance: "Dip a brush in color and paint broad strokes on a tall canvas." },
  penguin: { clue: "waddles on icy shores", performance: "Waddle on ice, flap short wings, and slide on your belly." },
  piano: { clue: "keyboard instrument", performance: "Sit at a keyboard and play a dramatic tune with both hands." },
  pizza: { clue: "cheesy slice from the oven", performance: "Toss dough overhead, add toppings, then pull away a stretchy slice." },
  pumpkin: { clue: "orange harvest squash", performance: "Roll a round harvest squash, carve a face, and light it inside." },
  rabbit: { clue: "hops with long ears", performance: "Make long ears with your hands and hop quickly across the floor." },
  rainbow: { clue: "colorful arc after rain", performance: "Watch rain stop, then trace a bright arch across the sky." },
  robot: { clue: "machine that can move", performance: "Move with stiff mechanical joints, then power down and restart." },
  rocket: { clue: "blasts toward space", performance: "Count down, launch upward, and float in zero gravity." },
  sandwich: { clue: "lunch between slices", performance: "Layer invisible fillings, then take an enormous bite." },
  shell: { clue: "found on a beach", performance: "Search the sand, lift a small spiral, and listen to the ocean." },
  shoe: { clue: "worn on a foot", performance: "Pull on footwear, tie its laces, and take a brisk walk." },
  snowman: { clue: "winter figure made of snow", performance: "Roll snowballs, stack them, and place an invisible hat." },
  spaceship: { clue: "travels beyond Earth", performance: "Climb into a cockpit, launch upward, and float in zero gravity." },
  star: { clue: "sparkles in the night", performance: "Point to a tiny light overhead and twinkle with your fingers." },
  suitcase: { clue: "packed for a trip", performance: "Pack a case, close it, and roll it toward a departure gate." },
  sunflower: { clue: "tall yellow garden bloom", performance: "Grow tall, turn your face toward the sun, and sway in the breeze." },
  telescope: { clue: "looks at distant stars", performance: "Adjust a long viewer, peer through it, and point to a discovery." },
  tiger: { clue: "striped big cat", performance: "Prowl quietly, show stripes on your arms, and give a silent growl." },
  train: { clue: "runs on tracks", performance: "Pull a whistle, chug along, and wave from a moving carriage." },
  trumpet: { clue: "brass instrument", performance: "Lift a brass instrument and play a bold fanfare." },
  turtle: { clue: "slow animal with a shell", performance: "Move slowly, hide inside a shell, then peek back out." },
  umbrella: { clue: "opens above you in rain", performance: "Open an umbrella overhead and lean into strong rain and wind." },
  volcano: { clue: "mountain that can erupt", performance: "Shake as the ground rumbles, then erupt upward with both arms." },
  watermelon: { clue: "large green fruit with a pink center", performance: "Lift a heavy melon, slice it, and enjoy a juicy wedge." },
  whale: { clue: "giant animal of the sea", performance: "Swim slowly through deep water and spray a tall spout." },
  wizard: { clue: "magician from a fantasy tale", performance: "Raise a wand, cast a spell, and react as something magical appears." },
};

function bowlBotClue(text: string): string {
  const words = text.toLocaleLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  const hints: Record<string, string> = Object.fromEntries(Object.entries(BOWL_BOT_SCROLLS).map(([word, value]) => [word, value.clue]));
  const match = words.find((word) => Object.hasOwn(hints, word));
  return match ? hints[match]! : "Think about the main object and its usual setting";
}

function bowlBotPerformanceCue(text: string): string {
  const words = text.toLocaleLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  const cues: Record<string, string> = Object.fromEntries(Object.entries(BOWL_BOT_SCROLLS).map(([word, value]) => [word, value.performance]));
  const match = words.find((word) => Object.hasOwn(cues, word));
  return match ? cues[match]! : "Mime the main object from the scroll with one clear repeated movement.";
}

function normalizeFoolBotGuess(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
}

function bowlBotAction(state: RoomState, playerId: string): PlayerAction | null {
  const round = state.currentRound;
  if (state.gameLength !== "bowl-of-fools") return null;
  const action = (type: string, payload: Record<string, unknown>) => PlayerActionSchema.parse({ type, actionId: `bot:${state.version}:${state.phase}:${playerId}:${type}`, roundId: round?.id ?? "lobby", expectedPhase: state.phase, payload }) as PlayerAction;
  if (state.phase === "FOOL_TEAM_SETUP" && !state.foolReadyPlayerIds.includes(playerId)) return action("SET_FOOL_READY", { ready: true });
  if (!round || round.kind !== "BOWL_OF_FOOLS") return null;
  if (state.phase === "FOOL_WRITING" && !round.foolScrolls.some((scroll) => scroll.playerId === playerId)) {
    const bases = Object.keys(BOWL_BOT_SCROLLS);
    const used = new Set(round.foolScrolls.map((scroll) => scroll.text.normalize("NFKC").toLocaleLowerCase()));
    const scrolls = Array.from({ length: state.foolScrollsPerPlayer }, (_, index) => {
      const start = (stableHash(`${state.code}:${playerId}:${index}`) + index) % bases.length;
      let candidate = bases[start]!;
      for (let offset = 0; used.has(candidate.normalize("NFKC").toLocaleLowerCase()) && offset < bases.length; offset += 1) candidate = bases[(start + offset + 1) % bases.length]!;
      used.add(candidate.normalize("NFKC").toLocaleLowerCase());
      return candidate;
    });
    return action("SUBMIT_FOOL_SCROLLS", { scrolls });
  }
  if (!["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(state.phase) || round.foolClueGiverId !== playerId) return null;
  const scroll = round.foolScrolls.find((item) => item.id === round.foolCurrentScrollId)?.text;
  if (!scroll) return null;
  if (round.foolRoundNumber === 1 && !round.foolSpokenClue) return action("SUBMIT_FOOL_CLUE", { clue: bowlBotClue(scroll) });
  if (round.foolRoundNumber === 2 && state.foolPerformance === "CHARADES" && !round.foolPerformanceCue) return action("SUBMIT_FOOL_PERFORMANCE_CUE", { cue: bowlBotPerformanceCue(scroll) });
  if (round.foolRoundNumber === 2 && state.foolPerformance === "DRAWING" && round.foolStrokes.length < 3) {
    const generic = [
      [{ x: 0.18, y: 0.6 }, { x: 0.36, y: 0.3 }, { x: 0.55, y: 0.6 }],
      [{ x: 0.35, y: 0.34 }, { x: 0.65, y: 0.34 }, { x: 0.62, y: 0.77 }, { x: 0.38, y: 0.77 }, { x: 0.35, y: 0.34 }],
      [{ x: 0.2, y: 0.78 }, { x: 0.8, y: 0.78 }],
    ];
    const drawings: Record<string, Array<Array<{ x: number; y: number }>>> = {
      brass: [[{ x: .46, y: .78 }, { x: .48, y: .52 }, { x: .43, y: .36 }, { x: .53, y: .28 }, { x: .59, y: .39 }, { x: .52, y: .45 }, { x: .67, y: .45 }], [{ x: .37, y: .58 }, { x: .55, y: .66 }, { x: .72, y: .58 }, { x: .64, y: .81 }, { x: .43, y: .81 }, { x: .37, y: .58 }], [{ x: .72, y: .45 }, { x: .83, y: .42 }]],
      moonlit: [[{ x: .2, y: .72 }, { x: .8, y: .72 }, { x: .5, y: .28 }, { x: .2, y: .72 }], [{ x: .26, y: .61 }, { x: .74, y: .61 }], [{ x: .77, y: .25 }, { x: .87, y: .3 }, { x: .82, y: .4 }, { x: .74, y: .35 }, { x: .77, y: .25 }]],
      royal: [[{ x: .34, y: .2 }, { x: .36, y: .56 }, { x: .28, y: .8 }, { x: .48, y: .82 }, { x: .61, y: .75 }, { x: .56, y: .68 }, { x: .45, y: .68 }, { x: .44, y: .2 }], [{ x: .34, y: .23 }, { x: .44, y: .23 }], [{ x: .29, y: .8 }, { x: .58, y: .8 }]],
      sleepy: [[{ x: .15, y: .78 }, { x: .42, y: .3 }, { x: .52, y: .47 }, { x: .67, y: .2 }, { x: .87, y: .78 }, { x: .15, y: .78 }], [{ x: .65, y: .18 }, { x: .6, y: .1 }, { x: .68, y: .04 }, { x: .75, y: .11 }], [{ x: .34, y: .78 }, { x: .4, y: .65 }, { x: .46, y: .78 }]],
      tiny: [[{ x: .15, y: .68 }, { x: .2, y: .61 }, { x: .25, y: .68 }, { x: .3, y: .61 }, { x: .35, y: .68 }], [{ x: .45, y: .35 }, { x: .45, y: .76 }, { x: .7, y: .48 }, { x: .45, y: .48 }], [{ x: .78, y: .2 }, { x: .84, y: .26 }, { x: .78, y: .32 }, { x: .72, y: .26 }, { x: .78, y: .2 }]],
      stubborn: [[{ x: .5, y: .14 }, { x: .26, y: .3 }, { x: .38, y: .37 }, { x: .62, y: .37 }, { x: .74, y: .3 }, { x: .5, y: .14 }], [{ x: .5, y: .37 }, { x: .5, y: .82 }], [{ x: .2, y: .65 }, { x: .32, y: .59 }, { x: .25, y: .72 }]],
      wizard: [[{ x: .2, y: .48 }, { x: .5, y: .1 }, { x: .8, y: .48 }, { x: .2, y: .48 }], [{ x: .33, y: .49 }, { x: .3, y: .78 }, { x: .7, y: .78 }, { x: .67, y: .49 }], [{ x: .72, y: .2 }, { x: .78, y: .14 }, { x: .84, y: .2 }, { x: .78, y: .26 }, { x: .72, y: .2 }]],
      bicycle: [[{ x: .28, y: .69 }, { x: .72, y: .69 }, { x: .5, y: .35 }, { x: .28, y: .69 }, { x: .5, y: .69 }, { x: .72, y: .69 }], [{ x: .28, y: .69 }, { x: .22, y: .6 }, { x: .28, y: .51 }, { x: .34, y: .6 }, { x: .28, y: .69 }], [{ x: .72, y: .69 }, { x: .66, y: .6 }, { x: .72, y: .51 }, { x: .78, y: .6 }, { x: .72, y: .69 }]],
    };
    const key = scroll.toLocaleLowerCase().split(/[^\p{L}]+/u).find((word) => Object.hasOwn(drawings, word)) ?? "";
    const designs = drawings[key] ?? generic;
    return action("SUBMIT_FOOL_STROKE", { points: designs[round.foolStrokes.length]! });
  }
  if (round.foolRoundNumber === 2 && state.foolPerformance === "CHARADES" && round.foolPerformanceCue && round.foolBotClueAt === null) return action("SUBMIT_FOOL_PERFORMANCE_CUE", { cue: round.foolPerformanceCue });
  if (round.foolRoundNumber === 3 && !round.foolOneWord) return action("SUBMIT_FOOL_ONE_WORD", { word: bowlBotClue(scroll).split(/\s+/u)[0] ?? "thing" });
  return null;
}

function settleBotTurns(state: RoomState, effects: DbEffect[], now: number): number {
  let turns = runBotTurns(state, effects, now);
  if (state.gameLength === "arcade" && state.phase === "ARCADE_ACTIVE" && (state.deadlineAt === null || now < state.deadlineAt)) {
    const bots = scoringPlayers(state).filter((player) => player.bot);
    const turn = bots.map((bot) => ({ bot, action: arcadeBotAction(state, bot.id) })).find((candidate) => candidate.action);
    if (turn?.action) {
      const applied = applyPlayerAction(state, turn.bot.id, turn.action, now, true);
      Object.assign(state, applied.next);
      effects.push(...applied.effects);
      turns += 1;
    }
  }
  if (state.gameLength === "bowl-of-fools" && (state.deadlineAt === null || now < state.deadlineAt)) {
    const bots = scoringPlayers(state).filter((player) => player.bot);
    let bowlActions = 0;
    for (let guard = 0; guard < Math.max(8, bots.length * 8); guard += 1) {
      let moved = false;
      for (const bot of bots) {
        const action = bowlBotAction(state, bot.id);
        if (!action) continue;
        const applied = applyPlayerAction(state, bot.id, action, now, true);
        Object.assign(state, applied.next);
        effects.push(...applied.effects);
        bowlActions += 1;
        moved = true;
        break;
      }
      if (!moved || !["FOOL_TEAM_SETUP", "FOOL_WRITING", "FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(state.phase)) break;
    }
    turns += bowlActions;
  }
  const round = state.currentRound;
  if (round?.kind === "ROYAL_WAR_ROOM" && state.phase === "WAR_COUNCIL") {
    const commanderId = warCommanderId(state, round);
    const commander = scoringPlayers(state).find((player) => player.id === commanderId && player.bot);
    if (commander) {
      const openRanks = round.warTargetRanks.filter((rank) => !Object.values(round.warPlacements).includes(rank));
      const rank = openRanks[0];
      const choiceId = round.warTrueOrder[rank - 1];
      const team = state.warTeams[commander.id];
      if (rank && choiceId && team) {
        round.warPlacements[choiceId] = rank;
        awardWarPlacement(state, effects, round, team, choiceId, rank);
        round.warLastMove = { playerId: commander.id, team, choiceId, guessedRank: rank, correct: true, actualRank: rank };
        effects.push({ type: "prediction", roundId: round.id, playerId: commander.id, kind: `war_guess:${team}:${round.warTurnNumber}`, payload: { choiceId, rank, correct: true } });
        setPhase(state, "WAR_TURN_REVEAL", now);
        turns += 1;
      }
    }
  }
  if (turns > 0) earlyLock(state, now);
  return turns;
}

function finalizeImposter(state: RoomState, effects: DbEffect[], now: number): void {
  if (!state.imposter || !state.arcadeMatch || state.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
  const result = getImposterResult(state.imposter);
  const activeMatch = state.arcadeMatch;
  state.phase = "ARCADE_RESULTS";
  state.phaseStartedAt = now;
  state.deadlineAt = null;
  state.status = "COMPLETE";
  state.arcadeMatch = { ...activeMatch, status: "COMPLETE", endedAt: now, result: { ...result } };
  effects.push({ type: "arcade_finalize", match: state.arcadeMatch, event: { eventId: `${activeMatch.id}:imposter:complete`, matchId: activeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: { ...result } } });
}

function finalizeBuzzwort(state: RoomState, effects: DbEffect[], now: number): void {
  if (!state.buzzwort || !state.arcadeMatch || state.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
  const result = getBuzzwortResult(state.buzzwort);
  const activeMatch = state.arcadeMatch;
  state.phase = "ARCADE_RESULTS";
  state.phaseStartedAt = now;
  state.deadlineAt = null;
  state.status = "COMPLETE";
  state.arcadeMatch = { ...activeMatch, status: "COMPLETE", endedAt: now, result: { ...result } };
  effects.push({ type: "arcade_finalize", match: state.arcadeMatch, event: { eventId: `${activeMatch.id}:buzzwort:complete`, matchId: activeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: { ...result } } });
}

function finalizePantomime(state: RoomState, effects: DbEffect[], now: number): void {
  if (!state.pantomime || !state.arcadeMatch || state.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
  const result = getPantomimeResult(state.pantomime);
  const activeMatch = state.arcadeMatch;
  state.phase = "ARCADE_RESULTS";
  state.phaseStartedAt = now;
  state.deadlineAt = null;
  state.status = "COMPLETE";
  state.arcadeMatch = { ...activeMatch, status: "COMPLETE", endedAt: now, result: { ...result } };
  effects.push({ type: "arcade_finalize", match: state.arcadeMatch, event: { eventId: `${activeMatch.id}:pantomime:complete`, matchId: activeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: { ...result } } });
}

function finalizeDrawGuess(state: RoomState, effects: DbEffect[], now: number): void {
  if (!state.drawGuess || !state.arcadeMatch || state.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
  const result = getDrawGuessResult(state.drawGuess);
  const activeMatch = state.arcadeMatch;
  state.phase = "ARCADE_RESULTS";
  state.phaseStartedAt = now;
  state.deadlineAt = null;
  state.status = "COMPLETE";
  state.arcadeMatch = { ...activeMatch, status: "COMPLETE", endedAt: now, result: { ...result } };
  effects.push({ type: "arcade_finalize", match: state.arcadeMatch, event: { eventId: `${activeMatch.id}:zeichnen-und-erraten:complete`, matchId: activeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: { ...result } } });
}

function finalizeArenaSurvivor(state: RoomState, effects: DbEffect[], now: number): void {
  if (!state.arenaSurvivor || !state.arcadeMatch || state.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
  const result = getArenaSurvivorResult(state.arenaSurvivor);
  const activeMatch = state.arcadeMatch;
  state.phase = "ARCADE_RESULTS";
  state.phaseStartedAt = now;
  state.deadlineAt = null;
  state.status = "COMPLETE";
  state.arcadeMatch = { ...activeMatch, status: "COMPLETE", endedAt: now, result: { ...result } };
  effects.push({ type: "arcade_finalize", match: state.arcadeMatch, event: { eventId: `${activeMatch.id}:arena-survivor:complete`, matchId: activeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: { ...result } } });
}

export function applyPlayerAction(base: RoomState, participantId: string, action: PlayerAction, now = Date.now(), allowInternalBot = false): { next: RoomState; effects: DbEffect[] } {
  if (base.sketchRelay?.fishTest) throw new Error("FISH_TEST_ACTIVE");
  if (base.phase !== action.expectedPhase) throw new Error("STALE_PHASE");
  const participant = base.participants.find((item) => item.id === participantId && !item.removedAt);
  if (!participant) throw new Error("UNAUTHORIZED");
  if (action.type === "UPDATE_AVATAR") {
    if (!["LOBBY", "FOOL_TEAM_SETUP"].includes(base.phase) || participant.role !== "player") throw new Error("WRONG_PHASE");
    const next = clone(base);
    const nextParticipant = next.participants.find((item) => item.id === participantId)!;
    nextParticipant.avatarConfig = action.payload.avatarConfig;
    nextParticipant.avatarPreset = action.payload.avatarPreset;
    nextParticipant.lastSeenAt = now;
    return { next, effects: [{ type: "participant_state", participant: nextParticipant }] };
  }
  if (action.type === "SUBMIT_SCHAETZORAMA_ESTIMATE") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "schaetzorama" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.schaetzorama) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.schaetzorama.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.schaetzorama.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = submitSchaetzoramaEstimate(base.schaetzorama, { playerId: participantId, estimate: action.payload.estimate, round: action.payload.round, version: base.schaetzorama.version, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base);
    const nextParticipant = next.participants.find((item) => item.id === participantId)!;
    nextParticipant.lastSeenAt = now;
    next.schaetzorama = submitted.state;
    const effects: DbEffect[] = [{ type: "participant_state", participant: nextParticipant }];
    const round = submitted.state.rounds[submitted.state.round - 1]!;
    if (next.schaetzorama.phase === "estimating" && next.schaetzorama.players.every((id) => round.submissions[id] !== undefined)) {
      const revealed = advanceSchaetzorama(next.schaetzorama, { now });
      if (revealed.ok) next.schaetzorama = revealed.state;
    }
    next.deadlineAt = next.schaetzorama.phase === "estimating" ? next.schaetzorama.deadline : scoringPlayers(next).every((player) => player.bot) ? now + 1_500 : null;
    return { next, effects };
  }
  if (action.type === "SUBMIT_IMPOSTER_CLUE" || action.type === "SUBMIT_IMPOSTER_VOTE") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "imposter" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.imposter) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.imposter.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.imposter.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = action.type === "SUBMIT_IMPOSTER_CLUE"
      ? submitImposterClue(base.imposter, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, clue: action.payload.clue, now })
      : submitImposterVote(base.imposter, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, targetPlayerId: action.payload.targetPlayerId, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base);
    next.participants.find((item) => item.id === participantId)!.lastSeenAt = now;
    next.imposter = submitted.state;
    next.deadlineAt = submitted.state.phase === "revealed" ? null : submitted.state.deadline;
    const effects: DbEffect[] = [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }];
    if (submitted.state.phase === "revealed") finalizeImposter(next, effects, now);
    return { next, effects };
  }
  if (action.type === "SUBMIT_BUZZWORT_CLUE" || action.type === "SUBMIT_BUZZWORT_GUESS") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "buzzwort" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.buzzwort) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.buzzwort.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.buzzwort.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = action.type === "SUBMIT_BUZZWORT_CLUE"
      ? submitBuzzwortClue(base.buzzwort, { matchId: action.payload.matchId, round: action.payload.round, attempt: action.payload.attempt, playerId: participantId, text: action.payload.text, now })
      : submitBuzzwortGuess(base.buzzwort, { matchId: action.payload.matchId, round: action.payload.round, attempt: action.payload.attempt, playerId: participantId, guess: action.payload.guess, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base);
    next.participants.find((item) => item.id === participantId)!.lastSeenAt = now;
    next.buzzwort = submitted.state;
    next.deadlineAt = submitted.state.phase === "revealed" ? null : submitted.state.deadline;
    const effects: DbEffect[] = [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }];
    if (submitted.state.phase === "revealed") finalizeBuzzwort(next, effects, now);
    return { next, effects };
  }
  if (action.type === "SUBMIT_PANTOMIME_GUESS") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "pantomime" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.pantomime) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.pantomime.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.pantomime.players.includes(participantId) || base.pantomime.performerId === participantId) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = submitPantomimeGuess(base.pantomime, { matchId: action.payload.matchId, round: action.payload.round, attempt: action.payload.attempt, playerId: participantId, guess: action.payload.guess, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base);
    next.participants.find((item) => item.id === participantId)!.lastSeenAt = now;
    next.pantomime = submitted.state;
    next.deadlineAt = submitted.state.phase === "revealed" ? null : submitted.state.deadline;
    const effects: DbEffect[] = [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }];
    if (submitted.state.phase === "revealed") finalizePantomime(next, effects, now);
    return { next, effects };
  }
  if (action.type === "SUBMIT_PANTOMIME_PERFORMANCE") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "pantomime" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.pantomime) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.pantomime.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || !participant.bot || !allowInternalBot || base.pantomime.performerId !== participantId || base.pantomime.phase !== "acting" || base.pantomime.performanceCue) throw new Error("UNAUTHORIZED");
    if (base.paused || (base.deadlineAt !== null && now >= base.deadlineAt)) throw new Error("DEADLINE_PASSED");
    const next = clone(base);
    next.pantomime!.performanceCue = action.payload.cue;
    next.pantomime!.updatedAt = now;
    next.pantomime!.version += 1;
    next.participants.find((item) => item.id === participantId)!.lastSeenAt = now;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_DRAW_GUESS_DRAWING" || action.type === "SUBMIT_DRAW_GUESS") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "zeichnen-und-erraten" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.drawGuess) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.drawGuess.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.drawGuess.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    if ((action.type === "SUBMIT_DRAW_GUESS_DRAWING" && participantId !== base.drawGuess.artistId) || (action.type === "SUBMIT_DRAW_GUESS" && participantId === base.drawGuess.artistId)) throw new Error("UNAUTHORIZED");
    const submitted = action.type === "SUBMIT_DRAW_GUESS_DRAWING"
      ? submitDrawGuessDrawing(base.drawGuess, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, drawing: action.payload.drawing, now })
      : submitDrawGuess(base.drawGuess, { matchId: action.payload.matchId, round: action.payload.round, attempt: action.payload.attempt, playerId: participantId, guess: action.payload.guess, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base);
    next.participants.find((item) => item.id === participantId)!.lastSeenAt = now;
    next.drawGuess = submitted.state;
    next.deadlineAt = submitted.state.phase === "revealed" ? null : submitted.state.deadline;
    const effects: DbEffect[] = [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }];
    if (submitted.state.phase === "revealed") finalizeDrawGuess(next, effects, now);
    return { next, effects };
  }
  if (action.type === "SUBMIT_ARENA_SURVIVOR_CHOICE") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "arena-survivor" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.arenaSurvivor) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.arenaSurvivor.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.arenaSurvivor.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = chooseArenaSurvivor(base.arenaSurvivor, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, choiceId: action.payload.choiceId, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base);
    next.participants.find((item) => item.id === participantId)!.lastSeenAt = now;
    next.arenaSurvivor = submitted.state;
    next.deadlineAt = submitted.state.phase === "revealed" ? null : submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_CHAOS_TOOL") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "chaos-kommando" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.chaosKommando) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.chaosKommando.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.chaosKommando.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = chooseChaosTool(base.chaosKommando, { matchId: action.payload.matchId, missionNumber: action.payload.missionNumber, playerId: participantId, toolId: action.payload.toolId, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.chaosKommando = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_MAGIC_ARENA_ACTION") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "magic-arena" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.magicArena) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.magicArena.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.magicArena.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = chooseMagicArenaAction(base.magicArena, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, action: action.payload.action, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.magicArena = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_MAGIC_DUELL_LOADOUT" || action.type === "SUBMIT_MAGIC_DUELL_CAST") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "magic-duell" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.magicDuell) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.magicDuell.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.magicDuell.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = action.type === "SUBMIT_MAGIC_DUELL_LOADOUT"
      ? chooseMagicDuellLoadout(base.magicDuell, { matchId: action.payload.matchId, playerId: participantId, spellIds: action.payload.spellIds, now })
      : chooseMagicDuellCast(base.magicDuell, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, spellId: action.payload.spellId, stroke: action.payload.stroke, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.magicDuell = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_MINIONS_TD_ORDER") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "minions-td" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.minionsTd) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.minionsTd.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.minionsTd.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = submitMinionsTdOrder(base.minionsTd, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, order: action.payload.order, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.minionsTd = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_KARTENTISCH_CARD") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "kartentisch" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.kartentisch) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.kartentisch.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.kartentisch.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = chooseKartentischCard(base.kartentisch, { matchId: action.payload.matchId, trick: action.payload.trick, playerId: participantId, cardId: action.payload.cardId, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.kartentisch = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_DUNGEON_PARTY_ACTION") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "dungeon-party" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.dungeonParty) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.dungeonParty.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.dungeonParty.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = chooseDungeonPartyAction(base.dungeonParty, { matchId: action.payload.matchId, encounter: action.payload.encounter, playerId: participantId, actionId: action.payload.actionId, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.dungeonParty = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_FLATTERFLUFF_SHOT") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "flatterfluff" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.flatterfluff) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.flatterfluff.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.flatterfluff.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = fireFlatterfluffShot(base.flatterfluff, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, x: action.payload.x, y: action.payload.y, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.flatterfluff = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_DRIFT_RACER_INPUT") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "drift-racer" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.driftRacer) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.driftRacer.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.driftRacer.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = submitDriftRacerInput(base.driftRacer, { matchId: action.payload.matchId, turn: action.payload.turn, playerId: participantId, input: { throttle: action.payload.throttle, steer: action.payload.steer as -1 | 0 | 1, drift: action.payload.drift, boost: action.payload.boost }, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.driftRacer = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "CHOOSE_SKETCH_CURSE" || action.type === "PREPARE_SKETCH_FINAL" || action.type === "SUBMIT_SKETCH_PROMPT" || action.type === "RANK_SKETCH_PROMPTS" || action.type === "RANK_SKETCH_LAUGHTER" || action.type === "GUESS_SKETCH_ARTISTS" || action.type === "SKETCH_REVEAL_EMOTE") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "sketch-relay" || base.phase !== "ARCADE_ACTIVE" || !base.sketchRelay?.showdown || base.arcadeMatch?.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    const next = clone(base); next.sketchRelay = submitShowdownAction(base.sketchRelay, participantId, action, now).state; const effects: DbEffect[] = []; syncSketchRelayRoom(next, effects, now); return { next, effects };
  }
  if (action.type === "SELECT_SKETCH_PROMPT" || action.type === "SUBMIT_SKETCH_CAPTION" || action.type === "SUBMIT_SKETCH_APPLAUSE") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "sketch-relay" || base.phase !== "ARCADE_ACTIVE" || !base.sketchRelay || base.arcadeMatch?.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.sketchRelay.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    const submitted = action.type === "SELECT_SKETCH_PROMPT" ? selectSketchPrompt(base.sketchRelay, participantId, action.payload, now) : action.type === "SUBMIT_SKETCH_CAPTION" ? submitSketchCaption(base.sketchRelay, participantId, action.payload, now) : submitSketchApplause(base.sketchRelay, participantId, action.payload, now);
    const next = clone(base); next.sketchRelay = submitted.state; const effects: DbEffect[] = []; syncSketchRelayRoom(next, effects, now); return { next, effects };
  }
  if (action.type === "SUBMIT_WORD_TILES_WORD") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "word-tiles" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.wordTiles) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.wordTiles.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.wordTiles.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = chooseWordTilesWord(base.wordTiles, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, word: action.payload.word, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.wordTiles = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SUBMIT_SCHATTENJAGD_VOTE") {
    if (base.gameLength !== "arcade" || base.arcadeGameId !== "schattenjagd" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.schattenjagd) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (action.payload.matchId !== base.arcadeMatch.id || action.payload.matchId !== base.schattenjagd.matchId) throw new Error("ARCADE_MATCH_MISMATCH");
    if (participant.role !== "player" || !participant.active || (participant.bot && !allowInternalBot) || !base.schattenjagd.players.includes(participantId)) throw new Error("UNAUTHORIZED");
    if (base.paused) throw new Error("GAME_PAUSED");
    if (base.deadlineAt !== null && now >= base.deadlineAt) throw new Error("DEADLINE_PASSED");
    const submitted = chooseSchattenjagdSuspect(base.schattenjagd, { matchId: action.payload.matchId, round: action.payload.round, playerId: participantId, suspectId: action.payload.suspectId, now });
    if (!submitted.ok) throw new Error(submitted.code);
    const next = clone(base); next.participants.find((item) => item.id === participantId)!.lastSeenAt = now; next.schattenjagd = submitted.state; next.deadlineAt = submitted.state.deadline;
    return { next, effects: [{ type: "participant_state", participant: next.participants.find((item) => item.id === participantId)! }] };
  }
  if (action.type === "SET_FOOL_READY") {
    if (base.phase !== "FOOL_TEAM_SETUP" || base.gameLength !== "bowl-of-fools" || participant.role !== "player") throw new Error("WRONG_PHASE");
    const next = clone(base);
    const players = scoringPlayers(next);
    if (players.filter((player) => next.foolTeams[player.id] === "BELLS").length < 2 || players.filter((player) => next.foolTeams[player.id] === "MOTLEY").length < 2) throw new Error("BOWL_TEAMS_UNBALANCED");
    const ready = new Set(next.foolReadyPlayerIds);
    if (action.payload.ready) ready.add(participantId); else ready.delete(participantId);
    next.foolReadyPlayerIds = players.filter((player) => ready.has(player.id)).map((player) => player.id);
    if (players.every((player) => ready.has(player.id))) setPhase(next, "INTRO", now, 6_000);
    return { next, effects: [] };
  }
  const round = base.currentRound;
  if (!round || round.id !== action.roundId) throw new Error("WRONG_ROUND");
  if (base.deadlineAt && now > base.deadlineAt && !base.paused) throw new Error("DEADLINE_PASSED");
  const next = clone(base);
  const nextParticipant = next.participants.find((item) => item.id === participantId)!;
  nextParticipant.lastSeenAt = now;
  const nextRound = next.currentRound!;
  const effects: DbEffect[] = [{ type: "participant_state", participant: nextParticipant }];
  if (action.type === "HEARTBEAT") return { next, effects };
  const bowlEffects = applyBowlPlayerAction(next, participantId, action, now);
  if (bowlEffects) return { next, effects: [...effects, ...bowlEffects] };
  if (participant.role === "audience" && action.type !== "SUBMIT_VOTE") throw new Error("AUDIENCE_ACTION_FORBIDDEN");

  if (action.type === "SUBMIT_FOOL_SCROLLS") {
    if (next.phase !== "FOOL_WRITING" || nextRound.kind !== "BOWL_OF_FOOLS" || participant.role !== "player") throw new Error("WRONG_PHASE");
    if (nextRound.foolScrolls.some((scroll) => scroll.playerId === participantId)) throw new Error("ALREADY_SUBMITTED");
    if (action.payload.scrolls.length !== next.foolScrollsPerPlayer) throw new Error("FOOL_SCROLL_COUNT");
    const normalized = action.payload.scrolls.map((text) => text.trim().replace(/\s+/gu, " "));
    if (normalized.some((text) => text.split(/\s+/u).length > 5)) throw new Error("FOOL_SCROLL_WORD_LIMIT");
    const existing = new Set(nextRound.foolScrolls.map((scroll) => scroll.text.toLocaleLowerCase()));
    const incoming = normalized.map((text) => text.toLocaleLowerCase());
    if (new Set(incoming).size !== incoming.length || incoming.some((text) => existing.has(text))) throw new Error("FOOL_SCROLL_DUPLICATE");
    for (const text of normalized) nextRound.foolScrolls.push({ id: makeId("scroll"), playerId: participantId, text, submittedAt: now });
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: "fool_scrolls", payload: { count: normalized.length } });
    const submitted = new Set(nextRound.foolScrolls.map((scroll) => scroll.playerId));
    if (scoringPlayers(next).every((player) => submitted.has(player.id))) startFoolRounds(next, nextRound, now);
  }
  if (action.type === "FOOL_PASS") {
    if (!["FOOL_TURN"].includes(next.phase) || nextRound.kind !== "BOWL_OF_FOOLS" || participantId !== nextRound.foolClueGiverId) throw new Error("NOT_FOOL_CLUE_GIVER");
    if (nextRound.foolPassUsed || nextRound.foolPool.length < 2) throw new Error("FOOL_PASS_UNAVAILABLE");
    const [current, ...rest] = nextRound.foolPool;
    nextRound.foolPool = [...rest, current];
    nextRound.foolCurrentScrollId = nextRound.foolPool[0] ?? null;
    nextRound.foolPassUsed = true;
    nextRound.foolOneWord = null;
    nextRound.foolSpokenClue = null;
    nextRound.foolPerformanceCue = null;
    nextRound.foolBotClueAt = null;
    nextRound.foolStrokes = [];
  }
  if (action.type === "FOOL_CORRECT") {
    if (!["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(next.phase) || nextRound.kind !== "BOWL_OF_FOOLS" || participantId !== nextRound.foolClueGiverId) throw new Error("NOT_FOOL_CLUE_GIVER");
    const scrollId = nextRound.foolCurrentScrollId;
    if (!scrollId) throw new Error("FOOL_SCROLL_MISSING");
    const phaseBefore = next.phase;
    nextRound.foolUndo = { team: nextRound.foolTurnTeam, scrollId, roundNumber: nextRound.foolRoundNumber, previousPhase: phaseBefore };
    next.foolTeamScores[nextRound.foolTurnTeam] += 1;
    nextRound.foolPool = nextRound.foolPool.filter((id) => id !== scrollId);
    nextRound.foolLastResult = { team: nextRound.foolTurnTeam, correct: true };
    nextRound.foolOneWord = null;
    nextRound.foolSpokenClue = null;
    nextRound.foolPerformanceCue = null;
    nextRound.foolBotClueAt = null;
    if (nextRound.foolSuddenDeath) finishFoolGame(next, nextRound, nextRound.foolTurnTeam, now);
    else if (!nextRound.foolPool.length) finishFoolPool(next, nextRound, now);
    else {
      nextRound.foolCurrentScrollId = nextRound.foolPool[0];
      nextRound.foolOneWord = null;
      nextRound.foolStrokes = [];
    }
  }
  if (action.type === "SUBMIT_FOOL_ONE_WORD") {
    if (next.phase !== "FOOL_TURN" || nextRound.kind !== "BOWL_OF_FOOLS" || nextRound.foolRoundNumber !== 3 || participantId !== nextRound.foolClueGiverId) throw new Error("WRONG_PHASE");
    const word = action.payload.word.trim();
    if (!/^\S+$/u.test(word)) throw new Error("FOOL_ONE_WORD_ONLY");
    if (nextRound.foolOneWord) throw new Error("ALREADY_SUBMITTED");
    nextRound.foolOneWord = word;
    if (participant.bot && allowInternalBot) nextRound.foolBotClueAt = now;
  }
  if (action.type === "SUBMIT_FOOL_CLUE") {
    if (next.phase !== "FOOL_TURN" || nextRound.kind !== "BOWL_OF_FOOLS" || nextRound.foolRoundNumber !== 1 || participantId !== nextRound.foolClueGiverId || !participant.bot || !allowInternalBot) throw new Error("WRONG_PHASE");
    if (nextRound.foolSpokenClue) throw new Error("ALREADY_SUBMITTED");
    nextRound.foolSpokenClue = action.payload.clue;
    nextRound.foolBotClueAt = now;
  }
  if (action.type === "SUBMIT_FOOL_PERFORMANCE_CUE") {
    if (next.phase !== "FOOL_TURN" || nextRound.kind !== "BOWL_OF_FOOLS" || nextRound.foolRoundNumber !== 2 || next.foolPerformance !== "CHARADES" || participantId !== nextRound.foolClueGiverId || !participant.bot || !allowInternalBot) throw new Error("WRONG_PHASE");
    if (nextRound.foolPerformanceCue) throw new Error("ALREADY_SUBMITTED");
    nextRound.foolPerformanceCue = action.payload.cue;
    nextRound.foolBotClueAt = now;
  }
  if (action.type === "SUBMIT_FOOL_STROKE") {
    if (next.phase !== "FOOL_TURN" || nextRound.kind !== "BOWL_OF_FOOLS" || nextRound.foolRoundNumber !== 2 || next.foolPerformance !== "DRAWING" || participantId !== nextRound.foolClueGiverId) throw new Error("WRONG_PHASE");
    if (nextRound.foolStrokes.length >= 120) throw new Error("FOOL_DRAWING_FULL");
    nextRound.foolStrokes.push({ id: makeId("stroke"), playerId: participantId, points: action.payload.points });
    if (participant.bot && allowInternalBot && nextRound.foolBotClueAt === null) nextRound.foolBotClueAt = now;
  }

  if (action.type === "SUBMIT_WAR_RANKING") {
    if (next.phase !== "WAR_RANKING" || nextRound.kind !== "ROYAL_WAR_ROOM" || participant.role !== "player") throw new Error("WRONG_PHASE");
    if (nextRound.warRankings[participantId]) throw new Error("ALREADY_SUBMITTED");
    const valid = new Set(nextRound.choiceOptions.map((choice) => choice.id));
    if (action.payload.orderedChoiceIds.length !== valid.size || action.payload.orderedChoiceIds.some((id) => !valid.has(id))) throw new Error("INVALID_WAR_RANKING");
    nextRound.warRankings[participantId] = [...action.payload.orderedChoiceIds];
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: "war_ranking", payload: action.payload });
  }
  if (action.type === "SUBMIT_WAR_SCOUT") {
    if (next.phase !== "WAR_COUNCIL" || nextRound.kind !== "ROYAL_WAR_ROOM" || participant.role !== "player") throw new Error("WRONG_PHASE");
    const team = next.warTeams[participantId];
    if (!team || participantId !== warCommanderId(next, nextRound)) throw new Error("NOT_WAR_COMMANDER");
    if (next.warScoutUsed[team]) throw new Error("WAR_SCOUT_SPENT");
    if (!nextRound.choiceOptions.some((choice) => choice.id === action.payload.choiceId) || nextRound.warPlacements[action.payload.choiceId]) throw new Error("INVALID_CHOICE");
    const actualRank = nextRound.warTrueOrder.indexOf(action.payload.choiceId) + 1;
    if (actualRank < 1) throw new Error("WAR_ORDER_MISSING");
    next.warScoutUsed[team] = true;
    nextRound.warClues.push({ choiceId: action.payload.choiceId, guessedRank: 3, direction: actualRank <= 3 ? "EARLIER" : "LATER", team, scout: true });
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: `war_scout:${team}`, payload: { choiceId: action.payload.choiceId, half: actualRank <= 3 ? "TOP" : "BOTTOM" } });
  }
  if (action.type === "SUBMIT_WAR_GUESS") {
    if (next.phase !== "WAR_COUNCIL" || nextRound.kind !== "ROYAL_WAR_ROOM" || participant.role !== "player") throw new Error("WRONG_PHASE");
    const team = next.warTeams[participantId];
    if (!team || participantId !== warCommanderId(next, nextRound)) throw new Error("NOT_WAR_COMMANDER");
    if (!nextRound.choiceOptions.some((choice) => choice.id === action.payload.choiceId) || nextRound.warPlacements[action.payload.choiceId]) throw new Error("INVALID_CHOICE");
    if (!nextRound.warTargetRanks.includes(action.payload.rank) || Object.values(nextRound.warPlacements).includes(action.payload.rank)) throw new Error("INVALID_WAR_RANK");
    const actualRank = nextRound.warTrueOrder.indexOf(action.payload.choiceId) + 1;
    if (actualRank < 1) throw new Error("WAR_ORDER_MISSING");
    const correct = actualRank === action.payload.rank;
    if (correct) { nextRound.warPlacements[action.payload.choiceId] = actualRank; awardWarPlacement(next, effects, nextRound, team, action.payload.choiceId, actualRank); }
    else nextRound.warClues.push({ choiceId: action.payload.choiceId, guessedRank: action.payload.rank, direction: actualRank < action.payload.rank ? "EARLIER" : "LATER", team });
    nextRound.warLastMove = { playerId: participantId, team, choiceId: action.payload.choiceId, guessedRank: action.payload.rank, correct, ...(correct ? { actualRank } : {}) };
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: `war_guess:${team}:${nextRound.warTurnNumber}`, payload: { choiceId: action.payload.choiceId, rank: action.payload.rank, correct } });
    setPhase(next, "WAR_TURN_REVEAL", now);
  }

  if (action.type === "SUBMIT_ANSWER") {
    if (!["ANSWERING", "FINAL_ANSWERING", "ENCORE_CONTRIBUTING", "ENCORE_FOLLOWUP"].includes(next.phase)) throw new Error("WRONG_PHASE");
    if (nextRound.answers.some((answer) => answer.playerId === participantId)) throw new Error("ALREADY_SUBMITTED");
    const isImagePrompt = ["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL", "COMIC_FRAME", "KING_REQUEST_MYSTERY", "ROYAL_RUMOURS"].includes(nextRound.kind);
    const text = validateAnswer(action.payload.answer, isImagePrompt ? 180 : 90);
    const imageWordLimit = ["KING_REQUEST_MYSTERY", "ROYAL_RUMOURS"].includes(nextRound.kind) ? 18 : 19;
    if (isImagePrompt && text.split(/\s+/u).filter(Boolean).length > imageWordLimit) throw new Error("PICTURE_WORD_LIMIT");
    if (nextRound.catchModifier && !validateCatch(text, nextRound.catchModifier.rule)) throw new Error("CATCH_RULE_FAILED");
    const suppliedSources = action.payload.sourceLoreIds?.filter((id) => next.lore.some((item) => item.id === id)).slice(0, 2);
    const answer: AnswerState = { id: makeId("answer"), playerId: participantId, text, hidden: false, submittedAt: now, sourceLoreIds: suppliedSources?.length ? suppliedSources : nextRound.callbackSourceLoreIds };
    nextRound.answers.push(answer);
    effects.push({ type: "answer", answer, roundId: nextRound.id });
  }
  if (action.type === "SUBMIT_ROYAL_RUMOUR_GUESS") {
    if (next.phase !== "RUMOUR_GUESSING" || nextRound.kind !== "ROYAL_RUMOURS" || participant.role !== "player") throw new Error("WRONG_PHASE");
    const sourceAnswerId = nextRound.royalRumourAssignments[participantId];
    const source = nextRound.answers.find((answer) => answer.id === sourceAnswerId && !answer.hidden);
    if (!source || source.playerId === participantId) throw new Error("RUMOUR_ASSIGNMENT_MISSING");
    if (nextRound.royalRumourGuesses[sourceAnswerId]) throw new Error("ALREADY_SUBMITTED");
    const text = validateAnswer(action.payload.guess, 180);
    if (text.split(/\s+/u).filter(Boolean).length > 18) throw new Error("PICTURE_WORD_LIMIT");
    const guess = { id: makeId("rumour"), playerId: participantId, sourceAnswerId, text, submittedAt: now };
    nextRound.royalRumourGuesses[sourceAnswerId] = guess;
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: "royal_rumour_guess", payload: guess });
  }
  if (action.type === "SUBMIT_KING_REQUEST_VOTE") {
    if (next.gameLength !== "pictures" || next.phase !== "ANSWERING" || nextRound.kind !== "PROMPT_AND_CIRCUMSTANCE" || nextRound.index !== 0) throw new Error("WRONG_PHASE");
    if (!nextRound.answers.some((answer) => answer.playerId === participantId)) throw new Error("ANSWER_REQUIRED");
    if (!nextRound.choiceOptions.some((choice) => choice.id === action.payload.choiceId)) throw new Error("INVALID_CHOICE");
    nextRound.personalChoices[participantId] = action.payload.choiceId;
    nextRound.kingPollEvents.push({ playerId: participantId, choiceId: action.payload.choiceId, votedAt: now });
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: "king_request_poll", payload: action.payload });
  }
  if (action.type === "SUBMIT_VOTE") {
    if (!["VOTING", "FINAL_VOTING", "RUMOUR_VOTING"].includes(next.phase)) throw new Error("WRONG_PHASE");
    if (nextRound.votes.some((vote) => vote.voterId === participantId)) throw new Error("ALREADY_SUBMITTED");
    if (next.phase === "RUMOUR_VOTING") {
      if (action.payload.answerIds.length !== 1) throw new Error("INVALID_RANKING");
      const sourceAnswerId = action.payload.answerIds[0];
      const original = nextRound.answers.find((answer) => answer.id === sourceAnswerId && !answer.hidden);
      const guess = nextRound.royalRumourGuesses[sourceAnswerId];
      if (!original || !guess || !nextRound.royalRumourRevealOrder.includes(sourceAnswerId)) throw new Error("ANSWER_NOT_FOUND");
      if (participant.role === "player" && [original.playerId, guess.playerId].includes(participantId)) throw new Error("SELF_VOTE");
      nextRound.votes.push({ voterId: participantId, answerIds: [sourceAnswerId], audience: participant.role === "audience" });
      effects.push({ type: "vote", roundId: `${nextRound.id}:rumour`, voterId: participantId, answerId: sourceAnswerId, rank: 1, weight: 1, audience: participant.role === "audience" });
    } else {
    const visible = nextRound.answers.filter((answer) => !answer.hidden);
    const kingVote = ["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL", "COMIC_FRAME"].includes(nextRound.kind) && participant.role === "player";
    const eligibleCount = visible.filter((answer) => answer.playerId !== participantId).length;
    const ranked = !kingVote && scoringPlayers(next).length >= 4 && visible.length >= 3 && participant.role === "player";
    const expectedCount = participant.role === "audience" ? 1 : ["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL"].includes(nextRound.kind) ? Math.min(1, eligibleCount) : kingVote ? Math.min(3, eligibleCount) : ranked ? 2 : 1;
    if (expectedCount < 1) throw new Error("NO_ELIGIBLE_VOTES");
    if (action.payload.answerIds.length !== expectedCount || new Set(action.payload.answerIds).size !== expectedCount) throw new Error("INVALID_RANKING");
    for (const answerId of action.payload.answerIds) {
      const answer = visible.find((item) => item.id === answerId);
      if (!answer) throw new Error("ANSWER_NOT_FOUND");
      if (participant.role === "player" && answer.playerId === participantId) throw new Error("SELF_VOTE");
    }
    nextRound.votes.push({ voterId: participantId, answerIds: action.payload.answerIds, audience: participant.role === "audience" });
    const voteRoundId = nextRound.kind === "PROMPT_AND_CIRCUMSTANCE" ? `${nextRound.id}:image` : nextRound.kind === "KING_PROMPTER_FINAL" ? `${nextRound.id}:restoration` : nextRound.kind === "COMIC_FRAME" ? `${nextRound.id}:comic-image` : nextRound.id;
    action.payload.answerIds.forEach((answerId, index) => effects.push({ type: "vote", roundId: voteRoundId, voterId: participantId, answerId, rank: index + 1, weight: participant.role === "audience" ? 1 : kingVote ? expectedCount - index : ranked ? 2 - index : 1, audience: participant.role === "audience" }));
    }
  }
  if (action.type === "SUBMIT_FEEDBACK_VOTE") {
    if (next.gameLength === "pictures") throw new Error("FEEDBACK_CLOSED");
    if (next.status !== "ACTIVE" || ["FINAL_RESULTS", "POST_GAME", "ENDED"].includes(next.phase)) throw new Error("FEEDBACK_CLOSED");
    const hasSubmittedAnswer = nextRound.answers.some((answer) => answer.playerId === participantId);
    const hasSubmittedVote = nextRound.votes.some((vote) => vote.voterId === participantId);
    const feedbackUnlocked = ["ANSWERING", "FINAL_ANSWERING", "ENCORE_CONTRIBUTING", "ENCORE_FOLLOWUP"].includes(next.phase)
      ? hasSubmittedAnswer
      : ["VOTING", "FINAL_VOTING"].includes(next.phase)
        ? hasSubmittedVote
        : next.phase === "PERSONAL_CHOICE"
          ? Object.prototype.hasOwnProperty.call(nextRound.personalChoices, participantId)
          : next.phase === "ROOM_PREDICTION"
            ? Boolean(nextRound.predictions[participantId])
            : next.phase === "AUTHOR_GUESSING"
              ? Boolean(nextRound.authorGuesses[participantId])
              : next.phase === "FINAL_WAGER"
                ? Boolean(nextRound.wagers[participantId])
                : ["ANSWER_LOCK", "VOTE_LOCK", "IMAGE_REVEAL"].includes(next.phase) && (hasSubmittedAnswer || hasSubmittedVote);
    if (!feedbackUnlocked) throw new Error("FEEDBACK_CLOSED");
    const pair = feedbackPair(action.payload.pairId);
    if (!pair || !pair.options.some((option) => option.id === action.payload.choiceId)) throw new Error("INVALID_FEEDBACK_CHOICE");
    if (!feedbackDeckForPlayer(next.id, next.matchNumber, participantId, next.gameLength).some((item) => item.id === pair.id)) throw new Error("INVALID_FEEDBACK_CHOICE");
    next.feedbackVotes ??= [];
    if (next.feedbackVotes.some((vote) => vote.playerId === participantId && vote.pairId === pair.id && vote.matchNumber === next.matchNumber)) throw new Error("FEEDBACK_ALREADY_SUBMITTED");
    const latest = next.feedbackVotes.filter((vote) => vote.playerId === participantId && vote.matchNumber === next.matchNumber).sort((a, b) => b.votedAt - a.votedAt)[0];
    if (latest && now < latest.votedAt + FEEDBACK_COOLDOWN_MS) throw new Error("FEEDBACK_COOLDOWN");
    next.feedbackVotes.push({ playerId: participantId, pairId: pair.id, choiceId: action.payload.choiceId, votedAt: now, matchNumber: next.matchNumber });
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: `feedback:${pair.id}`, payload: { pairId: pair.id, choiceId: action.payload.choiceId, votedAt: now } });
    effects.push({ type: "feedback_vote", eventKey: `${next.id}:${next.matchNumber}:${participantId}:${pair.id}`, pairId: pair.id, choiceId: action.payload.choiceId });
    addScore(next, effects, nextRound.id, participantId, `feedback:${pair.id}`, FEEDBACK_REWARD_POINTS, { pairId: pair.id, choiceId: action.payload.choiceId });
  }
  if (action.type === "SUBMIT_PERSONAL_CHOICE") {
    if (next.phase !== "PERSONAL_CHOICE") throw new Error("WRONG_PHASE");
    const validChoice = nextRound.kind === "BIRTHDAY_BETS"
      ? nextRound.choiceOptions.some((choice) => choice.id === action.payload.choiceId)
      : nextRound.kind === "CROWD_CONTROL"
      ? scoringPlayers(next).some((player) => player.id === action.payload.choiceId)
      : /^([0-9])$/.test(action.payload.choiceId);
    if (!validChoice) throw new Error("INVALID_CHOICE");
    if (Object.prototype.hasOwnProperty.call(nextRound.personalChoices, participantId)) throw new Error("ALREADY_SUBMITTED");
    nextRound.personalChoices[participantId] = action.payload.choiceId;
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: "personal_choice", payload: action.payload });
  }
  if (action.type === "SUBMIT_PREDICTION") {
    if (next.phase !== "ROOM_PREDICTION") throw new Error("WRONG_PHASE");
    if (nextRound.predictions[participantId]) throw new Error("ALREADY_SUBMITTED");
    const expectedLength = nextRound.kind === "CROWD_CONTROL" ? scoringPlayers(next).length : 10;
    if (action.payload.values.length !== expectedLength) throw new Error("PREDICTION_SHAPE");
    if (action.payload.values.reduce((sum, value) => sum + value, 0) !== 100) throw new Error("PREDICTION_TOTAL");
    nextRound.predictions[participantId] = action.payload.values;
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: "room_prediction", payload: action.payload });
  }
  if (action.type === "SUBMIT_AUTHOR_GUESSES") {
    if (next.phase !== "AUTHOR_GUESSING") throw new Error("WRONG_PHASE");
    if (nextRound.authorGuesses[participantId]) throw new Error("ALREADY_SUBMITTED");
    const assigned = nextRound.authorAssignments[participantId] ?? [];
    if (Object.keys(action.payload.guesses).length !== assigned.length || !assigned.every((id) => action.payload.guesses[id])) throw new Error("INCOMPLETE_GUESSES");
    const validAuthors = new Set(scoringPlayers(next).map((player) => player.id));
    const imageIntermission = ["PROMPT_AND_CIRCUMSTANCE", "COMIC_FRAME"].includes(nextRound.kind);
    if (Object.values(action.payload.guesses).some((id) => (!imageIntermission && id === participantId) || !validAuthors.has(id))) throw new Error("INVALID_AUTHOR_GUESS");
    if (imageIntermission && new Set(Object.values(action.payload.guesses)).size !== assigned.length) throw new Error("INVALID_AUTHOR_GUESS");
    nextRound.authorGuesses[participantId] = action.payload.guesses;
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: "author_guesses", payload: action.payload });
  }
  if (action.type === "SUBMIT_KING_DECOY") {
    if (next.phase !== "MYSTERY_DECOYS" || nextRound.kind !== "KING_REQUEST_MYSTERY") throw new Error("WRONG_PHASE");
    const featured = featuredMysteryAnswer(next);
    if (!featured) throw new Error("MYSTERY_NOT_READY");
    if (featured.playerId === participantId) throw new Error("ORIGINAL_AUTHOR_SITS_OUT");
    const decoys = nextRound.kingMysteryDecoys[featured.id] ?? [];
    if (decoys.some((decoy) => decoy.playerId === participantId)) throw new Error("ALREADY_SUBMITTED");
    const text = validateAnswer(action.payload.decoy, 180);
    if (text.split(/\s+/u).filter(Boolean).length > 18) throw new Error("PICTURE_WORD_LIMIT");
    if ([featured.text, ...decoys.map((decoy) => decoy.text)].some((choice) => choice.toLocaleLowerCase() === text.toLocaleLowerCase())) throw new Error("DUPLICATE_DECOY");
    const sealed = action.payload.useRoyalSeal === true;
    if (sealed && nextRound.kingMysterySealUsedByPlayer[participantId]) throw new Error("ROYAL_SEAL_ALREADY_USED");
    const decoy = { id: makeId("decoy"), playerId: participantId, text, submittedAt: now, sealed };
    if (decoy.sealed) nextRound.kingMysterySealUsedByPlayer[participantId] = decoy.id;
    nextRound.kingMysteryDecoys[featured.id] = [...decoys, decoy];
    mysteryPublicIdsForRound(nextRound, featured.id, true);
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: `king_mystery_decoy:${featured.id}`, payload: decoy });
  }
  if (action.type === "SUBMIT_KING_MYSTERY_VOTE") {
    if (next.phase !== "MYSTERY_VOTING" || nextRound.kind !== "KING_REQUEST_MYSTERY") throw new Error("WRONG_PHASE");
    const featured = featuredMysteryAnswer(next);
    if (!featured) throw new Error("MYSTERY_NOT_READY");
    if (featured.playerId === participantId) throw new Error("ORIGINAL_AUTHOR_SITS_OUT");
    const votes = nextRound.kingMysteryVotes[featured.id] ?? {};
    if (votes[participantId]) throw new Error("ALREADY_SUBMITTED");
    const publicIds = mysteryPublicIdsForRound(nextRound, featured.id);
    const choice = mysteryChoices(next).find((item) => publicIds.choices[item.id] === action.payload.choiceId);
    if (!choice) throw new Error("INVALID_CHOICE");
    if (!choice.real && choice.playerId === participantId) throw new Error("SELF_VOTE");
    nextRound.kingMysteryVotes[featured.id] = { ...votes, [participantId]: choice.id };
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: `king_mystery_vote:${featured.id}`, payload: { choiceId: choice.id } });
  }
  if (action.type === "SUBMIT_WAGER") {
    if (next.phase !== "FINAL_WAGER") throw new Error("WRONG_PHASE");
    if (nextRound.wagers[participantId]) throw new Error("ALREADY_SUBMITTED");
    if (action.payload.targetPlayerId === participantId || !scoringPlayers(next).some((player) => player.id === action.payload.targetPlayerId)) throw new Error("INVALID_WAGER_TARGET");
    nextRound.wagers[participantId] = action.payload;
    effects.push({ type: "prediction", roundId: nextRound.id, playerId: participantId, kind: "final_wager", payload: action.payload });
  }
  earlyLock(next, now);
  return { next, effects };
}

function activatePending(state: RoomState, effects: DbEffect[]): void {
  for (const participant of state.participants.filter((item) => item.role === "player" && item.pendingActivation && !item.removedAt)) {
    participant.pendingActivation = false;
    participant.active = true;
    effects.push({ type: "participant_state", participant });
  }
}

export function applyHostAction(base: RoomState, action: HostAction, now = Date.now()): { next: RoomState; effects: DbEffect[] } {
  if (base.phase !== action.expectedPhase) throw new Error("STALE_PHASE");
  if (base.currentRound && base.currentRound.id !== action.roundId && action.type !== "SET_CONFIG") throw new Error("WRONG_ROUND");
  if (action.type === "JUDGE_BOT_FOOL") {
    const round = base.currentRound;
    const bot = round?.kind === "BOWL_OF_FOOLS" && round.foolClueGiverId
      ? base.participants.find((participant) => participant.id === round.foolClueGiverId && participant.role === "player" && participant.active && participant.bot)
      : undefined;
    if (base.gameLength !== "bowl-of-fools" || !["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(base.phase) || !round || round.kind !== "BOWL_OF_FOOLS" || !bot) throw new Error("BOT_JUDGE_UNAVAILABLE");
    if (round.foolBotClueAt == null) throw new Error("FOOL_BOT_PERFORMANCE_PENDING");
    if (action.payload.decision === "correct") {
      const guess = action.payload.guess?.trim();
      if (!guess) throw new Error("FOOL_GUESS_REQUIRED");
      if (guess.length > 100) throw new Error("FOOL_GUESS_TOO_LONG");
      const scroll = round.foolScrolls.find((item) => item.id === round.foolCurrentScrollId);
      if (!scroll || normalizeFoolBotGuess(guess) !== normalizeFoolBotGuess(scroll.text)) throw new Error("FOOL_BOT_GUESS_INCORRECT");
    }
    if (action.payload.decision === "pass" && base.phase !== "FOOL_TURN") throw new Error("FOOL_PASS_UNAVAILABLE");
    const playerAction = PlayerActionSchema.parse({ type: action.payload.decision === "correct" ? "FOOL_CORRECT" : "FOOL_PASS", actionId: `host-bot-judge:${base.version}:${action.payload.decision}`, roundId: round.id, expectedPhase: base.phase, payload: {} });
    return applyPlayerAction(base, bot.id, playerAction, now, true);
  }
  const next = clone(base);
  const effects: DbEffect[] = [];
  if (base.sketchRelay?.fishTest) throw new Error("FISH_TEST_ACTIVE");
  if (action.type === "START_FISH_TEST") {
    if (next.phase !== "LOBBY" || next.status !== "LOBBY" || next.gameLength !== "arcade" || next.arcadeGameId !== "sketch-relay" || next.sketchRelay) throw new Error("FISH_TEST_UNAVAILABLE");
    const players = next.participants.filter(player => player.role === "player" && player.active && !player.pendingActivation && !player.removedAt).sort((a, b) => a.seat - b.seat);
    if (players.length < 3 || players.length > 10) throw new Error("FISH_TEST_NEEDS_THREE");
    const botIds = players.filter(player => player.bot).map(player => player.id);
    if (!players.some(player => !player.bot)) throw new Error("FISH_TEST_NEEDS_HUMAN");
    const matchId = makeId("fish-test");
    // Do not run Sketch & Sorcery's prompt-writing bot practice when this marker
    // is active. These room seats are carried only for frozen identity/validation.
    const sketch = createSketchRelayMatch({ rulesVersion: 3, matchId, players: players.map(player => player.id), now, seed: stableHash(`${next.id}:${now}`), timerAccessibility: next.timerAccessibility });
    sketch.fishTest = true;
    sketch.fishTestPreviousJoiningLocked = next.joiningLocked;
    sketch.botIds = botIds;
    let finale = createFishFinale({ matchId, seed: randomUuid(), now, players: players.map(player => ({ id: player.id, name: player.nickname, bot: player.bot })) });
    const fishHost: { id: string; host: true } = { id: "host", host: true };
    const apply = (type: FishFinaleAction["type"], payload: Record<string, unknown>) => {
      finale = applyFishFinaleAction(finale, fishHost, { type, payload: { matchId, finaleId: finale.finaleId, phase: finale.phase, ...payload } } as FishFinaleAction, now);
    };
    apply("FISH_CONFIGURE", { mode: action.payload.mode ?? "shark", drawingSeconds: action.payload.drawingSeconds ?? 240 });
    apply("FISH_START", {});
    apply("FISH_ADVANCE", {});
    sketch.finale = finale;
    next.sketchRelay = sketch;
    next.phase = "LOBBY";
    next.status = "LOBBY";
    next.phaseStartedAt = now;
    next.deadlineAt = null;
    next.paused = false;
    next.remainingMs = null;
    next.updatedAt = now;
    return { next, effects };
  }
  if (action.type === "ADD_BOT") {
    if (next.phase !== "LOBBY") throw new Error("WRONG_PHASE");
    if (!supportsLobbyBots(next)) throw new Error(next.gameLength === "arcade" ? "ARCADE_NO_BOTS" : "BOTS_UNAVAILABLE");
    if (scoringPlayers(next).length >= 10) throw new Error("ROOM_FULL");
    const seat = chooseLobbySlot(next, false);
    if (!seat) throw new Error("ROOM_FULL");
    next.botSeats = [...new Set([...next.botSeats, seat])].sort((left, right) => left - right);
    const bot = createLobbyBot(next, now, seat);
    next.participants.push(bot.participant);
    effects.push({ type: "participant_add", ...bot });
  }
  if (action.type === "SET_BOT_SEAT") {
    if (next.phase !== "LOBBY" || next.status !== "LOBBY") throw new Error("WRONG_PHASE");
    if (!supportsLobbyBots(next)) throw new Error(next.gameLength === "arcade" ? "ARCADE_NO_BOTS" : "BOTS_UNAVAILABLE");
    const { seat, enabled } = action.payload;
    const current = next.participants.find((participant) => participant.role === "player" && participant.lobbySlot === seat && !participant.removedAt);
    if (enabled && !current && scoringPlayers(next).length >= 10) throw new Error("ROOM_FULL");
    next.botSeats = enabled
      ? [...new Set([...next.botSeats, seat])].sort((left, right) => left - right)
      : next.botSeats.filter((candidate) => candidate !== seat);
    reconcileBotSeat(next, seat, effects, now);
  }
  if (action.type === "START_GAME") {
    if (base.soloMode && base.gameLength === "arcade") throw new Error("FISH_TEST_ONLY");
    if (next.phase !== "LOBBY") throw new Error("WRONG_PHASE");
    if (next.gameLength === "bowl") { startBowlGame(next, now); return { next, effects }; }
    if (!supportsLobbyBots(next) && next.participants.some((participant) => participant.bot && !participant.removedAt)) {
      for (const bot of next.participants.filter((participant) => participant.bot && !participant.removedAt)) {
        bot.active = false; bot.removedAt = now; effects.push({ type: "participant_state", participant: bot });
      }
      next.botSeats = [];
    }
    if (next.gameLength === "arcade") {
      if (!next.arcadeGameId) throw new Error("ARCADE_GAME_REQUIRED");
      if (next.arcadeGameId !== "drift-racer" && next.arcadeGameId !== "fish-tank" && scoringPlayers(next).length < 2) throw new Error("NOT_ENOUGH_PLAYERS");
      if (next.arcadeGameId === "imposter" && scoringPlayers(next).length < 3) throw new Error("IMPOSTER_NEEDS_THREE");
      const created = createArcadeMatch(next, next.arcadeGameId, now);
      if (next.arcadeGameId === "schaetzorama") {
        const match = createSchaetzoramaMatch({ matchId: created.room.arcadeMatch!.id, players: scoringPlayers(created.room).map((player) => player.id), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`) });
        created.room.schaetzorama = match;
        created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "imposter") {
        const match = createImposterMatch({ matchId: created.room.arcadeMatch!.id, players: selectArcadeControllerIds("imposter", created.room.participants, created.room.matchNumber), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`) });
        created.room.imposter = match;
        created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "buzzwort") {
        if (scoringPlayers(next).length < 3) throw new Error("BUZZWORT_NEEDS_THREE");
        const match = createBuzzwortMatch({ matchId: created.room.arcadeMatch!.id, players: selectArcadeControllerIds("buzzwort", created.room.participants, created.room.matchNumber), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`) });
        created.room.buzzwort = match;
        created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "pantomime") {
        if (scoringPlayers(next).length < 3) throw new Error("PANTOMIME_NEEDS_THREE");
        const match = createPantomimeMatch({ matchId: created.room.arcadeMatch!.id, players: selectArcadeControllerIds("pantomime", created.room.participants, created.room.matchNumber), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`) });
        created.room.pantomime = match;
        created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "zeichnen-und-erraten") {
        if (scoringPlayers(next).length < 3) throw new Error("DRAW_GUESS_NEEDS_THREE");
        const match = createDrawGuessMatch({ matchId: created.room.arcadeMatch!.id, players: selectArcadeControllerIds("zeichnen-und-erraten", created.room.participants, created.room.matchNumber), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`) });
        created.room.drawGuess = match;
        created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "arena-survivor") {
        if (scoringPlayers(next).length < 3) throw new Error("ARENA_SURVIVOR_NEEDS_THREE");
        const match = createArenaSurvivorMatch({ matchId: created.room.arcadeMatch!.id, players: selectArcadeControllerIds("arena-survivor", created.room.participants, created.room.matchNumber), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`) });
        created.room.arenaSurvivor = match;
        created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "chaos-kommando") {
        if (scoringPlayers(next).length < 3) throw new Error("CHAOS_KOMMANDO_NEEDS_THREE");
        const match = createChaosMatch({ matchId: created.room.arcadeMatch!.id, players: scoringPlayers(created.room).map((player) => player.id), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`) });
        created.room.chaosKommando = match; created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "magic-arena") {
        const players = selectArcadeControllerIds("magic-arena", created.room.participants, created.room.matchNumber);
        if (players.length < 2 || players.length > 10) throw new Error("MAGIC_ARENA_NEEDS_TWO");
        const match = createMagicArenaMatch({ matchId: created.room.arcadeMatch!.id, players, now });
        created.room.magicArena = match; created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "magic-duell") {
        const players = selectArcadeControllerIds("magic-duell", created.room.participants, created.room.matchNumber);
        if (players.length < 2 || players.length > 10) throw new Error("MAGIC_DUELL_NEEDS_TWO");
        created.room.magicDuell = createMagicDuellMatch({ matchId: created.room.arcadeMatch!.id, players, now }); created.room.deadlineAt = created.room.magicDuell.deadline;
      }
      if (next.arcadeGameId === "minions-td") {
        const selected = selectArcadeControllerIds("minions-td", created.room.participants, created.room.matchNumber);
        if (selected.length < 2 || selected.length > 10) throw new Error("MINIONS_TD_NEEDS_TWO");
        const players = selected;
        created.room.minionsTd = createMinionsTdMatch({ matchId: created.room.arcadeMatch!.id, players, now }); created.room.deadlineAt = created.room.minionsTd.deadline;
      }
      if (next.arcadeGameId === "kartentisch") {
        if (scoringPlayers(next).length < 3) throw new Error("KARTENTISCH_NEEDS_THREE");
        const match = createKartentischMatch({ matchId: created.room.arcadeMatch!.id, players: selectArcadeControllerIds("kartentisch", created.room.participants, created.room.matchNumber), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`) });
        created.room.kartentisch = match; created.room.deadlineAt = match.deadline;
      }
      if (next.arcadeGameId === "dungeon-party") {
        const players = selectArcadeControllerIds("dungeon-party", created.room.participants, created.room.matchNumber);
        if (players.length < 3) throw new Error("DUNGEON_PARTY_NEEDS_THREE");
        created.room.dungeonParty = createDungeonPartyMatch({ matchId: created.room.arcadeMatch!.id, players, now }); created.room.deadlineAt = created.room.dungeonParty.deadline;
      }
      if (next.arcadeGameId === "flatterfluff") {
        const players = selectArcadeControllerIds("flatterfluff", created.room.participants, created.room.matchNumber);
        if (players.length < 2) throw new Error("FLATTERFLUFF_NEEDS_TWO");
        const seed = stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`);
        created.room.flatterfluff = createFlatterfluffMatch({ matchId: created.room.arcadeMatch!.id, players, now, seed }); created.room.deadlineAt = created.room.flatterfluff.deadline;
      }
      if (next.arcadeGameId === "drift-racer") {
        const players = selectArcadeControllerIds("drift-racer", created.room.participants, created.room.matchNumber);
        created.room.driftRacer = createDriftRacerMatch({ matchId: created.room.arcadeMatch!.id, players, now }); created.room.deadlineAt = created.room.driftRacer.deadline;
      }
      if (next.arcadeGameId === "fish-tank") {
        const players = selectArcadeControllerIds("fish-tank", created.room.participants, created.room.matchNumber);
        if (players.length < 1) throw new Error("FISH_NEEDS_ONE");
        created.room.fishGame = createFishFinale({ matchId: created.room.arcadeMatch!.id, players: players.map(id => { const player = created.room.participants.find(p => p.id === id)!; return { id, name: player.nickname, bot: Boolean(player.bot) }; }), seed: randomUuid(), now });
        created.room.arcadeMatch!.controllerIds = players;
      }
      if (next.arcadeGameId === "sketch-relay") {
        const players = selectArcadeControllerIds("sketch-relay", created.room.participants, created.room.matchNumber);
        created.room.sketchRelay = createSketchRelayMatch({ rulesVersion: 4, sorceryLength: created.room.sorceryLength ?? "long", matchId: created.room.arcadeMatch!.id, players, botIds: created.room.participants.filter(p => p.bot && players.includes(p.id)).map(p => p.id), now, seed: stableHash(`${created.room.id}:${created.room.matchNumber}`), timerAccessibility: created.room.timerAccessibility }); created.room.arcadeMatch!.controllerIds = players; created.room.deadlineAt = created.room.sketchRelay.deadline;
        const effects: DbEffect[] = [created.effect]; syncSketchRelayRoom(created.room, effects, now); return { next: created.room, effects };
      }
      if (next.arcadeGameId === "word-tiles") {
        const players = selectArcadeControllerIds("word-tiles", created.room.participants, created.room.matchNumber);
        if (players.length < 2) throw new Error("WORD_TILES_NEEDS_TWO");
        const seed = stableHash(`${created.room.id}:${created.room.matchNumber}:${created.room.arcadeMatch!.id}`);
        created.room.wordTiles = createWordTilesMatch({ matchId: created.room.arcadeMatch!.id, players, now, seed }); created.room.deadlineAt = created.room.wordTiles.deadline;
      }
      if (next.arcadeGameId === "schattenjagd") {
        const players = selectArcadeControllerIds("schattenjagd", created.room.participants, created.room.matchNumber);
        if (players.length < 2) throw new Error("SCHATTENJAGD_NEEDS_TWO");
        created.room.schattenjagd = createSchattenjagdMatch({ matchId: created.room.arcadeMatch!.id, players, now }); created.room.deadlineAt = created.room.schattenjagd.deadline;
      }
      return { next: created.room, effects: [created.effect] };
    }
    if (scoringPlayers(next).length < 2) throw new Error("NOT_ENOUGH_PLAYERS");
    if (next.gameLength === "royal-war-room" && scoringPlayers(next).length < 3) throw new Error("WAR_ROOM_NEEDS_THREE");
    if (["king-mystery", "royal-rumours"].includes(next.gameLength) && scoringPlayers(next).length < 3) throw new Error("VISUAL_CHAIN_NEEDS_THREE");
    if (next.gameLength === "bowl-of-fools" && scoringPlayers(next).length < 4) throw new Error("BOWL_NEEDS_FOUR");
    if (next.gameLength === "birthday" && !scoringPlayers(next).some((player) => player.id === next.birthdayPersonId)) throw new Error("BIRTHDAY_PERSON_REQUIRED");
    if (next.gameLength === "royal-war-room") { next.warCampaign = campaignForMatch(next.matchNumber); assignWarTeams(next); next.warTeamScores = { LION: 0, RAVEN: 0 }; next.warScoutUsed = { LION: false, RAVEN: false }; }
    if (next.gameLength === "bowl-of-fools") {
      assignFoolTeams(next);
      next.foolTeamScores = { BELLS: 0, MOTLEY: 0 };
      next.foolWinner = null;
      next.joiningLocked = true;
      next.status = "ACTIVE";
      setPhase(next, "FOOL_TEAM_SETUP", now);
    } else {
      next.status = "ACTIVE";
      setPhase(next, "INTRO", now, next.gameLength === "pictures" ? 40_000 : ["king-mystery", "royal-rumours", "royal-war-room"].includes(next.gameLength) ? 28_000 : undefined);
    }
  }
  if (action.type === "ADVANCE_ARCADE") {
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "schaetzorama" || !next.schaetzorama || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    const expectedMatchPhase = action.payload.transition === "reveal" ? "estimating" : "revealing";
    if (action.payload.matchId !== next.arcadeMatch.id || action.payload.matchId !== next.schaetzorama.matchId || action.payload.round !== next.schaetzorama.round || next.schaetzorama.phase !== expectedMatchPhase) throw new Error("STALE_ARCADE_TRANSITION");
    const advanced = advanceSchaetzorama(next.schaetzorama, { now });
    if (!advanced.ok) throw new Error(advanced.code);
    next.schaetzorama = advanced.state;
    next.deadlineAt = advanced.state.phase === "estimating" ? advanced.state.deadline : scoringPlayers(next).every((player) => player.bot) ? now + 1_500 : null;
    if (advanced.state.phase === "completed") {
      const result = getSchaetzoramaResult(advanced.state);
      next.phase = "ARCADE_RESULTS";
      next.phaseStartedAt = now;
      next.deadlineAt = null;
      next.status = "COMPLETE";
      next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:schaetzorama:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
  }
  if (action.type === "ADVANCE_PANTOMIME") {
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "pantomime" || !next.pantomime || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== next.arcadeMatch.id || action.payload.matchId !== next.pantomime.matchId || action.payload.round !== next.pantomime.round || next.pantomime.phase !== "acting") throw new Error("STALE_ARCADE_TRANSITION");
    const revealed = revealPantomime(next.pantomime, { now });
    if (!revealed.ok) throw new Error(revealed.code);
    next.pantomime = revealed.state;
    finalizePantomime(next, effects, now);
  }
  if (action.type === "ADVANCE_DRAW_GUESS") {
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "zeichnen-und-erraten" || !next.drawGuess || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== next.arcadeMatch.id || action.payload.matchId !== next.drawGuess.matchId || action.payload.round !== next.drawGuess.round || next.drawGuess.phase === "revealed") throw new Error("STALE_ARCADE_TRANSITION");
    const revealed = revealDrawGuess(next.drawGuess, { now });
    if (!revealed.ok) throw new Error(revealed.code);
    next.drawGuess = revealed.state;
    finalizeDrawGuess(next, effects, now);
  }
  if (action.type === "ADVANCE_ARENA_SURVIVOR") {
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "arena-survivor" || !next.arenaSurvivor || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== next.arcadeMatch.id || action.payload.matchId !== next.arenaSurvivor.matchId || action.payload.round !== next.arenaSurvivor.round || next.arenaSurvivor.phase === "revealed") throw new Error("STALE_ARCADE_TRANSITION");
    const revealed = revealArenaSurvivor(next.arenaSurvivor, { now });
    if (!revealed.ok) throw new Error(revealed.code);
    next.arenaSurvivor = revealed.state;
    finalizeArenaSurvivor(next, effects, now);
  }
  if (action.type === "ADVANCE_CHAOS_KOMMANDO") {
    const match = next.chaosKommando;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "chaos-kommando" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.missionNumber !== match.missionNumber) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "next") {
      const advanced = nextChaosMission(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
      next.chaosKommando = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = advanceChaosMission(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.chaosKommando = revealed.state;
      if (match.missionNumber === 4) {
        const complete = finishChaosMatch(revealed.state); next.chaosKommando = complete;
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = complete.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:chaos-kommando:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "ADVANCE_MAGIC_ARENA") {
    const match = next.magicArena;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "magic-arena" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.round !== match.round) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "next") {
      const advanced = advanceMagicArenaRound(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
      next.magicArena = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = revealMagicArenaRound(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.magicArena = revealed.state;
      if (revealed.state.phase === "complete") {
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = revealed.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:magic-arena:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "ADVANCE_MAGIC_DUELL") {
    const match = next.magicDuell;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "magic-duell" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.round !== match.round) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "begin") {
      const begun = beginMagicDuell(match, { now }); if (!begun.ok) throw new Error(begun.code);
      next.magicDuell = begun.state; next.deadlineAt = begun.state.deadline;
    } else if (action.payload.transition === "next") {
      const advanced = advanceMagicDuellRound(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
      next.magicDuell = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = revealMagicDuellRound(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.magicDuell = revealed.state;
      if (revealed.state.phase === "complete") {
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = revealed.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:magic-duell:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "ADVANCE_MINIONS_TD") {
    const match = next.minionsTd;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "minions-td" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.round !== match.round) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "next") {
      const advanced = advanceMinionsTdRound(match, { transition: "next", now }); if (!advanced.ok) throw new Error(advanced.code);
      next.minionsTd = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = resolveMinionsTdRound(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.minionsTd = revealed.state;
      if (revealed.state.phase === "complete") {
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = revealed.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:minions-td:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "ADVANCE_KARTENTISCH") {
    const match = next.kartentisch;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "kartentisch" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.trick !== match.trick) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "next") {
      const advanced = advanceKartentischTrick(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
      next.kartentisch = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = revealKartentischTrick(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.kartentisch = revealed.state;
      if (revealed.state.phase === "complete") {
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = revealed.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:kartentisch:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "ADVANCE_DUNGEON_PARTY") {
    const match = next.dungeonParty;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "dungeon-party" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.encounter !== match.encounter) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "next") {
      const advanced = nextDungeonPartyEncounter(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
      next.dungeonParty = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = revealDungeonPartyEncounter(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.dungeonParty = revealed.state;
      if (revealed.state.phase === "complete") {
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = revealed.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:dungeon-party:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "ADVANCE_FLATTERFLUFF") {
    const match = next.flatterfluff;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "flatterfluff" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.round !== match.round) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "next") {
      const advanced = nextFlatterfluffRound(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
      next.flatterfluff = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = revealFlatterfluffRound(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.flatterfluff = revealed.state;
      if (revealed.state.phase === "complete") {
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = getFlatterfluffResult(revealed.state) as unknown as Record<string, unknown>; next.arcadeMatch = { ...next.arcadeMatch!, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:flatterfluff:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "ADVANCE_DRIFT_RACER") {
    const match = next.driftRacer;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "drift-racer" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.turn !== match.turn) throw new Error("STALE_ARCADE_TRANSITION");
    const advanced = advanceDriftRacer(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
    next.driftRacer = advanced.state;
    if (advanced.state.phase === "results") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
      const result = getDriftRacerResult(advanced.state) as unknown as Record<string, unknown>; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:drift-racer:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    } else next.deadlineAt = advanced.state.deadline;
  }
  if (action.type === "ADVANCE_SKETCH_RELAY") {
    const match = next.sketchRelay;
    if (next.arcadeGameId !== "sketch-relay" || !match || !next.arcadeMatch || action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.round !== match.round || action.payload.phase !== match.phase) throw new Error("STALE_ARCADE_TRANSITION");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.transition === "replay") {
      if (next.phase === "ARCADE_ACTIVE" && match.phase === "revealing" && next.arcadeMatch.status === "ACTIVE") { next.sketchRelay = replaySketchRelayReveal(match, now); syncSketchRelayRoom(next, effects, now); return { next, effects }; }
      if (next.phase !== "ARCADE_RESULTS" || match.phase !== "complete") throw new Error("ROUND_CLOSED");
      return applyHostAction(next, { ...action, type: "PLAY_AGAIN", payload: {} }, now);
    }
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    next.sketchRelay = advanceSketchRelay(match, now, true).state; syncSketchRelayRoom(next, effects, now);
  }
  if (action.type === "ADVANCE_WORD_TILES") {
    const match = next.wordTiles;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "word-tiles" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.round !== match.round) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "next") {
      const advanced = nextWordTilesRound(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
      next.wordTiles = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = revealWordTilesRound(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.wordTiles = revealed.state;
      if (revealed.state.phase === "complete") {
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = revealed.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:word-tiles:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "ADVANCE_SCHATTENJAGD") {
    const match = next.schattenjagd;
    if (next.phase !== "ARCADE_ACTIVE" || next.arcadeGameId !== "schattenjagd" || !match || !next.arcadeMatch || next.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.paused) throw new Error("GAME_PAUSED");
    if (action.payload.matchId !== match.matchId || action.payload.matchId !== next.arcadeMatch.id || action.payload.round !== match.round) throw new Error("STALE_ARCADE_TRANSITION");
    if (action.payload.transition === "next") {
      const advanced = nextSchattenjagdCase(match, { now }); if (!advanced.ok) throw new Error(advanced.code);
      next.schattenjagd = advanced.state; next.deadlineAt = advanced.state.deadline;
    } else {
      const revealed = revealSchattenjagdCase(match, { now }); if (!revealed.ok) throw new Error(revealed.code);
      next.schattenjagd = revealed.state;
      if (revealed.state.phase === "complete") {
        next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
        const result = revealed.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
        effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${match.matchId}:schattenjagd:complete`, matchId: match.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
      } else next.deadlineAt = null;
    }
  }
  if (action.type === "PAUSE") {
    if (next.paused) throw new Error("CANNOT_PAUSE");
    if (next.gameLength === "arcade" && next.arcadeGameId === "schaetzorama" && next.schaetzorama?.phase === "revealing") throw new Error("ARCADE_REVEAL_NO_PAUSE");
    if (next.gameLength === "arcade" && next.phase === "ARCADE_ACTIVE") {
      if (next.arcadeGameId === "schaetzorama" && next.schaetzorama) next.remainingMs = Math.max(0, next.schaetzorama.deadline - now);
      if (next.arcadeGameId === "imposter" && next.imposter) next.remainingMs = Math.max(0, next.imposter.deadline - now);
      if (next.arcadeGameId === "buzzwort" && next.buzzwort) next.remainingMs = Math.max(0, next.buzzwort.deadline - now);
      if (next.arcadeGameId === "pantomime" && next.pantomime) next.remainingMs = Math.max(0, next.pantomime.deadline - now);
      if (next.arcadeGameId === "zeichnen-und-erraten" && next.drawGuess) next.remainingMs = Math.max(0, next.drawGuess.deadline - now);
      if (next.arcadeGameId === "arena-survivor" && next.arenaSurvivor) next.remainingMs = Math.max(0, next.arenaSurvivor.deadline - now);
      if (next.arcadeGameId === "chaos-kommando" && next.chaosKommando?.phase === "choosing") next.remainingMs = Math.max(0, next.chaosKommando.deadline - now);
      if (next.arcadeGameId === "magic-arena" && next.magicArena?.phase === "choosing") next.remainingMs = Math.max(0, next.magicArena.deadline - now);
      if (next.arcadeGameId === "magic-duell" && next.magicDuell && ["drafting", "casting"].includes(next.magicDuell.phase)) next.remainingMs = Math.max(0, next.magicDuell.deadline - now);
      if (next.arcadeGameId === "minions-td" && next.minionsTd?.phase === "choosing") next.remainingMs = Math.max(0, next.minionsTd.deadline - now);
      if (next.arcadeGameId === "kartentisch" && next.kartentisch?.phase === "playing") next.remainingMs = Math.max(0, next.kartentisch.deadline - now);
      if (next.arcadeGameId === "dungeon-party" && next.dungeonParty?.phase === "choosing") next.remainingMs = Math.max(0, next.dungeonParty.deadline - now);
      if (next.arcadeGameId === "flatterfluff" && next.flatterfluff?.phase === "aiming") next.remainingMs = Math.max(0, next.flatterfluff.deadline - now);
      if (next.arcadeGameId === "drift-racer" && next.driftRacer?.phase === "racing") next.remainingMs = Math.max(0, next.driftRacer.deadline - now);
      if (next.arcadeGameId === "sketch-relay" && next.sketchRelay) next.remainingMs = Math.max(0, next.sketchRelay.deadline - now);
      if (next.arcadeGameId === "word-tiles" && next.wordTiles?.phase === "choosing") next.remainingMs = Math.max(0, next.wordTiles.deadline - now);
      if (next.arcadeGameId === "schattenjagd" && next.schattenjagd?.phase === "choosing") next.remainingMs = Math.max(0, next.schattenjagd.deadline - now);
      next.deadlineAt = null; next.paused = true;
    }
    else {
      if (!next.deadlineAt) throw new Error("CANNOT_PAUSE");
      next.remainingMs = Math.max(0, next.deadlineAt - now); next.deadlineAt = null; next.paused = true;
    }
  }
  if (action.type === "RESUME") {
    if (!next.paused) throw new Error("NOT_PAUSED");
    if (next.gameLength === "arcade" && next.arcadeGameId === "schaetzorama" && next.schaetzorama?.phase === "revealing") throw new Error("ARCADE_REVEAL_NO_PAUSE");
    if (next.gameLength === "arcade" && next.phase === "ARCADE_ACTIVE") {
      if (next.arcadeGameId === "schaetzorama" && next.schaetzorama) {
        next.schaetzorama.deadline = now + (next.remainingMs ?? 0);
        next.schaetzorama.updatedAt = now;
        next.schaetzorama.version += 1;
        next.deadlineAt = next.schaetzorama.deadline;
      } else if (next.arcadeGameId === "imposter" && next.imposter) {
        next.imposter.deadline = now + (next.remainingMs ?? 0);
        next.imposter.updatedAt = now;
        next.imposter.version += 1;
        next.deadlineAt = next.imposter.deadline;
      } else if (next.arcadeGameId === "buzzwort" && next.buzzwort) {
        next.buzzwort.deadline = now + (next.remainingMs ?? 0);
        next.buzzwort.updatedAt = now;
        next.buzzwort.version += 1;
        next.deadlineAt = next.buzzwort.deadline;
      } else if (next.arcadeGameId === "pantomime" && next.pantomime) {
        next.pantomime.deadline = now + (next.remainingMs ?? 0);
        next.pantomime.updatedAt = now;
        next.pantomime.version += 1;
        next.deadlineAt = next.pantomime.deadline;
      } else if (next.arcadeGameId === "zeichnen-und-erraten" && next.drawGuess) {
        next.drawGuess.deadline = now + (next.remainingMs ?? 0);
        next.drawGuess.updatedAt = now;
        next.drawGuess.version += 1;
        next.deadlineAt = next.drawGuess.deadline;
      } else if (next.arcadeGameId === "arena-survivor" && next.arenaSurvivor) {
        next.arenaSurvivor.deadline = now + (next.remainingMs ?? 0);
        next.arenaSurvivor.updatedAt = now;
        next.arenaSurvivor.version += 1;
        next.deadlineAt = next.arenaSurvivor.deadline;
      } else if (next.arcadeGameId === "chaos-kommando" && next.chaosKommando?.phase === "choosing") {
        next.chaosKommando.deadline = now + (next.remainingMs ?? 0); next.chaosKommando.updatedAt = now; next.chaosKommando.version += 1; next.deadlineAt = next.chaosKommando.deadline;
      } else if (next.arcadeGameId === "magic-arena" && next.magicArena?.phase === "choosing") {
        next.magicArena.deadline = now + (next.remainingMs ?? 0); next.magicArena.updatedAt = now; next.magicArena.version += 1; next.deadlineAt = next.magicArena.deadline;
      } else if (next.arcadeGameId === "magic-duell" && next.magicDuell && ["drafting", "casting"].includes(next.magicDuell.phase)) {
        next.magicDuell.deadline = now + (next.remainingMs ?? 0); next.magicDuell.updatedAt = now; next.magicDuell.version += 1; next.deadlineAt = next.magicDuell.deadline;
      } else if (next.arcadeGameId === "minions-td" && next.minionsTd?.phase === "choosing") {
        next.minionsTd.deadline = now + (next.remainingMs ?? 0); next.minionsTd.updatedAt = now; next.minionsTd.version += 1; next.deadlineAt = next.minionsTd.deadline;
      } else if (next.arcadeGameId === "kartentisch" && next.kartentisch?.phase === "playing") {
        next.kartentisch.deadline = now + (next.remainingMs ?? 0); next.kartentisch.updatedAt = now; next.kartentisch.version += 1; next.deadlineAt = next.kartentisch.deadline;
      } else if (next.arcadeGameId === "dungeon-party" && next.dungeonParty?.phase === "choosing") {
        next.dungeonParty.deadline = now + (next.remainingMs ?? 0); next.dungeonParty.updatedAt = now; next.dungeonParty.version += 1; next.deadlineAt = next.dungeonParty.deadline;
      } else if (next.arcadeGameId === "flatterfluff" && next.flatterfluff?.phase === "aiming") {
        next.flatterfluff.deadline = now + (next.remainingMs ?? 0); next.flatterfluff.updatedAt = now; next.flatterfluff.version += 1; next.deadlineAt = next.flatterfluff.deadline;
      } else if (next.arcadeGameId === "drift-racer" && next.driftRacer?.phase === "racing") {
        next.driftRacer.deadline = now + (next.remainingMs ?? 0); next.driftRacer.updatedAt = now; next.driftRacer.version += 1; next.deadlineAt = next.driftRacer.deadline;
      } else if (next.arcadeGameId === "sketch-relay" && next.sketchRelay) {
        const shifted=now+(next.remainingMs??0)-next.sketchRelay.deadline;
        if(next.sketchRelay.showdown){next.sketchRelay.showdown.phaseStartedAt+=shifted;const w=next.sketchRelay.showdown.workshop;if(w){if(w.closeUntil)w.closeUntil+=shifted;for(const l of w.leases)l.until+=shifted;for(const b of w.ballots)if(b.acceptedAt===undefined){b.issuedAt+=shifted;b.notBefore+=shifted;b.expiresAt+=shifted;}}}
        next.sketchRelay.deadline = now + (next.remainingMs ?? 0); next.sketchRelay.updatedAt = now; next.sketchRelay.version++; next.deadlineAt = next.sketchRelay.deadline;
      } else if (next.arcadeGameId === "word-tiles" && next.wordTiles?.phase === "choosing") {
        next.wordTiles.deadline = now + (next.remainingMs ?? 0); next.wordTiles.updatedAt = now; next.wordTiles.version += 1; next.deadlineAt = next.wordTiles.deadline;
      } else if (next.arcadeGameId === "schattenjagd" && next.schattenjagd?.phase === "choosing") {
        next.schattenjagd.deadline = now + (next.remainingMs ?? 0); next.schattenjagd.updatedAt = now; next.schattenjagd.version += 1; next.deadlineAt = next.schattenjagd.deadline;
      } else next.deadlineAt = null;
      next.remainingMs = null; next.paused = false;
    }
    else { next.deadlineAt = now + (next.remainingMs ?? 0); next.remainingMs = null; next.paused = false; }
  }
  if (action.type === "ADD_TIME") {
    if (next.gameLength === "arcade") throw new Error("ARCADE_NO_TIMER_ADJUSTMENT");
    const additionalTime = action.payload.seconds * 1_000;
    if (next.paused) next.remainingMs = (next.remainingMs ?? 0) + additionalTime;
    else if (next.deadlineAt) next.deadlineAt += additionalTime;
    else throw new Error("NO_ACTIVE_TIMER");
  }
  if (action.type === "SKIP") {
    if (next.gameLength === "arcade") throw new Error("ARCADE_LIFECYCLE_REQUIRED");
    if (next.phase === "LOBBY" || next.phase === "POST_GAME") throw new Error("CANNOT_SKIP");
    next.deadlineAt = now;
  }
  if (action.type === "HIDE_ANSWER") {
    const answer = next.currentRound?.answers.find((item) => item.id === action.payload.answerId);
    if (!answer) throw new Error("ANSWER_NOT_FOUND");
    answer.hidden = true;
    effects.push({ type: "hide_answer", answerId: answer.id });
  }
  if (action.type === "REMOVE_PLAYER") {
    const player = next.participants.find((item) => item.id === action.payload.playerId && !item.removedAt);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    player.active = false; player.removedAt = now;
    effects.push({ type: "participant_state", participant: player });
    if (next.phase === "LOBBY" && player.role === "player" && player.lobbySlot) {
      if (player.bot) next.botSeats = next.botSeats.filter((seat) => seat !== player.lobbySlot);
      reconcileBotSeat(next, player.lobbySlot, effects, now);
    }
    if (next.birthdayPersonId === player.id) next.birthdayPersonId = null;
  }
  if (action.type === "SET_BIRTHDAY_PERSON") {
    if (next.phase !== "LOBBY" || next.gameLength !== "birthday") throw new Error("WRONG_PHASE");
    if (!scoringPlayers(next).some((player) => player.id === action.payload.playerId)) throw new Error("PLAYER_NOT_FOUND");
    next.birthdayPersonId = action.payload.playerId;
    next.birthdayName ??= scoringPlayers(next).find((player) => player.id === action.payload.playerId)?.nickname ?? "Birthday Legend";
  }
  if (action.type === "SET_FOOL_TEAM") {
    if (!["LOBBY", "FOOL_TEAM_SETUP"].includes(next.phase) || next.gameLength !== "bowl-of-fools") throw new Error("WRONG_PHASE");
    if (!scoringPlayers(next).some((player) => player.id === action.payload.playerId)) throw new Error("PLAYER_NOT_FOUND");
    if (!Object.keys(next.foolTeams).length) assignFoolTeams(next);
    next.foolTeams[action.payload.playerId] = action.payload.team;
    next.foolReadyPlayerIds = [];
  }
  if (action.type === "SHUFFLE_FOOL_TEAMS") {
    if (next.phase !== "FOOL_TEAM_SETUP" || next.gameLength !== "bowl-of-fools") throw new Error("WRONG_PHASE");
    assignFoolTeams(next, `${now}:${action.actionId}`);
  }
  if (action.type === "ADJUST_FOOL_SCORE") {
    if (next.gameLength !== "bowl-of-fools" || !["FOOL_TURN", "FOOL_ROUND_REVEAL", "FOOL_SUDDEN_DEATH", "FINAL_RESULTS", "POST_GAME"].includes(next.phase)) throw new Error("WRONG_PHASE");
    next.foolTeamScores[action.payload.team] = Math.max(0, next.foolTeamScores[action.payload.team] + action.payload.delta);
    if (["FINAL_RESULTS", "POST_GAME"].includes(next.phase)) next.foolWinner = next.foolTeamScores.BELLS === next.foolTeamScores.MOTLEY ? null : next.foolTeamScores.BELLS > next.foolTeamScores.MOTLEY ? "BELLS" : "MOTLEY";
  }
  if (action.type === "UNDO_FOOL_POINT") {
    const round = next.currentRound;
    if (!round || round.kind !== "BOWL_OF_FOOLS" || !round.foolUndo) throw new Error("NOTHING_TO_UNDO");
    const undo = round.foolUndo;
    next.foolTeamScores[undo.team] = Math.max(0, next.foolTeamScores[undo.team] - 1);
    next.foolWinner = null;
    round.scored = false;
    round.results = null;
    const crossedRoundBoundary = round.foolRoundNumber !== undo.roundNumber;
    round.foolSuddenDeath = undo.previousPhase === "FOOL_SUDDEN_DEATH";
    round.foolRoundNumber = undo.roundNumber;
    round.foolPool = crossedRoundBoundary ? [undo.scrollId] : [undo.scrollId, ...round.foolPool.filter((id) => id !== undo.scrollId)];
    round.foolTurnTeam = undo.team;
    round.foolCurrentScrollId = undo.scrollId;
    round.foolClueGiverId = foolClueGiver(next, round, undo.team);
    round.foolLastResult = null;
    round.foolUndo = null;
    next.status = "ACTIVE";
    setPhase(next, undo.previousPhase, now);
  }
  if (action.type === "LOCK_JOINING") next.joiningLocked = action.payload.locked;
  if (action.type === "END_GAME") { if (next.gameLength === "arcade") throw new Error("ARCADE_RESULT_REQUIRED"); next.status = "ENDED"; setPhase(next, "ENDED", now); }
  if (action.type === "SET_CONFIG") {
    if (next.phase !== "LOBBY") throw new Error("WRONG_PHASE");
    const sketchImageChange = next.gameLength === "arcade" && next.arcadeGameId === "sketch-relay" && action.payload.imageModel !== undefined && Object.keys(action.payload).length === 1;
    const sketchLobbySettings = next.gameLength === "arcade" && next.arcadeGameId === "sketch-relay" && action.payload.gameLength === undefined && Object.keys(action.payload).length > 0 && Object.keys(action.payload).every(key => ["sorceryLength", "contentMode", "timerAccessibility"].includes(key));
    if ((next.gameLength === "arcade" || action.payload.gameLength === "arcade") && !sketchImageChange && !sketchLobbySettings) throw new Error("ARCADE_CONFIG_LOCKED");
    if (action.payload.gameLength) { next.gameLength = action.payload.gameLength; next.roundPlan = clone(ROUND_PLANS[next.gameLength]); if (!["pictures", "comic"].includes(next.gameLength)) next.soloLiveImages = false; next.bowl = next.gameLength === "bowl" ? createBowlState({}) : null; }
    if (action.payload.gameLength) {
      next.gameLength = action.payload.gameLength;
      next.roundPlan = clone(ROUND_PLANS[next.gameLength]);
      if (!["pictures", "comic", "king-mystery", "royal-rumours"].includes(next.gameLength)) next.soloLiveImages = false;
      if (!supportsLobbyBots(next)) {
        for (const bot of next.participants.filter((participant) => participant.bot && !participant.removedAt)) {
          bot.active = false; bot.removedAt = now; effects.push({ type: "participant_state", participant: bot });
        }
        next.botSeats = [];
      }
    }
    if (action.payload.contentMode) next.contentMode = action.payload.contentMode;
    if (typeof action.payload.timerAccessibility === "boolean") next.timerAccessibility = action.payload.timerAccessibility;
    if (action.payload.sorceryLength !== undefined) {
      if (next.gameLength !== "arcade" || next.arcadeGameId !== "sketch-relay") throw new Error("SORCERY_LENGTH_UNAVAILABLE");
      next.sorceryLength = action.payload.sorceryLength;
    }
    if (typeof action.payload.soloLiveImages === "boolean") {
      if (!next.soloMode || !["pictures", "comic", "king-mystery", "royal-rumours"].includes(next.gameLength)) throw new Error("SOLO_LIVE_IMAGES_UNAVAILABLE");
      next.soloLiveImages = action.payload.soloLiveImages;
    }
    if (action.payload.imageModel) next.imageModel = action.payload.imageModel;
    if (next.bowl) {
      if (action.payload.gameLength === "bowl") rebalanceBowlTeams(next);
      if (action.payload.playEnvironment) { next.bowl.environment = action.payload.playEnvironment; if (action.payload.playEnvironment === "same_table") next.bowl.builtInVoice = false; }
      if (action.payload.bowlRoundTwo) next.bowl.roundTwo = action.payload.bowlRoundTwo;
      if (action.payload.scrollsPerPlayer) next.bowl.scrollsPerPlayer = action.payload.scrollsPerPlayer;
      if (typeof action.payload.builtInVoice === "boolean") { if (next.bowl.environment !== "remote_live" && action.payload.builtInVoice) throw new Error("BOWL_VOICE_REMOTE_ONLY"); next.bowl.builtInVoice = action.payload.builtInVoice; }
      if (typeof action.payload.openingTutorial === "boolean") next.bowl.openingTutorial = action.payload.openingTutorial;
    }
  }
  const bowlEffects = applyBowlHostAction(next, action, now);
  if (bowlEffects) return { next, effects: [...effects, ...bowlEffects] };
  if (action.type === "SET_DEVELOPER_ROUND") {
    if (!next.developerMode || !next.soloMode) throw new Error("DEVELOPER_MODE_REQUIRED");
    const round = next.currentRound;
    if (!round) throw new Error("DEVELOPER_ROUND_REQUIRED");
    const payload = action.payload;
    if (payload.prompt !== undefined) round.prompt = payload.prompt;
    if (payload.instruction !== undefined) round.instruction = payload.instruction;
    if (payload.choiceLabels !== undefined) {
      if (payload.choiceLabels.length !== round.choiceOptions.length) throw new Error("DEVELOPER_CHOICE_COUNT");
      round.choiceOptions = round.choiceOptions.map((choice, index) => ({ ...choice, label: payload.choiceLabels![index] }));
    }
    if (payload.scoreCap !== undefined) round.developerScoreCap = payload.scoreCap;
    if (payload.phaseSeconds !== undefined) {
      if (next.paused) next.remainingMs = payload.phaseSeconds * 1000;
      else { next.phaseStartedAt = now; next.deadlineAt = now + payload.phaseSeconds * 1000; }
    }
    effects.push({ type: "round", round });
  }
  if (action.type === "PLAY_AGAIN") {
    if (!["POST_GAME", "FINAL_RESULTS", "ARCADE_RESULTS"].includes(next.phase)) throw new Error("WRONG_PHASE");
    next.status = "LOBBY"; next.phase = "LOBBY"; next.phaseStartedAt = now; next.deadlineAt = null; next.paused = false; next.remainingMs = null;
    if (next.gameLength === "arcade") { next.arcadeMatch = null; next.schaetzorama = null; next.imposter = null; next.buzzwort = null; next.pantomime = null; next.drawGuess = null; next.arenaSurvivor = null; next.chaosKommando = null; next.magicArena = null; next.magicDuell = null; next.minionsTd = null; next.kartentisch = null; next.dungeonParty = null; next.flatterfluff = null; next.driftRacer = null; next.wordTiles = null; next.sketchRelay = null; next.fishGame = null; next.schattenjagd = null; }
    next.matchNumber += 1;
    next.roundIndex = -1; next.currentRound = null; next.promptHistory = next.promptHistory.slice(-200); next.answerHistory = []; next.lore = []; next.memoryEdges = []; next.primaryMemoryIds = {}; next.callbackCandidates = []; next.remixCandidates = []; next.anchorImage = null; next.finalImage = null; next.kingImages = {}; next.kingFinalists = []; next.kingRounds = []; next.kingRoundTwoRequestId = null; next.kingRestorationBase = null; next.kingRestorationAssignments = {}; next.comicTheme = null; next.comicFrames = []; next.imageGenerationNotice = null; next.scoreEvents = []; next.encoreScoreEvents = []; next.awards = []; next.roomLore = []; next.warCampaign = campaignForMatch(next.matchNumber); next.warTeams = {}; next.warTeamScores = { LION: 0, RAVEN: 0 }; next.warScoutUsed = { LION: false, RAVEN: false }; next.foolTeams = {}; next.foolReadyPlayerIds = []; next.foolTeamScores = { BELLS: 0, MOTLEY: 0 }; next.foolWinner = null;
    for (const player of next.participants.filter((item) => item.role === "player" && !item.removedAt)) { player.active = true; player.pendingActivation = false; effects.push({ type: "participant_state", participant: player }); }
  }
  if (action.type === "START_ENCORE") {
    if (!["FINAL_RESULTS", "POST_GAME"].includes(next.phase)) throw new Error("WRONG_PHASE");
    const round = setupRound(next, next.roundPlan.length, now, true);
    round.prompt = `Everyone contributes one creature ingredient: ${MONSTER_COMPONENTS.join(", ")}.`;
    setPhase(next, "ENCORE_CONTRIBUTING", now, phaseDurationMs(next.gameLength, "ANSWERING", next.timerAccessibility));
    effects.push({ type: "round", round });
  }
  return { next, effects };
}

async function queueImage(state: RoomState, effects: DbEffect[], now: number): Promise<void> {
  const round = state.currentRound;
  if (!round?.image || round.image.status === "QUEUED" || round.image.status === "READY") return;
  if (state.soloMode) {
    round.image = { status: "FALLBACK", conceptTitle: "The Local Bot Creature", conceptCaption: "Built without paid AI. The budget went to imaginary snacks." };
    return;
  }
  const jobId = makeId("job");
  const playerIngredients = round.answers.filter((answer) => !answer.hidden).map((answer) => answer.text).slice(0, 10);
  const payload = { kind: round.kind, roomId: state.id, roundId: round.id, imageModel: state.imageModel, visualBrief: "A single playful creature assembled from the room's ingredients", ingredients: playerIngredients, constraints: "2048x1152 landscape, no logos, no important embedded text, safe party-game tone" };
  const hash = await promptHash(payload);
  round.image = { ...round.image, jobId, status: "QUEUED" };
  effects.push({ type: "job", id: jobId, roundId: round.id, kind: round.kind, promptHash: hash, prompt: payload, now });
}

async function queuePictureImage(state: RoomState, effects: DbEffect[], now: number): Promise<void> {
  const round = state.currentRound;
  if (!round || !["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL", "COMIC_FRAME", "KING_REQUEST_MYSTERY", "ROYAL_RUMOURS"].includes(round.kind)) return;
  state.kingImages ??= {};
  state.kingFinalists ??= [];
  const visible = round.answers.filter((answer) => !answer.hidden);
  if (!visible.length) return;
  state.imageGenerationNotice = null;
  for (const [index, answer] of visible.entries()) {
    if (["QUEUED", "GENERATING", "READY", "FALLBACK"].includes(state.kingImages[answer.id]?.status ?? "")) continue;
    const conceptTitle = round.kind === "COMIC_FRAME" ? `Panel ${round.index + 1} · Take ${index + 1}` : round.kind === "KING_PROMPTER_FINAL" ? `Restored ${state.kingRestorationAssignments[answer.playerId] ?? "portrait piece"}` : round.kind === "KING_REQUEST_MYSTERY" ? `Evidence Painting ${index + 1}` : round.kind === "ROYAL_RUMOURS" ? `Whisper Painting ${index + 1}` : `Canvas ${index + 1}`;
    const conceptCaption = round.kind === "KING_REQUEST_MYSTERY" ? "An enchanted evidence frame reconstructed this incident from a sealed report." : round.kind === "ROYAL_RUMOURS" ? "The AI illustrated a secret rumour. Only the next player may interpret it." : answer.text;
    if (state.soloMode && !state.soloLiveImages) {
      state.kingImages[answer.id] = { status: "FALLBACK", conceptTitle, conceptCaption };
      continue;
    }
    const jobId = makeId("job");
    const isComic = round.kind === "COMIC_FRAME";
    const isRestoration = round.kind === "KING_PROMPTER_FINAL";
    const jobKind = isComic ? "COMIC_PANEL_IMAGE" : isRestoration ? "KING_RESTORATION_PATCH" : round.kind === "KING_REQUEST_MYSTERY" ? "KING_MYSTERY_IMAGE" : "KING_PROMPT_IMAGE";
    const payload = {
      kind: jobKind, roomId: state.id, roundId: round.id, answerId: answer.id, imageModel: state.imageModel,
      visualBrief: answer.text,
      ...(isRestoration ? { slotId: state.kingRestorationAssignments[answer.playerId], restorationBase: state.kingRestorationBase } : {}),
      ...(isComic ? { comicFrameNumber: Math.min(3, round.index + 1), comicTheme: state.comicTheme ?? "an absurd continuing comic", previousPanels: state.comicFrames.map((frame) => frame.prompt), referenceAssetIds: state.comicFrames.flatMap((frame) => frame.image.assetId ? [frame.image.assetId] : []).slice(-4) } : {}),
    };
    const hash = await promptHash(payload);
    state.kingImages[answer.id] = { jobId, status: "QUEUED", conceptTitle, conceptCaption };
    effects.push({ type: "job", id: jobId, roundId: round.id, kind: jobKind, promptHash: hash, prompt: payload, now });
  }
}

async function queueAnchorImage(state: RoomState, effects: DbEffect[], now: number): Promise<void> {
  const round = state.currentRound; const anchor = primaryMemory(state, "ANCHOR");
  if (!round || !anchor || ["QUEUED", "READY"].includes(state.anchorImage?.status ?? "")) return;
  if (state.soloMode) {
    state.anchorImage = { status: "FALLBACK", conceptTitle: anchor.text, conceptCaption: "Local playtest concept card—no paid AI used." };
    return;
  }
  const jobId = makeId("job");
  const payload = {
    kind: "ANCHOR_IMAGE", roomId: state.id, roundId: round.id, imageModel: state.imageModel,
    visualBrief: "Make the room's winning fictional invention visually real as a polished, funny game-show reveal",
    ingredients: [`Original setup: ${anchor.originalPrompt}`, `Winning Anchor: ${anchor.text}`, `Meaning: ${anchor.shortMeaning}`],
      constraints: "2048x1152 landscape, one clear subject, expressive silhouette, no logos, no important embedded text",
  };
  const hash = await promptHash(payload);
  state.anchorImage = { jobId, status: "QUEUED", conceptTitle: anchor.text, conceptCaption: "You made this. The art department took that personally." };
  effects.push({ type: "job", id: jobId, roundId: round.id, kind: "ANCHOR_IMAGE", promptHash: hash, prompt: payload, now });
}

async function queueFinalImage(state: RoomState, effects: DbEffect[], now: number): Promise<void> {
  const round = state.currentRound;
  if (!round || ["QUEUED", "READY"].includes(state.finalImage?.status ?? "")) return;
  if (state.soloMode) {
    state.finalImage = { status: "FALLBACK", conceptTitle: "Tonight's Local Masterpiece", conceptCaption: "A deterministic finale created without paid AI calls." };
    return;
  }
  const ingredients = (["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"] as MemoryKind[]).flatMap((kind) => {
    const item = primaryMemory(state, kind); return item ? [`${kind}: ${item.text}`] : [];
  }).slice(0, 4);
  const jobId = makeId("job");
  const payload = {
    kind: "REMIX_IMAGE", roomId: state.id, roundId: round.id, imageModel: state.imageModel,
    visualBrief: "Tonight's Masterpiece: one coherent cinematic commemorative scene from the room's connected absurd story",
    ingredients,
    constraints: "2048x1152 landscape, combine only compatible listed elements, one readable focal scene, no logos, no important embedded text",
  };
  const hash = await promptHash(payload);
  state.finalImage = { jobId, status: "QUEUED", conceptTitle: "Tonight's Masterpiece", conceptCaption: "A commemorative portrait of several decisions the room cannot take back." };
  effects.push({ type: "job", id: jobId, roundId: round.id, kind: "REMIX_IMAGE", promptHash: hash, prompt: payload, now });
}

async function queueLoreAnalysis(state: RoomState, effects: DbEffect[], now: number): Promise<void> {
  if (state.soloMode) return;
  const round = state.currentRound;
  const memoryRole = round ? memoryKindForRound(round.kind) : null;
  if (!round || !memoryRole) return;
  const rememberedIds = new Set(((round.results as { rememberedMemoryIds?: string[] } | null)?.rememberedMemoryIds ?? []));
  const winners = state.lore.filter((item) => rememberedIds.has(item.id));
  if (!winners.length) return;
  const payload = {
    type: "LORE_ANALYSIS", roomId: state.id, roundId: round.id, prompt: round.prompt, contentMode: state.contentMode, memoryRole,
    comedyPreferences: leadingComedyTastes(state.feedbackTallies ?? {}, state.feedbackVotes ?? []),
    answers: winners.map((item) => ({ id: item.sourceAnswerId, memoryId: item.id, playerId: item.sourceAuthorId, text: item.text })),
    graph: { nodes: state.lore.filter((item) => item.safe), edges: state.memoryEdges },
  };
  const hash = await promptHash(payload);
  effects.push({ type: "job", id: makeId("job"), roundId: round.id, kind: "LORE_ANALYSIS", promptHash: hash, prompt: payload, now });
}

function startInteractive(state: RoomState, now: number): void {
  const kind = state.currentRound?.kind;
  if (kind === "BOWL_OF_FOOLS") setPhase(state, "FOOL_WRITING", now);
  else if (kind === "ROYAL_WAR_ROOM") setPhase(state, "WAR_RANKING", now);
  else if (kind === "READ_THE_ROOM" || kind === "CROWD_CONTROL" || kind === "BIRTHDAY_BETS") setPhase(state, "PERSONAL_CHOICE", now);
  else if (kind === "WHO_SAID_THAT") setPhase(state, "AUTHOR_GUESSING", now);
  else if (kind === "FINAL_READ") setPhase(state, "FINAL_WAGER", now);
  else if (kind === "MAKE_IT_REAL") setPhase(state, "IMAGE_REVEAL", now, 8000);
  else if (kind === "KING_PROMPTER_FINAL") setPhase(state, "ANSWERING", now);
  else setPhase(state, "ANSWERING", now);
}

async function queuePostScoreWork(state: RoomState, effects: DbEffect[], now: number): Promise<void> {
  await queueLoreAnalysis(state, effects, now);
  if (state.currentRound?.kind === "THE_SEED") await queueAnchorImage(state, effects, now);
}

function advanceBotArcadeTransition(base: RoomState, now: number): { next: RoomState; effects: DbEffect[]; actionId: string } | null {
  if (base.gameLength !== "arcade" || base.phase !== "ARCADE_ACTIVE" || !base.arcadeMatch || !base.participants.length ||
      !scoringPlayers(base).length || !scoringPlayers(base).every((player) => player.bot) || base.deadlineAt === null || now < base.deadlineAt) return null;
  const next = clone(base);
  const effects: DbEffect[] = [];
  const matchId = base.arcadeMatch.id;
  const finish = (gameId: string, result: unknown) => {
    const arcadeMatch = next.arcadeMatch;
    if (!arcadeMatch) return;
    next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
    next.arcadeMatch = { ...arcadeMatch, status: "COMPLETE", endedAt: now, result: result as Record<string, unknown> | null };
    effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${matchId}:${gameId}:complete`, matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result as Record<string, unknown> } });
  };
  switch (base.arcadeGameId) {
    case "schaetzorama": {
      if (next.schaetzorama?.phase !== "revealing") return null;
      const moved = advanceSchaetzorama(next.schaetzorama, { now }); if (!moved.ok) return null;
      next.schaetzorama = moved.state;
      if (moved.state.phase === "completed") finish("schaetzorama", getSchaetzoramaResult(moved.state));
      else next.deadlineAt = moved.state.deadline;
      break;
    }
    case "flatterfluff": {
      if (next.flatterfluff?.phase !== "revealed") return null;
      const moved = nextFlatterfluffRound(next.flatterfluff, { now }); if (!moved.ok) return null;
      next.flatterfluff = moved.state; next.deadlineAt = moved.state.deadline;
      break;
    }
    case "kartentisch": {
      if (next.kartentisch?.phase !== "revealed") return null;
      const moved = advanceKartentischTrick(next.kartentisch, { now }); if (!moved.ok) return null;
      next.kartentisch = moved.state; next.deadlineAt = moved.state.deadline;
      break;
    }
    case "magic-arena": {
      if (next.magicArena?.phase !== "revealed") return null;
      const moved = advanceMagicArenaRound(next.magicArena, { now }); if (!moved.ok) return null;
      next.magicArena = moved.state; next.deadlineAt = moved.state.deadline;
      break;
    }
    case "magic-duell": {
      if (next.magicDuell?.phase !== "revealed") return null;
      const moved = advanceMagicDuellRound(next.magicDuell, { now }); if (!moved.ok) return null;
      next.magicDuell = moved.state; next.deadlineAt = moved.state.deadline;
      break;
    }
    case "minions-td": {
      if (next.minionsTd?.phase !== "revealed") return null;
      const moved = advanceMinionsTdRound(next.minionsTd, { transition: "next", now }); if (!moved.ok) return null;
      next.minionsTd = moved.state; next.deadlineAt = moved.state.deadline;
      break;
    }
    case "dungeon-party": {
      if (next.dungeonParty?.phase !== "revealed") return null;
      const moved = nextDungeonPartyEncounter(next.dungeonParty, { now }); if (!moved.ok) return null;
      next.dungeonParty = moved.state; next.deadlineAt = moved.state.deadline;
      break;
    }
    case "word-tiles": {
      if (next.wordTiles?.phase !== "revealed") return null;
      const moved = nextWordTilesRound(next.wordTiles, { now }); if (!moved.ok) return null;
      next.wordTiles = moved.state; next.deadlineAt = moved.state.deadline;
      break;
    }
    case "schattenjagd": {
      if (next.schattenjagd?.phase !== "revealed") return null;
      const moved = nextSchattenjagdCase(next.schattenjagd, { now }); if (!moved.ok) return null;
      next.schattenjagd = moved.state; next.deadlineAt = moved.state.deadline;
      break;
    }
    default: return null;
  }
  return { next, effects, actionId: `arcade-bot-transition:${matchId}:${base.arcadeGameId}:${base.version}` };
}

export async function advanceState(base: RoomState, now = Date.now()): Promise<{ changed: boolean; next: RoomState; effects: DbEffect[]; actionId: string }> {
  if (base.arcadeGameId === "sketch-relay" && base.phase === "ARCADE_ACTIVE" && base.sketchRelay && !base.paused && canAdvanceSketchRelay(base.sketchRelay, now)) {
    const next = clone(base); const effects: DbEffect[] = []; next.sketchRelay = advanceSketchRelay(base.sketchRelay, now).state; syncSketchRelayRoom(next, effects, now); return { changed: true, next, effects, actionId: `sketch-relay:${base.sketchRelay.matchId}:${base.sketchRelay.round}:${base.sketchRelay.phase}:${base.sketchRelay.revealIndex}` };
  }
  const botDrivenPhase = Boolean(base.currentRound) || (base.gameLength === "arcade" && base.phase === "ARCADE_ACTIVE") ||
    (base.gameLength === "bowl-of-fools" && ["FOOL_TEAM_SETUP", "FOOL_WRITING", "FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(base.phase));
  if (base.participants.some((participant) => participant.bot && participant.active && !participant.removedAt) && !base.paused && botDrivenPhase && (base.deadlineAt === null || now < base.deadlineAt) && !["LOBBY", "POST_GAME", "ENDED"].includes(base.phase)) {
    const botNext = clone(base);
    const botEffects: DbEffect[] = [];
    const botTurns = settleBotTurns(botNext, botEffects, now);
    if (botTurns > 0) return { changed: true, next: botNext, effects: botEffects, actionId: `bots:${base.version}:${base.phase}:${base.currentRound?.id ?? base.arcadeMatch?.id ?? "bowl"}` };
  }
  if (base.gameLength === "arcade" && base.arcadeGameId === "chaos-kommando" && base.phase === "ARCADE_ACTIVE" && base.chaosKommando?.phase === "revealed" && base.deadlineAt !== null && now >= base.deadlineAt && scoringPlayers(base).every((player) => player.bot)) {
    const next = clone(base);
    const advanced = nextChaosMission(next.chaosKommando!, { now });
    if (!advanced.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.chaosKommando = advanced.state;
    next.deadlineAt = advanced.state.deadline;
    return { changed: true, next, effects: [], actionId: `arcade-bot-transition:${base.arcadeMatch?.id}:chaos:${base.chaosKommando.missionNumber}` };
  }
  const botArcadeTransition = advanceBotArcadeTransition(base, now);
  if (botArcadeTransition) return { changed: true, ...botArcadeTransition };
  if (base.paused || !base.deadlineAt || now < base.deadlineAt || ["LOBBY", "POST_GAME", "ENDED"].includes(base.phase)) return { changed: false, next: base, effects: [], actionId: "" };
  const next = clone(base);
  const effects: DbEffect[] = [];
  const from = next.phase;
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "schaetzorama" && next.schaetzorama?.phase === "estimating") {
    if (now < next.schaetzorama.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advanceSchaetzorama(next.schaetzorama, { now });
    if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.schaetzorama = transition.state;
    next.deadlineAt = transition.state.phase === "estimating" ? transition.state.deadline : null;
    next.phaseStartedAt = now;
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch!.id}:${transition.state.round}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "imposter" && next.imposter && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.imposter.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advanceImposter(next.imposter, { now });
    if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.imposter = transition.state;
    next.phaseStartedAt = now;
    if (transition.state.phase === "revealed") finalizeImposter(next, effects, now);
    else next.deadlineAt = transition.state.deadline;
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:${transition.state.round}:${transition.state.phase}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "buzzwort" && next.buzzwort && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.buzzwort.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advanceBuzzwort(next.buzzwort, { now });
    if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.buzzwort = transition.state;
    next.phaseStartedAt = now;
    if (transition.state.phase === "revealed") finalizeBuzzwort(next, effects, now);
    else next.deadlineAt = transition.state.deadline;
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:${transition.state.round}:${transition.state.attempt}:${transition.state.phase}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "pantomime" && next.pantomime && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.pantomime.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advancePantomime(next.pantomime, { now });
    if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.pantomime = transition.state;
    finalizePantomime(next, effects, now);
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:pantomime:${transition.state.round}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "zeichnen-und-erraten" && next.drawGuess && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.drawGuess.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advanceDrawGuess(next.drawGuess, { now });
    if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.drawGuess = transition.state;
    finalizeDrawGuess(next, effects, now);
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:draw-guess:${transition.state.round}:${transition.state.phase}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "arena-survivor" && next.arenaSurvivor && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.arenaSurvivor.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advanceArenaSurvivor(next.arenaSurvivor, { now });
    if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.arenaSurvivor = transition.state;
    finalizeArenaSurvivor(next, effects, now);
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:arena-survivor:${transition.state.round}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "chaos-kommando" && next.chaosKommando?.phase === "choosing" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.chaosKommando.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advanceChaosMission(next.chaosKommando, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.chaosKommando = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.missionNumber < 4 ? now + 1_500 : null;
    if (transition.state.missionNumber === 4) {
      next.chaosKommando = finishChaosMatch(transition.state); next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = next.chaosKommando.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:chaos-kommando:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:chaos-kommando:${transition.state.missionNumber}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "magic-arena" && next.magicArena?.phase === "choosing" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.magicArena.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = revealMagicArenaRound(next.magicArena, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.magicArena = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.phase === "revealed" ? now + 1_500 : null;
    if (transition.state.phase === "complete") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = transition.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:magic-arena:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:magic-arena:${transition.state.round}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "minions-td" && next.minionsTd?.phase === "choosing" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.minionsTd.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = resolveMinionsTdRound(next.minionsTd, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.minionsTd = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.phase === "revealed" ? now + 1_500 : null;
    if (transition.state.phase === "complete") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = transition.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:minions-td:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:minions-td:${transition.state.round}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "magic-duell" && next.magicDuell && (next.magicDuell.phase === "drafting" || next.magicDuell.phase === "casting") && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.magicDuell.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    if (next.magicDuell.phase === "drafting") {
      const transition = beginMagicDuell(next.magicDuell, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
      next.magicDuell = transition.state; next.deadlineAt = transition.state.deadline;
      return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:magic-duell:draft` };
    }
    const transition = revealMagicDuellRound(next.magicDuell, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.magicDuell = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.phase === "revealed" ? now + 1_500 : null;
    if (transition.state.phase === "complete") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = transition.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:magic-duell:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:magic-duell:${transition.state.round}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "kartentisch" && next.kartentisch?.phase === "playing" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.kartentisch.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = revealKartentischTrick(next.kartentisch, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.kartentisch = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.phase === "revealed" ? now + 1_500 : null;
    if (transition.state.phase === "complete") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = transition.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:kartentisch:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:kartentisch:${transition.state.trick}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "dungeon-party" && next.dungeonParty?.phase === "choosing" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.dungeonParty.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = revealDungeonPartyEncounter(next.dungeonParty, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.dungeonParty = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.phase === "revealed" ? now + 1_500 : null;
    if (transition.state.phase === "complete") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = transition.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:dungeon-party:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:dungeon-party:${transition.state.encounter}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "flatterfluff" && next.flatterfluff?.phase === "aiming" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.flatterfluff.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advanceFlatterfluffRound(next.flatterfluff, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.flatterfluff = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.phase === "revealed" ? now + 1_500 : null;
    if (transition.state.phase === "complete") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = getFlatterfluffResult(transition.state) as unknown as Record<string, unknown>;
      const arcadeMatch = next.arcadeMatch;
      if (!arcadeMatch) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
      next.arcadeMatch = { ...arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${arcadeMatch.id}:flatterfluff:complete`, matchId: arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch!.id}:flatterfluff:${transition.state.round}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "drift-racer" && next.driftRacer?.phase === "racing" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.driftRacer.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = advanceDriftRacer(next.driftRacer, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.driftRacer = transition.state;
    if (transition.state.phase === "results") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.deadlineAt = null; next.status = "COMPLETE";
      const result = getDriftRacerResult(transition.state) as unknown as Record<string, unknown>;
      const arcadeMatch = next.arcadeMatch;
      if (!arcadeMatch) throw new Error("ARCADE_LIFECYCLE_REQUIRED");
      next.arcadeMatch = { ...arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${arcadeMatch.id}:drift-racer:complete`, matchId: arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    } else next.deadlineAt = transition.state.deadline;
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch!.id}:drift-racer:${transition.state.turn}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "word-tiles" && next.wordTiles?.phase === "choosing" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.wordTiles.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = revealWordTilesRound(next.wordTiles, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.wordTiles = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.phase === "revealed" ? now + 1_500 : null;
    if (transition.state.phase === "complete") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = transition.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:word-tiles:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:word-tiles:${transition.state.round}` };
  }
  if (from === "ARCADE_ACTIVE" && next.arcadeGameId === "schattenjagd" && next.schattenjagd?.phase === "choosing" && next.arcadeMatch?.status === "ACTIVE") {
    if (now < next.schattenjagd.deadline + ARCADE_SYNC_TIMEOUT_RECOVERY_MS) return { changed: false, next: base, effects: [], actionId: "" };
    const transition = revealSchattenjagdCase(next.schattenjagd, { now }); if (!transition.ok) return { changed: false, next: base, effects: [], actionId: "" };
    next.schattenjagd = transition.state; next.deadlineAt = scoringPlayers(next).every((player) => player.bot) && transition.state.phase === "revealed" ? now + 1_500 : null;
    if (transition.state.phase === "complete") {
      next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE";
      const result = transition.state.result!; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result };
      effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${next.arcadeMatch.id}:schattenjagd:complete`, matchId: next.arcadeMatch.id, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } });
    }
    return { changed: true, next, effects, actionId: `arcade-timeout:${next.arcadeMatch.id}:schattenjagd:${transition.state.round}` };
  }
  if (advanceBowlState(next, now)) return { changed: true, next, effects, actionId: `bowl-transition:${base.version}:${from}:${base.deadlineAt}` };
  const round = next.currentRound;
  if (from === "INTRO") {
    const created = setupRound(next, 0, now); setPhase(next, "ROUND_INTRO", now); effects.push({ type: "round", round: created });
  } else if (from === "ROUND_INTRO") {
    if (round?.kind === "THE_REMIX") { await queueFinalImage(next, effects, now); setPhase(next, "FINAL_ANSWERING", now); }
    else startInteractive(next, now);
  }
  else if (from === "FOOL_WRITING") {
    if (round?.kind === "BOWL_OF_FOOLS") {
      const fallback = ["A suspicious turnip", "The moon", "Sir Stinky Boots", "Dancing plague", "Royal bathwater", "Three blind dragons", "The forbidden spoon", "A tiny catapult", "Grandmother's battle axe", "Ye olde karaoke"];
      const submitted = new Set(round.foolScrolls.map((scroll) => scroll.playerId));
      for (const player of scoringPlayers(next).filter((candidate) => !submitted.has(candidate.id))) {
        for (let index = 0; index < next.foolScrollsPerPlayer; index += 1) round.foolScrolls.push({ id: makeId("scroll"), playerId: player.id, text: fallback[(player.seat + index) % fallback.length], submittedAt: now });
      }
      startFoolRounds(next, round, now);
    }
  }
  else if (from === "FOOL_TURN") {
    if (round?.kind === "BOWL_OF_FOOLS") {
      round.foolTeamTurns[round.foolTurnTeam] += 1;
      setFoolTurn(next, round, otherFoolTeam(round.foolTurnTeam), now);
    }
  }
  else if (from === "FOOL_ROUND_REVEAL") {
    if (round?.kind === "BOWL_OF_FOOLS") setFoolTurn(next, round, round.foolTurnTeam, now);
  }
  else if (from === "FOOL_SUDDEN_DEATH") {
    if (round?.kind === "BOWL_OF_FOOLS") {
      round.foolTeamTurns[round.foolTurnTeam] += 1;
      setFoolTurn(next, round, otherFoolTeam(round.foolTurnTeam), now, true);
    }
  }
  else if (from === "ANSWERING" || from === "FINAL_ANSWERING" || from === "ENCORE_CONTRIBUTING" || from === "ENCORE_FOLLOWUP") setPhase(next, "ANSWER_LOCK", now);
  else if (from === "ANSWER_LOCK") {
    if (next.gameLength === "royal-rumours" && round?.kind === "ROYAL_RUMOURS") {
      await queuePictureImage(next, effects, now);
      prepareRoyalRumourAssignments(next);
      setPhase(next, "IMAGE_REVEAL", now, 1000);
    } else if (next.gameLength === "king-mystery" && round?.kind === "KING_REQUEST_MYSTERY") {
      await queuePictureImage(next, effects, now);
      round.kingMysteryOrder = deterministicShuffle(round.answers.filter((answer) => !answer.hidden).map((answer) => answer.id), `${next.id}:${round.id}:mystery-order`);
      round.kingMysteryIndex = 0;
      round.featuredAnswerId = round.kingMysteryOrder[0] ?? null;
      setPhase(next, "IMAGE_REVEAL", now, 1000);
    } else if (next.gameLength === "pictures" && round?.kind === "PROMPT_AND_CIRCUMSTANCE") {
      await queuePictureImage(next, effects, now);
      next.answerHistory.push(...round.answers.filter((answer) => !answer.hidden));
      next.kingRounds = [...next.kingRounds.filter((saved) => saved.index !== round.index), clone(round)].sort((a, b) => a.index - b.index);
      if (round.index === 0) {
        next.kingRoundTwoRequestId = resolveKingRequestPoll(next, round);
        const created = setupRound(next, 1, now);
        setPhase(next, "ROUND_INTRO", now, 3000);
        effects.push({ type: "round", round: created });
      } else {
        next.currentRound = clone(next.kingRounds.find((saved) => saved.index === 0)!);
        next.roundIndex = 0;
        setPhase(next, "IMAGE_REVEAL", now, 1000);
      }
    } else if (next.gameLength === "pictures" && round?.kind === "KING_PROMPTER_FINAL") {
      await queuePictureImage(next, effects, now);
      setPhase(next, "IMAGE_REVEAL", now, 1000);
    } else if (round?.kind === "COMIC_FRAME") {
      await queuePictureImage(next, effects, now);
      const visible = round.answers.filter((answer) => !answer.hidden);
      if (visible.length > 1) {
        buildImageAuthorAssignments(next, round);
        const seconds = Math.min(55, 12 + visible.length * 4) * (next.timerAccessibility ? 1.5 : 1);
        setPhase(next, "AUTHOR_GUESSING", now, Math.round(seconds * 1000));
      } else if (round.kind === "COMIC_FRAME") setPhase(next, "IMAGE_REVEAL", now, 8000);
      else { scoreKingBallot(next, effects, "prompt"); round.votes = []; setPhase(next, "IMAGE_REVEAL", now, 8000); }
    } else if (round?.kind === "MONSTER_FACTORY" && round.instruction) {
      const visible = round.answers.filter((answer) => !answer.hidden);
      if (visible.length <= 1) { scoreCreativeRound(next, effects); setPhase(next, "REVEAL", now); }
      else setPhase(next, "VOTING", now);
    } else if (round?.kind === "MONSTER_FACTORY") {
      await queueImage(next, effects, now); setPhase(next, "ENCORE_IMAGE", now, 8000);
    } else {
      const visible = round?.answers.filter((answer) => !answer.hidden) ?? [];
      if (visible.length <= 1) { scoreCreativeRound(next, effects); await queuePostScoreWork(next, effects, now); setPhase(next, "REVEAL", now); }
      else setPhase(next, round?.kind === "FINAL_READ" || round?.kind === "THE_REMIX" ? "FINAL_VOTING" : "VOTING", now);
    }
  } else if (from === "IMAGE_REVEAL") {
    if (round && ((next.gameLength === "pictures" && ["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL"].includes(round.kind)) || round.kind === "COMIC_FRAME" || round.kind === "KING_REQUEST_MYSTERY" || round.kind === "ROYAL_RUMOURS")) {
      const images = round.answers.filter((answer) => !answer.hidden).map((answer) => next.kingImages[answer.id]);
      const pending = images.some((image) => image && ["QUEUED", "GENERATING"].includes(image.status));
      if (pending) next.deadlineAt = now + 4_000;
      else if (round.kind === "ROYAL_RUMOURS") {
        setPhase(next, "RUMOUR_GUESSING", now);
      } else if (round.kind === "KING_REQUEST_MYSTERY") {
        if (!round.kingMysteryOrder.length) round.kingMysteryOrder = deterministicShuffle(round.answers.filter((answer) => !answer.hidden).map((answer) => answer.id), `${next.id}:${round.id}:mystery-order`);
        prepareMysteryTurn(next, now);
      } else {
        const visible = round.answers.filter((answer) => !answer.hidden);
        if (visible.length <= 1) { if (round.kind === "COMIC_FRAME") scoreComicBallot(next, effects); else scoreKingBallot(next, effects, round.kind === "KING_PROMPTER_FINAL" ? "final" : "image"); setPhase(next, "REVEAL", now); } else setPhase(next, "FINAL_VOTING", now);
      }
    } else if (round?.kind === "MAKE_IT_REAL" && round.answers.length === 0) setPhase(next, "ANSWERING", now);
    else {
      const visible = round?.answers.filter((answer) => !answer.hidden) ?? [];
      if (visible.length <= 1) { scoreCreativeRound(next, effects); await queuePostScoreWork(next, effects, now); setPhase(next, "REVEAL", now); } else setPhase(next, "VOTING", now);
    }
  } else if (from === "VOTING" || from === "FINAL_VOTING") {
    if (round) round.voteStage = round.kind === "PROMPT_AND_CIRCUMSTANCE" ? "IMAGE" : round.kind === "KING_PROMPTER_FINAL" ? "FINAL" : round.kind === "COMIC_FRAME" ? "IMAGE" : null;
    setPhase(next, "VOTE_LOCK", now);
  }
  else if (from === "VOTE_LOCK") {
    if (round?.kind === "ROYAL_RUMOURS") {
      scoreRoyalRumours(next, effects); finalizeRoom(next); setPhase(next, "FINAL_RESULTS", now);
    } else if (round?.kind === "PROMPT_AND_CIRCUMSTANCE") {
      scoreKingBallot(next, effects, "image"); round.voteStage = null; setPhase(next, "REVEAL", now);
    } else if (round?.kind === "KING_PROMPTER_FINAL") {
      scoreKingBallot(next, effects, "final"); round.voteStage = null; setPhase(next, "REVEAL", now);
    } else if (round?.kind === "COMIC_FRAME") {
      scoreComicBallot(next, effects); round.voteStage = null; setPhase(next, "REVEAL", now);
    } else { scoreCreativeRound(next, effects); await queuePostScoreWork(next, effects, now); setPhase(next, "REVEAL", now); }
  }
  else if (from === "PERSONAL_CHOICE") {
    if (round?.kind === "BIRTHDAY_BETS") { scoreBirthdayBets(next, effects); setPhase(next, "REVEAL", now); }
    else setPhase(next, "ROOM_PREDICTION", now);
  }
  else if (from === "ROOM_PREDICTION") { scoreReadTheRoom(next, effects); setPhase(next, "REVEAL", now); }
  else if (from === "AUTHOR_GUESSING") {
    scoreAuthorGuesses(next, effects);
    if (round?.kind === "PROMPT_AND_CIRCUMSTANCE") setPhase(next, "VOTING", now);
    else if (round?.kind === "COMIC_FRAME") setPhase(next, "IMAGE_REVEAL", now, 8000);
    else setPhase(next, "REVEAL", now);
  }
  else if (from === "MYSTERY_DECOYS") setPhase(next, "MYSTERY_VOTING", now);
  else if (from === "MYSTERY_VOTING") { scoreMysteryTurn(next, effects); setPhase(next, "MYSTERY_REVEAL", now); }
  else if (from === "MYSTERY_REVEAL") {
    if (round?.kind === "KING_REQUEST_MYSTERY" && round.kingMysteryIndex + 1 < round.kingMysteryOrder.length) {
      round.kingMysteryIndex += 1;
      prepareMysteryTurn(next, now);
    } else if (round?.kind === "KING_REQUEST_MYSTERY") {
      round.scored = true;
      round.results = { kind: "king_request_mystery_final", results: round.kingMysteryResults, totals: scoreTotals(next) };
      finalizeRoom(next);
      setPhase(next, "FINAL_RESULTS", now);
    }
  }
  else if (from === "RUMOUR_GUESSING") {
    if (round?.kind === "ROYAL_RUMOURS") {
      await queueRoyalRumourGuessImages(next, effects, now);
      round.royalRumourRevealOrder = deterministicShuffle(Object.keys(round.royalRumourGuesses), `${next.id}:${round.id}:rumour-reveal`);
      round.royalRumourRevealIndex = 0;
      if (!round.royalRumourRevealOrder.length) {
        round.results = { kind: "royal_rumours", chainVotes: {}, winningSourceAnswerIds: [] };
        round.scored = true;
        finalizeRoom(next);
        setPhase(next, "FINAL_RESULTS", now);
      } else setPhase(next, "RUMOUR_IMAGE_REVEAL", now, 1000);
    }
  }
  else if (from === "RUMOUR_IMAGE_REVEAL") {
    if (round?.kind === "ROYAL_RUMOURS") {
      const pending = Object.values(round.royalRumourGuesses).some((guess) => ["QUEUED", "GENERATING"].includes(next.kingImages[guess.id]?.status ?? ""));
      if (pending) next.deadlineAt = now + 4000;
      else setPhase(next, "RUMOUR_REVEAL", now);
    }
  }
  else if (from === "RUMOUR_REVEAL") {
    if (round?.kind === "ROYAL_RUMOURS" && round.royalRumourRevealIndex + 1 < round.royalRumourRevealOrder.length) {
      round.royalRumourRevealIndex += 1;
      setPhase(next, "RUMOUR_REVEAL", now);
    } else if (round?.kind === "ROYAL_RUMOURS") setPhase(next, "RUMOUR_VOTING", now);
  }
  else if (from === "RUMOUR_VOTING") setPhase(next, "VOTE_LOCK", now);
  else if (from === "WAR_RANKING") {
    if (round?.kind === "ROYAL_WAR_ROOM") {
      for (const player of scoringPlayers(next)) if (!round.warRankings[player.id]) round.warRankings[player.id] = deterministicShuffle(round.choiceOptions.map((choice) => choice.id), `${next.id}:${round.id}:${player.id}:war-timeout`);
      round.warTrueOrder = calculateWarOrder(next, round);
      round.warLastMove = null;
      setPhase(next, "WAR_COUNCIL", now);
    }
  }
  else if (from === "WAR_COUNCIL") {
    if (round?.kind === "ROYAL_WAR_ROOM") {
      const commanderId = warCommanderId(next, round) ?? "royal-council";
      round.warLastMove = { playerId: commanderId, team: round.warTurnTeam, choiceId: null, guessedRank: null, correct: false, skipped: true };
      setPhase(next, "WAR_TURN_REVEAL", now);
    }
  }
  else if (from === "WAR_TURN_REVEAL") {
    if (round?.kind === "ROYAL_WAR_ROOM") {
      round.warTurnNumber += 1;
      if (warRoundComplete(round)) {
        round.results = { kind: "royal_war_room", campaign: next.warCampaign, trueOrder: round.warTrueOrder, placements: round.warPlacements, clues: round.warClues, teamScores: next.warTeamScores };
        round.scored = true;
        setPhase(next, "WAR_ROUND_REVEAL", now);
      } else {
        round.warTurnTeam = round.warTurnTeam === "LION" ? "RAVEN" : "LION";
        round.warLastMove = null;
        setPhase(next, "WAR_COUNCIL", now);
      }
    }
  }
  else if (from === "WAR_ROUND_REVEAL") {
    if (round?.kind === "ROYAL_WAR_ROOM" && next.roundIndex + 1 < next.roundPlan.length) {
      const created = setupRound(next, next.roundIndex + 1, now);
      setPhase(next, "ROUND_INTRO", now);
      effects.push({ type: "round", round: created });
    } else if (round?.kind === "ROYAL_WAR_ROOM") {
      finalizeWarRoom(next);
      setPhase(next, "FINAL_RESULTS", now);
    }
  }
  else if (from === "FINAL_WAGER") { if (next.gameLength !== "birthday") await queueFinalImage(next, effects, now); setPhase(next, "FINAL_ANSWERING", now); }
  else if (from === "REVEAL") {
    if (round?.kind === "FINAL_READ" || round?.kind === "THE_REMIX" || round?.kind === "KING_PROMPTER_FINAL") { finalizeRoom(next); setPhase(next, "FINAL_RESULTS", now); }
    else if (round?.kind === "MONSTER_FACTORY") setPhase(next, "POST_GAME", now);
    else setPhase(next, "ROUND_RESULTS", now);
  } else if (from === "ROUND_RESULTS") {
    if (next.gameLength === "pictures" && round?.kind === "PROMPT_AND_CIRCUMSTANCE") {
      const saved = next.kingRounds.find((candidate) => candidate.index === round.index);
      if (saved) Object.assign(saved, clone(round));
      if (round.index === 0) {
        next.currentRound = clone(next.kingRounds.find((candidate) => candidate.index === 1)!);
        next.roundIndex = 1;
        setPhase(next, "IMAGE_REVEAL", now, 1000);
      } else {
        const created = setupRound(next, 2, now);
        setPhase(next, "ROUND_INTRO", now);
        effects.push({ type: "round", round: created });
      }
    } else {
    if (round) {
      next.answerHistory.push(...round.answers.filter((answer) => !answer.hidden));
    }
    activatePending(next, effects);
    if (next.roundIndex + 1 < next.roundPlan.length) { const created = setupRound(next, next.roundIndex + 1, now); setPhase(next, "ROUND_INTRO", now); effects.push({ type: "round", round: created }); }
    else { finalizeRoom(next); setPhase(next, "FINAL_RESULTS", now); }
    }
  } else if (from === "FINAL_RESULTS") setPhase(next, "POST_GAME", now);
  else if (from === "ENCORE_IMAGE") {
    if (round) { round.answers = []; round.votes = []; round.scored = false; round.prompt = `Name the creature, then answer: ${MONSTER_FOLLOWUPS[stableHash(round.id) % MONSTER_FOLLOWUPS.length]}`; round.instruction = "Put the name first, then your answer."; }
    setPhase(next, "ENCORE_FOLLOWUP", now, phaseDurationMs(next.gameLength, "ANSWERING", next.timerAccessibility));
  }
  settleBotTurns(next, effects, now);
  const actionId = `transition:${base.version}:${from}:${base.deadlineAt}`;
  return { changed: next.phase !== from || next.deadlineAt !== base.deadlineAt || effects.length > 0, next, effects, actionId };
}

export function replayRoundId(state: RoomState): string { return state.currentRound?.id ?? "lobby"; }
export function nonInteractiveSeconds(phase: RoomPhase): number { return NON_INTERACTIVE_SECONDS[phase] ?? 0; }
