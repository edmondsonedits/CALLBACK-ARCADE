"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { PropsWithChildren } from "react";
import { motionDurations, motionEasing } from "../../../lib/presentation/motion-tokens";

export function StageTransition({ sceneKey, children }: PropsWithChildren<{ sceneKey: string }>) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="sync">
      <m.div
        className="stage-transition"
        key={sceneKey}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: .992 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 1.008 }}
        transition={{ duration: reduced ? motionDurations.instant : motionDurations.stage, ease: motionEasing.standard }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

