type PromptPayload = Record<string, unknown>;

const PLAYER_PRIORITY = [
  "The player's prompt is the highest creative priority.",
  "Preserve its central subject, action, setting, relationships, mood, and joke.",
  "Do not replace, reverse, or explain the player's idea.",
  "Add only supporting details that make the requested moment clearer and funnier.",
  "If any generic art direction conflicts with the player's prompt, follow the player's prompt.",
].join(" ");

const TECHNICAL_RULES = [
  "Required format: one square image. Output dimensions are controlled by the image API.",
  "Use one instantly readable focal action, strong silhouettes, expressive poses and reactions, purposeful foreground/background separation, polished lighting, and clean detail.",
  "Unless the player explicitly requests them, do not add words, captions, speech balloons, watermarks, borders, or logos.",
].join(" ");

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function kingPrompt(payload: PromptPayload): string {
  const playerPrompt = text(payload.visualBrief, "A surprising, funny visual scene");
  return [
    "PLAYER PROMPT — PRIMARY CREATIVE DIRECTION",
    playerPrompt,
    "",
    "PRIORITY RULE",
    PLAYER_PRIORITY,
    "",
    "COMEDIC IMAGE DIRECTION",
    "Stage the player's idea as one decisive visual moment. Make the main character's goal and the immediate problem readable at a glance. Strengthen the existing joke through scale, contrast, status, facial reaction, body language, or one relevant background detail—never by changing the premise or adding an unrelated gag.",
    "If the player names a visual style, follow it. Otherwise use vibrant, high-end comedic editorial illustration with cinematic composition and tactile detail.",
    "",
    "TECHNICAL RULES",
    TECHNICAL_RULES,
  ].join("\n");
}

function restorationPrompt(payload: PromptPayload): string {
  const playerPrompt = text(payload.visualBrief, "A surprising detail from a damaged royal portrait");
  return [
    "ROYAL RESTORATION PATCH — PLAYER CREATIVE DIRECTION",
    playerPrompt,
    "",
    "COMPOSITION",
    "Create one complete square illustration. Put the requested subject large and centered with useful detail reaching the edges. This square will be cropped by an irregular torn-paper mask and layered beside an existing royal portrait, so do not draw a frame, ripped paper, the King, seams, borders, captions, or empty transparency.",
    "Use warm Renaissance storybook painting, aged canvas texture, theatrical expressions, rich pigments, and lighting compatible with an old castle portrait. Embrace a funny visual mismatch while keeping the player's request unmistakable.",
    "",
    "PRIORITY RULE",
    PLAYER_PRIORITY,
    "",
    "TECHNICAL RULES",
    TECHNICAL_RULES,
  ].join("\n");
}

const COMIC_FUNCTIONS: Record<1 | 2 | 3, string> = {
  1: "SETUP — PANEL 1 OF 3. Clearly establish the recurring cast, location, normal situation, and the first awkward problem. Make the premise understandable without explanation. Create comic tension but do not deliver or hint at the final punchline.",
  2: "ESCALATION — PANEL 2 OF 3. Preserve the established cast, recognizable character traits, location, scale, and visual logic. The player's prompt controls what happens next. Add one clear complication that makes the situation meaningfully worse. Raise anticipation without resolving the problem or spending the final punchline.",
  3: "PAYOFF — PANEL 3 OF 3. Preserve the established cast and story logic. The player's prompt is the punchline and controls the payoff. Depict the exact instant of reversal, consequence, reveal, or reaction that makes it land visually. Resolve the central comic tension cleanly; do not dilute it with a second unrelated joke or extra epilogue.",
};
const COMIC_LABELS: Record<1 | 2 | 3, string> = { 1: "SETUP", 2: "ESCALATION", 3: "PAYOFF / PUNCHLINE" };

function comicPrompt(payload: PromptPayload): string {
  const playerPrompt = text(payload.visualBrief, "A funny continuation of the comic");
  const rawFrame = Number(payload.comicFrameNumber);
  const frameNumber = (rawFrame === 2 || rawFrame === 3 ? rawFrame : 1) as 1 | 2 | 3;
  const theme = text(payload.comicTheme, "An absurd continuing comic");
  const previousPanels = stringList(payload.previousPanels);
  const legacyIngredients = stringList(payload.ingredients).filter((item) => !item.startsWith("Current panel:"));
  const continuity = previousPanels.length ? previousPanels.map((panel, index) => `Panel ${index + 1}: ${panel}`)
    : legacyIngredients.length ? legacyIngredients : ["No previous panel has been locked yet."];
  const referenceCount = Math.min(4, Math.max(0, Number(payload.suppliedReferenceCount) || 0));
  const referenceMap = referenceCount > 0 ? [
    "",
    "REFERENCE IMAGES",
    ...Array.from({ length: referenceCount }, (_value, index) => `Input image ${index} is the actual winning artwork for panel ${index + 1}.`),
    "Use the reference images to preserve recurring character appearance, wardrobe, proportions, palette, linework, environment, and important props. Preserve continuity wherever it does not conflict with the current player prompt.",
  ] : [];
  return [
    `COMIC ROLE — ${COMIC_LABELS[frameNumber]} — PANEL ${frameNumber} OF 3`,
    "",
    "PLAYER PROMPT — PRIMARY CREATIVE DIRECTION",
    playerPrompt,
    "",
    "PRIORITY RULE",
    PLAYER_PRIORITY,
    "",
    "SERIES CONTINUITY",
    `Theme: ${theme}`,
    ...continuity,
    ...referenceMap,
    "Treat earlier panels as continuity, not as permission to override the current player prompt. If the current prompt deliberately changes something, make that change visually clear while retaining every compatible recurring detail.",
    "",
    "PANEL-SPECIFIC COMEDY DIRECTION",
    COMIC_FUNCTIONS[frameNumber],
    "Use a single readable beat with expressive reactions and clear cause-and-effect. Do not add dialogue or narration to explain the joke unless the player explicitly requested visible text.",
    "",
    "TECHNICAL RULES",
    `${TECHNICAL_RULES} Render one comic panel only with clean bold linework and consistent recurring character design.`,
  ].join("\n");
}

function roomLorePrompt(payload: PromptPayload): string {
  const visualBrief = text(payload.visualBrief, "A playful party-game concept");
  const ingredients = stringList(payload.ingredients);
  const constraints = text(payload.constraints, "Landscape composition with no important embedded text");
  return [
    "ROOM CREATIVE DIRECTION",
    visualBrief,
    ...(ingredients.length ? ["", "ESTABLISHED ROOM DETAILS", ...ingredients] : []),
    "",
    "COMPOSITION",
    "Combine only compatible established details into one coherent, instantly readable visual scene. Preserve the room's winning ideas instead of replacing them with generic fantasy imagery.",
    "",
    "TECHNICAL RULES",
    constraints,
  ].join("\n");
}

export function assembleImagePrompt(jobKind: string, payload: PromptPayload): string {
  if (["KING_PROMPT_IMAGE", "KING_MYSTERY_IMAGE"].includes(jobKind)) return kingPrompt(payload);
  if (jobKind === "KING_RESTORATION_PATCH") return restorationPrompt(payload);
  if (jobKind === "COMIC_PANEL_IMAGE") return comicPrompt(payload);
  return roomLorePrompt(payload);
}
