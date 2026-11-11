import type { PublicPlayer, RoomPhase } from "../../../lib/contracts";
import { Avatar } from "../Avatar";

const responsePhases = new Set<RoomPhase>(["ANSWERING", "FINAL_ANSWERING", "PERSONAL_CHOICE", "ROOM_PREDICTION", "AUTHOR_GUESSING", "FINAL_WAGER", "RUMOUR_GUESSING", "WAR_RANKING", "BOWL_SCROLL_WRITING"]);
const votePhases = new Set<RoomPhase>(["VOTING", "FINAL_VOTING", "MYSTERY_VOTING", "RUMOUR_VOTING"]);

export function PlayerRail({ players, phase, submittedPlayerIds, respondedVoterIds }: {
  players: PublicPlayer[];
  phase: RoomPhase;
  submittedPlayerIds: string[];
  respondedVoterIds: string[];
}) {
  const active = players.filter((player) => player.role === "player" && player.active);
  const tracked = votePhases.has(phase) ? new Set(respondedVoterIds) : responsePhases.has(phase) ? new Set(submittedPlayerIds) : null;
  return (
    <aside className="player-rail" aria-label="Players">
      {active.map((player) => {
        const locked = tracked?.has(player.id) ?? false;
        return (
          <div className={`player-rail-seat ${player.connected ? "is-connected" : "is-disconnected"} ${locked ? "is-locked" : ""}`} key={player.id}>
            <Avatar playerId={player.id} index={player.avatar} color={player.color} config={player.avatarConfig} size="small" />
            <span>{player.nickname}</span>
            {tracked && <b aria-label={locked ? "locked in" : "still deciding"}>{locked ? "✓" : "…"}</b>}
          </div>
        );
      })}
    </aside>
  );
}
