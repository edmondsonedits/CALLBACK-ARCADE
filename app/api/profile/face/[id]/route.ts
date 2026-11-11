import { ensureDatabase, runtimeEnv } from "../../../../../server/database";
import { profileFaceService } from "../../../../../server/profile-faces/runtime";
import { noStoreHeaders } from "../../../../../server/http";

type Context = { params: Promise<{ id: string }> | { id: string } };
export async function GET(_request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  try {
    await ensureDatabase();
    if (!runtimeEnv().MEDIA) return new Response(null, { status: 404, headers: noStoreHeaders() });
    const image = await (await profileFaceService()).getPublic(id);
    if (!image) return new Response(null, { status: 404, headers: noStoreHeaders() });
    return new Response(image.bytes, { status: 200, headers: { "Content-Type": "image/png", "Content-Length": String(image.size), "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-site" } });
  } catch { return new Response(null, { status: 503, headers: noStoreHeaders() }); }
}
