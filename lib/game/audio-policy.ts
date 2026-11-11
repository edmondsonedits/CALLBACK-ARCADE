import { APPROVED_AUDIO, type ApprovedAudioClip } from "./audio-library";
import { MENU_SOUNDTRACK_TRACKS, SOUNDTRACK_TRACKS, soundtrackForHostMusicGame } from "./soundtrack";

export type HostMusicContext = "menu" | "thinking" | "voting" | "game" | "results";

const MUSIC_CONTEXTS: readonly HostMusicContext[] = ["menu", "thinking", "voting", "game", "results"];

export function isHostMusicContext(value: unknown): value is HostMusicContext {
  return typeof value === "string" && MUSIC_CONTEXTS.includes(value as HostMusicContext);
}

export function buildMusicPlaylist(context: HostMusicContext, gameId: string, clips: readonly ApprovedAudioClip[] = APPROVED_AUDIO): string[] {
  const roleClips = clips.filter((clip) => clip.category === "music" && clip.role === context).map((clip) => clip.src);
  const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))];
  const gameClips = context !== "menu"
    ? clips.filter((clip) => clip.category === "music" && clip.role === "game").map((clip) => clip.src)
    : [];
  const approved = unique([...roleClips, ...gameClips]);
  const legacy = unique(context === "menu" ? MENU_SOUNDTRACK_TRACKS : [soundtrackForHostMusicGame(gameId), ...SOUNDTRACK_TRACKS]);
  const rotated: string[] = [];
  for (let index = 0; index < Math.max(approved.length, legacy.length); index += 1) {
    if (approved[index]) rotated.push(approved[index]!);
    if (legacy[index]) rotated.push(legacy[index]!);
  }
  return unique(rotated);
}

export function approvedAudioForRole(role: string, clips: readonly ApprovedAudioClip[] = APPROVED_AUDIO): ApprovedAudioClip[] {
  return clips.filter((clip) => clip.role === role && (clip.category === "effect" || clip.category === "countdown"));
}

export function approvedMusicGain(src: string, clips: readonly ApprovedAudioClip[] = APPROVED_AUDIO): number {
  const clip = clips.find((item) => item.category === "music" && item.src === src);
  return clip && Number.isFinite(clip.gain) ? Math.max(0, Math.min(1, clip.gain)) : 1;
}

const PRESENTATION_EFFECT_ROLES: Readonly<Record<string, string>> = {
  "player.joined": "join",
  "round.entered": "round",
  "response.locked": "response-lock",
  "vote.locked": "vote-lock",
  "image.ready": "card",
  "image.retrying": "reveal",
  "image.fallback": "reveal",
  "answer.revealed": "reveal",
  "score.changed": "score",
  "winner.revealed": "winner",
  "tie.revealed": "tie",
  "match.completed": "winner",
};

export function effectRoleForPresentation(eventType: string): string | undefined {
  return PRESENTATION_EFFECT_ROLES[eventType];
}

export function additionalEffectRoles(eventType: string, gameId: string, phase: string, previousPhase: string | null): string[] {
  if (eventType === "winner.revealed") return ["pigeon"];
  if (eventType === "answer.revealed" && gameId === "comic") return ["comic"];
  if (eventType === "phase.entered" && phase === "REVEAL" && previousPhase?.includes("VOT")) return ["all-votes"];
  return [];
}

export function countdownEffectRoleForSecond(seconds: number): string | undefined {
  if (seconds > 0 && seconds <= 5) return "timer";
  return undefined;
}

export function sequentialMusicFadeLevels(stage: "fade-out" | "fade-in", progress: number, volume: number) {
  const boundedProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 1;
  const boundedVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
  return stage === "fade-out"
    ? { incoming: 0, outgoing: boundedVolume * (1 - boundedProgress) }
    : { incoming: boundedVolume * boundedProgress, outgoing: 0 };
}

export function latestMusicTarget<T>(current: T, pending: T | null): T {
  return pending ?? current;
}

export function phaseMusicContext(phase: string, paused = false): HostMusicContext {
  if (paused || phase === "LOBBY") return "menu";
  if (["INTRO", "ROUND_INTRO", "ANSWERING", "ANSWER_LOCK", "PERSONAL_CHOICE", "ROOM_PREDICTION", "AUTHOR_GUESSING", "FINAL_WAGER", "FINAL_ANSWERING", "BOWL_TUTORIAL", "BOWL_SCROLL_WRITING", "BOWL_TURN", "FOOL_TEAM_SETUP", "FOOL_WRITING", "FOOL_TURN", "MYSTERY_DECOYS", "RUMOUR_GUESSING", "WAR_TURN_REVEAL", "ARCADE_ACTIVE"].includes(phase)) return "thinking";
  if (["VOTING", "VOTE_LOCK", "FINAL_VOTING", "MYSTERY_VOTING", "RUMOUR_VOTING", "WAR_RANKING", "WAR_COUNCIL"].includes(phase)) return "voting";
  if (["ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME", "ARCADE_RESULTS"].includes(phase)) return "results";
  return "game";
}
