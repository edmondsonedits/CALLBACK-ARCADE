# Local Four Courts resources

- `star_04.png`: Kenney Particle Pack, CC0. Drawn on every impact particle when loaded, circular fallback otherwise.
- `impactMetal_light_000.ogg`: Kenney Impact Sounds, CC0. A quiet metal accent on completed local perfect notes. Loaded/decoded after sound-enabling gesture; failed fetch/decode leaves synthesized cues active.
- `particles-License.txt`, `impacts-License.txt`: complete upstream notices. `provenance.json` records official page/archive URLs, archive hashes and exact selected file hashes.
- `alea-upstream.js`: byte-identical David Bau seedrandom Alea library at the pinned commit in `alea-provenance.json`, including full MIT grant. Source inline section adapts only its module wrapper to return a local factory. No global random override. The title performance uses its independent seeded stream; the classic game keeps its existing generator and seeds.

No runtime CDN or package install is required. Serve the source folder over HTTP to permit optional audio fetch; plain file opening retains synthesized audio if fetch is blocked.
