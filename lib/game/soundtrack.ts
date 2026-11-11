import type { GameLength } from "../contracts";
import { ONLINE_HOSTED_GAME_IDS } from "../arcade/online/catalog";
import type { HostMusicContext } from "./audio-policy";

export const SOUNDTRACK_VOLUME = 0.2;
export const MENU_VIDEO_HANDOFF_MS = 6_000;

export const SOUNDTRACK_TRACKS = [
  "/media/music/medieval-01.mp3",
  "/media/music/medieval-02.mp3",
  "/media/music/medieval-03.mp3",
  "/media/music/medieval-04.mp3",
  "/media/music/medieval-05.mp3",
] as const;

export const MENU_SOUNDTRACK_TRACKS = [SOUNDTRACK_TRACKS[0], SOUNDTRACK_TRACKS[1]] as const;

export function musicFadeProgress(now: number, startedAt: number, duration: number): number {
  if (!Number.isFinite(now) || !Number.isFinite(startedAt) || !Number.isFinite(duration) || duration <= 0) return 1;
  return Math.max(0, Math.min(1, (now - startedAt) / duration));
}

export function isCurrentMusicPlayAttempt(attempt: number, current: number): boolean {
  return attempt === current;
}

export type HostMusicPhase = "menu" | "game";
export type HostMusicPhaseMessage = {
  type: "host-music-phase";
  phase: HostMusicPhase;
  gameId?: string;
  context?: HostMusicContext;
};

export function isHostMusicRoute(pathname: string): boolean {
  const path = pathname.split("?", 1)[0].replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/host/new" || path === "/mirror" || path === "/birthday/new" || path === "/arcade" || path === "/arcade/online/new" || path === "/party-games") return true;
  if (/^\/session\/[^/]+\/(host|mirror)$/.test(path)) return true;
  if (/^\/host\/[^/]+$/.test(path) || /^\/display\/[^/]+$/.test(path)) return true;
  if (/^\/arcade\/online\/host\/[^/]+$/.test(path)) return true;
  return false;
}

export function canPlayHostMusic(pathname: string, embedded: boolean, phoneDevice: boolean): boolean {
  if (embedded || !isHostMusicRoute(pathname)) return false;
  if (!phoneDevice) return true;
  const path = pathname.split("?", 1)[0].replace(/\/+$/, "");
  return path === "/mirror"
    || /^\/session\/[^/]+\/(host|mirror)$/.test(path)
    || (path !== "/host/new" && /^\/host\/[^/]+$/.test(path))
    || /^\/display\/[^/]+$/.test(path)
    || /^\/arcade\/online\/host\/[^/]+$/.test(path);
}


// Initial shuffled assignment. Keep this table as the one place to retheme a game.
export const GAME_SOUNDTRACK: Record<GameLength, (typeof SOUNDTRACK_TRACKS)[number]> = {
  "bowl-of-fools": "/media/music/medieval-01.mp3",
  "royal-war-room": "/media/music/medieval-05.mp3",
  "royal-rumours": "/media/music/medieval-02.mp3",
  "king-mystery": "/media/music/medieval-03.mp3",
  pictures: "/media/music/medieval-04.mp3",
  comic: "/media/music/medieval-01.mp3",
  standard: "/media/music/medieval-05.mp3",
  birthday: "/media/music/medieval-02.mp3",
  bowl: "/media/music/medieval-03.mp3",
  arcade: "/media/music/medieval-03.mp3",
};

export function soundtrackForGame(game: GameLength) {
  return GAME_SOUNDTRACK[game];
}

export function soundtrackForHostMusicGame(gameId: string) {
  return Object.hasOwn(GAME_SOUNDTRACK, gameId) ? GAME_SOUNDTRACK[gameId as GameLength] : SOUNDTRACK_TRACKS[2];
}

export function isHostMusicPhaseMessage(value: unknown): value is HostMusicPhaseMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<HostMusicPhaseMessage>;
  if (message.type !== "host-music-phase" || (message.phase !== "menu" && message.phase !== "game")) return false;
  if (message.context !== undefined && !["menu", "thinking", "voting", "game", "results"].includes(message.context)) return false;
  return message.phase === "menu" || (
    typeof message.gameId === "string"
    && (Object.hasOwn(GAME_SOUNDTRACK, message.gameId) || ONLINE_HOSTED_GAME_IDS.includes(message.gameId as typeof ONLINE_HOSTED_GAME_IDS[number]))
  );
}
