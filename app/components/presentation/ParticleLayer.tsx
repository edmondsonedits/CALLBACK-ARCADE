"use client";

import { useReducedMotion } from "motion/react";

export function ParticleLayer({ active, tone = "celebration" }: { active: boolean; tone?: "celebration" | "impact" }) {
  const reduced = useReducedMotion();
  if (!active || reduced) return null;
  return <div className={`particle-layer particle-${tone}`} aria-hidden="true">{Array.from({ length: 12 }, (_item, index) => <i key={index} />)}</div>;
}
