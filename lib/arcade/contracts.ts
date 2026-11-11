import { z } from "zod";

export const ArcadeGameIdSchema = z.enum([
  "arena-survivor",
  "buzzwort",
  "chaos-kommando",
  "drift-racer",
  "fish-tank",
  "flatterfluff",
  "kartentisch",
  "magic-arena",
  "magic-duell",
  "minions-td",
  "schaetzorama",
  "word-tiles",
  "sketch-relay",
  "zeichnen-und-erraten",
  "air-hockey",
  "imposter",
  "light-trails",
  "pantomime",
  "schattenjagd",
  "tap-race",
  "dungeon-party",
]);

export type ArcadeGameId = z.infer<typeof ArcadeGameIdSchema>;
