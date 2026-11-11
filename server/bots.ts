import type { CatchRule } from "../lib/game/validators";
import { validateCatch } from "../lib/game/validators";
import { deterministicShuffle, makeId, stableHash } from "../lib/game/random";
import { COMIC_BOT_PROMPTS } from "../lib/content/comics";
import type { AnswerState, DbEffect, ParticipantState, RoomState, RoundState } from "./types";

export const SOLO_BOT_NAMES = ["Deadpan", "Wildcard", "Hype Bot", "Professor Maybe", "Chaos Intern"] as const;
const BOT_COLORS = ["#46DBDC", "#FFD84B", "#FF6F61", "#9C7CFF", "#7BE495", "#FF9ED2", "#56A7FF", "#F5A742", "#9BE564", "#E88DFF", "#54E6B5", "#FF886F"] as const;

export function createLobbyBot(state: RoomState, now = Date.now(), lobbySlot?: number): { participant: ParticipantState; tokenHash: string } {
  const historicalNames = new Set(state.participants.map((participant) => participant.nicknameNormalized));
  const baseName = SOLO_BOT_NAMES.find((name) => !historicalNames.has(name.toLocaleLowerCase())) ?? "Party Bot";
  let nickname = baseName;
  for (let suffix = 2; historicalNames.has(nickname.toLocaleLowerCase()); suffix += 1) nickname = `${baseName} ${suffix}`;
  const slot = lobbySlot ?? Array.from({ length: 10 }, (_, index) => index + 1).find((candidate) => !state.participants.some((participant) => participant.role === "player" && !participant.removedAt && participant.lobbySlot === candidate));
  if (!slot) throw new Error("ROOM_FULL");
  const seat = state.participants.reduce((highest, participant) => Math.max(highest, participant.seat), 0) + 1;
  return {
    participant: {
      id: makeId("player"), nickname, nicknameNormalized: nickname.toLocaleLowerCase(), role: "player", seat, lobbySlot: slot,
      avatar: (seat - 1) % 12, color: BOT_COLORS[(seat - 1) % BOT_COLORS.length], active: true,
      pendingActivation: false, bot: true, lastSeenAt: now, removedAt: null,
    },
    tokenHash: makeId("bot-token"),
  };
}

const ANSWER_POOLS: Partial<Record<RoundState["kind"], readonly string[]>> = {
  THE_SEED: ["The Emergency Applause Button", "The Pocket Excuse Generator", "Wi-Fi Enabled Spite Jar", "The Regret-To-Go Machine", "The Tactical Snack Helmet"],
  MAKE_IT_REAL: ["Regret, now with free delivery", "Built badly. Remembered forever.", "Confidence sold separately", "Tomorrow's problem, available today", "One button. Several consequences."],
  CALLBACK: ["The council called it progress", "It became mandatory by lunchtime", "Nobody checked the instruction manual", "The apology tour sold out", "A pigeon received the promotion"],
  THE_REMIX: ["We should have stopped at the snack break", "The sequel arrived with legal paperwork", "Everyone blamed the commemorative mug", "The museum gift shop knew too much", "Chapter thirty ended on hold music"],
  FIRST_IMPRESSIONS: ["Thirty Years, Still No User Manual", "The Director Asked Us Not To Explain", "A Heroic Amount of Snacks", "Chapter 30: Still Buffering", "The Group Chat Has Receipts"],
  FINAL_READ: ["Still late, still loved, still ordering chips", "Keep the jokes; upgrade the knees", "The group chat somehow outlived us all", "Thirty more years of confident improvising", "Same friends. Better snacks. Earlier bedtime."],
  MONSTER_FACTORY: ["A tiny crown", "Three anxious elbows", "Laser eyebrows", "A suspicious waistcoat", "The power of mild inconvenience"],
  PROMPT_AND_CIRCUMSTANCE: ["A penguin directing traffic inside a haunted supermarket", "Three raccoons hosting breakfast television on the moon", "A knight ordering drive-through soup during a thunderstorm", "Grandma winning a skateboard race through a fancy museum", "A tiny dragon doing taxes in a crowded elevator"],
  KING_PROMPTER_FINAL: ["A bear on a unicycle juggling golden apples", "A dragon politely serving tea to mice", "A knight losing an argument with a goose", "Three raccoons stealing the royal birthday cake", "A wizard trapped inside an enormous soup bowl"],
  KING_REQUEST_MYSTERY: ["The King lost a staring contest to his own portrait", "A royal pigeon fired the court wizard during breakfast", "The Queen raced a bear through the royal banquet", "A knight hid inside an enormous birthday cake", "The King taught a dragon to eat soup with a tiny spoon"],
  ROYAL_RUMOURS: ["The Queen secretly races geese after midnight", "A dragon replaced the castle chef during breakfast", "The King's crown keeps ordering tiny furniture", "A pigeon was promoted to royal weather wizard", "The moat monster opened a suspicious day spa"],
};

const MYSTERY_DECOYS = [
  "The King apologized to a furious magical portrait", "A royal pigeon arrested an underqualified wizard", "The Queen won an illegal race through the banquet",
  "A nervous knight escaped through the royal dessert", "The King served tiny soup to an enormous dragon", "One confident goose ruined the emergency castle meeting",
] as const;

const FALLBACK_ANSWERS = [
  "The paperwork simply says: absolutely not",
  "A confident plan with no visible research",
  "Nobody expected the decorative wheelbarrow",
  "Free snacks, expensive consequences",
  "The group chat voted to deny everything",
] as const;

function activePlayers(state: RoomState): ParticipantState[] {
  return state.participants.filter((participant) => participant.role === "player" && participant.active && !participant.removedAt);
}

function choose<T>(values: readonly T[], seed: string): T {
  return values[stableHash(seed) % values.length];
}

function catchAnswer(rule: CatchRule, seed: string): string {
  const wordSets = [
    ["tiny", "robots", "demand", "birthday", "cake", "before", "lunch", "again"],
    ["bold", "pigeons", "run", "the", "meeting", "with", "zero", "notes"],
    ["snacks", "became", "official", "policy", "after", "one", "loud", "vote"],
  ];
  const words = choose(wordSets, seed);
  if (rule.type === "exact_words") return words.slice(0, rule.value).join(" ");
  if (rule.type === "max_words") return words.slice(0, Math.min(rule.value, 4)).join(" ");
  if (rule.type === "ending") return `Nobody approved this${rule.value}`;
  if (rule.type === "required_word") return `${rule.value[0].toUpperCase()}${rule.value.slice(1)} made it official`;
  if (rule.type === "required_name") return "Mabel approved the emergency buffet";
  if (rule.type === "starting_letter") return `${rule.value.toUpperCase()}old plans need louder snacks`;
  if (rule.type === "forbidden_letter") {
    if (rule.value.toLocaleLowerCase() === "e") return "Bold chaos won";
    if (rule.value.toLocaleLowerCase() === "a") return "Tiny robot won";
    return "Bold tiny robot";
  }
  return "Tiny chaos won";
}

const IMAGE_CHARACTERS = ["a nervous dragon", "three raccoons in one trench coat", "a deeply ambitious pigeon", "a grandma with a secret jetpack", "a tiny wizard", "an exhausted robot", "a duck lawyer", "a polite sea monster", "a hamster CEO", "a ghost on its first day"] as const;
const IMAGE_ACTIONS = ["directing traffic", "giving a disastrous press conference", "hosting a luxury awards show", "attempting airport security", "unveiling an unsafe invention", "demanding a promotion", "leading an emergency rescue", "winning a formal debate", "running customer service", "performing a suspicious magic trick"] as const;
const IMAGE_PLACES = ["inside a haunted supermarket", "on the moon during rush hour", "at a painfully elegant wedding", "in a museum after closing", "aboard a budget submarine", "at the world's smallest city hall", "during a medieval office party", "inside a giant claw machine", "at a volcano-side spa", "in an airport run by cats"] as const;

function composedImageAnswer(seed: string): string {
  return `${choose(IMAGE_CHARACTERS, `${seed}:character`)} ${choose(IMAGE_ACTIONS, `${seed}:action`)} ${choose(IMAGE_PLACES, `${seed}:place`)}`;
}

function creativeAnswer(state: RoomState, round: RoundState, bot: ParticipantState, attempt = 0): string {
  const seed = `${state.code}:match-${state.matchNumber}:${round.id}:${bot.id}:${attempt}`;
  if (round.catchModifier) {
    const answer = catchAnswer(round.catchModifier.rule, `${seed}:catch`);
    if (validateCatch(answer, round.catchModifier.rule)) return answer;
  }
  if (round.kind === "PROMPT_AND_CIRCUMSTANCE") return composedImageAnswer(seed);
  const pool = round.kind === "COMIC_FRAME" ? COMIC_BOT_PROMPTS[Math.min(3, round.index + 1) as 1 | 2 | 3] : ANSWER_POOLS[round.kind] ?? FALLBACK_ANSWERS;
  return choose(pool, `${seed}:answer`);
}

function distribution(count: number, seed: string): number[] {
  const base = Math.floor(100 / count);
  const values = Array.from({ length: count }, (_, index) => base + (index < 100 - base * count ? 1 : 0));
  if (count > 1) {
    const from = stableHash(`${seed}:from`) % count;
    const to = (from + 1 + stableHash(`${seed}:to`) % (count - 1)) % count;
    const shift = Math.min(5, values[from]);
    values[from] -= shift;
    values[to] += shift;
  }
  return values;
}

function addBotAnswer(state: RoomState, round: RoundState, bot: ParticipantState, effects: DbEffect[], now: number): boolean {
  if (round.answers.some((answer) => answer.playerId === bot.id)) return false;
  const existing = new Set(round.answers.map((answer) => answer.text.toLocaleLowerCase()));
  let text = creativeAnswer(state, round, bot);
  for (let attempt = 1; existing.has(text.toLocaleLowerCase()) && attempt < 12; attempt += 1) text = creativeAnswer(state, round, bot, attempt);
  const answer: AnswerState = {
    id: makeId("answer"), playerId: bot.id, text, hidden: false, submittedAt: now,
    sourceLoreIds: round.callbackSourceLoreIds.length ? [...round.callbackSourceLoreIds] : undefined,
  };
  round.answers.push(answer);
  effects.push({ type: "answer", answer, roundId: round.id });
  return true;
}

function addBotVote(state: RoomState, round: RoundState, bot: ParticipantState, effects: DbEffect[]): boolean {
  if (round.votes.some((vote) => vote.voterId === bot.id)) return false;
  const visible = round.answers.filter((answer) => !answer.hidden && answer.playerId !== bot.id);
  const kingVote = ["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL", "COMIC_FRAME"].includes(round.kind);
  const ranked = !kingVote && activePlayers(state).length >= 4 && visible.length >= 3;
  const count = ["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL"].includes(round.kind) ? Math.min(1, visible.length) : kingVote ? Math.min(3, visible.length) : ranked ? 2 : 1;
  if (count < 1) return false;
  const shuffled = deterministicShuffle(visible, `${state.code}:${round.id}:${bot.id}:${state.phase}:vote`);
  const humanFirst = state.soloMode && kingVote
    ? [...shuffled.filter((answer) => !state.participants.find((player) => player.id === answer.playerId)?.bot), ...shuffled.filter((answer) => state.participants.find((player) => player.id === answer.playerId)?.bot)]
    : shuffled;
  const answerIds = humanFirst.slice(0, count).map((answer) => answer.id);
  if (answerIds.length !== count) return false;
  round.votes.push({ voterId: bot.id, answerIds, audience: false });
  const voteRoundId = round.kind === "PROMPT_AND_CIRCUMSTANCE" ? `${round.id}:image` : round.kind === "KING_PROMPTER_FINAL" ? `${round.id}:restoration` : round.kind === "COMIC_FRAME" ? `${round.id}:comic-image` : round.id;
  answerIds.forEach((answerId, index) => effects.push({ type: "vote", roundId: voteRoundId, voterId: bot.id, answerId, rank: index + 1, weight: kingVote ? count - index : ranked ? 2 - index : 1, audience: false }));
  return true;
}

/** Mutates a cloned authoritative state and returns how many bot turns were added. */
export function runBotTurns(state: RoomState, effects: DbEffect[], now = Date.now()): number {
  if (!state.currentRound || state.paused) return 0;
  const round = state.currentRound;
  const players = activePlayers(state);
  const bots = players.filter((participant) => participant.bot);
  let turns = 0;
  for (const bot of bots) {
    if (state.phase === "WAR_RANKING" && !round.warRankings[bot.id]) {
      round.warRankings[bot.id] = deterministicShuffle(round.choiceOptions.map((choice) => choice.id), `${state.code}:${round.id}:${bot.id}:war-ranking`);
      effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: "war_ranking", payload: { orderedChoiceIds: round.warRankings[bot.id] } });
      turns += 1;
      continue;
    }
    if (["ANSWERING", "FINAL_ANSWERING", "ENCORE_CONTRIBUTING", "ENCORE_FOLLOWUP"].includes(state.phase)) {
      if (addBotAnswer(state, round, bot, effects, now)) turns += 1;
      if (round.kind === "PROMPT_AND_CIRCUMSTANCE" && round.index === 0 && round.choiceOptions.length && !round.personalChoices[bot.id]) {
        const choiceId = choose(round.choiceOptions, `${state.code}:${round.id}:${bot.id}:king-poll`).id;
        round.personalChoices[bot.id] = choiceId;
        round.kingPollEvents.push({ playerId: bot.id, choiceId, votedAt: now });
        effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: "king_request_poll", payload: { choiceId } });
        turns += 1;
      }
      continue;
    }
    if (["VOTING", "FINAL_VOTING"].includes(state.phase)) {
      if (addBotVote(state, round, bot, effects)) turns += 1;
      continue;
    }
    if (state.phase === "PERSONAL_CHOICE" && !Object.prototype.hasOwnProperty.call(round.personalChoices, bot.id)) {
      const choices = round.kind === "BIRTHDAY_BETS" ? round.choiceOptions.map((choice) => choice.id)
        : round.kind === "CROWD_CONTROL" ? players.map((player) => player.id)
          : Array.from({ length: 10 }, (_, index) => String(index));
      const choiceId = choose(choices, `${state.code}:${round.id}:${bot.id}:choice`);
      round.personalChoices[bot.id] = choiceId;
      effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: "personal_choice", payload: { choiceId } });
      turns += 1;
      continue;
    }
    if (state.phase === "ROOM_PREDICTION" && !round.predictions[bot.id]) {
      const count = round.kind === "CROWD_CONTROL" ? players.length : 10;
      const values = distribution(count, `${state.code}:${round.id}:${bot.id}:prediction`);
      round.predictions[bot.id] = values;
      effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: "room_prediction", payload: { values } });
      turns += 1;
      continue;
    }
    if (state.phase === "AUTHOR_GUESSING" && !round.authorGuesses[bot.id]) {
      const guesses: Record<string, string> = {};
      const eligibleAuthors = players.filter((player) => player.id !== bot.id);
      const imageIntermission = ["PROMPT_AND_CIRCUMSTANCE", "COMIC_FRAME"].includes(round.kind);
      const assignmentIds = round.authorAssignments[bot.id] ?? [];
      if (imageIntermission) {
        const authorIds = new Set(round.answers.filter((answer) => !answer.hidden).map((answer) => answer.playerId));
        const shuffledAuthors = deterministicShuffle(players.filter((player) => authorIds.has(player.id)), `${state.code}:${round.id}:${bot.id}:prompt-author-guesses`);
        assignmentIds.forEach((answerId, index) => { guesses[answerId] = shuffledAuthors[index]?.id ?? players[0].id; });
      } else for (const answerId of assignmentIds) guesses[answerId] = choose(eligibleAuthors, `${state.code}:${round.id}:${bot.id}:${answerId}:author`).id;
      round.authorGuesses[bot.id] = guesses;
      effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: "author_guesses", payload: { guesses } });
      turns += 1;
      continue;
    }
    if (state.phase === "MYSTERY_DECOYS") {
      const featuredId = round.kingMysteryOrder[round.kingMysteryIndex] ?? round.featuredAnswerId;
      const featured = round.answers.find((answer) => answer.id === featuredId);
      if (!featured || featured.playerId === bot.id) continue;
      const existing = round.kingMysteryDecoys[featured.id] ?? [];
      if (existing.some((decoy) => decoy.playerId === bot.id)) continue;
      let text = choose(MYSTERY_DECOYS, `${state.code}:${round.id}:${featured.id}:${bot.id}:decoy`);
      for (let attempt = 1; [featured.text, ...existing.map((decoy) => decoy.text)].some((value) => value.toLocaleLowerCase() === text.toLocaleLowerCase()) && attempt < MYSTERY_DECOYS.length; attempt += 1) text = choose(MYSTERY_DECOYS, `${state.code}:${round.id}:${featured.id}:${bot.id}:decoy:${attempt}`);
      const sealed = !round.kingMysterySealUsedByPlayer[bot.id];
      const decoy = { id: makeId("decoy"), playerId: bot.id, text, submittedAt: now, sealed };
      if (sealed) round.kingMysterySealUsedByPlayer[bot.id] = decoy.id;
      round.kingMysteryDecoys[featured.id] = [...existing, decoy];
      effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: `king_mystery_decoy:${featured.id}`, payload: decoy });
      turns += 1;
      continue;
    }
    if (state.phase === "MYSTERY_VOTING") {
      const featuredId = round.kingMysteryOrder[round.kingMysteryIndex] ?? round.featuredAnswerId;
      const featured = round.answers.find((answer) => answer.id === featuredId);
      if (!featured || featured.playerId === bot.id) continue;
      const votes = round.kingMysteryVotes[featured.id] ?? {};
      if (votes[bot.id]) continue;
      const decoys = (round.kingMysteryDecoys[featured.id] ?? []).filter((decoy) => decoy.playerId !== bot.id);
      const choices = [{ id: featured.id, playerId: featured.playerId }, ...decoys.map((decoy) => ({ id: decoy.id, playerId: decoy.playerId }))];
      const humanFeatured = !state.participants.find((player) => player.id === featured.playerId)?.bot;
      const choiceId = state.soloMode && humanFeatured ? featured.id : choose(choices, `${state.code}:${round.id}:${featured.id}:${bot.id}:mystery-vote`).id;
      round.kingMysteryVotes[featured.id] = { ...votes, [bot.id]: choiceId };
      effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: `king_mystery_vote:${featured.id}`, payload: { choiceId } });
      turns += 1;
      continue;
    }
    if (state.phase === "RUMOUR_GUESSING") {
      const sourceAnswerId = round.royalRumourAssignments[bot.id];
      if (!sourceAnswerId || round.royalRumourGuesses[sourceAnswerId]) continue;
      const guess = { id: makeId("rumour"), playerId: bot.id, sourceAnswerId, text: composedImageAnswer(`${state.code}:${round.id}:${bot.id}:rumour-guess`), submittedAt: now };
      round.royalRumourGuesses[sourceAnswerId] = guess;
      effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: "royal_rumour_guess", payload: guess });
      turns += 1;
      continue;
    }
    if (state.phase === "RUMOUR_VOTING") {
      if (round.votes.some((vote) => vote.voterId === bot.id)) continue;
      const eligible = round.royalRumourRevealOrder.filter((sourceAnswerId) => {
        const original = round.answers.find((answer) => answer.id === sourceAnswerId);
        const guess = round.royalRumourGuesses[sourceAnswerId];
        return original && guess && original.playerId !== bot.id && guess.playerId !== bot.id;
      });
      if (!eligible.length) continue;
      const humanFirst = state.soloMode ? eligible.find((sourceAnswerId) => {
        const original = round.answers.find((answer) => answer.id === sourceAnswerId);
        const guess = round.royalRumourGuesses[sourceAnswerId];
        return [original?.playerId, guess?.playerId].some((id) => id && !state.participants.find((player) => player.id === id)?.bot);
      }) : null;
      const sourceAnswerId = humanFirst ?? choose(eligible, `${state.code}:${round.id}:${bot.id}:rumour-vote`);
      round.votes.push({ voterId: bot.id, answerIds: [sourceAnswerId], audience: false });
      effects.push({ type: "vote", roundId: `${round.id}:rumour`, voterId: bot.id, answerId: sourceAnswerId, rank: 1, weight: 1, audience: false });
      turns += 1;
      continue;
    }
    if (state.phase === "FINAL_WAGER" && !round.wagers[bot.id]) {
      const targetPlayerId = choose(players.filter((player) => player.id !== bot.id), `${state.code}:${round.id}:${bot.id}:target`).id;
      const wager = choose([100, 250, 500] as const, `${state.code}:${round.id}:${bot.id}:wager`);
      round.wagers[bot.id] = { targetPlayerId, wager };
      effects.push({ type: "prediction", roundId: round.id, playerId: bot.id, kind: "final_wager", payload: { targetPlayerId, wager } });
      turns += 1;
    }
  }
  return turns;
}
