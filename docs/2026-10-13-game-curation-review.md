# CALLBACK game curation review

Reviewed 2026-10-13 from Sites version 73, preserving the subsequently published versions 77 and 78 updates and the requested curation changes. These are recommendations about where to spend development time, not a claim that a passing test makes a game fun. Only the sixteen explicitly marked games are archived by this update. Earlier archives of Classic Bowl, Royal War Room and Birthday remain intact.

## Recommended focus

Put most development time into **King Prompter, Royal Rumours and Let's Make a Comic**. They can offer something specific to CALLBACK: the group's own answers, characters, running jokes and consequences carrying between rounds. Keep **Bowl of Fools** for its human social play, and **Royal Sumo** as the primary physical Arcade game. Give **Blind Crown** one real group play session before funding more development; its secret plans offer a more distinctive direction than another generic action game.

Maintain a small playable shelf; park experiments outside the main development queue. A useful budget is three creative games, one simple social game, and one or two Arcade favourites. Choose the second Arcade game by replay requests from your group, rather than how much code already exists.

AI is most useful for prompt editing, coherent callbacks, story variations, tutorial wording and finding bugs. It cannot establish whether a game is fun, repair network timing by writing better prompts, replace playtesting, or safely decide scores and winners. Do not start a large asset-generation pass to rescue an unappealing mechanic.

The user requested free bots for every retained game. Optional deterministic practice opponents help test and fill rooms; they do not change these investment recommendations. Drawing and acting bots provide limited coded practice cues, while real people supply those games' social appeal. This review does not propose paid AI opponents or a new image-generation pass.

## Main party games

| Game | Recommendation | Reason and useful AI work |
| --- | --- | --- |
| King Prompter | Invest first | Make the creative reveal and next round connect to actual group history. AI can edit prompts and interpret established memories; players and the server decide outcomes. |
| Royal Rumours | Invest | Secret authorship, believable decoys and recurring characters give it a clear social identity. Improve decoy variety and callback coherence. |
| Let's Make a Comic | Invest | A group-created story can produce a memorable shared ending. Use AI for panel continuity and concise captions; preserve useful fallbacks. No images were generated during this review. |
| The Royal Frame-Up | Maintain; secondary priority | Image voting can work, but it competes with the other creative modes. Keep it only if the group prefers its simple reveal. Prompt quality matters more than adding modes. |
| Bowl of Fools | Maintain | Human acting/drawing and familiar group references can be fun with little technical complexity. Prepare/edit prompt decks with AI; do not automate the human performance. |
| Legacy Standard | Archive next unless regularly requested | A generic write/vote format duplicates the creative modes and readily available hosted party games. Preserve its engine/content for restoration. |

## Remaining physical and featured Arcade games

| Game | Recommendation | Reason and useful AI work |
| --- | --- | --- |
| Royal Sumo | Keep as Arcade flagship | Clear movement, Bash/Dash and readable knockout goals. Spend time on control feel, latency, teaching and arena balance. AI can assist tests and tuning analysis; it does not solve touch latency. |
| Blind Crown | Keep for a group trial | Private planning is a distinct premise. Assess whether players understand the plan/reveal and want another round. AI can improve explanations and scenario authoring. |
| Royal Twisted | Maintain if your group likes it | Jump/duck timing has a short learning curve. Improve hazard readability and difficulty pacing; runtime generative AI offers little benefit. |
| Royal Scratch Match | Park; keep only if replayed | Memory/rhythm is highly sensitive to input timing and audio feedback. AI-authored patterns are secondary to reliable timing and good teaching. |
| Roller Ruckus | Recommend archive next | Racing needs camera, handling, collision and network polish together. This is expensive compared with playing a hosted racer. Do not fund an AI art makeover first. |
| Tailblazer | Recommend archive next | Another trail/territory experiment overlaps Light Trails. Choose one only after a head-to-head group trial; do not maintain both by default. |
| Light Trails | Recommend archive next, unless a favourite | Familiar elimination play with a low differentiation ceiling and latency sensitivity. Better presentation alone does not create a reason to own this implementation. |
| Air Hockey | Recommend archive next | The current ten-phone paddle/team variation adds substantial control and synchronization work to a familiar mechanic. A hosted action collection is a lower-maintenance choice. |

The shared lobby and standalone packages are separate implementations for several retained titles. For example, the online catalogue uses Twisted 0.6, Roller 1.5 and Scratch 0.6 contracts; standalone packages are 0.7, 1.6 and 0.7 respectively. A future retention decision should select **one supported launch path per game**. Keep legacy rendering only for persisted matches. Duplicating upgrades across both paths is a real maintenance cost; this curation pass preserves compatibility instead of redesigning those engines.

## Remaining native party-room Arcade games

These sixteen entries are still marked as prototypes/placeholders in the catalogue. Functional phone tests establish usable flows, not release-quality game feel. Most should leave the active development queue.

| Game | Recommendation | Reason / AI potential / alternative |
| --- | --- | --- |
| Arena Survivor | Park | Choice-based survival needs surprising, legible consequences. AI can draft scenarios, but the server must resolve them; retain only if it becomes a distinctive social format. |
| Buzzwort | Maintain only if regularly played | Human forbidden-clue play is inexpensive to run. AI can prepare clue decks; a broad hosted party-game collection avoids owning another generic word game. |
| Chaos-Kommando | Park for a group trial | Private tools and team coordination have potential. AI can author missions, but meaningful interaction and clear reveals matter more than mission quantity. |
| Drift Racer | Archive next | Another racing development track competes with Roller and hosted racers. Pick at most one, preferably the one the group already enjoys. |
| Flatterfluff | Archive next | Basic aim/pop targets offer little CALLBACK-specific value. Use a hosted phone-controller action collection. |
| Kartentisch | Archive next | Generic trick taking requires rule and presentation polish with limited benefit from generative AI. Established card-game sites are a better direction. |
| Magic Arena | Archive next or merge | Two overlapping magic combat modes dilute effort. Keep neither without a strong group preference; do not develop both. |
| Magic Duell | Park; the more promising magic candidate | Private spellbooks and drawn glyphs can be distinctive. AI can improve tutorial and spell descriptions; drawing recognition, balance and interaction still need engineering. |
| Minions TD | Park | Strategy and balance are a substantial separate product. AI can propose encounters and explain choices, but cannot substitute for balancing and group playtests. |
| Schaetzorama | Archive next | Generic closest-number estimation is readily available in hosted games such as Doot's Ballpark. |
| Word Tiles | Archive next | A familiar word-building mechanic needs dictionary and usability maintenance. Prefer an established word-game service. |
| Zeichnen & Erraten | Archive next | Standard drawing/guessing is already hosted by skribbl.io; no need to maintain a parallel implementation. |
| Imposter | Archive next | Hidden-word bluffing is already represented by Doot's Faker and other hosted games. AI word generation alone is not enough differentiation. |
| Pantomime | Maintain only as a simple group tool | Real humans supply the fun. AI can edit prompt decks; keep the implementation small, or use a hosted prompt collection. |
| Schattenjagd | Park; candidate for one distinctive deduction game | Private clues are compatible with authored mysteries. AI can draft cases, but the answer must be fixed and server validated, with no hidden-information leakage. |
| Dungeon Party | Park; strongest native story candidate | Cooperative encounters can connect to CALLBACK characters and lore. AI can author coherent situations; scoring and consequences remain deterministic. |

## Hosted alternatives researched

The official sites below were checked on 2026-10-13. Availability and documented features were verified; complete external multiplayer sessions and personal enjoyment were not. These services use their own accounts/rooms/controllers and do not inherit a CALLBACK lobby or score.

| Service | Best use | Verified facts and limits |
| --- | --- | --- |
| [Doot](https://doot.games/) | First alternative for writing/voting, estimation, hidden-word bluffing, drawing and story rounds | Its official site describes a big-screen host, phone joining by code/QR, no app or account needed to play, and hostable Quip Clash, Ballpark, Faker, Doodle Chain and other formats. It is already linked from CALLBACK's Party Games page. Direct choices: [Quip Clash](https://doot.games/game/quip-clash), [Ballpark](https://doot.games/game/ballpark), and phone-controlled kart racing in [Pit Party](https://doot.games/game/pit-party). |
| [Gartic Phone](https://garticphone.com/) | Drawing telephone / comic-like group chaos | Official instructions alternate writing, drawing and describing, ending in a shared reveal. Each player participates on their device; it is not a drop-in CALLBACK controller game. |
| [skribbl.io](https://skribbl.io/) | Direct replacement for ordinary drawing and guessing | Official site describes free multiplayer, private rooms, mobile support and up to twenty players in custom rooms. |
| [AirConsole](https://www.airconsole.com/info) | Closest match to TV plus phone-controller action games | Official site documents a shared screen and smartphone controllers. A free trial is available; the [Hero page](https://www.airconsole.com/hero) lists subscription benefits including more players and all PC games. Check the current local price and chosen game's capacity before paying. |
| [JKLM.FUN](https://jklm.fun/faq/) | Fast browser word/guessing games | Official FAQ lists private BombParty/PopSauce rooms and BombParty's two-to-sixteen-player range. Its FAQ has older content, so verify current room options when hosting. This is device/browser participation, rather than a universal TV-controller replacement. |

Joystick Jammers is already linked in CALLBACK. Its host page could not be read through the research tool in this pass, so it is not ranked above verified options without a fresh playtest.

## Proposed next decision

Try Doot for the generic party formats and AirConsole for physical action games. Keep the CALLBACK creative core. After one short group session, retain only the Arcade games that people request again. The strongest further archive candidates are Legacy Standard, Roller, Tailblazer, Light Trails, Air Hockey, Drift Racer, Flatterfluff, Kartentisch, Magic Arena, Schaetzorama, Word Tiles, Zeichnen & Erraten and Imposter. This list is a recommendation, not an additional removal performed by this update.
