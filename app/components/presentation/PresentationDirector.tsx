"use client";

import { domAnimation, LazyMotion, MotionConfig, useReducedMotion } from "motion/react";
import { useMemo, type PropsWithChildren } from "react";
import type { HostSnapshot, DisplaySnapshot } from "../../../lib/contracts";
import { sceneForSnapshot } from "../../../lib/presentation/scenes";
import type { PigeonState, PresentationEvent } from "../../../lib/presentation/types";
import { CastleRoom } from "./CastleRoom";
import { PigeonHost } from "./PigeonHost";
import { ParticleLayer } from "./ParticleLayer";
import { PlayerRail } from "./PlayerRail";
import { StageTransition } from "./StageTransition";

function pigeonState(events: PresentationEvent[], phase: string): PigeonState {
  if (events.some((item) => item.type === "image.retrying" || item.type === "image.fallback")) return "panic";
  if (events.some((item) => item.type === "winner.revealed" || item.type === "tie.revealed")) return "hold-crown";
  if (events.some((item) => item.type === "player.joined" || item.type === "player.reconnected")) return "celebrate";
  if (phase.includes("VOT") || phase.includes("ANSWER")) return "inspect-card";
  if (phase.includes("REVEAL")) return "shocked";
  return "idle";
}

export function PresentationDirector({ snapshot, events, children }: PropsWithChildren<{ snapshot: HostSnapshot | DisplaySnapshot; events: PresentationEvent[] }>) {
  const reduced = useReducedMotion();
  const scene = useMemo(() => sceneForSnapshot(snapshot), [snapshot]);
  const quiet = ["ANSWERING", "FINAL_ANSWERING", "VOTING", "FINAL_VOTING", "RUMOUR_VOTING", "WAR_RANKING"].includes(snapshot.phase);
  const mascot = pigeonState(events, snapshot.phase);
  const pigeonVisible = ["LOBBY", "INTRO", "ROUND_INTRO", "ANSWERING", "FINAL_ANSWERING", "ANSWER_LOCK", "VOTE_LOCK", "BOWL_TUTORIAL", "BOWL_SCROLL_WRITING", "BOWL_INTERMISSION"].includes(snapshot.phase);
  const playerRailVisible = snapshot.gameLength !== "bowl" && !["LOBBY", "REVEAL", "MYSTERY_REVEAL", "RUMOUR_REVEAL", "WAR_TURN_REVEAL", "WAR_ROUND_REVEAL", "ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME", "ENDED"].includes(snapshot.phase);
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <CastleRoom scene={scene} quiet={quiet}>
          <StageTransition sceneKey={`${snapshot.roundId}:${snapshot.phase}`}>
            {children}
          </StageTransition>
          {pigeonVisible && <PigeonHost state={mascot} side={snapshot.roundNumber % 2 ? "right" : "left"} meaningful={mascot === "panic"} />}
          <ParticleLayer active={events.some((item) => item.type === "winner.revealed" || item.type === "tie.revealed")} />
          {playerRailVisible && (
            <PlayerRail players={snapshot.players} phase={snapshot.phase} submittedPlayerIds={snapshot.submittedPlayerIds} respondedVoterIds={snapshot.respondedVoterIds} />
          )}
          <output className="presentation-event-status" aria-live="polite">{events.some((item) => item.type === "player.reconnected") ? "A player reconnected." : ""}</output>
          {reduced && <span className="sr-only">Reduced motion presentation is active.</span>}
        </CastleRoom>
      </MotionConfig>
    </LazyMotion>
  );
}
