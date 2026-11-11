import type { ImageModel } from "../lib/contracts";
import { ImageModelSchema } from "../lib/contracts";

const FALLBACK_ORDERS: Record<ImageModel, ImageModel[]> = {
  "openai-low": ["openai-low"],
  "flux-2-quality": ["flux-2-quality", "flux-2-fast", "flux-1-schnell"],
  "flux-2-fast": ["flux-2-fast", "flux-1-schnell", "flux-2-quality"],
  "flux-1-schnell": ["flux-1-schnell", "flux-2-fast", "flux-2-quality"],
};

export const IMAGE_MODEL_LABELS: Record<ImageModel, string> = {
  "openai-low": "ChatGPT Images · Low",
  "flux-2-quality": "FLUX.2 Quality",
  "flux-2-fast": "FLUX.2 Fast",
  "flux-1-schnell": "FLUX.1 Schnell",
};

export const CLOUDFLARE_FLUX2_MODEL_IDS = {
  "flux-2-fast": "@cf/black-forest-labs/flux-2-klein-4b",
  "flux-2-quality": "@cf/black-forest-labs/flux-2-klein-9b",
} as const;

export function selectedImageModelForJob(kind: string, value: unknown): ImageModel {
  const parsed = ImageModelSchema.safeParse(value);
  const selected = parsed.success ? parsed.data : "flux-1-schnell";
  return kind === "COMIC_PANEL_IMAGE" && selected === "flux-1-schnell" ? "flux-2-fast" : selected;
}

export function imageJobLeaseMs(kind: string, selected: ImageModel, previousAttempts: number): number {
  if (kind === "LORE_ANALYSIS") return 25_000;
  return imageModelForAttempt(selected, previousAttempts) === "openai-low" ? 150_000 : 50_000;
}

export function imageModelFallbackOrder(selected: ImageModel): ImageModel[] {
  return [...FALLBACK_ORDERS[selected]];
}

export function imageModelForAttempt(selected: ImageModel, previousAttempts: number): ImageModel | null {
  return FALLBACK_ORDERS[selected][previousAttempts] ?? null;
}

export function nextImageModel(selected: ImageModel, previousAttempts: number): ImageModel | null {
  return FALLBACK_ORDERS[selected][previousAttempts + 1] ?? null;
}

export function confirmedImageContentType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" {
  if (bytes.byteLength < 1024) throw new Error("INVALID_IMAGE_BYTES");
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  throw new Error("UNSUPPORTED_IMAGE_BYTES");
}
