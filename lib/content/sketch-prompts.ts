// Curated drawing ideas, researched 2026-10-30. Numbers are identifiers, not ratings.
// Provenance and selection limits: docs/sketch-sorcery-prompt-research.md.
export const SKETCH_PROMPT_SOURCES = {
  "review": {
    "title": "Mr. Panda — hands-on Drawful 2 review",
    "url": "https://mrpanda2002.wordpress.com/2018/06/21/drawful-2-review/",
    "evidence": "Reviewer quotes memorable concrete and abstract Drawful examples; no individual prompt ratings."
  },
  "drawful": {
    "title": "Jackbox — Drawful",
    "url": "https://www.jackboxgames.com/games/drawful",
    "evidence": "Official example; not a popularity ranking."
  },
  "director": {
    "title": "Jackbox — Q&A with Drawful: Animate director Spencer Ham",
    "url": "https://www.jackboxgames.com/blog/mini-qa-with-drawful-animate-game-director-spencer-ham",
    "evidence": "Director describes daily playtests and quotes a prompt; not an individual rating."
  },
  "format": {
    "title": "Storythings — Formats Unpacked: Drawful",
    "url": "https://formatsunpacked.storythings.com/p/formats-unpacked-drawful",
    "evidence": "Published format analysis with example prompts; not audience voting data."
  },
  "product": {
    "title": "Jason Shen — The Product Genius Behind Jackbox Games",
    "url": "https://www.jasonshen.com/the-product-genius-behind-jackbox-games/",
    "evidence": "Player/product analysis quoting examples; not prompt-level ratings."
  },
  "steam": {
    "title": "Drawful 2 — official Steam description",
    "url": "https://store.steampowered.com/app/442070/Drawful_2/",
    "evidence": "Official sample prompts. Overall game reviews do not rate these prompts individually."
  },
  "community": {
    "title": "Eagle Time — Drawful player screenshot thread",
    "url": "https://eagle-time.org/printthread.php?tid=1725",
    "evidence": "First-person play reports and favorite-drawing batches. Some remembered captions are uncertain; these are community-reported ideas, not verified official prompt text or ranked favorites."
  },
  "party": {
    "title": "OnlineParty.Games — Drawful-style party starter",
    "url": "https://onlineparty.games/games/jackbox-style/drawful-2",
    "evidence": "Author-published drawing suggestions; editorial list, not community ratings."
  },
  "host": {
    "title": "Lilach Bullock — Funny Gartic Phone Prompts",
    "url": "https://www.lilachbullock.com/funny-gartic-phone-prompts-for-game-night/",
    "evidence": "Host reports playing team sessions and offers ideas; no individual prompt votes."
  },
  "wikihow": {
    "title": "wikiHow — Funny, Quirky and Weird Gartic Phone Prompts",
    "url": "https://www.wikihow.com/Gartic-Phone-Prompts",
    "evidence": "Edited drawing-game suggestion list. Adapted for a shared-prompt still drawing; not Drawful ratings."
  },
  "hugateen": {
    "title": "HugATeen — Gartic Phone Game: Funny Sentences, Phrases and Prompts",
    "url": "https://hugateen.com/activities/games/gartic-phone-game/",
    "evidence": "Published drawing-game idea collection. Adaptations are editorial choices, not verified player favorites."
  }
} as const;

const rows = [
  ["Coffin full of donuts","food","review","published"],
  ["Glass pants","objects","review","published"],
  ["Really long receipt","everyday","review","published"],
  ["Brain overload","surreal","review","published"],
  ["Unlucky in love","awkward","review","published"],
  ["Napoleon riding a squirrel","familiar-faces","drawful","published"],
  ["Three raccoons leaving a broom closet","animals","director","published"],
  ["Possum milk","food","format","published"],
  ["I eat triangles","surreal","format","published"],
  ["Milkshakes from the milkshake tree","food","product","published"],
  ["Low-speed chase","everyday","product","published"],
  ["Creepy tiger","animals","steam","published"],
  ["Two moms having a great day","awkward","steam","published"],
  ["Dinosaurs kissing","animals","community","published"],
  ["Gravy bath","food","community","published"],
  ["Bacon bomb","food","community","published"],
  ["Eggs for eyes","surreal","community","published"],
  ["Sewer party","surreal","community","published"],
  ["Box of nothing","objects","community","published"],
  ["Cheese shirt","objects","community","published"],
  ["Birthday card with an attitude","awkward","party","adapted"],
  ["A very personal rain cloud","surreal","party","adapted"],
  ["Chair rage","objects","party","adapted"],
  ["Haunted snack machine","creepy","party","adapted"],
  ["Mayor Traffic Cone","objects","party","adapted"],
  ["A sandwich in middle management","food","party","adapted"],
  ["Sunburnt snowman","everyday","party","adapted"],
  ["Spaghetti-beard wizard","creepy","party","adapted"],
  ["Moon calling in sick","space","party","published"],
  ["Ballet bicycle","objects","party","adapted"],
  ["Clouds arguing over rain","surreal","party","adapted"],
  ["Fridge midlife crisis","everyday","host","adapted"],
  ["Printer repair with a hammer","everyday","host","adapted"],
  ["Grandma's getaway car","awkward","host","adapted"],
  ["Dinosaur tax return","animals","host","adapted"],
  ["Penguin job interview","animals","host","adapted"],
  ["Reply-all catastrophe","everyday","host","adapted"],
  ["A kettle on strike","objects","host","adapted"],
  ["Underperforming houseplant","objects","host","adapted"],
  ["An undercover shopping cart","objects","host","adapted"],
  ["Moon howling at a wolf","space","wikihow","adapted"],
  ["Toast's final moments","food","wikihow","adapted"],
  ["Balloon afraid of heights","objects","wikihow","adapted"],
  ["Donut identity crisis","food","wikihow","adapted"],
  ["Witch riding a Zamboni","creepy","wikihow","adapted"],
  ["World's biggest sneeze","awkward","wikihow","adapted"],
  ["Spoons instead of tentacles","animals","wikihow","adapted"],
  ["Adorable giant squid","animals","wikihow","adapted"],
  ["Chicken with a lizard baby","animals","wikihow","adapted"],
  ["Forks at a nightclub","objects","wikihow","adapted"],
  ["Sprinkle raincloud","food","wikihow","adapted"],
  ["Batman's therapy session","familiar-faces","wikihow","adapted"],
  ["President Pikachu","familiar-faces","wikihow","adapted"],
  ["Dracula discovers fast food","creepy","wikihow","adapted"],
  ["Pig in a duvet","animals","wikihow","adapted"],
  ["Winged hot dog","food","wikihow","adapted"],
  ["Potato tears","food","wikihow","adapted"],
  ["T. rex's dentist appointment","animals","wikihow","adapted"],
  ["Giraffe with corgi legs","animals","wikihow","adapted"],
  ["A literal cat burglar","animals","wikihow","adapted"],
  ["Spider-Man versus Spider-Pig","familiar-faces","wikihow","adapted"],
  ["Mothman checkmates Bigfoot","creepy","wikihow","adapted"],
  ["Dinosaur garden tea party","animals","wikihow","adapted"],
  ["Godzilla's afternoon nap","familiar-faces","wikihow","adapted"],
  ["Vampire juice cleanse","creepy","wikihow","adapted"],
  ["Waluigi's Mona Lisa portrait","familiar-faces","wikihow","adapted"],
  ["Moth kissing a streetlamp","animals","wikihow","adapted"],
  ["Poop emoji beauty queen","familiar-faces","wikihow","adapted"],
  ["Flirtatious cactus","awkward","wikihow","adapted"],
  ["Rainbow-breathing unicorn","creepy","wikihow","adapted"],
  ["Giraffe in a phone booth","animals","hugateen","adapted"],
  ["Eight-armed pie disaster","food","hugateen","adapted"],
  ["Jet-powered snail race","animals","hugateen","adapted"],
  ["Aliens assembling flat-pack furniture","space","hugateen","adapted"],
  ["Motivational potato","food","hugateen","adapted"],
  ["Bigfoot's mirror selfie","creepy","hugateen","adapted"],
  ["Basketball on the moon","space","hugateen","adapted"],
  ["Mermaid at the DJ booth","creepy","hugateen","adapted"],
  ["A knitting robot","objects","hugateen","adapted"],
  ["Saxophone walrus","animals","hugateen","adapted"],
  ["Hedgehog on roller skates","animals","hugateen","adapted"],
  ["Wolf at grandma fashion week","animals","hugateen","adapted"],
  ["Bread protesting the toaster","food","hugateen","adapted"],
  ["An umbrella-carrying mushroom","objects","hugateen","adapted"],
  ["A ghost trapped in bubblegum","creepy","hugateen","adapted"],
  ["Spaghetti scaling Meatball Mountain","food","hugateen","adapted"],
  ["Alien teaching Human Studies","space","hugateen","adapted"],
  ["Pajamas for a giant spider","animals","hugateen","adapted"],
  ["Paper plane in a book tornado","objects","hugateen","adapted"],
  ["Confused self-tying shoe","objects","hugateen","adapted"],
  ["A backpacking refrigerator","objects","hugateen","adapted"],
  ["Planetary hopscotch","space","hugateen","adapted"],
  ["A rainbow sneezing colors","surreal","hugateen","adapted"],
  ["Houseplant escaping the windowsill","objects","hugateen","adapted"],
  ["Bathtub duck parade","animals","hugateen","adapted"],
  ["A pencil drawing itself","objects","hugateen","adapted"],
  ["Karate egg","food","hugateen","adapted"],
  ["Cookie detective","food","hugateen","adapted"],
  ["A fan cheering for the team","objects","hugateen","adapted"],
  ["A hat dreaming of space","space","hugateen","adapted"]
] as const;

export const SKETCH_PROMPT_CATALOGUE = rows.map(([text, category, sourceId, kind], index) => ({
  id: `sketch-prompt-${String(index + 1).padStart(3, "0")}`, text, category, sourceId, kind,
}));
