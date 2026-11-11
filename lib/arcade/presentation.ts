import type { HostSnapshot } from "../contracts";

export interface ArcadeWireSnapshot { v: number; gameId: string; tick: number; state: Record<string, unknown> }

export function arcadeLobbySeatLabel(player: { id: string; active: boolean; bot?: boolean }, controllerIds: readonly string[]): string {
  const assignedSeat = controllerIds.indexOf(player.id);
  if (assignedSeat >= 0) return `SEAT ${assignedSeat + 1}`;
  if (player.bot) return "BOT";
  return player.active ? "WATCHING" : "INACTIVE";
}

export function arcadeHostResultScore(snapshot: HostSnapshot, game: ArcadeWireSnapshot | null): { resultIds: string[]; score: Record<string, number> } {
  const state = game?.state ?? {};
  const resultData = snapshot.arcade?.result as { score?: Record<string, number>; progress?: Record<string, number>; distance?: Record<string, number> } | null;
  const liveScore = state.score && typeof state.score === "object" ? state.score as Record<string, number> : {};
  const resultValues = resultData?.score ?? resultData?.progress ?? resultData?.distance;
  const authoritativeResultIds = Object.keys(resultValues ?? {});
  const hasAuthoritativeResult = snapshot.phase === "ARCADE_RESULTS" && authoritativeResultIds.length > 0;
  const resultIds = hasAuthoritativeResult ? authoritativeResultIds : (state.players as string[] | undefined) ?? Object.keys(liveScore);
  const score = hasAuthoritativeResult
    ? Object.fromEntries(authoritativeResultIds.map((id) => [id, resultValues![id]!]))
    : liveScore;
  return { resultIds, score };
}
