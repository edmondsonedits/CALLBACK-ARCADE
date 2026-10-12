# Coordinator review: Ballistix 0.12.1 candidate

Implementation reviewed at 3763723858ae2cc3b427f1a6dada71189852a8ac against main 785a15000abe11970c7b92c5f3cab197061fcedf. Final source SHA-256: 47b128059172554af2aee0a51b7ad6b55982087bf5597d9a1f9076501cdfe80b. Finalization changes only the runtime version string, matching smoke assertion, manifest/provenance, STATUS/docs and generated catalog/index/seed; gameplay code is unchanged from reviewed implementation.

Decision: implementation code/unit/build review passed; supported graphical verification and exact-head CI remain BLOCKED, so this is not a merge-readiness claim.

The independent reviewer reproduced 47 focused tests, 102 root tests, typecheck, catalog check, dry-run build and Pages build on the implementation head. Public APIs, camera/CAM controls, radial mobile design, 2–10 contestants, numeric gameplay tuning, bot decisions, first-to-three rules and Apache-2.0 notice remain preserved. License SHA-256 c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4 is unchanged. No new external assets, dependencies or phone transport; multiplayer remains not-integrated.

## Browser evidence correction

Earlier owner/reviewer browser passes and captures used headless Chromium with sandbox disabled (`--no-sandbox`). They are historical observations, not evidence meeting the no-security-bypass requirement. Reviewer initially accepted the implementation for local integration before recognizing this launch limitation; supported graphical acceptance was subsequently withdrawn and the parent notified. No further disabled-sandbox execution is authorized. No reviewer TLS override was used.

A retained-sandbox Chromium launch aborts because the container's SUID helper is misconfigured. The helper was not changed and no bypass attempted after this finding. Therefore ordinary supported browser/input/focus/visual/performance acceptance on final bytes is blocked. Historical observations included 12 count/viewport cases, 120 restart cycles, controlled result/rematch fixtures and same-environment ten-seat frame timing; none is a physical-phone, real-GPU, audio-by-ear or supported-browser claim. Native tab switching also did not emit focus/visibility events in headless Chromium; only explicit synthetic blur cleanup was confirmed.

GitHub `gh pr view 16 --json ...statusCheckRollup` returned Forbidden from GraphQL. No alternate access path was used to bypass that denial. Exact-head CI must be verified through an authorized status result before merge.

## Final verification

See coordinator-final-checks.json for command exits on final candidate files. Required commands: npm test; npm run typecheck; npm run catalog:check; npm run build (dry run); npm run pages:build; focused smoke/mobile/behavior tests. Runtime version and manifest are 0.12.1; generated output was produced by npm run catalog:generate, never manually edited. No other game's metadata is changed.

The committed implementation's raw failing-test logs contain trailing whitespace; this non-functional evidence formatting issue is retained rather than silently altering raw logs. `git diff --check` on the metadata delta passes; do not claim the full implementation diff is whitespace-clean.

Source/reference constraints: Sumo 1.3 materialization remains blocked, no comparison claimed; repository Sumo untouched. All proposed publication still requires exact final-head CI and a permitted graphical verification path. No merge/deployment performed by review.
