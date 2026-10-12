# Space Bash checks

Run from the repository root:

```sh
node games/space-bash/tests/source-smoke.mjs
node --test tests/space-bash-quality.test.mjs
npm test
```

`source-smoke.mjs` pins the immutable original upload hash and checks active version, 2–10 slots, public API and standalone/no-network declarations. Active source may differ from the preserved original.

The quality wrapper runs the game's real inline simulation and input handlers through a deterministic DOM/Canvas-boundary test harness. Behavioral checks cover carrying, fuse timing, swept impacts, height separation, input cleanup, touch ownership, CAM codes and landing. Stress checks cover natural first-to-three matches at 2/4/10 contestants, terminal waiting, ten rematches per player count, and ten seeded 10-contestant action runs.

The shared root lifecycle regression remains unchanged. These tests are not multiplayer verification or physical-device playtesting. See [QUALITY.md](QUALITY.md) for measured conditions, before/after evidence and browser/reference blockers.
