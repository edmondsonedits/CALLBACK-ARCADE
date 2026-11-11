import { stableHash } from "../game/random";

export interface ComicTheme {
  id: string;
  title: string;
  setup: string;
}

export const COMIC_THEMES: ComicTheme[] = [
  { id: "office-wizard", title: "The Office Wizard", setup: "A wizard starts a painfully ordinary office job." },
  { id: "alien-roommate", title: "Alien Roommate", setup: "An alien tries much too hard to be a normal roommate." },
  { id: "haunted-cafe", title: "Haunted Café", setup: "A cheerful café has one extremely inconvenient ghost." },
  { id: "villain-parent", title: "Supervillain Parent", setup: "A supervillain must handle a very ordinary parenting problem." },
  { id: "time-travel-date", title: "Time-Travel Date", setup: "A first date keeps being interrupted by visitors from the future." },
  { id: "dragon-condo", title: "Dragon in the Condo", setup: "A dragon discovers the petty rules of condo living." },
  { id: "robot-therapy", title: "Robot Therapy", setup: "A robot attempts to discuss feelings using terrible data." },
  { id: "pirate-school", title: "Pirate Substitute Teacher", setup: "A pirate substitutes for the calmest class in school." },
  { id: "moon-diner", title: "Diner on the Moon", setup: "A tiny moon diner gets its strangest customer yet." },
  { id: "monster-wedding", title: "Monster Wedding", setup: "Two monsters plan a tasteful wedding despite their families." },
  { id: "detective-pigeon", title: "Pigeon Detective", setup: "A hard-boiled pigeon investigates a ridiculous neighborhood crime." },
  { id: "knight-tech", title: "Knight at Tech Support", setup: "A medieval knight calls modern technical support." },
  { id: "zombie-neighbor", title: "The Polite Zombie", setup: "A zombie tries to be the neighborhood's most considerate resident." },
  { id: "cat-mayor", title: "Cat Mayor", setup: "A cat becomes mayor and immediately faces a civic emergency." },
  { id: "tiny-kaiju", title: "Pocket-Sized Kaiju", setup: "A tiny city-smashing monster is treated like a difficult pet." },
  { id: "museum-night", title: "Museum Night Shift", setup: "The exhibits come alive for one exhausted security guard." },
  { id: "future-grandma", title: "Grandma From the Future", setup: "A futuristic grandma arrives with extremely specific warnings." },
  { id: "vampire-dentist", title: "Vampire Dentist", setup: "A vampire opens a dental practice with obvious workplace challenges." },
  { id: "genie-budget", title: "Budget Genie", setup: "A discount genie grants wishes with aggressive cost-cutting." },
  { id: "cowboy-space", title: "Space Cowboy", setup: "A cowboy tries to enforce frontier rules aboard a spaceship." },
  { id: "mermaid-hr", title: "Mermaid in Human Resources", setup: "A mermaid handles a painfully dry workplace complaint." },
  { id: "ghost-realtor", title: "Ghost Realtor", setup: "A ghost tries to sell a haunted house without mentioning itself." },
  { id: "dinosaur-chef", title: "Dinosaur Fine Dining", setup: "A dinosaur opens an elegant restaurant with very small utensils." },
  { id: "witch-airport", title: "Witch at Airport Security", setup: "A witch must explain twelve suspicious carry-on potions." },
  { id: "hamster-ceo", title: "Hamster CEO", setup: "A hamster runs a giant corporation from a very tiny desk." },
  { id: "yeti-influencer", title: "Yeti Influencer", setup: "A shy yeti accidentally becomes the internet's loudest celebrity." },
  { id: "frog-court", title: "Frog Supreme Court", setup: "A frog presides over the most important puddle dispute in history." },
  { id: "mummy-vacation", title: "Mummy on Vacation", setup: "An ancient mummy attempts to relax at an aggressively cheerful resort." },
  { id: "oracle-support", title: "Oracle Customer Support", setup: "An all-knowing oracle is forbidden from giving direct answers." },
  { id: "penguin-lawyer", title: "Penguin Lawyer", setup: "A penguin arrives in court with a briefcase full of fish." },
  { id: "fairy-contractor", title: "Fairy Contractor", setup: "A fairy renovates a castle using wishes and extremely vague measurements." },
  { id: "octopus-band", title: "Octopus Garage Band", setup: "An octopus forms a band and immediately becomes impossible to manage." },
];

export function comicTheme(seed: string, rotation = 0): ComicTheme {
  return COMIC_THEMES[(stableHash(seed) + rotation) % COMIC_THEMES.length];
}

export function comicPrompt(frameNumber: 1 | 2 | 3, theme: ComicTheme, priorPrompts: string[]): { prompt: string; instruction: string } {
  if (frameNumber === 1) return {
    prompt: `Create the star of ${theme.title}.`,
    instruction: `What do they look like? Under 20 words. Name one character and one strong visual detail. Premise: ${theme.setup}`,
  };
  if (frameNumber === 2) return {
    prompt: "Give them a new problem.",
    instruction: `Under 20 words. Add one object or character that makes the scene worse.${priorPrompts.length ? " Build on the panel above." : ""}`,
  };
  return {
    prompt: "Show the punchline.",
    instruction: `Under 20 words. Finish with one clear visual twist.${priorPrompts.length ? " Build on the panels above." : ""}`,
  };
}

export const COMIC_BOT_PROMPTS: Record<1 | 2 | 3, string[]> = {
  1: [
    "A nervous wizard clocks in while the copier breathes fire",
    "An alien hides three arms during a tense roommate meeting",
    "A tired detective pigeon examines one suspicious french fry",
    "A tiny dragon reads the condo rulebook in disbelief",
    "A robot arrives at therapy carrying a printer receipt",
  ],
  2: [
    "The copier demands a promotion as sprinklers flood the office",
    "The landlord arrives while every hidden alien arm starts waving",
    "Every pigeon claims the french fry and produces an alibi",
    "The condo board measures the dragon's smoke with tiny rulers",
    "The therapist discovers the receipt is six miles of feelings",
  ],
  3: [
    "The wizard fixes everything by turning the office into a dungeon",
    "The landlord reveals four arms and raises the rent anyway",
    "The french fry arrests the detective for excessive seasoning",
    "The dragon fines the condo board for unauthorized knight storage",
    "The robot prints one final feeling: please replace therapist",
  ],
};
