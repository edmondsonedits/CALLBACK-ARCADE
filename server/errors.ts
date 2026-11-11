import { apiError } from "../lib/contracts";

const ERROR_MAP: Record<string, [number, string]> = {
  ARCADE_RESULT_REQUIRED: [409, "This Arcade game uses its own results and replay controls."],
  ROUND_CLOSED: [409, "That round has finished. Watch for the next task."],
  STALE_SKETCH_RELAY_ASSIGNMENT: [409, "Your drawing task has changed. Refresh the room and try again."],
  INVALID_GUESSES: [422, "Use each eligible artist only once for the drawings you voted for."],
  INVALID_EMOTE: [422, "Choose one of the available avatar moves."],
  TOO_FAST: [429, "Give your avatar a moment before choosing another move."],
  ROOM_NOT_FOUND: [404, "That room could not be found."], UNAUTHORIZED: [401, "Your room session is missing or expired."],
  STALE_PHASE: [409, "The room has already moved on."], WRONG_ROUND: [409, "That action belongs to a different round."],
  DEADLINE_PASSED: [409, "Time is up for that action."], ALREADY_SUBMITTED: [409, "That response is already locked."],
  WRONG_PHASE: [409, "That action is not available in this phase."], SELF_VOTE: [422, "You cannot vote for your own answer."],
  INVALID_RANKING: [422, "Choose the required number of distinct answers."], NO_ELIGIBLE_VOTES: [422, "There are no eligible entries for you to rank."], ANSWER_NOT_FOUND: [404, "That answer is unavailable."],
  ANSWER_LENGTH: [422, "That answer is too long."], PICTURE_WORD_LIMIT: [422, "King Prompter prompts must stay under 20 words."], ANSWER_CONTROL_CHARACTER: [422, "That answer contains unsupported control characters."],
  CATCH_RULE_FAILED: [422, "That answer does not satisfy The Catch."], AUDIENCE_ACTION_FORBIDDEN: [403, "Audience members cannot perform that action."],
  INVALID_CHOICE: [422, "Choose one of the available options."], PREDICTION_TOTAL: [422, "Prediction chips must total exactly 100%."],
  INCOMPLETE_GUESSES: [422, "Match a writer to every assigned prompt."], INVALID_AUTHOR_GUESS: [422, "Use each valid player name only where allowed."],
  INVALID_WAGER_TARGET: [422, "Predict another active player."], NOT_ENOUGH_PLAYERS: [409, "At least two players are needed."], ROOM_FULL: [409, "This room already has ten active players."],
  CANNOT_PAUSE: [409, "There is no active timer to pause."], NOT_PAUSED: [409, "The room is not paused."], NO_ACTIVE_TIMER: [409, "There is no active timer."],
  CANNOT_SKIP: [409, "This phase cannot be skipped."], PLAYER_NOT_FOUND: [404, "That player is unavailable."],
  ARCADE_CONFIG_LOCKED: [409, "The Arcade game is selected when you create the room; it cannot be changed in the lobby."],
  BOWL_TEAMS_UNBALANCED: [409, "Each Bowl of Fools team needs at least two players."],
  BOWL_NEEDS_FOUR: [409, "Bowl of Fools needs at least four players."],
  FOOL_BOT_PERFORMANCE_PENDING: [409, "Wait for the bot's clue or practice performance before judging."],
  FOOL_BOT_GUESS_INCORRECT: [422, "That guess does not match the current scroll. Listen and try again."],
  FOOL_GUESS_REQUIRED: [422, "Enter the team's spoken guess first."],
  FOOL_GUESS_TOO_LONG: [422, "Keep the team's guess under 100 characters."],
  FOOL_SCROLL_COUNT: [422, "Complete every scroll before folding them."], FOOL_SCROLL_WORD_LIMIT: [422, "Each scroll must contain one to five words."],
  FOOL_SCROLL_DUPLICATE: [422, "Every scroll in the bowl must be different."], FOOL_PASS_UNAVAILABLE: [409, "That turn's one pass has already been used."],
  NOT_FOOL_CLUE_GIVER: [403, "Only the current clue giver can control this scroll."], NOTHING_TO_UNDO: [409, "There is no recent correct answer to undo."],
  DEVELOPER_MODE_REQUIRED: [403, "Developer changes are limited to isolated developer playtests."], DEVELOPER_ROUND_REQUIRED: [409, "Start a round before editing it."],
  DEVELOPER_CHOICE_COUNT: [422, "Keep the same number of choices while editing this round."],
  SOLO_LIVE_IMAGES_UNAVAILABLE: [422, "Live solo images are available only in a King Prompter solo room."],
  FEEDBACK_CLOSED: [409, "Feedback voting is closed for this game."], INVALID_FEEDBACK_CHOICE: [422, "Choose one of the two feedback options."],
  FEEDBACK_ALREADY_SUBMITTED: [409, "You already voted on that feedback pair."], FEEDBACK_COOLDOWN: [409, "Read the next pair before voting again."],
};

export function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNEXPECTED_ERROR";
  const mapped = ERROR_MAP[code];
  if (mapped) return apiError(code, mapped[1], mapped[0]);
  console.error("CALLBACK route error", error);
  return apiError("UNEXPECTED_ERROR", "Something went wrong. The room is still safe; try again.", 500);
}
