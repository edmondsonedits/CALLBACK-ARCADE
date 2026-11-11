# CALLBACK allowance-only image safeguards
Date: 2026-10-30

Intent: Enable the existing OpenAI low image integration using an image-only hosted secret while preserving the user's no-extra-payment requirement.
Verified account evidence: linked subscription grant USD39 available, expires 2026-11-10; no paid billing plan/payment method. Normal project API keys cannot inspect live free-credit balance or distinguish paid-credit fallback. Never claim estimates are a no-charge guarantee.

Chosen implementation: server-controlled fail-closed activation and stop date (2026-11-05T23:59:59Z); atomic D1 attempt reservations keyed by job; permanent circuit latch on provider billing/quota errors; pinned low/n1 provider and no retries. Defaults: 1000 total per configured credit window, 300 per UTC day, 100 per room. Each failed/timeout call still counts. Missing/invalid/expired activation blocks before any call. Keep all existing authentication, leases, phases, scoring, and fallbacks. Image-only key must never enable text. Never silently switch paid providers after a credit guard failure.

Public game cannot determine changing Platform billing settings. Existing no-payment setup is the provider backstop; reverify before any future renewal. Stop early, show clear errors, and document limitations. Current free/Cloudflare fallback and sketch source fallbacks remain honest.

Implementation ownership: guard worker owns server guard, database/Drizzle/migration, route enforcement and focused tests. Parent owns UI capability/error copy, hosted settings, key permissions, provider spending controls, deployment and verification.

