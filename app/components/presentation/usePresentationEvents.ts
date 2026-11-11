"use client";

import { useEffect, useRef, useState } from "react";
import type { RoleSnapshot } from "../../../lib/contracts";
import { dedupePresentationEvents, derivePresentationEvents } from "../../../lib/presentation/events";
import type { PresentationEvent } from "../../../lib/presentation/types";

export function usePresentationEvents(snapshot: RoleSnapshot | null): PresentationEvent[] {
  const previous = useRef<RoleSnapshot | null>(null);
  const [events, setEvents] = useState<PresentationEvent[]>([]);

  useEffect(() => {
    if (!snapshot) return;
    const nextEvents = dedupePresentationEvents(derivePresentationEvents(previous.current, snapshot));
    previous.current = snapshot;
    setEvents(nextEvents);
  }, [snapshot]);

  return events;
}
