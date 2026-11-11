import assert from "node:assert/strict";
import test from "node:test";
import { assembleImagePrompt } from "../server/image-prompts";

test("King Prompter sends the player's words once and before generic direction", () => {
  const playerPrompt = "A nervous dragon taking a driving test inside a supermarket";
  const output = assembleImagePrompt("KING_PROMPT_IMAGE", { visualBrief: playerPrompt });
  assert.ok(output.startsWith(`PLAYER PROMPT — PRIMARY CREATIVE DIRECTION\n${playerPrompt}`));
  assert.equal(output.split(playerPrompt).length - 1, 1);
  assert.ok(output.indexOf(playerPrompt) < output.indexOf("COMEDIC IMAGE DIRECTION"));
  assert.match(output, /If any generic art direction conflicts with the player's prompt, follow the player's prompt/);
});

test("comic panels receive distinct setup, escalation, and payoff contracts", () => {
  const shared = { visualBrief: "The copier promotes itself and fires the wizard", comicTheme: "The Office Wizard", previousPanels: ["A wizard starts work beside a smoking copier"] };
  const setup = assembleImagePrompt("COMIC_PANEL_IMAGE", { ...shared, comicFrameNumber: 1 });
  const escalation = assembleImagePrompt("COMIC_PANEL_IMAGE", { ...shared, comicFrameNumber: 2 });
  const payoff = assembleImagePrompt("COMIC_PANEL_IMAGE", { ...shared, comicFrameNumber: 3 });
  assert.match(setup, /SETUP — PANEL 1 OF 3/);
  assert.match(setup, /do not deliver or hint at the final punchline/i);
  assert.match(escalation, /ESCALATION — PANEL 2 OF 3/);
  assert.match(escalation, /without resolving the problem/i);
  assert.match(payoff, /PAYOFF \/ PUNCHLINE — PANEL 3 OF 3/);
  assert.match(payoff, /player's prompt is the punchline/i);
  assert.match(payoff, /Panel 1: A wizard starts work beside a smoking copier/);
});

test("comic continuity cannot silently overrule a deliberate player change", () => {
  const output = assembleImagePrompt("COMIC_PANEL_IMAGE", {
    visualBrief: "The wizard escapes outdoors on the copier's paper airplane",
    comicFrameNumber: 3,
    comicTheme: "The Office Wizard",
    previousPanels: ["The wizard is trapped in a grey office"],
  });
  assert.match(output, /If the current prompt deliberately changes something, make that change visually clear/);
  assert.ok(output.indexOf("The wizard escapes outdoors") < output.indexOf("The wizard is trapped in a grey office"));
});

test("comic prompts map supplied winning images to their panel order", () => {
  const output = assembleImagePrompt("COMIC_PANEL_IMAGE", {
    visualBrief: "The wizard escapes on a paper airplane",
    comicFrameNumber: 3,
    comicTheme: "The Office Wizard",
    previousPanels: ["The wizard arrives", "The copier becomes manager"],
    suppliedReferenceCount: 2,
  });
  assert.match(output, /Input image 0 is the actual winning artwork for panel 1/);
  assert.match(output, /Input image 1 is the actual winning artwork for panel 2/);
  assert.match(output, /preserve recurring character appearance, wardrobe, proportions, palette, linework, environment, and important props/i);
});
