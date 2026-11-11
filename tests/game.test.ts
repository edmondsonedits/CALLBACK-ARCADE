import assert from "node:assert/strict";
import test from "node:test";
import {
  ContentModeSchema,
  createRoomSchema,
  HostActionSchema,
  PlayerActionSchema,
  roomMediaViewerRoles,
  RoomPhaseSchema,
} from "../lib/contracts";
import {
  BIRTHDAY_CHOICE_QUESTIONS,
  BIRTHDAY_CREATIVE_PROMPTS,
} from "../lib/content/birthday";
import {
  FEEDBACK_CARDS_PER_GAME,
  FEEDBACK_COOLDOWN_MS,
  FEEDBACK_REWARD_POINTS,
  feedbackDeckForPlayer,
  feedbackPair,
  leadingComedyTastes,
} from "../lib/content/feedback";
import { COMIC_THEMES, comicPrompt } from "../lib/content/comics";
import { KING_REQUESTS } from "../lib/content/king-prompter";
import { FOOL_HINTS, foolHintsFor } from "../lib/content/fool-hints";
import {
  CALLBACK_DIRECTIONS,
  CATCH_MODIFIERS,
  CROWD_CONTROL_PROMPTS,
  FINALE_PROMPTS,
  OPEN_PROMPTS,
  READ_THE_ROOM_PROMPTS,
  SEED_PROMPTS,
  WORLD_PROMPTS,
} from "../lib/content/library";
import {
  ROUND_PLANS,
  TIMER_SECONDS,
  phaseDurationMs,
} from "../lib/game/config";
import {
  musicMoodForPhase,
  narrationForPhase,
} from "../lib/game/audio-direction";
import {
  GAME_SOUNDTRACK,
  SOUNDTRACK_TRACKS,
  SOUNDTRACK_VOLUME,
  soundtrackForGame,
} from "../lib/game/soundtrack";
import {
  markCallbackUsed,
  selectCallbackEntry,
} from "../lib/game/callback-pool";
import { buildDeveloperHandoff, sourceHintFor } from "../lib/developer/handoff";
import { PromptDeck } from "../lib/game/prompt-deck";
import { restorationLayout } from "../lib/game/restoration-layouts";
import { deterministicShuffle, randomRoomCode } from "../lib/game/random";
import {
  creativeScore,
  distributionPredictionScore,
  finalWager,
  readTheRoomScore,
  winnersFromTotals,
} from "../lib/game/scoring";
import {
  nextAcceptedVersion,
  shouldAcceptSnapshotVersion,
} from "../lib/game/state-sync";
import {
  graphemeCount,
  normalizeAnswer,
  validateAnswer,
  validateCatch,
  validateNickname,
} from "../lib/game/validators";
import {
  advanceState,
  applyHostAction,
  applyPlayerAction,
  createRoomState,
  fallbackCallbackPrompt,
  fallbackRemixPrompt,
  scoreTotals,
} from "../server/engine";
import {
  deserializeRoomState,
  serializeRoomState,
} from "../server/serialization";
import {
  displaySnapshot,
  hostSnapshot,
  playerSnapshot,
} from "../server/snapshots";
import type { ParticipantState, RoomState } from "../server/types";

test("room codes use four unambiguous secure-alphabet characters", () => {
  for (let index = 0; index < 1000; index += 1)
    assert.match(randomRoomCode(), /^[A-HJ-KM-NP-Z2-9]{4}$/);
});

test("deterministic answer ordering is stable per player and changes by seed", () => {
  const values = ["a", "b", "c", "d", "e", "f"];
  assert.deepEqual(
    deterministicShuffle(values, "room:r1:p1"),
    deterministicShuffle(values, "room:r1:p1"),
  );
  assert.notDeepEqual(
    deterministicShuffle(values, "room:r1:p1"),
    deterministicShuffle(values, "room:r1:p2"),
  );
});

test("state synchronization rejects stale and malformed snapshot versions", () => {
  assert.equal(shouldAcceptSnapshotVersion(12, 13), true);
  assert.equal(shouldAcceptSnapshotVersion(12, 12), true);
  assert.equal(shouldAcceptSnapshotVersion(12, 11), false);
  assert.equal(shouldAcceptSnapshotVersion(12, Number.NaN), false);
  assert.equal(nextAcceptedVersion(12, 11), 12);
  assert.equal(nextAcceptedVersion(12, 13), 13);
  const state = createRoomState(
    "SYNC",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  assert.equal(hostSnapshot(state, 1000).stateVersion, state.version);
});

test("PromptDeck draws deterministically, honors weights, and suppresses recent prompts", () => {
  const cards = [
    { id: "common", weight: 1, recentUseSuppression: 2 },
    { id: "featured", weight: 50, recentUseSuppression: 2 },
  ];
  const deck = new PromptDeck(cards);
  assert.equal(
    deck.draw({ seed: "same", usedIds: [] }).id,
    deck.draw({ seed: "same", usedIds: [] }).id,
  );
  assert.equal(deck.draw({ seed: "same", usedIds: ["featured"] }).id, "common");
  const featuredDraws = Array.from(
    { length: 100 },
    (_, index) => deck.draw({ seed: `weighted-${index}`, usedIds: [] }).id,
  ).filter((id) => id === "featured").length;
  assert.ok(featuredDraws > 80);
});

test("CallbackPool applies explicit eligibility and usage metadata", () => {
  const entries = [
    {
      id: "weak",
      coherence: 0.7,
      answerability: 0.9,
      surprise: 0.9,
      used: false,
    },
    {
      id: "best",
      coherence: 0.95,
      answerability: 0.95,
      surprise: 0.8,
      used: false,
      usageCount: 0,
      lastUsedRoundIndex: null,
    },
  ];
  const selected = selectCallbackEntry(entries, {
    roundIndex: 4,
    minimumCoherence: 0.74,
    minimumAnswerability: 0.7,
    minimumSurprise: 0.45,
  });
  assert.equal(selected?.id, "best");
  markCallbackUsed(selected!, 4);
  assert.equal(selected?.used, true);
  assert.equal(selected?.usageCount, 1);
  assert.equal(selected?.lastUsedRoundIndex, 4);
});

test("room snapshots use validated versioned serialization and migrate the legacy envelope", () => {
  const state = createRoomState(
    "V3RS",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  const restored = deserializeRoomState(serializeRoomState(state));
  assert.equal(restored.serializationVersion, 1);
  assert.equal(restored.code, state.code);
  const legacy = JSON.parse(serializeRoomState(state)) as Record<
    string,
    unknown
  >;
  delete legacy.serializationVersion;
  assert.equal(
    deserializeRoomState(JSON.stringify(legacy)).serializationVersion,
    1,
  );
  assert.throws(
    () =>
      deserializeRoomState(JSON.stringify({ ...legacy, phase: "IS_VOTING" })),
    /Invalid option/,
  );
});

test("nickname and answer validators count graphemes, Unicode, and whitespace correctly", () => {
  assert.equal(graphemeCount("👩🏽‍🚀"), 1);
  assert.equal(validateNickname("  Zoë 👩🏽‍🚀  "), "Zoë 👩🏽‍🚀");
  assert.equal(
    normalizeAnswer("  line one\r\nline two  "),
    "line one\nline two",
  );
  assert.equal(validateAnswer("  <b>still text</b>  "), "<b>still text</b>");
  assert.throws(() => validateNickname("a".repeat(21)), /NICKNAME_LENGTH/);
  assert.throws(() => validateAnswer("🎉".repeat(91)), /ANSWER_LENGTH/);
});

test("the reviewed content libraries meet every minimum", () => {
  assert.ok(OPEN_PROMPTS.length >= 150);
  assert.ok(READ_THE_ROOM_PROMPTS.length >= 75);
  assert.ok(FINALE_PROMPTS.length >= 40);
  assert.equal(CATCH_MODIFIERS.length, 20);
  assert.ok(CALLBACK_DIRECTIONS.length >= 50);
  assert.ok(
    SEED_PROMPTS.length >= 40 &&
      SEED_PROMPTS.every((prompt) =>
        /invent|name|create|pitch|design|give us|describe/i.test(prompt.text),
      ),
  );
  assert.ok(
    WORLD_PROMPTS.length >= 30 &&
      WORLD_PROMPTS.every((prompt) =>
        /law|rule|policy|holiday|trend|event|announcement|require|mandatory|ban/i.test(
          prompt.text,
        ),
      ),
  );
  assert.ok(CROWD_CONTROL_PROMPTS.length >= 15);
  assert.ok(FOOL_HINTS.length >= 200);
  assert.equal(new Set(FOOL_HINTS).size, FOOL_HINTS.length);
  assert.deepEqual(foolHintsFor("player-one", 5), foolHintsFor("player-one", 5));
  assert.ok(
    OPEN_PROMPTS.every(
      (prompt) =>
        ContentModeSchema.safeParse(prompt.contentMode).success &&
        prompt.weight > 0,
    ),
  );
});

test("birthday prompts stay varied, personalized, concise, and choice-safe", () => {
  const ids = BIRTHDAY_CHOICE_QUESTIONS.map((question) => question.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(BIRTHDAY_CHOICE_QUESTIONS.length >= 24);
  for (const question of BIRTHDAY_CHOICE_QUESTIONS) {
    const prompt = question.prompt("Alex");
    assert.match(prompt, /Alex/);
    assert.ok(prompt.length <= 120, `${question.id} is too long`);
    assert.equal(question.choices.length, 4);
    assert.equal(
      new Set(question.choices.map((choice) => choice.toLocaleLowerCase()))
        .size,
      4,
      `${question.id} repeats an option`,
    );
    assert.ok(
      question.choices.every(
        (choice) => choice.length >= 3 && choice.length <= 36,
      ),
      `${question.id} has an awkward option length`,
    );
  }
  for (const [kind, prompts] of Object.entries(BIRTHDAY_CREATIVE_PROMPTS)) {
    assert.ok(prompts.length >= 12, `${kind} needs more replay variety`);
    for (const prompt of prompts) {
      const text = prompt("Alex");
      assert.match(text, /Alex/);
      assert.ok(text.length <= 120, `${kind} prompt is too long`);
    }
  }
  assert.ok(
    BIRTHDAY_CREATIVE_PROMPTS.CROWD_CONTROL.every((prompt) =>
      /^Who\b/.test(prompt("Alex")),
    ),
  );
});

test("all Catch modifier kinds are mechanically enforceable", () => {
  const passing: Record<string, string> = {
    "catch-01": "one two three",
    "catch-02": "one two three four five",
    "catch-03": "one two three four five six seven",
    "catch-04": "one two",
    "catch-05": "one two three",
    "catch-06": "Really now?",
    "catch-07": "Absolutely!",
    "catch-08": "A banana appears",
    "catch-09": "Well actually yes",
    "catch-10": "Meanwhile ducks",
    "catch-11": "Ask Gerald today",
    "catch-12": "Always ready",
    "catch-13": "Best idea",
    "catch-14": "Sure thing",
    "catch-15": "bold tiny words",
    "catch-16": "tiny robots only",
    "catch-17": "tiny robot",
    "catch-18": "one two three four five six seven eight",
    "catch-19": "two words",
    "catch-20": "short enough",
  };
  for (const modifier of CATCH_MODIFIERS)
    assert.equal(
      validateCatch(passing[modifier.id], modifier.rule),
      true,
      modifier.id,
    );
});

test("scoring formulas, wagers, and ties follow the public rules", () => {
  assert.equal(creativeScore(1000, 3, 6), 500);
  assert.equal(creativeScore(1200, 1, 3), 400);
  assert.deepEqual(readTheRoomScore(Array(10).fill(10), Array(10).fill(10)), {
    error: 0,
    accuracy: 100,
    points: 1000,
  });
  assert.deepEqual(distributionPredictionScore([34, 33, 33], [34, 33, 33]), {
    error: 0,
    accuracy: 100,
    points: 1000,
  });
  assert.equal(finalWager(true, 500), 500);
  assert.equal(finalWager(false, 250), -250);
  assert.deepEqual(winnersFromTotals({ a: 900, b: 900, c: 500 }), ["a", "b"]);
});

test("mode plans and base timers match the approved table", () => {
  assert.deepEqual(
    ROUND_PLANS.standard.map((round) => round.kind),
    [
      "THE_SEED",
      "READ_THE_ROOM",
      "MAKE_IT_REAL",
      "THE_CATCH",
      "CROWD_CONTROL",
      "CALLBACK",
      "THE_REMIX",
    ],
  );
  assert.deepEqual(
    ROUND_PLANS.pictures.map((round) => round.kind),
    [
      "PROMPT_AND_CIRCUMSTANCE",
      "PROMPT_AND_CIRCUMSTANCE",
      "KING_PROMPTER_FINAL",
    ],
  );
  assert.equal(TIMER_SECONDS.pictures.creative, 120);
  assert.deepEqual(
    ROUND_PLANS.comic.map((round) => round.kind),
    ["COMIC_FRAME", "COMIC_FRAME", "COMIC_FRAME"],
  );
  assert.deepEqual(
    ROUND_PLANS["king-mystery"].map((round) => round.kind),
    ["KING_REQUEST_MYSTERY"],
  );
  assert.deepEqual(
    ROUND_PLANS["royal-rumours"].map((round) => round.kind),
    ["ROYAL_RUMOURS"],
  );
  assert.deepEqual(
    ROUND_PLANS["royal-war-room"].map((round) => round.kind),
    ["ROYAL_WAR_ROOM", "ROYAL_WAR_ROOM", "ROYAL_WAR_ROOM"],
  );
  assert.equal(phaseDurationMs("royal-war-room", "WAR_RANKING", false), 35_000);
  assert.equal(phaseDurationMs("royal-war-room", "WAR_COUNCIL", false), 25_000);
  assert.equal(
    phaseDurationMs("royal-rumours", "RUMOUR_GUESSING", false),
    45_000,
  );
  assert.equal(
    phaseDurationMs("royal-rumours", "RUMOUR_VOTING", false),
    30_000,
  );
  assert.equal(
    phaseDurationMs("king-mystery", "MYSTERY_DECOYS", false),
    35_000,
  );
  assert.equal(phaseDurationMs("king-mystery", "MYSTERY_VOTING", true), 33_000);
  assert.equal(TIMER_SECONDS.comic.creative, 90);
  assert.ok(COMIC_THEMES.length >= 20);
  assert.deepEqual(
    ROUND_PLANS.birthday.map((round) => round.kind),
    [
      "BIRTHDAY_BETS",
      "FIRST_IMPRESSIONS",
      "BIRTHDAY_BETS",
      "WHO_SAID_THAT",
      "THE_CATCH",
      "CROWD_CONTROL",
      "FINAL_READ",
    ],
  );
  assert.ok(BIRTHDAY_CHOICE_QUESTIONS.length >= 10);
  assert.equal(phaseDurationMs("standard", "ANSWERING", true), 67_500);
});

test("the uploaded soundtrack has a unique stable theme for every game", () => {
  assert.equal(SOUNDTRACK_VOLUME, 0.2);
  assert.equal(SOUNDTRACK_TRACKS.length, 5);
  assert.equal(new Set(Object.values(GAME_SOUNDTRACK)).size, 5);
  for (const game of [
    "pictures",
    "comic",
    "standard",
    "birthday",
    "king-mystery",
    "royal-rumours",
    "royal-war-room",
  ] as const) {
    assert.ok(SOUNDTRACK_TRACKS.includes(soundtrackForGame(game)));
  }
});

test("comic tasks keep the headline short and ask for concrete visual nouns", () => {
  const theme = COMIC_THEMES.find((item) => item.id === "monster-wedding")!;
  const opening = comicPrompt(1, theme, []);
  const escalation = comicPrompt(2, theme, ["Gary wears a tiny veil"]);
  const punchline = comicPrompt(3, theme, [
    "Gary wears a tiny veil",
    "A dragon eats the cake",
  ]);
  assert.equal(opening.prompt, "Create the star of Monster Wedding.");
  assert.match(opening.instruction, /What do they look like\?/);
  assert.equal(escalation.prompt, "Give them a new problem.");
  assert.equal(punchline.prompt, "Show the punchline.");
  assert.ok(
    [opening, escalation, punchline].every((task) => task.prompt.length < 40),
  );
});

test("the host audio director maps game flow to distinct music and narration", () => {
  assert.equal(musicMoodForPhase("LOBBY"), "lobby");
  assert.equal(musicMoodForPhase("ANSWERING"), "thinking");
  assert.equal(musicMoodForPhase("AUTHOR_GUESSING"), "matching");
  assert.equal(musicMoodForPhase("FINAL_VOTING"), "voting");
  assert.equal(musicMoodForPhase("FINAL_RESULTS"), "finale");
  const base = {
    roundKind: "PROMPT_AND_CIRCUMSTANCE" as const,
    roundNumber: 1,
    roundTotal: 3,
    gameLength: "pictures" as const,
    prompt: "A raccoon runs city hall.",
    instruction: "Under twenty words.",
    paused: false,
    players: [
      { nickname: "Danny", role: "player" as const, score: 1200 },
      { nickname: "Kristin", role: "player" as const, score: 900 },
    ],
  };
  assert.match(
    narrationForPhase({ ...base, phase: "ANSWERING" }) ?? "",
    /raccoon runs city hall/i,
  );
  assert.match(
    narrationForPhase({ ...base, phase: "AUTHOR_GUESSING" }) ?? "",
    /art department.*match every prompt/i,
  );
  assert.match(
    narrationForPhase({ ...base, phase: "FINAL_RESULTS" }) ?? "",
    /Danny wins King Prompter with 1,200 points/i,
  );
});

test("retired game modes cannot cross the room-creation boundary", () => {
  for (const gameLength of ["quick", "extended", "cards"]) {
    assert.equal(
      createRoomSchema.safeParse({
        gameLength,
        contentMode: "party",
        timerAccessibility: false,
      }).success,
      false,
      gameLength,
    );
  }
});

test("birthday rooms require and protect a VIP answer, then score predictions deterministically", async () => {
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "birthday",
      contentMode: "party",
      timerAccessibility: false,
    }).success,
    false,
  );
  let state = createRoomState(
    "B30Y",
    {
      gameLength: "birthday",
      contentMode: "party",
      timerAccessibility: false,
      birthdayName: "Alex",
    },
    1000,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  assert.throws(
    () =>
      applyHostAction(
        state,
        {
          type: "START_GAME",
          actionId: "birthday-start",
          roundId: "lobby",
          expectedPhase: "LOBBY",
          payload: {},
        },
        1050,
      ),
    /BIRTHDAY_PERSON_REQUIRED/,
  );
  state = applyHostAction(
    state,
    {
      type: "SET_BIRTHDAY_PERSON",
      actionId: "birthday-vip",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: { playerId: "p1" },
    },
    1060,
  ).next;
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "birthday-start-2",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  state.deadlineAt = 1300;
  state = (await advanceState(state, 1300)).next;
  assert.equal(state.phase, "PERSONAL_CHOICE");
  assert.equal(state.currentRound?.kind, "BIRTHDAY_BETS");
  assert.equal(state.currentRound?.choiceOptions.length, 4);
  assert.equal(hostSnapshot(state, 1300).results, null);
  assert.deepEqual(
    playerSnapshot(state, state.participants[0], 1300).taskData,
    { birthdayName: "Alex", isBirthdayPerson: true },
  );
  const choices = [
    ["p1", "2"],
    ["p2", "2"],
    ["p3", "1"],
  ] as const;
  for (const [playerId, choiceId] of choices)
    state = applyPlayerAction(
      state,
      playerId,
      {
        type: "SUBMIT_PERSONAL_CHOICE",
        actionId: `birthday-choice-${playerId}`,
        roundId: state.currentRound!.id,
        expectedPhase: "PERSONAL_CHOICE",
        payload: { choiceId },
      },
      1400,
    ).next;
  state.deadlineAt = 1500;
  state = (await advanceState(state, 1500)).next;
  assert.equal(state.phase, "REVEAL");
  assert.deepEqual(scoreTotals(state), { p1: 200, p2: 900, p3: 0 });
  const reveal = hostSnapshot(state, 1500).results as {
    kind: string;
    correctChoiceId: string;
    correctPlayerIds: string[];
  };
  assert.equal(reveal.kind, "birthday_bets");
  assert.equal(reveal.correctChoiceId, "2");
  assert.deepEqual(reveal.correctPlayerIds, ["p2"]);
});

test("solo rooms require a player name and accept two to five free local bots", () => {
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "standard",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
      botCount: 2,
    }).success,
    false,
  );
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "standard",
      contentMode: "family",
      timerAccessibility: true,
      soloMode: true,
      soloPlayerName: "Danny",
      botCount: 2,
    }).success,
    true,
  );
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "standard",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
      soloPlayerName: "Danny",
      botCount: 6,
    }).success,
    false,
  );
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "standard",
      contentMode: "party",
      timerAccessibility: false,
      developerMode: true,
      soloPlayerName: "Danny",
      botCount: 2,
    }).success,
    false,
  );
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "standard",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
      developerMode: true,
      soloPlayerName: "Danny",
      botCount: 2,
    }).success,
    true,
  );
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "pictures",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
      soloLiveImages: true,
      soloPlayerName: "Danny",
      botCount: 2,
    }).success,
    true,
  );
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "comic",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
      soloLiveImages: true,
      soloPlayerName: "Danny",
      botCount: 2,
    }).success,
    true,
  );
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "standard",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
      soloLiveImages: true,
      soloPlayerName: "Danny",
      botCount: 2,
    }).success,
    false,
  );
  assert.equal(
    createRoomSchema.safeParse({
      gameLength: "pictures",
      contentMode: "party",
      timerAccessibility: false,
      soloLiveImages: true,
    }).success,
    false,
  );
});

test("developer rooms can tune only their live authoritative round and export a chat handoff", async () => {
  let state = createRoomState(
    "D3V1",
    {
      gameLength: "standard",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
      developerMode: true,
    },
    1000,
  );
  state.soloPlayerId = "p1";
  state.participants = [
    participant(1),
    { ...participant(2), bot: true },
    { ...participant(3), bot: true },
  ];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "developer-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  assert.ok(state.currentRound);
  const originalPrompt = state.currentRound.prompt;
  const edited = applyHostAction(
    state,
    {
      type: "SET_DEVELOPER_ROUND",
      actionId: "developer-edit",
      roundId: state.currentRound.id,
      expectedPhase: state.phase,
      payload: {
        prompt: "Invent the worst possible emergency mascot.",
        instruction: "Keep it painfully specific.",
        scoreCap: 750,
        phaseSeconds: 123,
      },
    },
    1300,
  ).next;
  assert.equal(
    edited.currentRound?.prompt,
    "Invent the worst possible emergency mascot.",
  );
  assert.equal(edited.currentRound?.instruction, "Keep it painfully specific.");
  assert.equal(edited.currentRound?.developerScoreCap, 750);
  assert.equal(edited.deadlineAt, 124300);
  const developerPhone = playerSnapshot(edited, edited.participants[0], 1300);
  assert.equal(developerPhone.developerMode, true);
  assert.equal(developerPhone.developerContext?.scoreCap, 750);
  assert.equal(
    playerSnapshot(edited, edited.participants[1], 1300).developerContext,
    null,
  );

  const handoff = buildDeveloperHandoff([
    {
      id: "change-1",
      createdAt: new Date(0).toISOString(),
      kind: "edit",
      field: "prompt",
      area: "copy",
      before: originalPrompt,
      after: edited.currentRound?.prompt ?? null,
      note: "This version produced faster answers.",
      context: {
        gameLength: "standard",
        contentMode: "party",
        roundNumber: 1,
        roundTotal: 7,
        roundKind: edited.currentRound?.kind ?? null,
        roundLabel: edited.currentRound?.label ?? null,
        phase: edited.phase,
        promptId: edited.currentRound?.promptId ?? null,
        sourceHint: sourceHintFor(
          "prompt",
          edited.currentRound?.kind ?? null,
          edited.currentRound?.promptId ?? null,
          "copy",
        ),
      },
    },
  ]);
  assert.match(handoff, /callback-developer-change-package/);
  assert.match(handoff, /Invent the worst possible emergency mascot/);

  const normal = createRoomState(
    "N0RM",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  assert.throws(
    () =>
      applyHostAction(
        normal,
        {
          type: "SET_DEVELOPER_ROUND",
          actionId: "normal-edit",
          roundId: "lobby",
          expectedPhase: "LOBBY",
          payload: { prompt: "Nope" },
        },
        1200,
      ),
    /DEVELOPER_MODE_REQUIRED/,
  );
});

test("one human and local bots can finish a full standard game without AI jobs", async () => {
  let state = createRoomState(
    "S0L0",
    {
      gameLength: "standard",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
    },
    1000,
  );
  state.soloPlayerId = "p1";
  state.joiningLocked = true;
  state.participants = [
    participant(1),
    {
      ...participant(2),
      nickname: "Deadpan",
      nicknameNormalized: "deadpan",
      bot: true,
    },
    {
      ...participant(3),
      nickname: "Wildcard",
      nicknameNormalized: "wildcard",
      bot: true,
    },
  ];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "solo-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  const effects = [] as Awaited<ReturnType<typeof advanceState>>["effects"];
  let sawStructuredFinale = false;
  let now = 2000;
  for (let step = 0; step < 160 && state.phase !== "POST_GAME"; step += 1) {
    now += 100;
    const phaseBeforeBots = state.phase;
    const botRun = await advanceState(state, now);
    if (botRun.changed) {
      effects.push(...botRun.effects);
      state = botRun.next;
      if (state.phase !== phaseBeforeBots) continue;
    }
    if (["ANSWERING", "FINAL_ANSWERING"].includes(state.phase)) {
      if (state.phase === "FINAL_ANSWERING") {
        const finalePhone = playerSnapshot(state, state.participants[0], now);
        const finaleData = finalePhone.taskData as {
          memoryTrail?: Array<{ kind: string }>;
        } | null;
        assert.equal(
          finalePhone.prompt,
          "Write the final headline for the story your room built tonight.",
        );
        assert.deepEqual(
          finaleData?.memoryTrail?.map((item) => item.kind),
          ["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"],
        );
        sawStructuredFinale = true;
      }
      const action = applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_ANSWER",
          actionId: `solo-answer-${step}`,
          roundId: state.currentRound!.id,
          expectedPhase: state.phase as "ANSWERING" | "FINAL_ANSWERING",
          payload: {
            answer: catchCompliantAnswer(
              state.currentRound,
              `Human answer ${step}`,
            ),
          },
        },
        now,
      );
      effects.push(...action.effects);
      state = action.next;
      continue;
    }
    if (state.phase === "PERSONAL_CHOICE") {
      if (
        Object.prototype.hasOwnProperty.call(
          state.currentRound!.personalChoices,
          "p1",
        )
      ) {
        state.deadlineAt = now;
        continue;
      }
      const choiceId =
        state.currentRound!.kind === "CROWD_CONTROL" ? "p1" : "0";
      const action = applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_PERSONAL_CHOICE",
          actionId: `solo-choice-${step}`,
          roundId: state.currentRound!.id,
          expectedPhase: "PERSONAL_CHOICE",
          payload: { choiceId },
        },
        now,
      );
      effects.push(...action.effects);
      state = action.next;
      continue;
    }
    if (state.phase === "ROOM_PREDICTION") {
      if (state.currentRound!.predictions.p1) {
        state.deadlineAt = now;
        continue;
      }
      const count = state.currentRound!.kind === "CROWD_CONTROL" ? 3 : 10;
      const base = Math.floor(100 / count);
      const values = Array.from(
        { length: count },
        (_value, index) => base + (index < 100 - base * count ? 1 : 0),
      );
      const action = applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_PREDICTION",
          actionId: `solo-prediction-${step}`,
          roundId: state.currentRound!.id,
          expectedPhase: "ROOM_PREDICTION",
          payload: { values },
        },
        now,
      );
      effects.push(...action.effects);
      state = action.next;
      continue;
    }
    if (["VOTING", "FINAL_VOTING"].includes(state.phase)) {
      const answerId = state.currentRound!.answers.find(
        (answer) => answer.playerId !== "p1" && !answer.hidden,
      )!.id;
      const action = applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_VOTE",
          actionId: `solo-vote-${step}`,
          roundId: state.currentRound!.id,
          expectedPhase: state.phase as "VOTING" | "FINAL_VOTING",
          payload: { answerIds: [answerId] },
        },
        now,
      );
      effects.push(...action.effects);
      state = action.next;
      continue;
    }
    if (state.deadlineAt) state.deadlineAt = now;
  }
  assert.equal(state.phase, "POST_GAME");
  assert.equal(sawStructuredFinale, true);
  assert.ok(state.answerHistory.some((answer) => answer.playerId === "p2"));
  assert.equal(state.anchorImage?.status, "FALLBACK");
  assert.equal(state.finalImage?.status, "FALLBACK");
  assert.equal(
    effects.some((effect) => effect.type === "job"),
    false,
  );
  const phone = playerSnapshot(state, state.participants[0], now);
  assert.equal(phone.soloMode, true);
  assert.equal(phone.gameLength, "standard");
  assert.ok(phone.players.filter((player) => player.bot).length === 2);
});

test("public action contracts reject stale shapes and unsupported phases", () => {
  assert.equal(RoomPhaseSchema.safeParse("PAUSED").success, false);
  assert.equal(
    PlayerActionSchema.safeParse({
      type: "SUBMIT_VOTE",
      actionId: "12345678",
      roundId: "r1",
      expectedPhase: "VOTING",
      payload: { answerIds: ["a", "a"] },
      extra: true,
    }).success,
    false,
  );
  assert.equal(
    HostActionSchema.safeParse({
      type: "ADD_TIME",
      actionId: "12345678",
      roundId: "r1",
      expectedPhase: "ANSWERING",
      payload: { seconds: 10 },
    }).success,
    false,
  );
  assert.equal(
    HostActionSchema.safeParse({
      type: "ADD_TIME",
      actionId: "12345678",
      roundId: "r1",
      expectedPhase: "ANSWERING",
      payload: { seconds: 60 },
    }).success,
    true,
  );
  assert.equal(
    PlayerActionSchema.safeParse({
      type: "SUBMIT_KING_DECOY",
      actionId: "12345678",
      roundId: "r1",
      expectedPhase: "MYSTERY_DECOYS",
      payload: { decoy: "The King arguing with a tiny dragon" },
    }).success,
    true,
  );
  assert.equal(
    PlayerActionSchema.safeParse({
      type: "SUBMIT_KING_MYSTERY_VOTE",
      actionId: "12345678",
      roundId: "r1",
      expectedPhase: "MYSTERY_VOTING",
      payload: { choiceId: "choice-1" },
    }).success,
    true,
  );
});

test("tester time controls add the requested amount to running and paused timers", () => {
  let state = createRoomState(
    "T1ME",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  state.phase = "INTRO";
  state.deadlineAt = 5000;
  state = applyHostAction(
    state,
    {
      type: "ADD_TIME",
      actionId: "add-minute-running",
      roundId: "lobby",
      expectedPhase: "INTRO",
      payload: { seconds: 60 },
    },
    2000,
  ).next;
  assert.equal(state.deadlineAt, 65_000);
  state = applyHostAction(
    state,
    {
      type: "PAUSE",
      actionId: "pause-tester-timer",
      roundId: "lobby",
      expectedPhase: "INTRO",
      payload: {},
    },
    3000,
  ).next;
  assert.equal(state.remainingMs, 62_000);
  state = applyHostAction(
    state,
    {
      type: "ADD_TIME",
      actionId: "add-minute-paused",
      roundId: "lobby",
      expectedPhase: "INTRO",
      payload: { seconds: 60 },
    },
    4000,
  ).next;
  assert.equal(state.remainingMs, 122_000);
});

function participant(index: number): ParticipantState {
  return {
    id: `p${index}`,
    nickname: `Player ${index}`,
    nicknameNormalized: `player ${index}`,
    role: "player",
    seat: index,
    avatar: index,
    color: "#46DBDC",
    active: true,
    pendingActivation: false,
    lastSeenAt: 1000,
    removedAt: null,
  };
}

async function finishPromptAuthorMatch(
  state: RoomState,
  now: number,
): Promise<RoomState> {
  assert.equal(state.phase, "AUTHOR_GUESSING");
  const answers = new Map(
    state.currentRound!.answers.map((answer) => [answer.id, answer]),
  );
  for (const player of state.participants.filter(
    (item) =>
      item.role === "player" &&
      !item.bot &&
      !state.currentRound!.authorGuesses[item.id],
  )) {
    const guesses = Object.fromEntries(
      (state.currentRound!.authorAssignments[player.id] ?? []).map(
        (answerId) => [answerId, answers.get(answerId)!.playerId],
      ),
    );
    state = applyPlayerAction(
      state,
      player.id,
      {
        type: "SUBMIT_AUTHOR_GUESSES",
        actionId: `match-${player.id}-${now}`,
        roundId: state.currentRound!.id,
        expectedPhase: "AUTHOR_GUESSING",
        payload: { guesses },
      },
      now,
    ).next;
  }
  state.deadlineAt = now;
  return (await advanceState(state, now)).next;
}

function catchCompliantAnswer(
  round: RoomState["currentRound"],
  fallback: string,
): string {
  const rule = round?.catchModifier?.rule;
  if (!rule) return fallback;
  if (rule.type === "exact_words")
    return Array.from(
      { length: rule.value },
      (_value, index) => `word${index + 1}`,
    ).join(" ");
  if (rule.type === "max_words") return "tiny win";
  if (rule.type === "ending") return `Human answer${rule.value}`;
  if (rule.type === "required_word") return `${rule.value} wins`;
  if (rule.type === "required_name") return "Mabel wins";
  if (rule.type === "starting_letter")
    return `${rule.value.toUpperCase()}mazing win`;
  if (rule.type === "forbidden_letter")
    return rule.value.toLocaleLowerCase() === "e"
      ? "bold win"
      : rule.value.toLocaleLowerCase() === "a"
        ? "tiny win"
        : "bold tiny robot";
  return fallback;
}

async function answeringRoom(): Promise<RoomState> {
  let state = createRoomState(
    "B4CK",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "start-game",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  state.deadlineAt = 1300;
  state = (await advanceState(state, 1300)).next;
  return state;
}

test("player submissions are not blocked by application-level content word filters", async () => {
  const state = await answeringRoom();
  const answer = "A profane cocaine-fuelled Nazi pigeon";
  const submitted = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_ANSWER",
      actionId: "unfiltered-words",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { answer },
    },
    1400,
  ).next;

  assert.equal(
    submitted.currentRound!.answers.find((item) => item.playerId === "p1")
      ?.text,
    answer,
  );
});

test("waiting feedback unlocks only after submission, enforces cooldown, awards capped points, and persists a durable vote effect", async () => {
  let state = await answeringRoom();
  const firstPair = feedbackPair(
    playerSnapshot(state, state.participants[0], 1400).feedback.pair!.id,
  )!;
  assert.throws(
    () =>
      applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_FEEDBACK_VOTE",
          actionId: "feedback-too-early",
          roundId: state.currentRound!.id,
          expectedPhase: "ANSWERING",
          payload: { pairId: firstPair.id, choiceId: "a" },
        },
        1400,
      ),
    /FEEDBACK_CLOSED/,
  );

  state = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_ANSWER",
      actionId: "feedback-answer",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { answer: "A carefully submitted answer" },
    },
    1410,
  ).next;
  const feedback = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_FEEDBACK_VOTE",
      actionId: "feedback-one",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { pairId: firstPair.id, choiceId: "b" },
    },
    1420,
  );
  state = feedback.next;
  assert.equal(scoreTotals(state).p1, FEEDBACK_REWARD_POINTS);
  assert.ok(
    feedback.effects.some(
      (effect) =>
        effect.type === "feedback_vote" &&
        effect.pairId === firstPair.id &&
        effect.choiceId === "b",
    ),
  );
  assert.ok(
    feedback.effects.some(
      (effect) =>
        effect.type === "prediction" &&
        effect.kind === `feedback:${firstPair.id}`,
    ),
  );
  const phone = playerSnapshot(state, state.participants[0], 1420);
  const secondPair = feedbackPair(phone.feedback.pair!.id)!;
  assert.equal(phone.feedback.completedCount, 1);
  assert.equal(phone.feedback.nextAvailableAt, 1420 + FEEDBACK_COOLDOWN_MS);
  assert.throws(
    () =>
      applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_FEEDBACK_VOTE",
          actionId: "feedback-duplicate",
          roundId: state.currentRound!.id,
          expectedPhase: "ANSWERING",
          payload: { pairId: firstPair.id, choiceId: "a" },
        },
        1430,
      ),
    /FEEDBACK_ALREADY_SUBMITTED/,
  );
  assert.throws(
    () =>
      applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_FEEDBACK_VOTE",
          actionId: "feedback-cooldown",
          roundId: state.currentRound!.id,
          expectedPhase: "ANSWERING",
          payload: { pairId: secondPair.id, choiceId: "a" },
        },
        1430,
      ),
    /FEEDBACK_COOLDOWN/,
  );
  state = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_FEEDBACK_VOTE",
      actionId: "feedback-two",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { pairId: secondPair.id, choiceId: "a" },
    },
    1420 + FEEDBACK_COOLDOWN_MS,
  ).next;
  assert.equal(scoreTotals(state).p1, FEEDBACK_REWARD_POINTS * 2);
  assert.equal(
    FEEDBACK_REWARD_POINTS * FEEDBACK_CARDS_PER_GAME,
    150,
    "each game's rotating feedback deck has a fixed 150-point ceiling",
  );
});

test("feedback questions rotate without repeats and Play Again preserves prompt memory", () => {
  const first = feedbackDeckForPlayer("room-1", 1, "p1").map((pair) => pair.id);
  const second = feedbackDeckForPlayer("room-1", 2, "p1").map(
    (pair) => pair.id,
  );
  const third = feedbackDeckForPlayer("room-1", 3, "p1").map((pair) => pair.id);
  assert.equal(first.length, FEEDBACK_CARDS_PER_GAME);
  assert.equal(
    new Set([...first, ...second, ...third]).size,
    FEEDBACK_CARDS_PER_GAME * 3,
  );

  const state = createRoomState(
    "R3PL",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  state.phase = "POST_GAME";
  state.promptHistory = ["already-seen"];
  const replay = applyHostAction(
    state,
    {
      type: "PLAY_AGAIN",
      actionId: "replay-new-deck",
      roundId: "post-game",
      expectedPhase: "POST_GAME",
      payload: {},
    },
    2000,
  ).next;
  assert.equal(replay.matchNumber, 2);
  assert.deepEqual(replay.promptHistory, ["already-seen"]);
});

test("regular rooms can start with two seats and add authoritative lobby bots", async () => {
  let state = createRoomState(
    "B0T2",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  state.participants = [participant(1), participant(2)];
  const added = applyHostAction(
    state,
    {
      type: "ADD_BOT",
      actionId: "add-bot",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1050,
  );
  assert.equal(
    added.next.participants.filter((player) => player.bot).length,
    1,
  );
  assert.equal(added.effects[0]?.type, "participant_add");
  state = applyHostAction(
    added.next,
    {
      type: "START_GAME",
      actionId: "two-player-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  assert.equal(state.phase, "INTRO");
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  state.deadlineAt = 1300;
  state = (await advanceState(state, 1300)).next;
  assert.equal(state.phase, "ANSWERING");
  assert.ok(
    state.currentRound?.answers.some(
      (answer) =>
        answer.playerId ===
        added.next.participants.find((player) => player.bot)?.id,
    ),
  );

  const onePlayer = createRoomState(
    "0NE1",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  onePlayer.participants = [participant(1)];
  assert.throws(
    () =>
      applyHostAction(
        onePlayer,
        {
          type: "START_GAME",
          actionId: "too-small",
          roundId: "lobby",
          expectedPhase: "LOBBY",
          payload: {},
        },
        1100,
      ),
    /NOT_ENOUGH_PLAYERS/,
  );
});

test("read-only displays can fetch generated room images", () => {
  assert.deepEqual(roomMediaViewerRoles, [
    "host",
    "player",
    "audience",
    "display",
  ]);
});

test("secondary display receives a host-shaped read-only snapshot", () => {
  const state = createRoomState(
    "TV42",
    { gameLength: "pictures", contentMode: "party", timerAccessibility: false },
    1000,
  );
  const snapshot = displaySnapshot(state, 1100);
  assert.equal(snapshot.role, "display");
  assert.equal(snapshot.code, "TV42");
  assert.equal(snapshot.phase, "LOBBY");
  assert.deepEqual(snapshot.answers, []);
});

test("waiting-vote decks are specific to each game mode", () => {
  const standard = feedbackDeckForPlayer("room-mode", 1, "p1", "standard");
  const pictures = feedbackDeckForPlayer("room-mode", 1, "p1", "pictures");
  const comic = feedbackDeckForPlayer("room-mode", 1, "p1", "comic");
  const birthday = feedbackDeckForPlayer("room-mode", 1, "p1", "birthday");
  assert.equal(standard.length, FEEDBACK_CARDS_PER_GAME);
  assert.equal(comic.length, FEEDBACK_CARDS_PER_GAME);
  assert.equal(birthday.length, FEEDBACK_CARDS_PER_GAME);
  assert.equal(
    new Set(
      [...standard, ...pictures, ...comic, ...birthday].map((pair) => pair.id),
    ).size,
    FEEDBACK_CARDS_PER_GAME * 4,
  );
  assert.ok(standard.every((pair) => pair.modes?.includes("standard")));
  assert.ok(comic.every((pair) => pair.modes?.includes("comic")));
  assert.ok(birthday.every((pair) => pair.modes?.includes("birthday")));
});

test("durable and current feedback produce a ranked comedy taste profile", () => {
  const profile = leadingComedyTastes({ "feedback-theme-02": { a: 8, b: 0 } }, [
    { pairId: "feedback-prompt-05", choiceId: "a" },
  ]);
  assert.equal(profile[0], "CHARACTER");
  assert.ok(profile.includes("REVERSAL"));
});

test.skip("legacy community theme feedback influenced a later King Prompter canvas", async () => {
  let state = createRoomState(
    "L34N",
    {
      gameLength: "pictures",
      contentMode: "party",
      timerAccessibility: false,
      feedbackTallies: {
        "feedback-theme-01": { a: 2, b: 9 },
        "feedback-style-01": { a: 1, b: 7 },
      },
    },
    1000,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "learning-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  state.phase = "ROUND_RESULTS";
  state.roundIndex = 0;
  state.deadlineAt = 1300;
  state = (await advanceState(state, 1300)).next;
  assert.equal(state.roundIndex, 1);
  assert.match(
    state.currentRound!.instruction ?? "",
    /elegant event ruined by one bizarre guest/i,
  );
  assert.match(
    state.currentRound!.instruction ?? "",
    /dramatic retro science fiction/i,
  );
});

test.skip("legacy prompt-deck feedback became a future canvas launchpad", async () => {
  let state = createRoomState(
    "L34P",
    {
      gameLength: "pictures",
      contentMode: "party",
      timerAccessibility: false,
      feedbackTallies: { "feedback-prompt-12": { a: 50, b: 0 } },
    },
    1000,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "adaptive-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  state.deadlineAt = 1300;
  state = (await advanceState(state, 1300)).next;
  assert.match(state.currentRound!.prompt, /toddler unveiling a rocket/i);
  assert.match(state.currentRound!.prompt, /^Remix this scene:/i);
  assert.ok(
    state.currentRound!.prompt.split(/\s+/u).length <= 14,
    "the controller launchpad stays short enough for a phone screen",
  );
});

test.skip("legacy King Prompter prompt-ranking solo flow", async () => {
  let state = createRoomState(
    "K1NG",
    {
      gameLength: "pictures",
      contentMode: "party",
      timerAccessibility: false,
      soloMode: true,
      soloLiveImages: true,
    },
    1000,
  );
  state.soloPlayerId = "p1";
  state.joiningLocked = true;
  state.participants = [
    participant(1),
    {
      ...participant(2),
      nickname: "Deadpan",
      nicknameNormalized: "deadpan",
      bot: true,
    },
    {
      ...participant(3),
      nickname: "Wildcard",
      nicknameNormalized: "wildcard",
      bot: true,
    },
  ];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "live-solo-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  state.deadlineAt = 1300;
  state = (await advanceState(state, 1300)).next;
  assert.equal(state.phase, "ANSWERING");
  assert.equal(
    state.currentRound!.answers.filter((answer) => answer.playerId !== "p1")
      .length,
    2,
    "both bots wrote prompts through the authoritative turn system",
  );

  state = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_ANSWER",
      actionId: "live-human-prompt",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { answer: "A heroic toaster defending a moonlit castle" },
    },
    1400,
  ).next;
  state.deadlineAt = 1500;
  const imageTransition = await advanceState(state, 1500);
  state = imageTransition.next;
  const imageJobs = imageTransition.effects.filter(
    (effect) => effect.type === "job" && effect.kind === "KING_PROMPT_IMAGE",
  );
  assert.equal(
    imageJobs.length,
    3,
    "the human and both bot prompts receive live image jobs",
  );
  state = await finishPromptAuthorMatch(state, 1525);
  const humanAnswer = state.currentRound!.answers.find(
    (answer) => answer.playerId === "p1",
  )!;
  const botAnswers = state.currentRound!.answers.filter(
    (answer) => answer.playerId !== "p1",
  );
  const botPromptVotes = state.currentRound!.votes.filter(
    (vote) => vote.voterId !== "p1",
  );
  assert.equal(botPromptVotes.length, 2);
  assert.ok(
    botPromptVotes.every((vote) => vote.answerIds[0] === humanAnswer.id),
  );

  state = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_VOTE",
      actionId: "human-prompt-ranking",
      roundId: state.currentRound!.id,
      expectedPhase: "VOTING",
      payload: { answerIds: botAnswers.map((answer) => answer.id) },
    },
    1550,
  ).next;
  state.deadlineAt = 1600;
  state = (await advanceState(state, 1600)).next;
  for (const answer of state.currentRound!.answers)
    state.kingImages[answer.id] = {
      ...state.kingImages[answer.id],
      status: "FALLBACK",
    };
  state.deadlineAt = 1700;
  state = (await advanceState(state, 1700)).next;
  assert.equal(state.phase, "FINAL_VOTING");
  const botImageVotes = state.currentRound!.votes.filter(
    (vote) => vote.voterId !== "p1",
  );
  assert.equal(botImageVotes.length, 2);
  assert.ok(
    botImageVotes.every((vote) => vote.answerIds[0] === humanAnswer.id),
  );
  state = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_VOTE",
      actionId: "human-image-ranking",
      roundId: state.currentRound!.id,
      expectedPhase: "FINAL_VOTING",
      payload: { answerIds: botAnswers.map((answer) => answer.id) },
    },
    1750,
  ).next;
  state.deadlineAt = 1800;
  state = (await advanceState(state, 1800)).next;
  assert.deepEqual(state.kingFinalists, [humanAnswer.id]);
  assert.ok(
    scoreTotals(state).p1 > scoreTotals(state).p2 &&
      scoreTotals(state).p1 > scoreTotals(state).p3,
  );
});

test("King Prompter uses an all-ages request deck and deterministic 3–10 player restoration masks", () => {
  assert.ok(KING_REQUESTS.length >= 100);
  assert.equal(
    new Set(KING_REQUESTS.map((request) => request.id)).size,
    KING_REQUESTS.length,
  );
  for (let count = 3; count <= 10; count += 1) {
    const slots = restorationLayout(count);
    assert.equal(slots.length, count);
    assert.equal(new Set(slots.map((slot) => slot.id)).size, count);
    assert.ok(
      slots.every(
        (slot) =>
          slot.clipPath.startsWith("polygon(") &&
          slot.width > 0 &&
          slot.height > 0,
      ),
    );
  }
});

test("The Royal Frame-Up completes every case without leaking reports or Royal Seals before reveal", async () => {
  let now = 10_000;
  let state = createRoomState(
    "WH4T",
    {
      gameLength: "king-mystery",
      contentMode: "party",
      timerAccessibility: false,
    },
    now,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  assert.throws(
    () =>
      applyHostAction(
        { ...state, participants: [participant(1), participant(2)] },
        {
          type: "START_GAME",
          actionId: "mystery-too-small",
          roundId: "lobby",
          expectedPhase: "LOBBY",
          payload: {},
        },
        ++now,
      ),
    /VISUAL_CHAIN_NEEDS_THREE/,
  );
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "mystery-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    ++now,
  ).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "ANSWERING");
  assert.equal(state.currentRound?.kind, "KING_REQUEST_MYSTERY");

  const requests = [
    "The King arm-wrestling his aunt during a thunderstorm",
    "A pigeon crowning a sleepy bear inside the royal bakery",
    "The Queen racing a dragon on tiny wooden bicycles",
  ];
  for (let index = 0; index < 3; index += 1)
    state = applyPlayerAction(
      state,
      `p${index + 1}`,
      {
        type: "SUBMIT_ANSWER",
        actionId: `mystery-request-${index}`,
        roundId: state.currentRound!.id,
        expectedPhase: "ANSWERING",
        payload: { answer: requests[index] },
      },
      ++now,
    ).next;
  assert.equal(state.phase, "ANSWER_LOCK");
  state.deadlineAt = ++now;
  const queued = await advanceState(state, now);
  state = queued.next;
  assert.equal(state.phase, "IMAGE_REVEAL");
  assert.equal(
    queued.effects.filter(
      (effect) => effect.type === "job" && effect.kind === "KING_MYSTERY_IMAGE",
    ).length,
    3,
  );
  state.phaseStartedAt = now - 300_000;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(
    state.phase,
    "IMAGE_REVEAL",
    "a slow model never exposes an unfinished mystery painting",
  );
  for (const answer of state.currentRound!.answers)
    state.kingImages[answer.id] = {
      ...state.kingImages[answer.id],
      status: "FALLBACK",
    };
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;

  let sealPlayerId: string | null = null;
  let sealedDecoyId: string | null = null;
  for (let turn = 0; turn < 3; turn += 1) {
    assert.equal(state.phase, "MYSTERY_DECOYS");
    const featuredId = state.currentRound!.featuredAnswerId!;
    const featured = state.currentRound!.answers.find(
      (answer) => answer.id === featuredId,
    )!;
    const eligible = state.participants.filter(
      (player) => player.id !== featured.playerId,
    );
    const hiddenHost = hostSnapshot(state, now);
    assert.equal(hiddenHost.answers.length, 0);
    assert.equal(hiddenHost.mystery?.options.length, 0);
    assert.equal(
      JSON.stringify(hiddenHost).includes(featured.text),
      false,
      "the host cannot inspect the real request during forgery writing",
    );

    if (
      turn > 0 &&
      sealPlayerId &&
      eligible.some((player) => player.id === sealPlayerId)
    ) {
      assert.throws(
        () =>
          applyPlayerAction(
            state,
            sealPlayerId!,
            {
              type: "SUBMIT_KING_DECOY",
              actionId: `mystery-second-seal-${turn}`,
              roundId: state.currentRound!.id,
              expectedPhase: "MYSTERY_DECOYS",
              payload: {
                decoy: `A suspicious second sealed report for case ${turn + 1}`,
                useRoyalSeal: true,
              },
            },
            ++now,
          ),
        /ROYAL_SEAL_ALREADY_USED/,
      );
    }
    for (let index = 0; index < eligible.length; index += 1) {
      const useRoyalSeal = turn === 0 && index === 0;
      state = applyPlayerAction(
        state,
        eligible[index].id,
        {
          type: "SUBMIT_KING_DECOY",
          actionId: `mystery-decoy-${turn}-${index}`,
          roundId: state.currentRound!.id,
          expectedPhase: "MYSTERY_DECOYS",
          payload: {
            decoy: `The King caused suspicious banquet incident number ${turn + 1}-${index + 1}`,
            useRoyalSeal,
          },
        },
        ++now,
      ).next;
      if (useRoyalSeal) {
        sealPlayerId = eligible[index].id;
        sealedDecoyId = state.currentRound!.kingMysteryDecoys[featured.id].find(
          (decoy) => decoy.playerId === sealPlayerId,
        )!.id;
        assert.equal(
          state.currentRound!.kingMysterySealUsedByPlayer[sealPlayerId],
          sealedDecoyId,
        );
      }
    }
    state.deadlineAt = ++now;
    state = (await advanceState(state, now)).next;
    assert.equal(state.phase, "MYSTERY_VOTING");
    const votingHost = hostSnapshot(state, now);
    assert.equal(votingHost.mystery?.options.length, 3);
    assert.equal(votingHost.answers.length, 0);
    assert.equal(
      JSON.stringify(votingHost).includes("choiceAuthors"),
      false,
      "decoy writers remain anonymous while voting",
    );
    assert.ok(
      votingHost.mystery?.options.every((option) => !("sealed" in option)),
      "Royal Seal use remains secret on the current ballot",
    );

    const firstPhone = playerSnapshot(state, eligible[0], now);
    const firstData = firstPhone.taskData as {
      kingMystery: { options: Array<{ id: string; text: string }> };
    };
    const ownDecoy = state.currentRound!.kingMysteryDecoys[featured.id].find(
      (decoy) => decoy.playerId === eligible[0].id,
    )!;
    assert.equal(
      firstData.kingMystery.options.some((option) => option.text === ownDecoy.text),
      false,
      "a player's own forgery is absent from their ballot",
    );
    const authorPhone = playerSnapshot(
      state,
      state.participants.find((player) => player.id === featured.playerId)!,
      now,
    );
    assert.equal(
      (authorPhone.taskData as { kingMystery: { originalAuthor: boolean } })
        .kingMystery.originalAuthor,
      true,
    );

    const firstDecoy = state.currentRound!.kingMysteryDecoys[featured.id].find(
      (decoy) => decoy.playerId === eligible[0].id,
    )!;
    const forgerScoreBefore = scoreTotals(state)[eligible[0].id] ?? 0;
    const realBallotId = firstData.kingMystery.options.find((option) => option.text === featured.text)!.id;
    const decoyBallotId = playerSnapshot(state, eligible[1], now).taskData as { kingMystery: { options: Array<{ id: string; text: string }> } };
    const firstDecoyBallotId = decoyBallotId.kingMystery.options.find((option) => option.text === firstDecoy.text)!.id;
    state = applyPlayerAction(
      state,
      eligible[0].id,
      {
        type: "SUBMIT_KING_MYSTERY_VOTE",
        actionId: `mystery-vote-correct-${turn}`,
        roundId: state.currentRound!.id,
        expectedPhase: "MYSTERY_VOTING",
        payload: { choiceId: realBallotId },
      },
      ++now,
    ).next;
    state = applyPlayerAction(
      state,
      eligible[1].id,
      {
        type: "SUBMIT_KING_MYSTERY_VOTE",
        actionId: `mystery-vote-fooled-${turn}`,
        roundId: state.currentRound!.id,
        expectedPhase: "MYSTERY_VOTING",
        payload: { choiceId: firstDecoyBallotId },
      },
      ++now,
    ).next;
    state.deadlineAt = ++now;
    state = (await advanceState(state, now)).next;
    assert.equal(state.phase, "MYSTERY_REVEAL");
    const reveal = hostSnapshot(state, now).mystery?.result;
    assert.equal(reveal?.originalRequest, featured.text);
    assert.equal(reveal?.originalAuthorId, featured.playerId);
    assert.deepEqual(reveal?.correctPlayerIds, [eligible[0].id]);
    assert.equal(reveal?.realChoiceId, realBallotId);
    assert.deepEqual(reveal?.fooledByChoice[firstDecoyBallotId], [eligible[1].id]);
    assert.equal(
      scoreTotals(state)[eligible[0].id] - forgerScoreBefore,
      turn === 0 ? 1250 : 1000,
      "correct detection and bluff rewards include the one-use Royal Seal bonus",
    );
    if (turn === 0) assert.deepEqual(reveal?.sealedChoiceIds, [firstDecoyBallotId]);
    assert.ok(
      scoreTotals(state)[featured.playerId] >= 250,
      "the original artist earned clarity points",
    );

    state.deadlineAt = ++now;
    state = (await advanceState(state, now)).next;
  }
  assert.equal(state.phase, "FINAL_RESULTS");
  assert.equal(state.status, "COMPLETE");
  assert.ok(state.awards.some((award) => award.title === "Royal Detective"));
  const restored = deserializeRoomState(serializeRoomState(state));
  assert.equal(
    Object.keys(restored.currentRound!.kingMysteryResults).length,
    3,
  );
});

test("Royal Rumours passes anonymous AI paintings, reveals complete chains, and scores the funniest mutation", async () => {
  let now = 30_000;
  let state = createRoomState(
    "RUMR",
    {
      gameLength: "royal-rumours",
      contentMode: "party",
      timerAccessibility: false,
    },
    now,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  assert.throws(
    () =>
      applyHostAction(
        { ...state, participants: [participant(1), participant(2)] },
        {
          type: "START_GAME",
          actionId: "rumour-too-small",
          roundId: "lobby",
          expectedPhase: "LOBBY",
          payload: {},
        },
        ++now,
      ),
    /VISUAL_CHAIN_NEEDS_THREE/,
  );
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "rumour-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    ++now,
  ).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "ANSWERING");
  assert.equal(state.currentRound?.kind, "ROYAL_RUMOURS");

  const originals = [
    "The Queen secretly races geese after midnight",
    "The King keeps a dragon inside his wardrobe",
    "The royal pigeon stole every spoon at breakfast",
  ];
  for (let index = 0; index < originals.length; index += 1)
    state = applyPlayerAction(
      state,
      `p${index + 1}`,
      {
        type: "SUBMIT_ANSWER",
        actionId: `rumour-original-${index}`,
        roundId: state.currentRound!.id,
        expectedPhase: "ANSWERING",
        payload: { answer: originals[index] },
      },
      ++now,
    ).next;
  assert.equal(state.phase, "ANSWER_LOCK");
  state.deadlineAt = ++now;
  const firstGeneration = await advanceState(state, now);
  state = firstGeneration.next;
  assert.equal(state.phase, "IMAGE_REVEAL");
  assert.equal(
    firstGeneration.effects.filter(
      (effect) => effect.type === "job" && effect.kind === "KING_PROMPT_IMAGE",
    ).length,
    3,
  );
  assert.equal(
    new Set(Object.values(state.currentRound!.royalRumourAssignments)).size,
    3,
  );
  for (const [playerId, sourceAnswerId] of Object.entries(
    state.currentRound!.royalRumourAssignments,
  ))
    assert.notEqual(
      state.currentRound!.answers.find((answer) => answer.id === sourceAnswerId)
        ?.playerId,
      playerId,
    );
  state.phaseStartedAt = now - 300_000;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(
    state.phase,
    "IMAGE_REVEAL",
    "the first paintings stay hidden until every image resolves",
  );
  for (const answer of state.currentRound!.answers)
    state.kingImages[answer.id] = {
      ...state.kingImages[answer.id],
      status: "FALLBACK",
    };
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "RUMOUR_GUESSING");
  assert.equal(hostSnapshot(state, now).rumours, null);
  assert.equal(hostSnapshot(state, now).answers.length, 0);
  assert.equal(
    JSON.stringify(hostSnapshot(state, now)).includes(originals[0]),
    false,
    "the TV cannot inspect secret source text during blind interpretation",
  );

  const interpretations = [
    "A goose is winning a forbidden moonlight parade",
    "A dragon rents a suspiciously royal cupboard",
    "A pigeon opens an illegal silverware museum",
  ];
  for (let index = 0; index < state.participants.length; index += 1) {
    const player = state.participants[index];
    const phone = playerSnapshot(state, player, now);
    const data = phone.taskData as {
      royalRumours: {
        assignedSourceAnswerId: string;
        assignedImage: { status: string };
      };
    };
    assert.equal(data.royalRumours.assignedImage.status, "FALLBACK");
    assert.equal(
      JSON.stringify(phone).includes(
        originals.find(
          (text) =>
            state.currentRound!.answers.find((answer) => answer.text === text)
              ?.id === data.royalRumours.assignedSourceAnswerId,
        ) ?? "never",
      ),
      false,
      "the guessing phone gets the picture but not its source words",
    );
    state = applyPlayerAction(
      state,
      player.id,
      {
        type: "SUBMIT_ROYAL_RUMOUR_GUESS",
        actionId: `rumour-guess-${index}`,
        roundId: state.currentRound!.id,
        expectedPhase: "RUMOUR_GUESSING",
        payload: { guess: interpretations[index] },
      },
      ++now,
    ).next;
  }
  state.deadlineAt = ++now;
  const secondGeneration = await advanceState(state, now);
  state = secondGeneration.next;
  assert.equal(state.phase, "RUMOUR_IMAGE_REVEAL");
  assert.equal(
    secondGeneration.effects.filter(
      (effect) => effect.type === "job" && effect.kind === "KING_PROMPT_IMAGE",
    ).length,
    3,
  );
  state.phaseStartedAt = now - 300_000;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(
    state.phase,
    "RUMOUR_IMAGE_REVEAL",
    "the retold paintings also wait for confirmation",
  );
  for (const guess of Object.values(state.currentRound!.royalRumourGuesses))
    state.kingImages[guess.id] = {
      ...state.kingImages[guess.id],
      status: "FALLBACK",
    };
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "RUMOUR_REVEAL");
  assert.equal(
    hostSnapshot(state, now).rumours?.chains.length,
    1,
    "the TV reveals one chain at a time",
  );
  for (
    let index = 1;
    index < state.currentRound!.royalRumourRevealOrder.length;
    index += 1
  ) {
    state.deadlineAt = ++now;
    state = (await advanceState(state, now)).next;
  }
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "RUMOUR_VOTING");
  assert.equal(hostSnapshot(state, now).rumours?.chains.length, 3);

  for (const player of state.participants) {
    const phone = playerSnapshot(state, player, now);
    const options = (
      phone.taskData as { royalRumours: { voteOptions: string[] } }
    ).royalRumours.voteOptions;
    assert.equal(
      options.length,
      1,
      "three-player games leave exactly one independent chain per voter",
    );
    state = applyPlayerAction(
      state,
      player.id,
      {
        type: "SUBMIT_VOTE",
        actionId: `rumour-vote-${player.id}`,
        roundId: state.currentRound!.id,
        expectedPhase: "RUMOUR_VOTING",
        payload: { answerIds: [options[0]] },
      },
      ++now,
    ).next;
  }
  assert.equal(state.phase, "VOTE_LOCK");
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "FINAL_RESULTS");
  assert.equal(state.status, "COMPLETE");
  assert.ok(state.awards.some((award) => award.title === "Rumour Mill"));
  assert.ok(state.awards.some((award) => award.title === "Loose Lips"));
  assert.equal(
    (state.currentRound!.results as { winningSourceAnswerIds: string[] })
      .winningSourceAnswerIds.length,
    3,
    "equal vote totals preserve every tied chain",
  );
  assert.ok(
    Object.values(scoreTotals(state)).every((score) => score === 750),
    "each player earns one starter and one interpreter reward across the tied ballot",
  );
  const restored = deserializeRoomState(serializeRoomState(state));
  assert.equal(
    Object.keys(restored.currentRound!.royalRumourGuesses).length,
    3,
  );
});

test("Royal War Room keeps consensus secret, rotates commanders, scores councils, and alternates Attack with Defend", async () => {
  let now = 40_000;
  let state = createRoomState(
    "WARR",
    {
      gameLength: "royal-war-room",
      contentMode: "family",
      timerAccessibility: false,
    },
    now,
  );
  state.participants = [
    participant(1),
    participant(2),
    participant(3),
    participant(4),
  ];
  assert.throws(
    () =>
      applyHostAction(
        { ...state, participants: [participant(1), participant(2)] },
        {
          type: "START_GAME",
          actionId: "war-too-small",
          roundId: "lobby",
          expectedPhase: "LOBBY",
          payload: {},
        },
        ++now,
      ),
    /WAR_ROOM_NEEDS_THREE/,
  );
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "war-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    ++now,
  ).next;
  assert.equal(state.warCampaign, "ATTACK");
  assert.equal(new Set(Object.values(state.warTeams)).size, 2);
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;

  for (let chapter = 0; chapter < 3; chapter += 1) {
    assert.equal(state.phase, "WAR_RANKING");
    const choiceIds = state.currentRound!.choiceOptions.map(
      (choice) => choice.id,
    );
    for (const player of state.participants)
      state = applyPlayerAction(
        state,
        player.id,
        {
          type: "SUBMIT_WAR_RANKING",
          actionId: `war-rank-${chapter}-${player.id}`,
          roundId: state.currentRound!.id,
          expectedPhase: "WAR_RANKING",
          payload: { orderedChoiceIds: choiceIds },
        },
        ++now,
      ).next;
    assert.equal(
      hostSnapshot(state, now).warRoom?.trueOrder,
      null,
      "the host cannot inspect the combined order during ranking",
    );
    assert.equal(
      playerSnapshot(state, state.participants[0], now).warRoom?.trueOrder,
      null,
      "phones cannot inspect the combined order during ranking",
    );
    state.deadlineAt = ++now;
    state = (await advanceState(state, now)).next;
    assert.equal(state.phase, "WAR_COUNCIL");
    assert.deepEqual(state.currentRound!.warTrueOrder, choiceIds);
    assert.equal(
      hostSnapshot(state, now).warRoom?.trueOrder,
      null,
      "the true order stays hidden during council play",
    );

    let checkedAuthority = false;
    let checkedSpyglass = false;
    while (state.phase !== "WAR_ROUND_REVEAL") {
      assert.equal(state.phase, "WAR_COUNCIL");
      const screen = hostSnapshot(state, now).warRoom!;
      const commanderId = screen.commanderId!;
      if (!checkedAuthority) {
        const nonCommander = state.participants.find(
          (player) => player.id !== commanderId,
        )!;
        const rank = state.currentRound!.warTargetRanks.find(
          (target) =>
            !Object.values(state.currentRound!.warPlacements).includes(target),
        )!;
        const choiceId = state.currentRound!.warTrueOrder[rank - 1];
        assert.throws(
          () =>
            applyPlayerAction(
              state,
              nonCommander.id,
              {
                type: "SUBMIT_WAR_GUESS",
                actionId: `war-illegal-${chapter}`,
                roundId: state.currentRound!.id,
                expectedPhase: "WAR_COUNCIL",
                payload: { choiceId, rank },
              },
              ++now,
            ),
          /NOT_WAR_COMMANDER/,
        );
        checkedAuthority = true;
      }
      const rank = state.currentRound!.warTargetRanks.find(
        (target) =>
          !Object.values(state.currentRound!.warPlacements).includes(target),
      );
      if (rank === undefined) break;
      const choiceId = state.currentRound!.warTrueOrder[rank - 1];
      const commanderTeam = state.warTeams[commanderId];
      if (!checkedSpyglass && !state.warScoutUsed[commanderTeam]) {
        state = applyPlayerAction(
          state,
          commanderId,
          {
            type: "SUBMIT_WAR_SCOUT",
            actionId: `war-scout-${chapter}`,
            roundId: state.currentRound!.id,
            expectedPhase: "WAR_COUNCIL",
            payload: { choiceId },
          },
          ++now,
        ).next;
        assert.equal(
          state.phase,
          "WAR_COUNCIL",
          "the Spyglass does not consume the turn",
        );
        assert.equal(state.warScoutUsed[state.currentRound!.warTurnTeam], true);
        checkedSpyglass = true;
      }
      state = applyPlayerAction(
        state,
        commanderId,
        {
          type: "SUBMIT_WAR_GUESS",
          actionId: `war-guess-${chapter}-${rank}`,
          roundId: state.currentRound!.id,
          expectedPhase: "WAR_COUNCIL",
          payload: { choiceId, rank },
        },
        ++now,
      ).next;
      assert.equal(state.phase, "WAR_TURN_REVEAL");
      assert.equal(state.currentRound!.warLastMove?.correct, true);
      state.deadlineAt = ++now;
      state = (await advanceState(state, now)).next;
    }
    assert.equal(state.phase, "WAR_ROUND_REVEAL");
    assert.deepEqual(
      hostSnapshot(state, now).warRoom?.trueOrder,
      choiceIds,
      "the consensus order is only public at chapter reveal",
    );
    if (chapter < 2) {
      state.deadlineAt = ++now;
      state = (await advanceState(state, now)).next;
      assert.equal(state.phase, "ROUND_INTRO");
      state.deadlineAt = ++now;
      state = (await advanceState(state, now)).next;
    }
  }
  assert.equal(state.phase, "WAR_ROUND_REVEAL");
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "FINAL_RESULTS");
  assert.equal(state.status, "COMPLETE");
  assert.ok(state.warTeamScores.LION > 0 && state.warTeamScores.RAVEN > 0);
  assert.ok(
    state.awards.some((award) =>
      ["Castle Conquerors", "Castle Defenders"].includes(award.title),
    ),
  );
  const restored = deserializeRoomState(serializeRoomState(state));
  assert.deepEqual(restored.warTeamScores, state.warTeamScores);

  state = applyHostAction(
    state,
    {
      type: "PLAY_AGAIN",
      actionId: "war-replay",
      roundId: state.currentRound!.id,
      expectedPhase: "FINAL_RESULTS",
      payload: {},
    },
    ++now,
  ).next;
  assert.equal(state.phase, "LOBBY");
  assert.equal(state.matchNumber, 2);
  assert.equal(
    state.warCampaign,
    "DEFEND",
    "Play Again must reverse the castle role",
  );
  assert.deepEqual(state.warTeamScores, { LION: 0, RAVEN: 0 });
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "war-defend-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    ++now,
  ).next;
  assert.equal(state.warCampaign, "DEFEND");
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.currentRound?.kind, "ROYAL_WAR_ROOM");
  assert.match(
    state.currentRound?.prompt ?? "",
    /defen|protect|hold|enemy|gate|siege|invasion|scouts/i,
  );
});

test("early finishers choose Canvas Two from exactly three requests and ties go to the first choice reaching its count", async () => {
  let state = createRoomState(
    "P0LL",
    {
      gameLength: "pictures",
      contentMode: "family",
      timerAccessibility: false,
    },
    1000,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "poll-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  state.deadlineAt = 1300;
  state = (await advanceState(state, 1300)).next;
  assert.equal(state.phase, "ANSWERING");
  assert.equal(state.currentRound!.choiceOptions.length, 3);
  const [first, second] = state.currentRound!.choiceOptions;

  state = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_ANSWER",
      actionId: "poll-answer-1",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { answer: "A squirrel hoarding royal sweet wrappers" },
    },
    1400,
  ).next;
  state = applyPlayerAction(
    state,
    "p1",
    {
      type: "SUBMIT_KING_REQUEST_VOTE",
      actionId: "poll-vote-1",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { choiceId: first.id },
    },
    1401,
  ).next;
  state = applyPlayerAction(
    state,
    "p2",
    {
      type: "SUBMIT_ANSWER",
      actionId: "poll-answer-2",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { answer: "A knight duelling a very smug lion" },
    },
    1402,
  ).next;
  state = applyPlayerAction(
    state,
    "p2",
    {
      type: "SUBMIT_KING_REQUEST_VOTE",
      actionId: "poll-vote-2",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { choiceId: second.id },
    },
    1403,
  ).next;
  state = applyPlayerAction(
    state,
    "p3",
    {
      type: "SUBMIT_ANSWER",
      actionId: "poll-answer-3",
      roundId: state.currentRound!.id,
      expectedPhase: "ANSWERING",
      payload: { answer: "A dragon filing taxes inside a teacup" },
    },
    1404,
  ).next;
  assert.equal(state.phase, "ANSWER_LOCK");
  state.deadlineAt = 1500;
  const transitioned = await advanceState(state, 1500);
  state = transitioned.next;
  assert.equal(state.phase, "ROUND_INTRO");
  assert.equal(state.roundIndex, 1);
  assert.equal(state.kingRoundTwoRequestId, first.id);
  assert.match(
    state.currentRound!.prompt,
    new RegExp(first.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
  );
  assert.equal(
    transitioned.effects.filter(
      (effect) => effect.type === "job" && effect.kind === "KING_PROMPT_IMAGE",
    ).length,
    3,
  );
});

test("King Prompter completes two overlapping canvases and a shared Royal Restoration with fixed vote values", async () => {
  let now = 2000;
  let state = createRoomState(
    "R0YL",
    {
      gameLength: "pictures",
      contentMode: "family",
      timerAccessibility: false,
    },
    now,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "royal-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    ++now,
  ).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;

  const submitRound = (prefix: string) => {
    for (let index = 1; index <= 3; index += 1)
      state = applyPlayerAction(
        state,
        `p${index}`,
        {
          type: "SUBMIT_ANSWER",
          actionId: `${prefix}-answer-${index}`,
          roundId: state.currentRound!.id,
          expectedPhase: "ANSWERING",
          payload: {
            answer: [
              `A bear juggling golden apples`,
              `A dragon wearing six tiny crowns`,
              `A goose stealing the royal banquet`,
            ][index - 1],
          },
        },
        ++now,
      ).next;
  };
  const markImagesReady = () => {
    for (const answer of state.currentRound!.answers)
      state.kingImages[answer.id] = {
        ...state.kingImages[answer.id],
        status: "FALLBACK",
      };
  };
  const castTiedBallot = () => {
    const ids = new Map(
      state.currentRound!.answers.map((answer) => [answer.playerId, answer.id]),
    );
    for (let index = 1; index <= 3; index += 1)
      state = applyPlayerAction(
        state,
        `p${index}`,
        {
          type: "SUBMIT_VOTE",
          actionId: `royal-${state.roundIndex}-vote-${index}`,
          roundId: state.currentRound!.id,
          expectedPhase: "FINAL_VOTING",
          payload: { answerIds: [ids.get(`p${(index % 3) + 1}`)!] },
        },
        ++now,
      ).next;
  };

  submitRound("canvas-one");
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "ROUND_INTRO");
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  submitRound("canvas-two");
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.roundIndex, 0);
  assert.equal(state.phase, "IMAGE_REVEAL");

  state.phaseStartedAt = now - 200_000;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(
    state.phase,
    "IMAGE_REVEAL",
    "the gallery stays closed even after a long provider delay",
  );
  assert.ok(
    state.currentRound!.answers.every(
      (answer) => state.kingImages[answer.id]?.status === "QUEUED",
    ),
    "pending jobs are never converted into revealable fallbacks by a timer",
  );

  markImagesReady();
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  castTiedBallot();
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.deepEqual(scoreTotals(state), { p1: 100, p2: 100, p3: 100 });
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.roundIndex, 1);
  assert.equal(state.phase, "IMAGE_REVEAL");

  markImagesReady();
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  castTiedBallot();
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.deepEqual(scoreTotals(state), { p1: 250, p2: 250, p3: 250 });
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.roundIndex, 2);
  assert.equal(state.phase, "ROUND_INTRO");
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "ANSWERING");
  assert.equal(Object.keys(state.kingRestorationAssignments).length, 3);

  submitRound("restoration");
  state.deadlineAt = ++now;
  const restorationJobs = await advanceState(state, now);
  state = restorationJobs.next;
  assert.equal(
    restorationJobs.effects.filter(
      (effect) =>
        effect.type === "job" && effect.kind === "KING_RESTORATION_PATCH",
    ).length,
    3,
  );
  markImagesReady();
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  castTiedBallot();
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.deepEqual(scoreTotals(state), { p1: 550, p2: 550, p3: 550 });
  assert.equal(
    (state.currentRound!.results as { finalWinningAnswerIds: string[] })
      .finalWinningAnswerIds.length,
    3,
  );
  state.deadlineAt = ++now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "FINAL_RESULTS");
});

test("phase engine locks all answers, supports anonymous voting, and preserves ties", async () => {
  let state = await answeringRoom();
  assert.equal(state.phase, "ANSWERING");
  for (let index = 1; index <= 3; index += 1)
    state = applyPlayerAction(
      state,
      `p${index}`,
      {
        type: "SUBMIT_ANSWER",
        actionId: `answer-${index}`,
        roundId: state.currentRound!.id,
        expectedPhase: "ANSWERING",
        payload: { answer: `Answer from ${index}` },
      },
      1400 + index,
    ).next;
  assert.equal(state.phase, "ANSWER_LOCK");
  state.deadlineAt = 1500;
  state = (await advanceState(state, 1500)).next;
  assert.equal(state.phase, "VOTING");
  const answerByPlayer = new Map(
    state.currentRound!.answers.map((answer) => [answer.playerId, answer.id]),
  );
  for (let index = 1; index <= 3; index += 1)
    state = applyPlayerAction(
      state,
      `p${index}`,
      {
        type: "SUBMIT_VOTE",
        actionId: `vote-${index}`,
        roundId: state.currentRound!.id,
        expectedPhase: "VOTING",
        payload: { answerIds: [answerByPlayer.get(`p${(index % 3) + 1}`)!] },
      },
      1600 + index,
    ).next;
  assert.equal(state.phase, "VOTE_LOCK");
  state.deadlineAt = 1700;
  state = (await advanceState(state, 1700)).next;
  assert.equal(state.phase, "REVEAL");
  assert.deepEqual(scoreTotals(state), { p1: 500, p2: 500, p3: 500 });
  assert.equal(state.lore.length, 3);
  assert.ok(
    state.lore.every((memory) => memory.kind === "ANCHOR" && memory.winner),
  );
});

test.skip("legacy King Prompter prompt-ranking and Crown Gallery flow", async () => {
  let state = createRoomState(
    "P1CT",
    {
      gameLength: "pictures",
      contentMode: "family",
      timerAccessibility: false,
    },
    1000,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "picture-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  state.deadlineAt = 1200;
  state = (await advanceState(state, 1200)).next;
  state.deadlineAt = 1300;
  state = (await advanceState(state, 1300)).next;
  assert.equal(state.currentRound?.kind, "PROMPT_AND_CIRCUMSTANCE");
  assert.throws(
    () =>
      applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_ANSWER",
          actionId: "too-many-words",
          roundId: state.currentRound!.id,
          expectedPhase: "ANSWERING",
          payload: {
            answer:
              "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty",
          },
        },
        1350,
      ),
    /PICTURE_WORD_LIMIT/,
  );
  const scenes = [
    "A penguin DJ at a haunted wedding",
    "Raccoons opening a bakery on Mars",
    "A knight washing dishes inside a volcano",
  ];
  for (let index = 1; index <= 3; index += 1)
    state = applyPlayerAction(
      state,
      `p${index}`,
      {
        type: "SUBMIT_ANSWER",
        actionId: `picture-answer-${index}`,
        roundId: state.currentRound!.id,
        expectedPhase: "ANSWERING",
        payload: { answer: scenes[index - 1] },
      },
      1400 + index,
    ).next;
  state.deadlineAt = 1500;
  const imageTransition = await advanceState(state, 1500);
  state = imageTransition.next;
  assert.equal(state.phase, "AUTHOR_GUESSING");
  assert.equal(
    imageTransition.effects.filter(
      (effect) => effect.type === "job" && effect.kind === "KING_PROMPT_IMAGE",
    ).length,
    3,
  );
  assert.equal(hostSnapshot(state, 1500).imageJobsPending, true);
  state = await finishPromptAuthorMatch(state, 1525);
  assert.equal(state.phase, "VOTING");
  const answerByPlayer = new Map(
    state.currentRound!.answers.map((answer) => [answer.playerId, answer.id]),
  );
  for (const voter of ["p1", "p2", "p3"]) {
    const voterNumber = Number(voter.slice(1));
    const eligible = [
      answerByPlayer.get(`p${(voterNumber % 3) + 1}`)!,
      answerByPlayer.get(`p${((voterNumber + 1) % 3) + 1}`)!,
    ];
    state = applyPlayerAction(
      state,
      voter,
      {
        type: "SUBMIT_VOTE",
        actionId: `prompt-vote-${voter}`,
        roundId: state.currentRound!.id,
        expectedPhase: "VOTING",
        payload: { answerIds: eligible },
      },
      1550,
    ).next;
  }
  assert.equal(state.phase, "VOTE_LOCK");
  state.deadlineAt = 1600;
  state = (await advanceState(state, 1600)).next;
  assert.equal(state.phase, "IMAGE_REVEAL");
  assert.deepEqual(scoreTotals(state), { p1: 800, p2: 800, p3: 800 });
  for (const answer of state.currentRound!.answers)
    state.kingImages[answer.id] = {
      ...state.kingImages[answer.id],
      status: "FALLBACK",
    };
  state.deadlineAt = 1700;
  state = (await advanceState(state, 1700)).next;
  assert.equal(state.phase, "FINAL_VOTING");
  const playerGallery = playerSnapshot(
    state,
    state.participants[0],
    1700,
  ).answerOrder;
  assert.equal(
    playerGallery.length,
    3,
    "the phone shows every generated image, including the player's own",
  );
  assert.ok(
    playerGallery.every((answer) => answer.image?.status === "FALLBACK"),
  );
  assert.equal(
    playerGallery.find((answer) => answer.id === answerByPlayer.get("p1"))
      ?.voteEligible,
    false,
  );
  assert.ok(
    playerGallery
      .filter((answer) => answer.id !== answerByPlayer.get("p1"))
      .every((answer) => answer.voteEligible),
  );
  assert.throws(
    () =>
      applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_VOTE",
          actionId: "forged-self-image-vote",
          roundId: state.currentRound!.id,
          expectedPhase: "FINAL_VOTING",
          payload: {
            answerIds: [answerByPlayer.get("p1")!, answerByPlayer.get("p2")!],
          },
        },
        1725,
      ),
    /SELF_VOTE/,
  );
  for (const voter of ["p1", "p2", "p3"]) {
    const voterNumber = Number(voter.slice(1));
    const eligible = [
      answerByPlayer.get(`p${(voterNumber % 3) + 1}`)!,
      answerByPlayer.get(`p${((voterNumber + 1) % 3) + 1}`)!,
    ];
    state = applyPlayerAction(
      state,
      voter,
      {
        type: "SUBMIT_VOTE",
        actionId: `image-vote-${voter}`,
        roundId: state.currentRound!.id,
        expectedPhase: "FINAL_VOTING",
        payload: { answerIds: eligible },
      },
      1750,
    ).next;
  }
  state.deadlineAt = 1800;
  state = (await advanceState(state, 1800)).next;
  assert.equal(state.phase, "REVEAL");
  assert.deepEqual(scoreTotals(state), { p1: 1800, p2: 1800, p3: 1800 });
  assert.equal(
    state.kingFinalists.length,
    1,
    "one deterministic canvas winner advances to preserve a two-image final",
  );
  const cycleResults = hostSnapshot(state, 1800).results as {
    kind?: string;
    imageWinningAnswerIds: string[];
    selectedFinalistAnswerId: string;
  };
  assert.equal(cycleResults.kind, "king_cycle");
  assert.equal(
    cycleResults.imageWinningAnswerIds.length,
    3,
    "all tied leaders remain recorded",
  );
  assert.equal(cycleResults.selectedFinalistAnswerId, state.kingFinalists[0]);
});

test("Let's Make a Comic locks three connected image winners and makes the punchline ballot worth the most", async () => {
  let state = createRoomState(
    "C0M1",
    { gameLength: "comic", contentMode: "party", timerAccessibility: false },
    1000,
  );
  state.participants = [participant(1), participant(2), participant(3)];
  state = applyHostAction(
    state,
    {
      type: "START_GAME",
      actionId: "comic-start",
      roundId: "lobby",
      expectedPhase: "LOBBY",
      payload: {},
    },
    1100,
  ).next;
  let now = 1200;
  state.deadlineAt = now;
  state = (await advanceState(state, now)).next;
  now += 100;
  state.deadlineAt = now;
  state = (await advanceState(state, now)).next;
  assert.equal(state.phase, "ANSWERING");
  assert.equal(state.currentRound?.kind, "COMIC_FRAME");
  assert.ok(state.comicTheme);
  assert.throws(
    () =>
      applyPlayerAction(
        state,
        "p1",
        {
          type: "SUBMIT_ANSWER",
          actionId: "comic-too-long",
          roundId: state.currentRound!.id,
          expectedPhase: "ANSWERING",
          payload: {
            answer:
              "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty",
          },
        },
        now + 1,
      ),
    /PICTURE_WORD_LIMIT/,
  );

  const framePointGains: number[] = [];
  for (let frame = 1; frame <= 3; frame += 1) {
    const priorScore = scoreTotals(state).p1;
    const prompts = [
      `Hero opens a suspicious door in panel ${frame}`,
      `Robot drops a giant sandwich in panel ${frame}`,
      `Pigeon reveals a tiny crown in panel ${frame}`,
    ];
    for (let index = 1; index <= 3; index += 1)
      state = applyPlayerAction(
        state,
        `p${index}`,
        {
          type: "SUBMIT_ANSWER",
          actionId: `comic-${frame}-answer-${index}`,
          roundId: state.currentRound!.id,
          expectedPhase: "ANSWERING",
          payload: { answer: prompts[index - 1] },
        },
        now + index,
      ).next;
    now += 100;
    state.deadlineAt = now;
    const imageTransition = await advanceState(state, now);
    state = imageTransition.next;
    assert.equal(
      state.phase,
      "AUTHOR_GUESSING",
      "comic candidates use image-generation time for writer matching",
    );
    assert.equal(
      imageTransition.effects.filter(
        (effect) =>
          effect.type === "job" && effect.kind === "COMIC_PANEL_IMAGE",
      ).length,
      3,
    );
    state = await finishPromptAuthorMatch(state, now + 50);
    assert.equal(
      state.phase,
      "IMAGE_REVEAL",
      "comic candidates still skip a separate prompt vote",
    );
    for (const answer of state.currentRound!.answers)
      state.kingImages[answer.id] = {
        ...state.kingImages[answer.id],
        status: "FALLBACK",
      };
    now += 100;
    state.deadlineAt = now;
    state = (await advanceState(state, now)).next;
    assert.equal(state.phase, "FINAL_VOTING");
    const answerByPlayer = new Map(
      state.currentRound!.answers.map((answer) => [answer.playerId, answer.id]),
    );
    for (let index = 1; index <= 3; index += 1) {
      const eligible = [
        answerByPlayer.get(`p${(index % 3) + 1}`)!,
        answerByPlayer.get(`p${((index + 1) % 3) + 1}`)!,
      ];
      state = applyPlayerAction(
        state,
        `p${index}`,
        {
          type: "SUBMIT_VOTE",
          actionId: `comic-${frame}-vote-${index}`,
          roundId: state.currentRound!.id,
          expectedPhase: "FINAL_VOTING",
          payload: { answerIds: eligible },
        },
        now + index,
      ).next;
    }
    now += 100;
    state.deadlineAt = now;
    state = (await advanceState(state, now)).next;
    assert.equal(state.phase, "REVEAL");
    assert.equal(state.comicFrames.length, frame);
    assert.equal(state.comicFrames[frame - 1].frameNumber, frame);
    assert.equal(
      (hostSnapshot(state, now).results as { imageWinningAnswerIds: string[] })
        .imageWinningAnswerIds.length,
      3,
      "tied image winners remain explicit",
    );
    framePointGains.push(scoreTotals(state).p1 - priorScore);
    now += 100;
    state.deadlineAt = now;
    state = (await advanceState(state, now)).next;
    now += 100;
    state.deadlineAt = now;
    state = (await advanceState(state, now)).next;
    if (frame < 3) {
      assert.equal(state.phase, "ROUND_INTRO");
      now += 100;
      state.deadlineAt = now;
      state = (await advanceState(state, now)).next;
      assert.equal(state.phase, "ANSWERING");
      assert.ok(state.currentRound!.prompt.length < 40);
      assert.equal(state.comicFrames.length, frame);
    }
  }
  assert.deepEqual(framePointGains, [800, 1100, 1900]);
  assert.equal(state.phase, "FINAL_RESULTS");
  assert.equal(hostSnapshot(state, now).comicFrames.length, 3);
});

test("only winning or tied-winning creative answers enter the memory graph", async () => {
  let state = await answeringRoom();
  for (let index = 1; index <= 3; index += 1)
    state = applyPlayerAction(
      state,
      `p${index}`,
      {
        type: "SUBMIT_ANSWER",
        actionId: `winner-answer-${index}`,
        roundId: state.currentRound!.id,
        expectedPhase: "ANSWERING",
        payload: { answer: `Seed ${index}` },
      },
      1400 + index,
    ).next;
  state.deadlineAt = 1500;
  state = (await advanceState(state, 1500)).next;
  const answerByPlayer = new Map(
    state.currentRound!.answers.map((answer) => [answer.playerId, answer.id]),
  );
  const votes = [
    ["p1", "p2"],
    ["p2", "p1"],
    ["p3", "p1"],
  ] as const;
  for (const [voter, target] of votes)
    state = applyPlayerAction(
      state,
      voter,
      {
        type: "SUBMIT_VOTE",
        actionId: `winner-vote-${voter}`,
        roundId: state.currentRound!.id,
        expectedPhase: "VOTING",
        payload: { answerIds: [answerByPlayer.get(target)!] },
      },
      1600,
    ).next;
  state.deadlineAt = 1700;
  state = (await advanceState(state, 1700)).next;
  assert.deepEqual(
    state.lore.map((memory) => memory.sourceAnswerId),
    [answerByPlayer.get("p1")],
  );
  assert.equal(state.primaryMemoryIds.ANCHOR, state.lore[0].id);
});

test("Legacy Standard callback uses connected slots and the finale keeps its heading short", () => {
  const state = createRoomState(
    "B4CK",
    { gameLength: "standard", contentMode: "party", timerAccessibility: false },
    1000,
  );
  state.lore = [
    {
      id: "anchor",
      sourceAnswerId: "a1",
      sourceAuthorId: "p1",
      text: "The Gum Reaper",
      shortMeaning: "a frightening dental mascot",
      kind: "ANCHOR",
      originalPrompt: "Invent a dentist mascot.",
      winner: true,
      quality: 0.9,
      callbackPotential: 0.9,
      visualStrength: 0.9,
      canSpeak: true,
      tags: ["dentist"],
      safe: true,
      used: false,
    },
    {
      id: "voice",
      sourceAnswerId: "a2",
      sourceAuthorId: "p2",
      text: "Brush twice. Or meet me.",
      shortMeaning: "a threatening slogan",
      kind: "VOICE",
      originalPrompt: "What's the slogan?",
      winner: true,
      quality: 0.9,
      callbackPotential: 0.9,
      visualStrength: 0.6,
      canSpeak: false,
      tags: ["slogan"],
      safe: true,
      used: false,
    },
    {
      id: "world",
      sourceAnswerId: "a3",
      sourceAuthorId: "p3",
      text: "All elevators require eye contact",
      shortMeaning: "an elevator law",
      kind: "WORLD",
      originalPrompt: "Write a hated law.",
      winner: true,
      quality: 0.9,
      callbackPotential: 0.9,
      visualStrength: 0.7,
      canSpeak: false,
      tags: ["elevator"],
      safe: true,
      used: false,
    },
    {
      id: "consequence",
      sourceAnswerId: "a4",
      sourceAuthorId: "p1",
      text: "The elevator opens directly into HR",
      shortMeaning: "the incident",
      kind: "CONSEQUENCE",
      originalPrompt: "What goes wrong?",
      winner: true,
      quality: 0.9,
      callbackPotential: 0.9,
      visualStrength: 0.8,
      canSpeak: false,
      tags: ["HR"],
      safe: true,
      used: false,
    },
  ];
  state.primaryMemoryIds = {
    ANCHOR: "anchor",
    VOICE: "voice",
    WORLD: "world",
    CONSEQUENCE: "consequence",
  };
  const callback = fallbackCallbackPrompt(state);
  const remix = fallbackRemixPrompt(state);
  assert.match(callback, /Gum Reaper/);
  assert.match(callback, /Brush twice/);
  assert.match(callback, /elevators require eye contact/);
  assert.ok(callback.endsWith("?"));
  assert.equal(
    remix,
    "Write the final headline for the story your room built tonight.",
  );
  assert.ok(remix.split(/\s+/u).length <= 12);
});

test("snapshots never reveal authors before reveal and reconnect order is identical", async () => {
  const state = await answeringRoom();
  state.currentRound!.answers = [
    {
      id: "a1",
      playerId: "p1",
      text: "<script>nope</script>",
      hidden: false,
      submittedAt: 1,
    },
    {
      id: "a2",
      playerId: "p2",
      text: "Unicode 🎉",
      hidden: false,
      submittedAt: 2,
    },
    { id: "a3", playerId: "p3", text: "third", hidden: false, submittedAt: 3 },
  ];
  state.phase = "VOTING";
  const host = hostSnapshot(state, 2000);
  assert.ok(host.answers.every((answer) => !("authorId" in answer)));
  assert.equal(JSON.stringify(host).includes("playerId"), false);
  const first = playerSnapshot(state, state.participants[0], 2000).answerOrder;
  const restored = playerSnapshot(
    structuredClone(state),
    state.participants[0],
    3000,
  ).answerOrder;
  assert.deepEqual(first, restored);
  assert.equal(
    first.some((answer) => answer.id === "a1"),
    false,
  );
});

test("a zero-percent personal choice remains locked after reconnect", async () => {
  const state = await answeringRoom();
  state.phase = "PERSONAL_CHOICE";
  state.currentRound!.personalChoices.p1 = "0";
  const restored = playerSnapshot(
    structuredClone(state),
    state.participants[0],
    3000,
  );
  assert.equal(restored.submitted, true);
  assert.equal(restored.locked, true);
});

test("Bowl of Fools keeps scrolls anonymous and runs the team turn rules", async () => {
  let state = createRoomState("FOOL", { gameLength: "bowl-of-fools", contentMode: "family", timerAccessibility: false, foolScrollsPerPlayer: 1, foolPerformance: "DRAWING", foolPlayMode: "REMOTE_LIVE" }, 1000);
  state.participants = ["Ada", "Bea", "Cal", "Dom"].map((nickname, index) => ({ id: `p${index + 1}`, nickname, nicknameNormalized: nickname.toLowerCase(), role: "player", seat: index + 1, avatar: index, color: "#fff", active: true, pendingActivation: false, lastSeenAt: 1000, removedAt: null }));
  state.foolHostPlayerId = "p1";
  state = applyHostAction(state, { type: "START_GAME", actionId: "start-fools", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1000).next;
  assert.equal(state.phase, "FOOL_TEAM_SETUP");
  assert.equal(state.joiningLocked, true);
  assert.deepEqual(new Set([...Object.values(state.foolTeams)]), new Set(["BELLS", "MOTLEY"]));
  state = applyPlayerAction(state, "p1", { type: "SET_FOOL_READY", actionId: "ready-first", roundId: "lobby", expectedPhase: "FOOL_TEAM_SETUP", payload: { ready: true } }, 1050).next;
  assert.deepEqual(state.foolReadyPlayerIds, ["p1"]);
  state = applyHostAction(state, { type: "SET_FOOL_TEAM", actionId: "edit-fool-team", roundId: "lobby", expectedPhase: "FOOL_TEAM_SETUP", payload: { playerId: "p1", team: state.foolTeams.p1 } }, 1075).next;
  assert.deepEqual(state.foolReadyPlayerIds, []);
  for (let index = 0; index < 4; index += 1) state = applyPlayerAction(state, `p${index + 1}`, { type: "SET_FOOL_READY", actionId: `ready-p${index + 1}`, roundId: "lobby", expectedPhase: "FOOL_TEAM_SETUP", payload: { ready: true } }, 1100 + index).next;
  assert.equal(state.phase, "INTRO");
  assert.equal(playerSnapshot(state, state.participants[0], 2000).isHostPlayer, true);
  state = (await advanceState(state, state.deadlineAt!)).next;
  state = (await advanceState(state, state.deadlineAt!)).next;
  assert.equal(state.phase, "FOOL_WRITING");
  const texts = ["Moon", "Tiny dragon", "Royal bathwater", "A badger"];
  for (let index = 0; index < 4; index += 1) state = applyPlayerAction(state, `p${index + 1}`, { type: "SUBMIT_FOOL_SCROLLS", actionId: `scroll-${index + 1}`, roundId: state.currentRound!.id, expectedPhase: "FOOL_WRITING", payload: { scrolls: [texts[index]] } }, 31_000 + index).next;
  assert.equal(state.phase, "FOOL_TURN");
  const host = hostSnapshot(state, 32_000);
  assert.equal(JSON.stringify(host).includes("Royal bathwater"), false);
  const clueGiver = state.currentRound!.foolClueGiverId!;
  assert.ok(playerSnapshot(state, state.participants.find((player) => player.id === clueGiver)!, 32_000).foolBowl?.secretScroll);
  for (const player of state.participants.filter((candidate) => candidate.id !== clueGiver)) assert.equal(playerSnapshot(state, player, 32_000).foolBowl?.secretScroll, undefined);
  state = applyPlayerAction(state, clueGiver, { type: "FOOL_PASS", actionId: "fool-pass-1", roundId: state.currentRound!.id, expectedPhase: "FOOL_TURN", payload: {} }, 32_100).next;
  assert.equal(state.currentRound!.foolPassUsed, true);
  assert.throws(() => applyPlayerAction(state, clueGiver, { type: "FOOL_PASS", actionId: "fool-pass-2", roundId: state.currentRound!.id, expectedPhase: "FOOL_TURN", payload: {} }, 32_200), /FOOL_PASS_UNAVAILABLE/);
  const scoringTeam = state.currentRound!.foolTurnTeam;
  state = applyHostAction(state, { type: "ADJUST_FOOL_SCORE", actionId: "adjust-fool-plus", roundId: state.currentRound!.id, expectedPhase: "FOOL_TURN", payload: { team: scoringTeam, delta: 1 } }, 32_300).next;
  assert.equal(state.foolTeamScores[scoringTeam], 1);
  state = applyHostAction(state, { type: "ADJUST_FOOL_SCORE", actionId: "adjust-fool-minus", roundId: state.currentRound!.id, expectedPhase: "FOOL_TURN", payload: { team: scoringTeam, delta: -1 } }, 32_400).next;
  assert.equal(state.foolTeamScores[scoringTeam], 0);
  while (state.phase === "FOOL_TURN") state = applyPlayerAction(state, clueGiver, { type: "FOOL_CORRECT", actionId: `correct-${state.currentRound!.foolPool.length}`, roundId: state.currentRound!.id, expectedPhase: "FOOL_TURN", payload: {} }, 33_000).next;
  assert.equal(state.phase, "FOOL_ROUND_REVEAL");
  assert.equal(state.currentRound!.foolTurnTeam, scoringTeam === "BELLS" ? "MOTLEY" : "BELLS");
  assert.equal(state.currentRound!.foolRoundNumber, 2);
  state = applyHostAction(state, { type: "UNDO_FOOL_POINT", actionId: "undo-fool", roundId: state.currentRound!.id, expectedPhase: "FOOL_ROUND_REVEAL", payload: {} }, 33_100).next;
  assert.equal(state.phase, "FOOL_TURN");
  assert.equal(state.currentRound!.foolPool.length, 1);
});

test("Bowl of Fools uses one anonymous scroll for tied sudden death", () => {
  const state = createRoomState("TIED", { gameLength: "bowl-of-fools", contentMode: "family", timerAccessibility: false }, 1000);
  assert.equal(createRoomSchema.safeParse({ gameLength: "bowl-of-fools", contentMode: "family", timerAccessibility: false, foolHostName: "Danny" }).success, true);
  assert.equal(createRoomSchema.safeParse({ gameLength: "bowl-of-fools", contentMode: "family", timerAccessibility: false, soloMode: true, soloPlayerName: "Tester" }).success, false);
  assert.equal(PlayerActionSchema.safeParse({ type: "SUBMIT_FOOL_ONE_WORD", actionId: "one-word-action", roundId: "round", expectedPhase: "FOOL_TURN", payload: { word: "banana" } }).success, true);
  assert.equal(HostActionSchema.safeParse({ type: "UNDO_FOOL_POINT", actionId: "undo-fool-action", roundId: "round", expectedPhase: "FOOL_TURN", payload: {} }).success, true);
  assert.equal(state.foolWinner, null);
});
