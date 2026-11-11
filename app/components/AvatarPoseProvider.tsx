"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AvatarPose } from "../../lib/avatar-pose";
import { clampPose } from "../../lib/avatar-pose";

type PoseRecord = { playerId: string; sequence: number; pose: AvatarPose; fromPose: AvatarPose; receivedAt: number; expiresAt: number };
type LocalPoseRecord = { pose: AvatarPose; updatedAt: number };
type PoseContextValue = {
  poses: ReadonlyMap<string, PoseRecord>;
  localPoses: ReadonlyMap<string, LocalPoseRecord>;
  publishPose: (pose: Partial<AvatarPose>, playerId?: string) => void;
  enabled: boolean;
  role: "host" | "player" | "display";
};
const PoseContext = createContext<PoseContextValue | null>(null);
const EMPTY_POSES: ReadonlyMap<string, PoseRecord> = new Map();
const EMPTY_LOCAL_POSES: ReadonlyMap<string, LocalPoseRecord> = new Map();

type PoseSender = { latest: AvatarPose | null; timer: ReturnType<typeof setTimeout> | null; inFlight: boolean; lastSent: number; sequence: number; backoffUntil: number; controller: AbortController | null };
function schedulePoseSend(state: PoseSender, endpoint: string, active: boolean, role: string) {
  if (!state.latest || !active || role !== "player" || state.timer || state.inFlight || document.visibilityState === "hidden") return;
  const wait = Math.max(0, 334 - (Date.now() - state.lastSent), state.backoffUntil - Date.now());
  state.timer = setTimeout(() => {
    state.timer = null;
    const next = state.latest;
    if (!next || !active || document.visibilityState === "hidden") return;
    state.latest = null;
    state.inFlight = true;
    state.lastSent = Date.now();
    state.sequence = Math.max(Date.now(), state.sequence + 1);
    const controller = new AbortController();
    state.controller = controller;
    void fetch(endpoint, { method: "POST", credentials: "same-origin", signal: controller.signal, headers: { "content-type": "application/json", "x-callback-role": "player" }, body: JSON.stringify({ sequence: state.sequence, pose: next }) })
      .then(response => { state.backoffUntil = response.ok ? 0 : Date.now() + (response.status === 429 ? 1_200 : 700); })
      .catch(() => { state.backoffUntil = Date.now() + 700; })
      .finally(() => {
        state.inFlight = false;
        state.controller = null;
        schedulePoseSend(state, endpoint, active, role);
      });
  }, wait);
}

export function AvatarPoseProvider({ endpoint, mode: role, enabled = true, children }: {
  endpoint: string;
  mode: "host" | "player" | "display";
  enabled?: boolean;
  children: ReactNode;
}) {
  const [poses, setPoses] = useState<Map<string, PoseRecord>>(() => new Map());
  const posesRef = useRef(poses);
  const [localPoses, setLocalPoses] = useState<Map<string, LocalPoseRecord>>(() => new Map());
  const localPosesRef = useRef(localPoses);
  const localPublishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localExpiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = enabled && Boolean(endpoint);
  const sendRef = useRef({ latest: null as AvatarPose | null, timer: null as ReturnType<typeof setTimeout> | null, inFlight: false, lastSent: 0, sequence: 0, backoffUntil: 0, controller: null as AbortController | null });
  const publishPose = useCallback((value: Partial<AvatarPose>, playerId?: string) => {
    const state = sendRef.current;
    const pose = clampPose(value);
    if (playerId) {
      const next = new Map(localPosesRef.current);
      next.set(playerId, { pose, updatedAt: Date.now() });
      localPosesRef.current = next;
      if (!localPublishTimer.current) localPublishTimer.current = setTimeout(() => {
        localPublishTimer.current = null;
        setLocalPoses(localPosesRef.current);
      }, 50);
      if (!localExpiryTimer.current) {
        const expireLocal = () => {
          localExpiryTimer.current = null;
          const now = Date.now();
          const fresh = new Map([...localPosesRef.current].filter(([, record]) => now - record.updatedAt < 3_000));
          localPosesRef.current = fresh;
          setLocalPoses(fresh);
          if (fresh.size) localExpiryTimer.current = setTimeout(expireLocal, Math.max(50, 3_000 - (Date.now() - Math.min(...[...fresh.values()].map(record => record.updatedAt)))));
        };
        localExpiryTimer.current = setTimeout(expireLocal, 3_000);
      }
    }
    state.latest = pose;
    schedulePoseSend(state, endpoint, active, role);
  }, [active, endpoint, role]);

  useEffect(() => {
    const state = sendRef.current;
    const stop = () => {
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      state.latest = null;
      state.controller?.abort();
      state.controller = null;
      state.inFlight = false;
    };
    if (!active) {
      stop();
      posesRef.current = new Map();
      localPosesRef.current = new Map();
      setTimeout(() => { setPoses(new Map()); setLocalPoses(new Map()); }, 0);
      if (localPublishTimer.current) clearTimeout(localPublishTimer.current);
      localPublishTimer.current = null;
      if (localExpiryTimer.current) clearTimeout(localExpiryTimer.current);
      localExpiryTimer.current = null;
      return;
    }
    if (role === "player") return stop;
    let timer: ReturnType<typeof setInterval> | null = null;
    let expiryTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const poll = async () => {
      if (stopped || document.visibilityState === "hidden" || state.controller) return;
      const controller = new AbortController();
      state.controller = controller;
      try {
        const response = await fetch(endpoint, { credentials: "same-origin", cache: "no-store", signal: controller.signal, headers: { "x-callback-role": "host" } });
        if (!response.ok) return;
        const payload = await response.json() as { poses?: Array<{ playerId: string; sequence: number; pose: Partial<AvatarPose>; expiresAt: number }>; serverTime?: number };
        const offset = Number.isFinite(payload.serverTime) ? Number(payload.serverTime) - Date.now() : 0;
        const now = Date.now() + offset;
        const next = new Map<string, PoseRecord>();
        for (const item of payload.poses ?? []) {
          if (!item.playerId || !Number.isSafeInteger(item.sequence) || !Number.isFinite(item.expiresAt) || item.expiresAt <= now) continue;
          const prior = posesRef.current.get(item.playerId);
          if (prior?.sequence === item.sequence) { next.set(item.playerId, prior); continue; }
          const previous = prior ? interpolateRecord(prior, Date.now()) : clampPose(item.pose);
          const pose = clampPose(item.pose);
          next.set(item.playerId, { playerId: item.playerId, sequence: item.sequence, pose, fromPose: previous, receivedAt: Date.now(), expiresAt: item.expiresAt - offset });
        }
        if (!stopped) { posesRef.current = next; setPoses(next); }
      } catch { /* Expiry pruning below keeps disconnected poses from freezing on screen. */ }
      finally { if (state.controller === controller) state.controller = null; }
    };
    const start = () => {
      if (document.visibilityState === "hidden") {
        state.controller?.abort();
        state.controller = null;
        return;
      }
      void poll();
      if (!timer) timer = setInterval(() => { void poll(); }, 450);
      if (!expiryTimer) expiryTimer = setInterval(() => {
        const now = Date.now();
        const fresh = new Map([...posesRef.current].filter(([, record]) => record.expiresAt > now));
        if (fresh.size !== posesRef.current.size) { posesRef.current = fresh; setPoses(fresh); }
      }, 200);
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        if (timer) clearInterval(timer);
        timer = null;
        if (expiryTimer) clearInterval(expiryTimer);
        expiryTimer = null;
        state.controller?.abort();
        state.controller = null;
      } else start();
    };
    start();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (expiryTimer) clearInterval(expiryTimer);
      document.removeEventListener("visibilitychange", visibility);
      state.controller?.abort();
      state.controller = null;
      if (localPublishTimer.current) clearTimeout(localPublishTimer.current);
      localPublishTimer.current = null;
      if (localExpiryTimer.current) clearTimeout(localExpiryTimer.current);
      localExpiryTimer.current = null;
    };
  }, [active, endpoint, role]);

  useEffect(() => {
    if (!active || role !== "player") return;
    const state = sendRef.current;
    const stop = () => {
      if (document.visibilityState === "hidden") {
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        state.latest = null;
        state.controller?.abort();
        state.controller = null;
        state.inFlight = false;
      }
    };
    document.addEventListener("visibilitychange", stop);
    window.addEventListener("blur", stop);
    return () => {
      document.removeEventListener("visibilitychange", stop);
      window.removeEventListener("blur", stop);
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
      state.latest = null;
      state.controller?.abort();
      state.controller = null;
      if (localPublishTimer.current) clearTimeout(localPublishTimer.current);
      localPublishTimer.current = null;
      if (localExpiryTimer.current) clearTimeout(localExpiryTimer.current);
      localExpiryTimer.current = null;
    };
  }, [active, role]);

  const value = useMemo(() => ({ poses: active ? poses : EMPTY_POSES, localPoses: active ? localPoses : EMPTY_LOCAL_POSES, publishPose, enabled: active, role }), [active, localPoses, poses, publishPose, role]);
  return <PoseContext.Provider value={value}>{children}</PoseContext.Provider>;
}

export function useAvatarPose(playerId?: string): AvatarPose | null {
  const context = useContext(PoseContext);
  const local = context?.enabled && context.role === "player" && playerId ? context.localPoses.get(playerId) : undefined;
  const record = context?.enabled && playerId ? context.poses.get(playerId) : undefined;
  const [interpolated, setInterpolated] = useState<AvatarPose | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (!record || !context || context.role === "player" || reducedMotion) return;
    let frame = 0;
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (Date.now() - record.receivedAt) / 450));
      setInterpolated(progress >= 1 ? record.pose : blendPose(record.fromPose, record.pose, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [context, record, reducedMotion]);
  if (local) return local.pose;
  if (!record) return null;
  return context?.role === "player" || reducedMotion ? record.pose : interpolated ?? record.fromPose;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function blendPose(from: AvatarPose, to: AvatarPose, progress: number): AvatarPose {
  const eased = progress * progress * (3 - 2 * progress);
  return clampPose(Object.fromEntries(Object.keys(to).map(key => [key, from[key as keyof AvatarPose] + (to[key as keyof AvatarPose] - from[key as keyof AvatarPose]) * eased])));
}
function interpolateRecord(record: PoseRecord, now: number): AvatarPose {
  return blendPose(record.fromPose, record.pose, Math.min(1, Math.max(0, (now - record.receivedAt) / 450)));
}

export function useAvatarPoseControls() {
  const context = useContext(PoseContext);
  return { publishPose: context?.publishPose ?? (() => {}), enabled: context?.enabled ?? false };
}
