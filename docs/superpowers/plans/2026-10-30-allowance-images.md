# CALLBACK allowance image safeguard implementation
> For agentic workers: implement with targeted red-green tests and preserve concurrent work.
Goal: connect the image-only key and ship enforceable abuse and stop controls.
Spec: docs/superpowers/specs/2026-10-30-allowance-images-design.md

- [x] Add failing tests for blocked/expired configuration, duplicate/concurrent reservations, global/day/room caps, and billing circuit.
- [x] Add minimal D1-backed guard and consistent schema/migration/bootstrap definitions; reserve before OpenAI calls.
- [x] Keep low quality/n1/no-retry and isolate the hosted image-only key from text.
- [x] Show setup/stop errors in setup and running-game fallbacks without provider details or secrets.
- [x] Verify current billing and key restrictions, install runtime secret safely, and set a stop before key/grant expiry.
- [x] Run focused tests, full unit suite, lint, typecheck, production build and relevant browser checks.
- [x] Review changes, publish exact source with rollback to v89, and verify the live guard plus a bounded real image only if funding checks pass.


Verification detail and broader browser limitations: STATUS.md and .logs/callback-openai-allowance-2026-10-30.md.
