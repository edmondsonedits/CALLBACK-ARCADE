"use client";

import { useAnimate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function ScoreReveal({ value, label = "points" }: { value: number; label?: string }) {
  const [scope, animate] = useAnimate();
  const reduced = useReducedMotion();
  const previous = useRef(value);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const start = previous.current;
    previous.current = value;
    if (reduced || start === value) { setShown(value); return; }
    const control = new AbortController();
    const started = performance.now();
    const duration = 420;
    const tick = (now: number) => {
      if (control.signal.aborted) return;
      const progress = Math.min(1, (now - started) / duration);
      setShown(Math.round(start + (value - start) * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    void animate(scope.current, { scale: [1, 1.08, 1] }, { duration: .42 });
    return () => control.abort();
  }, [animate, reduced, scope, value]);
  return <span ref={scope} className="score-reveal"><b>{shown.toLocaleString()}</b><small>{label}</small></span>;
}

