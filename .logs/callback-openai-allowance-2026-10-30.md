# OpenAI allowance safeguards release notes

Base: Sites v89, commit e7a8ef518ca816c633143cca1f31dc08e2de3887.
Site: https://callback-party-game.dans-host.chatgpt.site
Source: isolated H:/ChatGPT/CALLBACK-api-images-2026-10-30.
Key: image-request permission only; user-selected 7-day expiry (2026-11-06). No plaintext key is part of source or logs.
Guard activation: callback-subscription-2026-10-29; stop 2026-11-05T23:59:59Z; caps 1000/window,300/UTCday,100/room.

Validation: unit1006pass/9skip; TypeScript/lint/diffcheck pass; focused allowance browser3pass; no-key room/config API1pass; picture API match and both solo paths pass. Broader browser: Arcade3fail/7pass/93notrun; separate three-phone reload timed out twice. This is not a full-browser-green claim.
Review: initial P1/P2 circuit/key issues resolved; dual durable latch plus immediate local latch. Both durable writes failing can leave other isolates unaware; paid billing must stay disabled.
Provider errors are sanitized; image n=1/qualitylow/gpt-image-2/no SDK or job retry are fixed.

Rollback: remove OPENAI_IMAGE_API_KEY in Sites environment before deploying v89. For current guarded source, set OPENAI_IMAGES_ENABLED=false and redeploy its saved version.
Live proof, saved version, exact commit and archive hash will be recorded in outputs/callback-allowance-release-receipt.json after publishing.
