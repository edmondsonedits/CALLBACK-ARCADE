import type { PigeonState } from "../../../lib/presentation/types";
import { Crown } from "./Crown";

const labels: Partial<Record<PigeonState, string>> = {
  panic: "The royal host is handling a technical problem.", "technical-recovery": "The royal host is reconnecting the broadcast.",
  "timer-warning": "Ten seconds remain.", celebrate: "The royal host celebrates the result.", "hold-crown": "The royal host presents the crown.",
};

const poseForState: Record<PigeonState, string> = {
  idle: "neutral", blink: "neutral", "look-left": "point-left", "look-right": "point-right", talk: "neutral",
  laugh: "celebrate", confused: "inspect-card", smug: "neutral", shocked: "shocked", annoyed: "inspect-card",
  panic: "panic", celebrate: "celebrate", "point-left": "point-left", "point-right": "point-right",
  "hold-crown": "hold-crown", "drop-crown": "panic", "fly-in": "neutral", "fly-out": "neutral", land: "neutral",
  bow: "inspect-card", "inspect-card": "inspect-card", "timer-warning": "panic", "technical-recovery": "technical-recovery",
};

export function PigeonHost({ state = "idle", side = "right", meaningful = false }: { state?: PigeonState; side?: "left" | "right"; meaningful?: boolean }) {
  const pose = poseForState[state];
  return (
    <div className={`pigeon-host pigeon-${side} pigeon-state-${state}`} aria-hidden={!meaningful} role={meaningful ? "status" : undefined}>
      <picture><source srcSet={`/media/pigeon/pigeon-${pose}.webp`} type="image/webp" /><img src="/media/pigeon/pigeon-neutral.png" alt="" /></picture>
      <div className="pigeon-coded-fallback" aria-hidden="true"><span className="pigeon-wing" /><span className="pigeon-body"><i /><b /></span><span className="pigeon-beak" /></div>
      {state === "hold-crown" && <Crown state="overall-champion" className="pigeon-crown" />}
      {meaningful && <span className="sr-only">{labels[state] ?? `Royal host reaction: ${state.replaceAll("-", " ")}.`}</span>}
    </div>
  );
}
