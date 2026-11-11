# King Prompter

King Prompter is the primary two-to-ten-player game. One shared host screen presents the show while each player uses a phone as an authenticated controller. Solo Playtest Mode supports one human plus two to five deterministic bot opponents.

## Match flow

1. **Canvas One:** the King gives the room one all-ages request. Every player has 120 seconds to describe a funny painting in fewer than 20 words.
2. **Optional Canvas Two poll:** early finishers may choose among exactly three curated requests. A tied poll uses first-to-reach; a room with no votes uses a deterministic choice.
3. **Overlapping production:** Canvas One images generate while Canvas Two writing begins. Canvas Two images generate while Canvas One voting begins.
4. **Canvas ballots:** every prompt stays beside its anonymous image. Each player chooses one favorite and cannot choose their own. A received vote is worth 100 points on Canvas One and 150 on Canvas Two. Tied winners remain co-winners.
5. **Royal Restoration:** one old portrait keeps its central King unchanged. Every player describes one addition for an assigned torn section; ordinary square images are cropped beneath deterministic 3–10-player masks to form one deliberately mismatched collage.
6. **Royal Seals:** every player chooses one favorite restored section, never their own. Each received vote is worth 300 points, and tied restoration winners remain co-winners.
7. **Final results:** all uniquely keyed score events are totaled. Tied high scores create co-champions and the complete collage remains visible as the match artifact.

After a player locks an answer or ballot, the phone offers a curated two-option feedback comparison instead of an idle counter. A choice is worth 25 points, followed by a server-enforced 10-second reading cooldown. Each player receives a deterministic six-card window from the larger mode-specific bank, so the total feedback bonus is capped at 150 points per match. D1 stores idempotent anonymous tallies for future rooms; those preferences can weight later Canvas launchpads, themes, and art direction without deciding gameplay.

## Points

| Ballot | Points per received favorite vote |
| --- | ---: |
| Canvas One | 100 |
| Canvas Two | 150 |
| Royal Restoration | 300 |

Audience favorites remain non-scoring. All scoring ballots accept exactly one eligible favorite.

## Failure and safety behavior

- King Prompter does not call the project's separate moderation provider. Text still receives structural validation: non-empty, under 20 words, no unsupported control characters, and a bounded character count.
- Cloudflare's image model may apply its own unavoidable provider safety behavior.
- Failed, unavailable, or late image jobs become anonymous concept cards and stay eligible for voting.
- Image failures never decide points, phases, winners, or eligibility.
- Solo bots use the normal authoritative answer and ballot structures. Solo remains quota-free by default with deterministic concept cards. An explicit live-image test switch queues the human and every bot contribution through the configured Cloudflare allocation; in this test mode, bot ballots deliberately place the human entry first so the complete image lifecycle is exercised.
