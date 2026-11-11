import type { PresentationEventType } from "./types";

export type AudioPresentationEvent = "stage.ready" | "player.joined" | "round.sting" | "timer.ten" | "response.lock" | "vote.lock" | "gallery.open" | "image.retry" | "image.fallback" | "reveal.anticipation" | "reveal.impact" | "score.tick" | "winner.crown" | "winner.tie" | "finale.fanfare" | "connection.lost" | "connection.restored";

export const audioEventForPresentation: Partial<Record<PresentationEventType, AudioPresentationEvent>> = {
  "snapshot.resumed": "stage.ready", "player.joined": "player.joined", "player.left": "connection.lost", "player.reconnected": "connection.restored",
  "round.entered": "round.sting", "response.locked": "response.lock", "vote.locked": "vote.lock",
  "image.ready": "gallery.open", "image.retrying": "image.retry", "image.fallback": "image.fallback", "answer.revealed": "reveal.impact",
  "score.changed": "score.tick", "winner.revealed": "winner.crown", "tie.revealed": "winner.tie", "match.completed": "finale.fanfare",
};
