# Drawing interface critique and player-review findings

Reviewed 2026-10-29. This is a focused interface and practice-prompt update, not implementation of multiplayer rounds or AI transformation.

## Evidence from real reviews

- [Steam: Drawful 2 player reviews](https://steamcommunity.com/app/442070/reviews/?browsefilter=toprated&l=english). C. J. Cregg (2016) describes new players needing help understanding the rules. MrGrinch989 (2020) values familiar phone controls and funny imperfect drawings but notes that understanding the prompts needs English fluency. MultitapMugen (2017) likes the second colour, warns that too many tools could hurt simplicity and pacing, and values custom prompts. These are individual accounts, not a representative survey.
- [BagoGames: Drawful 2 hands-on group review](https://bagogames.com/drawful-2-review/). The reviewer enjoyed the absurdity, while some participants disliked obscure or indistinguishable answers and wanted an eraser or more coherent themes. The review disclosed a supplied review copy. This supports offering accessible defaults and recovery tools; it does not prove difficult prompts are universally bad.
- [Destructoid: Drawful 2 review](https://www.destructoid.com/reviews/review-drawful-2/). The reviewer enjoys limited tools and no eraser as part of the comedy. We preserve the relaxed doodling spirit, while keeping undo/eraser because this interface is specifically meant to be easy and forgiving.
- [Gartic Phone: App Store player reviews](https://apps.apple.com/us/app/gartic-phone/id6788498566?platform=iphone&see-all=reviews). Scratched complains that iPad rotation wastes screen space; Average user6789[] enjoys the funny results despite limited drawing ability. Mario Vin Star criticizes repeated random choices and poorly surfaced instructions. This motivates orientation checks, visible choices and avoiding immediate repeat prompts. Complaints about public lobbies are outside this dashboard task.
- [Fullscreen API Standard](https://fullscreen.spec.whatwg.org/). Browser fullscreen normally requires transient user activation. Filling the page is immediate; requesting native fullscreen happens from prompt selection or the explicit Full screen button. Unsupported or embedded browsers keep a fully usable canvas.

## Critique and resulting changes

| Flaw in the previous interface | Evidence | Change |
| --- | --- | --- |
| The drawing prompt was deliberately truncated. | The CSS used nowrap, hidden overflow and ellipsis. | Wrap the complete prompt; move Back into More so the prompt has room. |
| A complex default was the only supplied idea. | A knight riding an enormous snail requires several objects, scale and a relationship. | Offer three short ideas from 48 original, concrete prompts. Refresh excludes the current choices and selected prompt. Custom input remains optional. |
| Full-screen appearance came from cropping a square. | The paper used the longer viewport dimension for both axes. | New pages match the opening viewport. Whole drawing is the default for sized pages; legacy square drafts keep their original shape and previous full-view behavior. A confirmed New page action creates a screen-shaped replacement. |
| The prompt vanished on reload. | It lived only in component state. | Save the chosen/custom prompt with the validated device draft and retain it through undo/redo. |
| Erasing needed a menu trip. | The eraser was inside the tool chooser. | Put pen and eraser directly beside ink, undo/redo and More. Stable button positions avoid accidental taps as history changes. |
| Advanced settings dominated More on opening. | View controls were expanded by default. | Keep view, file and custom controls collapsed; brush size and shapes have short direct menu rows. |
| Restore feedback covered the page. | A persistent centred banner occupied the drawing area. | Use the save status instead. |
| Done stayed active immediately after Clear. | History existed even when the latest operation cleared everything. | Disable Done after Clear; Undo restores both the sketch and the available action. |

## Decisions and limits

The selected prompt is visible from the first screen. Tapping its “3 ideas” control shows three readable choices without blocking initial drawing behind a mandatory start screen. Simple familiar subjects get one visible twist, rather than trivia, celebrity references, intentional typos or abstract wordplay. These defaults follow Danny’s preference; they are not claimed to be the optimum for every party group.

New-page dimensions are bounded to 1024 pixels on the longest side. Rendering, fill, review and export use both dimensions. Resizing an untouched page matches the new viewport; once marks/history exist, rotation preserves geometry and shows the whole page. Hand and zoom remain optional. Existing drafts remain valid. Prompt changes keep the drawing; only New page explicitly replaces its history after confirmation.

No paid calls or new dependencies. Physical touch, native file download and native fullscreen success require real-device acceptance; cloud-browser denial must not be reported as successful fullscreen.
