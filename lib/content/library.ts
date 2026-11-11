import type { ContentMode, RoundKind } from "../contracts";
import { PromptDeck } from "../game/prompt-deck";
import type { CatchRule } from "../game/validators";

export interface PromptEntry {
  id: string;
  text: string;
  contentMode: ContentMode;
  category: string;
  localeDependent: boolean;
  weight: number;
  recentUseSuppression: number;
}


const OPEN_SUBJECTS = [
  "a haunted group chat", "the world's least useful superpower", "a suspiciously confident pigeon", "an escape room for toddlers", "a luxury product nobody requested",
  "your personal warning label", "a restaurant run by raccoons", "the worst theme for a wedding", "a motivational poster for villains", "an app that should not exist",
  "the strangest thing to keep in a desk drawer", "a rejected Olympic sport", "an extremely local conspiracy theory", "a mascot having a rough week", "the opposite of a life hack",
  "a terrible name for a yacht", "the last item left at a garage sale", "a dramatic reason to leave brunch", "an oddly specific museum", "a job performed entirely by ducks",
  "the least relaxing spa treatment", "a secret menu item with consequences", "a tiny hill worth dying on", "a bedtime story for accountants", "a terrible password hint",
  "the new feature nobody wanted", "a deeply unhelpful fortune cookie", "a theme park with one star", "the pettiest possible trophy", "a product endorsed by your future self",
] as const;
const OPEN_FORMATS = [
  (subject: string) => `Write the unofficial slogan for ${subject}.`,
  (subject: string) => `What is the one rule everyone should know about ${subject}?`,
  (subject: string) => `The boldest review anyone could leave for ${subject}:`,
  (subject: string) => `What detail makes ${subject} even more suspicious?`,
  (subject: string) => `Give us the headline after ${subject} goes terribly right.`,
] as const;

export const OPEN_PROMPTS: PromptEntry[] = OPEN_SUBJECTS.flatMap((subject, subjectIndex) =>
  OPEN_FORMATS.map((format, formatIndex) => ({
    id: `open-${String(subjectIndex + 1).padStart(2, "0")}-${formatIndex + 1}`,
    text: format(subject),
    contentMode: subjectIndex % 11 === 0 && formatIndex === 4 ? "party" : "family",
    category: ["absurd", "social", "invent", "headline", "confession"][formatIndex],
    localeDependent: false,
    weight: 1 + ((subjectIndex + formatIndex) % 3) * 0.15,
    recentUseSuppression: 12,
  })),
);

const SEED_DOMAINS = [
  "dentist office", "cruise ship", "children's TV show", "restaurant", "household appliance", "theme park", "luxury hotel", "delivery service", "local museum", "wellness brand",
] as const;
const SEED_MACHINES = [
  (domain: string) => `Invent the mascot for a ${domain} that has already been investigated twice.`,
  (domain: string) => `Name the ${domain} whose name alone should make everyone leave.`,
  (domain: string) => `Invent the worst new character hired to represent a ${domain}.`,
  (domain: string) => `Name a ${domain} that solves a problem nobody has and creates three more.`,
  (domain: string) => `Invent the suspiciously beloved face of a ${domain} with a one-star safety record.`,
] as const;
export const SEED_PROMPTS: PromptEntry[] = SEED_DOMAINS.flatMap((domain, domainIndex) => SEED_MACHINES.map((format, formatIndex) => ({
  id: `seed-${domainIndex + 1}-${formatIndex + 1}`, text: format(domain), contentMode: "family", category: "anchor", localeDependent: false, weight: 1, recentUseSuppression: 50,
})));

const WORLD_CHANGES = [
  "new law everybody immediately hates", "mandatory workplace policy nobody understands", "holiday that ruins the entire month", "social trend that becomes legally binding", "public-safety rule that makes everything less safe",
  "transportation policy written by someone who has never travelled", "school rule that accidentally starts a black market", "neighbourhood event that requires a waiver", "government announcement that creates instant panic", "customer-service rule designed by a supervillain",
] as const;
const WORLD_MACHINES = [
  (change: string) => `Write the ${change}.`,
  (change: string) => `Announce the ${change} in the fewest alarming words possible.`,
  (change: string) => `What is the official name of the ${change}?`,
  (change: string) => `Complete the ${change}: “Effective immediately…”`,
] as const;
export const WORLD_PROMPTS: PromptEntry[] = WORLD_CHANGES.flatMap((change, changeIndex) => WORLD_MACHINES.map((format, formatIndex) => ({
  id: `world-${changeIndex + 1}-${formatIndex + 1}`, text: format(change), contentMode: "family", category: "world", localeDependent: false, weight: 1, recentUseSuppression: 40,
})));

const CROWD_CONTROL_SCENARIOS = [
  "could accidentally get hired somewhere they do not work and keep the job longest", "would survive a haunted escape room by annoying the ghost", "would become the mayor of a town they visited once", "could confidently lead a tour of a building they have never entered", "would be trusted with the group's extremely suspicious briefcase",
  "would accidentally start a cult with a brunch reservation", "could talk their way onto a red carpet", "would turn a minor typo into a three-day event", "could win an argument against a parking meter", "would be chosen by aliens to explain the group",
  "could keep a completely fake holiday alive for years", "would get banned from a museum for the funniest reason", "could sell the room a product that does nothing", "would become a local legend before lunchtime", "could make a customer-service robot apologize",
  "would remain calmest during a deeply unnecessary emergency", "could convince a wedding they belong in the family photo", "would be promoted during their first five minutes", "could make the worst disguise somehow work", "would be the first person interviewed in the documentary about tonight",
] as const;
export const CROWD_CONTROL_PROMPTS: PromptEntry[] = CROWD_CONTROL_SCENARIOS.map((scenario, index) => ({
  id: `crowd-${index + 1}`, text: `Who here ${scenario}?`, contentMode: "family", category: "social-player", localeDependent: false, weight: 1, recentUseSuppression: 20,
}));

const ROOM_TOPICS = [
  "arrive early to a party", "read the terms and conditions", "talk to a stranger in an elevator", "keep a snack in the car", "name their houseplants",
  "pretend to understand a movie", "rehearse a phone call first", "sing while cooking", "check the menu before arriving", "use a paper calendar",
  "wave back even when the wave was not for them", "have more than twenty browser tabs open", "save the good box", "laugh at their own joke", "take the scenic route on purpose",
] as const;
const ROOM_FORMATS = [
  (topic: string) => `What percentage of this room would ${topic}?`,
  (topic: string) => `Out of ten people here, how many secretly ${topic}?`,
  (topic: string) => `How common is it in this room to ${topic}?`,
  (topic: string) => `Predict the room: who would most likely ${topic}?`,
  (topic: string) => `How many players would admit they ${topic}?`,
] as const;
export const READ_THE_ROOM_PROMPTS: PromptEntry[] = ROOM_TOPICS.flatMap((topic, topicIndex) =>
  ROOM_FORMATS.map((format, formatIndex) => ({ id: `room-${String(topicIndex + 1).padStart(2, "0")}-${formatIndex + 1}`, text: format(topic), contentMode: "family", category: "room-read", localeDependent: false, weight: 1, recentUseSuppression: 20 })),
);

const FINALE_THEMES = ["an awards speech", "the trailer for tonight", "a warning from the future", "the group's official motto", "a message found in a time capsule", "the final line of a documentary", "a plaque in the room's museum", "the title of everyone's shared memoir"] as const;
const FINALE_FORMATS = [
  (theme: string) => `Write ${theme} using the most unforgettable detail from tonight.`,
  (theme: string) => `Turn one earlier answer into ${theme}.`,
  (theme: string) => `Complete ${theme}: “We should have known when…”`,
  (theme: string) => `Create ${theme} that only this room would understand.`,
  (theme: string) => `Make ${theme} in 90 characters or fewer.`,
] as const;
export const FINALE_PROMPTS: PromptEntry[] = FINALE_THEMES.flatMap((theme, themeIndex) =>
  FINALE_FORMATS.map((format, formatIndex) => ({ id: `final-${themeIndex + 1}-${formatIndex + 1}`, text: format(theme), contentMode: "family", category: "finale", localeDependent: false, weight: 1, recentUseSuppression: 40 })),
);

export interface CatchModifier { id: string; label: string; instruction: string; rule: CatchRule; validateMechanically: true }
export const CATCH_MODIFIERS: CatchModifier[] = [
  { id: "catch-01", label: "Three's Company", instruction: "Use exactly 3 words.", rule: { type: "exact_words", value: 3 }, validateMechanically: true },
  { id: "catch-02", label: "Five Alive", instruction: "Use exactly 5 words.", rule: { type: "exact_words", value: 5 }, validateMechanically: true },
  { id: "catch-03", label: "Seven Heaven", instruction: "Use exactly 7 words.", rule: { type: "exact_words", value: 7 }, validateMechanically: true },
  { id: "catch-04", label: "Tiny Answer", instruction: "Use no more than 4 words.", rule: { type: "max_words", value: 4 }, validateMechanically: true },
  { id: "catch-05", label: "Six or Fewer", instruction: "Use no more than 6 words.", rule: { type: "max_words", value: 6 }, validateMechanically: true },
  { id: "catch-06", label: "Questionable", instruction: "End with a question mark.", rule: { type: "ending", value: "?" }, validateMechanically: true },
  { id: "catch-07", label: "Excitable", instruction: "End with an exclamation mark.", rule: { type: "ending", value: "!" }, validateMechanically: true },
  { id: "catch-08", label: "Banana Clause", instruction: "Include the word banana.", rule: { type: "required_word", value: "banana" }, validateMechanically: true },
  { id: "catch-09", label: "Actually", instruction: "Include the word actually.", rule: { type: "required_word", value: "actually" }, validateMechanically: true },
  { id: "catch-10", label: "Meanwhile", instruction: "Include the word meanwhile.", rule: { type: "required_word", value: "meanwhile" }, validateMechanically: true },
  { id: "catch-11", label: "Name Drop", instruction: "Include a capitalized name.", rule: { type: "required_name" }, validateMechanically: true },
  { id: "catch-12", label: "A-List", instruction: "Start with the letter A.", rule: { type: "starting_letter", value: "A" }, validateMechanically: true },
  { id: "catch-13", label: "Best Foot", instruction: "Start with the letter B.", rule: { type: "starting_letter", value: "B" }, validateMechanically: true },
  { id: "catch-14", label: "Sure Thing", instruction: "Start with the letter S.", rule: { type: "starting_letter", value: "S" }, validateMechanically: true },
  { id: "catch-15", label: "No E", instruction: "Do not use the letter E.", rule: { type: "forbidden_letter", value: "e" }, validateMechanically: true },
  { id: "catch-16", label: "No A", instruction: "Do not use the letter A.", rule: { type: "forbidden_letter", value: "a" }, validateMechanically: true },
  { id: "catch-17", label: "No S", instruction: "Do not use the letter S.", rule: { type: "forbidden_letter", value: "s" }, validateMechanically: true },
  { id: "catch-18", label: "Eight Is Enough", instruction: "Use exactly 8 words.", rule: { type: "exact_words", value: 8 }, validateMechanically: true },
  { id: "catch-19", label: "Just Two", instruction: "Use exactly 2 words.", rule: { type: "exact_words", value: 2 }, validateMechanically: true },
  { id: "catch-20", label: "Keep It Brief", instruction: "Use no more than 9 words.", rule: { type: "max_words", value: 9 }, validateMechanically: true },
];

const CALLBACK_FORMS = [
  (thing: string) => `Bring back {{lore}} as ${thing}.`, (thing: string) => `Rewrite {{lore}} like ${thing}.`,
  (thing: string) => `The sequel to {{lore}} is ${thing}. Name it.`, (thing: string) => `Turn {{lore}} into ${thing} nobody can ignore.`,
  (thing: string) => `Explain why {{lore}} caused ${thing}.`, (thing: string) => `Pitch {{lore}} to someone who only understands ${thing}.`,
  (thing: string) => `Give {{lore}} the tagline of ${thing}.`, (thing: string) => `The headline connecting {{lore}} and ${thing}:`,
  (thing: string) => `Make {{lore}} the surprise villain in ${thing}.`, (thing: string) => `What warning would ${thing} give us about {{lore}}?`,
] as const;
const CALLBACK_THINGS = ["a prestige documentary", "an overconfident startup", "a neighborhood festival", "a forbidden board game", "a very serious museum"] as const;
export const CALLBACK_DIRECTIONS: PromptEntry[] = CALLBACK_FORMS.flatMap((format, formatIndex) => CALLBACK_THINGS.map((thing, thingIndex) => ({ id: `callback-${formatIndex + 1}-${thingIndex + 1}`, text: format(thing), contentMode: "family", category: "callback", localeDependent: false, weight: 1, recentUseSuppression: 50 })));

export const MONSTER_COMPONENTS = ["head shape", "eyes", "mouth", "body", "arms", "legs", "texture", "accessory", "power", "tiny companion"] as const;
export const MONSTER_FOLLOWUPS = ["What does it demand as tribute?", "What is its extremely inconvenient power?", "What makes it cry?", "What is it banned from doing at the mall?", "What does it keep in its tiny purse?"] as const;

export function pickPrompt(kind: RoundKind, seed: string, contentMode: ContentMode, usedIds: readonly string[]): PromptEntry {
  const source = kind === "THE_SEED" ? SEED_PROMPTS
    : kind === "READ_THE_ROOM" ? READ_THE_ROOM_PROMPTS
    : kind === "THE_CATCH" ? WORLD_PROMPTS
    : kind === "CROWD_CONTROL" ? CROWD_CONTROL_PROMPTS
    : kind === "FINAL_READ" || kind === "THE_REMIX" ? FINALE_PROMPTS
    : kind === "CALLBACK" ? CALLBACK_DIRECTIONS
    : OPEN_PROMPTS;
  const allowed = source.filter((entry) => contentMode === "party" || entry.contentMode === "family");
  return new PromptDeck(allowed).draw({ seed: `${seed}:${kind}`, usedIds });
}
