import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import { ARCADE_GAMES, ARCADE_MAX_CONTROLLERS, getArcadeControllerCapacity } from "../lib/arcade/catalog";
import type { ArcadeGameId } from "../lib/arcade/contracts";
import { createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { advanceDriftRacer, createDriftRacerMatch, driftRacerSnapshot, getDriftRacerResult, submitDriftRacerInput } from "../server/arcade/drift_racer";
import { createFlatterfluffMatch, fireFlatterfluffShot, flatterfluffSnapshot, nextFlatterfluffRound, revealFlatterfluffRound } from "../server/arcade/flatterfluff";
import { advanceKartentischTrick, chooseKartentischCard, createKartentischMatch, kartentischLegalCards, kartentischSnapshot, revealKartentischTrick } from "../server/arcade/kartentisch";
import { chooseDungeonPartyAction, createDungeonPartyMatch, dungeonPartySnapshot, nextDungeonPartyEncounter, revealDungeonPartyEncounter } from "../server/arcade/dungeon_party";
import { chooseWordTilesWord, createWordTilesMatch, nextWordTilesRound, revealWordTilesRound, wordTilesSnapshot } from "../server/arcade/word_tiles";
import { chooseSchattenjagdSuspect, createSchattenjagdMatch, nextSchattenjagdCase, revealSchattenjagdCase, schattenjagdSnapshot } from "../server/arcade/schattenjagd";
import { createImposterMatch, getImposterResult, imposterSnapshot, submitImposterClue, submitImposterVote } from "../server/arcade/imposter";
import { buzzwortSnapshot, createBuzzwortMatch, getBuzzwortResult, submitBuzzwortClue, submitBuzzwortGuess } from "../server/arcade/buzzwort";
import { arenaSurvivorSnapshot, chooseArenaSurvivor, createArenaSurvivorMatch, getArenaSurvivorResult, revealArenaSurvivor } from "../server/arcade/arena_survivor";
import { advanceChaosMission, chaosSnapshot, chooseChaosTool, createChaosMatch, finishChaosMatch, nextChaosMission } from "../server/arcade/chaos_kommando";
import { createDrawGuessMatch, drawGuessSnapshot, getDrawGuessResult, submitDrawGuess, submitDrawGuessDrawing } from "../server/arcade/draw_guess";
import { createPantomimeMatch, getPantomimeResult, pantomimeSnapshot, submitPantomimeGuess } from "../server/arcade/pantomime";
import { advanceSchaetzorama, createSchaetzoramaMatch, getSchaetzoramaResult, schaetzoramaSnapshot, submitSchaetzoramaEstimate } from "../server/arcade/schaetzorama";
import { applyLightTrailsInput, createLightTrailsState, LIGHT_TRAILS_HEIGHT, LIGHT_TRAILS_STEP_MS, LIGHT_TRAILS_WIDTH, lightTrailsFinalResult, stepLightTrails, toLightTrailsSnapshot } from "../arcade-worker/src/games/light-trails";
import { applyTapRaceInput, createTapRaceState, finalTapRaceResult, stepTapRace, toTapRaceSnapshot } from "../arcade-worker/src/games/tap-race";

const players = Array.from({ length: 10 }, (_, seat) => `p${seat + 1}`);
const setup = { matchId: "ten-native", players, now: 1_000, seed: 47 };
const host = { role: "host" as const };
const phone = { role: "player" as const, playerId: "p10" };
const stateOf = <T,>(result: { ok: true; state: T } | { ok: false; code: string }): T => {
  if (!result.ok) assert.fail(result.code);
  return result.state;
};
function persisted<T extends { matchId: string }>(gameId: ArcadeGameId, field: string, match: T, result?: object): T {
  const room = createRoomState("TENN", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: gameId }, 1_000);
  room.phase = result ? "ARCADE_RESULTS" : "ARCADE_ACTIVE";
  room.status = result ? "COMPLETE" : "ACTIVE";
  room.arcadeMatch = { id: match.matchId, gameId, matchNumber: 1, status: result ? "COMPLETE" : "ACTIVE", startedAt: 1_000, endedAt: result ? 2_000 : null, result: result ? { ...result } : null };
  Object.assign(room, { [field]: match });
  const serialized = serializeRoomState(room);
  const restored = deserializeRoomState(serialized);
  const value = (restored as unknown as Record<string, T>)[field]!;
  assert.deepEqual(value, match);
  const extraSeat = JSON.parse(serialized);
  extraSeat[field].players.push("p11");
  assert.throws(() => deserializeRoomState(JSON.stringify(extraSeat)), (error) => error instanceof ZodError && error.issues.some((issue) => issue.path[0] === field && (issue.code === "too_big" && issue.path[1] === "players" || issue.code === "custom" && issue.path[1] === field)));
  return value;
}

test("every non-duel catalog room provides ten controllers", () => {
  assert.equal(ARCADE_MAX_CONTROLLERS, 10);
  for (const game of ARCADE_GAMES) {
    if (["air-hockey", "magic-arena", "magic-duell", "minions-td"].includes(game.id)) continue;
    assert.equal(getArcadeControllerCapacity(game.id), 10, game.id);
  }
});

const factories = [createDriftRacerMatch, createFlatterfluffMatch, createKartentischMatch, createDungeonPartyMatch, createWordTilesMatch, createSchattenjagdMatch, createImposterMatch, createBuzzwortMatch, createArenaSurvivorMatch, createChaosMatch, createDrawGuessMatch, createPantomimeMatch, createSchaetzoramaMatch];
for (const create of factories) test(`${create.name} rejects an eleventh player and duplicate seats`, () => {
  assert.throws(() => create({ ...setup, players: [...players, "p11"] }));
  assert.throws(() => create({ ...setup, players: [...players.slice(0, 9), "p1"] }));
});

test("ten Drift Racer inputs survive persistence and every driver reaches final standings", () => {
  let match = persisted("drift-racer", "driftRacer", createDriftRacerMatch(setup));
  while (match.phase === "racing") {
    for (const playerId of players) match = stateOf(submitDriftRacerInput(match, { matchId: match.matchId, turn: match.turn, playerId, input: { throttle: "accelerate", steer: 0, drift: false, boost: false }, now: match.updatedAt + 1 }));
    assert.equal(driftRacerSnapshot(match, phone).submitted, true);
    assert.equal("inputs" in driftRacerSnapshot(match, host), false);
    match = stateOf(advanceDriftRacer(match, { now: match.deadline }));
  }
  match = persisted("drift-racer", "driftRacer", match, getDriftRacerResult(match));
  assert.deepEqual(match.result!.standings.map((entry) => entry.playerId).sort(), [...players].sort());
  assert.ok(players.every((id) => match.drivers[id]!.distance > 0));
});

test("ten Flatterfluff shots score in every wave with hidden aim and persisted final results", () => {
  let match = persisted("flatterfluff", "flatterfluff", createFlatterfluffMatch(setup));
  for (let round = 1; round <= 5; round += 1) {
    const target = match.targets[0]!;
    for (const playerId of players) match = stateOf(fireFlatterfluffShot(match, { matchId: match.matchId, round, playerId, x: target.x, y: target.y, now: match.updatedAt + 1 }));
    assert.equal(flatterfluffSnapshot(match, phone).submitted, true);
    assert.equal("shots" in flatterfluffSnapshot(match, host), false);
    match = stateOf(revealFlatterfluffRound(match, { now: match.updatedAt + 1 }));
    assert.equal(match.results.at(-1)!.shots.length, 10);
    if (round < 5) match = stateOf(nextFlatterfluffRound(match, { now: match.updatedAt + 1 }));
  }
  persisted("flatterfluff", "flatterfluff", match, match.results.at(-1));
  assert.equal(match.phase, "complete");
  assert.ok(players.every((id) => match.scores[id]! > 0));
});

test("Kartentisch deals fifty unique hidden cards and includes all ten players in five legal tricks", () => {
  let match = persisted("kartentisch", "kartentisch", createKartentischMatch(setup));
  assert.equal(new Set(Object.values(match.initialHands).flat().map((card) => card.id)).size, 50);
  assert.equal(kartentischSnapshot(match, phone).ownHand!.length, 5);
  assert.equal("hands" in kartentischSnapshot(match, host), false);
  for (let trick = 1; trick <= 5; trick += 1) {
    while (match.turnPlayerId) {
      const playerId = match.turnPlayerId;
      match = stateOf(chooseKartentischCard(match, { matchId: match.matchId, trick, playerId, cardId: kartentischLegalCards(match, playerId)[0]!.id, now: match.updatedAt + 1 }));
    }
    match = stateOf(revealKartentischTrick(match, { now: match.updatedAt + 1 }));
    assert.equal(match.trickResults.at(-1)!.plays.length, 10);
    if (trick < 5) match = stateOf(advanceKartentischTrick(match, { now: match.updatedAt + 1 }));
  }
  persisted("kartentisch", "kartentisch", match, match.result);
  assert.equal(Object.values(match.scores).reduce((sum, score) => sum + score, 0), 5);
  assert.equal(Object.keys(match.result!.hands).length, 10);
});

test("Dungeon Party scales ten-player encounters and persists every explorer's action", () => {
  let match = persisted("dungeon-party", "dungeonParty", createDungeonPartyMatch(setup));
  assert.equal(match.definition.target, 5);
  for (let encounter = 1; encounter <= 3; encounter += 1) {
    for (const playerId of players) match = stateOf(chooseDungeonPartyAction(match, { matchId: match.matchId, encounter, playerId, actionId: match.definition.actions[0]!.id, now: match.updatedAt + 1 }));
    assert.equal(dungeonPartySnapshot(match, phone).submitted, true);
    assert.equal("choices" in dungeonPartySnapshot(match, host), false);
    match = stateOf(revealDungeonPartyEncounter(match, { now: match.updatedAt + 1 }));
    assert.equal(match.encounterResults.at(-1)!.actions.length, 10);
    if (encounter < 3) match = stateOf(nextDungeonPartyEncounter(match, { now: match.updatedAt + 1 }));
  }
  persisted("dungeon-party", "dungeonParty", match, match.result);
  assert.equal(match.result!.outcome, "escaped");
  assert.equal(match.result!.score, 3_000);
});

test("Word Tiles retains ten private words and ten tied winners across five serialized rounds", () => {
  let match = persisted("word-tiles", "wordTiles", createWordTilesMatch(setup));
  for (let round = 1; round <= 5; round += 1) {
    for (const playerId of players) match = stateOf(chooseWordTilesWord(match, { matchId: match.matchId, round, playerId, word: match.roundData[round - 1]!.solutionWord, now: match.updatedAt + 1 }));
    assert.equal(wordTilesSnapshot(match, phone).submitted, true);
    assert.equal("choices" in wordTilesSnapshot(match, host), false);
    match = stateOf(revealWordTilesRound(match, { now: match.updatedAt + 1 }));
    assert.equal(match.roundResults.at(-1)!.submissions.length, 10);
    if (round < 5) match = stateOf(nextWordTilesRound(match, { now: match.updatedAt + 1 }));
  }
  persisted("word-tiles", "wordTiles", match, match.result);
  assert.deepEqual(match.result!.winners, players);
});

test("Schattenjagd records ten correct votes and the scaled team bonus in all four cases", () => {
  let match = persisted("schattenjagd", "schattenjagd", createSchattenjagdMatch(setup));
  for (let round = 1; round <= 4; round += 1) {
    for (const playerId of players) match = stateOf(chooseSchattenjagdSuspect(match, { matchId: match.matchId, round, playerId, suspectId: match.cases[round - 1]!.targetId, now: match.updatedAt + 1 }));
    assert.equal(schattenjagdSnapshot(match, phone).submitted, true);
    assert.equal("choices" in schattenjagdSnapshot(match, host), false);
    match = stateOf(revealSchattenjagdCase(match, { now: match.updatedAt + 1 }));
    assert.equal(match.caseResults.at(-1)!.correctCount, 10);
    assert.equal(match.caseResults.at(-1)!.teamBonusApplied, true);
    if (round < 4) match = stateOf(nextSchattenjagdCase(match, { now: match.updatedAt + 1 }));
  }
  persisted("schattenjagd", "schattenjagd", match, match.result);
  assert.deepEqual(match.result!.winners, players);
});

test("Imposter assigns ten secret roles and counts every clue and ballot", () => {
  let match = persisted("imposter", "imposter", createImposterMatch(setup));
  assert.equal(imposterSnapshot(match, host).assignment, undefined);
  const imposterId = match.roles.find((entry) => entry.role === "imposter")!.playerId;
  for (const playerId of players) match = stateOf(submitImposterClue(match, { matchId: match.matchId, round: 1, playerId, clue: "a useful clue", now: match.updatedAt + 1 }));
  assert.equal(match.phase, "voting");
  for (const playerId of players) match = stateOf(submitImposterVote(match, { matchId: match.matchId, round: 1, playerId, targetPlayerId: playerId === imposterId ? players.find((id) => id !== imposterId)! : imposterId, now: match.updatedAt + 1 }));
  const result = getImposterResult(match);
  persisted("imposter", "imposter", match, result);
  assert.equal(result.roles.length, 10); assert.equal(result.clues.length, 10);
  assert.equal(result.voteCounts[imposterId], 9); assert.equal(result.winner, "civilians");
});

test("Buzzwort assigns all ten players to balanced teams while preserving private clue cards", () => {
  let match = persisted("buzzwort", "buzzwort", createBuzzwortMatch(setup));
  assert.equal(Object.values(match.teams).filter((team) => team === "ember").length, 5);
  assert.equal(Object.values(match.teams).filter((team) => team === "cobalt").length, 5);
  assert.equal(buzzwortSnapshot(match, host).assignment, undefined);
  assert.ok(players.every((playerId) => buzzwortSnapshot(match, { role: "player", playerId }).assignment));
  match = stateOf(submitBuzzwortClue(match, { matchId: match.matchId, round: 1, attempt: match.attempt, playerId: match.clueGiverId, text: "a familiar thing with covered terms", now: match.updatedAt + 1 }));
  match = stateOf(submitBuzzwortGuess(match, { matchId: match.matchId, round: 1, attempt: match.attempt, playerId: match.guesserId, guess: match.card.word, now: match.updatedAt + 1 }));
  const result = getBuzzwortResult(match); persisted("buzzwort", "buzzwort", match, result);
  assert.equal(Object.keys(result.roles).length, 10); assert.equal(Object.keys(result.teams).length, 10);
  assert.equal(result.outcome, "guessed");
});

test("Arena Survivor scores ten private choices and persists ten survivors", () => {
  let match = persisted("arena-survivor", "arenaSurvivor", createArenaSurvivorMatch(setup));
  for (const playerId of players) match = stateOf(chooseArenaSurvivor(match, { matchId: match.matchId, round: 1, playerId, choiceId: match.successfulChoiceId, now: match.updatedAt + 1 }));
  assert.equal(arenaSurvivorSnapshot(match, phone).submitted, true);
  assert.equal("choices" in arenaSurvivorSnapshot(match, host), false);
  match = stateOf(revealArenaSurvivor(match, { now: match.updatedAt + 1 }));
  const result = getArenaSurvivorResult(match); persisted("arena-survivor", "arenaSurvivor", match, result);
  assert.equal(result.submissions.length, 10); assert.deepEqual(result.winners, players);
});

test("Chaos-Kommando resolves and persists ten tools in every mission", () => {
  let match = persisted("chaos-kommando", "chaosKommando", createChaosMatch(setup));
  for (let missionNumber = 1; missionNumber <= 4; missionNumber += 1) {
    for (const [index, playerId] of players.entries()) match = stateOf(chooseChaosTool(match, { matchId: match.matchId, missionNumber, playerId, toolId: match.mission.tools[index % match.mission.tools.length]!.id, now: match.updatedAt + 1 }));
    assert.equal(chaosSnapshot(match, phone).submitted, true);
    assert.equal("choices" in chaosSnapshot(match, host), false);
    match = stateOf(advanceChaosMission(match, { now: match.updatedAt + 1 }));
    assert.equal(match.missionResults.at(-1)!.submissions.length, 10);
    if (missionNumber < 4) match = stateOf(nextChaosMission(match, { now: match.updatedAt + 1 }));
  }
  match = finishChaosMatch(match); persisted("chaos-kommando", "chaosKommando", match, match.result);
  assert.equal(match.result!.missions.length, 4);
});

test("Draw & Guess keeps ten seats and accepts all nine guessers before a persisted win", () => {
  let match = persisted("zeichnen-und-erraten", "drawGuess", createDrawGuessMatch(setup));
  assert.equal(drawGuessSnapshot(match, host).assignment, undefined);
  match = stateOf(submitDrawGuessDrawing(match, { matchId: match.matchId, round: 1, playerId: match.artistId, drawing: [{ color: "#123456", width: 4, points: [{ x: 1, y: 1 }, { x: 20, y: 20 }] }], now: match.updatedAt + 1 }));
  const guessers = players.filter((id) => id !== match.artistId);
  for (const playerId of guessers) match = stateOf(submitDrawGuess(match, { matchId: match.matchId, round: 1, attempt: 1, playerId, guess: "not the answer", now: match.updatedAt + 1 }));
  assert.equal(Object.keys(match.guesses).length, 9);
  const winner = guessers.at(-1)!;
  match = stateOf(submitDrawGuess(match, { matchId: match.matchId, round: 1, attempt: 2, playerId: winner, guess: match.prompt, now: match.updatedAt + 1 }));
  const result = getDrawGuessResult(match); persisted("zeichnen-und-erraten", "drawGuess", match, result);
  assert.equal(Object.keys(result.scores).length, 10); assert.equal(result.winnerId, winner);
});

test("Pantomime keeps ten seats and accepts all nine guessers before a persisted win", () => {
  let match = persisted("pantomime", "pantomime", createPantomimeMatch(setup));
  assert.equal(pantomimeSnapshot(match, host).assignment, undefined);
  const guessers = players.filter((id) => id !== match.performerId);
  for (const playerId of guessers) match = stateOf(submitPantomimeGuess(match, { matchId: match.matchId, round: 1, attempt: 1, playerId, guess: "not the answer", now: match.updatedAt + 1 }));
  assert.equal(Object.keys(match.guesses).length, 9);
  const winner = guessers.at(-1)!;
  match = stateOf(submitPantomimeGuess(match, { matchId: match.matchId, round: 1, attempt: 2, playerId: winner, guess: match.prompt, now: match.updatedAt + 1 }));
  const result = getPantomimeResult(match); persisted("pantomime", "pantomime", match, result);
  assert.equal(Object.keys(result.scores).length, 10); assert.equal(result.winnerId, winner);
});

test("Schaetzorama scores ten estimates across five private persisted rounds", () => {
  let match = persisted("schaetzorama", "schaetzorama", createSchaetzoramaMatch(setup));
  for (let round = 1; round <= 5; round += 1) {
    for (const playerId of players) match = stateOf(submitSchaetzoramaEstimate(match, { playerId, round, version: match.version, estimate: match.prompts[round - 1]!.answer, now: match.updatedAt + 1 }));
    assert.equal(schaetzoramaSnapshot(match, phone).submitted, true);
    assert.equal(schaetzoramaSnapshot(match, host).estimates.length, 0);
    match = stateOf(advanceSchaetzorama(match, { now: match.updatedAt + 1 }));
    assert.equal(schaetzoramaSnapshot(match, host).estimates.length, 10);
    match = stateOf(advanceSchaetzorama(match, { now: match.updatedAt + 1 }));
  }
  const result = getSchaetzoramaResult(match); persisted("schaetzorama", "schaetzorama", match, result);
  assert.deepEqual(result.winners, [...players].sort()); assert.ok(players.every((id) => result.scores[id] === 5));
});

test("Light Trails spawns ten distinct riders, carries tenth trail ownership, and finishes all ten", () => {
  assert.throws(() => createLightTrailsState("too-many", 1_000, [...players, "p11"]));
  let match = createLightTrailsState("ten-trails", 1_000, players);
  assert.equal(new Set(match.riders.map((rider) => `${rider.x},${rider.y}`)).size, 10);
  const context = { now: 1_001, emit: () => {} };
  for (const playerId of players) match = applyLightTrailsInput(match, { kind: "position", playerId, seq: 1, x: 0.5, y: 0.5, receivedAt: context.now }, context);
  match = stepLightTrails(JSON.parse(JSON.stringify(match)), LIGHT_TRAILS_STEP_MS, { ...context, now: 1_100 });
  assert.ok(match.riders.every((rider) => rider.distance === 1));
  const snapshot = toLightTrailsSnapshot(match, 1, { role: "host", playerId: null }).state as { trail: string };
  assert.equal(snapshot.trail.length, LIGHT_TRAILS_WIDTH * LIGHT_TRAILS_HEIGHT);
  const tenth = match.riders[9]!;
  assert.equal(Number.parseInt(snapshot.trail[tenth.y * LIGHT_TRAILS_WIDTH + tenth.x]!, 36), 10);
  match = stepLightTrails(match, LIGHT_TRAILS_STEP_MS, { ...context, now: match.deadlineAt });
  assert.deepEqual(Object.keys(lightTrailsFinalResult(match)!.distance), players);
});

test("existing eight-rider Light Trails states retain their spawn layout and wire encoding", () => {
  const match = createLightTrailsState("eight-trails", 1_000, players.slice(0, 8));
  assert.deepEqual(match.riders.map(({ x, y, direction }) => ({ x, y, direction })), [
    { x: 4, y: 4, direction: "right" }, { x: 59, y: 31, direction: "left" },
    { x: 4, y: 31, direction: "right" }, { x: 59, y: 4, direction: "left" },
    { x: 32, y: 2, direction: "down" }, { x: 32, y: 33, direction: "up" },
    { x: 2, y: 18, direction: "right" }, { x: 61, y: 18, direction: "left" },
  ]);
  const restored = JSON.parse(JSON.stringify(match));
  const snapshot = toLightTrailsSnapshot(restored, 0, { role: "host", playerId: null }).state as { trail: string };
  assert.equal(snapshot.trail, match.trail.map(String).join(""));
});

test("Tap Race accepts ten racers, records each tap, and persists all ten final distances", () => {
  assert.throws(() => createTapRaceState("too-many", 1_000, [...players, "p11"]));
  let match = createTapRaceState("ten-taps", 1_000, players);
  for (const playerId of players) match = applyTapRaceInput(match, { kind: "tap", playerId, seq: 1, receivedAt: 1_001 }, 1_001);
  const snapshot = toTapRaceSnapshot(match, 1, { role: "host", playerId: null }).state as { racers: unknown[] };
  assert.equal(snapshot.racers.length, 10); assert.ok(match.racers.every((racer) => racer.progress === 1));
  match = stepTapRace(JSON.parse(JSON.stringify(match)), 100, match.deadlineAt);
  assert.deepEqual(finalTapRaceResult(match)!.winners, players);
  assert.equal(Object.keys(finalTapRaceResult(match)!.progress).length, 10);
});
