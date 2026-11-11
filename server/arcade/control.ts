import type { ArcadeGameId } from "../../lib/arcade/contracts";
import { signArcadeCallback } from "./tickets";

export type ArcadeControlPhase = "ARCADE_ACTIVE" | "ARCADE_RESULTS";
export interface ArcadeControlSync {
  roomCode: string;
  gameId: Extract<ArcadeGameId, "air-hockey" | "tap-race" | "light-trails">;
  matchId: string;
  roomVersion: number;
  phase: ArcadeControlPhase;
  paused: boolean;
  controllerIds: string[];
  revokedControllerIds?: string[];
}

export async function syncArcadeWorker(input: ArcadeControlSync, workerUrl: string, secret: string, fetcher: typeof fetch = fetch): Promise<void> {
  if (!secret || !/^[A-Z0-9]{4,8}$/u.test(input.roomCode) || !input.matchId || input.matchId.length > 120 ||
    !Number.isSafeInteger(input.roomVersion) || input.roomVersion < 1 || !["air-hockey", "tap-race", "light-trails"].includes(input.gameId) ||
    !["ARCADE_ACTIVE", "ARCADE_RESULTS"].includes(input.phase) || typeof input.paused !== "boolean" ||
    input.controllerIds.length < 2 || input.controllerIds.length > 16 || new Set(input.controllerIds).size !== input.controllerIds.length ||
    input.controllerIds.some((id) => !id || id.length > 120) || (input.revokedControllerIds ?? []).length > 16 ||
    new Set(input.revokedControllerIds ?? []).size !== (input.revokedControllerIds ?? []).length || (input.revokedControllerIds ?? []).some((id) => !input.controllerIds.includes(id))) throw new TypeError("INVALID_ARCADE_CONTROL_SYNC");
  const base = new URL(workerUrl);
  const localDevelopmentWorker = process.env.NODE_ENV !== "production" && process.env.CALLBACK_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(base.hostname) && base.protocol === "http:";
  if ((base.protocol !== "https:" && !localDevelopmentWorker) || base.username || base.password) throw new TypeError("INVALID_ARCADE_WORKER_URL");
  const body = JSON.stringify({ v: 1, ...input, paused: input.phase === "ARCADE_RESULTS" || input.paused, action: "sync" });
  const auth = await signArcadeCallback(body, secret);
  const response = await fetcher(new URL(`/control/${input.roomCode}`, base), {
    method: "POST", headers: { "Content-Type": "application/json", "x-arcade-timestamp": auth.timestamp, "x-arcade-nonce": auth.nonce, "x-arcade-signature": auth.signature },
    body, signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error(`ARCADE_CONTROL_FAILED_${response.status}`);
}
