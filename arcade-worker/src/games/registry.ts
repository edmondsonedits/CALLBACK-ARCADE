import type { ArcadeGameModule } from "./types";
import { MAX_ARCADE_PLAYERS, MIN_ARCADE_PLAYERS } from "./types";
import { airHockeyGame } from "./air-hockey";
import { tapRaceGame } from "./tap-race";
import { lightTrailsGame } from "./light-trails";

const modules = new Map<string, ArcadeGameModule>();

export function registerArcadeGame(game: ArcadeGameModule): void {
  if (!Number.isInteger(game.minPlayers) || !Number.isInteger(game.maxPlayers) || game.minPlayers < MIN_ARCADE_PLAYERS || game.maxPlayers > MAX_ARCADE_PLAYERS || game.minPlayers > game.maxPlayers) throw new Error("INVALID_GAME_PLAYER_CAPACITY");
  if (!Number.isSafeInteger(game.inputCooldownMs) || game.inputCooldownMs < 1 || !Array.isArray(game.inputKinds) || game.inputKinds.length === 0 || game.inputKinds.some((kind) => kind !== "position" && kind !== "tap") || new Set(game.inputKinds).size !== game.inputKinds.length) throw new Error("INVALID_GAME_INPUT_CONTRACT");
  for (const interval of [game.snapshotEveryTicks, game.persistEveryTicks]) if (interval !== undefined && (!Number.isSafeInteger(interval) || interval < 1 || interval > 600)) throw new Error("INVALID_GAME_RUNTIME_CADENCE");
  if ((game.persistInputImmediately !== undefined && typeof game.persistInputImmediately !== "boolean") || (game.restoreLatestInputOnLoad !== undefined && (typeof game.restoreLatestInputOnLoad !== "boolean" || !game.inputKinds.includes("position")))) throw new Error("INVALID_GAME_RECOVERY_CONTRACT");
  modules.set(game.id, game);
}
export function getArcadeGame(gameId: string): ArcadeGameModule | undefined { return modules.get(gameId); }

registerArcadeGame(airHockeyGame);
registerArcadeGame(tapRaceGame);
registerArcadeGame(lightTrailsGame);
