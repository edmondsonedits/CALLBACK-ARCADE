import { deterministicShuffle } from "../game/random";

export interface KingRequest {
  id: string;
  text: string;
  category: string;
}

const REQUEST_GROUPS: Record<string, readonly string[]> = {
  family: [
    "A portrait of the King’s mysterious childhood pet",
    "The worst royal family portrait ever painted",
    "The King’s favourite relative, Aunt Hilda",
    "The ancestor nobody in the royal family discusses",
    "The King’s official portrait for meeting new friends",
    "A painting proving the King was once adorable",
    "The royal family’s least successful holiday",
    "The cousin who was accidentally made a knight",
    "The King’s most embarrassing childhood memory",
    "A completely normal royal family dinner",
  ],
  history: [
    "The King’s most heroic moment—which definitely happened",
    "The battle the King claims he won alone",
    "The moment the King supposedly invented fire",
    "The King bravely saving the kingdom from something harmless",
    "A memorable event missing from every history book",
    "The day the King discovered the moon",
    "The kingdom’s least convincing military victory",
    "The King accepting an award he did not earn",
    "The royal expedition that travelled almost nowhere",
    "The heroic rescue everyone remembers differently",
  ],
  creatures: [
    "The cutest bunny in the entire kingdom",
    "The castle’s least qualified guard animal",
    "A dragon attending its first royal ceremony",
    "The creature secretly living beneath the throne",
    "The King’s new emotional-support monster",
    "A royal horse with an unusual second job",
    "The pigeon the King wrongly believes is magical",
    "The kingdom’s champion snail",
    "A monster trying very hard to look friendly",
    "The animal responsible for the castle’s missing food",
  ],
  celebrations: [
    "A medieval celebration going terribly wrong",
    "The royal wedding’s most memorable moment",
    "The King’s birthday surprise arriving too early",
    "The kingdom’s first and last cooking competition",
    "A completely safe royal parade",
    "The castle’s most confusing holiday tradition",
    "A royal feast nobody was prepared to attend",
    "The moment the wedding cake fought back",
    "The kingdom’s smallest but loudest festival",
    "A surprise party for someone who hates surprises",
  ],
  inventions: [
    "The newest and least practical invention in the kingdom",
    "The castle’s exciting new transportation system",
    "The King’s solution to a problem nobody had",
    "A royal machine with one obvious design flaw",
    "The kingdom’s wildly over-budget tourist attraction",
    "The first household appliance powered by dragons",
    "A device designed to make mornings more complicated",
    "The King’s machine for avoiding difficult conversations",
    "A royal invention held together entirely with rope",
    "The castle’s new automatic dinner delivery system",
  ],
  gallery: [
    "A peaceful landscape worthy of the royal gallery",
    "The kingdom’s idea of perfect natural beauty",
    "A masterpiece that makes the King look sophisticated",
    "The painting the King wants above his bathtub",
    "A tasteful mural for the castle dungeon",
    "The most relaxing place in the kingdom",
    "A beautiful sunset with one alarming detail",
    "A serious painting about something completely silly",
    "The King’s attempt at a calming self-portrait",
    "A work of art nobody understands but everyone praises",
  ],
  jobs: [
    "The least qualified person working in the castle",
    "A knight having a difficult first day",
    "The royal chef’s greatest kitchen disaster",
    "A wizard working an ordinary office job",
    "The castle guard’s unusual lunch break",
    "The royal barber trying a dangerous new technique",
    "A jester performing for the world’s toughest audience",
    "The kingdom’s most suspicious travelling salesperson",
    "A blacksmith taking an extremely strange custom order",
    "The royal gardener losing control of the garden",
  ],
  places: [
    "The strangest room hidden inside the castle",
    "The kingdom’s least relaxing vacation destination",
    "A secret passage leading somewhere disappointing",
    "The castle’s badly designed emergency exit",
    "The most dangerous shop in the village",
    "A dungeon attempting to improve its customer service",
    "The tiny kingdom located behind the castle pantry",
    "A suspicious roadside attraction outside the castle",
    "The royal bathroom after an expensive renovation",
    "The village attraction every tourist regrets visiting",
  ],
  food: [
    "The King’s most ambitious midnight snack",
    "A royal meal that refuses to be eaten",
    "The kingdom’s newest and worst restaurant",
    "A cake built to impress visiting royalty",
    "The castle kitchen during an impossible dinner rush",
    "The royal chef revealing tonight’s mystery soup",
    "A feast prepared by someone who has never seen food",
    "The most suspicious pie in the kingdom",
    "The King’s attempt to eat a healthy breakfast",
    "A tiny snack served with unnecessary ceremony",
  ],
  publicWorks: [
    "The King unveiling his latest public improvement",
    "A bridge designed by the royal art department",
    "The kingdom’s new and confusing traffic system",
    "A monument celebrating a very minor achievement",
    "The castle renovation everyone immediately regrets",
    "The world’s least useful defensive wall",
    "A royal fountain with one unexpected feature",
    "The kingdom’s first public swimming puddle",
    "A town square designed entirely around pigeons",
    "The grand opening of a road that leads nowhere",
  ],
  mysteries: [
    "The real reason the castle treasury is empty",
    "What the King keeps inside his secret box",
    "The suspicious noise coming from behind the throne",
    "The culprit behind the kingdom’s missing socks",
    "The royal detective’s least convincing discovery",
    "What actually happens inside the forbidden tower",
    "The castle ghost caught during its day off",
    "The mysterious object found in the royal soup",
    "The secret meeting nobody remembered to keep secret",
    "The crime scene left by an extremely polite thief",
  ],
  future: [
    "The kingdom one thousand years in the future",
    "The King’s completely inaccurate vision of tomorrow",
    "The castle’s first visitor from outer space",
    "A robot attempting to become a medieval knight",
    "The future of royal transportation",
    "The kingdom’s first holiday on the moon",
    "A time traveller giving the King terrible advice",
    "The royal family portrait from the distant future",
    "The invention that finally replaces the castle pigeon",
    "The moment the kingdom discovers the internet",
  ],
};

export const KING_REQUESTS: KingRequest[] = Object.entries(REQUEST_GROUPS).flatMap(([category, requests]) => requests.map((text, index) => ({
  id: `king-${category}-${String(index + 1).padStart(2, "0")}`,
  text,
  category,
})));

export function kingRequestById(id: string | null | undefined): KingRequest | null {
  return KING_REQUESTS.find((request) => request.id === id) ?? null;
}

export function drawKingRequests(seed: string, usedIds: readonly string[], count: number): KingRequest[] {
  const recent = new Set(usedIds.slice(-24));
  const fresh = KING_REQUESTS.filter((request) => !recent.has(request.id));
  const pool = fresh.length >= count ? fresh : KING_REQUESTS;
  const shuffled = deterministicShuffle(pool, seed);
  const selected: KingRequest[] = [];
  for (const request of shuffled) {
    if (selected.some((item) => item.category === request.category) && selected.length < Math.min(count, 3)) continue;
    selected.push(request);
    if (selected.length === count) break;
  }
  if (selected.length < count) for (const request of shuffled) {
    if (!selected.some((item) => item.id === request.id)) selected.push(request);
    if (selected.length === count) break;
  }
  return selected;
}

