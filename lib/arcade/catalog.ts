import type { ArcadeGameId } from "./contracts";
import { isArchivedArcadeGame } from "./archived-games";

export type ArcadeGameStatus = "in-development" | "playable";

export type ArcadeGame = Readonly<{
  id: ArcadeGameId;
  title: string;
  status: ArcadeGameStatus;
  placeholder: boolean;
  summary: string;
}>;

export const ARCADE_PLACEHOLDER_NOTE = "This game is a placeholder and will be replaced with a full game. Games will be upgraded one at a time.";

const definedArcadeGames: readonly ArcadeGame[] = [
  { id: "arena-survivor", title: "Arena Survivor", status: "playable", placeholder: true, summary: "Pick the safest move in a fast survival scenario, then see how the room fares." },
  { id: "buzzwort", title: "Buzzwort", status: "playable", placeholder: true, summary: "Describe the word without using its forbidden clues; your team races to guess." },
  { id: "chaos-kommando", title: "Chaos-Kommando", status: "playable", placeholder: true, summary: "Coordinate private tool choices across four server-resolved team missions." },
  { id: "drift-racer", title: "Drift Racer", status: "playable", placeholder: true, summary: "Read the bends, manage boosts, and race for the cleanest line." },
  { id: "fish-tank", title: "The Last Fish Swimming", status: "playable", placeholder: false, summary: "Draw a fish, then watch the room's aquarium crown its champion." },
  { id: "flatterfluff", title: "Flatterfluff", status: "playable", placeholder: true, summary: "Aim from your phone, pop the targets, and compare your score across five quick rounds." },
  { id: "kartentisch", title: "Kartentisch", status: "playable", placeholder: true, summary: "Follow suit, watch the trump change the trick, and claim the most tricks." },
  { id: "magic-arena", title: "Magic Arena", status: "playable", placeholder: true, summary: "Choose simultaneous moves and fight the next living rival in a two-to-ten-player arena." },
  { id: "magic-duell", title: "Magic Duell", status: "playable", placeholder: true, summary: "Draft a private spellbook, draw glyphs, and duel in a two-to-ten-player ring." },
  { id: "minions-td", title: "Minions TD", status: "playable", placeholder: true, summary: "Spend gold, send minions to the next living rival, and defend your base with two to ten players." },
  { id: "schaetzorama", title: "Schaetzorama", status: "playable", placeholder: true, summary: "Make your best estimate and see who gets closest." },
  { id: "sketch-relay", title: "Sketch & Sorcery", status: "playable", placeholder: false, summary: "Three rounds. Draw, cast a double-points curse, then remix a triple-points finale." },
  { id: "word-tiles", title: "Word Tiles", status: "playable", placeholder: true, summary: "Build private words from shared seven-letter racks, then reveal the scores." },
  { id: "zeichnen-und-erraten", title: "Zeichnen & Erraten", status: "playable", placeholder: true, summary: "Draw a secret prompt while everyone else races to guess it." },
  { id: "air-hockey", title: "Air Hockey", status: "playable", placeholder: true, summary: "Face off in two teams of up to five phone-controlled paddles." },
  { id: "imposter", title: "Imposter", status: "playable", placeholder: true, summary: "Share clues, spot the player without the word, and vote from your phone." },
  { id: "light-trails", title: "Light Trails", status: "playable", placeholder: true, summary: "Steer a glowing trail, outlast the room, and claim the open grid." },
  { id: "pantomime", title: "Pantomime", status: "playable", placeholder: true, summary: "Act out a prompt and let the room guess before time runs out." },
  { id: "schattenjagd", title: "Schattenjagd", status: "playable", placeholder: true, summary: "Follow private clues, vote on each shadow case, and reveal the room's best deductions." },
  { id: "tap-race", title: "Tap Race", status: "playable", placeholder: true, summary: "Sprint to the finish in a player-versus-player tap-mashing race." },
  { id: "dungeon-party", title: "Dungeon Party", status: "playable", placeholder: true, summary: "Choose private party moves, survive three encounters, and escape together." },
];

export const ARCADE_GAMES: readonly ArcadeGame[] = definedArcadeGames.filter((game) => !isArchivedArcadeGame(game.id));

export const ARCADE_MAX_CONTROLLERS = 10;

export function getArcadeControllerCapacity(gameId: ArcadeGameId): number {
  // Existing archived matches retain their original controller assignments.
  return definedArcadeGames.some(game => game.id === gameId) ? ARCADE_MAX_CONTROLLERS : 0;
}

export function getArcadeMinimumPlayers(gameId: ArcadeGameId): number {
  if (gameId === "drift-racer") return 1;
  if (gameId === "fish-tank") return 1;
  return gameId === "sketch-relay" || gameId === "imposter" || gameId === "buzzwort" || gameId === "pantomime" || gameId === "zeichnen-und-erraten" || gameId === "arena-survivor" || gameId === "chaos-kommando" || gameId === "kartentisch" || gameId === "dungeon-party" ? 3 : 2;
}

export function getArcadeLaunchHref(game: Pick<ArcadeGame, "id" | "status">): string | null {
  if (game.status !== "playable" || isArchivedArcadeGame(game.id)) return null;
  return ["air-hockey", "light-trails", "tap-race"].includes(game.id) ? `/arcade/online/new?game=${game.id}` : `/host/new?gameLength=arcade&arcadeGameId=${game.id}`;
}
