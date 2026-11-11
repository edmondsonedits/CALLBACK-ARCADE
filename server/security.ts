import { apiError } from "../lib/contracts";
import { hmacHex } from "./crypto";
import { ensureDatabase, getD1, runtimeEnv } from "./database";

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowMs = 60_000): Promise<Response | null> {
  const localTestRequest = request.headers.get("x-callback-test-mode") === "deterministic-matrix";
  const production = process.env.NODE_ENV === "production" || runtimeEnv().CALLBACK_ENV === "production";
  if (localTestRequest && !production) return null;
  await ensureDatabase();
  const rawIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const secret = runtimeEnv().RATE_LIMIT_HMAC_SECRET ?? "callback-local-development-rate-limit-secret";
  const privacyKey = await hmacHex(secret, `${scope}:${rawIp}`);
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const expiresAt = windowStart + windowMs * 2;
  await getD1().prepare("INSERT INTO rate_limits(key, window_start, count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at").bind(privacyKey, windowStart, expiresAt).run();
  const row = await getD1().prepare("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?").bind(privacyKey, windowStart).first<{ count: number }>();
  if ((row?.count ?? 0) <= limit) return null;
  const response = apiError("RATE_LIMITED", "Too many requests. Try again shortly.", 429);
  response.headers.set("Retry-After", String(Math.max(1, Math.ceil((windowStart + windowMs - Date.now()) / 1000))));
  return response;
}

/** Rate limit a caller-selected opaque identity (for example a hashed profile token), independently of IP. */
export async function enforceIdentityRateLimit(request: Request, scope: string, identity: string, limit: number, windowMs = 60_000): Promise<Response | null> {
  const localTestRequest = request.headers.get("x-callback-test-mode") === "deterministic-matrix";
  const production = process.env.NODE_ENV === "production" || runtimeEnv().CALLBACK_ENV === "production";
  if (localTestRequest && !production) return null;
  await ensureDatabase();
  const secret = runtimeEnv().RATE_LIMIT_HMAC_SECRET ?? "callback-local-development-rate-limit-secret";
  const privacyKey = await hmacHex(secret, `${scope}:${identity}`);
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const expiresAt = windowStart + windowMs * 2;
  await getD1().prepare("INSERT INTO rate_limits(key, window_start, count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1, expires_at = excluded.expires_at").bind(privacyKey, windowStart, expiresAt).run();
  const row = await getD1().prepare("SELECT count FROM rate_limits WHERE key = ? AND window_start = ?").bind(privacyKey, windowStart).first<{ count: number }>();
  if ((row?.count ?? 0) <= limit) return null;
  const response = apiError("RATE_LIMITED", "Too many requests. Try again shortly.", 429);
  response.headers.set("Retry-After", String(Math.max(1, Math.ceil((windowStart + windowMs - Date.now()) / 1000))));
  return response;
}
