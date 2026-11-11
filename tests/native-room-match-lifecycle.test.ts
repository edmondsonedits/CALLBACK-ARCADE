import assert from "node:assert/strict";
import test from "node:test";
import { issueNativeArcadeSocketTicket } from "../lib/arcade/native-socket-ticket";
import { NativeArcadeRoom, type NativeArcadeEnv } from "../party-worker/src/native-room";

let sockets: FakeSocket[] = [];

class FakeSocket {
  attachment: unknown = null;
  closeCodes: number[] = [];
  constructor(private readonly remove: (socket: FakeSocket) => void) {}
  serializeAttachment(value: unknown) { this.attachment = structuredClone(value); }
  deserializeAttachment() { return structuredClone(this.attachment); }
  close(code: number) { this.closeCodes.push(code); this.remove(this); }
  send() {}
}

class FakeSocketPair {
  0: WebSocket;
  1: WebSocket;
  constructor() {
    const close = () => {};
    const client = { close } as unknown as WebSocket;
    const server = new FakeSocket((socket) => { const index = sockets.indexOf(socket); if (index >= 0) sockets.splice(index, 1); });
    this[0] = client;
    this[1] = server as unknown as WebSocket;
  }
}

test("native socket accepts fresh tickets across lobby, active match, replay lobby, and a new match", async () => {
  const originalResponse = globalThis.Response;
  const globalObject = globalThis as unknown as Record<string, unknown>;
  const oldSocketPair = globalObject.WebSocketPair;
  class UpgradeResponse extends originalResponse {
    constructor(body?: BodyInit | null, init?: ResponseInit & { webSocket?: WebSocket }) {
      const status = init?.status ?? 200;
      super(body, status === 101 ? { status: 200, headers: init?.headers } : init);
      if (status === 101) Object.defineProperty(this, "status", { value: 101 });
    }
  }
  Object.defineProperty(globalThis, "Response", { value: UpgradeResponse, configurable: true });
  Object.defineProperty(globalObject, "WebSocketPair", { value: FakeSocketPair, configurable: true });

  sockets = [];
  const savedRoom: { value: { roomId: string; generationId: string; partyKey: string; matchId: string; expiresAt: number } | null } = { value: null };
  let initialized: Promise<void> = Promise.resolve();
  const state = {
    blockConcurrencyWhile(callback: () => Promise<void>) { initialized = callback(); return initialized; },
    storage: {
      get: async () => savedRoom.value,
      put: async (_key: string, value: typeof savedRoom.value) => { savedRoom.value = value; },
      setAlarm: async () => undefined,
      deleteAlarm: async () => undefined,
      delete: async () => undefined,
    },
    getWebSockets: () => sockets as unknown as WebSocket[],
    acceptWebSocket(socket: WebSocket) { sockets.push(socket as unknown as FakeSocket); },
  };
  const env = { PARTY_SECRET: "native-room-test-secret-0123456789", SITE_ORIGIN: "https://site.example", NATIVE_ARCADE_ROOM: {} as DurableObjectNamespace, PARTY_ADMISSION: {} as DurableObjectNamespace } satisfies NativeArcadeEnv;
  const room = new NativeArcadeRoom(state as unknown as DurableObjectState, env);
  await initialized;

  const connect = async (matchId: string) => {
    const { ticket } = await issueNativeArcadeSocketTicket({ roomId: "stable-room", roomCode: "TEST", gameId: "imposter", matchId, generationId: "stable-generation", partyKey: "session-PARENT", actorId: "host", tokenHash: "a".repeat(64), role: "host" }, env.PARTY_SECRET);
    const response = await room.fetch(new Request("https://native/socket", { method: "GET", headers: { Upgrade: "websocket", "X-Native-Arcade-Ticket": ticket, "X-Native-Arcade-Expires": String(Date.now() + 60_000) } }));
    assert.equal(response.status, 101, `match ${matchId} should reconnect`);
    assert.equal(savedRoom.value?.matchId, matchId);
  };

  try {
    await connect("lobby");
    const first = sockets.at(-1)!;
    await connect("match-one");
    assert.ok(first.closeCodes.includes(4002), "starting a match closes the lobby-bound socket");
    const active = sockets.at(-1)!;
    await connect("lobby");
    assert.ok(active.closeCodes.includes(4002), "replay back to lobby replaces the completed-match socket");
    const replayLobby = sockets.at(-1)!;
    await connect("match-two");
    assert.ok(replayLobby.closeCodes.includes(4002), "starting the replay replaces the replay-lobby socket");
    assert.equal(savedRoom.value?.generationId, "stable-generation", "match changes preserve the room generation");
  } finally {
    for (const socket of [...sockets]) socket.close(1000);
    await room.webSocketClose();
    Object.defineProperty(globalThis, "Response", { value: originalResponse, configurable: true });
    if (oldSocketPair === undefined) delete globalObject.WebSocketPair;
    else Object.defineProperty(globalObject, "WebSocketPair", { value: oldSocketPair, configurable: true });
  }
});

