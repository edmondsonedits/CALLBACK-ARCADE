import { verifyNativeArcadeSocketTicket, type NativeArcadeSocketClaims } from "../../lib/arcade/native-socket-ticket";

export interface NativeArcadeEnv { PARTY_SECRET: string; SITE_ORIGIN: string; NATIVE_ARCADE_ROOM: DurableObjectNamespace; PARTY_ADMISSION: DurableObjectNamespace }
type Meta = { ticket: string; claims: NativeArcadeSocketClaims; version: number; rateAt: number; rateCount: number; sentAt?: number };
const enc = new TextEncoder();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const close = (ws: WebSocket, code: number, reason: string) => { try { ws.close(code, reason); } catch { /* closed */ } };
async function keyFor(room: string, generation: string) { const b = await crypto.subtle.digest("SHA-256", enc.encode(room + ":" + generation)); return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join(""); }
async function bodyObject(req: Request, limit = 2048): Promise<Record<string, unknown> | null> { if (Number(req.headers.get("content-length") ?? 0) > limit) return null; const raw = await req.text(); if (enc.encode(raw).byteLength > limit) return null; try { const x: unknown = JSON.parse(raw); return x && typeof x === "object" && !Array.isArray(x) ? x as Record<string, unknown> : null; } catch { return null; } }
const authorized = (req: Request, secret: string) => req.headers.get("authorization") === "Bearer " + secret;

export async function routeNativeArcade(req: Request, env: NativeArcadeEnv): Promise<Response | null> {
  const url = new URL(req.url), match = /^\/native-arcade\/([a-f0-9]{64})\/(socket|retire)$/u.exec(url.pathname);
  if (!match) return null;
  const [, key, mode] = match;
  if (mode === "socket") {
    if (req.method !== "GET" || req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "NATIVE_ARCADE_UPGRADE_REQUIRED" }, 426);
    try { if (req.headers.get("Origin") !== new URL(env.SITE_ORIGIN).origin) return json({ error: "NATIVE_ARCADE_ORIGIN_FORBIDDEN" }, 403); } catch { return json({ error: "NATIVE_ARCADE_UNAVAILABLE" }, 503); }
    const protocols = (req.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").map(x => x.trim());
    if (protocols.length !== 2 || protocols[0] !== "callback-native-v1") return json({ error: "NATIVE_ARCADE_TICKET_REQUIRED" }, 401);
    let claims: NativeArcadeSocketClaims;
    try { claims = await verifyNativeArcadeSocketTicket(protocols[1]!, env.PARTY_SECRET); } catch { return json({ error: "NATIVE_ARCADE_TICKET_INVALID" }, 401); }
    if (await keyFor(claims.roomId, claims.generationId) !== key) return json({ error: "NATIVE_ARCADE_TICKET_SCOPE" }, 403);
    const admission = env.PARTY_ADMISSION.get(env.PARTY_ADMISSION.idFromName("global"));
    const leaseResponse = await admission.fetch("https://admission/reserve", { method: "POST", body: JSON.stringify({ partyId: claims.partyKey, now: Date.now() }) });
    if (!leaseResponse.ok) return new Response(await leaseResponse.text(), { status: leaseResponse.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    const lease = await leaseResponse.json() as { expiresAt?: number };
    if (!Number.isSafeInteger(lease.expiresAt) || Number(lease.expiresAt) <= Date.now()) return json({ error: "NATIVE_ARCADE_LEASE_INVALID" }, 503);
    const headers = new Headers(req.headers); headers.set("Sec-WebSocket-Protocol", "callback-native-v1"); headers.set("X-Native-Arcade-Ticket", protocols[1]!); headers.set("X-Native-Arcade-Expires", String(lease.expiresAt));
    const target = new URL(req.url); target.pathname = "/socket";
    return env.NATIVE_ARCADE_ROOM.get(env.NATIVE_ARCADE_ROOM.idFromName(key)).fetch(new Request(target, { method: "GET", headers }));
  }
  if (req.method !== "POST" || !authorized(req, env.PARTY_SECRET)) return json({ error: "NATIVE_ARCADE_UNAUTHORIZED" }, 401);
  const body = await bodyObject(req);
  if (!body || Object.keys(body).sort().join(",") !== "generationId,operation,partyKey,roomId" || body.operation !== "retire" || typeof body.roomId !== "string" || typeof body.generationId !== "string" || typeof body.partyKey !== "string" || await keyFor(body.roomId, body.generationId) !== key) return json({ error: "NATIVE_ARCADE_RETIRE_INVALID" }, 400);
  const stub = env.NATIVE_ARCADE_ROOM.get(env.NATIVE_ARCADE_ROOM.idFromName(key));
  const result = await stub.fetch("https://native/retire", { method: "POST", headers: { authorization: "Bearer " + env.PARTY_SECRET, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!result.ok) return new Response(await result.text(), { status: result.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  if (body.partyKey.startsWith("native-")) await env.PARTY_ADMISSION.get(env.PARTY_ADMISSION.idFromName("global")).fetch("https://admission/release", { method: "POST", body: JSON.stringify({ partyId: body.partyKey }) });
  return new Response(await result.text(), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store", "x-native-retired-generation": body.generationId } });
}

export class NativeArcadeRoom {
  private state: DurableObjectState; private env: NativeArcadeEnv;
  private roomId: string | null = null; private generationId: string | null = null; private partyKey: string | null = null; private matchId: string | null = null; private expiresAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null; private busy = false; private retired = false; private tasks = new Set<Promise<unknown>>();
  private syncRequested = false;
  private actionQueue: Promise<void> = Promise.resolve();
  private queuedActions = 0;
  constructor(state: DurableObjectState, env: NativeArcadeEnv) { this.state = state; this.env = env; void state.blockConcurrencyWhile(async () => { const saved = await state.storage.get<{ roomId: string; generationId: string; partyKey: string; matchId: string; expiresAt: number }>("room"); if (saved) Object.assign(this, saved); if (this.sockets().length) this.start(); }); }
  private sockets() { return this.state.getWebSockets(); }
  private meta(ws: WebSocket) { return ws.deserializeAttachment() as Meta | null; }
  private start() { if (this.timer === null) this.timer = setInterval(() => { void this.sync(); }, 500); }
  private stop() { if (this.timer !== null) clearInterval(this.timer); this.timer = null; }
  private async save() { await this.state.storage.put("room", { roomId: this.roomId, generationId: this.generationId, partyKey: this.partyKey, matchId: this.matchId, expiresAt: this.expiresAt }); await this.state.storage.setAlarm(this.expiresAt); }
  private relay(body: unknown) { return fetch(new URL("/api/arcade/native-relay", this.env.SITE_ORIGIN), { method: "POST", headers: { authorization: "Bearer " + this.env.PARTY_SECRET, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); }
  private async sync(immediate = false) {
    if (this.retired) return;
    if (Date.now() >= this.expiresAt) { await this.expire(); return; }
    if (this.busy) { if (immediate) this.syncRequested = true; return; }
    const sockets = this.sockets(); if (!sockets.length) { this.stop(); return; }
    this.busy = true;
    const task = (async () => { try {
      const entries = sockets.flatMap(ws => { const m = this.meta(ws); return m ? [{ ticket: m.ticket, nonce: m.claims.nonce, version: m.version }] : []; });
      const response = await this.relay({ operation: "sync", entries }); if (!response.ok) return;
      const body = await response.json() as { projections?: Array<{ nonce: string; snapshot: unknown | null; version: number; revoked?: boolean; retry?: boolean }> };
      for (const item of body.projections ?? []) {
        const ws = sockets.find(candidate => this.meta(candidate)?.claims.nonce === item.nonce);
        if (!ws) continue;
        if (item.revoked) { close(ws, 1008, "room session expired"); continue; }
        if (item.retry) continue;
        const m = this.meta(ws); if (!m) continue;
        if (item.snapshot !== null) {
          m.version = item.version; m.sentAt = Date.now(); ws.serializeAttachment(m);
          ws.send(JSON.stringify({ type: "snapshot", snapshot: item.snapshot }));
        } else if (Date.now() - (m.sentAt ?? 0) >= 2000) {
          m.sentAt = Date.now(); ws.serializeAttachment(m);
          ws.send(JSON.stringify({ type: "heartbeat" }));
        }
      }
    } catch { /* next room tick retries */ } finally { this.busy = false; } })();
    this.tasks.add(task); try { await task; } finally { this.tasks.delete(task); }
    if (this.syncRequested && !this.retired) { this.syncRequested = false; await this.sync(); }
  }
  private async expire() { if (this.retired) return; this.retired = true; this.stop(); for (const ws of this.sockets()) close(ws, 1001, "native Arcade session expired"); await Promise.allSettled([...this.tasks]); if (this.partyKey?.startsWith("native-")) await this.env.PARTY_ADMISSION.get(this.env.PARTY_ADMISSION.idFromName("global")).fetch("https://admission/release", { method: "POST", body: JSON.stringify({ partyId: this.partyKey }) }); await this.state.storage.deleteAlarm(); await this.state.storage.delete("room"); }
  async alarm() { if (this.expiresAt && Date.now() >= this.expiresAt) await this.expire(); else if (this.expiresAt) await this.state.storage.setAlarm(this.expiresAt); }
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/retire" && req.method === "POST") { if (!authorized(req, this.env.PARTY_SECRET)) return json({ error: "NATIVE_ARCADE_UNAUTHORIZED" }, 401); if (!this.roomId) return json({ error: "NATIVE_ARCADE_NOT_PREPARED" }, 404); const body = await bodyObject(req); if (!body || body.roomId !== this.roomId || body.generationId !== this.generationId || body.partyKey !== this.partyKey) return json({ error: "NATIVE_ARCADE_GENERATION_MISMATCH" }, 409); this.retired = true; this.stop(); for (const ws of this.sockets()) close(ws, 1001, "native Arcade game closed"); await Promise.allSettled([...this.tasks]); await this.state.storage.deleteAlarm(); await this.state.storage.delete("room"); return json({ ok: true, roomId: this.roomId, generationId: this.generationId }); }
    if (url.pathname !== "/socket" || req.method !== "GET" || req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return json({ error: "NATIVE_ARCADE_NOT_FOUND" }, 404);
    const ticket = req.headers.get("X-Native-Arcade-Ticket"); let claims: NativeArcadeSocketClaims;
    try { if (!ticket) throw new Error(); claims = await verifyNativeArcadeSocketTicket(ticket, this.env.PARTY_SECRET); } catch { return json({ error: "NATIVE_ARCADE_TICKET_INVALID" }, 401); }
    const expiry = Number(req.headers.get("X-Native-Arcade-Expires"));
    if (this.retired || !Number.isSafeInteger(expiry) || expiry <= Date.now() || this.roomId !== null && claims.roomId !== this.roomId || this.generationId !== null && claims.generationId !== this.generationId || this.partyKey !== null && claims.partyKey !== this.partyKey) return json({ error: "NATIVE_ARCADE_GENERATION_MISMATCH" }, 409);
    const sockets = this.sockets(), priorActor = (ws: WebSocket) => { const m = this.meta(ws); return m?.claims.actorId === claims.actorId && m.claims.role === claims.role; };
    const retained = sockets.filter(ws => !priorActor(ws));
    if (retained.length >= 14 || claims.role === "player" && retained.filter(ws => this.meta(ws)?.claims.role === "player").length >= 10 || claims.role === "host" && retained.some(ws => this.meta(ws)?.claims.role === "host")) return json({ error: "NATIVE_ARCADE_SOCKET_CAPACITY" }, 429);
    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    if (this.matchId !== null && claims.matchId !== this.matchId) for (const ws of this.sockets()) close(ws, 4002, "Arcade match changed");
    this.roomId = claims.roomId; this.generationId = claims.generationId; this.partyKey = claims.partyKey; this.matchId = claims.matchId; this.expiresAt = this.expiresAt ? Math.min(this.expiresAt, expiry) : expiry;
    this.state.acceptWebSocket(server);
    const old = this.sockets().find(ws => ws !== server && this.meta(ws)?.claims.actorId === claims.actorId && this.meta(ws)?.claims.role === claims.role); if (old) close(old, 4001, "newer controller connected");
    server.serializeAttachment({ ticket, claims, version: 0, rateAt: 0, rateCount: 0 } satisfies Meta); await this.save(); this.start();
    return new Response(null, { status: 101, webSocket: client, headers: { "Sec-WebSocket-Protocol": "callback-native-v1" } });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const m = this.meta(ws); if (!m || this.retired) { close(ws, 1008, "socket not available"); return; }
    const size = typeof message === "string" ? enc.encode(message).byteLength : message.byteLength; if (size > 12000) { close(ws, 1009, "message too large"); return; }
    const now = Date.now(); if (now - m.rateAt >= 1000) { m.rateAt = now; m.rateCount = 0; } m.rateCount += 1; ws.serializeAttachment(m); if (m.rateCount > 20) { close(ws, 1008, "message rate exceeded"); return; }
    let value: unknown; try { value = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { close(ws, 1003, "invalid message"); return; }
    if (!value || typeof value !== "object" || Array.isArray(value) || !["action", "refresh"].includes(String((value as Record<string, unknown>).type)) || Object.keys(value).some(k => !["type", "requestId", "action", "ticket"].includes(k))) { close(ws, 1008, "invalid message"); return; }
    const record = value as Record<string, unknown>;
    if (record.type === "refresh") {
      if (typeof record.ticket !== "string") { close(ws, 1008, "invalid ticket refresh"); return; }
      try {
        const claims = await verifyNativeArcadeSocketTicket(record.ticket, this.env.PARTY_SECRET);
        const prior = m.claims;
        if (claims.roomId !== prior.roomId || claims.generationId !== prior.generationId || claims.partyKey !== prior.partyKey || claims.actorId !== prior.actorId || claims.role !== prior.role || claims.gameId !== prior.gameId || claims.matchId !== prior.matchId) throw new Error();
        m.ticket = record.ticket; m.claims = claims; ws.serializeAttachment(m); ws.send(JSON.stringify({ type: "refreshed" }));
      } catch { close(ws, 1008, "invalid ticket refresh"); }
      return;
    }
    const msg = value as { requestId?: unknown; action?: unknown }; if (typeof msg.requestId !== "string" || msg.requestId.length > 80) { close(ws, 1008, "invalid request id"); return; }
    if (this.queuedActions >= 32) { ws.send(JSON.stringify({ type: "action-result", requestId: msg.requestId, ok: false, status: 429, body: { error: { message: "The room is busy. Try again." } } })); return; }
    this.queuedActions++;
    let committed = false;
    const work = this.actionQueue.then(async () => {
      if (this.retired) return;
      try {
        const fresh = this.meta(ws); if (!fresh) return;
        const response = await this.relay({ operation: "action", ticket: fresh.ticket, action: msg.action });
        const body = await response.json().catch(() => ({}));
        ws.send(JSON.stringify({ type: "action-result", requestId: msg.requestId, ok: response.ok, status: response.status, body }));
        committed = response.ok;
      } catch { try { ws.send(JSON.stringify({ type: "action-result", requestId: msg.requestId, ok: false, status: 503, body: { error: { code: "NATIVE_ARCADE_UNAVAILABLE", message: "The room is reconnecting." } } })); } catch { /* disconnected */ } }
    });
    this.actionQueue = work.catch(() => undefined);
    this.tasks.add(work);
    try { await work; } finally { this.queuedActions--; this.tasks.delete(work); }
    if (committed && !this.retired) await this.sync(true);
  }
  async webSocketClose() { if (!this.sockets().length) this.stop(); }
  async webSocketError() { await this.webSocketClose(); }
}
