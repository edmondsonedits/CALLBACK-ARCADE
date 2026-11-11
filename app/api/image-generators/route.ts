import { ensureDatabase, runtimeEnv } from "../../../server/database";
import { getOpenAIImageAvailability, openAIImageAccess } from "../../../server/openai-image-guard";
import { noStoreHeaders } from "../../../server/http";

export async function GET() {
  const config = runtimeEnv();
  let access = openAIImageAccess(config);
  if (access.available) {
    try {
      await ensureDatabase();
      access = await getOpenAIImageAvailability(config);
    } catch {
      access = { available: false, code: "OPENAI_IMAGE_GUARD_UNAVAILABLE", message: "Image generation is stopped while allowance protection is unavailable." };
    }
  }
  return Response.json({ openaiLow: access.available, openaiCode: access.code, openaiMessage: access.message }, { headers: noStoreHeaders() });
}
