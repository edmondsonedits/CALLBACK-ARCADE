import { SKETCH_CURSE_LABELS, type SnapshotSketchRelay } from "../arcade/sketch-relay";
export { showdownCues } from "./sketch-narrator-cues";

/** Presentation only: the persisted server phase selects a progress label. */
export function showdownProgress(phase: SnapshotSketchRelay["phase"]) {
  const preparation: Record<string, string> = { "prompt-writing": "Write prompts", "prompt-voting": "Elect prompts", "curse-selection": "Cast curse", "final-preparation": "Final twist", halfway: "Next round" };
  const active = phase in preparation ? 0 : ["drawing", "transforming"].includes(phase) ? 1 : phase === "showcase" ? 2 : phase === "laughter-voting" ? 3 : phase === "artist-guessing" ? 4 : phase === "revealing" ? 5 : 6;
  return [preparation[phase] ?? "Prepare", phase === "transforming" ? "Enchant" : "Draw", "Watch", "Vote", "Guess", "Reveal", "Results"].map((label, index) => ({ label, active: index === active }));
}

export const SHOWDOWN_COPY: Record<string, { title: string; eyebrow: string; instruction: string; voice: string }> = {
  "prompt-writing": { eyebrow: "01 / THE PROMPT SHOP", title: "Write the trouble.", instruction: "One funny drawing prompt each. Write your own or borrow a little inspiration.", voice: "Welcome to Sketch and Sorcery. Write one funny drawing prompt on your phone. Keep it short, strange and drawable. We supply the examples. You supply the questionable judgment." },
  "prompt-voting": { eyebrow: "02 / PICK OUR POISON", title: "Two prompts. Your call.", instruction: "Rank three favourites on your phone. The top two become everyone's drawing prompts.", voice: "Time to pick our poison. Rank your three favourite prompts. Everyone will draw the top two. Original player prompts win tied votes." },
  drawing: { eyebrow: "03 / THE INK IS YOURS", title: "Same prompt. Wildly different minds.", instruction: "Everyone draws this prompt. Four minutes. Lock your sketch when you're happy with it.", voice: "Artists, it is your turn. Everyone has the same prompt. You have four minutes. Draw on your phone, then lock your masterpiece. Talent is welcome. Absolutely not required." },
  transforming: { eyebrow: "04 / A LITTLE SORCERY", title: "Ink meets the impossible.", instruction: "Your sketches are becoming enchanted images. Original drawings stay secret until the reveal.", voice: "Brushes down. The sorcery department is translating your sketches. I have asked them to preserve the artistic intent. They have asked me what that means." },
  showcase: { eyebrow: "05 / THE ANONYMOUS EXHIBITION", title: "No names. Just masterpieces.", instruction: "Take a good look. Remember the letters. Voting opens after the tour.", voice: "Welcome to our anonymous exhibition. Same prompt, very different interpretations. Remember the letters. The artists are keeping a suspiciously low profile." },
  "laughter-voting": { eyebrow: "06 / YOUR FAVOURITES", title: "Rank your favourite drawings.", instruction: "Rank up to three favourites: first earns 100, second 75, third 50. No voting for yourself.", voice: "Pick the drawing you enjoyed the most. Rank your favourites on your phone. First choice earns its artist one hundred points, second seventy five, third fifty. You cannot vote for yourself. Yes, even if you are a misunderstood genius." },
  "artist-guessing": { eyebrow: "07 / NAME THAT ARTIST", title: "Someone in this room did this.", instruction: "Guess who drew your favourites. Each correct artist earns you 50 bonus points.", voice: "Someone in this room is responsible. Guess the artists behind the drawings you voted for. Each correct guess earns you fifty bonus points. No answers until everyone locks in." },
  revealing: { eyebrow: "08 / THE ARTIST UNMASKED", title: "The sketch behind the sorcery.", instruction: "Original sketch. Enchanted version. The artist finally takes the stage.", voice: "Time to meet the artists. The original sketch is about to explain everything. Or raise several more questions." },
  "round-results": { eyebrow: "THE SCOREBOARD", title: "The room has spoken.", instruction: "Laughter points and correct artist guesses are in. Tied artists share the honours.", voice: "The room has spoken. Laughter points and artist bonuses are in. If you are tied, share the glory. The trophy budget was already imaginary." },
  halfway: { eyebrow: "HALFWAY THROUGH / PROMPT 2 IS NEXT", title: "One down. One to draw.", instruction: "Get your drawing hand ready. Everyone's second shared prompt is coming up.", voice: "We are halfway through. One prompt down, one to draw. Get ready to move on to your second drawing. A fresh prompt, a fresh canvas, and another chance to blame your finger." },
  complete: { eyebrow: "THE EXHIBITION IS COMPLETE", title: "Art happened. Somehow.", instruction: "Two shared prompts. A room full of originals. One beautifully ridiculous exhibition.", voice: "Our exhibition is complete. Two prompts, a room full of originals, and a worrying amount of artistic confidence. Give our winners a cheer. Tied winners share the crown." },
};

/** Shared stage/phone/narrator wording follows the persisted rules version. */
export function showdownCopy(game: SnapshotSketchRelay) {
  const copy = { ...(SHOWDOWN_COPY[game.phase] ?? SHOWDOWN_COPY.drawing!) };
  if(game.phase === "round-results" && game.showdown?.workshop?.intermission) return {eyebrow:"EDMONDSON HALL OF QUESTIONABLE ART",title:"Which one made you laugh most?",instruction:"Nominate on your phone. This honour does not change the scores. The artist controls public sharing.",voice:"The points are settled. One last honour: which drawing made you laugh most? Nominate on your phone for the Edmondson Hall of Questionable Art. No extra points, just questionable glory."};
  if (game.totalRounds === 2 && !game.showdown?.sorceryLength) return copy;
  if(game.showdown?.sorceryLength === "quick"){
    if(game.phase === "drawing")return {...copy,instruction:`Everyone draws this prompt${game.showdown.curse?.selected?` with the curse: ${SKETCH_CURSE_LABELS[game.showdown.curse.selected]}`:""}. Two minutes. Lock your sketch when ready.`,voice:"Artists, draw on your phone. You have two minutes. Lock your sketch when ready."};
    if(game.phase === "prompt-voting")return {...copy,title:"Two prompts. Your call."};
    if(game.phase === "halfway")return {...copy,title:"One down. The curse awaits.",instruction:"Last place chooses a shared drawing curse. Round two earns double points.",voice:"One round down. Last place chooses a shared drawing curse. All points are doubled."};
    if(game.phase === "complete")return copy;
  }
  const mult = game.showdown?.multiplier ?? 1;
  const curse = game.showdown?.curse?.selected;
  switch (game.phase) {
    case "prompt-voting": return { ...copy, title: "Three prompts. Your call.", instruction: "Rank three favourites. The top three become our rounds; the final gets your own twist.", voice: "Rank your three favourite prompts. The top three become our drawing challenges. Original player prompts win tied votes." };
    case "curse-selection": return { eyebrow: "ROUND 2 · DOUBLE POINTS", title: "Last place casts the curse.", instruction: "The chosen last-place artist picks one of three curses for everyone. A curse is chosen automatically when time runs out.", voice: "Last place gets a little sorcery. Choose one of three drawing curses for everyone. Laughter and artist guesses are worth double this round." };
    case "final-preparation": return { eyebrow: "FINAL ROUND · TRIPLE POINTS", title: "Make the final your own.", instruction: "Choose a prompt twist and a starter on your phone. Missing choices are filled automatically. Your assignment stays private until your reveal.", voice: "The final round is worth triple. Choose a twist for your prompt and a starter sketch on your phone. The curse is lifted. Your own assignment stays secret until your reveal." };
    case "drawing":
      if (game.round === 3) return { ...copy, title: "Your prompt. Your final flourish.", instruction: "Draw your private assignment shown on your phone. Four minutes. Laughter and artist guesses earn triple points.", voice: "Draw your own final assignment on your phone. You have four minutes. The curse is lifted, and all points are tripled." };
      if (curse) return { ...copy, instruction: `Everyone draws this prompt with the curse: ${SKETCH_CURSE_LABELS[curse]}. Four minutes. All points are doubled.`, voice: `The curse is ${SKETCH_CURSE_LABELS[curse]}. Everyone draws the shared prompt with this restriction. You have four minutes, and all points are doubled.` };
      break;
    case "halfway": return game.round === 1
      ? { eyebrow: "ROUND 2 IS NEXT", title: "One down. Two to draw.", instruction: "Next: a drawing curse chosen by last place, and double points for everyone.", voice: "One round down. Next, last place chooses a drawing curse for everyone. Both laughter points and correct artist guesses are doubled." }
      : { eyebrow: "THE FINAL IS NEXT", title: "One last spell.", instruction: "The curse lifts. Choose your own prompt twist and starter. All final-round points are tripled.", voice: "The final round is next. The curse lifts. Choose a prompt twist and a starter sketch. All final-round points are tripled." };
    case "showcase": if (game.round === 3) return { ...copy, voice: "Our final anonymous exhibition. Each artist had a private twist. Remember the letters. The assignments and artists will be revealed together." }; break;
    case "laughter-voting": return { ...copy, instruction: `Rank up to three favourites: ${100 * mult}, ${75 * mult}, then ${50 * mult} points. No self-voting.`, voice: `Rank the drawings you enjoyed most on your phone. First earns ${100 * mult}, second ${75 * mult}, and third ${50 * mult} points. No self-voting.` };
    case "artist-guessing": return { ...copy, instruction: `Guess the artists behind your favourites. Each correct guess earns ${50 * mult} bonus points.`, voice: `Guess the artists behind the drawings you voted for. Each correct guess earns ${50 * mult} bonus points. Answers stay sealed until the reveal.` };
    case "complete": return { ...copy, instruction: "Three rounds. A room full of originals. One beautifully ridiculous exhibition.", voice: "Three rounds of sorcery complete. Give our winners a cheer. Tied winners share the crown." };
  }
  return copy;
}
