import { sketchRelaySnapshot } from "./arcade/sketch_relay";
import { fishFinaleSnapshot } from "./arcade/fish_finale";
import type { AudienceSnapshot, DisplaySnapshot, HostSnapshot, PlayerSnapshot, RoleSnapshot } from "../lib/contracts";
import { SCORE_CAPS } from "../lib/game/config";
import { FEEDBACK_CARDS_PER_GAME, FEEDBACK_COOLDOWN_MS, FEEDBACK_REWARD_POINTS, feedbackDeckForPlayer } from "../lib/content/feedback";
import { deterministicShuffle } from "../lib/game/random";
import { restorationLayout } from "../lib/game/restoration-layouts";
import { audienceMembers, mysteryPublicIdsForRound, scoreTotals, scoringPlayers } from "./engine";
import type { ParticipantState, RoomState } from "./types";
import { bowlRoundLabel } from "./bowl";
import { selectArcadeControllerIds } from "./arcade/tickets";
import { schaetzoramaSnapshot } from "./arcade/schaetzorama";
import { imposterSnapshot } from "./arcade/imposter";
import { buzzwortSnapshot } from "./arcade/buzzwort";
import { pantomimeSnapshot } from "./arcade/pantomime";
import { drawGuessSnapshot } from "./arcade/draw_guess";
import { arenaSurvivorSnapshot } from "./arcade/arena_survivor";
import { chaosSnapshot } from "./arcade/chaos_kommando";
import { magicArenaSnapshot } from "./arcade/magic_arena";
import { magicDuellSnapshot } from "./arcade/magic_duell";
import { minionsTdSnapshot } from "./arcade/minions_td";
import { kartentischSnapshot } from "./arcade/kartentisch";
import { dungeonPartySnapshot } from "./arcade/dungeon_party";
import { flatterfluffSnapshot } from "./arcade/flatterfluff";
import { driftRacerSnapshot } from "./arcade/drift_racer";
import { wordTilesSnapshot } from "./arcade/word_tiles";
import { schattenjagdSnapshot } from "./arcade/schattenjagd";

const REVEAL_PHASES = new Set(["REVEAL", "ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME", "ENDED"]);
const ANSWER_PUBLIC_PHASES = new Set(["IMAGE_REVEAL", "VOTING", "VOTE_LOCK", "FINAL_VOTING", "REVEAL", "ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME"]);

function answerImage(state: RoomState, answer: { id: string; sourceAnswerId?: string }) {
  const image = (state.kingImages ?? {})[answer.sourceAnswerId ?? answer.id];
  return image ? { status: image.status, assetId: image.assetId, conceptTitle: image.conceptTitle, conceptCaption: image.conceptCaption } : undefined;
}

function currentRoundImagesPending(state: RoomState): boolean {
  const round = state.currentRound;
  return Boolean(round?.answers.some((answer) => {
    const image = (state.kingImages ?? {})[answer.id];
    return image && ["QUEUED", "GENERATING"].includes(image.status);
  }));
}

function showsKingImages(state: RoomState): boolean {
  const round = state.currentRound;
  if (!round || !["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL", "COMIC_FRAME"].includes(round.kind) || currentRoundImagesPending(state)) return false;
  if (round.kind === "KING_PROMPTER_FINAL") return !["INTRO", "ROUND_INTRO"].includes(state.phase);
  if (round.kind === "COMIC_FRAME") return ["IMAGE_REVEAL", "FINAL_VOTING", "REVEAL", "ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME"].includes(state.phase) || (state.phase === "VOTE_LOCK" && round.voteStage === "IMAGE");
  return ["IMAGE_REVEAL", "FINAL_VOTING", "REVEAL", "ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME"].includes(state.phase) || (state.phase === "VOTE_LOCK" && round.voteStage === "IMAGE");
}

function publicPlayers(state: RoomState, now: number) {
  const totals = scoreTotals(state);
  return state.participants.filter((participant) => !participant.removedAt).map((participant) => ({
    id: participant.id, nickname: participant.nickname, role: participant.role, seat: participant.seat, lobbySlot: participant.lobbySlot, avatar: participant.avatar, avatarConfig: participant.avatarConfig, avatarPreset: participant.avatarPreset ?? null, color: participant.color,
    connected: participant.bot || now - participant.lastSeenAt < 10_000, active: participant.active, pendingActivation: participant.pendingActivation, bot: participant.bot,
    birthdayVip: participant.id === state.birthdayPersonId,
    score: participant.role === "player" ? totals[participant.id] ?? 0 : undefined,
  }));
}

function publicBowl(state: RoomState) {
  const bowl = state.bowl;
  if (!bowl) return null;
  return { environment: bowl.environment, roundTwo: bowl.roundTwo, scrollsPerPlayer: bowl.scrollsPerPlayer, builtInVoice: bowl.builtInVoice, openingTutorial: bowl.openingTutorial, teams: { ...bowl.teams }, scores: { ...bowl.scores }, activeTeam: bowl.activeTeam, clueGiverId: bowl.clueGiverId, remainingScrolls: bowl.remainingIds.length, totalScrolls: bowl.scrolls.length, passAvailable: !bowl.suddenDeath && !bowl.passUsed, roundNumber: bowl.roundNumber, roundLabel: bowlRoundLabel(state), drawing: bowl.drawing, clueWord: bowl.clueWord, submittedPlayerIds: Object.keys(bowl.submissions), suddenDeath: bowl.suddenDeath, suddenDeathOccurred: bowl.suddenDeathOccurred, winnerTeam: bowl.winnerTeam, lastCorrectUndoAvailable: Boolean(bowl.undo) };
}

function anonymousProgressIds(count: number, kind: "submission" | "response"): string[] {
  return Array.from({ length: count }, (_, index) => `anonymous-${kind}-${index + 1}`);
}

function baseSnapshot<R extends RoleSnapshot["role"]>(state: RoomState, role: R, now: number, viewerId?: string) {
  // Queue discovery carries opaque IDs only; assignment and prompt data stay private.
  const sketchImageJobs = state.gameLength === "arcade" && state.arcadeGameId === "sketch-relay" && state.phase === "ARCADE_ACTIVE" && state.arcadeMatch?.status === "ACTIVE" && state.sketchRelay?.matchId === state.arcadeMatch.id
    ? [...new Set(state.sketchRelay.chains.filter(chain => chain.round === state.sketchRelay!.round).flatMap(chain => [chain.drawing, chain.redraw].flatMap(leg => leg && !leg.practice && leg.image.status === "QUEUED" && leg.image.jobId ? [leg.image.jobId] : [])))]
    : [];
  return {
    role, code: state.code, version: state.version, stateVersion: state.version, serverTime: now, phase: state.phase, deadlineAt: state.deadlineAt,
    paused: state.paused, joiningLocked: state.joiningLocked, soloMode: state.soloMode, soloLiveImages: state.soloLiveImages ?? false, imageModel: state.imageModel ?? "flux-1-schnell", imageGenerationNotice: state.imageGenerationNotice ?? null, developerMode: state.developerMode,
    imageJobsPending: sketchImageJobs.length > 0 || Object.values(state.kingImages ?? {}).some((image) => ["QUEUED", "GENERATING"].includes(image.status)), ...(sketchImageJobs.length ? { sketchImageJobs } : {}), comicTheme: state.comicTheme ?? null,
    comicFrames: (state.comicFrames ?? []).map((frame) => ({ frameNumber: frame.frameNumber, prompt: frame.prompt, authorId: frame.authorId, image: { status: frame.image.status, assetId: frame.image.assetId, conceptTitle: frame.image.conceptTitle, conceptCaption: frame.image.conceptCaption } })),
    restoration: restorationSnapshot(state), mystery: mysterySnapshot(state), rumours: royalRumoursSnapshot(state), warRoom: warRoomSnapshot(state), bowl: publicBowl(state), arcade: state.arcadeMatch ? { gameId: state.arcadeMatch.gameId, matchId: state.arcadeMatch.id, startedAt: state.arcadeMatch.startedAt, endedAt: state.arcadeMatch.endedAt, result: state.phase === "ARCADE_RESULTS" ? state.arcadeMatch.result : null } : null,
    fishGame: state.fishGame ? fishFinaleSnapshot(state.fishGame, viewerId, role === "host" || role === "display", now) : null,
    schaetzorama: state.schaetzorama ? schaetzoramaSnapshot(state.schaetzorama, { role: role === "player" ? "player" : role === "audience" ? "spectator" : "host", ...(role === "player" ? { playerId: "" } : {}) }) : null,
    imposter: state.imposter && role !== "player" ? imposterSnapshot(state.imposter, { role: role === "audience" ? "spectator" : "host" }) : null,
    buzzwort: state.buzzwort ? buzzwortSnapshot(state.buzzwort, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    pantomime: state.pantomime ? pantomimeSnapshot(state.pantomime, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    sketchRelay: state.sketchRelay ? sketchRelaySnapshot(state.sketchRelay, { role: role === "host" ? "host" : "spectator" }, now) : null,
    drawGuess: state.drawGuess ? drawGuessSnapshot(state.drawGuess, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    arenaSurvivor: state.arenaSurvivor ? arenaSurvivorSnapshot(state.arenaSurvivor, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    chaosKommando: state.chaosKommando ? chaosSnapshot(state.chaosKommando, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    magicArena: state.magicArena ? magicArenaSnapshot(state.magicArena, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    magicDuell: state.magicDuell ? magicDuellSnapshot(state.magicDuell, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    minionsTd: state.minionsTd ? minionsTdSnapshot(state.minionsTd, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    kartentisch: state.kartentisch ? kartentischSnapshot(state.kartentisch, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    dungeonParty: state.dungeonParty ? dungeonPartySnapshot(state.dungeonParty, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    flatterfluff: state.flatterfluff ? flatterfluffSnapshot(state.flatterfluff, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    driftRacer: state.driftRacer ? driftRacerSnapshot(state.driftRacer, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    wordTiles: state.wordTiles ? wordTilesSnapshot(state.wordTiles, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    schattenjagd: state.schattenjagd ? schattenjagdSnapshot(state.schattenjagd, { role: role === "host" || role === "display" ? "host" : "spectator" }) : null,
    foolBowl: foolBowlSnapshot(state), roundId: state.currentRound?.id ?? "lobby",
    roundKind: state.currentRound?.kind ?? null, roundNumber: Math.max(0, state.roundIndex + 1), roundTotal: state.roundPlan.length,
    players: publicPlayers(state, now), audienceCount: audienceMembers(state).length,
  } as const;
}

function restorationSnapshot(state: RoomState) {
  const round = state.currentRound;
  if (state.gameLength !== "pictures" || round?.kind !== "KING_PROMPTER_FINAL" || !state.kingRestorationBase) return null;
  const answers = new Map(round.answers.map((answer) => [answer.playerId, answer]));
  const showImages = (["IMAGE_REVEAL", "FINAL_VOTING", "VOTE_LOCK", ...REVEAL_PHASES].includes(state.phase) && !(state.phase === "IMAGE_REVEAL" && currentRoundImagesPending(state)));
  const showAuthorship = REVEAL_PHASES.has(state.phase);
  const winningAnswerIds = showAuthorship ? ((round.results as { finalWinningAnswerIds?: string[] } | null)?.finalWinningAnswerIds ?? []) : [];
  return {
    base: state.kingRestorationBase,
    slots: restorationLayout(scoringPlayers(state).length).map((slot) => {
      const playerId = Object.entries(state.kingRestorationAssignments).find(([, slotId]) => slotId === slot.id)?.[0];
      const answer = playerId ? answers.get(playerId) : undefined;
      return { ...slot, ...(answer && showImages && answerImage(state, answer) ? { image: answerImage(state, answer) } : {}), ...(answer && showAuthorship ? { answerId: answer.id, playerId, prompt: answer.text } : {}) };
    }),
    winningAnswerIds,
  };
}

function featuredMysteryAnswer(state: RoomState) {
  const round = state.currentRound;
  if (!round || round.kind !== "KING_REQUEST_MYSTERY") return null;
  const answerId = round.kingMysteryOrder[round.kingMysteryIndex] ?? round.featuredAnswerId;
  return round.answers.find((answer) => answer.id === answerId && !answer.hidden) ?? null;
}

function publicMysteryResult(round: NonNullable<RoomState["currentRound"]>, answerId: string) {
  const result = round.kingMysteryResults[answerId];
  if (!result) return null;
  const publicIds = mysteryPublicIdsForRound(round, answerId);
  return {
    ...result,
    realChoiceId: publicIds.choices[result.realChoiceId] ?? "",
    votes: Object.fromEntries(Object.entries(result.votes).map(([playerId, choiceId]) => [playerId, publicIds.choices[choiceId] ?? ""])),
    choiceAuthors: Object.fromEntries(Object.entries(result.choiceAuthors).map(([choiceId, authorId]) => [publicIds.choices[choiceId] ?? "", authorId])),
    fooledByChoice: Object.fromEntries(Object.entries(result.fooledByChoice).map(([choiceId, playerIds]) => [publicIds.choices[choiceId] ?? "", playerIds])),
    sealedChoiceIds: result.sealedChoiceIds.map((choiceId) => publicIds.choices[choiceId] ?? ""),
  };
}

function mysteryChoiceStates(state: RoomState) {
  const round = state.currentRound;
  const featured = featuredMysteryAnswer(state);
  if (!round || !featured) return [];
  return deterministicShuffle([
    { id: featured.id, text: featured.text, playerId: featured.playerId, real: true },
    ...(round.kingMysteryDecoys[featured.id] ?? []).map((decoy) => ({ id: decoy.id, text: decoy.text, playerId: decoy.playerId, real: false })),
  ], `${state.id}:${round.id}:${featured.id}:mystery-choices`);
}

function mysterySnapshot(state: RoomState) {
  const round = state.currentRound;
  const featured = featuredMysteryAnswer(state);
  if (!round || !featured || !["MYSTERY_DECOYS", "MYSTERY_VOTING", "MYSTERY_REVEAL"].includes(state.phase)) return null;
  const image = answerImage(state, featured);
  if (!image) return null;
  const showChoices = ["MYSTERY_VOTING", "MYSTERY_REVEAL"].includes(state.phase);
  const publicIds = mysteryPublicIdsForRound(round, featured.id);
  return {
    turnNumber: round.kingMysteryIndex + 1,
    totalTurns: round.kingMysteryOrder.length,
    turnId: publicIds.turnId,
    featuredImage: image,
    options: showChoices ? mysteryChoiceStates(state).map(({ id, text }) => ({ id: publicIds.choices[id] ?? "", text })) : [],
    decoyCount: (round.kingMysteryDecoys[featured.id] ?? []).length,
    eligibleDecoyCount: Math.max(0, scoringPlayers(state).length - 1),
    result: state.phase === "MYSTERY_REVEAL" ? publicMysteryResult(round, featured.id) : null,
  };
}

function royalRumoursSnapshot(state: RoomState) {
  const round = state.currentRound;
  if (!round || round.kind !== "ROYAL_RUMOURS" || !["RUMOUR_REVEAL", "RUMOUR_VOTING", "VOTE_LOCK", "FINAL_RESULTS", "POST_GAME"].includes(state.phase)) return null;
  const order = state.phase === "RUMOUR_REVEAL" ? [round.royalRumourRevealOrder[round.royalRumourRevealIndex]].filter(Boolean) : round.royalRumourRevealOrder;
  const chainVotes = (round.results as { chainVotes?: Record<string, number> } | null)?.chainVotes ?? {};
  const winners = new Set((round.results as { winningSourceAnswerIds?: string[] } | null)?.winningSourceAnswerIds ?? []);
  return {
    revealIndex: round.royalRumourRevealIndex,
    totalChains: round.royalRumourRevealOrder.length,
    chains: order.flatMap((sourceAnswerId) => {
      const original = round.answers.find((answer) => answer.id === sourceAnswerId && !answer.hidden);
      const guess = round.royalRumourGuesses[sourceAnswerId];
      const firstImage = original ? answerImage(state, original) : undefined;
      const secondImage = guess ? answerImage(state, { id: guess.id }) : undefined;
      return original && guess && firstImage && secondImage ? [{ sourceAnswerId, originalText: original.text, originalAuthorId: original.playerId, firstImage, guessId: guess.id, guessText: guess.text, guessAuthorId: guess.playerId, secondImage, votes: chainVotes[sourceAnswerId] ?? 0, winner: winners.has(sourceAnswerId) }] : [];
    }),
  };
}

function warRoomSnapshot(state: RoomState) {
  const round = state.currentRound;
  if (state.gameLength !== "royal-war-room") return null;
  const team = round?.kind === "ROYAL_WAR_ROOM" ? round.warTurnTeam : null;
  const teamPlayers = team ? scoringPlayers(state).filter((player) => state.warTeams[player.id] === team).sort((a, b) => a.seat - b.seat) : [];
  const commanderId = round?.kind === "ROYAL_WAR_ROOM" && teamPlayers.length ? teamPlayers[Math.floor(round.warTurnNumber / 2) % teamPlayers.length].id : null;
  const revealOrder = round?.kind === "ROYAL_WAR_ROOM" && ["WAR_ROUND_REVEAL", "FINAL_RESULTS", "POST_GAME"].includes(state.phase);
  return {
    campaign: state.warCampaign, teams: state.warTeams, teamScores: state.warTeamScores, scoutUsed: state.warScoutUsed, choices: round?.choiceOptions ?? [],
    activeTeam: team, commanderId, targetRanks: round?.warTargetRanks ?? [], placements: round?.warPlacements ?? {}, clues: round?.warClues ?? [],
    lastMove: state.phase === "WAR_TURN_REVEAL" || revealOrder ? round?.warLastMove ?? null : null,
    trueOrder: revealOrder ? round?.warTrueOrder ?? [] : null, turnNumber: round?.warTurnNumber ?? 0, maxTurns: round?.warMaxTurns ?? 0,
  };
}

function foolBowlSnapshot(state: RoomState, selfId?: string) {
  if (state.gameLength !== "bowl-of-fools") return null;
  const round = state.currentRound?.kind === "BOWL_OF_FOOLS" ? state.currentRound : null;
  const submittedPlayerIds = round ? [...new Set(round.foolScrolls.map((scroll) => scroll.playerId))] : [];
  const secret = selfId && round?.foolClueGiverId === selfId && ["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(state.phase)
    ? round.foolScrolls.find((scroll) => scroll.id === round.foolCurrentScrollId)?.text
    : undefined;
  return {
    playMode: state.foolPlayMode, performance: state.foolPerformance, voiceEnabled: state.foolVoiceEnabled, scrollsPerPlayer: state.foolScrollsPerPlayer,
    teams: state.foolTeams, readyPlayerIds: state.foolReadyPlayerIds, turnOrder: {
      BELLS: deterministicShuffle(scoringPlayers(state).filter((player) => state.foolTeams[player.id] === "BELLS"), `${state.id}:match-${state.matchNumber}:fool-turn-order:BELLS`).map((player) => player.id),
      MOTLEY: deterministicShuffle(scoringPlayers(state).filter((player) => state.foolTeams[player.id] === "MOTLEY"), `${state.id}:match-${state.matchNumber}:fool-turn-order:MOTLEY`).map((player) => player.id),
    }, teamScores: state.foolTeamScores, submittedPlayerIds, gameRound: round?.foolRoundNumber ?? 1,
    activeTeam: round?.foolTurnTeam ?? null, clueGiverId: round?.foolClueGiverId ?? null, poolRemaining: round?.foolPool.length ?? 0,
    totalScrolls: round?.foolScrolls.length ?? 0, passUsed: round?.foolPassUsed ?? false, oneWord: round?.foolOneWord ?? null,
    spokenClue: round?.foolSpokenClue ?? null, performanceCue: round?.foolPerformanceCue ?? null,
    strokes: (round?.foolStrokes ?? []).map(({ id, points }) => ({ id, points })), lastResult: round?.foolLastResult ?? null,
    suddenDeath: round?.foolSuddenDeath ?? false, winner: state.foolWinner, ...(secret ? { secretScroll: secret } : {}),
  };
}

function revealResults(state: RoomState): unknown {
  const round = state.currentRound;
  if (!round || !REVEAL_PHASES.has(state.phase)) return null;
  if (round.kind === "KING_REQUEST_MYSTERY") {
    const results = Object.fromEntries(Object.entries(round.kingMysteryResults).map(([answerId]) => {
      const publicIds = mysteryPublicIdsForRound(round, answerId);
      return [publicIds.turnId, publicMysteryResult(round, answerId)];
    }));
    return { kind: "king_request_mystery", completedTurns: Object.keys(results).length, totalTurns: round.kingMysteryOrder.length, results, ...(Array.isArray(round.results?.winnerIds) ? { winnerIds: round.results.winnerIds } : {}), totals: scoreTotals(state), awards: state.awards, roomLore: state.roomLore };
  }
  return {
    ...(round.results ?? {}),
    answerAuthors: Object.fromEntries(round.answers.filter((answer) => !answer.hidden).map((answer) => [answer.id, answer.playerId])),
    totals: scoreTotals(state), awards: state.awards, roomLore: state.roomLore,
  };
}

function imageSnapshot(state: RoomState) {
  const image = ["FINAL_RESULTS", "POST_GAME", "ENDED"].includes(state.phase)
    ? state.finalImage
    : state.currentRound?.kind === "MAKE_IT_REAL" ? state.anchorImage : state.currentRound?.image;
  if (!image) return null;
  return { status: image.status, assetId: image.assetId, conceptTitle: image.conceptTitle, conceptCaption: image.conceptCaption };
}

function memoryTrail(state: RoomState) {
  return (["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"] as const).flatMap((kind) => {
    const id = state.primaryMemoryIds[kind]; const memory = state.lore.find((item) => item.id === id && item.safe);
    return memory ? [{ id: memory.id, kind: memory.kind, text: memory.text }] : [];
  });
}

export function hostSnapshot(state: RoomState, now = Date.now()): HostSnapshot {
  const round = state.currentRound;
  const { official, audience } = round ? round.votes.reduce((stats, vote) => {
    vote.answerIds.forEach((id, index) => {
      const target = vote.audience ? stats.audience : stats.official;
      target[id] = (target[id] ?? 0) + (vote.audience ? 1 : vote.answerIds.length - index);
    });
    return stats;
  }, { official: {} as Record<string, number>, audience: {} as Record<string, number> }) : { official: {}, audience: {} };
  const showAnswers = !["KING_REQUEST_MYSTERY", "ROYAL_RUMOURS"].includes(round?.kind ?? "") && ANSWER_PUBLIC_PHASES.has(state.phase) && !(state.phase === "IMAGE_REVEAL" && currentRoundImagesPending(state));
  const reveal = REVEAL_PHASES.has(state.phase);
  const featured = featuredMysteryAnswer(state);
  const mysteryDecoys = featured ? round?.kingMysteryDecoys[featured.id] ?? [] : [];
  const mysteryVotes = featured ? round?.kingMysteryVotes[featured.id] ?? {} : {};
  const snapshot = {
    ...baseSnapshot(state, "host", now), gameLength: state.gameLength, arcadeGameId: state.arcadeGameId, botSeats: state.botSeats ?? [], contentMode: state.contentMode, timerAccessibility: state.timerAccessibility, sorceryLength: state.sorceryLength ?? "long",
    birthdayName: state.birthdayName, birthdayPersonId: state.birthdayPersonId,
    prompt: round?.prompt ?? null, instruction: round?.instruction ?? null, memoryTrail: memoryTrail(state),
    answers: showAnswers ? (round?.answers.filter((answer) => !answer.hidden).map((answer) => ({ id: answer.id, text: answer.text, ...(showsKingImages(state) ? { image: answerImage(state, answer) } : {}), ...(reveal ? { authorId: answer.playerId } : {}), hidden: answer.hidden, applause: official[answer.id] ?? 0, audienceFavorites: audience[answer.id] ?? 0 })) ?? []) : [],
    submittedPlayerIds: state.phase === "BOWL_SCROLL_WRITING" ? Object.keys(state.bowl?.submissions ?? {}) : round ? (state.phase === "FOOL_WRITING" ? [...new Set(round.foolScrolls.map((scroll) => scroll.playerId))] : state.phase === "WAR_RANKING" ? Object.keys(round.warRankings) : state.phase === "MYSTERY_DECOYS" ? anonymousProgressIds(mysteryDecoys.length, "submission") : state.phase === "MYSTERY_VOTING" ? anonymousProgressIds(Object.keys(mysteryVotes).length, "response") : state.phase === "RUMOUR_GUESSING" ? Object.values(round.royalRumourGuesses).map((guess) => guess.playerId) : state.phase === "PERSONAL_CHOICE" ? Object.keys(round.personalChoices) : state.phase === "AUTHOR_GUESSING" ? Object.keys(round.authorGuesses) : round.answers.map((answer) => answer.playerId)) : [], respondedVoterIds: state.phase === "MYSTERY_VOTING" ? anonymousProgressIds(Object.keys(mysteryVotes).length, "response") : round?.votes.map((vote) => vote.voterId) ?? [],
    results: revealResults(state), image: imageSnapshot(state),
  };
  if (state.gameLength === "arcade") Object.assign(snapshot, { arcadeControllerIds: state.arcadeMatch?.controllerIds ?? (state.arcadeGameId ? selectArcadeControllerIds(state.arcadeGameId, state.participants, state.arcadeMatch?.matchNumber ?? state.matchNumber) : []) });
  return snapshot;
}

export function displaySnapshot(state: RoomState, now = Date.now()): DisplaySnapshot {
  return { ...hostSnapshot(state, now), role: "display" };
}

function assignedAuthorTask(state: RoomState, self: ParticipantState): { answers: Array<{ id: string; text: string }>; authors: Array<{ id: string; label: string }> } {
  const round = state.currentRound;
  const ids = round?.authorAssignments[self.id] ?? [];
  const imageIntermission = round && ["PROMPT_AND_CIRCUMSTANCE", "COMIC_FRAME"].includes(round.kind);
  const history = new Map((imageIntermission ? round.answers : state.answerHistory).map((answer) => [answer.id, answer]));
  const currentAuthorIds = new Set(round?.answers.filter((answer) => !answer.hidden).map((answer) => answer.playerId) ?? []);
  const authors = scoringPlayers(state).filter((player) => imageIntermission ? currentAuthorIds.has(player.id) : player.id !== self.id);
  return {
    answers: ids.flatMap((id) => { const answer = history.get(id); return answer ? [{ id: answer.id, text: answer.text }] : []; }),
    authors: deterministicShuffle(authors, `${state.code}:${round?.id}:${self.id}:author-names`).map((player) => ({ id: player.id, label: player.nickname })),
  };
}

function votingAnswers(state: RoomState, self: ParticipantState): Array<{ id: string; text: string; voteEligible: boolean; image?: ReturnType<typeof answerImage> }> {
  const showEveryKingImage = showsKingImages(state);
  const answers = (state.currentRound?.answers ?? []).filter((answer) => !answer.hidden && (showEveryKingImage || self.role === "audience" || answer.playerId !== self.id));
  return deterministicShuffle(answers, `${state.code}:${state.currentRound?.id}:${state.phase}:${self.id}`).map((answer) => ({
    id: answer.id, text: answer.text, voteEligible: self.role === "audience" || answer.playerId !== self.id,
    ...(showEveryKingImage ? { image: answerImage(state, answer) } : {}),
  }));
}

function submittedForPhase(state: RoomState, self: ParticipantState): boolean {
  if (state.phase === "BOWL_SCROLL_WRITING") return Boolean(state.bowl?.submissions[self.id]);
  const round = state.currentRound;
  if (!round) return false;
  if (["ANSWERING", "ANSWER_LOCK", "FINAL_ANSWERING", "ENCORE_CONTRIBUTING", "ENCORE_FOLLOWUP"].includes(state.phase)) return round.answers.some((answer) => answer.playerId === self.id);
  if (["VOTING", "VOTE_LOCK", "FINAL_VOTING"].includes(state.phase)) {
    const noEligibleVote = self.role === "player" && !round.answers.some((answer) => !answer.hidden && answer.playerId !== self.id);
    return noEligibleVote || round.votes.some((vote) => vote.voterId === self.id);
  }
  if (state.phase === "PERSONAL_CHOICE") return Object.prototype.hasOwnProperty.call(round.personalChoices, self.id);
  if (state.phase === "ROOM_PREDICTION") return Boolean(round.predictions[self.id]);
  if (state.phase === "AUTHOR_GUESSING") return Boolean(round.authorGuesses[self.id]);
  if (state.phase === "FINAL_WAGER") return Boolean(round.wagers[self.id]);
  const featured = featuredMysteryAnswer(state);
  if (featured && state.phase === "MYSTERY_DECOYS") return featured.playerId === self.id || (round.kingMysteryDecoys[featured.id] ?? []).some((decoy) => decoy.playerId === self.id);
  if (featured && state.phase === "MYSTERY_VOTING") return featured.playerId === self.id || Boolean(round.kingMysteryVotes[featured.id]?.[self.id]);
  if (state.phase === "RUMOUR_GUESSING") return Object.values(round.royalRumourGuesses).some((guess) => guess.playerId === self.id);
  if (state.phase === "RUMOUR_VOTING") return Boolean(round.votes.some((vote) => vote.voterId === self.id));
  if (state.phase === "WAR_RANKING") return Boolean(round.warRankings[self.id]);
  if (state.phase === "FOOL_WRITING") return round.foolScrolls.some((scroll) => scroll.playerId === self.id);
  return false;
}

function mysteryTaskData(state: RoomState, self: ParticipantState) {
  const round = state.currentRound;
  const featured = featuredMysteryAnswer(state);
  if (!round || !featured || !["MYSTERY_DECOYS", "MYSTERY_VOTING", "MYSTERY_REVEAL"].includes(state.phase)) return null;
  const decoys = round.kingMysteryDecoys[featured.id] ?? [];
  const ownDecoyIds = new Set(decoys.filter((decoy) => decoy.playerId === self.id).map((decoy) => decoy.id));
  return {
    kingMystery: {
      originalAuthor: featured.playerId === self.id,
      submittedDecoy: decoys.some((decoy) => decoy.playerId === self.id),
      submittedDecoySealed: decoys.some((decoy) => decoy.playerId === self.id && decoy.sealed),
      royalSealAvailable: !round.kingMysterySealUsedByPlayer[self.id],
      voted: Boolean(round.kingMysteryVotes[featured.id]?.[self.id]),
      options: state.phase === "MYSTERY_VOTING" ? mysteryChoiceStates(state).filter((choice) => !ownDecoyIds.has(choice.id)).map(({ id, text }) => ({ id: mysteryPublicIdsForRound(round, featured.id).choices[id] ?? "", text })) : [],
    },
  };
}

function feedbackSnapshot(state: RoomState, self: ParticipantState) {
  const votes = (state.feedbackVotes ?? []).filter((vote) => vote.playerId === self.id && vote.matchNumber === state.matchNumber);
  const votedPairIds = new Set(votes.map((vote) => vote.pairId));
  const pair = feedbackDeckForPlayer(state.id, state.matchNumber, self.id, state.gameLength).find((item) => !votedPairIds.has(item.id)) ?? null;
  const latest = [...votes].sort((a, b) => b.votedAt - a.votedAt)[0];
  return {
    pair: pair ? { id: pair.id, question: pair.question, options: pair.options.map((option) => ({ id: option.id, text: option.text })) } : null,
    nextAvailableAt: latest ? latest.votedAt + FEEDBACK_COOLDOWN_MS : 0,
    rewardPoints: FEEDBACK_REWARD_POINTS,
    completedCount: votes.length,
    totalCount: FEEDBACK_CARDS_PER_GAME,
  };
}

export function playerSnapshot(state: RoomState, self: ParticipantState, now = Date.now()): PlayerSnapshot {
  const round = state.currentRound;
  const reveal = REVEAL_PHASES.has(state.phase);
  const applause = round?.votes.reduce((totals, vote) => {
    if (vote.audience) return totals;
    vote.answerIds.forEach((id, index) => { totals[id] = (totals[id] ?? 0) + vote.answerIds.length - index; });
    return totals;
  }, {} as Record<string, number>) ?? {};
  const crowdChoices = scoringPlayers(state).map((player) => ({ id: player.id, label: player.nickname }));
  const predictionLabels = round?.kind === "CROWD_CONTROL" ? crowdChoices.map((choice) => choice.label) : Array.from({ length: 10 }, (_, index) => `${index * 10}%`);
  const rumourAssignmentId = round?.royalRumourAssignments[self.id];
  const rumourAssignmentImage = rumourAssignmentId ? answerImage(state, { id: rumourAssignmentId }) : undefined;
  const rumourVoteOptions = round?.kind === "ROYAL_RUMOURS" ? round.royalRumourRevealOrder.filter((sourceAnswerId) => {
    const original = round.answers.find((answer) => answer.id === sourceAnswerId);
    const guess = round.royalRumourGuesses[sourceAnswerId];
    return original && guess && original.playerId !== self.id && guess.playerId !== self.id;
  }) : [];
  const warTeam = state.warTeams[self.id] ?? null;
  const warTask = round?.kind === "ROYAL_WAR_ROOM" ? { royalWarRoom: { team: warTeam, commander: warRoomSnapshot(state)?.commanderId === self.id, choices: round.choiceOptions, ownRanking: round.warRankings[self.id] ?? null, scoutAvailable: warTeam ? !state.warScoutUsed[warTeam] : false } } : null;
  const taskData = round?.kind === "BOWL_OF_FOOLS" ? { bowlOfFools: foolBowlSnapshot(state, self.id) }
    : warTask
    ? warTask
    : round?.kind === "ROYAL_RUMOURS" && state.phase === "RUMOUR_GUESSING" ? { royalRumours: { assignedSourceAnswerId: rumourAssignmentId ?? null, assignedImage: rumourAssignmentImage ?? null, submitted: Object.values(round.royalRumourGuesses).some((guess) => guess.playerId === self.id) } }
    : round?.kind === "ROYAL_RUMOURS" && state.phase === "RUMOUR_VOTING" ? { royalRumours: { voteOptions: rumourVoteOptions, voted: round.votes.some((vote) => vote.voterId === self.id) } }
    : round?.kind === "KING_REQUEST_MYSTERY" && ["MYSTERY_DECOYS", "MYSTERY_VOTING", "MYSTERY_REVEAL"].includes(state.phase) ? mysteryTaskData(state, self)
    : round?.kind === "PROMPT_AND_CIRCUMSTANCE" && round.index === 0 && round.answers.some((answer) => answer.playerId === self.id) && state.phase === "ANSWERING" ? { kingRequestPoll: { choices: round.choiceOptions, selectedChoiceId: round.personalChoices[self.id] ?? null } }
    : round?.kind === "KING_PROMPTER_FINAL" ? { restorationSlotId: state.kingRestorationAssignments[self.id] ?? null }
    : round?.kind === "BIRTHDAY_BETS" ? { birthdayName: state.birthdayName, isBirthdayPerson: self.id === state.birthdayPersonId }
    : state.phase === "AUTHOR_GUESSING" ? assignedAuthorTask(state, self)
    : state.phase === "ROOM_PREDICTION" ? { predictionLabels }
    : state.phase === "FINAL_WAGER" ? { targets: scoringPlayers(state).filter((player) => player.id !== self.id).map((player) => ({ id: player.id, label: player.nickname })) }
    : ["CALLBACK", "THE_REMIX"].includes(round?.kind ?? "") ? { memoryTrail: memoryTrail(state) } : null;
  const bowl = publicBowl(state);
  const privateBowl = bowl && state.bowl?.clueGiverId === self.id && state.bowl.activeScrollId ? { ...bowl, activeScroll: state.bowl.scrolls.find((scroll) => scroll.id === state.bowl!.activeScrollId)?.text } : bowl;
  const isFoolHost = state.foolHostPlayerId === self.id;
  return {
    ...baseSnapshot(state, "player", now), sketchRelay: state.sketchRelay ? sketchRelaySnapshot(state.sketchRelay, state.sketchRelay.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }, now) : null, schaetzorama: state.schaetzorama ? schaetzoramaSnapshot(state.schaetzorama, { role: "player", playerId: self.id }) : null, imposter: state.imposter ? imposterSnapshot(state.imposter, state.imposter.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, buzzwort: state.buzzwort ? (state.buzzwort.players.includes(self.id) ? buzzwortSnapshot(state.buzzwort, { role: "player", playerId: self.id }) : buzzwortSnapshot(state.buzzwort, { role: "spectator" })) : null, pantomime: state.pantomime ? pantomimeSnapshot(state.pantomime, state.pantomime.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, drawGuess: state.drawGuess ? drawGuessSnapshot(state.drawGuess, state.drawGuess.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, arenaSurvivor: state.arenaSurvivor ? arenaSurvivorSnapshot(state.arenaSurvivor, state.arenaSurvivor.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, chaosKommando: state.chaosKommando ? chaosSnapshot(state.chaosKommando, state.chaosKommando.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, magicArena: state.magicArena ? magicArenaSnapshot(state.magicArena, state.magicArena.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, kartentisch: state.kartentisch ? kartentischSnapshot(state.kartentisch, state.kartentisch.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, dungeonParty: state.dungeonParty ? dungeonPartySnapshot(state.dungeonParty, state.dungeonParty.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, flatterfluff: state.flatterfluff ? flatterfluffSnapshot(state.flatterfluff, state.flatterfluff.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null, wordTiles: state.wordTiles ? wordTilesSnapshot(state.wordTiles, state.wordTiles.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null,
    fishGame: state.fishGame ? fishFinaleSnapshot(state.fishGame, self.id, false, now) : null,
    foolBowl: foolBowlSnapshot(state, self.id), isHostPlayer: isFoolHost,
    ...(isFoolHost && state.gameLength === "bowl-of-fools" && state.phase === "LOBBY" ? { botSeats: state.botSeats ?? [] } : {}),
    magicDuell: state.magicDuell ? magicDuellSnapshot(state.magicDuell, state.magicDuell.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null,
    minionsTd: state.minionsTd ? minionsTdSnapshot(state.minionsTd, state.minionsTd.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null,
    driftRacer: state.driftRacer ? driftRacerSnapshot(state.driftRacer, state.driftRacer.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null,
    schattenjagd: state.schattenjagd ? schattenjagdSnapshot(state.schattenjagd, state.schattenjagd.players.includes(self.id) ? { role: "player", playerId: self.id } : { role: "spectator" }) : null,
    bowl: privateBowl, selfId: self.id, gameLength: state.gameLength, arcadeGameId: state.arcadeGameId, contentMode: state.contentMode,
    timerAccessibility: state.timerAccessibility, sorceryLength: state.sorceryLength ?? "long", birthdayName: state.birthdayName, prompt: round?.prompt ?? null, instruction: round?.instruction ?? null,
    developerContext: state.developerMode && state.soloMode && self.id === state.soloPlayerId && round ? {
      promptId: round.promptId, roundLabel: round.label, choiceOptions: round.choiceOptions,
      scoreCap: round.developerScoreCap ?? SCORE_CAPS[round.kind] ?? 1000,
      phaseSeconds: state.paused ? Math.max(1, Math.ceil((state.remainingMs ?? 0) / 1000)) : state.deadlineAt ? Math.max(1, Math.ceil((state.deadlineAt - now) / 1000)) : null,
    } : null,
    submitted: submittedForPhase(state, self), locked: submittedForPhase(state, self),
    answerOrder: ["VOTING", "FINAL_VOTING"].includes(state.phase) ? votingAnswers(state, self) : state.phase === "AUTHOR_GUESSING" ? assignedAuthorTask(state, self).answers : [],
    revealAnswers: reveal && round?.kind !== "KING_REQUEST_MYSTERY" ? (round?.answers.filter((answer) => !answer.hidden).map((answer) => ({ id: answer.id, text: answer.text, ...(showsKingImages(state) ? { image: answerImage(state, answer) } : {}), authorId: answer.playerId, applause: applause[answer.id] ?? 0 })) ?? []) : [],
    choices: state.phase === "PERSONAL_CHOICE" ? (round?.kind === "BIRTHDAY_BETS" ? round.choiceOptions : round?.kind === "CROWD_CONTROL" ? crowdChoices : Array.from({ length: 10 }, (_, index) => ({ id: String(index), label: `${index * 10}%` }))) : [],
    ownAnswer: round?.answers.find((answer) => answer.playerId === self.id)?.text ?? null, wager: round?.wagers[self.id] ?? null,
    feedback: feedbackSnapshot(state, self), taskData, results: revealResults(state), image: imageSnapshot(state),
  };
}

export function audienceSnapshot(state: RoomState, self: ParticipantState, now = Date.now()): AudienceSnapshot {
  return {
    ...baseSnapshot(state, "audience", now), schaetzorama: state.schaetzorama ? schaetzoramaSnapshot(state.schaetzorama, { role: "spectator" }) : null, imposter: state.imposter ? imposterSnapshot(state.imposter, { role: "spectator" }) : null, buzzwort: state.buzzwort ? buzzwortSnapshot(state.buzzwort, { role: "spectator" }) : null, pantomime: state.pantomime ? pantomimeSnapshot(state.pantomime, { role: "spectator" }) : null, drawGuess: state.drawGuess ? drawGuessSnapshot(state.drawGuess, { role: "spectator" }) : null, arenaSurvivor: state.arenaSurvivor ? arenaSurvivorSnapshot(state.arenaSurvivor, { role: "spectator" }) : null, chaosKommando: state.chaosKommando ? chaosSnapshot(state.chaosKommando, { role: "spectator" }) : null, magicArena: state.magicArena ? magicArenaSnapshot(state.magicArena, { role: "spectator" }) : null, kartentisch: state.kartentisch ? kartentischSnapshot(state.kartentisch, { role: "spectator" }) : null, dungeonParty: state.dungeonParty ? dungeonPartySnapshot(state.dungeonParty, { role: "spectator" }) : null, wordTiles: state.wordTiles ? wordTilesSnapshot(state.wordTiles, { role: "spectator" }) : null, selfId: self.id, prompt: state.currentRound?.prompt ?? null, instruction: state.currentRound?.instruction ?? null,
    magicDuell: state.magicDuell ? magicDuellSnapshot(state.magicDuell, { role: "spectator" }) : null,
    minionsTd: state.minionsTd ? minionsTdSnapshot(state.minionsTd, { role: "spectator" }) : null,
    driftRacer: state.driftRacer ? driftRacerSnapshot(state.driftRacer, { role: "spectator" }) : null,
    schattenjagd: state.schattenjagd ? schattenjagdSnapshot(state.schattenjagd, { role: "spectator" }) : null,
    submitted: submittedForPhase(state, self), answerOrder: ["VOTING", "FINAL_VOTING"].includes(state.phase) ? votingAnswers(state, self) : [], taskData: null,
    results: revealResults(state), image: imageSnapshot(state),
  };
}
