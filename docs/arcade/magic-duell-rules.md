# Magic Duell

## Match loop

Magic Duell is a head-to-head game for exactly two players in one King Prompter room. Each duelist privately locks three unique spells from six original spells. The host begins the duel once both spellbooks are locked or the 45-second draft timer expires; an unsubmitted draft receives Spark Bolt, Prism Ward, and Stillwater. Spellbooks remain private to their owner for the match.

The duel lasts up to five simultaneous rounds. Each player starts with 12 health and 2 mana. At the start of a round, each gains 1 mana up to a cap of 5. Choose one spell from your spellbook, then draw its glyph on your phone. The server checks the submitted normalized stroke, spell ownership, mana cost, match, player, round, and deadline. Both casts stay hidden until the host reveals them or the round times out.

Attacks deal their listed strength. A guard reduces incoming attack damage by its listed strength. A focus spell restores its listed mana after its cost is paid. Both spells resolve in the same round, so attacks can land simultaneously. A duelist at 0 health loses immediately; otherwise, after round five, higher health wins, then higher remaining mana. Equal health and mana is a draw. A missed cast becomes Rest, which recovers 2 mana and deals no damage. A missed cast never consumes a drafted spell.

## Glyphs

Every spell belongs to one of three glyph families. Bolt is an open zig-zag with at least two horizontal direction reversals and sufficient width and height. Shield is a closed shape with at least two sharp corners. Loop is a closed, smoother trace. A valid stroke contains 5–32 points with normalized coordinates from 0 to 1. The same pure classifier validates the phone input in the D1 engine; client drawing state cannot set results.

## Spells

| Spell | Cast | Cost | Strength |
| --- | --- | ---: | ---: |
| Spark Bolt | Attack · bolt | 1 | 2 damage |
| Comet Lance | Attack · bolt | 2 | 3 damage |
| Prism Ward | Guard · shield | 1 | 2 blocked |
| Mirror Shield | Guard · shield | 2 | 3 blocked |
| Stillwater | Focus · loop | 0 | Recover 2 mana |
| Astral Flow | Focus · loop | 1 | Recover 3 mana |

## Privacy and persistence

The D1-backed server owns draft locks, spell eligibility, gesture recognition, resource changes, deadlines, timeout defaults, damage, knockout and the final winner. Host, display, spectator and rival-player snapshots never include unsubmitted spellbooks or casts. Reveals include only the resolved round’s spells and effects. Same-room replay clears the prior match state.

## Provenance

The gameplay direction takes high-level inspiration from the [Open Party Lab Magic Duell project](https://github.com/Hartwich/magic-duell): two-player spell loadouts, mana, shields and simultaneous casting. This implementation does not copy upstream code, assets, spell names/descriptions, prompts, rules text, media, or runtime. Its six spells, glyph classifier, resource resolution, room integration, UI and documentation are first-party King Prompter work. The upstream repository has a code license, but its content/assets were not used; no upstream code attribution is applicable to this implementation.
