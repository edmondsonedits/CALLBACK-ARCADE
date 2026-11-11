# Face-photo implementation verification

2026-11-01. Local feature; no publishing or paid API request.

- node --import tsx --test --test-concurrency=1 tests/*.test.ts: 1207 pass / 9 skip / 0 fail.
- npm run typecheck: pass.
- npm run lint: 0 errors / 6 image-element warnings.
- npm run build: pass.
- node --test tests/rendered-html.test.mjs: 10 pass.
- Chromium: 4 photo flows + copied-ID integration + existing phone style flow pass.
- WebKit: 4 photo flows pass.
- Worker integration uses real SDK multipart encoding and Workers D1/R2/decompression; provider is simulated.
- Screenshot photo-face-preview-320.png uses a synthetic oval fixture to check placement/transparency/UI, not an AI likeness sample.
- Dedicated prompt requests actual transparent background. Server rejects an opaque result and does not replace the current character.
- Generated cartoon retention is disclosed. Original normalized uploads are not persisted.
