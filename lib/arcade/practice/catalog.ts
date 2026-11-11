import type { PracticeControl, PracticeGameDefinition, PracticeGameId, PracticeGameModule } from "./types";
import { isArchivedArcadeGame } from "../archived-games";

type Loader = () => Promise<PracticeGameModule<unknown>>;
const load = async (loader: () => Promise<{ default: unknown }>): Promise<PracticeGameModule<unknown>> =>
  (await loader()).default as PracticeGameModule<unknown>;

const gameLoaders = {
  sumo: () => load(() => import("./games/sumo")),
  "space-bash": () => load(() => import("./games/space-bash")),
  "twisted-system": () => load(() => import("./games/twisted-system")),
  "snow-bash": () => load(() => import("./games/snow-bash")),
  "drain-bash": () => load(() => import("./games/drain-bash")),
  "jungle-bash": () => load(() => import("./games/jungle-bash")),
  "roller-ruckus": () => load(() => import("./games/roller-ruckus")),
  "tie-breaker": () => load(() => import("./games/tie-breaker")),
  "manic-panic": () => load(() => import("./games/manic-panic")),
  "rubble-alliance": () => load(() => import("./games/rubble-alliance")),
  "scratch-match": () => load(() => import("./games/scratch-match")),
  "sky-balls": () => load(() => import("./games/sky-balls")),
  "dragon-drop": () => load(() => import("./games/dragon-drop")),
  "volt-vault": () => load(() => import("./games/volt-vault")),
  "mystery-beat": () => load(() => import("./games/mystery-beat")),
  tailblazer: () => load(() => import("./games/tailblazer")),
  "jungle-fox": () => load(() => import("./games/jungle-fox")),
  "metal-fox": () => load(() => import("./games/metal-fox")),
  "paint-panic": () => load(() => import("./games/paint-panic")),
  rhythm: () => load(() => import("./games/rhythm")),
} satisfies Record<PracticeGameId, Loader>;

const game = (
  id: PracticeGameId,
  title: string,
  instructions: string,
  controls: readonly PracticeControl[],
  placeholder = true,
): PracticeGameDefinition => ({ id, title, instructions, controls, placeholder, tuningVersion: "practice-v1", load: gameLoaders[id] });

const definedPracticeGames = [
  game("sumo", "Royal Sumo · Crownfall", "Bash and Dash through six arenas, Quick Match or Crown Cup. Up to ten fighters, bots, two local players and full customization.", ["joystick", "action", "special"], false),
  game("space-bash", "Space Bash · Orbital Breakout", "Grab, throw and kick across four mechanical arenas. Customize ten-contestant matches, bots, crowns, physics and sound.", ["joystick", "jump", "action"], false),
  game("twisted-system", "Royal Twisted · Spiral Keep", "Jump and duck across four mechanical variants of the Spiral Keep. Ten contestants, bot demonstrations, adjustable lives, pacing and graphics.", ["jump", "duck"], false),
  game("snow-bash", "Snow Bash · Polar Panic", "Learn penguin baiting, crosswind braking and thawing-ice routes. Ten-contestant bot matches, Crown Cups and thirteen customization options.", ["joystick", "jump", "action", "special"], false),
  game("drain-bash", "Drain Bash · Sump Siege", "Master Homing, Burst and Sonic weapons. Learn current compensation and bank shots across three arenas, with ten contestants and custom Crown Cups.", ["joystick", "jump", "action", "special"], false),
  game("jungle-bash", "Jungle Bash · Verdant Clash", "Control crate and fruit pickups, bank shots around vine pillars, and time gap jumps in collapsing ruins. Ten-contestant custom Crown Cups.", ["joystick", "jump", "action", "special"], false),
  game("roller-ruckus", "Roller Ruckus · Crownway Circuit", "Race ten contestants through three courses. Momentum, slopes, rough strips, low-grip ice and boost lanes reward clean lines.", ["joystick"], false),
  game("tie-breaker", "Tie-Breaker · Crown Gauntlet", "Enter a ten-contestant duel bracket. Two fighters play at a time; best-of-three duels, sudden death, crosswinds and breakable-floor arenas.", ["joystick", "jump", "action", "special"], false),
  game("manic-panic", "Manic Panic · Bomb Joust", "Bump buggies, collect bombs and learn crosscurrents and ricochet throws. Ten-contestant custom Crown Cups.", ["joystick", "action"], false),
  game("rubble-alliance", "Rubble Alliance · Faultline Run", "Route around cracking footprints, read faultline pulses and escape temporary anchor islands. Ten contestants, boost and custom survival cups.", ["joystick", "special"], false),
  game("scratch-match", "Royal Scratch Match", "Listen and repeat against up to nine bot rivals. Four stage mechanics, custom tempo, phrases, timing and bot accuracy.", ["lane-1", "lane-2", "lane-3", "lane-4"], false),
  game("sky-balls", "Royal Ballistix · Beach Siege", "Guard one of ten gates, catch volleys and counter with Pulse. Learn bank shots and curved trajectories across three arenas.", ["joystick", "action", "special"], false),
  game("dragon-drop", "Dragon Drop · Jewel Joust", "Collect jewels, lead the dragon and time switchback or wind-compensated shots. Ten contestants compete for points and crowns.", ["joystick", "action"], false),
  game("volt-vault", "Volt Vault · Polarity Palace", "Read shock telegraphs, learn alternating reverse controls and counter the dynamo current. Ten-contestant cups with custom lives and warning pressure.", ["joystick"], false),
  game("mystery-beat", "Mystery Beat", "Create a short rhythm, preview it, then play it back.", ["lane-1", "lane-2", "lane-3", "lane-4"]),
  game("tailblazer", "Tailblazer", "Steer around your trail and see how long you can survive.", ["left", "right"]),
  game("jungle-fox", "Jungle Fox", "Drive the tank, aim, and practice firing at targets.", ["joystick", "fire", "special"]),
  game("metal-fox", "Metal Fox", "Drive, fire, and practice aiming around the shifting maze.", ["joystick", "fire", "special"]),
  game("paint-panic", "Paint Panic", "Move around and spray the roaming targets.", ["joystick", "spray"]),
  game("rhythm", "Rhythm", "Tap each lane in time with the changing beat.", ["lane-1", "lane-2", "lane-3", "lane-4"]),
] as const satisfies readonly PracticeGameDefinition[];

export const PRACTICE_GAMES = definedPracticeGames.filter((entry) => !isArchivedArcadeGame(entry.id));

const gamesById = new Map<PracticeGameId, (typeof PRACTICE_GAMES)[number]>(PRACTICE_GAMES.map((entry) => [entry.id, entry]));

export function getPracticeGame(id: string): (typeof PRACTICE_GAMES)[number] | null {
  return gamesById.get(id as PracticeGameId) ?? null;
}
