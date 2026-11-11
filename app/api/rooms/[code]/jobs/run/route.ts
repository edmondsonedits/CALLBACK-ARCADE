import { apiError } from "../../../../../../lib/contracts";
import { makeId } from "../../../../../../lib/game/random";
import { getAIProviders, fallbackLoreOutput } from "../../../../../../server/ai";
import { authenticateRoom } from "../../../../../../server/auth";
import { getD1, loadRoom, persistMutation, runtimeEnv } from "../../../../../../server/database";
import { noStoreHeaders, readJson, requireSameOrigin } from "../../../../../../server/http";
import { enforceRateLimit } from "../../../../../../server/security";
import type { CallbackCandidateState, DbEffect, RemixCandidateState } from "../../../../../../server/types";
import { assembleImagePrompt } from "../../../../../../server/image-prompts";
import { confirmedImageContentType, imageJobLeaseMs, imageModelForAttempt, nextImageModel, selectedImageModelForJob } from "../../../../../../server/image-models";
import type { ImageModel } from "../../../../../../lib/contracts";
import { runSketchTransformJob } from "../../../../../../server/sketch-images";
import { isOpenAIImageBillingError, isOpenAIImageGuardError, OpenAIImageGuardError, OPENAI_IMAGE_MAX_PROMPT_CHARS, reserveOpenAIImageRequest, tripOpenAIImageCircuit } from "../../../../../../server/openai-image-guard";

interface JobRow { lease_owner?:string; id: string; room_id: string; round_id: string; kind: string; status: string; prompt_json: string; attempts: number }

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const originError = requireSameOrigin(request); if (originError) return originError;
  const payload = await readJson(request); if (payload instanceof Response) return payload;
  if (typeof payload !== "object" || payload === null || Object.keys(payload).some((key) => key !== "jobId") || ("jobId" in payload && typeof payload.jobId !== "string")) return apiError("INVALID_REQUEST", "Jobs may only be selected by their authorized ID.", 422);
  const { code: rawCode } = await context.params; const code = rawCode.toUpperCase();
  const limited = await enforceRateLimit(request, `jobs:${code}`, 120); if (limited) return limited;
  const auth = await authenticateRoom(request, code, ["host", "player", "audience"]); if (auth instanceof Response) return auth;
  await import("../../../../../../server/player-creations/room-manifest").then(m=>m.retryFishArchives(auth.state.id)).catch(()=>{});
  const requestedId = "jobId" in payload ? payload.jobId as string : null;
  const job = requestedId
    ? await getD1().prepare("SELECT id, room_id, round_id, kind, status, prompt_json, attempts FROM jobs WHERE id = ? AND room_id = ?").bind(requestedId, auth.state.id).first<JobRow>()
    : await getD1().prepare("SELECT id, room_id, round_id, kind, status, prompt_json, attempts FROM jobs WHERE room_id = ? AND (status = 'QUEUED' OR (status = 'GENERATING' AND lease_expires_at < ?)) ORDER BY CASE WHEN kind = 'LORE_ANALYSIS' THEN 0 ELSE 1 END, created_at LIMIT 1").bind(auth.state.id, Date.now()).first<JobRow>();
  if (!job) return new Response(null, { status: 204, headers: noStoreHeaders() });
  if (["READY", "FALLBACK", "FAILED"].includes(job.status)) return Response.json({ jobId: job.id, status: job.status, idempotent: true }, { headers: noStoreHeaders() });
  const leaseOwner = makeId("lease"); const now = Date.now();
  const leaseMs = job.kind === "SKETCH_TRANSFORM" ? (auth.state.imageModel === "openai-low" ? 150_000 : 90_000) : imageJobLeaseMs(job.kind, selectedModelForJob(job, JSON.parse(job.prompt_json) as Record<string, unknown>), job.attempts);
  const leased = await getD1().prepare("UPDATE jobs SET status = 'GENERATING', lease_owner = ?, lease_expires_at = ?, attempts = attempts + 1, updated_at = ? WHERE id = ? AND room_id = ? AND (status = 'QUEUED' OR (status = 'GENERATING' AND lease_expires_at < ?)) AND attempts = ? AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='main' AND child_code=(SELECT code FROM rooms WHERE id=jobs.room_id) AND active=0)").bind(leaseOwner, now + leaseMs, now, job.id, auth.state.id, now, job.attempts).run();
  if (Number(leased.meta.changes ?? 0) !== 1) return Response.json({ jobId: job.id, status: "GENERATING", idempotent: true }, { status: 202, headers: noStoreHeaders() });
  job.lease_owner=leaseOwner;
  try {
    await requireActiveJob(code,job);
    const prompt = JSON.parse(job.prompt_json) as Record<string, unknown>;
    if (job.kind === "SKETCH_TRANSFORM") return Response.json({ jobId: job.id, ...await runSketchTransformJob(code, job) }, { headers: noStoreHeaders() });
    if (job.kind === "LORE_ANALYSIS") return await runLoreJob(code, job, prompt);
    return await runImageJob(code, job, prompt);
  } catch (error) {
    if (job.kind === "SKETCH_TRANSFORM") {
      // Sketch jobs handle terminal source fallback in their own atomic room/job mutation.
      // A stale worker can only retire its own lease; it cannot resurrect an old round.
      await getD1().prepare("UPDATE jobs SET status = 'FAILED', lease_owner = NULL, lease_expires_at = NULL, error_code = 'STALE_SKETCH_JOB', updated_at = ? WHERE id = ? AND room_id = ? AND status = 'GENERATING' AND lease_owner = ?").bind(Date.now(), job.id, job.room_id, job.lease_owner).run();
      return Response.json({ jobId: job.id, status: "FAILED", stale: true }, { status: 409, headers: noStoreHeaders() });
    }
    if(!await loadRoom(code)){await runtimeEnv().MEDIA?.delete([`rooms/${job.room_id}/${job.id}-reference`,`rooms/${job.room_id}/${job.id}.webp`]);return apiError("GAME_RETIRED","This game has closed.",410);}
    if(error instanceof Error&&["GAME_RETIRED","JOB_LEASE_CHANGED"].includes(error.message))return apiError("GAME_RETIRED","This game has closed.",410);
    console.error("CALLBACK job failed", job.id, error instanceof Error ? error.name : "JOB_FAILED");
    const guarded = isOpenAIImageGuardError(error);
    const allowanceStop = guarded;
    const codeName = guarded ? error.code : error instanceof Error ? error.message.slice(0, 80) : "JOB_FAILED";
    if (job.kind !== "LORE_ANALYSIS" && !guarded) {
      const retry = await requeueImageJob(code, job, leaseOwner, codeName);
      if (retry) return Response.json({ jobId: job.id, status: "QUEUED", retrying: true, failedModel: retry.failedModel, nextModel: retry.nextModel }, { status: 202, headers: noStoreHeaders() });
    }
    await markFallback(job.id, codeName,job.lease_owner);
    const failedModel = job.kind === "LORE_ANALYSIS" ? undefined : modelForJobAttempt(job, JSON.parse(job.prompt_json) as Record<string, unknown>);
    await updateRoomImage(code, job, "FALLBACK", undefined, failedModel ? { kind: "FAILED", failedModel, updatedAt: Date.now(), ...(allowanceStop ? { reason: "ALLOWANCE_STOP" as const } : {}) } : undefined);
    return Response.json({ jobId: job.id, status: "FALLBACK", fallback: true }, { headers: noStoreHeaders() });
  }
}

async function runLoreJob(code: string, job: JobRow, prompt: Record<string, unknown>) {
  const answers = Array.isArray(prompt.answers) ? prompt.answers.filter((answer): answer is { id: string; memoryId: string; playerId: string; text: string } => Boolean(answer && typeof answer === "object" && "id" in answer && "memoryId" in answer && "playerId" in answer && "text" in answer && typeof answer.id === "string" && typeof answer.memoryId === "string" && typeof answer.playerId === "string" && typeof answer.text === "string")) : [];
  const providers = getAIProviders();
  const sourceRoom = await loadRoom(code); if (!sourceRoom) throw new Error("ROOM_EXPIRED");
  const memoryRole = ["ANCHOR", "VOICE", "WORLD", "CONSEQUENCE"].includes(String(prompt.memoryRole)) ? String(prompt.memoryRole) as "ANCHOR" | "VOICE" | "WORLD" | "CONSEQUENCE" : null;
  if (!memoryRole) throw new Error("INVALID_MEMORY_ROLE");
  const loreInput = {
    prompt: String(prompt.prompt ?? ""), memoryRole,
    comedyPreferences: Array.isArray(prompt.comedyPreferences) ? prompt.comedyPreferences.filter((value): value is string => typeof value === "string").slice(0, 4) : [],
    answers: answers.map(({ id, memoryId, text }) => ({ id, memoryId, text })),
    graph: { nodes: sourceRoom.state.lore, edges: sourceRoom.state.memoryEdges },
  };
  let output;
  await requireActiveJob(code,job);
  try { output = await providers.lore.analyze(loreInput); }
  catch { output = await fallbackLoreOutput(loreInput); }
  await requireActiveJob(code,job);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await loadRoom(code); if (!loaded) throw new Error("ROOM_EXPIRED");
    const next = structuredClone(loaded.state); const effects: DbEffect[] = [];
    for (const analysis of output.analyses) {
      const source = answers.find((answer) => answer.id === analysis.sourceAnswerId);
      const lore = source ? next.lore.find((item) => item.id === source.memoryId && item.sourceAnswerId === source.id && item.winner) : null;
      if (!lore) continue;
      lore.shortMeaning = analysis.shortMeaning;
      lore.quality = analysis.quality;
      lore.callbackPotential = analysis.callbackPotential;
      lore.visualStrength = analysis.visualStrength;
      lore.canSpeak = analysis.canSpeak;
      lore.tags = analysis.tags;
      lore.safe = true;
      effects.push({ type: "lore_update", lore });
    }
    const memoryIds = next.lore.filter((item) => item.winner).map((item) => item.id);
    for (const candidate of output.callbackCandidates.filter((item) => usableCandidate(item, memoryIds, next.callbackCandidates.map((item) => item.prompt), "CALLBACK"))) {
      const callback: CallbackCandidateState = {
        id: makeId("callback"), sourceMemoryIds: candidate.sourceMemoryIds, setup: candidate.setup, question: candidate.question,
        prompt: candidate.prompt, coherence: candidate.coherence, answerability: candidate.answerability, surprise: candidate.surprise, used: false,
        sourceRoundId: job.round_id, usageCount: 0, lastUsedRoundIndex: null,
      };
      next.callbackCandidates.push(callback);
      const sourceAuthorId = next.lore.find((item) => item.id === callback.sourceMemoryIds[0])?.sourceAuthorId;
      effects.push({ type: "callback", callback, roundId: job.round_id, sourceAuthorId });
    }
    for (const candidate of output.remixCandidates.filter((item) => usableCandidate(item, memoryIds, next.remixCandidates.map((item) => item.prompt), "REMIX"))) {
      const remix: RemixCandidateState = {
        id: makeId("remix"), purpose: "REMIX", sourceMemoryIds: candidate.sourceMemoryIds, setup: candidate.setup, question: candidate.question,
        prompt: candidate.prompt, coherence: candidate.coherence, answerability: candidate.answerability, surprise: candidate.surprise, used: false,
        sourceRoundId: job.round_id, usageCount: 0, lastUsedRoundIndex: null,
      };
      next.remixCandidates.push(remix);
      const sourceAuthorId = next.lore.find((item) => item.id === remix.sourceMemoryIds[0])?.sourceAuthorId;
      effects.push({ type: "callback", callback: remix, roundId: job.round_id, sourceAuthorId });
    }
    const won = await persistMutation({ base: loaded.state, next, actionId: `job:${job.id}:lore-ready`, actorId: "job-runner", actionType: "LORE_JOB_READY", effects, recordAction: false });
    if (won) {
      await getD1().prepare("UPDATE jobs SET status = 'READY', lease_owner = NULL, lease_expires_at = NULL, safety = 'safe', updated_at = ? WHERE id = ? AND lease_owner = ? AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='main' AND child_code=(SELECT code FROM rooms WHERE id=jobs.room_id) AND active=0)").bind(Date.now(), job.id,job.lease_owner).run();
      return Response.json({ jobId: job.id, status: "READY", live: getAIProviders().live, analyzedMemoryCount: effects.filter((effect) => effect.type === "lore_update").length, callbackCount: effects.filter((effect) => effect.type === "callback").length }, { headers: noStoreHeaders() });
    }
  }
  throw new Error("ROOM_VERSION_RACE");
}

function usableCandidate(candidate: { sourceMemoryIds: string[]; prompt: string; question: string; coherence: number; answerability: number; surprise: number; closedEnded: boolean; repetitive: boolean; semanticallyConnected: boolean }, memoryIds: string[], existingPrompts: string[], purpose: "CALLBACK" | "REMIX"): boolean {
  const minimumSources = purpose === "REMIX" ? 3 : 2;
  const minimumCoherence = purpose === "REMIX" ? 0.78 : 0.74;
  if (candidate.closedEnded || candidate.repetitive || !candidate.semanticallyConnected) return false;
  if (candidate.coherence < minimumCoherence || candidate.answerability < 0.7 || candidate.surprise < 0.42) return false;
  if (candidate.sourceMemoryIds.length < minimumSources || candidate.sourceMemoryIds.length > 4 || new Set(candidate.sourceMemoryIds).size !== candidate.sourceMemoryIds.length) return false;
  if (!candidate.sourceMemoryIds.every((id) => memoryIds.includes(id))) return false;
  const normalized = candidate.prompt.normalize("NFKC").trim().toLocaleLowerCase();
  if (normalized.length < 20 || normalized.length > 560 || existingPrompts.some((prompt) => prompt.normalize("NFKC").trim().toLocaleLowerCase() === normalized)) return false;
  return candidate.question.trim().endsWith("?") && normalized.endsWith(candidate.question.normalize("NFKC").trim().toLocaleLowerCase());
}

async function runImageJob(code: string, job: JobRow, prompt: Record<string, unknown>) {
  await requireActiveJob(code,job);
  const providers = getAIProviders();
  const isSquarePromptImage = ["KING_PROMPT_IMAGE", "KING_MYSTERY_IMAGE", "KING_RESTORATION_PATCH", "COMIC_PANEL_IMAGE"].includes(job.kind);
  const imageModel = modelForJobAttempt(job, prompt);
  if (!imageModel) throw new Error("IMAGE_MODELS_EXHAUSTED");
  const storage = runtimeEnv().MEDIA; if (!storage) throw new Error("R2_UNAVAILABLE");
  const references = job.kind === "COMIC_PANEL_IMAGE" && imageModel !== "flux-1-schnell" ? await loadComicReferences(storage, job.room_id, prompt.referenceAssetIds) : [];
  const assembled = assembleImagePrompt(job.kind, { ...prompt, suppliedReferenceCount: references.length });
  if (imageModel === "openai-low" && assembled.length > OPENAI_IMAGE_MAX_PROMPT_CHARS) throw new OpenAIImageGuardError("OPENAI_IMAGE_PROMPT_TOO_LONG", "This image prompt is too long for OpenAI Images. Choose another generator or continue with the concept card.");
  let openAIReservation;
  if (imageModel === "openai-low") {
    const reservation = await reserveOpenAIImageRequest({ db: getD1(), config: runtimeEnv(), jobId: job.id, roomId: job.room_id });
    if (!reservation.reserved) throw new OpenAIImageGuardError(reservation.code, reservation.message);
    openAIReservation = reservation.reservation;
  }
  let generated;
  try {
    generated = await providers.image.generate(assembled, { model: imageModel, aspect: isSquarePromptImage ? "square" : "landscape", references, ...(job.kind === "COMIC_PANEL_IMAGE" ? { outputSize: 480 } : {}), ...(openAIReservation ? { openAIReservation, openAIJobId: job.id, openAIRoomId: job.room_id } : {}) });
  } catch (error) {
    if (imageModel === "openai-low" && isOpenAIImageBillingError(error)) {
      try { await tripOpenAIImageCircuit(getD1(), openAIReservation!.creditWindowId, Date.now(), openAIReservation!.jobId); } catch { /* The in-process latch is set before persistence is attempted. */ }
      throw new OpenAIImageGuardError("ALLOWANCE_STOP");
    }
    if (imageModel === "openai-low") {
      if (isOpenAIImageGuardError(error)) throw error;
      throw new Error("IMAGE_PROVIDER_FAILED");
    }
    throw error;
  }
  await requireActiveJob(code,job);
  if (!generated) { await markFallback(job.id, "MOCK_CONCEPT_CARD",job.lease_owner); await updateRoomImage(code, job, "FALLBACK"); return Response.json({ jobId: job.id, status: "FALLBACK", live: false }, { headers: noStoreHeaders() }); }
  confirmedImageContentType(generated.bytes);
  if (job.kind === "COMIC_PANEL_IMAGE" && imageModel !== "flux-1-schnell") {
    await requireActiveJob(code,job);
    await storage.put(`rooms/${job.room_id}/${job.id}-reference`, generated.bytes, { httpMetadata: { contentType: generated.contentType }, customMetadata: { roomId: job.room_id, jobId: job.id, purpose: "comic-reference" } });
  }
  let bytes = generated.bytes; let contentType = generated.contentType;
  const transformer = runtimeEnv().IMAGES;
  if (transformer) {
    const inputBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const transformed = await transformer.input(new Blob([inputBytes]).stream()).transform(isSquarePromptImage ? { width: 1024, height: 1024, fit: "cover" } : { width: 2048, height: 1152, fit: "cover" }).output({ format: "image/webp", quality: 85 });
    const response = transformed.response(); bytes = new Uint8Array(await response.arrayBuffer()); contentType = "image/webp";
  }
  contentType = confirmedImageContentType(bytes);
  await requireActiveJob(code,job);
  const objectKey = `rooms/${job.room_id}/${job.id}.webp`;
  await storage.put(objectKey, bytes, { httpMetadata: { contentType }, customMetadata: { roomId: job.room_id, jobId: job.id } });
  try{await requireActiveJob(code,job);}catch(e){if(e instanceof Error&&e.message==="GAME_RETIRED"){await storage.delete(objectKey);if(job.kind==="COMIC_PANEL_IMAGE")await storage.delete(`rooms/${job.room_id}/${job.id}-reference`);}throw e;}
  const stored = await storage.head(objectKey);
  if (!stored || stored.size !== bytes.byteLength) throw new Error("IMAGE_STORAGE_CONFIRMATION_FAILED");
  await getD1().prepare("UPDATE jobs SET status = 'READY', lease_owner = NULL, lease_expires_at = NULL, object_key = ?, content_type = ?, byte_size = ?, safety = 'safe', updated_at = ? WHERE id = ? AND lease_owner = ? AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='main' AND child_code=(SELECT code FROM rooms WHERE id=jobs.room_id) AND active=0)").bind(objectKey, contentType, bytes.byteLength, Date.now(), job.id,job.lease_owner).run();
  await updateRoomImage(code, job, "READY", job.id);
  return Response.json({ jobId: job.id, status: "READY", assetId: job.id, live: true }, { headers: noStoreHeaders() });
}

async function loadComicReferences(storage: R2Bucket, roomId: string, value: unknown): Promise<Array<{ bytes: Uint8Array; contentType: string }>> {
  const assetIds = Array.isArray(value) ? value.filter((assetId): assetId is string => typeof assetId === "string" && /^[a-z0-9_-]{1,100}$/iu.test(assetId)).slice(-4) : [];
  const references: Array<{ bytes: Uint8Array; contentType: string }> = [];
  for (const assetId of assetIds) {
    const object = await storage.get(`rooms/${roomId}/${assetId}-reference`);
    if (!object) continue;
    references.push({ bytes: new Uint8Array(await object.arrayBuffer()), contentType: object.httpMetadata?.contentType ?? "image/jpeg" });
  }
  return references;
}

async function markFallback(jobId: string, code: string,owner?:string) { await getD1().prepare("UPDATE jobs SET status = 'FALLBACK', lease_owner = NULL, lease_expires_at = NULL, error_code = ?, updated_at = ? WHERE id = ? AND lease_owner = ? AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='main' AND child_code=(SELECT code FROM rooms WHERE id=jobs.room_id) AND active=0)").bind(code, Date.now(), jobId,owner).run(); }

function selectedModelForJob(job: JobRow, prompt: Record<string, unknown>): ImageModel {
  return selectedImageModelForJob(job.kind, prompt.imageModel);
}

function modelForJobAttempt(job: JobRow, prompt: Record<string, unknown>): ImageModel | null {
  return imageModelForAttempt(selectedModelForJob(job, prompt), job.attempts);
}

async function requeueImageJob(code: string, job: JobRow, leaseOwner: string, errorCode: string): Promise<{ failedModel: ImageModel; nextModel: ImageModel } | null> {
  const prompt = JSON.parse(job.prompt_json) as Record<string, unknown>;
  const selected = selectedModelForJob(job, prompt);
  const failedModel = imageModelForAttempt(selected, job.attempts);
  const nextModel = nextImageModel(selected, job.attempts);
  if (!failedModel || !nextModel) return null;
  const queued = await getD1().prepare("UPDATE jobs SET status = 'QUEUED', lease_owner = NULL, lease_expires_at = NULL, error_code = ?, updated_at = ? WHERE id = ? AND lease_owner = ? AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_kind='main' AND child_code=(SELECT code FROM rooms WHERE id=jobs.room_id) AND active=0)").bind(errorCode, Date.now(), job.id, leaseOwner).run();
  if (Number(queued.meta.changes ?? 0) !== 1) return null;
  await updateRoomImage(code, job, "QUEUED", undefined, { kind: "RETRYING", failedModel, nextModel, updatedAt: Date.now() }, `retry-${job.attempts + 1}`);
  return { failedModel, nextModel };
}

async function updateRoomImage(code: string, job: JobRow, status: "QUEUED" | "READY" | "FALLBACK", assetId?: string, notice?: { kind: "RETRYING" | "FAILED"; failedModel: ImageModel; nextModel?: ImageModel; updatedAt: number; reason?: "ALLOWANCE_STOP" }, actionSuffix = status.toLowerCase()) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await loadRoom(code); if (!loaded) return;
    const next = structuredClone(loaded.state);
    const prompt = JSON.parse(job.prompt_json) as { answerId?: string };
    const answerId = ["KING_PROMPT_IMAGE", "KING_MYSTERY_IMAGE", "KING_RESTORATION_PATCH", "COMIC_PANEL_IMAGE"].includes(job.kind) ? prompt.answerId : undefined;
    const image = answerId ? (next.kingImages ?? {})[answerId] : job.kind === "ANCHOR_IMAGE" ? next.anchorImage : job.kind === "REMIX_IMAGE" ? next.finalImage : next.currentRound?.id === job.round_id ? next.currentRound.image : null;
    if (!image || image.jobId !== job.id) return;
    const updated = { ...image, status, ...(assetId ? { assetId } : {}) };
    if (answerId) { next.kingImages ??= {}; next.kingImages[answerId] = updated; }
    else if (job.kind === "ANCHOR_IMAGE") next.anchorImage = updated;
    else if (job.kind === "REMIX_IMAGE") next.finalImage = updated;
    else if (next.currentRound) next.currentRound.image = updated;
    if (notice) next.imageGenerationNotice = notice;
    else if (status === "READY" && !Object.values(next.kingImages ?? {}).some((item) => ["QUEUED", "GENERATING"].includes(item.status))) next.imageGenerationNotice = null;
    const won = await persistMutation({ base: loaded.state, next, actionId: `job:${job.id}:${actionSuffix}`, actorId: "job-runner", actionType: `IMAGE_${status}`, effects: [], recordAction: false });
    if (won) return;
  }
}

async function requireActiveJob(code:string,job:JobRow){if(!await loadRoom(code))throw new Error('GAME_RETIRED');const row=await getD1().prepare("SELECT 1 AS owned FROM jobs WHERE id=? AND lease_owner=? AND status='GENERATING'").bind(job.id,job.lease_owner).first();if(!row)throw new Error('JOB_LEASE_CHANGED');}
