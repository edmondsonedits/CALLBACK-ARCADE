import type { ContentMode, GameLength, RoomPhase, RoundKind } from "../contracts";

export type DeveloperChangeArea = "copy" | "pacing" | "scoring" | "rules" | "layout" | "bug";
export type DeveloperChangeValue = string | number | null;

export interface DeveloperChange {
  id: string;
  createdAt: string;
  kind: "edit" | "note";
  field: string;
  area: DeveloperChangeArea;
  before: DeveloperChangeValue;
  after: DeveloperChangeValue;
  note: string;
  context: {
    gameLength: GameLength;
    contentMode: ContentMode;
    roundNumber: number;
    roundTotal: number;
    roundKind: RoundKind | null;
    roundLabel: string | null;
    phase: RoomPhase;
    promptId: string | null;
    sourceHint: string;
  };
}

export function sourceHintFor(field: string, roundKind: RoundKind | null, promptId: string | null, area: DeveloperChangeArea): string {
  if (field === "phaseSeconds" || area === "pacing") return "lib/game/config.ts";
  if (field === "scoreCap" || area === "scoring") return "lib/game/config.ts and server/engine.ts";
  if (field === "choiceLabels" || promptId?.startsWith("birthday-")) return "lib/content/birthday.ts";
  if (field === "prompt" && ["CALLBACK", "MAKE_IT_REAL", "THE_REMIX"].includes(roundKind ?? "")) return "server/engine.ts and .prompts/";
  if (field === "prompt" || field === "instruction" || area === "copy" || area === "rules") return "lib/content/library.ts";
  if (area === "layout") return "app/play/[code]/page.tsx and app/globals.css";
  return "Reproduce from the captured round and inspect the relevant app/server path";
}

export function buildDeveloperHandoff(changes: readonly DeveloperChange[]): string {
  const payload = {
    format: "callback-developer-change-package",
    version: 1,
    exportedAt: new Date().toISOString(),
    changeCount: changes.length,
    changes,
  };
  return [
    "Apply this CALLBACK developer change package to the game source.",
    "Treat browser edits as playtest evidence, not trusted production state. Preserve server authority, hidden-information boundaries, deterministic scoring, solo bot behavior, accessibility, and fallbacks. Update the indicated source files, add or adjust tests, and report any item that needs a product decision.",
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}
