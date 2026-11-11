import type OpenAI from "openai";
import type { ImageAI, ImageGenerationOptions } from "./ai";
import { confirmedImageContentType } from "./image-models";

/** This room choice always uses the quoted low-quality model, regardless of legacy env defaults. */
export class OpenAILowImageAI implements ImageAI {
  constructor(private client: OpenAI) {}

  async generate(prompt: string, options: ImageGenerationOptions) {
    const settings = {
      model: "gpt-image-2",
      prompt,
      size: options.aspect === "square" ? "1024x1024" as const : "1536x1024" as const,
      quality: "low" as const,
      output_format: "webp" as const,
      n: 1,
    };
    // The job system owns fallback. An SDK retry can duplicate paid work after a lost response.
    const request = { timeout: 120_000, maxRetries: 0 };
    const references = (options.references ?? []).slice(0, 4);
    const response = references.length
      ? await this.client.images.edit({ ...settings, image: references.map((reference, index) => {
        const bytes = reference.bytes.buffer.slice(reference.bytes.byteOffset, reference.bytes.byteOffset + reference.bytes.byteLength) as ArrayBuffer;
        const extension = reference.contentType === "image/png" ? "png" : reference.contentType === "image/jpeg" ? "jpg" : "webp";
        return new File([bytes], `panel-${index + 1}.${extension}`, { type: reference.contentType });
      }) }, request)
      : await this.client.images.generate(settings, request);
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error("EMPTY_OPENAI_IMAGE");
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return { bytes, contentType: confirmedImageContentType(bytes) };
  }
}
