"use client";

import type { ArcadeWireSnapshot } from "./ArcadeHost";

export function ArcadeSpectator({ game, connection }: { game: ArcadeWireSnapshot | null; connection: string }) {
  const players = game?.state.players as string[] | undefined;
  const scores = game?.state.score as Record<string, number> | undefined;
  return <section className="arcade-phone-card arcade-spectator"><p className="arcade-kicker">SPECTATOR VIEW</p><h1>Watch the game</h1><div className="arcade-spectator-score">{players?.map((id, index) => <div key={id}><span>Seat {index + 1}</span><strong>{Number(scores?.[id] ?? 0)}</strong></div>)}</div><p>Control seats rotate in stable room order for each new match.</p><p className="arcade-connection" role="status">{connection === "live" ? "Live" : "Reconnecting to the match…"}</p></section>;
}
