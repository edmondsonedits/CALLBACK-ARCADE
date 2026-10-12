# Focused bot-controller review — evidence, not acceptance

The product candidate remains **e1141247bc44bc0d2188b6547624f94f5add8d60** on
`quality/royal-roller-ruckus`, clean and unchanged. This follow-up lives on a
separate `review/royal-roller-ruckus-bot-evidence` branch and changes no product
source, existing tests, tuning, rules, manifests or generated catalog files. New scripts
only execute source snapshots and counterfactual copies in a test harness.

The bot-controller changes remain **unaccepted pending independent review**.
The earlier single-seed normal-difficulty completion checks did not establish
cross-difficulty balance. This study expands that evidence without changing the
candidate or loosening any checkpoint/finish test.

## Study design

Four matched variants, each at 2, 4 and 10 contestants, easy/normal/hard, seeds
123/456/789: **27 races / 144 contestants per variant**, 108 matched study runs.
An additional nine seed-123 `no-path-retarget` runs isolate path policy. Three
candidate runs were replayed to inspect broad gate-plane observations. Including
those replays, 120 simulations were executed.

- `baseline`: untouched main `785a15000abe11970c7b92c5f3cab197061fcedf`, including
  its old checkpoint and collision code. This is the requested before state,
  **not** an isolated attribution of every difference to bot tuning.
- `candidate`: exact preserved `e114124` source.
- `defects-only`: candidate with the optional adaptive/gate-directed look-ahead
  and .50 corner-speed penalty removed. It retains corrected steering damping,
  height-aware perception, and all candidate checkpoint/collision/input/camera
  code. The label names the analysis subset; it does not imply reviewer approval.
- `no-corner-brake`: candidate with only the corner penalty restored to .31.
- Supplemental `no-path-retarget`: candidate with the old look-ahead restored,
  but the .50 speed penalty retained; seed 123 only, all nine configurations.

All runs use Three.js **0.180.0**, the real course spline, real fixed-step physics
at **120 Hz**, and the real bot controller for every seat. Every seat participates
until finish, with a common **360 simulated-second** censoring horizon. No racer
position, velocity, checkpoint or lap is injected during a race. No extra
recovery, checkpoint bypass or progress assistance is granted. Normal game
respawn remains operative and is counted. Source SHA-256 is recorded per run.

Initial personality, decision delay and lane timer are asserted identical for
matched seeds across all four variants. Later random streams can diverge as
controllers make different decisions; this is common initial random state, not
an assertion of identical subsequent random choices.

Rendering, DOM, audio and visual effects are substituted as in the existing
actual-course harness. These are automated simulation results, not human racing,
physical-device tests or render-performance measurements. Lap one includes the
launch from the normal starting grid. Baseline and candidate have different
finish/checkpoint validation, which is why the candidate-only exclusion variants
are included for attribution.

## Definitions and censoring

`results-table.md` contains every seat-count/difficulty cell. `summary.json`
contains per-cell and overall counts, full lap-time distribution (n/min/p10/
median/p90/max/mean), finish-time distributions, and difficulty ordering. Raw
per-racer records remain in the four `matrix-*.jsonl` files.

- **Finished:** three laps credited by that variant's shipping checkpoint code.
  All unfinished racers are retained; there is no silent survivor filtering.
- **Lap-time distribution:** only completed laps, with sample count and the
  number of unfinished racers/remaining laps reported separately. Missing laps
  are not assigned a fictitious 360-second lap time.
- **Restricted finish mean:** finish time when observed; 360 seconds otherwise.
  This describes this horizon and is not an estimated eventual completion time.
- **Falls:** actual `startFall` transitions; **landings/respawns** count the native
  respective functions. No-fall counts do not prove that a bot took every gate.
- **Low-speed stall:** grounded speed below .25 units/s for at least two
  continuous seconds. Raw `stallSeconds` counts dwell beyond the two-second
  threshold; `maxStallSeconds` includes the whole observed low-speed interval.
- **Progress stall:** at least 30 seconds without a checkpoint award, including
  continuous driving that misses a required gate. This is distinct from being
  physically trapped or motionless.
- **Missed finish pass:** a forward return past the finish area after at least
  half a circuit of signed route-index travel, with no lap awarded since the
  previous pass. Landing/respawn jumps are excluded. A small post-line allowance
  avoids counting a checkpoint award later within the same sample. This is a
  route/progress diagnostic, not permission to award a missing lap.
- **Gate-plane non-award:** a deliberately broader observer sees a same-height,
  in-width forward plane crossing within 16 route samples but the game awards
  nothing. Raw records call this `gateMisses`; it is **not automatically a logic
  failure**, since the candidate intentionally requires the correct route within
  eight samples. The three candidate observations were replayed: all occurred on
  incoming sample 634, eleven route samples from finish sample 5. The plane also
  intersects that nearby approach; the route guard correctly rejects credit
  there. See `gate-observations.jsonl`.
- **Non-forward credit:** a checkpoint award with nonpositive tangent velocity.
  This diagnostic is reported separately from navigation misses.

## Results and unresolved balance findings

| Matched variant | Finished contestants | Completed laps | Edge falls | Missed finish passes | Racers with ≥30 s checkpoint gap | Lap median / p90 | Finish median / mean |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Baseline | 0/144 | 0/432 | 13,872 | 100 | 144 | Not estimable | Not estimable; all censored at 360 s |
| Preserved candidate | 144/144 | 432/432 | 0 | 81 | 64 | 48.39 / 92.62 s | 157.03 / 169.80 s |
| Both optional policies excluded | 0/144 | 1/432 | 2,850 | 1,386 | 144 | One completed lap: 78.66 s | Not estimable; all censored at 360 s |
| Only extra corner braking excluded | 144/144 | 432/432 | 0 | 44 | 35 | 39.36 / 46.62 s | 126.04 / 130.44 s |

All measured states remained finite. No variant recorded a two-second low-speed
stall episode; the progress gaps are navigation/recovery failures rather than
proof of a motionless pack trap. No non-forward checkpoint credits occurred in
these bot runs; separate existing adversarial tests still demonstrate the
baseline checkpoint vulnerability.

The preserved candidate completes the three-lap rule but is **not navigation-
reliable on every circuit**: 64/144 racers experienced a ≥30-second checkpoint
gap, and its longest completed lap was 178.33 seconds. An extra circuit after
missing a gate is not treated as a successful clean lap or hidden credit.

The corner-penalty increase `.31 → .50` is **not necessary for completion in the
matched sample**. Restoring `.31` alone finishes all configurations, with no
falls, fewer missed finish passes and a smaller lap-time tail. Its overall lap
median is 18.65% shorter and finish mean 23.18% shorter than the preserved
candidate. This is a material balance difference, not a negligible polish
change. The ablation still has 44 missed passes and 35 racers with long checkpoint
gaps, so it is not an automatic acceptance recommendation or a claim that all
navigation problems disappear.

Removing path retargeting alone while retaining `.50` was additionally tested at
seed 123 in all nine configurations: **0/48 contestants finished**, with one
completed lap, 44 falls and 377 missed finish passes. Merely slowing the old
paths does not make them reliably pass the required gates. This justifies a
navigation remedy, not the exact current policy or an exemption from review.

### Relative difficulty ordering

Completed-lap medians in the candidate and brake-only exclusion are consistently
**hard < normal < easy** at 2, 4 and 10 seats. Whole-race ordering is less reliable
because a missed gate can add another circuit:

| Seats | Candidate finish medians: easy / normal / hard | Fastest → slowest |
| --- | --- | --- |
| 2 | 153.19 / 140.90 / 133.34 s | hard → normal → easy |
| 4 | 154.93 / 186.18 / 134.61 s | hard → easy → normal |
| 10 | 160.48 / 188.90 / 174.81 s | easy → hard → normal |

Candidate mean finish times also invert easy/normal at 2 and 4 seats. The
brake-only exclusion restores hard → normal → easy **median** finish ordering
at every count, but small easy/normal **mean** inversions remain at 2 and 10
seats. The summary retains both statistics rather than selecting the favorable
one. With only three seeds, neither variant establishes a universal difficulty
ordering. No ordering can be estimated from the fully censored baseline or
combined exclusion races.

The parent should review the bot block separately. The candidate stays frozen;
this follow-up neither applies the apparently favorable ablation nor tunes an
alternative. Existing full-course acceptance tests would fail on the combined
exclusion fallback, so it must not be described as ready merely because its
non-bot regression suite passes.

## Correctness versus optional balance

**Independently demonstrated bugs:**

1. The old grip expression supplies `(2.4 + 2.2*cornerFactor)*dt` to `damp`, which
   already applies `dt`. Effective grip therefore changes with simulation rate.
   For the isolated straight-line damping term over one second, the old formula
   converges 3.92% at 60 Hz versus 1.98% at 120 Hz; the corrected expression
   converges 90.93% at both. Removing the duplicate time factor corrects that
   dimensional error, but produces a **large strength change**. This establishes
   the bug, not that 2.4–4.6/s is the ideal competitive balance. That strength still
   warrants independent review; no further calibration was performed here.
2. XZ-only neighbor perception lets cages on separate crossover decks alter bot
   avoidance/passing/defense. The candidate filters vertical distances greater
   than two cage radii, consistent with physical contact range. Other avoidance,
   personality, mistake, reaction and difficulty tables remain unchanged.

**Navigation remedy with provisional policy choices:**

The old long look-ahead cuts the hairpin/finish approach. Correct checkpoint
validation must not give those paths a lap. The exclusion variants test whether
steering-unit/height fixes or slowing alone suffice; neither restores reliable
completion in this study. Some path correction is therefore needed if bots are
to complete the strict course. That does **not** establish the selected `.8`
curvature factor, gate+1 aim point, or all resulting race behavior as accepted.
Those are reviewable controller policy choices, separated in the patches below.

**Optional balance change:**

Changing the corner-speed penalty from `.31` to `.50` was additional caution,
not the dimensional bug fix. The `no-corner-brake` matrix isolates its necessity
across the same counts, difficulties and seeds. It can be excluded independently
without reverting checkpoint/collision fixes or the adaptive paths. Do not
conflate this optional slowdown with the approved human braking guard: the human
acceleration-within-10% limit did not bound bot steering strength or lap times.

Passing, defense, avoidance, personality, random mistakes, reaction delays,
three laps, physical recovery and the same checkpoint functions are retained in
all candidate-derived variants. Retaining these rules is not a claim that their
resulting behavior or difficulty balance stayed unchanged.

## Review boundaries — no patch applied to the candidate

All patches below apply **from preserved candidate e114124** and only edit
`updateAI`. They have passed `git apply --check` against that source.

- `exclude-optional-bot-balance.patch`: restore old look-ahead and .31 corner
  penalty, retaining damping/height corrections and every non-bot change.
- `exclude-corner-brake-only.patch`: restore only `.31`; retain path remedies.
- `exclude-path-retarget-only.patch`: restore only the old look-ahead; retain .50.

The first patch is the requested combined exclusion boundary. The latter two
are alternatives for reviewing each policy separately; do not blindly apply the
combined patch on top of an individual exclusion. Reversing the combined patch
reintroduces exactly those optional changes to its excluded-source result.

The combined patch was actually applied to a temporary copy outside all product
worktrees. Its result matches SHA-256
`c0fdac8d2000bd173abb69e12f537fa2bb7e5917c152514132f8ba8ef1081628`.
All 20 behavioral regressions and archive integrity pass on that copy, confirming
checkpoint/collision/input fixes remain. **That does not make it a shippable
fallback:** its actual-course completion outcomes must also be reviewed. No
existing test was changed, removed, skipped or weakened. The unchanged
`real-course.mjs` was also run on that temporary copy: it fails its first
two-seat three-lap completion assertion at the 360-second horizon, exit 1.
The failure is retained in `exclusion-course-failure.txt`; it was not waived.

## Reproduction

Install Three.js 0.180.0 outside the checkout, then run from the repository root:

```sh
THREE_MODULE=/absolute/path/three/build/three.module.js node games/royal-roller-ruckus/tests/bot-review.mjs
```

Default output contains the baseline/candidate/defects-only matrices. To capture
one variant into its separate JSONL file, set `BOT_VARIANTS=baseline`, `candidate`,
`defects-only`, or `no-corner-brake`. Defaults are all three counts/difficulties,
seeds `123,456,789`, 360 seconds. The supplemental run uses
`BOT_VARIANTS=no-path-retarget BOT_SEEDS=123`. `BOT_TRACE=1` includes gate-plane
observation details; these are recorded from existing state, not injected.

After all four matrix files are saved in this directory:

```sh
node games/royal-roller-ruckus/tests/summarize-bot-review.mjs
npm test
```

The summarizer rejects incomplete matrices, verifies matching initial random
state and finite values, and regenerates the numeric summary and comparison
table. Results may expose poor behavior; the measurement runner deliberately
does not stop after the first unfinished race or omit it from subsequent cells.

No new product tuning, publication, merge or deployment is authorized or performed.
