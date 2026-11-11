// Preserves the v65 server simulation/view/map contract alongside newer featured worlds.
import {BUNDLED_ARCADE_GAMES} from "../arena-games";
export type FullArcadeGame = Readonly<{
  practiceId: string;
  id: string;
  title: string;
  version: string;
  href: string;
  maxContestants: number;
  maps: readonly { id: string; title: string; skill: string }[];
}>;

const definedFullArcadeGames: readonly FullArcadeGame[] = [
  {
    practiceId: "sumo", id: "royal-sumo", title: "Royal Sumo · Crownfall", version: "1.3.0",
    href: "/arcade-games/royal-sumo/online-v65.html", maxContestants: 10,
    maps: [
      { id: "keep", title: "Crownfall Keep", skill: "Read collapsing-ring warnings and defend the centre." },
      { id: "floe", title: "Frostbite Floe", skill: "Brake early on ice and avoid cracking shards." },
      { id: "plaza", title: "Pinball Plaza", skill: "Bank rivals off bumpers and through drifting gates." },
      { id: "wharf", title: "Windmill Wharf", skill: "Fight for the centre and Dash under sweeper arms." },
      { id: "teeter", title: "Teeter Temple", skill: "Manage weight on the tilting floor." },
      { id: "mesa", title: "Meteor Mesa", skill: "Dodge marked impacts and bait rivals into craters." },
    ],
  },
  {
    practiceId: "space-bash", id: "space-bash", title: "Space Bash · Orbital Breakout", version: "1.14.0-sites",
    href: "/arcade-games/space-bash/online-v65.html", maxContestants: 10,
    maps: [
      { id: "orbital", title: "Orbital Breakfloor", skill: "Throw explosives to cut routes through the deck." },
      { id: "gravity", title: "Low-G Dock", skill: "Plan longer jumps and floating throwing arcs." },
      { id: "ion", title: "Ion Ice Station", skill: "Brake before holes on a slippery deck." },
      { id: "meteor", title: "Meteor Crossing", skill: "Read red impact warnings before tiles disappear." },
    ],
  },
  {
    practiceId: "twisted-system", id: "royal-twisted", title: "Royal Twisted · Spiral Keep", version: "0.6.0-sites",
    href: "/arcade-games/royal-twisted/online-v65.html", maxContestants: 10,
    maps: [
      { id: "spiral", title: "Spiral Keep", skill: "Read jump and duck rods as the tower accelerates." },
      { id: "frost", title: "Frost Spire", skill: "Time longer low-gravity jumps before high rods." },
      { id: "clockwork", title: "Clockwork Belfry", skill: "Learn a repeating duck–jump–duck cadence." },
      { id: "foundry", title: "Ember Foundry", skill: "Hold paired ducks, then jump with longer hit recovery." },
    ],
  },
  {
    practiceId: "roller-ruckus", id: "royal-roller-ruckus", title: "Roller Ruckus · Crownway Circuit", version: "1.5.0-sites",
    href: "/arcade-games/royal-roller-ruckus/online-v65.html", maxContestants: 10,
    maps: [
      { id: "crownway", title: "Vertical Crownway", skill: "Read elevation, crossover and edge boost lanes." },
      { id: "clockwork", title: "Clockwork Circuit", skill: "Hold clean apexes through broad sweepers." },
      { id: "glacier", title: "Glacier Run", skill: "Brake early and manage low-grip momentum." },
    ],
  },
  {
    practiceId: "scratch-match", id: "royal-scratch-match", title: "Royal Scratch Match", version: "0.6.0-sites",
    href: "/arcade-games/royal-scratch-match/online-v65.html", maxContestants: 10,
    maps: [
      { id: "moonlit", title: "Moonlit Court", skill: "Repeat phrases with clean timing." },
      { id: "echo", title: "Echo Garden", skill: "Group longer phrases to remember them." },
      { id: "tempest", title: "Tempest Stage", skill: "Anticipate a steeper tempo ramp." },
      { id: "crystal", title: "Crystal Hall", skill: "Hit simultaneous two-rune chords." },
    ],
  },
  {
    practiceId: "sky-balls", id: "royal-ballistix", title: "Royal Ballistix · Beach Siege", version: "0.13.0-sites",
    href: "/arcade-games/royal-ballistix/online-v65.html", maxContestants: 10,
    maps: [
      { id: "beach", title: "Beach Siege", skill: "Time perfect Pulse and controlled Magnet volleys." },
      { id: "bumpers", title: "Coral Pinball", skill: "Re-read bank shots after reef-bumper bounces." },
      { id: "current", title: "Whirlpool Cove", skill: "Lead your paddle against curved ball trajectories." },
    ],
  },
  ...BUNDLED_ARCADE_GAMES,
];

export const FULL_ARCADE_GAMES: readonly FullArcadeGame[] = definedFullArcadeGames;

export function getFullArcadeGame(practiceId: string): FullArcadeGame | null {
  return FULL_ARCADE_GAMES.find(game => game.practiceId === practiceId) ?? null;
}

export function isFullArcadeFrame(pathname: string): boolean {
  return FULL_ARCADE_GAMES.some(game => game.href === pathname);
}
