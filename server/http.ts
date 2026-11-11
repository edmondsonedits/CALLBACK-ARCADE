import { apiError } from "../lib/contracts";

const MAX_JSON_BYTES = 12_000;

export async function readJson(request: Request): Promise<unknown | Response> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim();
  if (contentType !== "application/json") return apiError("CONTENT_TYPE_REQUIRED", "Use application/json.", 415);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_JSON_BYTES) return apiError("BODY_TOO_LARGE", "The request body is too large.", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) return apiError("BODY_TOO_LARGE", "The request body is too large.", 413);
  try { return JSON.parse(text); } catch { return apiError("INVALID_JSON", "The request body is not valid JSON.", 400); }
}

export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const expected = new URL(request.url).origin;
  if ((origin && origin !== expected) || (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite))) return apiError("CROSS_ORIGIN_BLOCKED", "This request must come from the game site.", 403);
  return null;
}

export function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const pair of cookie.split(";")) {
    const [key, ...parts] = pair.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

export const hostCookieName = (code: string) => `callback_host_${code.toUpperCase()}`;
export const seatCookieName = (code: string) => `callback_seat_${code.toUpperCase()}`;
export const displayCookieName = (code: string) => `callback_display_${code.toUpperCase()}`;
export function sessionCookie(name: string, token: string, maxAge = 86_400): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly${secure}; SameSite=Lax`;
}

export function noStoreHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store, private");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  return headers;
}
