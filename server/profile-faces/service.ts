import OpenAI from "openai";
import { classifyFaceProviderError } from "./provider-error";
import { sha256Hex } from "../crypto";
import { consumeOpenAIImageReservation, isOpenAIImageBillingError, reserveOpenAIImageRequest, tripOpenAIImageCircuit, type OpenAIImageGuardConfig, type OpenAIImageReservation } from "../openai-image-guard";
import { PROFILE_FACE_PROMPT } from "./prompt";
import { PROFILE_FACE_DDL } from "./schema";

export const PROFILE_FACE_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class ProfileFaceError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

type PngInfo = { width: number; height: number; alpha: Uint8Array; pixels: Uint8Array; channels: number; hasAlpha: boolean };

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Fully inflates a bounded RGBA PNG and reconstructs scanlines before looking at alpha. */
async function decodeRgbaPng(bytes: Uint8Array, allowRgb = false): Promise<PngInfo> {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 45 || signature.some((byte, index) => bytes[index] !== byte)) throw new ProfileFaceError("INVALID_PNG", 422);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8, width = 0, height = 0, gotHeader = false, gotEnd = false, channels = 0;
  const compressed: Uint8Array[] = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new ProfileFaceError("INVALID_PNG", 422);
    const length = view.getUint32(offset); const end = offset + 12 + length;
    if (end > bytes.length) throw new ProfileFaceError("INVALID_PNG", 422);
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== view.getUint32(offset + 8 + length)) throw new ProfileFaceError("INVALID_PNG", 422);
    if (type === "IHDR") {
      if (gotHeader || length !== 13) throw new ProfileFaceError("INVALID_PNG", 422);
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12);
      if (!width || !height || width > 2048 || height > 2048 || width * height > 4_194_304) throw new ProfileFaceError("INVALID_PNG_DIMENSIONS", 422);
      const colorType = data[9];
      if (data[8] !== 8 || (colorType !== 6 && !(allowRgb && colorType === 2)) || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new ProfileFaceError("UNSUPPORTED_PNG", 422);
      channels = colorType === 6 ? 4 : 3; gotHeader = true;
    } else if (type === "IDAT") {
      if (!gotHeader || gotEnd || length === 0) throw new ProfileFaceError("INVALID_PNG", 422);
      compressed.push(data.slice());
    } else if (type === "IEND") {
      if (length !== 0 || end !== bytes.length || !compressed.length) throw new ProfileFaceError("INVALID_PNG", 422);
      gotEnd = true; offset = end; break;
    }
    offset = end;
  }
  if (!gotHeader || !gotEnd) throw new ProfileFaceError("INVALID_PNG", 422);
  const stride = width * channels, expected = height * (stride + 1), packed = new Uint8Array(compressed.reduce((sum, part) => sum + part.length, 0));
  let packedOffset = 0; for (const part of compressed) { packed.set(part, packedOffset); packedOffset += part.length; }
  let raw: Uint8Array;
  try {
    const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
    const parts: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > expected) { await reader.cancel(); throw new ProfileFaceError("INVALID_PNG", 422); }
      parts.push(value);
    }
    if (size !== expected) throw new ProfileFaceError("INVALID_PNG", 422);
    raw = new Uint8Array(size); let cursor = 0; for (const part of parts) { raw.set(part, cursor); cursor += part.length; }
  } catch (error) { if (error instanceof ProfileFaceError) throw error; throw new ProfileFaceError("INVALID_PNG", 422); }
  const pixels = new Uint8Array(height * stride); let input = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[input++]!, row = y * stride;
    if (filter > 4) throw new ProfileFaceError("INVALID_PNG", 422);
    for (let x = 0; x < stride; x++) {
      const value = raw[input++]!, left = x >= channels ? pixels[row + x - channels]! : 0, above = y ? pixels[row + x - stride]! : 0, upperLeft = y && x >= channels ? pixels[row + x - stride - channels]! : 0;
      pixels[row + x] = (value + (filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : filter === 4 ? paeth(left, above, upperLeft) : 0)) & 255;
    }
  }
  const alpha = new Uint8Array(width * height);
  if (channels === 4) for (let index = 0; index < alpha.length; index++) alpha[index] = pixels[index * 4 + 3]!;
  else alpha.fill(255);
  return { width, height, alpha, pixels, channels, hasAlpha: channels === 4 };
}

async function encodeRgbaPng(width: number, height: number, pixels: Uint8Array): Promise<Uint8Array> {
  const stride = width * 4, scanlines = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) scanlines.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const compressed = new Uint8Array(await new Response(new Blob([scanlines]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
  const parts: Uint8Array[] = [];
  const chunk = (type: string, data: Uint8Array) => {
    const name = new TextEncoder().encode(type), bytes = new Uint8Array(12 + data.length), view = new DataView(bytes.buffer);
    view.setUint32(0, data.length); bytes.set(name, 4); bytes.set(data, 8); view.setUint32(8 + data.length, crc32(bytes.subarray(4, 8 + data.length))); parts.push(bytes);
  };
  chunk("IHDR", new Uint8Array([width >>> 24, width >>> 16, width >>> 8, width, height >>> 24, height >>> 16, height >>> 8, height, 8, 6, 0, 0, 0]));
  chunk("IDAT", compressed); chunk("IEND", new Uint8Array());
  const output = new Uint8Array(8 + parts.reduce((sum, part) => sum + part.length, 0)); output.set([137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8; for (const part of parts) { output.set(part, offset); offset += part.length; }
  if (output.length > MAX_OUTPUT_BYTES) throw new ProfileFaceError("IMAGE_STORAGE_FAILED", 503);
  return output;
}

async function deterministicTrimId(profileHash: string, sourceFaceId: string, cutoffPercent: number, curvePercent: number): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`profile-face-trim-v2:${profileHash}:${sourceFaceId}:${cutoffPercent}:${curvePercent}`));
  const hex = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16]!, 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export async function validateProfileFaceInputPng(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  if (!bytes.length || bytes.length > PROFILE_FACE_MAX_UPLOAD_BYTES) throw new ProfileFaceError("PHOTO_TOO_LARGE", 413);
  const { width, height } = await decodeRgbaPng(bytes, true);
  if (width < 64 || height < 64) throw new ProfileFaceError("PHOTO_TOO_SMALL", 422);
  return { width, height };
}

export async function validateGeneratedFacePng(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  if (!bytes.length || bytes.length > MAX_OUTPUT_BYTES) throw new ProfileFaceError("INVALID_IMAGE_OUTPUT", 502);
  let info: PngInfo;
  try { info = await decodeRgbaPng(bytes); }
  catch (error) { if (error instanceof ProfileFaceError) throw new ProfileFaceError("INVALID_IMAGE_OUTPUT", 502); throw error; }
  if (!info.hasAlpha) throw new ProfileFaceError("TRANSPARENCY_REQUIRED", 502);
  let visible = 0; for (const alpha of info.alpha) if (alpha > 16) visible++;
  if (visible < Math.ceil(info.alpha.length * 0.01)) throw new ProfileFaceError("EMPTY_IMAGE", 502);
  const borderDepth = Math.min(2, Math.floor(Math.min(info.width, info.height) / 4));
  let borderPixels = 0, transparentBorder = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (x < borderDepth || y < borderDepth || x >= info.width - borderDepth || y >= info.height - borderDepth) { borderPixels++; if (info.alpha[y * info.width + x]! <= 8) transparentBorder++; }
  }
  if (!borderPixels || transparentBorder / borderPixels < 0.8) throw new ProfileFaceError("TRANSPARENCY_REQUIRED", 502);
  return { width: info.width, height: info.height };
}

export type FaceGenerationResult = { status: "ready"; faceId: string } | { status: "processing" } | { status: "failed"; code: string; terminal: true } | { status: "conflict" };
export interface ProfileFaceServiceOptions {
  db: D1Database;
  storage: R2Bucket;
  imageKey?: string;
  guard: OpenAIImageGuardConfig;
  imageEdit?: (photo: Uint8Array) => Promise<Uint8Array>;
  now?: () => number;
}

async function defaultImageEdit(key: string, photo: Uint8Array): Promise<Uint8Array> {
  const client = new OpenAI({ apiKey: key, maxRetries: 0, fetch: (...args) => globalThis.fetch(...args) });
  const buffer = photo.buffer.slice(photo.byteOffset, photo.byteOffset + photo.byteLength) as ArrayBuffer;
  const response = await client.images.edit({
    model: "gpt-image-1.5", image: new File([buffer], "portrait.png", { type: "image/png" }), prompt: PROFILE_FACE_PROMPT,
    quality: "low", background: "transparent", output_format: "png", size: "1024x1024", n: 1,
  }, { timeout: 120_000, maxRetries: 0 });
  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) throw new ProfileFaceError("IMAGE_PROVIDER_FAILED", 502);
  return Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
}

export class ProfileFaceService {
  private readonly now: () => number;
  constructor(private readonly options: ProfileFaceServiceOptions) { this.now = options.now ?? Date.now; }

  async generate(token: string, idempotencyKey: string, photo: Uint8Array): Promise<FaceGenerationResult> {
    if (!UUID.test(idempotencyKey)) throw new ProfileFaceError("INVALID_IDEMPOTENCY_KEY", 400);

    await validateProfileFaceInputPng(photo);
    const profileHash = await sha256Hex(token), requestHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", photo.buffer.slice(photo.byteOffset, photo.byteOffset + photo.byteLength) as ArrayBuffer)), byte => byte.toString(16).padStart(2, "0")).join("");
    await this.options.db.batch(PROFILE_FACE_DDL.map(sql => this.options.db.prepare(sql)));
    const current = await this.options.db.prepare("SELECT job_id, request_hash, status, face_id, error_code, updated_at FROM profile_face_jobs WHERE profile_hash = ? AND idempotency_key = ?").bind(profileHash, idempotencyKey).first<{ job_id: string; request_hash: string; status: string; face_id: string | null; error_code: string | null; updated_at: number }>();
    if (current) {
      if (current.request_hash !== requestHash) return { status: "conflict" };
      if (current.status === "READY" && current.face_id) return { status: "ready", faceId: current.face_id };
      if (current.status === "GENERATING") {
        if (this.now() - current.updated_at > 180_000) {
          await this.options.db.prepare("UPDATE profile_face_jobs SET status = 'FAILED', error_code = 'GENERATION_INTERRUPTED', updated_at = ? WHERE job_id = ? AND status = 'GENERATING'").bind(this.now(), current.job_id).run();
          return { status: "failed", code: "GENERATION_INTERRUPTED", terminal: true };
        }
        return { status: "processing" };
      }
      return { status: "failed", code: current.error_code ?? "IMAGE_PROVIDER_FAILED", terminal: true };
    }
    if (!this.options.imageKey) throw new ProfileFaceError("OPENAI_IMAGE_NOT_CONFIGURED", 503);
    const jobId = crypto.randomUUID(), now = this.now();
    const inserted = await this.options.db.prepare("INSERT OR IGNORE INTO profile_face_jobs(job_id, profile_hash, idempotency_key, request_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'GENERATING', ?, ?)").bind(jobId, profileHash, idempotencyKey, requestHash, now, now).run();
    if (Number(inserted.meta?.changes ?? 0) !== 1) {
      const raced = await this.options.db.prepare("SELECT request_hash, status, face_id, error_code, updated_at FROM profile_face_jobs WHERE profile_hash = ? AND idempotency_key = ?").bind(profileHash, idempotencyKey).first<{ request_hash: string; status: string; face_id: string | null; error_code: string | null; updated_at: number }>();
      if (!raced || raced.request_hash !== requestHash) return { status: "conflict" };
      return raced.status === "READY" && raced.face_id ? { status: "ready", faceId: raced.face_id } : raced.status === "GENERATING" ? { status: "processing" } : { status: "failed", code: raced.error_code ?? "IMAGE_PROVIDER_FAILED", terminal: true };
    }
    let reservation: OpenAIImageReservation | undefined, objectKeyForCleanup: string | undefined;
    try {
      const roomId = `profile:${profileHash}`;
      const reserved = await reserveOpenAIImageRequest({ db: this.options.db, config: { ...this.options.guard, OPENAI_IMAGE_API_KEY: this.options.imageKey, DB: this.options.db }, jobId, roomId, now });
      if (!reserved.reserved) throw new ProfileFaceError(reserved.code, 503);
      reservation = reserved.reservation;
      if (!consumeOpenAIImageReservation(reservation, { creditWindowId: this.options.guard.OPENAI_IMAGES_CREDIT_WINDOW?.trim() ?? "", jobId, roomId })) throw new ProfileFaceError("ALLOWANCE_STOP", 503);
      let output: Uint8Array;
      try { output = await (this.options.imageEdit ?? ((input) => defaultImageEdit(this.options.imageKey!, input)))(photo); }
      catch (error) {
        if (isOpenAIImageBillingError(error)) { try { await tripOpenAIImageCircuit(this.options.db, reservation.creditWindowId, this.now(), jobId); } catch { /* The in-process circuit latch is already set. */ } throw new ProfileFaceError("ALLOWANCE_STOP", 503); }
        const code = classifyFaceProviderError(error);
        console.error("profile_face_provider_failure", { code, status: error instanceof OpenAI.APIError ? error.status : undefined, parameter: error instanceof OpenAI.APIError && ["background", "image", "image[]", "model", "quality", "size", "output_format"].includes(error.param ?? "") ? error.param : undefined });
        throw new ProfileFaceError(code, 502);
      }
      await validateGeneratedFacePng(output);
      const faceId = crypto.randomUUID(), objectKey = `profile-faces/${faceId}.png`; objectKeyForCleanup = objectKey;
      await this.options.storage.put(objectKey, output, { httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { purpose: "profile-face", faceId } });
      const stored = await this.options.storage.head(objectKey);
      if (!stored || stored.size !== output.byteLength) throw new ProfileFaceError("IMAGE_STORAGE_FAILED", 503);
      const finalized = await this.options.db.batch([
        this.options.db.prepare("INSERT INTO profile_faces(face_id, profile_hash, object_key, content_type, byte_size, created_at) VALUES (?, ?, ?, 'image/png', ?, ?)").bind(faceId, profileHash, objectKey, output.byteLength, this.now()),
        this.options.db.prepare("UPDATE profile_face_jobs SET status = 'READY', face_id = ?, updated_at = ? WHERE job_id = ? AND status = 'GENERATING'").bind(faceId, this.now(), jobId),
      ]);
      if (Number(finalized[1]?.meta?.changes ?? 0) !== 1) throw new ProfileFaceError("IMAGE_STORAGE_FAILED", 503);
      return { status: "ready", faceId };
    } catch (error) {
      const code = error instanceof ProfileFaceError ? error.code : "IMAGE_PROVIDER_FAILED";
      await this.options.db.prepare("UPDATE profile_face_jobs SET status = 'FAILED', error_code = ?, updated_at = ? WHERE job_id = ? AND status = 'GENERATING'").bind(code, this.now(), jobId).run().catch(() => {});
      if (objectKeyForCleanup) await this.options.storage.delete(objectKeyForCleanup).catch(() => {});
      throw error instanceof ProfileFaceError ? error : new ProfileFaceError(code, 502);
    }
  }

  /** Saves an owner-bound, repeatable PNG derivative with pixels below a curved chin cutoff transparent. */
  async trim(token: string, sourceFaceId: string, cutoffPercent: number, curvePercent = 0): Promise<{ faceId: string }> {
    if (!UUID.test(sourceFaceId)) throw new ProfileFaceError("PROFILE_FACE_NOT_OWNED", 422);
    if (!Number.isInteger(cutoffPercent) || cutoffPercent < 20 || cutoffPercent > 95) throw new ProfileFaceError("INVALID_CUTOFF", 422);
    if (!Number.isInteger(curvePercent) || curvePercent < 0 || curvePercent > 40) throw new ProfileFaceError("INVALID_CURVE", 422);
    const profileHash = await sha256Hex(token);
    await this.options.db.batch(PROFILE_FACE_DDL.map(sql => this.options.db.prepare(sql)));
    const source = await this.options.db.prepare("SELECT object_key, byte_size FROM profile_faces WHERE profile_hash = ? AND face_id = ? AND content_type = 'image/png'").bind(profileHash, sourceFaceId).first<{ object_key: string; byte_size: number }>();
    if (!source || source.byte_size > MAX_OUTPUT_BYTES || !source.object_key.startsWith(`profile-faces/${sourceFaceId}.`)) throw new ProfileFaceError("PROFILE_FACE_NOT_OWNED", 422);
    const object = await this.options.storage.get(source.object_key);
    if (!object || object.size !== source.byte_size) throw new ProfileFaceError("IMAGE_STORAGE_FAILED", 503);
    const original = new Uint8Array(await object.arrayBuffer());
    const decoded = await decodeRgbaPng(original);
    const pixels = decoded.pixels.slice();
    for (let x = 0; x < decoded.width; x++) {
      const normalizedX = 2 * (x + 0.5) / decoded.width - 1;
      const boundaryPercent = Math.max(0, Math.min(100, cutoffPercent - curvePercent * normalizedX * normalizedX));
      const firstTransparentRow = Math.floor(decoded.height * boundaryPercent / 100);
      for (let y = firstTransparentRow; y < decoded.height; y++) pixels[(y * decoded.width + x) * 4 + 3] = 0;
    }
    const output = await encodeRgbaPng(decoded.width, decoded.height, pixels);
    await validateGeneratedFacePng(output);
    const faceId = await deterministicTrimId(profileHash, sourceFaceId, cutoffPercent, curvePercent), objectKey = `profile-faces/${faceId}.png`;
    await this.options.storage.put(objectKey, output, { httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { purpose: "profile-face", faceId, sourceFaceId, cutoffPercent: String(cutoffPercent), curvePercent: String(curvePercent) } });
    const stored = await this.options.storage.head(objectKey);
    if (!stored || stored.size !== output.byteLength) throw new ProfileFaceError("IMAGE_STORAGE_FAILED", 503);
    await this.options.db.prepare("INSERT OR IGNORE INTO profile_faces(face_id, profile_hash, object_key, content_type, byte_size, created_at) VALUES (?, ?, ?, 'image/png', ?, ?)").bind(faceId, profileHash, objectKey, output.byteLength, this.now()).run();
    const saved = await this.options.db.prepare("SELECT profile_hash, byte_size FROM profile_faces WHERE face_id = ?").bind(faceId).first<{ profile_hash: string; byte_size: number }>();
    if (!saved || saved.profile_hash !== profileHash || saved.byte_size !== output.byteLength) throw new ProfileFaceError("IMAGE_STORAGE_FAILED", 503);
    return { faceId };
  }

  async owns(token: string, faceId: string): Promise<boolean> {
    if (!UUID.test(faceId)) return false;
    const profileHash = await sha256Hex(token);
    await this.options.db.batch(PROFILE_FACE_DDL.map(sql => this.options.db.prepare(sql)));
    return Boolean(await this.options.db.prepare("SELECT 1 AS owned FROM profile_faces WHERE profile_hash = ? AND face_id = ?").bind(profileHash, faceId).first());
  }

  async getPublic(faceId: string): Promise<{ bytes: ArrayBuffer; size: number } | null> {
    if (!UUID.test(faceId)) return null;
    const row = await this.options.db.prepare("SELECT object_key, byte_size FROM profile_faces WHERE face_id = ? AND content_type = 'image/png'").bind(faceId).first<{ object_key: string; byte_size: number }>();
    if (!row || row.byte_size > MAX_OUTPUT_BYTES || !row.object_key.startsWith(`profile-faces/${faceId}.`)) return null;
    const object = await this.options.storage.get(row.object_key);
    if (!object || object.size !== row.byte_size) return null;
    return { bytes: await object.arrayBuffer(), size: row.byte_size };
  }
}

/** Rejects profile saves that reference another profile's generated face. */
export async function assertOwnedProfileFaceIds(db: D1Database, token: string, faceIds: string[]): Promise<void> {
  if (!faceIds.length) return;
  const profileHash = await sha256Hex(token);
  await db.batch(PROFILE_FACE_DDL.map(sql => db.prepare(sql)));
  for (const faceId of new Set(faceIds)) {
    if (!UUID.test(faceId)) throw new Error("PROFILE_FACE_NOT_OWNED");
    const row = await db.prepare("SELECT 1 AS owned FROM profile_faces WHERE profile_hash = ? AND face_id = ?").bind(profileHash, faceId).first();
    if (!row) throw new Error("PROFILE_FACE_NOT_OWNED");
  }
}
