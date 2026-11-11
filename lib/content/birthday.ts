import { stableHash } from "../game/random";

export interface BirthdayChoiceQuestion {
  id: string;
  prompt: (name: string) => string;
  choices: readonly [string, string, string, string];
}

export type BirthdayPromptKind = "FIRST_IMPRESSIONS" | "THE_CATCH" | "CROWD_CONTROL" | "FINAL_READ";

type BirthdayPrompt = (name: string) => string;

// Editorial rules for this pack: make the situation concrete, keep every option
// plausibly tempting, reveal personality rather than trivia, and leave the room
// with something worth debating after the reveal.
export const BIRTHDAY_CHOICE_QUESTIONS: BirthdayChoiceQuestion[] = [
  { id: "birthday-bet-escape-room", prompt: (name) => `${name} enters an escape room. Which role does he claim without being asked?`, choices: ["Clue detective", "Lock rattler", "Red-herring expert", "Team morale officer"] },
  { id: "birthday-bet-tiny-annoyance", prompt: (name) => `${name} can erase one tiny annoyance from existence. What disappears?`, choices: ["Slow walkers", "Fitted sheets", "Group-chat planning", "Unexpected phone calls"] },
  { id: "birthday-bet-road-trip", prompt: (name) => `${name} gets one job on a long road trip. What does he control?`, choices: ["The playlist", "The route", "The snacks", "The unnecessary stops"] },
  { id: "birthday-bet-microphone", prompt: (name) => `A microphone is suddenly handed to ${name}. What happens next?`, choices: ["A proper speech", "An ambitious song", "A fake announcement", "A very quick handoff"] },
  { id: "birthday-bet-specific-skill", prompt: (name) => `${name} can instantly master one suspiciously specific skill. Which one?`, choices: ["Name any song instantly", "Pack a car perfectly", "Pick a restaurant everyone likes", "Parallel park under pressure"] },
  { id: "birthday-bet-home-room", prompt: (name) => `${name} can add one completely unnecessary room to his home. What is it?`, choices: ["Private cinema", "Games arcade", "Tiny pub", "Over-equipped workshop"] },
  { id: "birthday-bet-reality-show", prompt: (name) => `${name} must compete on television tomorrow. Which show gives him the best chance?`, choices: ["A survival challenge", "A cooking contest", "A general-knowledge quiz", "A chaotic travel race"] },
  { id: "birthday-bet-minor-power", prompt: (name) => `${name} gets one extremely minor superpower. Which does he keep?`, choices: ["Always find parking", "Never lose his keys", "Choose the fastest queue", "Wake up just before the alarm"] },
  { id: "birthday-bet-podcast", prompt: (name) => `${name} launches a podcast that somehow reaches 100 episodes. What is it about?`, choices: ["Petty opinions", "Untold stories", "One obsessive hobby", "Ranking everyday things"] },
  { id: "birthday-bet-restaurant", prompt: (name) => `A restaurant names a menu item after ${name}. What kind of item is it?`, choices: ["An excessive burger", "A dangerously spicy dish", "A suspicious cocktail", "An enormous dessert"] },
  { id: "birthday-bet-argument", prompt: (name) => `${name} must defend one petty opinion on live television. Which topic does he choose?`, choices: ["The perfect thermostat", "Correct dishwasher loading", "When a party should end", "The superior dipping sauce"] },
  { id: "birthday-bet-assistant", prompt: (name) => `${name} gets a personal assistant for exactly one day. What gets delegated first?`, choices: ["Life admin", "Housework", "Meal planning", "Replying to messages"] },
  { id: "birthday-bet-relive-age", prompt: (name) => `${name} can relive one age for a single Saturday. Which version returns?`, choices: ["Ten-year-old him", "Sixteen-year-old him", "Twenty-one-year-old him", "Yesterday's him"] },
  { id: "birthday-bet-museum", prompt: (name) => `A museum preserves one ordinary item from ${name}'s twenties. What deserves the glass case?`, choices: ["His most-worn shoes", "An old phone", "A favourite mug", "The mystery cable box"] },
  { id: "birthday-bet-golden-buzzer", prompt: (name) => `${name} needs a five-minute talent-show act by tonight. What is he betting on?`, choices: ["Impressions", "Storytelling", "A party trick", "Confident improvising"] },
  { id: "birthday-bet-time-capsule", prompt: (name) => `${name} puts one thing from tonight into a time capsule. What goes in?`, choices: ["A group photo", "The party playlist", "A handwritten prediction", "The least damaged decoration"] },
  { id: "birthday-bet-one-free-year", prompt: (name) => `${name} gets one thing free for his entire thirtieth year. What does he choose?`, choices: ["Takeaways", "Concert tickets", "Fuel and transport", "Coffee"] },
  { id: "birthday-bet-one-percent", prompt: (name) => `${name}'s phone hits 1% at the worst possible moment. What gets the final battery?`, choices: ["Calling for help", "Ordering a ride", "Checking directions", "Sending one last meme"] },
  { id: "birthday-bet-birthday-upgrade", prompt: (name) => `${name} wakes up with one birthday upgrade. Which would surprise everyone most?`, choices: ["Always early", "Loves cardio", "Keeps everything tidy", "Reads every instruction"] },
  { id: "birthday-bet-mystery-box", prompt: (name) => `${name} may open one mystery box. Which label wins him over?`, choices: ["New gadget", "Two tickets", "Rare snacks", "Probably a prank"] },
  { id: "birthday-bet-emergency-save", prompt: (name) => `Everyone is safe, but ${name} can rescue one ridiculous item from home. What gets saved?`, choices: ["The favourite hoodie", "The gaming setup", "The birthday leftovers", "The cable box"] },
  { id: "birthday-bet-group-project", prompt: (name) => `${name} is trapped in a group project again. Which version of him appears?`, choices: ["Natural leader", "Quiet problem-solver", "Last-minute hero", "Snacks and moral support"] },
  { id: "birthday-bet-surprise-plan", prompt: (name) => `${name} is told to pack a bag but gets no other details. What is his first move?`, choices: ["Ask seventeen questions", "Pack for every climate", "Bring almost nothing", "Check who else is going"] },
  { id: "birthday-bet-future-habit", prompt: (name) => `Which habit is 60-year-old ${name} most likely to still have?`, choices: ["The same catchphrase", "The same takeaway order", "The same bedtime excuse", "The same old hoodie"] },
  { id: "birthday-bet-statue", prompt: (name) => `${name} gets a statue, but he must choose the pose. Which one becomes permanent?`, choices: ["Heroic finger-point", "Holding a snack", "Checking his phone", "Mid-story hand gestures"] },
  { id: "birthday-bet-masterclass", prompt: (name) => `${name} is forced to teach a masterclass. What can he bluff for the longest?`, choices: ["Winning an argument", "Avoiding unnecessary effort", "Finding the best food", "Looking busy"] },
  { id: "birthday-bet-entrance", prompt: (name) => `${name} gets a dramatic entrance everywhere for one week. Which effect does he pick?`, choices: ["Theme music", "Indoor fireworks", "A voice-over", "A polite round of applause"] },
  { id: "birthday-bet-group-chat", prompt: (name) => `The group chat gives ${name} one official title. Which does he accept?`, choices: ["Voice of reason", "Chaos coordinator", "Meme archivist", "Seen at 2:14 a.m."] },
];

export const BIRTHDAY_CREATIVE_PROMPTS: Record<BirthdayPromptKind, BirthdayPrompt[]> = {
  FIRST_IMPRESSIONS: [
    (name) => `Give the prestige documentary about ${name}'s twenties its brutally honest title.`,
    (name) => `Name the chapter ${name}'s biographer was legally advised to remove.`,
    (name) => `A museum opens one permanent exhibit about ${name}. What is it called?`,
    (name) => `Write the headline published the morning after ${name}'s 30th birthday.`,
    (name) => `What achievement gets ${name} nominated for a completely unofficial award?`,
    (name) => `Caption the one photo that perfectly explains ${name}'s first 30 years.`,
    (name) => `Name the era of ${name} that historians will argue about most.`,
    (name) => `Write the honest subtitle beneath ${name}'s official portrait.`,
    (name) => `Name the unreleased episode of ${name}'s life that the group chat remembers.`,
    (name) => `What does the audio guide say before entering the ${name} exhibition?`,
    (name) => `Give ${name}'s thirtieth year the title of a suspiciously dramatic sequel.`,
    (name) => `Complete this review: “Thirty years of ${name}: five stars, but…”`,
  ],
  THE_CATCH: [
    (name) => `Name the app ${name} creates to solve a problem only he seems to have.`,
    (name) => `Write ${name}'s one-line campaign promise if he runs the country tomorrow.`,
    (name) => `Name the masterclass ${name} is wildly unqualified to teach.`,
    (name) => `Write the first headline from ${name}'s forties.`,
    (name) => `Write the one-star review ${name}'s sofa would leave about him.`,
    (name) => `Write the safety announcement before a group holiday led by ${name}.`,
    (name) => `Invent a product named after ${name}'s most recognizable habit.`,
    (name) => `Create the new public holiday celebrating ${name}. What happens on it?`,
    (name) => `Give ${name} the painfully accurate job title his friends would choose.`,
    (name) => `Write the house rule guests at ${name}'s place learn five minutes too late.`,
    (name) => `Write the inscription on ${name}'s statue—with uncomfortable honesty.`,
    (name) => `Name the restaurant special inspired by ${name}'s worst food habit.`,
  ],
  CROWD_CONTROL: [
    (name) => `Who would ${name} trust to manage his group-chat legacy?`,
    (name) => `Who does ${name} call first after locking himself out?`,
    (name) => `Who could identify ${name}'s takeaway order while blindfolded?`,
    (name) => `Who is most likely to still have a photo of ${name}'s worst haircut?`,
    (name) => `Who could talk ${name} into a road trip with only ten minutes' notice?`,
    (name) => `Who could co-host a podcast with ${name} and absolutely no plan?`,
    (name) => `Who would give the funniest toast about ${name} while getting half the facts wrong?`,
    (name) => `Who could impersonate ${name} well enough to fool the group chat?`,
    (name) => `Who would ${name} recruit to hide a life-size waxwork before his parents arrive?`,
    (name) => `Who gets cast as ${name} in the suspiciously low-budget biopic?`,
    (name) => `Who knows exactly which petty argument ${name} will never surrender?`,
    (name) => `Who could find ${name} at a crowded party without calling him?`,
  ],
  FINAL_READ: [
    (name) => `Write the ten-second voice note 60-year-old ${name} sends back to tonight.`,
    (name) => `Complete the toast: “To ${name}: may your thirties contain less ___ and more ___.”`,
    (name) => `Write the final line of the movie about ${name}'s 30th birthday.`,
    (name) => `What message should tonight's group seal in a time capsule for ${name} at 60?`,
    (name) => `Write the promise everyone here should make to ${name} for the next 30 years.`,
    (name) => `Thirty years from now, what will ${name}'s party be blamed for starting?`,
    (name) => `Write the headline from ${name}'s 60th birthday looking back at tonight.`,
    (name) => `What should ${name} absolutely never grow out of?`,
    (name) => `Write the message the group chat sends ${name} on this date in 2056.`,
    (name) => `Write ${name}'s fortune-cookie prediction for the next 30 years.`,
    (name) => `What award does ${name} accept at 60, and what is his first sentence?`,
    (name) => `Write the plaque on the bench where everyone reunites for ${name}'s 60th.`,
  ],
};

export function birthdayChoiceQuestion(seed: string, usedIds: readonly string[]): BirthdayChoiceQuestion {
  const fresh = BIRTHDAY_CHOICE_QUESTIONS.filter((question) => !usedIds.includes(question.id));
  const pool = fresh.length ? fresh : BIRTHDAY_CHOICE_QUESTIONS;
  return pool[stableHash(`${seed}:birthday-bet`) % pool.length];
}

export function birthdayCreativePrompt(kind: BirthdayPromptKind, name: string, seed: string, usedIds: readonly string[] = []): { id: string; text: string } {
  const pool = BIRTHDAY_CREATIVE_PROMPTS[kind];
  const freshIndexes = pool.map((_prompt, index) => index).filter((index) => !usedIds.includes(`birthday-${kind.toLowerCase()}-${index + 1}`));
  const candidates = freshIndexes.length ? freshIndexes : pool.map((_prompt, index) => index);
  const index = candidates[stableHash(`${seed}:${kind}:${name}`) % candidates.length];
  return { id: `birthday-${kind.toLowerCase()}-${index + 1}`, text: pool[index](name) };
}
