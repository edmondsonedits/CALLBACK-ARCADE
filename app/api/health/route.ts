import { countActiveCodes, ensureDatabase, runtimeEnv } from "../../../server/database";

export async function GET() {
  try {
    await ensureDatabase();
    const runtime = runtimeEnv();
    return Response.json({ ok: true, service: "callback", database: "ready", storage: runtime.MEDIA ? "ready" : "unbound-local", ai: runtime.OPENAI_API_KEY || (runtime.CLOUDFLARE_ACCOUNT_ID && runtime.CLOUDFLARE_AI_API_TOKEN) ? "configured" : "fallback", activeRooms: await countActiveCodes() }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ ok: false, service: "callback", database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
