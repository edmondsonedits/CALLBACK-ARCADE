import type { PublicPlayer } from "../../../lib/contracts";
import { Avatar } from "../Avatar";

export function StageResponseMeter({ count, total, label, players = [], responded = new Set<string>(), note }: {
  count: number;
  total: number;
  label: string;
  players?: PublicPlayer[];
  responded?: Set<string>;
  note?: string;
}) {
  const complete = total > 0 && count >= total;
  return (
    <div className={`response-meter stage-response-meter ${complete ? "is-complete" : ""}`} role="status" aria-label={`${count} of ${total} ${label}`}>
      <div className="response-copy"><strong>{count}/{total}</strong><span>{label}</span></div>
      {players.length > 0 && (
        <div className="response-avatars" aria-hidden="true">
          {players.map((player) => <span className={responded.has(player.id) ? "responded" : ""} key={player.id}><Avatar playerId={player.id} index={player.avatar} color={player.color} config={player.avatarConfig} size="small" /></span>)}
        </div>
      )}
      {note && <small>{note}</small>}
    </div>
  );
}
