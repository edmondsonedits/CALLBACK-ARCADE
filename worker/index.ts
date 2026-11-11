/** Cloudflare Worker entry point for CALLBACK. */
import handler from "vinext/server/app-router-entry";
import { isFullArcadeFrame } from "../lib/arcade/full-games";
import { isFullArcadeFrame as isOnlineArcadeFrame } from "../lib/arcade/online/full-games";
import { arcadeDirectoryRedirect, archivedArcadeEntryResponse } from "../lib/arcade/archive-gate";

interface Env {
  ASSETS: Fetcher;
  MEDIA: R2Bucket;
  DB: D1Database;
  PARTY_WORKER_URL?: string;
  ARCADE_WORKER_URL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function arcadeSocketOrigin(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname) && url.protocol === "http:";
    if (!(["https:", "wss:"].includes(url.protocol) || local) || url.username || url.password) return "";
    return `${url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol}//${url.host}`;
  } catch { return ""; }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const archived = await archivedArcadeEntryResponse(request, env);
    if (archived) return archived;
    const directory = arcadeDirectoryRedirect(request);
    if (directory) return directory;
    const original = new URL(request.url).pathname.startsWith('/arcade-games/')
      ? await env.ASSETS.fetch(request)
      : await handler.fetch(request, env, ctx);
    const response = new Response(original.body, original);
    const url = new URL(request.url);
    const testerFrame = url.searchParams.get("tester") === "1" && /^\/(host|play)\/[A-HJ-KM-NP-Z2-9]{4}$/u.test(url.pathname);
    const sessionFrame=/^[A-HJ-KM-NP-Z2-9]{4}$/.test(url.searchParams.get('session')??'') && /^\/(?:host|play|display|arcade\/online\/(?:host|join|display))\/[A-HJ-KM-NP-Z2-9]{4}$/.test(url.pathname);
    const cameraEntry=url.pathname==='/play'||/^\/session\/[A-HJ-KM-NP-Z2-9]{4}\/play$/.test(url.pathname);
    const sameOriginFrame = testerFrame || sessionFrame || isFullArcadeFrame(url.pathname) || isOnlineArcadeFrame(url.pathname) || url.pathname==="/arcade-games/royal-sumo/realtime-pilot.html";
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "same-origin");
    response.headers.set("X-Frame-Options", sameOriginFrame ? "SAMEORIGIN" : "DENY");
    response.headers.set("Permissions-Policy", (testerFrame || sessionFrame || cameraEntry) ? "camera=(self), microphone=(self), geolocation=(), payment=()" : "camera=(), microphone=(), geolocation=(), payment=()");
    const arcadeSocket = [arcadeSocketOrigin(env.ARCADE_WORKER_URL),arcadeSocketOrigin(env.PARTY_WORKER_URL)].filter(Boolean).join(" ");
    response.headers.set("Content-Security-Policy", `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'${arcadeSocket ? ` ${arcadeSocket}` : ""}; font-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors ${sameOriginFrame ? "'self'" : "'none'"}; form-action 'self'`);
    return response;
  },
};

export default worker;
