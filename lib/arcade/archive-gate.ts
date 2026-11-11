import { getArchivedArcadeGame } from "./archived-games";
import { ACTIVE_FULL_ARCADE_GAMES } from "./full-games";

export function arcadeDirectoryRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const game = ACTIVE_FULL_ARCADE_GAMES.find(entry => {
    const directory = entry.href.replace(/\/index\.html$/u, "");
    return url.pathname === directory || url.pathname === `${directory}/`;
  });
  if (!game) return null;
  url.pathname = game.href;
  return new Response(null, { status: 307, headers: { Location: url.toString(), "Cache-Control": "no-store" } });
}

type ArchiveGateEnv = { DB: D1Database };

function cookieValue(request: Request, name: string): string | null {
  for (const part of request.headers.get("Cookie")?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); } catch { return null; }
  }
  return null;
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function authenticatedArchivedMatch(request: Request, env: ArchiveGateEnv, gameId: string, gameSlug: string): Promise<boolean> {
  try {
    const referrer = request.headers.get("Referer");
    if (!referrer) return false;
    const source = new URL(referrer);
    if (source.origin !== new URL(request.url).origin) return false;
    const match = source.pathname.match(/^\/arcade\/online\/(host|join|display)\/([A-HJ-KM-NP-Z2-9]{4})$/u);
    if (!match) return false;
    const routeRole = match[1]!;
    const code = match[2]!;
    const archivedGame = getArchivedArcadeGame(gameSlug);
    if (!archivedGame || archivedGame.id !== gameId) return false;
    const now = Date.now();
    const room = await env.DB.prepare("SELECT game_id, host_token_hash FROM online_arcade_rooms WHERE code=? AND status='PLAYING' AND expires_at>?").bind(code, now).first<{ game_id: string; host_token_hash: string }>();
    if (!room || room.game_id !== archivedGame.id) return false;
    if (routeRole === "display") {
      const parent = await env.DB.prepare("SELECT s.code FROM callback_sessions s JOIN callback_session_games g ON g.id=s.active_id WHERE g.child_kind='online' AND g.child_code=? AND g.active=1 AND s.stage='PLAYING' AND s.expires_at>?").bind(code, now).first<{ code: string }>();
      const mirrorToken = parent ? cookieValue(request, `callback_lobby_mirror_${parent.code}`) : null;
      if (!parent || !mirrorToken) return false;
      const mirror = await env.DB.prepare("SELECT token_hash FROM callback_session_mirrors WHERE session_code=? AND token_hash=? AND last_seen_at>?").bind(parent.code, await tokenHash(mirrorToken), now - 86400000).first();
      return mirror !== null;
    }
    const hostToken = cookieValue(request, `callback_arcade_host_${code}`);
    if (hostToken && await tokenHash(hostToken) === room.host_token_hash) return true;
    const seatToken = cookieValue(request, `callback_arcade_seat_${code}`);
    if (!seatToken) return false;
    const seat = await env.DB.prepare("SELECT seat_id FROM online_arcade_seats WHERE room_code=? AND token_hash=?").bind(code, await tokenHash(seatToken)).first();
    return seat !== null;
  } catch { return false; }
}

/** Returns an unavailable page for direct archived entries, allowing only an authenticated active match iframe. */
export async function archivedArcadeEntryResponse(request: Request, env: ArchiveGateEnv): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(/^\/arcade-games\/([a-z-]+)(?:\/(index\.html|online-v65\.html))?\/?$/u);
  if (!match) return null;
  const archivedGame = getArchivedArcadeGame(match[1]);
  if (!archivedGame) return null;
  if (match[2] === "online-v65.html" && new URL(request.url).searchParams.get("online") === "1" && await authenticatedArchivedMatch(request, env, archivedGame.id, match[1]!)) return null;
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Game archived · King Prompter</title><style>html{color-scheme:dark;background:#0e1730;color:#f8f1dd;font-family:system-ui,sans-serif}body{margin:0;padding:clamp(20px,6vw,72px)}main{max-width:640px;margin:auto;padding:clamp(20px,5vw,40px);border:1px solid #526a9e;border-radius:20px;background:#1b2b4c}h1{font-size:clamp(1.5rem,5vw,2rem);line-height:1.2;overflow-wrap:anywhere}p{line-height:1.6;color:#c9dbfa}a{display:inline-flex;align-items:center;min-height:48px;color:#f6d782;text-underline-offset:4px}a:focus-visible{outline:3px solid #8ed8ff;outline-offset:4px;border-radius:4px}</style><main><h1>${archivedGame.title} is archived</h1><p>This Arcade game is unavailable for new play.</p><a href="/arcade">Return to the active Arcade</a></main></html>`, { status: 410, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
