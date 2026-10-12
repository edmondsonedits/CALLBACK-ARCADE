# Task 3 independent review

Reviewed `1c262d7..5de6cb4`, the scoped review diff, task brief, binding design and implementation report. Scope: Roller source/tests/assets and the parent benchmark expectation changes. No implementation edits, commits, push, deployment or delegation.

Exact reviewed `source/index.html` SHA-256: `abfcf0096fa695af021259430a384f5526974f25b120fb7c152b804dd52b393d`.

**Spec verdict: needs work. Code-quality verdict: needs work.** Two P2 findings below should be fixed before acceptance. No P0/P1 issue found. Rendered mobile usability, hardware performance and audible mix remain unverified by this review; the coordinator's pending exact-source browser inspection is still required.

## Findings

### P2 — Skygarden world arrows disagree with the gust direction

- File: `games/royal-roller-ruckus/source/index.html`, `createTrack` (line 443), `updateVisuals` (line 1011), `updateCourseInteraction` (line 955).
- The wind cones receive only a Z rotation, so their tips point along global negative X for positive wind and positive X for negative wind. Actual gust acceleration follows each track sample's normal. The displayed direction therefore changes meaning around the circuit and can point almost directly against the force. This conflicts with the required readable directional warning and the course instruction to read wind arrows. The separate HUD text does not repair the contradictory world cue.
- Reproduction: select Skygarden, inspect a positive-side warning/active cycle near sample 40. The force direction is approximately `(0.98594, 0, 0.16709)` while the cone tip points `(-1, 0, 0)`; their dot product is `-0.98594`. Sample 540 also points against the gust (dot `-0.58828`). These values were reproduced with the shipped real Three curve in the CPU harness.
- Required correction: retain each arrow's track index/normal and orient its tip along that normal multiplied by the announced wind side. Verify both alternating directions at multiple positions around the spline.

### P2 — Concurrent initial steam loads overwrite the cache and strand a live texture

- File: `games/royal-roller-ruckus/source/index.html`, `loadScenery` (line 1148), `disposeRacerVisual` (line 507).
- `steamTexture` is cached only after `await TextureLoader.loadAsync(...)`. If the player leaves and re-enters Foundry before the first steam image completes, multiple calls pass the null check. A stale call can then overwrite the current cache before its generation check returns. Existing sprites retain the other texture, marked `sharedAsset`, so course disposal deliberately skips it even though it is no longer cached. The GLB promise cache correctly deduplicates requests; the steam texture does not.
- Reproduction: delay steam image completion; start Foundry load A, switch away and back to start B, resolve B first, then A. A controlled loader running the shipping `loadScenery` produced two texture requests, cache `A`, and active sprite map `B`. Removing the current environment through shipping `disposeRacerVisual` emitted zero disposal events for B. If B was rendered, its GPU allocation is not released by that transition. This is a bounded-per-overlap leak, not a claim of measured device memory exhaustion.
- Required correction: cache the in-flight texture promise (with a deliberate failure/retry policy) so all generations share one texture, or explicitly dispose discarded uniquely owned textures. Check generation before changing shared cache ownership. Add an out-of-order completion test; the present disposal test replaces `loadScenery` with a no-op and cannot catch this path.

## Evidence and accepted portions

- Independently ran `node --test tests/royal-roller-ruckus-worlds.test.mjs tests/royal-roller-ruckus-quality.test.mjs tests/royal-roller-ruckus-sumo-benchmark.test.mjs`: **57 passed, 0 failed**.
- Inspected the shipped simulation, not only test expectations: ice affects drive/grip/braking; steam has a two-second warning and safe opposite lane; gust force is bounded and edge boosts retain a speed cap. Frostglass and Skygarden have separate route profiles. Bot hazard anticipation is implemented without granting progress.
- Ordered gate sweeps, height/airborne checks, physical bot recross/recovery, classic control points/tuning and public camera APIs remain intact. No diff to the archived original or existing Three engine modules was found. The parent benchmark changes only update version and honest unfinished-result wording.
- Demo uses a separate RNG/clock and all-bot branch, rejects network steering, suppresses effects/audio/progression and resets racers on Start. Native form key guards and name blur normalization are present. Rules stage; Series resets on new starts/API seat-count changes; results retain actual nullable times and award only real finishers. Same-seed replay restores the session snapshot.
- Actual local GLB and steam assets are referenced by rendering code, with matching-version local loader support and complete source/license/hash metadata. Owned course/racer disposal and GLB generation guards are sound apart from the steam concurrency finding above.
- Inspected worker evidence for 24 complete three-lap world races, 28 legacy navigation checks and four camera sweeps. Those are worker results, not additional independent reruns. Source/CPU evidence does not certify rendered warning readability, touch layout, audio mix or device FPS.
