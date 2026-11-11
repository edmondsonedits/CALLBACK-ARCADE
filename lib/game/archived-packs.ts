import type { GameLength } from "../contracts";

export const ARCHIVED_GAME_PACKS = ["bowl", "royal-war-room", "birthday"] as const satisfies readonly GameLength[];
export type ArchivedGamePack = (typeof ARCHIVED_GAME_PACKS)[number];

export function isArchivedGamePack(gameLength: GameLength | string): gameLength is ArchivedGamePack {
  return (ARCHIVED_GAME_PACKS as readonly string[]).includes(gameLength);
}

export function blocksNewArchivedGame(gameLength: GameLength | string, actionType: string): boolean {
  return isArchivedGamePack(gameLength) && (actionType === "START_GAME" || actionType === "PLAY_AGAIN");
}

export const ARCHIVED_GAME_PACK_TITLES: Record<ArchivedGamePack, string> = {
  bowl: "Bowl of Fools Classic",
  "royal-war-room": "Royal War Room",
  birthday: "30th Birthday",
};
