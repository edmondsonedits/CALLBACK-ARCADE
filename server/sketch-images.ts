import type { SketchRelayTransformPayload } from "../lib/arcade/sketch-relay";
import { getAIProviders, type ImageAI } from "./ai";
import { getD1, loadRoom, persistMutation, runtimeEnv } from "./database";
import { confirmedImageContentType } from "./image-models";
import { applySketchRelayImageResult, isCurrentSketchRelayJob } from "./arcade/sketch_relay";
import type { ImageModel } from "../lib/contracts";
import { isOpenAIImageBillingError, isOpenAIImageGuardError, OpenAIImageGuardError, OPENAI_IMAGE_MAX_PROMPT_CHARS, reserveOpenAIImageRequest, tripOpenAIImageCircuit, type OpenAIImageReservation } from "./openai-image-guard";

export const SKETCH_MAX_BYTES = 450_000;
export const SKETCH_UPLOAD_TIMEOUT_MS = 10_000;
import { SKETCH_TRANSFORM_PROMPT } from "../lib/sketch-transform-prompt";
export { SKETCH_TRANSFORM_PROMPT } from "../lib/sketch-transform-prompt";

export class SketchUploadError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}

/** Read the stream with a hard byte limit even when Content-Length is absent or false. */
export async function readSketchPng(request: Request, timeoutMs = SKETCH_UPLOAD_TIMEOUT_MS): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/png") throw new SketchUploadError("PNG_REQUIRED", 415, "Send the drawing as image/png.");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > SKETCH_MAX_BYTES)) throw new SketchUploadError("SKETCH_TOO_LARGE", 413, "The drawing is too large.");
  if (!request.body) throw new SketchUploadError("EMPTY_SKETCH", 422, "The drawing is empty.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0; let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel().catch(() => {}); reject(new SketchUploadError("SKETCH_TIMEOUT", 408, "The drawing upload timed out. Please retry.")); }, timeoutMs); });
  try {
    await Promise.race([(async () => {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        total += value.byteLength;
        if (total > SKETCH_MAX_BYTES) { void reader.cancel().catch(() => {}); throw new SketchUploadError("SKETCH_TOO_LARGE", 413, "The drawing is too large."); }
        chunks.push(value);
      }
    })(), timedOut]);
  } finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes, ...validateSketchPng(bytes) };
}

export function validateSketchPng(bytes: Uint8Array): { width: number; height: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 45 || signature.some((byte, index) => bytes[index] !== byte)) throw new SketchUploadError("INVALID_PNG", 422, "The drawing must be a PNG image.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") throw new SketchUploadError("INVALID_PNG", 422, "The drawing has an invalid PNG header.");
  const width = view.getUint32(16); const height = view.getUint32(20);
  if (!width || width !== height || width > 512) throw new SketchUploadError("INVALID_SKETCH_SIZE", 422, "Use a square PNG no larger than 512 pixels.");
  let offset = 8; let hasData = false; let complete = false;
  while (offset + 12 <= bytes.length) {
    const size = view.getUint32(offset); const end = offset + 12 + size;
    if (end > bytes.length) throw new SketchUploadError("INVALID_PNG", 422, "The PNG drawing is incomplete.");
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === "IDAT" && size > 0) hasData = true;
    if (type === "IEND") { complete = size === 0 && end === bytes.length; break; }
    offset = end;
  }
  if (!hasData || !complete) throw new SketchUploadError("INVALID_PNG", 422, "The PNG drawing is incomplete.");
  return { width, height };
}

export async function sketchBytesHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export interface SketchTransformJob { id: string; room_id: string; kind: string; prompt_json: string; lease_owner?: string; attempts: number }
export function parseSketchTransformPayload(value: unknown): SketchRelayTransformPayload {
  if (!value || typeof value !== "object") throw new Error("INVALID_SKETCH_JOB");
  const p = value as Record<string, unknown>;
  if (p.kind !== "SKETCH_TRANSFORM" || !Number.isInteger(p.round) || Number(p.round) < 1 || Number(p.round) > 3 || !["drawing", "redraw"].includes(String(p.leg)) || !["matchId", "chainId", "sourceAssetId", "jobId"].every(key => typeof p[key] === "string" && String(p[key]).length > 0 && String(p[key]).length <= 160)) throw new Error("INVALID_SKETCH_JOB");
  if (p.prompt !== undefined && (typeof p.prompt !== "string" || !p.prompt.length || p.prompt.length > 240)) throw new Error("INVALID_SKETCH_JOB");
  return p as unknown as SketchRelayTransformPayload;
}

/** The original PNG is the reference for either configured provider; FLUX.2 remains the default. */
export async function transformSketchReference(bytes: Uint8Array, image: ImageAI = getAIProviders().image, model: ImageModel = "flux-2-fast", openAIReservation?: OpenAIImageReservation, openAIJob?: { jobId: string; roomId: string }) {
  validateSketchPng(bytes);
  return image.generate(SKETCH_TRANSFORM_PROMPT, { model, aspect: "square", outputSize: 1024, references: [{ bytes, contentType: "image/png" }], ...(openAIReservation && openAIJob ? { openAIReservation, openAIJobId: openAIJob.jobId, openAIRoomId: openAIJob.roomId } : {}) });
}

async function requireSketchJob(code: string, job: SketchTransformJob, payload: SketchRelayTransformPayload) {
  const loaded = await loadRoom(code);
  if (!loaded || loaded.state.id !== job.room_id || !isCurrentSketchRelayJob(loaded.state, payload, Date.now())) throw new Error("STALE_SKETCH_JOB");
  const owned = await getD1().prepare("SELECT 1 AS owned FROM jobs WHERE id = ? AND room_id = ? AND kind = 'SKETCH_TRANSFORM' AND status = 'GENERATING' AND lease_owner = ? AND lease_expires_at > ?").bind(job.id, job.room_id, job.lease_owner, Date.now()).first();
  if (!owned) throw new Error("JOB_LEASE_CHANGED");
  return loaded;
}

export async function runSketchTransformJob(code: string, job: SketchTransformJob): Promise<{ status: "READY" | "FALLBACK"; assetId: string; reason?: "ALLOWANCE_STOP" }> {
  const payload = parseSketchTransformPayload(JSON.parse(job.prompt_json));
  if (payload.jobId !== job.id || !job.lease_owner) throw new Error("INVALID_SKETCH_JOB");
  const initial = await requireSketchJob(code, job, payload);
  const model: ImageModel = initial.state.imageModel === "openai-low" ? "openai-low" : "flux-2-fast";
  const storage = runtimeEnv().MEDIA;
  let output: { objectKey: string; contentType: string; byteSize: number } | undefined;
  let failure: string | undefined;
  try {
    if (job.attempts > 0) throw new Error("SKETCH_ATTEMPT_EXPIRED");
    if (!storage) throw new Error("R2_UNAVAILABLE");
    const source = await getD1().prepare("SELECT object_key, prompt_json, content_type, byte_size FROM jobs WHERE id = ? AND room_id = ? AND kind = 'SKETCH_UPLOAD' AND status = 'READY'").bind(payload.sourceAssetId, job.room_id).first<{ object_key: string; prompt_json: string; content_type: string; byte_size: number }>();
    if (!source || source.content_type !== "image/png" || source.byte_size > SKETCH_MAX_BYTES) throw new Error("SKETCH_SOURCE_UNAVAILABLE");
    const receipt = JSON.parse(source.prompt_json) as Record<string, unknown>;
    if (receipt.matchId !== payload.matchId || receipt.round !== payload.round || receipt.chainId !== payload.chainId || receipt.leg !== payload.leg || receipt.assetId !== payload.sourceAssetId || receipt.objectKey !== source.object_key || receipt.byteSize !== source.byte_size || receipt.contentType !== source.content_type) throw new Error("SKETCH_SOURCE_MISMATCH");
    const object = await storage.get(source.object_key);
    if (!object || object.size !== source.byte_size || object.size > SKETCH_MAX_BYTES) throw new Error("SKETCH_SOURCE_UNAVAILABLE");
    const bytes = new Uint8Array(await object.arrayBuffer());
    const dimensions = validateSketchPng(bytes);
    if (receipt.width !== dimensions.width || receipt.height !== dimensions.height) throw new Error("SKETCH_SOURCE_MISMATCH");
    if (typeof receipt.sha256 !== "string" || await sketchBytesHash(bytes) !== receipt.sha256) throw new Error("SKETCH_SOURCE_MISMATCH");
    await requireSketchJob(code, job, payload);
    let reservation: OpenAIImageReservation | undefined;
    if (model === "openai-low") {
      if (SKETCH_TRANSFORM_PROMPT.length > OPENAI_IMAGE_MAX_PROMPT_CHARS) throw new OpenAIImageGuardError("OPENAI_IMAGE_PROMPT_TOO_LONG");
      const reserved = await reserveOpenAIImageRequest({ db: getD1(), config: runtimeEnv(), jobId: job.id, roomId: job.room_id });
      if (!reserved.reserved) throw new OpenAIImageGuardError(reserved.code, reserved.message);
      reservation = reserved.reservation;
    }
    let generated;
    try { generated = await transformSketchReference(bytes, getAIProviders().image, model, reservation, { jobId: job.id, roomId: job.room_id }); }
    catch (error) {
      if (model === "openai-low" && isOpenAIImageBillingError(error)) {
        try { await tripOpenAIImageCircuit(getD1(), reservation!.creditWindowId, Date.now(), reservation!.jobId); } catch { /* The in-process latch is set before persistence is attempted. */ }
        throw new OpenAIImageGuardError("ALLOWANCE_STOP");
      }
      if (model === "openai-low") {
        if (isOpenAIImageGuardError(error)) throw error;
        throw new Error("IMAGE_PROVIDER_FAILED");
      }
      throw error;
    }
    await requireSketchJob(code, job, payload);
    if (!generated) throw new Error("IMAGE_PROVIDER_UNAVAILABLE");
    const contentType = confirmedImageContentType(generated.bytes);
    // A lease-specific key prevents a late attempt from replacing another worker's result.
    const objectKey = `rooms/${job.room_id}/${job.id}-${job.lease_owner}.image`;
    await storage.put(objectKey, generated.bytes, { httpMetadata: { contentType }, customMetadata: { roomId: job.room_id, jobId: job.id, purpose: "sketch-transform" } });
    const stored = await storage.head(objectKey);
    if (!stored || stored.size !== generated.bytes.byteLength) throw new Error("IMAGE_STORAGE_CONFIRMATION_FAILED");
    output = { objectKey, contentType, byteSize: generated.bytes.byteLength };
  } catch (error) {
    if (error instanceof Error && ["STALE_SKETCH_JOB", "JOB_LEASE_CHANGED"].includes(error.message)) throw error;
    failure = isOpenAIImageGuardError(error) ? error.code : error instanceof Error ? error.message.slice(0, 80) : "SKETCH_TRANSFORM_FAILED";
  }
  // All ten players may finish together; each independent image still wins its own room CAS.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const loaded = await requireSketchJob(code, job, payload);
    const status = output ? "READY" : "FALLBACK";
    const assetId = output ? job.id : payload.sourceAssetId;
    const now = Date.now();
    const result = applySketchRelayImageResult(loaded.state, { ...payload, status, assetId }, now);
    const allowanceStop = Boolean(failure && (failure === "ALLOWANCE_STOP" || failure.startsWith("OPENAI_IMAGE_") || failure.startsWith("OPENAI_IMAGES_")));
    if (allowanceStop) result.next.imageGenerationNotice = { kind: "FAILED", failedModel: "openai-low", updatedAt: now, reason: "ALLOWANCE_STOP" };
    const won = await persistMutation({ base: loaded.state, next: result.next, actionId: `sketch-job:${job.id}:${job.lease_owner}`, actorId: "job-runner", actionType: `SKETCH_IMAGE_${status}`, effects: [...result.effects, { type: "sketch_job_complete", id: job.id, leaseOwner: job.lease_owner, status, ...output, errorCode: failure, now }], recordAction: false });
    if (won) return { status, assetId, ...(allowanceStop ? { reason: "ALLOWANCE_STOP" as const } : {}) };
  }
  throw new Error("JOB_LEASE_CHANGED");
}
