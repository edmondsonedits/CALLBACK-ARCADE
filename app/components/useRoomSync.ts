"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HostAction, PlayerAction, RoleSnapshot } from "../../lib/contracts";
import { nextAcceptedVersion, shouldAcceptSnapshotVersion } from "../../lib/game/state-sync";
import { roomSocketGameId } from "../../lib/arcade/native-socket-ticket";

interface SyncError { code: string; message: string; status: number }

export function useRoomSync(code: string, role: "host" | "player" | "display") {
  const [snapshot, setSnapshot] = useState<RoleSnapshot | null>(null);
  const [error, setError] = useState<SyncError | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const version = useRef(0);
  const stopped = useRef(false);
  const socket = useRef<WebSocket | null>(null);
  const socketConnected = useRef(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingActions = useRef(new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  const offlineFailures = useRef(0);
  const connectionError = useRef<SyncError | null>(null);
  const connectionEpoch = useRef(0);
  const jobKickAt = useRef(0);
  const jobRunning = useRef(false);
  const latestSnapshot = useRef<RoleSnapshot | null>(null);
  const sketchRequests = useRef(new Set<string>());
  const sketchRequestAt = useRef(new Map<string, number>());
  const kickSketchJobs = useCallback((next: RoleSnapshot | null) => {
    if (!next?.sketchImageJobs?.length || role === "display") return;
    const all = next.sketchImageJobs.slice(0, 10);
    const ownIndex = "selfId" in next ? Math.max(0, next.players.findIndex(player => player.id === next.selfId)) : 0;
    const jobs = role === "host" ? all : [all[ownIndex % all.length]];
    for (const jobId of jobs) {
      if (sketchRequests.current.has(jobId) || Date.now() - (sketchRequestAt.current.get(jobId) ?? 0) < 5000) continue;
      sketchRequests.current.add(jobId); sketchRequestAt.current.set(jobId, Date.now());
      void fetch(`/api/rooms/${code}/jobs/run`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) }).catch(() => undefined).finally(() => { sketchRequests.current.delete(jobId); });
    }
    if (sketchRequestAt.current.size > 100) sketchRequestAt.current = new Map(all.map(id => [id, sketchRequestAt.current.get(id) ?? 0]));
  }, [code, role]);

  const kickJobs = useCallback((next: RoleSnapshot | null) => {
    if (!next) return;
    kickSketchJobs(next);
    const imageWork = next.imageJobsPending || next.image?.status === "QUEUED";
    const backgroundHostWork = role === "host" && next.phase !== "LOBBY";
    const kickInterval = imageWork ? 1500 : 8000;
    if (role !== "display" && !next.sketchImageJobs?.length && (!next.soloMode || next.soloLiveImages) && (imageWork || backgroundHostWork) && !jobRunning.current && Date.now() - jobKickAt.current > kickInterval) {
      jobKickAt.current = Date.now(); jobRunning.current = true;
      void fetch(`/api/rooms/${code}/jobs/run`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => undefined).finally(() => { jobRunning.current = false; });
    }
  }, [code, role, kickSketchJobs]);

  const sync = useCallback(async () => {
    const epoch = connectionEpoch.current;
    try {
      if (!navigator.onLine) throw new Error("OFFLINE");
      const response = await fetch(`/api/rooms/${code}/sync`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-Callback-Role": role }, body: JSON.stringify({ version: version.current }) });
      if (epoch !== connectionEpoch.current) return;
      if (!navigator.onLine) throw new Error("OFFLINE");
      if (response.status === 204) {
        version.current = nextAcceptedVersion(version.current, Number(response.headers.get("x-callback-version") ?? version.current));
        // A newer action or session error must survive connection recovery.
        const recoveredError = connectionError.current;
        setError((current) => current === recoveredError ? null : current);
        connectionError.current = null;
        offlineFailures.current = 0; setReconnecting(false); kickJobs(latestSnapshot.current); return;
      }
      const body = await response.json().catch(() => null) as RoleSnapshot | { error?: { code?: string; message?: string } } | null;
      if (epoch !== connectionEpoch.current) return;
      if (!navigator.onLine) throw new Error("OFFLINE");
      if (!response.ok) {
        const apiError = body && "error" in body ? body.error : null;
        const nextError = { code: apiError?.code ?? "SYNC_FAILED", message: apiError?.message ?? "Could not reach the room.", status: response.status };
        setError(nextError);
        if (response.status >= 500) { connectionError.current = nextError; offlineFailures.current += 1; setReconnecting(true); }
        else { connectionError.current = null; offlineFailures.current = 0; setReconnecting(false); }
        return;
      }
      const next = body as RoleSnapshot;
      if (!shouldAcceptSnapshotVersion(version.current, next.stateVersion)) return;
      latestSnapshot.current = next; kickJobs(next);
      version.current = next.stateVersion; setSnapshot(next); setError(null); connectionError.current = null; offlineFailures.current = 0; setReconnecting(false);
    } catch {
      if (epoch !== connectionEpoch.current) return;
      const nextError = { code: "OFFLINE", message: "Connection interrupted.", status: 0 };
      connectionError.current = nextError;
      offlineFailures.current += 1; setReconnecting(true); setError(nextError);
    }
  }, [code, role, kickJobs]);

  useEffect(() => {
    const offline = () => {
      connectionEpoch.current += 1;
      socketConnected.current = false;
      socket.current?.close();
      const nextError = { code: "OFFLINE", message: "Connection interrupted.", status: 0 };
      connectionError.current = nextError;
      offlineFailures.current += 1;
      setError(nextError); setReconnecting(true);
    };
    const online = () => { connectionEpoch.current += 1; void sync(); };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    if (!navigator.onLine) offline();
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [sync]);

  useEffect(() => {
    stopped.current = false;
    let timeout: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (stopped.current) return;
      if (!socketConnected.current) await sync();
      if (stopped.current) return;
      const base = offlineFailures.current ? Math.min(8000, 1200 * 2 ** Math.min(offlineFailures.current, 3)) : role === "host" ? 900 : 1200;
      timeout = setTimeout(() => { pollTimer.current = null; void loop(); }, Math.max(500, base + Math.floor(Math.random() * 501) - 250));
      pollTimer.current = timeout;
    };
    void loop();
    return () => { stopped.current = true; clearTimeout(timeout); if (pollTimer.current === timeout) pollTimer.current = null; };
  }, [role, sync]);

  const nativeGameId = snapshot && !["POST_GAME", "ENDED"].includes(snapshot.phase) && "gameLength" in snapshot ? roomSocketGameId(snapshot.gameLength, "arcadeGameId" in snapshot ? snapshot.arcadeGameId : undefined) : null;
  useEffect(() => {
    if (!nativeGameId) return;
    const nativePendingActions = pendingActions.current;
    let stoppedNative = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let lastMessageAt = Date.now();
    let attempt = 0;
    const connect = async () => {
      if (stoppedNative) return;
      try {
        const response = await fetch("/api/rooms/" + code + "/realtime", { method: "POST", credentials: "include", headers: { "X-Callback-Role": role }, signal: AbortSignal.timeout(8000) });
        const ticket = await response.json() as { ticket?: string; workerUrl?: string; roomKey?: string; error?: { message?: string } };
        if (!response.ok || !ticket.ticket || !ticket.workerUrl || !ticket.roomKey) throw new Error(ticket.error?.message ?? "The real-time room is reconnecting.");
        if (stoppedNative) return;
        const url = new URL("/native-arcade/" + ticket.roomKey + "/socket", ticket.workerUrl);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        const current = new WebSocket(url, ["callback-native-v1", ticket.ticket]);
        socket.current = current;
        current.onopen = () => {
          if (stoppedNative || !navigator.onLine) { current.close(); return; }
          attempt = 0; socketConnected.current = true; setReconnecting(false); setError(null);
          lastMessageAt = Date.now();
          watchdog = setInterval(() => { if (Date.now() - lastMessageAt > 10_000) current.close(); }, 2000);
          refreshTimer = setInterval(() => {
            void fetch("/api/rooms/" + code + "/realtime", { method: "POST", credentials: "include", headers: { "X-Callback-Role": role }, signal: AbortSignal.timeout(8000) }).then(async (reply) => {
              if (!reply.ok || current.readyState !== WebSocket.OPEN) return;
              const fresh = await reply.json() as { ticket?: string };
              if (fresh.ticket) current.send(JSON.stringify({ type: "refresh", ticket: fresh.ticket }));
            }).catch(() => undefined);
          }, 20_000);
        };
        current.onmessage = (event) => {
          if (stoppedNative || socket.current !== current || !navigator.onLine) return;
          let message: { type?: string; snapshot?: RoleSnapshot; requestId?: string; ok?: boolean; body?: { error?: { code?: string; message?: string } } };
          try { message = JSON.parse(String(event.data)) as typeof message; } catch { return; }
          if (message.type === "heartbeat" || message.type === "snapshot") lastMessageAt = Date.now();
          if (message.type === "heartbeat") kickJobs(latestSnapshot.current);
          if (message.type === "snapshot" && message.snapshot && shouldAcceptSnapshotVersion(version.current, message.snapshot.stateVersion)) {
            latestSnapshot.current = message.snapshot; kickJobs(message.snapshot);
            version.current = message.snapshot.stateVersion; setSnapshot(message.snapshot); setError(null); setReconnecting(false);
          } else if (message.type === "action-result" && message.requestId) {
            const pending = pendingActions.current.get(message.requestId);
            if (pending) {
              clearTimeout(pending.timer); pendingActions.current.delete(message.requestId);
              if (message.ok) pending.resolve(message.body);
              else pending.reject(new Error(message.body?.error?.message ?? "That action did not go through."));
            }
          }
        };
        current.onclose = () => {
          if (watchdog) clearInterval(watchdog);
          if (socket.current === current) socket.current = null;
          socketConnected.current = false;
          if (refreshTimer) clearInterval(refreshTimer);
          if (stoppedNative) return;
          // HTTP polling remains authoritative and usable while the socket retries.
          // Its own failure path reports an actual loss of room connectivity.
          void sync();
          const delay = Math.min(8000, 700 * 2 ** Math.min(attempt++, 4));
          retryTimer = setTimeout(() => void connect(), delay);
        };
        current.onerror = () => current.close();
      } catch {
        if (stoppedNative) return;
        socketConnected.current = false;
        void sync();
        const delay = Math.min(8000, 700 * 2 ** Math.min(attempt++, 4));
        retryTimer = setTimeout(() => void connect(), delay);
      }
    };
    void connect();
    return () => {
      stoppedNative = true; socketConnected.current = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (refreshTimer) clearInterval(refreshTimer);
      if (watchdog) clearInterval(watchdog);
      const current = socket.current; socket.current = null; current?.close();
      for (const pending of nativePendingActions.values()) { clearTimeout(pending.timer); pending.reject(new Error("Room connection closed.")); }
      nativePendingActions.clear();
    };
  }, [code, nativeGameId, role, sync, kickJobs]);

  const send = useCallback(async (action: PlayerAction | HostAction) => {
    const current = socket.current;
    // Closing waits for coordinator retirement; doing that over its own socket
    // would create a drain/acknowledgement cycle.
    if (current?.readyState === WebSocket.OPEN && action.type !== "END_GAME") {
      const requestId = crypto.randomUUID();
      const result = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => { pendingActions.current.delete(requestId); reject(new Error("The room did not confirm that action.")); }, 15_000);
        pendingActions.current.set(requestId, { resolve, reject, timer });
      });
      current.send(JSON.stringify({ type: "action", requestId, action }));
      try { return await result; }
      catch (cause) { const message = cause instanceof Error ? cause.message : "That action did not go through."; setError({ code: "ACTION_FAILED", message, status: 503 }); throw cause; }
    }
    const endpoint = role === "host" ? "host-actions" : "player-actions";
    const response = await fetch(`/api/rooms/${code}/${endpoint}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    if (!response.ok) { const message = body?.error?.message ?? "That action did not go through."; setError({ code: body?.error?.code ?? "ACTION_FAILED", message, status: response.status }); throw new Error(message); }
    await sync(); return body;
  }, [code, role, sync]);

  const reset = useCallback(() => { version.current = 0; setError(null); void sync(); }, [sync]);
  return { snapshot, error, reconnecting, send, reset, sync };
}

export function useSecondaryDisplayCount(code: string, enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/rooms/${code}/display-status`, { credentials: "include", cache: "no-store" });
        if (!response.ok || stopped) return;
        const body = await response.json() as { count?: number };
        setCount(Math.max(0, Number(body.count ?? 0)));
      } catch { /* The host screen keeps working when the status check is unavailable. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [code, enabled]);
  return count;
}

export function useCountdown(snapshot: RoleSnapshot | null): number | null {
  const [clock, setClock] = useState<{ key: string; remaining: number | null }>({ key: "", remaining: null });
  const key = snapshot ? `${snapshot.phase}:${snapshot.deadlineAt}:${snapshot.paused}` : "";
  const anchor = useRef({ receivedAt: 0, serverTime: 0, deadlineAt: null as number | null });
  useEffect(() => {
    if (!snapshot) return;
    anchor.current = { receivedAt: performance.now(), serverTime: snapshot.serverTime, deadlineAt: snapshot.deadlineAt };
    const tick = () => setClock({ key, remaining: snapshot.paused || !anchor.current.deadlineAt ? null : Math.max(0, anchor.current.deadlineAt - (anchor.current.serverTime + performance.now() - anchor.current.receivedAt)) });
    tick(); const timer = setInterval(tick, 200); return () => clearInterval(timer);
  }, [snapshot, key]);
  // Never expose the previous phase's clock during the render before this effect runs.
  if (!snapshot || snapshot.paused || snapshot.deadlineAt === null) return null;
  return clock.key === key ? clock.remaining : Math.max(0, snapshot.deadlineAt - snapshot.serverTime);
}
