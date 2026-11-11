import type { GameLength, RoomPhase, RoundKind } from "../contracts";

export type MusicMood = "lobby" | "thinking" | "matching" | "voting" | "reveal" | "finale";

export interface AudioGameState {
  phase: RoomPhase;
  roundKind: RoundKind | null;
  roundNumber: number;
  roundTotal: number;
  gameLength: GameLength;
  prompt: string | null;
  instruction: string | null;
  paused: boolean;
  players: Array<{ nickname: string; role: "player" | "audience"; score?: number }>;
}

const TITLES: Partial<Record<RoundKind, string>> = {
  THE_SEED: "The Seed", READ_THE_ROOM: "Read the Room", MAKE_IT_REAL: "Make It Real", THE_CATCH: "The Catch",
  CROWD_CONTROL: "Crowd Control", CALLBACK: "Callback", THE_REMIX: "The Remix", FIRST_IMPRESSIONS: "First Impressions",
  WHO_SAID_THAT: "Who Wrote It?", FINAL_READ: "Final Read", BIRTHDAY_BETS: "Birthday Bets", MONSTER_FACTORY: "Monster Factory",
  PROMPT_AND_CIRCUMSTANCE: "King Prompter", KING_PROMPTER_FINAL: "Royal Restoration", COMIC_FRAME: "Let's Make a Comic", KING_REQUEST_MYSTERY: "The Royal Frame-Up",
  BOWL_SPEAK: "Speak, Fool!", BOWL_DRAW_OR_PERFORM: "Draw or Perform, Fool!", BOWL_ONE_WORD: "One Word, Fool!", BOWL_SUDDEN_DEATH: "Sudden Death",
  ROYAL_RUMOURS: "Royal Rumours", ROYAL_WAR_ROOM: "Royal War Room",
};

export function musicMoodForPhase(phase: RoomPhase): MusicMood {
  if (phase === "LOBBY") return "lobby";
  if (["ANSWERING", "FINAL_ANSWERING", "PERSONAL_CHOICE", "ROOM_PREDICTION", "FINAL_WAGER", "ENCORE_CONTRIBUTING", "ENCORE_FOLLOWUP", "MYSTERY_DECOYS", "RUMOUR_GUESSING", "WAR_RANKING", "WAR_COUNCIL"].includes(phase)) return "thinking";
  if (["ANSWER_LOCK", "AUTHOR_GUESSING", "IMAGE_REVEAL", "ENCORE_IMAGE", "RUMOUR_IMAGE_REVEAL"].includes(phase)) return "matching";
  if (["VOTING", "VOTE_LOCK", "FINAL_VOTING", "MYSTERY_VOTING", "RUMOUR_VOTING"].includes(phase)) return "voting";
  if (["FINAL_RESULTS", "POST_GAME"].includes(phase)) return "finale";
  if (phase === "BOWL_SCROLL_WRITING") return "thinking";
  if (["BOWL_TURN", "BOWL_SUDDEN_DEATH"].includes(phase)) return "voting";
  return "reveal";
}

export function narrationForPhase(state: AudioGameState): string | null {
  const title = state.roundKind ? TITLES[state.roundKind] ?? "the next round" : "the next round";
  if (state.paused) return "Game paused. Take a breath.";
  switch (state.phase) {
    case "LOBBY": return "Welcome to King Prompter. Gather your players, turn up the TV, and start when everyone is in.";
    case "BOWL_TUTORIAL": return "A royal pigeon has filled the ceremonial bowl with anonymous nonsense. You will guess the same scrolls three times: describe, draw or perform, then use exactly one word. Authors stay secret forever.";
    case "BOWL_SCROLL_WRITING": return "Write your anonymous scrolls now. One to five words each. People, places, objects, titles, and suspicious turnips are welcome.";
    case "BOWL_TURN": return `${title}. The clue giver has sixty seconds, one pass, and the room's honor.`;
    case "BOWL_INTERMISSION": return "The bowl is empty, so naturally every scroll is coming back. Scores are updated. Remember what you heard.";
    case "BOWL_SUDDEN_DEATH": return "Sudden death. One secret scroll, no passing, and the first correct guess wins the Crown of Fools.";
    case "INTRO": return state.gameLength === "royal-war-room"
      ? "Welcome to the Royal War Room. Secretly rank the kingdom’s orders, then work with your council to reconstruct the room’s hidden strategy. The next match switches from attack to defence, or defence to attack."
      : state.gameLength === "royal-rumours"
      ? "Welcome to Royal Rumours. Write one secret royal whisper. AI paints it, another player guesses what the picture means, and AI paints the misunderstanding. Then crown the funniest transformation."
      : state.gameLength === "king-mystery"
      ? "The pigeon dropped the royal case files. File one ridiculous castle incident, study the reconstructed evidence paintings, and separate genuine reports from shameless cover stories."
      : state.gameLength === "pictures"
        ? "Welcome, Royal Artists. Describe the masterpiece the King requested, then trust your entirely human Royal Squire to paint it."
        : "Welcome to King Prompter. Phones ready. It is time to find out who really knows the room.";
    case "ROUND_INTRO": return `Round ${state.roundNumber} of ${state.roundTotal}. ${title}.`;
    case "ANSWERING":
    case "FINAL_ANSWERING":
      return state.prompt ? `Players, check your phones. Here is your prompt. ${state.prompt}${state.instruction ? ` ${state.instruction}` : ""}` : "Players, check your phones and lock in your answer.";
    case "PERSONAL_CHOICE": return "Make your choice on your phone. No peeking.";
    case "ROOM_PREDICTION": return "Predict the room. Lock in what you think everyone chose.";
    case "AUTHOR_GUESSING": return ["PROMPT_AND_CIRCUMSTANCE", "COMIC_FRAME"].includes(state.roundKind ?? "")
      ? "The art department is working. Match every prompt to the player who wrote it. Use each name once."
      : "Who wrote what? Match each answer to its suspicious author.";
    case "VOTING": return "Time to vote. Rank your favorites on your phone.";
    case "FINAL_VOTING": return state.roundKind === "KING_PROMPTER_FINAL" ? "The portrait is whole again, in the broadest possible sense. Choose the funniest restored section." : state.roundKind === "PROMPT_AND_CIRCUMSTANCE" ? "The gallery is open. Choose one favorite image now." : "The images are ready. Rank your favorites now.";
    case "IMAGE_REVEAL": return "The art department has delivered. Let us see what your prompts became.";
    case "MYSTERY_DECOYS": return "One evidence painting. Everyone except its original witness must file a believable cover story.";
    case "MYSTERY_VOTING": return "The case files are mixed. Find the incident report that actually reconstructed this painting.";
    case "MYSTERY_REVEAL": return "Case closed. Let us expose the true incident, every cover story, and any Royal Seal placed on the lie.";
    case "RUMOUR_GUESSING": return "Each phone has received somebody else's anonymous AI painting. Describe what you think happened without seeing the original whisper.";
    case "RUMOUR_IMAGE_REVEAL": return "The Royal Rumour Press is painting every misunderstanding. The reveal waits until every result is confirmed.";
    case "RUMOUR_REVEAL": return "It began as a whisper. Now let us follow every rumour through both AI paintings and the blind interpretation between them.";
    case "RUMOUR_VOTING": return "Choose the funniest transformation. You cannot vote for a chain you started or interpreted.";
    case "WAR_RANKING": return "Secretly rank all six royal orders from first to last. Your combined opinions become the kingdom’s classified battle plan.";
    case "WAR_COUNCIL": return "The active council may discuss the evidence. The commander must place one remaining order into one open position.";
    case "WAR_TURN_REVEAL": return "The Royal Intelligence Office is checking that order against the room’s hidden plan.";
    case "WAR_ROUND_REVEAL": return "The classified strategy is revealed. Count the recovered banners and prepare for the next campaign chapter.";
    case "REVEAL": return "The votes are in. Let us see who got the points.";
    case "ROUND_RESULTS": return "Scores are updated. Get ready for the next round.";
    case "FINAL_WAGER": return "Final wager. Read the room, choose your target, and decide how much to risk.";
    case "FINAL_RESULTS": {
      if (state.gameLength === "bowl") return "The Crown of Fools has been awarded. Every scroll author remains a royal secret.";
      const ranked = state.players.filter((player) => player.role === "player").sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const high = ranked[0]?.score ?? 0;
      const winners = ranked.filter((player) => (player.score ?? 0) === high).map((player) => player.nickname);
      return winners.length ? `${winners.join(" and ")} ${winners.length === 1 ? "wins" : "win"} King Prompter with ${high.toLocaleString()} points.` : "That is the game. Thanks for playing King Prompter.";
    }
    case "POST_GAME": return null;
    case "ENCORE_CONTRIBUTING": return "Encore time. Build one final monster together on your phones.";
    case "ENCORE_FOLLOWUP": return "One last detail. Finish the monster on your phone.";
    case "ENCORE_IMAGE": return "Stand back. The final creature is coming to life.";
    case "ENDED": return "The game has ended.";
    default: return null;
  }
}
