// Credentials travel in the first frame, never in a shareable URL.
export class RoomTransport {
  constructor({ code, token, role, onMessage, onStatus }) {
    Object.assign(this, { code, token, role, onMessage, onStatus });
    this.sequence = 0;
    this.attempt = 0;
    this.stopped = false;
    this.ready = false;
    this.connect();
  }
  connect() {
    if (this.stopped) return;
    this.onStatus("Connecting…");
    const url = new URL(`/api/rooms/${this.code}/socket`, location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = (this.socket = new WebSocket(url));
    ws.onopen = () =>
      ws.send(
        JSON.stringify({ type: "auth", role: this.role, token: this.token }),
      );
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "welcome") {
        this.ready = true;
        this.attempt = 0;
        this.sequence = Math.max(this.sequence, msg.sequence || 0);
        this.onStatus("Connected");
        clearInterval(this.heartbeat);
        this.heartbeat = setInterval(
          () => this.send({ type: "ping", at: Date.now() }),
          5000,
        );
      }
      if (msg.type === "pong" && typeof msg.at === "number")
        this.onStatus(`Connected · ${Math.max(0, Date.now() - msg.at)} ms`);
      this.onMessage(msg);
    };
    ws.onclose = (e) => {
      this.ready = false;
      clearInterval(this.heartbeat);
      if (this.stopped) return;
      if ([4001, 4003, 4004].includes(e.code) || e.reason === "room-expired") {
        this.stopped = true;
        this.onStatus(
          e.code === 4001
            ? "This seat is open in another tab."
            : "Room or saved seat unavailable. Join again.",
        );
        return;
      }
      this.onStatus("Reconnecting…");
      this.retry = setTimeout(
        () => this.connect(),
        Math.min(5000, 500 * 2 ** this.attempt++) + Math.random() * 250,
      );
    };
    ws.onerror = () => this.onStatus("Connection interrupted");
  }
  send(message) {
    if (!this.ready || this.socket.readyState !== WebSocket.OPEN) return false;
    if (this.socket.bufferedAmount > 65536) {
      this.socket.close();
      return false;
    }
    this.socket.send(JSON.stringify({ v: 1, ...message }));
    return true;
  }
  input(payload) {
    return this.send({ type: "input", sequence: ++this.sequence, payload });
  }
  cancel() {
    return this.send({ type: "cancel", sequence: ++this.sequence });
  }
  close() {
    this.stopped = true;
    this.ready = false;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    this.socket?.close();
  }
}
export async function post(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw Error(
      {
        "room-full":
          "All phone seats are reserved. Reconnect with your original phone, or create a new room.",
        "room-closed": "This room has ended. Ask the host for a new code.",
        "room-not-found": "Room not found. Check the six-character code.",
        "game-unavailable": "This game is not available yet.",
      }[data.error] ||
        data.error ||
        "Request failed",
    );
  return data;
}
export const sessionKey = (role, code) => `arcade:${role}:${code}`;
