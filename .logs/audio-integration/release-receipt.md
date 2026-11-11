# Approved audio release verification

- Base: v95 source 526e508236e8eacfdbead02a1e508a9db0342f42; preserved v96 source 090b61a through a non-destructive merge.
- Selection: 27 downloaded/installed, 16 skipped, no new credits or paid generation. Twelve music, fourteen effects, one ambience; five legacy tracks retained.
- Asset verification: all 27 SHA256 hashes and FFmpeg decoding passed; installed audio is 22,659,414 bytes. All 27 exact task download paths are absent after hash-guarded cleanup. No other Downloads files were selected for cleanup.
- Final full unit suite: 1,054 passed, nine skipped, zero failed. Seven focused engine/native adapter assertions cover fades, burst capacity, event deduplication and animation cues.
- Final isolated browser audio suite: two passed in 35.6 seconds. Covers low output level, rapid music context transitions without overlap, silent phones, saved mute/reload/unmute and native narration duck/release.
- Full lint, TypeScript, production build and nine production-render checks passed. Packaging performs a fresh build from the final source before saving.
- Independent review: fixed five-effect cap during fade and stale narration callback generation. Focused re-review found no material remaining issue.
- Broad browser attempt: six passed, three unrelated Arcade scenarios failed, 103 not run after configured stop limit; one teardown error. Audio navigation and D1 setup failures in earlier runs were investigated; final isolated audio suite passed. Full application browser health is not claimed.
- Live publication and source/build hashes are recorded in the sibling release directory after deployment. Previous Site version remains available for rollback. User listening on actual TV/phones is not established by automation.
