import type { RoomPhase } from "../contracts";

export const presentationEventTypes = [
  "snapshot.resumed", "phase.entered", "round.entered", "player.joined", "player.left", "player.reconnected",
  "response.locked", "vote.locked", "image.ready", "image.retrying", "image.fallback", "answer.revealed",
  "score.changed", "winner.revealed", "tie.revealed", "match.completed",
] as const;

export type PresentationEventType = (typeof presentationEventTypes)[number];

export interface PresentationEvent {
  key: string;
  stateVersion: number;
  type: PresentationEventType;
  subjectId?: string;
  phase: RoomPhase;
  delta?: number;
  payload?: Record<string, unknown>;
}

export type PigeonState =
  | "idle" | "blink" | "look-left" | "look-right" | "talk" | "laugh" | "confused" | "smug" | "shocked"
  | "annoyed" | "panic" | "celebrate" | "point-left" | "point-right" | "hold-crown" | "drop-crown" | "fly-in"
  | "fly-out" | "land" | "bow" | "inspect-card" | "timer-warning" | "technical-recovery";

export type CrownState = "brand" | "candidate" | "advancing" | "round-winner" | "overall-champion" | "tie" | "disabled";

