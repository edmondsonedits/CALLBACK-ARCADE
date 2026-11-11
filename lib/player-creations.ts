import { validFishDocument, type FishDocument } from "./fish-art";

export const PLAYER_CREATION_KINDS = ["scenery", "fish"] as const;
export type PlayerCreationKind = typeof PLAYER_CREATION_KINDS[number];
export type CreationPlacement = { x: number; y: number; layer: "floor" | "backdrop" };
export const PLAYER_CREATION_MAX_SCENERY = 20;
export const PLAYER_CREATION_MAX_SOURCE_BYTES = 128_000;
export const PLAYER_CREATION_MAX_RASTER_BYTES = 8 * 1024 * 1024;

export function normalizeCreationPlacement(value: unknown): CreationPlacement {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const finite = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return {
    x: Math.max(0.08, Math.min(0.92, finite(input.x, 0.5))),
    y: Math.max(0.12, Math.min(0.88, finite(input.y, 0.72))),
    layer: input.layer === "backdrop" ? "backdrop" : "floor",
  };
}

export function validatePlayerCreationSource(kind: PlayerCreationKind, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_SOURCE");
  if ((kind === "fish" || kind === "scenery") && !validFishDocument(value as FishDocument)) throw new Error("INVALID_SOURCE");
  const encoded = JSON.stringify(value);
  if (new TextEncoder().encode(encoded).byteLength > PLAYER_CREATION_MAX_SOURCE_BYTES) throw new Error("SOURCE_TOO_LARGE");
  return JSON.parse(encoded) as unknown;
}

export function validatePlayerCreationTitle(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error("INVALID_TITLE");
  let safe = "";
  for (const character of value.normalize("NFC")) {
    const point = character.codePointAt(0)!;
    if (point > 0x1f && (point < 0x7f || point > 0x9f)) safe += character;
  }
  const title = safe.trim().slice(0, 60);
  return title;
}

export function decodePlayerCreationPng(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length > Math.ceil(PLAYER_CREATION_MAX_RASTER_BYTES * 4 / 3) + 8 || !/^data:image\/png;base64,/u.test(value) && !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) throw new Error("INVALID_PNG");
  const encoded = value.startsWith("data:") ? value.slice("data:image/png;base64,".length) : value;
  let binary: string;
  try { binary = atob(encoded); } catch { throw new Error("INVALID_PNG"); }
  if (!binary.length || binary.length > PLAYER_CREATION_MAX_RASTER_BYTES) throw new Error("RASTER_TOO_LARGE");
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
  return result;
}

export function validCreationKind(value: unknown): value is PlayerCreationKind {
  return value === "scenery" || value === "fish";
}
