/** Only fixed classifications leave the provider boundary; never expose raw errors. */
export function classifyFaceProviderError(error: unknown): string {
  const e = error && typeof error === "object" ? error as { status?: number; code?: string; param?: string; name?: string } : {};
  if (e.status === 401) return "IMAGE_AUTH_FAILED";
  if (e.status === 403 || e.code === "model_not_found") return "IMAGE_ACCESS_DENIED";
  if (e.code === "moderation_blocked" || e.code === "content_policy_violation") return "IMAGE_CONTENT_REJECTED";
  if (e.status === 429) return "IMAGE_RATE_LIMITED";
  if (e.name === "APIConnectionTimeoutError") return "IMAGE_TIMEOUT";
  if (e.status === 400 && e.param === "background") return "IMAGE_BACKGROUND_UNSUPPORTED";
  if (e.status === 400) return "IMAGE_REQUEST_REJECTED";
  return "IMAGE_PROVIDER_FAILED";
}
