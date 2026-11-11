import type { GameLength, RoleSnapshot, RoomPhase } from "../contracts";

export type CastleScene = "grand-hall" | "prompt-foundry" | "scriptorium" | "hall-of-echoes" | "banquet-hall" | "evidence-vault" | "rumour-press" | "war-room" | "fools-court" | "heraldry-pavilion" | "backstage-workshop" | "history-archive";

const bowlPhases = new Set<RoomPhase>(["BOWL_TUTORIAL", "BOWL_SCROLL_WRITING", "BOWL_TURN", "BOWL_INTERMISSION", "BOWL_SUDDEN_DEATH"]);

export function sceneForGame(gameLength: GameLength, phase: RoomPhase): CastleScene {
  if (phase === "LOBBY" || phase === "ENDED") return "grand-hall";
  if (gameLength === "bowl" || bowlPhases.has(phase)) return "fools-court";
  if (gameLength === "pictures") return "prompt-foundry";
  if (gameLength === "comic") return "scriptorium";
  if (gameLength === "birthday") return "banquet-hall";
  if (gameLength === "king-mystery") return "evidence-vault";
  if (gameLength === "royal-rumours") return "rumour-press";
  if (gameLength === "royal-war-room") return "war-room";
  return "hall-of-echoes";
}

export function sceneForSnapshot(snapshot: RoleSnapshot): CastleScene {
  return sceneForGame("gameLength" in snapshot ? snapshot.gameLength : "standard", snapshot.phase);
}

