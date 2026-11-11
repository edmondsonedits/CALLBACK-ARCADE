'use client';
import { useEffect } from 'react';

type SessionRole = 'host' | 'player' | 'mirror';
type TicketResponse = { url: string; ticket: string };

/** Keeps one parent connection alive while game iframes are replaced. */
export function useSessionRealtime(code: string, role: SessionRole, refresh: () => Promise<number | undefined>, reconnectKey = 0) {
  useEffect(() => {
    let stopped = false, socket: WebSocket | null = null, socketHealthy = false, lastPongAt = 0, lastHttpRefreshAt = 0;
    let pollTimer: ReturnType<typeof setTimeout> | undefined, reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let snapshotRequest: Promise<number | undefined> | null = null, ticketRequest: Promise<TicketResponse | undefined> | null = null;
    let pendingTicket = false;
    let refreshAgain = false;
    const safeRefresh = () => {
      if (!snapshotRequest) snapshotRequest = refresh().finally(() => { snapshotRequest = null; if (refreshAgain && !stopped) { refreshAgain = false; void safeRefresh(); } });
      return snapshotRequest;
    };
    const getTicket = () => {
      if (!ticketRequest) ticketRequest = fetch(`/api/sessions/${code}/socket-ticket?role=${role}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        .then(async response => response.ok ? await response.json() as TicketResponse : undefined)
        .catch(() => undefined).finally(() => { ticketRequest = null; });
      return ticketRequest;
    };
    const connect = async () => {
      if (stopped || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
      const config = await getTicket(); if (!config || stopped) return scheduleReconnect();
      if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
      try {
        const ws = new WebSocket(config.url, ['callback-session-v1', config.ticket]); socket = ws;
        ws.onopen = () => { if (socket === ws) { socketHealthy = false; lastPongAt = 0; } };
        ws.onmessage = event => {
          if (socket !== ws) return;
          try {
            const message = JSON.parse(String(event.data)) as { type?: string; version?: number; at?: number; expiresAt?: number };
            if (message.type === 'ready' || message.type === 'pong' || message.type === 'refreshed') { socketHealthy = true; lastPongAt = Date.now(); if (message.type === 'pong') pendingTicket = false; }
            if (message.type === 'invalidate' && Number.isSafeInteger(message.version)) { if (snapshotRequest) refreshAgain = true; void safeRefresh(); }
          } catch { /* Ignore malformed frames. */ }
        };
        ws.onclose = () => { if (socket === ws) { socket = null; socketHealthy = false; scheduleReconnect(); } };
        ws.onerror = () => { if (socket === ws) { socketHealthy = false; ws.close(); } };
      } catch { scheduleReconnect(); }
    };
    const scheduleReconnect = () => {
      socketHealthy = false;
      if (!stopped && !reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = undefined; void connect(); }, 1500);
    };
    const poll = async () => {
      if (stopped) return;
      if (!socketHealthy) await safeRefresh();
      if (!stopped) pollTimer = setTimeout(() => void poll(), 1500);
    };
    const heartbeat = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN) { void connect(); return; }
      if (Date.now() - lastPongAt > 12_000) { socketHealthy = false; socket.close(); return; }
      socket.send(JSON.stringify({ type: 'ping', at: Date.now() }));
      if (Date.now() - lastHttpRefreshAt >= 10_000) {
        lastHttpRefreshAt = Date.now();
        const ticketPromise = getTicket(); void safeRefresh();
        void ticketPromise.then(ticket => { if (!ticket || stopped || socket?.readyState !== WebSocket.OPEN || pendingTicket) return; pendingTicket = true; socket.send(JSON.stringify({ type: 'refresh', ticket: ticket.ticket })); });
      }
    };
    void safeRefresh(); void connect(); pollTimer = setTimeout(() => void poll(), 1500);
    const heartbeatTimer = setInterval(heartbeat, 4_000);
    const revoked = (event:Event) => { if ((event as CustomEvent<{code?:string}>).detail?.code !== code || role !== 'player') return; stopped = true; if (pollTimer) clearTimeout(pollTimer); if (reconnectTimer) clearTimeout(reconnectTimer); clearInterval(heartbeatTimer); if (socket && socket.readyState < WebSocket.CLOSING) socket.close(4003,'lobby membership revoked'); socket = null; };
    window.addEventListener('callback:session-revoked',revoked);
    return () => { stopped = true; window.removeEventListener('callback:session-revoked',revoked); if (pollTimer) clearTimeout(pollTimer); if (reconnectTimer) clearTimeout(reconnectTimer); clearInterval(heartbeatTimer); if (socket && socket.readyState < WebSocket.CLOSING) socket.close(); socket = null; };
  }, [code, role, refresh, reconnectKey]);
}
