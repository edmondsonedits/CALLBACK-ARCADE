export type ArchivedArcadeGame = Readonly<{
  id: string;
  title: string;
  aliases: readonly string[];
}>;

/** Retained source IDs stay stable so archived games can be restored without recovering deleted assets. */
export const ARCHIVED_ARCADE_GAMES: readonly ArchivedArcadeGame[] = [
  { id: "space-bash", title: "Space Bash · Orbital Breakout", aliases: [] },
  { id: "snow-bash", title: "Snow Bash · Polar Panic", aliases: [] },
  { id: "drain-bash", title: "Drain Bash · Sump Siege", aliases: [] },
  { id: "jungle-bash", title: "Jungle Bash · Verdant Clash", aliases: [] },
  { id: "tie-breaker", title: "Tie-Breaker · Crown Gauntlet", aliases: [] },
  { id: "manic-panic", title: "Manic Panic · Bomb Joust", aliases: [] },
  { id: "rubble-alliance", title: "Rubble Alliance · Faultline Run", aliases: [] },
  { id: "sky-balls", title: "Royal Ballistix · Beach Siege", aliases: ["royal-ballistix"] },
  { id: "dragon-drop", title: "Dragon Drop · Jewel Joust", aliases: [] },
  { id: "volt-vault", title: "Volt Vault · Polarity Palace", aliases: [] },
  { id: "mystery-beat", title: "Mystery Beat", aliases: [] },
  { id: "jungle-fox", title: "Jungle Fox", aliases: [] },
  { id: "metal-fox", title: "Metal Fox", aliases: [] },
  { id: "paint-panic", title: "Paint Panic", aliases: [] },
  { id: "rhythm", title: "Rhythm", aliases: [] },
  { id: "tap-race", title: "Tap Race", aliases: [] },
];

const archivedArcadeIds = new Set(ARCHIVED_ARCADE_GAMES.flatMap(game => [game.id, ...game.aliases]));
const archivedArcadeById = new Map(ARCHIVED_ARCADE_GAMES.flatMap(game => [game.id, ...game.aliases].map(id => [id, game] as const)));

export function getArchivedArcadeGame(id: string | null | undefined): ArchivedArcadeGame | null {
  return typeof id === "string" ? archivedArcadeById.get(id.trim().toLowerCase()) ?? null : null;
}

export function isArchivedArcadeGame(id: string | null | undefined): boolean {
  return typeof id === "string" && archivedArcadeIds.has(id.trim().toLowerCase());
}
