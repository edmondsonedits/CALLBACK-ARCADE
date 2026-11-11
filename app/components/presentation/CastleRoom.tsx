import type { PropsWithChildren } from "react";
import type { CastleScene } from "../../../lib/presentation/scenes";

const roomNames: Record<CastleScene, string> = {
  "grand-hall": "Grand Hall", "prompt-foundry": "Royal Prompt Foundry", scriptorium: "Royal Scriptorium", "hall-of-echoes": "Hall of Echoes",
  "banquet-hall": "Banquet Hall", "evidence-vault": "Royal Evidence Vault", "rumour-press": "Royal Rumour Press", "war-room": "Royal War Room",
  "fools-court": "Royal Fool's Court", "heraldry-pavilion": "Heraldry Pavilion", "backstage-workshop": "Backstage Prop Workshop", "history-archive": "History Books Archive",
};

export function CastleRoom({ scene, quiet = false, children }: PropsWithChildren<{ scene: CastleScene; quiet?: boolean }>) {
  return (
    <div className={`castle-room castle-room-${scene} ${quiet ? "castle-room-quiet" : ""}`} data-castle-room={scene}>
      <div className="castle-room-backdrop" aria-hidden="true" />
      <div className="castle-room-ambient" aria-hidden="true"><i /><i /><i /></div>
      <div className="castle-room-props" aria-hidden="true"><i /><i /></div>
      <div className="castle-room-scrim" aria-hidden="true" />
      <span className="sr-only">Presentation location: {roomNames[scene]}</span>
      <div className="castle-room-live">{children}</div>
    </div>
  );
}

