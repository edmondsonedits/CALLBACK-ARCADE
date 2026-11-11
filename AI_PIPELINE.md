# CALLBACK AI Pipeline

## Allowance safeguards — 2026-10-30

OpenAI images require an image-only secret, explicit server activation, a named verified credit window, and a finite UTC stop date. Every outbound OpenAI generation or edit first reserves its authoritative job ID atomically in D1. Reservations survive room deletion and count failed requests/timeouts. A reservation can be consumed only once. Global window, UTC-day, and room caps prevent concurrent callers from exceeding the configured request count; clients cannot set these limits.

Defaults and hard ceilings are 1,000 requests per credit window, 300 per UTC day, and 100 per room. Explicit invalid/zero limits stop requests. Provider credit/quota/spend errors latch the entire window off until the owner re-verifies funding and deliberately configures a new window. There are no automatic paid retries, refunds of uncertain attempts, quality upgrades, or provider substitutions. All OpenAI requests stay at the existing fixed low quality and one image. Sketch & Sorcery can select OpenAI too; its actual uploaded PNG is sent to image editing, and a blocked/failed transform preserves the original sketch.

This is an enforceable request budget, not a live account-balance detector. OpenAI's ordinary project API does not expose the remaining subscription grant or an allowance-only switch. Free credits can be followed by purchased credits if the organization has them. Before activation/renewal, the owner must verify the linked grant, expiry, no paid credit/payment/auto-recharge path, and enough margin for all organizational usage. Keep paid billing disabled; do not add it as a setup workaround. Stop before both grant and key expiry. No automatic allowance renewal is inferred.

Configure only through hosted runtime settings, with the key marked secret. `OPENAI_IMAGE_API_KEY` does not enable OpenAI text. `OPENAI_IMAGES_ENABLED=false` is the immediate kill switch. Missing/unverified/expired configuration and unavailable guard storage fail closed. Setup disables unavailable choices; active rooms show an allowance-stop notice and continue with concept cards or original sketches. If both independent durable latch writes fail, the current worker still stops in memory, but other workers may not see that stop; keeping paid billing disabled remains the external backstop.


## ChatGPT Images · Low — 2026-10-29

The host can select `openai-low` in setup or the room lobby. This routes image jobs to `gpt-image-2` with explicit `quality: "low"`, one output, 1024×1024 square or 1536×1024 landscape, and WebP output. Comic references use the Images edit endpoint. The model and quality are fixed for this choice; legacy image-model/quality environment defaults cannot upgrade its cost.

Configure `OPENAI_IMAGE_API_KEY` as a hosted secret through OpenAI Developers. This image-only key does not enable OpenAI lore/text generation. A general `OPENAI_API_KEY` cannot power this image choice; the dedicated image secret is required. The client receives only a configuration boolean; the option is disabled without a key and the server rejects unavailable selections.

OpenAI image calls have a 120-second timeout, a 150-second job lease, and no SDK/application retry. One failed OpenAI attempt becomes a concept card; it never silently switches quality or provider. Its reference images remain usable for subsequent OpenAI comic panels. Existing FLUX defaults and their three-model fallback chains remain unchanged, and FLUX selections never implicitly call OpenAI when Cloudflare credentials are missing. Job leasing also compares the expected attempt count so stale callers cannot reacquire a requeued attempt.

No real OpenAI key was available during implementation. Request shape, byte validation, routing/isolation, references, and retry behavior are tested with the real SDK and substituted HTTP responses; hosted image generation still requires key setup and a real-image acceptance check.

## Existing pipelines

AI work is event-driven and non-authoritative. A creative winner creates typed memory nodes and queues analysis/image work. Later social rounds hide latency. Jobs use D1 status, prompt hashes, leases, attempt counts, and idempotent room mutations.

Current providers in `server/ai.ts` prefer OpenAI Responses with structured output when `OPENAI_API_KEY` is present. Otherwise, the already configured Cloudflare Workers AI account runs Llama 3.1 8B Instruct Fast in JSON mode for lore analysis and Callback/Remix candidate writing. If neither text provider is available—or either rejects, times out, exceeds quota, or returns malformed output—the deterministic writer takes over. Model names and quality are hosted configuration, documented without secrets in `.env.example`.

The main pipelines are:

- Seed winner → Anchor analysis → Anchor image → Make It Real reveal.
- Winning memories → graph-aware analysis → callback candidates → server quality gates → Callback selection.
- Anchor + Voice + World + Consequence → 2–4-element Remix candidates → fixed finale contract → commemorative image.

AI may summarize meaning, assign semantic tags, assess creative quality, connect compatible memory nodes, propose callback text, rank creative candidates, and illustrate. It may not change scores, choose winners, alter votes, infer hidden identities for disclosure, change eligibility, set deadlines, or transition phases.

All outputs must be schema-validated and tied to winning memory IDs. Candidate gates reject duplicate, closed-ended, repetitive, low-coherence, low-answerability, low-surprise, or semantically disconnected outputs. Durable and current-room feedback is reduced to the room's leading comedy tastes and supplied as a soft writing preference; it cannot override coherence, game rules, or player-created lore. Important text belongs in HTML/CSS, not generated images.

Failure behavior: retry transient provider errors once, then use deterministic fallbacks; mark jobs terminal so they cannot deadlock a round. Do not log prompts containing secrets or raw provider credentials. A future durable workflow must preserve the same idempotency keys and authority boundaries.

Image generation may use Cloudflare Workers AI independently of OpenAI when `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_API_TOKEN` are configured. The same credentials can run the Cloudflare text provider, with separate configurable text and image model names. The selectable models are FLUX.1 Schnell, FLUX.2 Klein 4B (Fast), and FLUX.2 Klein 9B (Quality). Requests remain server-side and pass through leased jobs, authenticated media, R2 storage, byte-format validation, and a storage confirmation before any image becomes `READY`. CALLBACK performs no application-level blocked-word or moderation-provider check on player submissions or assembled image prompts. Structural validation, game-specific length limits, authentication, rate limits, and Cloudflare's unavoidable model-side policy enforcement remain.

King Prompter, Royal Rumours, The Royal Frame-Up, and Comic rounds never reveal unfinished image entries. A failed job is re-queued one model at a time, preserving the same prompt: Quality → Fast → Schnell; Fast → Schnell → Quality; Schnell → Fast → Quality. The room receives a visible retry notice naming the failed and next models. Only after all three distinct models fail does the entry become a voteable concept card. The server remains in the image-confirmation intermission until every entry is either confirmed `READY` or has exhausted that fallback chain. Royal Rumours applies this gate independently to the first rumour paintings and the second interpretation paintings.

`KING_MYSTERY_IMAGE` jobs are queued in parallel after every secret incident report locks. The report text is server-only input to generation and must not be copied into public concept metadata. The game waits until all evidence images are confirmed or terminal before it opens the first case, then exposes only the current image until its reveal.

Player-authored image jobs use an explicit prompt hierarchy. The player's submitted prompt appears once, first, and is the highest creative priority; the assembler may clarify composition but may not replace its subject, action, setting, relationships, mood, or joke. Generic direction supplies readability, expressive posing, coherent depth, lighting, and a default polished illustration style only when the player did not specify one. Technical output requirements remain mandatory. Comic jobs add a separate narrative contract for Setup, Escalation, or Payoff/Punchline plus the shared theme, prior winning-panel text, and up to four actual prior winning images. Panel two receives panel one; panel three receives panels one and two. FLUX.2 receives these as indexed multipart references, and the prompt names their panel order. Because FLUX.1 Schnell does not support this workflow, a Comic room that selected FLUX.1 uses FLUX.2 Fast. Private 480×480 copies satisfy FLUX.2's sub-512×512 reference limit, while the game-facing asset is independently stored and transformed to the normal presentation size when Cloudflare Images is configured. Prior panels guide continuity, but the current player prompt wins any creative conflict.
