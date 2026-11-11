"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HostSnapshot, PlayerSnapshot } from "../../lib/contracts";
import type { ArcadeWireSnapshot } from "../../lib/arcade/presentation";

type RealtimeSnapshot = HostSnapshot | PlayerSnapshot;
type Connection = "connecting" | "live" | "unavailable";
interface TicketResponse { ticket: string; workerUrl: string; role: "host" | "player" | "spectator" }
interface WireEnvelope { v: number; type: string; roomCode: string; gameId: string; matchId?: string; role?: string; lastSeq?: number; phase?: string; paused?: boolean; snapshot?: ArcadeWireSnapshot | null }

export function useArcadeRealtime(code: string, snapshot: RealtimeSnapshot | null, enabled = true) {
  const [game, setGame] = useState<ArcadeWireSnapshot | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [role, setRole] = useState<TicketResponse["role"]>();
  const sequence = useRef(0);
  const lastTapAt = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);
  const lifecycle = snapshot?.gameLength === "arcade" && (snapshot.arcadeGameId === "air-hockey" || snapshot.arcadeGameId === "tap-race" || snapshot.arcadeGameId === "light-trails") && snapshot.arcade
    ? { gameId: snapshot.arcadeGameId, matchId: snapshot.arcade.matchId, phase: snapshot.phase, paused: snapshot.phase === "ARCADE_RESULTS" || snapshot.paused, version: snapshot.version }
    : null;
  const realtimeActive = Boolean(enabled && lifecycle?.phase === "ARCADE_ACTIVE" && !lifecycle.paused);
  const gameId = lifecycle?.gameId;
  const matchId = lifecycle?.matchId;
  const phase = lifecycle?.phase;
  const paused = lifecycle?.paused;
  const version = lifecycle?.version;

  useEffect(() => {
    let stopped = false;
    if (!enabled || !gameId || !matchId || (phase !== "ARCADE_ACTIVE" && phase !== "ARCADE_RESULTS")) {
      queueMicrotask(() => { if (!stopped) { setGame(null); setRole(undefined); setConnection("connecting"); } });
      return () => { stopped = true; };
    }
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let generation = 0;
    let attempts = 0;
    queueMicrotask(() => { if (!stopped) { setGame(null); setRole(undefined); setConnection("connecting"); } });
    const scheduleRetry = () => {
      if (stopped) return;
      setConnection("unavailable");
      const delay = Math.min(5000, 300 * 2 ** Math.min(attempts++, 4));
      retry = setTimeout(() => { void connect(); }, delay);
    };
    const connect = async () => {
      const currentGeneration = ++generation;
      try {
        const sync = await fetch(`/api/rooms/${encodeURIComponent(code)}/arcade-ticket?sync=1`, { method: "POST", credentials: "same-origin", cache: "no-store" });
        if (!sync.ok) throw new Error("ARCADE_SYNC_FAILED");
        const synced = await sync.json() as { phase?: string };
        if (stopped || currentGeneration !== generation) return;
        if (synced.phase !== phase) throw new Error("ARCADE_PHASE_CHANGED");
        if (phase === "ARCADE_RESULTS") { setConnection("live"); setGame(null); return; }
        const ticketResponse = await fetch(`/api/rooms/${encodeURIComponent(code)}/arcade-ticket`, { method: "POST", credentials: "same-origin", cache: "no-store" });
        if (!ticketResponse.ok) throw new Error("ARCADE_TICKET_FAILED");
        const credentials = await ticketResponse.json() as TicketResponse;
        if (stopped || currentGeneration !== generation) return;
        const url = new URL(`/room/${encodeURIComponent(code)}`, credentials.workerUrl);
        url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
        socket = new WebSocket(url);
        socketRef.current = socket;
        const activeSocket = socket;
        let authenticated = false;
        activeSocket.onopen = () => {
          if (stopped || currentGeneration !== generation || socket !== activeSocket) { activeSocket.close(); return; }
          attempts = 0;
          activeSocket.send(credentials.ticket);
        };
        activeSocket.onmessage = (event) => {
          if (stopped || currentGeneration !== generation || socket !== activeSocket || typeof event.data !== "string") return;
          let message: WireEnvelope;
          try { message = JSON.parse(event.data) as WireEnvelope; } catch { return; }
          if (message.v !== 1 || message.roomCode !== code || message.gameId !== gameId || message.matchId !== matchId) return;
          if (message.type === "connected") {
            if (message.role !== credentials.role || (credentials.role === "player" && (!Number.isSafeInteger(message.lastSeq) || message.lastSeq! < -1))) { activeSocket.close(1008, "Invalid connection acknowledgement"); return; }
            if (credentials.role === "player") sequence.current = Math.max(sequence.current, message.lastSeq!);
            authenticated = true;
            setRole(credentials.role); setConnection("live");
            return;
          }
          if (!authenticated || message.type !== "snapshot" || !message.snapshot || message.snapshot.gameId !== gameId) return;
          if (message.phase !== "ARCADE_ACTIVE" || message.paused !== paused) { setConnection("connecting"); activeSocket.close(4000, "Reconciling room state"); return; }
          setGame(message.snapshot);
        };
        activeSocket.onerror = () => activeSocket.close();
        activeSocket.onclose = () => { if (!stopped && currentGeneration === generation && socket === activeSocket) scheduleRetry(); };
      } catch {
        if (!stopped && currentGeneration === generation) scheduleRetry();
      }
    };
    void connect();
    return () => {
      stopped = true; generation += 1;
      if (retry) clearTimeout(retry);
      if (socketRef.current === socket) socketRef.current = null;
      socket?.close();
    };
  }, [code, enabled, gameId, matchId, phase, paused, version]);

  const sendIntent = useCallback((intent: Record<string, unknown>) => {
    const current = socketRef.current;
    if (!current || current.readyState !== WebSocket.OPEN || !realtimeActive) return;
    sequence.current += 1;
    current.send(JSON.stringify({ v: 1, type: "input", ...intent, seq: sequence.current }));
  }, [realtimeActive]);

  const sendPosition = useCallback((x: number, y: number) => sendIntent({ kind: "position", x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) }), [sendIntent]);
  const sendTap = useCallback(() => {
    const now = performance.now();
    if (now - lastTapAt.current < 100) return;
    lastTapAt.current = now;
    sendIntent({ kind: "tap" });
  }, [sendIntent]);
  return { game, connection, role, sendPosition, sendTap, paused: lifecycle?.paused ?? true };
}
