import { ArcadeRoom } from "./ArcadeRoom";

export { ArcadeRoom };
export interface WorkerEnv {
  ARCADE_ROOM: DurableObjectNamespace;
  ARCADE_TICKET_SECRET: string;
  ARCADE_CONTROL_SECRET: string;
  ARCADE_CALLBACK_SECRET: string;
  SITE_CALLBACK_URL: string;
}

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "king-prompter-arcade", protocol: 1 });
    const match = /^\/(room|control)\/([A-Z0-9]{4,8})$/u.exec(url.pathname);
    if (!match) return new Response("Not found", { status: 404 });
    const [, kind, roomCode] = match;
    if (kind === "room" && request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket upgrade required", { status: 426 });
    if (kind === "control" && request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    const id = env.ARCADE_ROOM.idFromName(roomCode!);
    return env.ARCADE_ROOM.get(id).fetch(new Request(`https://arcade-room.internal/${kind}/${roomCode}${url.search}`, request));
  },
};

export default worker;
