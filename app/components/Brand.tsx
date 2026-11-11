import Link from "next/link";
import { Crown } from "./presentation/Crown";

export function Brand({ compact = false,platform = false }: { compact?: boolean;platform?:boolean }) {
  const name=platform?'Callback':'King Prompter';
  return <Link className={`game-brand ${compact ? "game-brand-compact" : ""}`} href={platform?'/':'/?menu=1'} aria-label={`${name} menu`}><Crown state="brand" title={name} /> {platform?'CALLBACK':'KING PROMPTER'}</Link>;
}

export function PhasePill({ phase }: { phase: string }) {
  const label = {
    MYSTERY_DECOYS: "FILE COVER STORIES",
    MYSTERY_VOTING: "FIND THE TRUE REPORT",
    MYSTERY_REVEAL: "CASE CLOSED",
    RUMOUR_GUESSING: "WHAT DO YOU SEE?",
    RUMOUR_IMAGE_REVEAL: "AI IS RETELLING IT",
    RUMOUR_REVEAL: "FOLLOW THE RUMOUR",
    RUMOUR_VOTING: "CROWN THE BEST MUTATION",
    WAR_RANKING: "RANK THE ORDERS",
    WAR_COUNCIL: "COUNCIL COMMAND",
    WAR_TURN_REVEAL: "INTELLIGENCE CHECK",
    WAR_ROUND_REVEAL: "PLAN REVEALED",
    FOOL_TEAM_SETUP: "CHOOSE YOUR FOOLS",
    FOOL_WRITING: "FILL THE BOWL",
    FOOL_TURN: "YOUR TEAM'S TURN",
    FOOL_ROUND_REVEAL: "NEXT ROUND",
    FOOL_SUDDEN_DEATH: "SUDDEN DEATH",
  }[phase] ?? phase.replaceAll("_", " ");
  return <span className="phase-pill">{label}</span>;
}
