# Sketch & Sorcery: the house critic's comedy desk

Researched and implemented October 31, 2026. The playable script bank contains **2,000 original lines**: eight moods × twenty-five situations × ten alternatives. These are newly written game scripts, not a collection of copied Jackbox or celebrity jokes, and not an empirically ranked list of funniest lines. Browser speech uses the existing device voice; this update does not add recorded performances or paid text generation.

## Research and writing decisions

| Source | What it supports | Application here |
| --- | --- | --- |
| [Jackbox: Making The Jackbox Party Pack](https://www.jackboxgames.com/blog/making-the-jackbox-party-pack) | Jackbox describes player-led humor as central to its games. | The drawings and players remain the attraction; the narrator sets up a moment and leaves room for the room to react. |
| [Jackbox: How to Write a Good Quiplash Prompt](https://www.jackboxgames.com/blog/how-to-write-a-good-quiplash-prompt) | Specificity, audience awareness, variety and giving players room to be funny. | Concrete comic objects and varied setups, with short, understandable directions separated from jokes. This is writing guidance, not a host-script transcript. |
| [Toastmasters: Your Comedy Checklist](https://www.toastmasters.org/magazine/articles/your-comedy-checklist) | Surprise, recognizable situations, vivid images, understandable delivery and economy. | Short incongruous endings about gallery bureaucracy, enchanted art supplies and the host's imaginary budget. |
| [Toastmasters: The Magic Power of Humor](https://www.toastmasters.org/magazine/magazine-issues/2019/june/the-magic-power-of-humor) | Self-deprecation can connect a speaker with an audience. | The host, museum and production are frequent targets; personal worth and sensitive traits are not. |
| [Jackbox developers interviewed by Game Rant](https://gamerant.com/jackbox-party-pack-10-interview/) | Developers discuss making the players the stars and allowing different styles of humor. | Eight coherent personalities rather than one repeated sarcastic voice. |
| [BBC: Nikki Glaser's Golden Globes hosting](https://www.bbc.com/news/articles/c708yjy8plyo) | Event hosting can tease the ceremony and its institutions. | Structural reference only; none of its jokes are reproduced. |

## The personalities

| Mood | Comic character |
| --- | --- |
| Nice | An over-supportive art teacher with an excessive supply of encouragement and imaginary stickers. |
| Funny | A dry emcee trying to run a respectable show on an imaginary budget. |
| Quirky | A museum bureaucrat whose permits, paperwork and office supplies have lives of their own. |
| Silly | An enthusiastic wizard with deeply unreliable equipment. |
| Sassy | A velvet-rope diva giving every doodle a dramatic entrance. |
| Critical | A pompous art critic taking an extremely unserious exhibition far too seriously. |
| Analytical | A deadpan researcher treating artistic chaos like a very questionable experiment. |
| Mean | An exasperated theatrical roast critic. The art and production get roasted, rather than a player's identity or worth. |

Automatic mode chooses a reproducible mood from the match identity, keeping it stable across snapshots and reloads. The TV's **Narrator mood** selector can override it. A choice lasts for that match on that TV, and a new match returns to automatic. Display screens have the same automatic choice; explicit overrides are device-local presentation preferences.

## Where the ten-option banks are used

| Situation | Trigger |
| --- | --- |
| Prompt writing | Everyone begins writing or browsing drawing ideas. |
| Prompt voting | The ranked prompt election opens. |
| Curse selection | The authoritative last-place chooser gets the curse menu in round two. |
| Final preparation | Players choose their private final twist and starter. |
| Drawing begins | A shared or private-final assignment opens, with the correct standard/extended duration. |
| Drawing banter | One optional line after 45 seconds while multiple artists are still working; this is not inactivity detection. |
| Transformation | The magic begins, with one optional follow-up if processing is still underway after 45 seconds. |
| Anonymous showcase | Each lettered drawing gets its own short introduction; no artist identity is used. |
| Original-sketch fallback | The entire anonymous gallery uses originals because transformation was unavailable. |
| Laughter voting | Ranked ballots open, with the current round's actual point values. |
| Artist guessing | Players identify the artists behind their chosen drawings. |
| Artist revealed | The server reveals an artist and original sketch. |
| Round-winning drawing | A positive-vote first-place drawing is revealed; joint winners remain winners. |
| Round results | The authoritative score summary appears. |
| Between rounds | The saved two-round halfway or current three-round transition appears. |
| Game complete | The final exhibition appears. |
| Tied champions | The authoritative final champions contain more than one player, with no assumed count. |
| Half drawing time | The midpoint of the current drawing timer, not a command to abandon the current drawing. |
| One minute | A fresh one-minute drawing warning. |
| Thirty seconds | A fresh warning for longer drawing/writing phases. |
| Last seconds | A final lock-in reminder, using the actual remaining seconds if joined late. |
| Last prompt writer | Exactly one player is still writing and everyone else has submitted. |
| Last artist drawing | Exactly one player is still drawing and everyone else has locked in. |
| Pause | A caption accompanies the pause; speech is cancelled. |
| Resume | A short return-to-show cue if resuming the same phase. |

## Runtime contracts

- Mandatory facts are separate from the punchline. Scores, multipliers, timer modes, task eligibility and private-final rules come from the authoritative snapshot and existing versioned rules.
- A seeded shuffled bag uses all ten lines for a situation before reusing one. Repeated polls reuse the event identity and selected variant. Heard-event IDs and bounded variant history are stored locally for the current match only; blocked/full local storage cannot stop play.
- Optional banter waits for a quiet gap. New phase/card cues and urgent warnings take priority. Superseded cues are discarded, and late reconnects cannot trigger old minute/halfway warnings in sequence. Short transitions may omit the quip to retain the required instruction.
- `{name}` is substituted literally using public roster nicknames, with control-character removal and a forty-character cap. Replacement callbacks prevent names such as `$&` or `{letter}` from altering the template. React renders text, not HTML. `{letter}` refers only to the current anonymous card.
- Names in an anonymous gallery are never inferred, even if a malformed client fixture contains an author field. Only the actual reveal entry authorizes artist attribution. Pending-player callouts disclose submission status already available to the host.
- The narrator has no access to in-progress canvas pixels and makes no actual visual analysis. Quips are scripted reactions, not claims of AI vision. The optional fish finale retains its separate presentation.
- Voice remains explicitly enabled by the host. Captions work without speech support, mute cancels narration, pause cancels speech, and existing music ducking remains in place. No new API key, provider call or cost is introduced.

The full readable catalogue is in [the scriptbook](sketch-narrator-scriptbook.md). Editable source: `lib/content/sketch-narrator-lines.ts`. Timeline: `lib/game/sketch-narrator-cues.ts`; selection/scheduling: `lib/game/sketch-narrator.ts`; TV integration: `app/components/sketch-relay/useSketchNarrator.ts`.
