# Optional photo face implementation plan

Goal: Add an optional photo-to-cartoon head to the existing saved character, preserving body customization, history, and normal character creation.

User direction: reuse existing API setup, distinct instructions, low image quality, actual transparent output. Implementation choices are delegated to us.

Approach: dedicated gpt-image-2 edit request with quality low, background transparent and PNG format. Reject opaque/empty output based on decoded alpha; no solid-color workaround. Original uploads are transient. Only generated heads are stored behind random asset IDs and may be shown with shared characters.

- [x] Backend: same-origin profile authentication, bounded upload, durable idempotency/rate limits, existing image allowance reservation and circuit, dedicated prompt, PNG verification, R2 output and safe asset retrieval. Test failure cases and exact provider parameters.
- [x] Character: optional validated photoFaceId, SVG head replacement within animated head group, preserve body and saved history; reject arbitrary URLs. Test schema/render/history.
- [x] UI: optional upload, local preview/normalization, explicit generate action explaining photo transmission, pending/error/retry, returned preview and Use this face, remove photo option. No automatic paid retries.
- [x] Verification: targeted units and browser flow at narrow phone sizes, typecheck/build, review changed files, document verified limits in STATUS.md.

Review focus: duplicate paid calls; forged assets; opaque PNG with alpha channel; stale results overwriting edits; face saved and propagated through shared avatars without exposing original uploads. No production publication in this implementation pass until reviewed.


Verification notes: The image provider is mocked in automated tests. A bundled Cloudflare Worker exercises the actual SDK multipart edit call, PNG decompression, allowance reservation, D1 idempotency and R2 retrieval. Chromium and WebKit cover upload/preview/save/restore/errors. Original photos are never stored by the game; generated cartoons persist for saved characters/game history, and this is disclosed before generation. Switching to the drawn face does not delete prior generated cartoons.

Official API contract checked 2026-11-01: https://developers.openai.com/api/reference/resources/images/methods/edit (gpt-image-2 supports transparent output in preview, with PNG or WebP). Low quality is explicit; there is no automatic higher-quality or alternate-provider fallback.
