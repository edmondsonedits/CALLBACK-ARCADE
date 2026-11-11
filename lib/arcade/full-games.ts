import {BUNDLED_ARCADE_GAMES} from "./arena-games";
import { isArchivedArcadeGame } from "./archived-games";
export type FullArcadeGame = Readonly<{
  practiceId: string;
  id: string;
  title: string;
  version: string;
  href: string;
  maxContestants: number;
  phoneRooms?: boolean;
  maps: readonly { id: string; title: string; skill: string }[];
}>;

const definedFullArcadeGames: readonly FullArcadeGame[] = [
{
  "practiceId": "sumo",
  "id": "royal-sumo",
  "title": "Royal Sumo \u2014 Crownfall",
  "version": "1.3.0",
  "href": "/arcade-games/royal-sumo/index.html",
  "maxContestants": 10,
  "phoneRooms": true,
  "maps": [
    {
      "id": "keep",
      "title": "Crownfall Keep",
      "skill": "Read the shrinking ring."
    },
    {
      "id": "floe",
      "title": "Frostbite Floe",
      "skill": "Brake on ice."
    },
    {
      "id": "plaza",
      "title": "Pinball Plaza",
      "skill": "Bank rivals off bumpers."
    },
    {
      "id": "wharf",
      "title": "Windmill Wharf",
      "skill": "Dash under sweepers."
    },
    {
      "id": "teeter",
      "title": "Teeter Temple",
      "skill": "Manage a tilting floor."
    },
    {
      "id": "mesa",
      "title": "Meteor Mesa",
      "skill": "Dodge warned impacts."
    }
  ]
},
{
  "practiceId": "sky-balls",
  "id": "royal-ballistix",
  "title": "Royal Ballistix \u2014 Beach Siege",
  "version": "0.14.0",
  "href": "/arcade-games/royal-ballistix/index.html",
  "maxContestants": 10,
  "phoneRooms": true,
  "maps": [
    {
      "id": "beach",
      "title": "Beach Siege",
      "skill": "Magnet and Pulse timing."
    },
    {
      "id": "gale",
      "title": "Gale Harbour",
      "skill": "Compensate for gusts."
    },
    {
      "id": "moon",
      "title": "Moonwell",
      "skill": "Read vortex trajectories."
    },
    {
      "id": "clockwork",
      "title": "Clockwork Keep",
      "skill": "Time moving deflectors."
    }
  ]
},
{
  "practiceId": "scratch-match",
  "id": "royal-scratch-match",
  "title": "Royal Scratch Match",
  "version": "0.7.0",
  "href": "/arcade-games/royal-scratch-match/index.html",
  "maxContestants": 10,
  "phoneRooms": true,
  "maps": [
    {
      "id": "royal",
      "title": "Royal Hall",
      "skill": "Repeat the rhythm."
    },
    {
      "id": "tide",
      "title": "Tide Pavilion",
      "skill": "Learn swing timing."
    },
    {
      "id": "foundry",
      "title": "Clockwork Foundry",
      "skill": "Play offbeat chords."
    },
    {
      "id": "mirror",
      "title": "Mirror Ballroom",
      "skill": "Read mirrored lanes."
    }
  ]
},
{
  "practiceId": "roller-ruckus",
  "id": "royal-roller-ruckus",
  "title": "Royal Roller Ruckus \u2014 Crownway Circuit",
  "version": "1.6.0",
  "href": "/arcade-games/royal-roller-ruckus/index.html",
  "maxContestants": 10,
  "phoneRooms": true,
  "maps": [
    {
      "id": "crownway",
      "title": "Crownway",
      "skill": "Learn the racing line."
    },
    {
      "id": "frostglass",
      "title": "Frostglass",
      "skill": "Control ice traction."
    },
    {
      "id": "foundry",
      "title": "Foundry",
      "skill": "Time steam hazards."
    },
    {
      "id": "skygarden",
      "title": "Skygarden",
      "skill": "Use gusts and boosts."
    }
  ]
},
{
  "practiceId": "twisted-system",
  "id": "royal-twisted",
  "title": "Royal Twisted \u2014 Four Towers",
  "version": "0.7.0",
  "href": "/arcade-games/royal-twisted/index.html",
  "maxContestants": 10,
  "phoneRooms": true,
  "maps": [
    {
      "id": "spiral",
      "title": "Spiral Keep",
      "skill": "Jump and duck rods."
    },
    {
      "id": "ember",
      "title": "Ember Forge",
      "skill": "Read heat cadence."
    },
    {
      "id": "frost",
      "title": "Frost Spire",
      "skill": "Duck to recover grip."
    },
    {
      "id": "storm",
      "title": "Stormwatch",
      "skill": "Brace against warned gusts."
    }
  ]
},
{
  "practiceId": "space-bash",
  "id": "space-bash",
  "title": "Space Bash \u2014 Four Decks",
  "version": "1.15.0",
  "href": "/arcade-games/space-bash/index.html",
  "maxContestants": 10,
  "phoneRooms": true,
  "maps": [
    {
      "id": "orbital",
      "title": "Orbital",
      "skill": "Fight with cargo."
    },
    {
      "id": "cryo",
      "title": "Cryo",
      "skill": "Cross ice and grip lanes."
    },
    {
      "id": "reactor",
      "title": "Reactor",
      "skill": "Jump warned blast lanes."
    },
    {
      "id": "garden",
      "title": "Gravity Garden",
      "skill": "Learn changing gravity."
    }
  ]
},
{
  "practiceId": "blind-crown",
  "id": "blind-crown",
  "title": "Blind Crown \u2014 Nightfall",
  "version": "1.7.0",
  "href": "/arcade-games/blind-crown/index.html",
  "maxContestants": 10,
  "phoneRooms": true,
  "maps": [
    {
      "id": "citadel",
      "title": "Royal Citadel",
      "skill": "Predict open corner lanes."
    },
    {
      "id": "orchard",
      "title": "Moonlit Orchard",
      "skill": "Shoot through hedges."
    },
    {
      "id": "glacier",
      "title": "Frost Keep",
      "skill": "Learn bank shots."
    },
    {
      "id": "clockwork",
      "title": "Clockwork Court",
      "skill": "Read alternating shutters."
    }
  ]
},
...BUNDLED_ARCADE_GAMES,
];

export const FULL_ARCADE_GAMES: readonly FullArcadeGame[] = definedFullArcadeGames;
export const ACTIVE_FULL_ARCADE_GAMES = FULL_ARCADE_GAMES.filter(game => !isArchivedArcadeGame(game.practiceId) && !isArchivedArcadeGame(game.id));

export function getFullArcadeGame(practiceId: string): FullArcadeGame | null {
  return FULL_ARCADE_GAMES.find(game => game.practiceId === practiceId) ?? null;
}

export function isFullArcadeFrame(pathname: string): boolean {
  return FULL_ARCADE_GAMES.some(game => game.href === pathname);
}
