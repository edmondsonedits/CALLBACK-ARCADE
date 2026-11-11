import { ProfileFaceService } from "../../server/profile-faces/service";
import { OPENAI_IMAGE_GUARD_DDL, type OpenAIImageGuardConfig } from "../../server/openai-image-guard";
type WorkerEnv = OpenAIImageGuardConfig & { DB: D1Database; MEDIA: R2Bucket; TEST_OUTPUT_B64: string };

let providerCalls = 0;
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    await env.DB.batch(OPENAI_IMAGE_GUARD_DDL.map((sql: string) => env.DB.prepare(sql)));
    const service = new ProfileFaceService({ db: env.DB, storage: env.MEDIA, imageKey: env.OPENAI_IMAGE_API_KEY, guard: env });
    const url = new URL(request.url);
    if (url.pathname === "/generate" && request.method === "POST") {
      const input = new Uint8Array(await request.arrayBuffer());
      const originalFetch = globalThis.fetch;
      let contract = false;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const providerRequest = new Request(input, init);
        if (new URL(providerRequest.url).pathname !== "/v1/images/edits") return new Response("Unexpected outbound request", { status: 500 });
        providerCalls++;
        const form = await providerRequest.formData();
        const image = form.getAll("image").find((value): value is File => value instanceof File);
        contract = new URL(providerRequest.url).pathname === "/v1/images/edits" && form.get("model") === "gpt-image-1.5" && form.get("quality") === "low" && form.get("background") === "transparent" && form.get("output_format") === "png" && Boolean(image?.size);
        return Response.json({ created: 1, data: [{ b64_json: env.TEST_OUTPUT_B64 }] });
      };
      try {
        const result = await service.generate("integration-profile-cookie", request.headers.get("idempotency-key") ?? "", input);
        return Response.json({ result, providerCalls, contract });
      } finally { globalThis.fetch = originalFetch; }
    }
    if (url.pathname === "/trim" && request.method === "POST") {
      const input = await request.json() as { faceId: string; cutoffPercent: number; curvePercent?: number };
      try { return Response.json({ ...await service.trim("integration-profile-cookie", input.faceId, input.cutoffPercent, input.curvePercent ?? 0), providerCalls }); }
      catch (error) { return Response.json({ error: error instanceof Error ? error.message : "TRIM_FAILED" }, { status: 422 }); }
    }
    if (url.pathname.startsWith("/face/")) {
      const image = await service.getPublic(url.pathname.slice("/face/".length));
      return image ? new Response(image.bytes, { headers: { "Content-Type": "image/png" } }) : new Response(null, { status: 404 });
    }
    return new Response(null, { status: 404 });
  },
};
