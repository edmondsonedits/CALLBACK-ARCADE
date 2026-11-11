import { verifyArcadeCallback, verifyArcadeTicket } from "../../server/arcade/tickets";
import type { ArcadeGameId } from "../../lib/arcade/contracts";
import { getArcadeGame } from "./games/registry";
import { MAX_ARCADE_PLAYERS, MIN_ARCADE_PLAYERS, type ArcadePlayerInput, type ArcadeViewer } from "./games/types";
import { AIR_HOCKEY_SNAPSHOT_EVERY_TICKS, AIR_HOCKEY_STEP_MS } from "./games/air-hockey";

interface RoomEnv {
  ARCADE_TICKET_SECRET: string;
  ARCADE_CONTROL_SECRET: string;
  ARCADE_CALLBACK_SECRET: string;
  SITE_CALLBACK_URL: string;
}
interface Session { roomCode: string; gameId: string; matchId: string; role: "host" | "player" | "spectator"; playerId: string | null; exp: number; lastSeq: number; lastInputAt: number; pendingRoom?: string; pendingSince?: number; authenticated?: boolean }
interface ControlMessage { v: 1; roomCode: string; gameId: string; matchId: string; nextMatchId?: string; roomVersion: number; controllerIds: string[]; action: "start" | "pause" | "resume" | "rematch" | "finish" | "lobby" | "update_seats" | "sync"; phase?: "ARCADE_ACTIVE" | "ARCADE_RESULTS"; paused?: boolean; revokedControllerIds?: string[] }
interface PendingCallback { roomCode: string; events?: Record<string, unknown>[]; event?: Record<string, unknown>; attempts: number }
interface PlayerInputGuard { seq: number; lastInputAt: number; kind?: "position" | "tap"; x?: number; y?: number }
interface PersistedRuntime { v: 1; gameId: string; matchId: string; roomCode?: string; phase: "LOBBY" | "ARCADE_ACTIVE" | "ARCADE_RESULTS"; paused: boolean; tick: number; roomVersion: number; controllerIds: string[]; revokedControllerIds?: string[]; gameState: unknown }
interface CommittedControlIdentity { roomVersion: number; identity: string }
const AUTH_TIMEOUT_MS = 5_000;
const MAX_PENDING_SOCKETS = 16;
const MAX_ALARM_SCHEDULE_ATTEMPTS = 16;
const MAX_ALARM_RETRY_DELAY_MS = 1_000;

function isValidControllerIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= MIN_ARCADE_PLAYERS && value.length <= MAX_ARCADE_PLAYERS && value.every((id) => typeof id === "string" && id.length >= 1 && id.length <= 120) && new Set(value).size === value.length;
}

type ParsedInputIntent = { kind: "position"; seq: number; x: number; y: number } | { kind: "tap"; seq: number };

function parseInputIntent(value: Record<string, unknown>): ParsedInputIntent | null {
  if (value.type !== "input" || value.v !== 1 || !Number.isSafeInteger(value.seq) || Number(value.seq) < 0) return null;
  const keys = Object.keys(value).sort().join(",");
  if (value.kind === "tap" && keys === "kind,seq,type,v") return { kind: "tap", seq: Number(value.seq) };
  if (value.kind === "position" && keys === "kind,seq,type,v,x,y" && typeof value.x === "number" && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1 && typeof value.y === "number" && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1) return { kind: "position", seq: Number(value.seq), x: value.x, y: value.y };
  // Preserve the existing Air Hockey phone message as a position input.
  if (!Object.hasOwn(value, "kind") && keys === "seq,type,v,x,y" && typeof value.x === "number" && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1 && typeof value.y === "number" && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1) return { kind: "position", seq: Number(value.seq), x: value.x, y: value.y };
  return null;
}

function isPersistedRuntime(value: unknown): value is PersistedRuntime {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const runtime = value as Record<string, unknown>;
  const controllerIds = runtime.controllerIds;
  if (runtime.v !== 1 || typeof runtime.gameId !== "string" || runtime.gameId.length === 0 || typeof runtime.matchId !== "string" || runtime.matchId.length === 0 || (runtime.roomCode !== undefined && (typeof runtime.roomCode !== "string" || !/^[A-Z0-9]{4,8}$/u.test(runtime.roomCode))) || !["LOBBY", "ARCADE_ACTIVE", "ARCADE_RESULTS"].includes(String(runtime.phase)) || typeof runtime.paused !== "boolean" || !Number.isSafeInteger(runtime.tick) || Number(runtime.tick) < 0 || !Number.isSafeInteger(runtime.roomVersion) || Number(runtime.roomVersion) <= 0 || !isValidControllerIds(controllerIds) || typeof runtime.gameState !== "object" || runtime.gameState === null || Array.isArray(runtime.gameState)) return false;
  const revokedControllerIds = runtime.revokedControllerIds;
  return revokedControllerIds === undefined || (Array.isArray(revokedControllerIds) && revokedControllerIds.every((id) => typeof id === "string" && controllerIds.includes(id)) && new Set(revokedControllerIds).size === revokedControllerIds.length);
}

export class ArcadeRoom {
  private gameState: unknown = null;
  private tick = 0;
  private matchId: string | null = null;
  private phase: "LOBBY" | "ARCADE_ACTIVE" | "ARCADE_RESULTS" = "LOBBY";
  private paused = false;
  private gameId: string | null = null;
  private roomVersion = 0;
  private controllerIds: string[] = [];
  private revokedControllerIds: string[] = [];
  private initializePromise: Promise<void> | null = null;
  private simulationTimer: ReturnType<typeof setInterval> | null = null;
  private simulationTickInFlight = false;
  private lastSimulationAt = 0;
  private simulationAccumulatorMs = 0;
  private roomCode: string | null = null;
  private quarantineReason: string | null = null;

  constructor(private readonly state: DurableObjectState, private readonly env: RoomEnv) {}

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    if (this.quarantineReason) return this.quarantineResponse();
    await this.ensureOutboxAlarm();
    this.ensureSimulationLoop();
    const url = new URL(request.url);
    const roomMatch = /^\/(room|control)\/([A-Z0-9]{4,8})$/u.exec(url.pathname);
    if (!roomMatch) return new Response("Not found", { status: 404 });
    this.roomCode = roomMatch[2]!;
    if (roomMatch[1] === "room") return this.openSocket(request, roomMatch[2]!);
    return this.handleControl(request, roomMatch[2]!);
  }

  private openSocket(request: Request, roomCode: string): Response {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
    const pending = this.state.getWebSockets().filter((socket) => (socket.deserializeAttachment() as { authenticated?: boolean } | null)?.authenticated !== true);
    if (pending.length >= MAX_PENDING_SOCKETS) return new Response("Too many unauthenticated connections", { status: 429, headers: { "Retry-After": "2" } });
    const pair = new WebSocketPair();
    const client = pair[0]; const server = pair[1];
    this.state.acceptWebSocket(server);
    this.ensureSimulationLoop();
    const pendingSince = Date.now();
    server.serializeAttachment({ pendingRoom: roomCode, pendingSince });
    void this.scheduleAlarm(pendingSince + AUTH_TIMEOUT_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureInitialized();
    if (this.quarantineReason) { this.rejectQuarantinedSocket(socket); return; }
    await this.ensureOutboxAlarm();
    this.ensureSimulationLoop();
    if (typeof message !== "string" || message.length > 4096) { socket.close(1003, "Text protocol required"); return; }
    const attachment = socket.deserializeAttachment() as (Session & { pendingRoom?: string; authenticated?: boolean }) | null;
    if (!attachment?.authenticated) {
      if (!attachment?.pendingSince || Date.now() - attachment.pendingSince > AUTH_TIMEOUT_MS) { socket.close(1008, "Authentication timeout"); return; }
      await this.authenticateSocket(socket, attachment?.pendingRoom, message);
      return;
    }
    let input: unknown;
    try { input = JSON.parse(message) as unknown; } catch { socket.close(1007, "Invalid message"); return; }
    if (!input || typeof input !== "object" || Array.isArray(input)) { socket.close(1007, "Invalid message"); return; }
    const value = input as Record<string, unknown>;
    const intent = parseInputIntent(value);
    // Lifecycle controls are never accepted from a client WebSocket.
    if (!intent || attachment.role !== "player") {
      socket.send(JSON.stringify({ v: 1, type: "error", code: "INVALID_INPUT" })); return;
    }
    const now = Date.now();
    if (this.phase !== "ARCADE_ACTIVE" || this.paused || !this.matchId || attachment.matchId !== this.matchId || !attachment.playerId || !this.controllerIds.includes(attachment.playerId) || this.revokedControllerIds.includes(attachment.playerId)) { socket.close(1008, "Seat is no longer assigned"); return; }
    const game = getArcadeGame(attachment.gameId);
    if (!game || !this.gameState) return;
    if (!game.inputKinds.includes(intent.kind)) { socket.send(JSON.stringify({ v: 1, type: "error", code: "INVALID_INPUT_KIND" })); return; }
    const inputState: ArcadePlayerInput = intent.kind === "position"
      ? { ...intent, playerId: attachment.playerId, receivedAt: now }
      : { ...intent, playerId: attachment.playerId, receivedAt: now };
    if (game.validateInput && !game.validateInput(this.gameState, inputState, now)) { socket.send(JSON.stringify({ v: 1, type: "error", code: "INVALID_INPUT" })); return; }
    const sequenceKey = `seq:${this.matchId}:${attachment.playerId}`;
    const guardResult = await this.state.storage.transaction(async (txn) => {
      const prior = await txn.get<PlayerInputGuard>(sequenceKey) ?? { seq: -1, lastInputAt: 0 };
      if (intent.seq <= prior.seq) return "STALE_SEQUENCE";
      const unchanged = intent.kind === "position" && prior.kind === "position" && prior.x === intent.x && prior.y === intent.y;
      if (unchanged) {
        await txn.put(sequenceKey, { ...prior, seq: intent.seq } satisfies PlayerInputGuard);
        return "unchanged";
      }
      if (now - prior.lastInputAt < game.inputCooldownMs) return "RATE_LIMITED";
      await txn.put(sequenceKey, { seq: intent.seq, lastInputAt: now, kind: intent.kind, ...(intent.kind === "position" ? { x: intent.x, y: intent.y } : {}) } satisfies PlayerInputGuard);
      return "accepted";
    });
    if (guardResult === "unchanged") return;
    if (guardResult !== "accepted") { socket.send(JSON.stringify({ v: 1, type: "error", code: guardResult })); return; }
    attachment.lastSeq = intent.seq; attachment.lastInputAt = now; socket.serializeAttachment(attachment);
    const previousGameState = structuredClone(this.gameState);
    const callbackEvents: Record<string, unknown>[] = [];
    try {
      this.gameState = game.applyInput(this.gameState, inputState, { now, emit: callbackEvents.push.bind(callbackEvents) });
      if (game.persistInputImmediately !== false || callbackEvents.length > 0) await this.commitRuntimeAndEvents(callbackEvents);
    } catch (error) {
      this.gameState = previousGameState;
      socket.send(JSON.stringify({ v: 1, type: "error", code: error instanceof Error ? error.message : "INVALID_INPUT" }));
      return;
    }
  }

  private async authenticateSocket(socket: WebSocket, expectedRoom: string | undefined, ticket: string): Promise<void> {
    try {
      if (!expectedRoom) throw new Error("INVALID_ROOM");
      const claims = await verifyArcadeTicket(ticket, this.env.ARCADE_TICKET_SECRET, { roomCode: expectedRoom, matchId: this.matchId ?? undefined, gameId: (this.gameId as ArcadeGameId | null) ?? undefined });
      if (claims.role === "host" ? claims.playerId !== null : !claims.playerId) throw new Error("INVALID_ROLE");
      if (claims.role === "player" && (!this.controllerIds.includes(claims.playerId!) || this.revokedControllerIds.includes(claims.playerId!))) throw new Error("UNASSIGNED_SEAT");
      const nonceKey = `ticket:${claims.nonce}`;
      const consumed = await this.state.storage.transaction(async (txn) => {
        const prior = await txn.get<number>(nonceKey);
        if (prior !== undefined && prior > Date.now()) return false;
        await txn.put(nonceKey, claims.exp);
        return true;
      });
      if (!consumed) throw new Error("TICKET_REPLAY");
      await this.scheduleAlarm(claims.exp + 60_000);
      const persistedInput = claims.role === "player" && claims.playerId ? await this.state.storage.get<PlayerInputGuard>(`seq:${claims.matchId}:${claims.playerId}`) : undefined;
      const lastSeq = Number.isSafeInteger(persistedInput?.seq) && Number(persistedInput?.seq) >= 0 ? Number(persistedInput!.seq) : -1;
      const lastInputAt = Number.isFinite(persistedInput?.lastInputAt) ? Number(persistedInput!.lastInputAt) : 0;
      socket.serializeAttachment({ roomCode: claims.roomCode, gameId: claims.gameId, matchId: claims.matchId, role: claims.role, playerId: claims.playerId, exp: claims.exp, lastSeq, lastInputAt, authenticated: true });
      socket.send(JSON.stringify({ v: 1, type: "connected", roomCode: claims.roomCode, gameId: claims.gameId, role: claims.role, matchId: claims.matchId, ...(claims.role === "player" ? { lastSeq } : {}) }));
      this.sendSnapshot(socket, claims.roomCode, claims.gameId, { role: claims.role, playerId: claims.playerId });
      this.ensureSimulationLoop();
    } catch {
      socket.send(JSON.stringify({ v: 1, type: "error", code: "UNAUTHORIZED" }));
      socket.close(1008, "Unauthorized");
    }
  }

  private async handleControl(request: Request, roomCode: string): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    const raw = await request.text();
    if (raw.length > 4096) return new Response("Too large", { status: 413 });
    try {
      await verifyArcadeCallback(raw, { timestamp: request.headers.get("x-arcade-timestamp") ?? undefined, nonce: request.headers.get("x-arcade-nonce") ?? undefined, signature: request.headers.get("x-arcade-signature") ?? undefined }, this.env.ARCADE_CONTROL_SECRET);
    } catch { return new Response("Unauthorized", { status: 401 }); }
    let control: ControlMessage;
    try { control = JSON.parse(raw) as ControlMessage; } catch { return new Response("Invalid control", { status: 400 }); }
    if (!control || control.v !== 1 || control.roomCode !== roomCode || !/^[a-z-]{2,40}$/u.test(control.gameId) || typeof control.matchId !== "string" || control.matchId.length < 1 || control.matchId.length > 120 || (control.nextMatchId !== undefined && (typeof control.nextMatchId !== "string" || control.nextMatchId.length < 1 || control.nextMatchId.length > 120)) || !Number.isSafeInteger(control.roomVersion) || !isValidControllerIds(control.controllerIds) || !["start", "pause", "resume", "rematch", "finish", "lobby", "update_seats", "sync"].includes(control.action) || (control.action === "sync" ? !["ARCADE_ACTIVE", "ARCADE_RESULTS"].includes(String(control.phase)) || typeof control.paused !== "boolean" || (control.phase === "ARCADE_RESULTS" && control.paused !== true) || (control.revokedControllerIds !== undefined && (!Array.isArray(control.revokedControllerIds) || control.revokedControllerIds.some((id) => typeof id !== "string" || !control.controllerIds.includes(id)) || new Set(control.revokedControllerIds).size !== control.revokedControllerIds.length)) : control.phase !== undefined || control.paused !== undefined || control.revokedControllerIds !== undefined)) return new Response("Invalid control", { status: 400 });
    if (control.action === "update_seats") return new Response("Controller seats are fixed for each match", { status: 409 });
    const controlIdentity = JSON.stringify({ v: control.v, roomCode: control.roomCode, gameId: control.gameId, matchId: control.matchId, nextMatchId: control.nextMatchId ?? null, roomVersion: control.roomVersion, controllerIds: control.controllerIds, action: control.action, phase: control.phase ?? null, paused: control.paused ?? null, revokedControllerIds: [...(control.revokedControllerIds ?? [])].sort() });
    const currentVersionStatus = await this.state.storage.transaction(async (txn) => {
      const latestVersion = await txn.get<number>("room-version") ?? 0;
      if (control.roomVersion > latestVersion) return "new";
      if (control.roomVersion < latestVersion) return "superseded";
      const committed = await txn.get<CommittedControlIdentity>("control-identity");
      return committed?.roomVersion === control.roomVersion && committed.identity === controlIdentity ? "idempotent" : "conflict";
    });
    if (currentVersionStatus === "idempotent") return Response.json({ ok: true, roomVersion: control.roomVersion, idempotent: true });
    if (currentVersionStatus === "superseded") return Response.json({ ok: true, roomVersion: (await this.state.storage.get<number>("room-version")) ?? this.roomVersion, superseded: true });
    if (currentVersionStatus === "conflict") return new Response("Conflicting control for committed version", { status: 409 });
    const game = getArcadeGame(control.gameId);
    if (!game) return new Response("Game unavailable", { status: 503 });
    const syncStartsNewMatch = control.action === "sync" && control.phase === "ARCADE_ACTIVE" && control.matchId !== this.matchId;
    const createsMatch = control.action === "start" || control.action === "rematch" || syncStartsNewMatch;
    if (createsMatch && (control.controllerIds.length < game.minPlayers || control.controllerIds.length > game.maxPlayers)) return new Response("Player count does not match game capacity", { status: 409 });
    if (control.roomVersion <= this.roomVersion) return new Response("Control version is already committed", { status: 409 });
    const isStart = control.action === "start";
    const isLobby = control.action === "lobby";
    const isSync = control.action === "sync";
    if (isSync) {
      if (control.phase === "ARCADE_RESULTS") {
        if (control.matchId !== this.matchId || control.gameId !== this.gameId || this.phase !== "ARCADE_RESULTS" || !this.gameState || !game.finalResult?.(this.gameState)) return new Response("Worker match is not complete", { status: 409 });
      } else if (syncStartsNewMatch) {
        if (this.phase !== "LOBBY" && this.phase !== "ARCADE_RESULTS") return new Response("Cannot replace an active match", { status: 409 });
      } else if (control.matchId !== this.matchId || control.gameId !== this.gameId || this.phase !== "ARCADE_ACTIVE") return new Response("Stale game or match", { status: 409 });
    } else if (isStart ? this.phase !== "LOBBY" : control.gameId !== this.gameId || control.matchId !== this.matchId) return new Response("Stale game or match", { status: 409 });
    if (!isStart && control.action !== "rematch" && !syncStartsNewMatch && (control.controllerIds.length !== this.controllerIds.length || control.controllerIds.some((id, index) => id !== this.controllerIds[index]))) return new Response("Controller seats are fixed for each match", { status: 409 });
    if ((isStart && this.phase !== "LOBBY") || (control.action === "rematch" && (this.phase !== "ARCADE_RESULTS" || !control.nextMatchId || control.nextMatchId === this.matchId || control.nextMatchId.length > 120)) || (isLobby && this.phase !== "ARCADE_RESULTS") || (control.action === "pause" && (this.phase !== "ARCADE_ACTIVE" || this.paused)) || (control.action === "resume" && (this.phase !== "ARCADE_ACTIVE" || !this.paused)) || (control.action === "finish" && this.phase !== "ARCADE_ACTIVE")) return new Response("Wrong phase", { status: 409 });
    const nonceKey = `control:${request.headers.get("x-arcade-nonce")!}`;
    const controlNow = Date.now();
    let nextGameState = structuredClone(createsMatch ? game.createState(control.action === "rematch" ? control.nextMatchId! : control.matchId, controlNow, control.controllerIds) : this.gameState);
    const nextRevokedControllerIds = isSync
      ? [...new Set([...(syncStartsNewMatch ? [] : this.revokedControllerIds), ...(control.revokedControllerIds ?? [])])]
      : isStart || control.action === "rematch" || isLobby ? [] : [...this.revokedControllerIds];
    if (control.action === "pause" && game.pause) nextGameState = game.pause(nextGameState, controlNow);
    if (control.action === "resume" && game.resume) nextGameState = game.resume(nextGameState, controlNow);
    if (isSync && !createsMatch && control.phase === "ARCADE_ACTIVE" && control.paused !== this.paused) {
      if (control.paused && game.pause) nextGameState = game.pause(nextGameState, controlNow);
      if (!control.paused && game.resume) nextGameState = game.resume(nextGameState, controlNow);
    }
    const nextRuntime: PersistedRuntime = {
      v: 1,
      gameId: control.gameId,
      matchId: control.action === "rematch" ? control.nextMatchId! : isStart || syncStartsNewMatch ? control.matchId : (this.matchId ?? control.matchId),
      roomCode,
      phase: isLobby ? "LOBBY" : isStart || control.action === "rematch" || (isSync && control.phase === "ARCADE_ACTIVE") ? "ARCADE_ACTIVE" : control.action === "finish" || (isSync && control.phase === "ARCADE_RESULTS") ? "ARCADE_RESULTS" : this.phase,
      paused: isLobby || isStart || control.action === "rematch" ? false : isSync ? control.paused! : control.action === "pause" ? true : control.action === "resume" ? false : this.paused,
      tick: isLobby || isStart || control.action === "rematch" || syncStartsNewMatch ? 0 : this.tick,
      roomVersion: control.roomVersion,
      controllerIds: [...control.controllerIds],
      revokedControllerIds: nextRevokedControllerIds,
      gameState: nextGameState,
    };
    try {
      const committed = await this.state.storage.transaction(async (txn) => {
        const priorNonce = await txn.get<number>(nonceKey);
        if (priorNonce !== undefined && priorNonce > Date.now()) return "replay";
        const latestVersion = await txn.get<number>("room-version") ?? 0;
        const persisted = await txn.get<PersistedRuntime>("runtime:v1");
        if (control.roomVersion < latestVersion) return "superseded";
        if (control.roomVersion === latestVersion) {
          const committed = await txn.get<CommittedControlIdentity>("control-identity");
          return committed?.roomVersion === control.roomVersion && committed.identity === controlIdentity ? "idempotent" : "conflict";
        }
        if (control.roomVersion <= this.roomVersion) return "stale";
        if (persisted && (persisted.gameId !== this.gameId || persisted.matchId !== this.matchId || persisted.roomVersion !== this.roomVersion)) return "stale-runtime";
        if (!isStart && !syncStartsNewMatch && (!persisted || persisted.gameId !== control.gameId || persisted.matchId !== control.matchId)) return "stale-match";
        await txn.put("runtime:v1", nextRuntime);
        await txn.put("room-version", control.roomVersion);
        await txn.put("control-identity", { roomVersion: control.roomVersion, identity: controlIdentity } satisfies CommittedControlIdentity);
        await txn.put(nonceKey, Date.now() + 60_000);
        return "committed";
      });
      if (committed === "replay") return new Response("Replay", { status: 409 });
      if (committed === "idempotent") return Response.json({ ok: true, roomVersion: control.roomVersion, idempotent: true });
      if (committed === "superseded") return Response.json({ ok: true, roomVersion: (await this.state.storage.get<number>("room-version")) ?? this.roomVersion, superseded: true });
      if (committed === "conflict") return new Response("Conflicting control for committed version", { status: 409 });
      if (committed !== "committed") return new Response("Stale control", { status: 409 });
    } catch { return new Response("Control persistence failed", { status: 503 }); }
    const previousMatchId = this.matchId;
    const newlyRevoked = nextRevokedControllerIds.filter((id) => !this.revokedControllerIds.includes(id));
    this.gameId = nextRuntime.gameId; this.matchId = nextRuntime.matchId; this.phase = nextRuntime.phase; this.paused = nextRuntime.paused; this.tick = nextRuntime.tick; this.roomVersion = nextRuntime.roomVersion; this.controllerIds = [...nextRuntime.controllerIds]; this.revokedControllerIds = [...nextRevokedControllerIds]; this.gameState = structuredClone(nextRuntime.gameState);
    if (((isStart || control.action === "rematch" || syncStartsNewMatch) && previousMatchId !== this.matchId) || isLobby) this.closePlayerSockets("Match changed; reconnect with a new ticket.");
    else if (newlyRevoked.length) this.closeRevokedPlayerSockets(newlyRevoked);
    if (this.phase !== "ARCADE_ACTIVE" || this.paused) this.stopSimulationLoop();
    else this.ensureSimulationLoop();
    this.broadcastSnapshot(roomCode, control.gameId);
    this.scheduleSimulationWake();
    return Response.json({ ok: true, roomVersion: control.roomVersion });
  }

  private sendSnapshot(socket: WebSocket, roomCode: string, gameId: string, viewer: ArcadeViewer): void {
    const game = getArcadeGame(gameId);
    socket.send(JSON.stringify({ v: 1, type: "snapshot", roomCode, gameId, phase: this.phase, paused: this.paused, matchId: this.matchId, snapshot: game && this.gameState ? game.snapshot(this.gameState, this.tick, viewer) : null }));
  }

  private closePlayerSockets(reason: string): void { for (const socket of this.state.getWebSockets()) { const session = socket.deserializeAttachment() as Session & { authenticated?: boolean } | null; if (session?.authenticated && session.role !== "host") socket.close(4001, reason); } }
  private closeRevokedPlayerSockets(playerIds: readonly string[]): void {
    const revoked = new Set(playerIds);
    for (const socket of this.state.getWebSockets()) {
      const session = socket.deserializeAttachment() as Session & { authenticated?: boolean } | null;
      if (session?.authenticated && session.role === "player" && session.playerId && revoked.has(session.playerId)) socket.close(4001, "Controller seat was revoked.");
    }
  }
  private async ensureInitialized(): Promise<void> {
    if (!this.initializePromise) this.initializePromise = (async () => {
      const saved = await this.state.storage.get<unknown>("runtime:v1");
      if (saved === undefined) {
        const savedVersion = await this.state.storage.get<number>("room-version") ?? 0;
        if (!Number.isSafeInteger(savedVersion) || savedVersion !== 0) this.enterQuarantine("MISSING_PERSISTED_RUNTIME");
        return;
      }
      if (!isPersistedRuntime(saved)) { this.enterQuarantine("INVALID_PERSISTED_RUNTIME"); return; }
      const persistedRoomVersion = await this.state.storage.get<unknown>("room-version");
      if (!Number.isSafeInteger(persistedRoomVersion) || persistedRoomVersion !== saved.roomVersion) { this.enterQuarantine("PERSISTED_ROOM_VERSION_MISMATCH"); return; }
      const savedGame = getArcadeGame(saved.gameId);
      if (!savedGame || saved.controllerIds.length < savedGame.minPlayers || saved.controllerIds.length > savedGame.maxPlayers) { this.enterQuarantine("INCOMPATIBLE_PERSISTED_GAME_CAPACITY"); return; }
      this.gameId = saved.gameId; this.matchId = saved.matchId; this.roomCode = saved.roomCode ?? null; this.phase = saved.phase; this.paused = saved.paused; this.tick = saved.tick; this.roomVersion = saved.roomVersion; this.controllerIds = [...saved.controllerIds]; this.revokedControllerIds = [...(saved.revokedControllerIds ?? [])]; this.gameState = structuredClone(saved.gameState);
      if (savedGame.restoreLatestInputOnLoad && saved.phase === "ARCADE_ACTIVE" && !saved.paused) {
        for (const playerId of saved.controllerIds) {
          const guard = await this.state.storage.get<PlayerInputGuard>(`seq:${saved.matchId}:${playerId}`);
          if (guard?.kind !== "position" || !Number.isSafeInteger(guard.seq) || !Number.isFinite(guard.lastInputAt) || !Number.isFinite(guard.x) || !Number.isFinite(guard.y)) continue;
          const input: ArcadePlayerInput = { kind: "position", playerId, seq: guard.seq, x: guard.x!, y: guard.y!, receivedAt: guard.lastInputAt };
          if (savedGame.validateInput?.(this.gameState, input, guard.lastInputAt)) this.gameState = savedGame.applyInput(this.gameState, input, { now: guard.lastInputAt, emit: () => {} });
        }
      }
    })().catch((error) => { this.initializePromise = null; throw error; });
    await this.initializePromise;
  }

  private enterQuarantine(reason: string): void {
    if (this.quarantineReason) return;
    this.quarantineReason = reason;
    this.stopSimulationLoop();
    console.error(`[arcade-room] quarantined: ${reason}`);
  }

  private quarantineResponse(): Response {
    return Response.json({ v: 1, type: "error", code: "ROOM_QUARANTINED" }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  private rejectQuarantinedSocket(socket: WebSocket): void {
    try { socket.send(JSON.stringify({ v: 1, type: "error", code: "ROOM_QUARANTINED" })); } catch { /* socket may already be closed */ }
    try { socket.close(1011, "Room unavailable"); } catch { /* socket may already be closed */ }
  }

  private async persistRuntime(): Promise<void> {
    if (!this.gameId || !this.matchId || !this.gameState) return;
    await this.state.storage.put("runtime:v1", this.runtimeSnapshot());
  }

  private runtimeSnapshot(): PersistedRuntime {
    return { v: 1, gameId: this.gameId!, matchId: this.matchId!, ...(this.roomCode ? { roomCode: this.roomCode } : {}), phase: this.phase, paused: this.paused, tick: this.tick, roomVersion: this.roomVersion, controllerIds: [...this.controllerIds], revokedControllerIds: [...this.revokedControllerIds], gameState: structuredClone(this.gameState) };
  }

  private async commitRuntimeAndEvents(events: Record<string, unknown>[]): Promise<void> {
    if (!this.gameId || !this.matchId || !this.gameState) return;
    if (events.length && (!this.env.SITE_CALLBACK_URL || !this.env.ARCADE_CALLBACK_SECRET)) throw new Error("ARCADE_CALLBACK_UNCONFIGURED");
    const normalized: Record<string, unknown>[] = events.map((event): Record<string, unknown> => {
      if (typeof event.eventId !== "string" || event.eventId.length < 1 || event.eventId.length > 120) throw new Error("INVALID_GAME_EVENT");
      return { ...event, matchId: this.matchId! };
    });
    const key = normalized.length ? `outbox:${this.matchId}:${String(normalized[0]!["eventId"])}` : null;
    const entry: PendingCallback | null = normalized.length ? { roomCode: this.roomCode ?? "", events: normalized, attempts: 0 } : null;
    if (normalized.length && !entry!.roomCode) throw new Error("ARCADE_ROOM_CODE_MISSING");
    const result = await this.state.storage.transaction(async (txn) => {
      if (key && entry) {
        const prior = await txn.get<PendingCallback>(key);
        const priorEvents = prior?.events ?? (prior?.event ? [prior.event] : []);
        if (prior && JSON.stringify(priorEvents) !== JSON.stringify(normalized)) return "conflict";
        if (!prior) await txn.put(key, entry);
      }
      await txn.put("runtime:v1", this.runtimeSnapshot());
      return "committed";
    });
    if (result !== "committed") throw new Error("ARCADE_EVENT_CONFLICT");
    if (key) await this.scheduleAlarmWithRetry(Date.now() + 1_000);
  }

  private async scheduleAlarmWithRetry(timestamp: number): Promise<void> {
    // The event/outbox transaction is already durable. A transient alarm-storage
    // error must not make the caller roll its in-memory state back past commit.
    // Keep this burst finite: DurableObjectState.waitUntil has no effect in DOs,
    // and an unbounded loop would hold work forever during a storage outage.
    for (let attempt = 0; attempt < MAX_ALARM_SCHEDULE_ATTEMPTS; attempt += 1) {
      try { await this.scheduleAlarm(timestamp); return; }
      catch {
        if (attempt < MAX_ALARM_SCHEDULE_ATTEMPTS - 1) {
          const delay = Math.min(MAX_ALARM_RETRY_DELAY_MS, 25 * 2 ** attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  private async ensureOutboxAlarm(): Promise<void> {
    const pending = await this.state.storage.list<PendingCallback>({ prefix: "outbox:" });
    if (pending.size) await this.scheduleAlarmWithRetry(Date.now() + 1_000);
  }

  private ensureSimulationLoop(): void {
    if (this.quarantineReason || this.simulationTimer || this.phase !== "ARCADE_ACTIVE" || this.paused || !this.gameId || !this.gameState) return;
    const game = getArcadeGame(this.gameId);
    if (!game?.step) return;
    this.lastSimulationAt = performance.now();
    this.simulationAccumulatorMs = 0;
    this.simulationTimer = setInterval(() => { void this.simulateFrame(); }, AIR_HOCKEY_STEP_MS);
    this.scheduleSimulationWake();
  }

  private scheduleSimulationWake(): void {
    const game = this.gameId ? getArcadeGame(this.gameId) : undefined;
    if (this.phase === "ARCADE_ACTIVE" && !this.paused && game?.step) void this.scheduleAlarm(Date.now() + 1_000).catch(() => {});
  }

  private stopSimulationLoop(): void {
    if (!this.simulationTimer) return;
    clearInterval(this.simulationTimer);
    this.simulationTimer = null;
  }

  private async simulateFrame(): Promise<void> {
    if (this.quarantineReason || this.simulationTickInFlight || this.phase !== "ARCADE_ACTIVE" || this.paused || !this.gameId || !this.matchId || !this.gameState) return;
    const game = getArcadeGame(this.gameId);
    if (!game?.step) { this.stopSimulationLoop(); return; }
    this.simulationTickInFlight = true;
    const previousGameState = structuredClone(this.gameState);
    const previousTick = this.tick;
    const previousPhase = this.phase;
    const previousPaused = this.paused;
    const previousAccumulator = this.simulationAccumulatorMs;
    const previousLastSimulationAt = this.lastSimulationAt;
    try {
      const emitted: Record<string, unknown>[] = [];
      const checkpointEveryTicks = game.persistEveryTicks ?? 30;
      const snapshotEveryTicks = game.snapshotEveryTicks ?? AIR_HOCKEY_SNAPSHOT_EVERY_TICKS;
      const frameAt = performance.now();
      const elapsed = Math.max(0, frameAt - this.lastSimulationAt);
      this.lastSimulationAt = frameAt;
      this.simulationAccumulatorMs = Math.min(this.simulationAccumulatorMs + elapsed, AIR_HOCKEY_STEP_MS * 5);
      let shouldPersist = false;
      let shouldSnapshot = false;
      while (this.simulationAccumulatorMs + 0.001 >= AIR_HOCKEY_STEP_MS && this.phase === "ARCADE_ACTIVE") {
        this.simulationAccumulatorMs -= AIR_HOCKEY_STEP_MS;
        game.step(this.gameState, AIR_HOCKEY_STEP_MS, { now: Date.now(), emit: (event) => emitted.push(event) });
        this.tick += 1;
        shouldPersist ||= this.tick % checkpointEveryTicks === 0;
        shouldSnapshot ||= this.tick % snapshotEveryTicks === 0;
        if (game.finalResult?.(this.gameState)) {
          this.phase = "ARCADE_RESULTS";
          this.paused = true;
          this.stopSimulationLoop();
          shouldPersist = true;
        }
      }
      if (shouldPersist || emitted.length) await this.commitRuntimeAndEvents(emitted);
      if (shouldSnapshot) {
        const roomCode = this.getActiveRoomCode();
        if (roomCode) this.broadcastSnapshot(roomCode, this.gameId);
      }
    } catch {
      this.gameState = previousGameState;
      this.tick = previousTick;
      this.phase = previousPhase;
      this.paused = previousPaused;
      this.simulationAccumulatorMs = previousAccumulator;
      this.lastSimulationAt = previousLastSimulationAt;
      this.ensureSimulationLoop();
    } finally {
      this.simulationTickInFlight = false;
    }
  }

  private getActiveRoomCode(): string | null {
    if (this.roomCode) return this.roomCode;
    for (const socket of this.state.getWebSockets()) {
      const session = socket.deserializeAttachment() as Session | null;
      if (session?.authenticated && session.roomCode) return session.roomCode;
    }
    return null;
  }

  private broadcastSnapshot(roomCode: string, gameId: string): void {
    const game = getArcadeGame(gameId);
    if (!game) return;
    for (const socket of this.state.getWebSockets()) {
      try {
        const session = socket.deserializeAttachment() as Session | null;
        if (!session?.authenticated) continue;
        const viewer: ArcadeViewer = { role: session.role, playerId: session.playerId };
        socket.send(JSON.stringify({ v: 1, type: "snapshot", roomCode, gameId, phase: this.phase, paused: this.paused, matchId: this.matchId, snapshot: this.gameState ? game.snapshot(this.gameState, this.tick, viewer) : null }));
      } catch { /* a closed or malformed socket cannot prevent delivery to other viewers */ }
    }
  }

  private async deliverCallback(keys: string[], entries: PendingCallback[]): Promise<void> {
    try {
      const entry = entries[0]!;
      const events = entries.flatMap((item) => item.events ?? (item.event ? [item.event] : []));
      events.sort((left, right) => {
        const timeDelta = Number(left.occurredAt ?? 0) - Number(right.occurredAt ?? 0);
        if (timeDelta) return timeDelta;
        if (left.type === "result" && right.type !== "result") return 1;
        if (right.type === "result" && left.type !== "result") return -1;
        return String(left.eventId ?? "").localeCompare(String(right.eventId ?? ""), undefined, { numeric: true });
      });
      const body = JSON.stringify({ roomCode: entry.roomCode, events });
      const signed = await import("../../server/arcade/tickets").then((module) => module.signArcadeCallback(body, this.env.ARCADE_CALLBACK_SECRET));
      const response = await fetch(this.env.SITE_CALLBACK_URL, { method: "POST", headers: { "content-type": "application/json", "x-arcade-timestamp": signed.timestamp, "x-arcade-nonce": signed.nonce, "x-arcade-signature": signed.signature }, body, signal: AbortSignal.timeout(5_000) });
      if (response.ok) { await this.state.storage.delete(keys); return; }
    } catch { /* retain the durable outbox entry for alarm retry */ }
    let attempts = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      entry.attempts += 1;
      attempts = Math.max(attempts, entry.attempts);
      await this.state.storage.put(keys[index]!, entry);
    }
    await this.scheduleAlarmWithRetry(Date.now() + Math.min(30_000, 500 * 2 ** Math.min(attempts, 6)));
  }

  private async scheduleAlarm(timestamp: number): Promise<void> {
    const current = await this.state.storage.getAlarm();
    if (current === null || timestamp < current) await this.state.storage.setAlarm(timestamp);
  }

  async alarm(): Promise<void> {
    await this.ensureInitialized();
    if (this.quarantineReason) { this.stopSimulationLoop(); return; }
    await this.ensureOutboxAlarm();
    const now = Date.now();
    const rows = await this.state.storage.list<number>({ prefix: "ticket:" });
    const expired = [...rows].filter(([, expiresAt]) => expiresAt <= now).map(([key]) => key);
    if (expired.length) await this.state.storage.delete(expired);
    const controls = await this.state.storage.list<number>({ prefix: "control:" });
    const expiredControls = [...controls].filter(([, expiresAt]) => expiresAt <= now).map(([key]) => key);
    if (expiredControls.length) await this.state.storage.delete(expiredControls);
    const outbox = await this.state.storage.list<PendingCallback>({ prefix: "outbox:" });
    const callbackGroups = new Map<string, { keys: string[]; entries: PendingCallback[] }>();
    for (const [key, entry] of outbox) {
      const events = entry.events ?? (entry.event ? [entry.event] : []);
      const matchId = String(events[0]?.matchId ?? key);
      const groupKey = `${entry.roomCode}:${matchId}`;
      const group = callbackGroups.get(groupKey) ?? { keys: [], entries: [] };
      group.keys.push(key); group.entries.push(entry); callbackGroups.set(groupKey, group);
    }
    for (const group of callbackGroups.values()) await this.deliverCallback(group.keys, group.entries);
    const sockets = this.state.getWebSockets();
    for (const socket of sockets) {
      const attachment = socket.deserializeAttachment() as { authenticated?: boolean; pendingSince?: number } | null;
      if (attachment?.authenticated) continue;
      if (!attachment?.pendingSince || now - attachment.pendingSince >= AUTH_TIMEOUT_MS) socket.close(1008, "Authentication timeout");
      else await this.scheduleAlarm(attachment.pendingSince + AUTH_TIMEOUT_MS);
    }
    const remainingTickets = await this.state.storage.list<number>({ prefix: "ticket:" });
    const remainingControls = await this.state.storage.list<number>({ prefix: "control:" });
    if (remainingTickets.size || remainingControls.size) await this.scheduleAlarm(now + 60_000);
    this.ensureSimulationLoop();
    this.scheduleSimulationWake();
  }
}
