# OpenAI low images implementation plan

**Goal:** Add a host-selectable ChatGPT Images · Low option to the existing image games.

**Architecture:** Preserve the authoritative room setting, leased image jobs, R2 confirmation, and current FLUX defaults. Route the new `openai-low` choice to GPT Image 2 with explicit low quality and no automatic paid retries. Use an image-only secret so this addition does not enable paid lore generation.

**Scope:** Existing King Prompter, Royal Rumours, Royal Frame-Up, Comic, and legacy image rounds; no new game or scoring changes.

- [x] Test selection through contracts, persisted state, host actions, snapshots, and job payloads.
- [x] Test actual OpenAI SDK requests with a substituted HTTP transport: low quality, square/landscape size, reference-image editing, invalid bytes, and no automatic retry.
- [x] Add provider dispatch and a sufficiently long OpenAI job lease. Preserve FLUX fallback chains; OpenAI makes one paid attempt, then uses a concept card rather than switching provider or quality.
- [x] Add the choice to both host selectors; expose only configuration availability and disable it until a server-side key exists. Keep solo billing copy accurate.
- [x] Run unit, type, build, relevant browser checks, and review. Record missing real-key verification explicitly.
- [ ] Configure the image-only secret through OpenAI Developers when connected; publish the verified source without changing Site access.

**Review focus:** No paid OpenAI work from existing FLUX selections, no quality escalation, no lost comic references, no lease expiry during the API request, no API key in client code.
