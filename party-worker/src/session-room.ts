import { verifySessionSocketTicket, type SessionSocketClaims } from '../../lib/session-socket-ticket';

export interface SessionRoomEnv { PARTY_SECRET: string; SITE_ORIGIN: string }
type Meta = SessionSocketClaims;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const close = (ws: WebSocket, code: number, reason: string) => { try { ws.close(code, reason); } catch { /* socket already closed */ } };

export class SessionRoom {
  constructor(private state: DurableObjectState, private env: SessionRoomEnv) {}
  private sockets() { return this.state.getWebSockets(); }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/notify' && request.method === 'POST') {
      if (!this.env.PARTY_SECRET || request.headers.get('authorization') !== 'Bearer ' + this.env.PARTY_SECRET) return json({ error: 'SESSION_UNAUTHORIZED' }, 401);
      let body: unknown; try { body = await request.json(); } catch { return json({ error: 'SESSION_BODY_INVALID' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'generation,version' || !/^[a-f0-9]{64}$/u.test(String((body as {generation?:unknown}).generation)) || !Number.isSafeInteger((body as {version?:unknown}).version) || Number((body as {version:number}).version) < 1) return json({ error: 'SESSION_BODY_INVALID' }, 400);
      const { version, generation } = body as { version: number; generation: string };
      for (const ws of this.sockets()) { const meta = ws.deserializeAttachment() as Meta | null; if (meta?.generation === generation && meta.expiresAt > Date.now()) { try { ws.send(JSON.stringify({ type: 'invalidate', version })); } catch { close(ws, 1011, 'send failed'); } } }
      return json({ ok: true });
    }
    if (url.pathname !== '/socket' || request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'SESSION_NOT_FOUND' }, 404);
    const protocols = (request.headers.get('sec-websocket-protocol') ?? '').split(',').map(x => x.trim()), ticket = request.headers.get('x-session-ticket');
    if (protocols.length !== 1 || protocols[0] !== 'callback-session-v1' || !ticket) return json({ error: 'SESSION_TICKET_REQUIRED' }, 401);
    let claims: SessionSocketClaims; try { claims = await verifySessionSocketTicket(ticket, this.env.PARTY_SECRET); } catch { return json({ error: 'SESSION_TICKET_INVALID' }, 401); }
    const code = request.headers.get('x-session-code');
    if (claims.code !== code) return json({ error: 'SESSION_TICKET_SCOPE' }, 403);
    const sockets = this.sockets(), same = (ws: WebSocket) => { const m = ws.deserializeAttachment() as Meta | null; return m?.actor === claims.actor && m.role === claims.role; };
    const retained = sockets.filter(ws => !same(ws));
    if (retained.length >= 12 || claims.role === 'player' && retained.filter(ws => (ws.deserializeAttachment() as Meta | null)?.role === 'player').length >= 10 || claims.role === 'host' && retained.some(ws => (ws.deserializeAttachment() as Meta | null)?.role === 'host') || claims.role === 'mirror' && retained.filter(ws => (ws.deserializeAttachment() as Meta | null)?.role === 'mirror').length >= 10) return json({ error: 'SESSION_SOCKET_CAPACITY' }, 429);
    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment(claims);
    const previous = this.sockets().find(ws => ws !== server && same(ws)); if (previous) close(previous, 4001, 'newer lobby connection');
    await this.scheduleExpiry();
    server.send(JSON.stringify({ type: 'ready', version: 0, role: claims.role }));
    return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'callback-session-v1' } });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const meta = ws.deserializeAttachment() as Meta | null;
    if (!meta || meta.expiresAt <= Date.now()) { close(ws, 4004, 'refresh lobby connection'); return; }
    const bytes = typeof message === 'string' ? new TextEncoder().encode(message).byteLength : message.byteLength;
    if (bytes > 2048 || !await this.consumeRateLimit(meta)) { close(ws, 1008, 'message limit exceeded'); return; }
    try {
      const value = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)) as {type?:unknown;at?:unknown;ticket?:unknown};
      if (value?.type === 'ping' && Object.keys(value).sort().join(',') === 'at,type' && Number.isFinite(value.at)) { ws.send(JSON.stringify({ type: 'pong', at: value.at, serverTime: Date.now() })); return; }
      if (value?.type !== 'refresh' || Object.keys(value).sort().join(',') !== 'ticket,type' || typeof value.ticket !== 'string' || value.ticket.length > 2048) { close(ws, 1008, 'unsupported message'); return; }
      const claims = await verifySessionSocketTicket(value.ticket, this.env.PARTY_SECRET);
      if (claims.code !== meta.code || claims.generation !== meta.generation || claims.role !== meta.role || claims.actor !== meta.actor || claims.tokenHash !== meta.tokenHash) { close(ws, 4003, 'lobby credentials changed'); return; }
      const validated = await fetch(new URL('/api/sessions/socket/validate', this.env.SITE_ORIGIN), { method: 'POST', headers: { authorization: 'Bearer ' + this.env.PARTY_SECRET, 'content-type': 'application/json' }, body: JSON.stringify({ ticket: value.ticket }), signal: AbortSignal.timeout(4000) });
      if (!validated.ok) { close(ws, 4003, 'lobby credentials expired'); return; }
      ws.serializeAttachment(claims); await this.scheduleExpiry(); ws.send(JSON.stringify({ type: 'refreshed', expiresAt: claims.expiresAt }));
    } catch { close(ws, 1008, 'invalid message'); }
  }
  async webSocketClose(ws: WebSocket) { close(ws, 1000, 'closed'); await this.scheduleExpiry(); }
  async webSocketError(ws: WebSocket) { await this.webSocketClose(ws); }
  async alarm() { const now = Date.now(); for (const ws of this.sockets()) { const meta = ws.deserializeAttachment() as Meta | null; if (!meta || meta.expiresAt <= now) close(ws, 4004, 'refresh lobby connection'); } await this.scheduleExpiry(); }
  private async consumeRateLimit(meta: Meta) { const now=Date.now(),key=`rate:${meta.generation}:${meta.actor}`,prior=await this.state.storage.get<number[]>(key)??[],active=prior.filter(at=>now-at<1000);if(active.length>=10)return false;active.push(now);await this.state.storage.put(key,active);return true; }
  private async scheduleExpiry() { const next = this.sockets().map(ws => (ws.deserializeAttachment() as Meta | null)?.expiresAt ?? Infinity).filter(n => n > Date.now()).sort((a,b) => a-b)[0]; if (Number.isFinite(next)) await this.state.storage.setAlarm(next); else await this.state.storage.deleteAlarm(); }
}
