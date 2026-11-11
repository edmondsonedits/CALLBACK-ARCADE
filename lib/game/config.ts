import type { GameLength, RoundKind, RoomPhase } from "../contracts";

export const ROUND_PLANS: Record<GameLength, Array<{ kind: RoundKind; label: string }>> = {
  standard: [{ kind: "THE_SEED", label: "The Seed" }, { kind: "READ_THE_ROOM", label: "Read the Room" }, { kind: "MAKE_IT_REAL", label: "Make It Real" }, { kind: "THE_CATCH", label: "The Catch" }, { kind: "CROWD_CONTROL", label: "Crowd Control" }, { kind: "CALLBACK", label: "Callback" }, { kind: "THE_REMIX", label: "The Remix" }],
  birthday: [{ kind: "BIRTHDAY_BETS", label: "Birthday Bets" }, { kind: "FIRST_IMPRESSIONS", label: "The Biopic" }, { kind: "BIRTHDAY_BETS", label: "Birthday Bets" }, { kind: "WHO_SAID_THAT", label: "Who Wrote It?" }, { kind: "THE_CATCH", label: "Thirty Words or Less" }, { kind: "CROWD_CONTROL", label: "Most Likely To" }, { kind: "FINAL_READ", label: "Future Message" }],
  pictures: [{ kind: "PROMPT_AND_CIRCUMSTANCE", label: "Canvas One" }, { kind: "PROMPT_AND_CIRCUMSTANCE", label: "Canvas Two" }, { kind: "KING_PROMPTER_FINAL", label: "Royal Restoration" }],
  comic: [{ kind: "COMIC_FRAME", label: "Frame One · Setup" }, { kind: "COMIC_FRAME", label: "Frame Two · Escalation" }, { kind: "COMIC_FRAME", label: "Frame Three · Punchline" }],
  bowl: [{ kind: "BOWL_SPEAK", label: "Speak, Fool!" }, { kind: "BOWL_DRAW_OR_PERFORM", label: "Draw or Perform, Fool!" }, { kind: "BOWL_ONE_WORD", label: "One Word, Fool!" }],
  "king-mystery": [{ kind: "KING_REQUEST_MYSTERY", label: "The Royal Frame-Up" }],
  "royal-rumours": [{ kind: "ROYAL_RUMOURS", label: "Royal Rumours" }],
  "royal-war-room": [{ kind: "ROYAL_WAR_ROOM", label: "Opening Orders" }, { kind: "ROYAL_WAR_ROOM", label: "The Main Campaign" }, { kind: "ROYAL_WAR_ROOM", label: "Battle for the Crown" }],
  arcade: [],
  "bowl-of-fools": [{ kind: "BOWL_OF_FOOLS", label: "Bowl of Fools" }],
};
export const TIMER_SECONDS = {
  standard: { creative: 45, vote: 25, personal: 20, prediction: 35, guesses: 35, wager: 20, finalAnswer: 60, finalVote: 30 },
  birthday: { creative: 45, vote: 25, personal: 25, prediction: 35, guesses: 35, wager: 20, finalAnswer: 60, finalVote: 30 },
  pictures: { creative: 120, vote: 35, personal: 15, prediction: 25, guesses: 25, wager: 15, finalAnswer: 120, finalVote: 45 },
  comic: { creative: 90, vote: 35, personal: 15, prediction: 25, guesses: 25, wager: 15, finalAnswer: 90, finalVote: 40 },
  bowl: { creative: 60, vote: 60, personal: 60, prediction: 60, guesses: 60, wager: 60, finalAnswer: 60, finalVote: 60 },
  "king-mystery": { creative: 75, vote: 22, personal: 20, prediction: 25, guesses: 35, wager: 15, finalAnswer: 75, finalVote: 22 },
  "royal-rumours": { creative: 60, vote: 30, personal: 20, prediction: 25, guesses: 45, wager: 15, finalAnswer: 60, finalVote: 30 },
  "royal-war-room": { creative: 45, vote: 25, personal: 35, prediction: 25, guesses: 25, wager: 15, finalAnswer: 45, finalVote: 25 },
  arcade: { creative: 0, vote: 0, personal: 0, prediction: 0, guesses: 0, wager: 0, finalAnswer: 0, finalVote: 0 },
  "bowl-of-fools": { creative: 90, vote: 20, personal: 20, prediction: 20, guesses: 60, wager: 20, finalAnswer: 60, finalVote: 20 },
} as const;
export const NON_INTERACTIVE_SECONDS: Partial<Record<RoomPhase, number>> = { INTRO: 4, ROUND_INTRO: 4, ANSWER_LOCK: 2, VOTE_LOCK: 2, IMAGE_REVEAL: 8, REVEAL: 7, ROUND_RESULTS: 6, FINAL_RESULTS: 9 };
export const SCORE_CAPS: Partial<Record<RoundKind, number>> = { THE_SEED: 1000, FIRST_IMPRESSIONS: 1000, THE_CATCH: 1200, MAKE_IT_REAL: 1300, CALLBACK: 1400, THE_REMIX: 2000, FINAL_READ: 2000 };

export function phaseDurationMs(length: GameLength, phase: RoomPhase, extended: boolean): number {
  if (phase === "ARCADE_ACTIVE" || phase === "ARCADE_RESULTS") return 0;
  const timer = TIMER_SECONDS[length];
  let seconds = NON_INTERACTIVE_SECONDS[phase] ?? 0;
  if (phase === "ANSWERING") seconds = timer.creative;
  if (phase === "VOTING") seconds = timer.vote;
  if (phase === "PERSONAL_CHOICE") seconds = timer.personal;
  if (phase === "ROOM_PREDICTION") seconds = timer.prediction;
  if (phase === "AUTHOR_GUESSING") seconds = timer.guesses;
  if (phase === "FINAL_WAGER") seconds = timer.wager;
  if (phase === "FINAL_ANSWERING") seconds = timer.finalAnswer;
  if (phase === "FINAL_VOTING") seconds = timer.finalVote;
  if (phase === "MYSTERY_DECOYS") seconds = timer.guesses;
  if (phase === "MYSTERY_VOTING") seconds = timer.vote;
  if (phase === "MYSTERY_REVEAL") seconds = 8;
  if (phase === "RUMOUR_GUESSING") seconds = timer.guesses;
  if (phase === "RUMOUR_IMAGE_REVEAL") seconds = 1;
  if (phase === "RUMOUR_REVEAL") seconds = 8;
  if (phase === "RUMOUR_VOTING") seconds = timer.vote;
  if (phase === "WAR_RANKING") seconds = timer.personal;
  if (phase === "WAR_COUNCIL") seconds = timer.vote;
  if (phase === "WAR_TURN_REVEAL") seconds = 4;
  if (phase === "WAR_ROUND_REVEAL") seconds = 8;
  if (phase === "FOOL_WRITING") seconds = 90;
  if (phase === "FOOL_TURN") seconds = 60;
  if (phase === "FOOL_ROUND_REVEAL") seconds = 7;
  if (phase === "FOOL_SUDDEN_DEATH") seconds = 30;
  if (extended && ["ANSWERING", "VOTING", "PERSONAL_CHOICE", "ROOM_PREDICTION", "AUTHOR_GUESSING", "FINAL_WAGER", "FINAL_ANSWERING", "FINAL_VOTING", "MYSTERY_DECOYS", "MYSTERY_VOTING", "RUMOUR_GUESSING", "RUMOUR_VOTING", "WAR_RANKING", "WAR_COUNCIL", "FOOL_WRITING", "FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(phase)) seconds *= 1.5;
  return Math.round(seconds * 1000);
}
