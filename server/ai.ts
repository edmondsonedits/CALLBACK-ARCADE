import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { stableHash } from "../lib/game/random";
import { runtimeEnv } from "./database";
import type { LoreState, MemoryEdgeState } from "./types";
import type { ImageModel } from "../lib/contracts";
import { CLOUDFLARE_FLUX2_MODEL_IDS, confirmedImageContentType } from "./image-models";
import { OpenAILowImageAI } from "./openai-image";
import { consumeOpenAIImageReservation, openAIImageAccess, OpenAIImageGuardError, OPENAI_IMAGE_MAX_PROMPT_CHARS, type OpenAIImageReservation } from "./openai-image-guard";

const LoreOutputSchema = z.object({
  analyses: z.array(z.object({
    sourceAnswerId: z.string(), quality: z.number().min(0).max(1), entityType: z.enum(["character", "mascot", "product", "object", "place", "business", "vehicle", "quote", "rule", "event", "consequence", "other"]),
    tags: z.array(z.string().min(1).max(40)).max(8), callbackPotential: z.number().min(0).max(1), visualStrength: z.number().min(0).max(1), canSpeak: z.boolean(),
    shortMeaning: z.string().min(1).max(120),
  }).strict()).max(4),
  callbackCandidates: z.array(z.object({
    sourceMemoryIds: z.array(z.string()).min(2).max(4), setup: z.string().min(10).max(360), question: z.string().min(8).max(140), prompt: z.string().min(20).max(500),
    coherence: z.number().min(0).max(1), answerability: z.number().min(0).max(1), surprise: z.number().min(0).max(1),
    closedEnded: z.boolean(), repetitive: z.boolean(), semanticallyConnected: z.boolean(),
  }).strict()).max(4),
  remixCandidates: z.array(z.object({
    sourceMemoryIds: z.array(z.string()).min(3).max(4), setup: z.string().min(10).max(420), question: z.string().min(8).max(140), prompt: z.string().min(20).max(560),
    coherence: z.number().min(0).max(1), answerability: z.number().min(0).max(1), surprise: z.number().min(0).max(1),
    closedEnded: z.boolean(), repetitive: z.boolean(), semanticallyConnected: z.boolean(),
  }).strict()).max(3),
}).strict();

export type LoreOutput = z.infer<typeof LoreOutputSchema>;
export interface LoreInput {
  prompt: string;
  memoryRole: "ANCHOR" | "VOICE" | "WORLD" | "CONSEQUENCE";
  comedyPreferences?: string[];
  answers: Array<{ id: string; memoryId: string; text: string }>;
  graph: { nodes: LoreState[]; edges: MemoryEdgeState[] };
}
export interface LoreAI { analyze(input: LoreInput): Promise<LoreOutput> }
interface ImageReference { bytes: Uint8Array; contentType: string }
export interface ImageGenerationOptions { model: ImageModel; aspect: "square" | "landscape"; references?: ImageReference[]; outputSize?: number; openAIReservation?: OpenAIImageReservation; openAIJobId?: string; openAIRoomId?: string }
export interface ImageAI { generate(prompt: string, options: ImageGenerationOptions): Promise<{ bytes: Uint8Array; contentType: string } | null> }

const COMEDY_WRITER_SYSTEM_PROMPT = "You are the invisible backstage comedy writer for CALLBACK. Analyze only the supplied winning or tied-winning answer in its original prompt context. Respect its assigned memory role: ANCHOR is a reusable character/product/object/place/business/vehicle/mascot; VOICE is what the established Anchor says; WORLD is an independent law/holiday/policy/rule/trend/event; CONSEQUENCE is what happened after the connected memories collided. Preserve the players' exact ideas. Use the supplied graph relationships and lean toward the supplied comedyPreferences when they fit naturally. Generate up to four callback candidates only when the Anchor, optional Voice, and World form a coherent causal setup. Generate Remix candidates only when a Consequence also exists. Every candidate must establish a specific character or status, place it in a concrete situation, escalate causally, and end in one short highly answerable open question. Lead players toward a strong joke without supplying the punchline. Prefer status reversals, mundane problems treated as epic, social embarrassment, confident incompetence, and specific visual details. Reject low-confidence, repetitive, closed-ended, generic, or semantically disconnected combinations. Do not invent scoring, winners, mechanics, identities, or unrelated lore. Return only valid JSON matching the requested structure.";

class MockLoreAI implements LoreAI {
  async analyze(input: LoreInput): Promise<LoreOutput> {
    const primary = (kind: LoreState["kind"]) => input.graph.nodes.find((node) => node.kind === kind && node.safe);
    const anchor = primary("ANCHOR"); const voice = primary("VOICE"); const world = primary("WORLD"); const consequence = primary("CONSEQUENCE");
    const callbackSetup = anchor && world ? `${anchor.text}${voice ? `, now famous for “${voice.text},”` : ""} is placed in charge of enforcing “${world.text}.”` : "";
    const remixSetup = anchor && consequence ? `Following “${consequence.text},” ${anchor.text} refuses to disappear.${voice ? ` The only public statement remains “${voice.text}.”` : ""}${world ? ` Meanwhile, “${world.text}” is still official policy.` : ""}` : "";
    const remixMemoryIds = [anchor?.id, voice?.id, world?.id, consequence?.id].filter((id): id is string => Boolean(id)).slice(0, 4);
    return LoreOutputSchema.parse({
      analyses: input.answers.map((answer) => ({
        sourceAnswerId: answer.id, quality: 0.76 + (stableHash(answer.text) % 18) / 100,
        entityType: input.memoryRole === "ANCHOR" ? (["character", "mascot", "product", "object"][stableHash(answer.id) % 4]) : input.memoryRole === "VOICE" ? "quote" : input.memoryRole === "WORLD" ? "rule" : "consequence",
        tags: answer.text.split(/\s+/).map((word) => word.replace(/[^\p{L}\p{N}]/gu, "")).filter((word) => word.length > 4).slice(0, 5),
        callbackPotential: 0.82, visualStrength: input.memoryRole === "ANCHOR" ? 0.88 : 0.62, canSpeak: input.memoryRole === "ANCHOR", shortMeaning: answer.text.slice(0, 110),
      })),
      callbackCandidates: callbackSetup && anchor && world ? [{
        sourceMemoryIds: [anchor.id, ...(voice ? [voice.id] : []), world.id], setup: callbackSetup, question: "What goes wrong on day one?",
        prompt: `${callbackSetup} What goes wrong on day one?`, coherence: 0.9, answerability: 0.94, surprise: 0.82, closedEnded: false, repetitive: false, semanticallyConnected: true,
      }] : [],
      remixCandidates: remixSetup && remixMemoryIds.length >= 3 ? [{
        sourceMemoryIds: remixMemoryIds, setup: remixSetup, question: "What's the first message to the nation?",
        prompt: `${remixSetup} What's the first message to the nation?`, coherence: 0.92, answerability: 0.93, surprise: 0.84, closedEnded: false, repetitive: false, semanticallyConnected: true,
      }] : [],
    });
  }
}

export async function fallbackLoreOutput(input: LoreInput): Promise<LoreOutput> {
  return new MockLoreAI().analyze(input);
}

class RealLoreAI implements LoreAI {
  constructor(private client: OpenAI, private model: string, private effort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh") {}
  async analyze(input: LoreInput): Promise<LoreOutput> {
    const response = await withOneRetry(() => this.client.responses.parse({
      model: this.model,
      reasoning: { effort: this.effort },
      input: [
        { role: "system", content: COMEDY_WRITER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
      text: { format: zodTextFormat(LoreOutputSchema, "callback_lore") },
    }, { timeout: 20_000 }));
    if (!response.output_parsed) throw new Error("MALFORMED_LORE_OUTPUT");
    return LoreOutputSchema.parse(response.output_parsed);
  }
}

class CloudflareLoreAI implements LoreAI {
  constructor(private accountId: string, private token: string, private model: string) {}
  async analyze(input: LoreInput): Promise<LoreOutput> {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/run/${this.model}`;
    const seed = Math.max(1, stableHash(JSON.stringify(input)));
    const payload = await withOneRetry(() => fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "system", content: COMEDY_WRITER_SYSTEM_PROMPT }, { role: "user", content: JSON.stringify(input) }],
        response_format: { type: "json_object" }, max_tokens: 1100, temperature: 0.65, top_p: 0.9, seed,
      }),
      signal: AbortSignal.timeout(20_000),
    }).then(async (response) => {
      const body = await response.json().catch(() => null) as { result?: { response?: unknown }; errors?: Array<{ code?: number; message?: string }> } | null;
      if (!response.ok) {
        const detail = body?.errors?.map((error) => [error.code, error.message].filter(Boolean).join(":")).filter(Boolean).join(",").replace(/[^a-z0-9:,_ -]/giu, "").slice(0, 120);
        throw Object.assign(new Error(`CLOUDFLARE_TEXT_${response.status}${detail ? `_${detail}` : ""}`), { status: response.status });
      }
      return body?.result?.response;
    }));
    const decoded = typeof payload === "string" ? JSON.parse(payload) as unknown : payload;
    return LoreOutputSchema.parse(decoded);
  }
}

class MockImageAI implements ImageAI { async generate(): Promise<null> { return null; } }

class CloudflareImageAI implements ImageAI {
  constructor(private accountId: string, private token: string, private legacyModel: string) {}
  async generate(prompt: string, options: ImageGenerationOptions) {
    const model = options.model === "flux-2-fast" ? CLOUDFLARE_FLUX2_MODEL_IDS["flux-2-fast"]
      : options.model === "flux-2-quality" ? CLOUDFLARE_FLUX2_MODEL_IDS["flux-2-quality"]
      : this.legacyModel;
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/run/${model}`;
    const flux2 = options.model !== "flux-1-schnell";
    const body = flux2 ? flux2Form(prompt, options) : JSON.stringify({ prompt, steps: 4 });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, ...(flux2 ? {} : { "Content-Type": "application/json" }) },
      body,
      signal: AbortSignal.timeout(30_000),
    }).then(async (result) => {
      const payload = await result.json().catch(() => null) as { success?: boolean; image?: string; result?: { image?: string }; errors?: Array<{ code?: number; message?: string }> } | null;
      if (!result.ok) {
        const detail = payload?.errors?.map((error) => [error.code, error.message].filter(Boolean).join(":"))
          .filter(Boolean).join(",").replace(/[^a-z0-9:,_ -]/giu, "").slice(0, 120);
        throw Object.assign(new Error(`CLOUDFLARE_IMAGE_${result.status}${detail ? `_${detail}` : ""}`), { status: result.status });
      }
      return payload ?? {};
    });
    const encoded = response.result?.image ?? response.image;
    if (!encoded) throw new Error("EMPTY_CLOUDFLARE_IMAGE");
    const normalized = encoded.includes(",") ? encoded.slice(encoded.indexOf(",") + 1) : encoded;
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return { bytes, contentType: confirmedImageContentType(bytes) };
  }
}

function flux2Form(prompt: string, options: ImageGenerationOptions): FormData {
  const form = new FormData();
  form.append("prompt", prompt);
  const squareSize = options.outputSize ?? 1024;
  form.append("width", options.aspect === "square" ? String(squareSize) : "1344");
  form.append("height", options.aspect === "square" ? String(squareSize) : "768");
  for (const [index, reference] of (options.references ?? []).slice(0, 4).entries()) {
    const buffer = reference.bytes.buffer.slice(reference.bytes.byteOffset, reference.bytes.byteOffset + reference.bytes.byteLength) as ArrayBuffer;
    form.append(`input_image_${index}`, new Blob([buffer], { type: reference.contentType }), `panel-${index + 1}.image`);
  }
  return form;
}

function providers() {
  const config = runtimeEnv();
  const client = config.OPENAI_API_KEY ? new OpenAI({ apiKey: config.OPENAI_API_KEY }) : null;
  const imageKey = config.OPENAI_IMAGE_API_KEY;
  const openaiImages = imageKey ? new OpenAILowImageAI(new OpenAI({ apiKey: imageKey, maxRetries: 0, fetch: (...args) => globalThis.fetch(...args) })) : null;
  const cloudflare = config.CLOUDFLARE_ACCOUNT_ID && config.CLOUDFLARE_AI_API_TOKEN
    ? { accountId: config.CLOUDFLARE_ACCOUNT_ID, token: config.CLOUDFLARE_AI_API_TOKEN } : null;
  const effort = (config.OPENAI_TEXT_REASONING_EFFORT ?? "low") as "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  const image = cloudflare
    ? new CloudflareImageAI(cloudflare.accountId, cloudflare.token, config.CLOUDFLARE_IMAGE_MODEL ?? "@cf/black-forest-labs/flux-1-schnell")
    : new MockImageAI();
  return {
    lore: client ? new RealLoreAI(client, config.OPENAI_TEXT_MODEL ?? "gpt-5.6-terra", effort) as LoreAI
      : cloudflare ? new CloudflareLoreAI(cloudflare.accountId, cloudflare.token, config.CLOUDFLARE_TEXT_MODEL ?? "@cf/meta/llama-3.1-8b-instruct-fast") as LoreAI
        : new MockLoreAI() as LoreAI,
    image: {
      async generate(prompt: string, options: ImageGenerationOptions) {
        if (options.model === "openai-low") {
          if (!openaiImages) throw new OpenAIImageGuardError("OPENAI_IMAGE_NOT_CONFIGURED", "OpenAI image generation is not configured for this game. Choose another generator or continue with the concept card.");
          const access = openAIImageAccess(config);
          if (!access.available) throw new OpenAIImageGuardError(access.code ?? "ALLOWANCE_STOP", access.message ?? undefined);
          if (prompt.length > OPENAI_IMAGE_MAX_PROMPT_CHARS) throw new OpenAIImageGuardError("OPENAI_IMAGE_PROMPT_TOO_LONG", "This image prompt is too long for OpenAI Images. Choose another generator or continue with the concept card.");
          const reservation = options.openAIReservation;
          if (!consumeOpenAIImageReservation(reservation, { creditWindowId: config.OPENAI_IMAGES_CREDIT_WINDOW?.trim() ?? "", jobId: options.openAIJobId ?? "", roomId: options.openAIRoomId ?? "" })) throw new OpenAIImageGuardError("ALLOWANCE_STOP");
          return openaiImages.generate(prompt, options);
        }
        return image.generate(prompt, options);
      },
    } as ImageAI,
    live: Boolean(client || cloudflare || openaiImages),
  };
}

let cachedProviders: ReturnType<typeof providers> | null = null;
export function getAIProviders() { cachedProviders ??= providers(); return cachedProviders; }

async function withOneRetry<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : 0;
    const transient = status === 429 || status >= 500 || status === 0;
    if (!transient) throw error;
    await new Promise((resolve) => setTimeout(resolve, 180 + Math.floor(Math.random() * 220)));
    return operation();
  }
}
