import type { SnapshotSketchRelay } from "../arcade/sketch-relay";
import type { HostMusicContext } from "./audio-policy";

const VOTING_PHASES = new Set(["prompt-voting", "laughter-voting", "artist-guessing", "voting"]);
const THINKING_PHASES = new Set(["prompt-writing", "drawing", "redrawing", "captioning"]);
const RESULTS_PHASES = new Set(["round-results", "complete", "halfway", "champion", "artists"]);

/** Read-only sound direction; this never advances the room or derives a winner. */
export function sketchMusicContext(phase: string, paused = false): HostMusicContext {
  if (paused) return "menu";
  if (VOTING_PHASES.has(phase)) return "voting";
  if (THINKING_PHASES.has(phase)) return "thinking";
  if (RESULTS_PHASES.has(phase)) return "results";
  return "game";
}

export interface SketchAudioObservation {
  matchId: string;
  identity: string;
  phase: string;
  submittedCount: number;
  totalPlayers: number;
  revealKey: string;
  scoresKey: string;
  championsCount: number;
  emoteKey: string;
  emoteRole: string;
}
export interface SketchAudioEvent { key: string; role: string }

export function observeSketchAudio(snapshot: SnapshotSketchRelay, remaining: number | null): SketchAudioObservation {
  const showdown = snapshot.showdown;
  let revealKey = "";
  if (snapshot.phase === "showcase" && showdown) {
    const elapsed = Math.max(0, showdown.phaseDuration - (remaining ?? showdown.phaseDuration));
    const index = Math.min(showdown.entries.length - 1, Math.floor(elapsed / Math.max(1, showdown.phaseDuration / Math.max(1, showdown.entries.length))));
    revealKey = showdown.entries[index]?.entryId ?? "";
  } else if (snapshot.phase === "revealing") {
    revealKey = showdown?.revealEntry?.entryId ?? String(snapshot.revealIndex);
  }
  return {
    matchId: snapshot.matchId,
    identity: `${snapshot.matchId}:${snapshot.round}:${snapshot.phase}`,
    phase: snapshot.phase,
    submittedCount: snapshot.submittedCount,
    totalPlayers: snapshot.totalPlayers,
    revealKey,
    scoresKey: JSON.stringify(Object.entries(snapshot.scores).sort(([a], [b]) => a.localeCompare(b))),
    championsCount: showdown?.champions.length ?? 0,
    emoteKey: snapshot.phase === "revealing" && showdown?.emote ? `${snapshot.revealIndex}:${showdown.emote.name}:${showdown.emote.sequence}:${showdown.emote.expiresAt}` : "",
    emoteRole: showdown?.emote ? `emote-${showdown.emote.name}` : "",
  };
}

export function sketchAudioEvents(previous: SketchAudioObservation | null, next: SketchAudioObservation, paused = false): SketchAudioEvent[] {
  if (!previous || paused || previous.matchId !== next.matchId) return [];
  const events: SketchAudioEvent[] = [];
  const add = (role: string, suffix: string) => events.push({role, key:`sketch:${next.identity}:${suffix}`});
  if (previous.identity !== next.identity) {
    if (next.phase === "complete") add(next.championsCount > 1 ? "tie" : "winner", "completion");
    else if (next.phase === "round-results") add("score", "scoreboard");
    else if (["showcase", "revealing"].includes(next.phase)) add("reveal", `reveal:${next.revealKey}`);
    else if (THINKING_PHASES.has(next.phase) || next.phase === "halfway") add("round", "opening");
    else if (VOTING_PHASES.has(next.phase)) add("card", "ballot");
    return events;
  }
  if (next.submittedCount > previous.submittedCount) {
    const voting = VOTING_PHASES.has(next.phase);
    add(voting ? "vote-lock" : "response-lock", `locked:${next.submittedCount}`);
    if (voting && next.totalPlayers > 0 && next.submittedCount >= next.totalPlayers && previous.submittedCount < next.totalPlayers) add("all-votes", "all-votes");
  }
  if (next.revealKey && next.revealKey !== previous.revealKey) add(next.phase === "showcase" ? "card" : "reveal", `reveal:${next.revealKey}`);
  if (next.emoteKey && next.emoteKey !== previous.emoteKey) add(next.emoteRole, `move:${next.emoteKey}`);
  if (next.scoresKey !== previous.scoresKey) add("score", `scores:${next.scoresKey}`);
  return events;
}
