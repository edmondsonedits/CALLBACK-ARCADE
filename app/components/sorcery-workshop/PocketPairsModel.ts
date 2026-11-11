export type PocketPairsSave = { deck: string[]; open: number[]; matched: number[]; turns: number; paused: boolean };
const SYMBOLS = ["♜", "✦", "♞"] as const;

export function createPocketPairsDeck(random: () => number = Math.random): string[] {
  const deck = [...SYMBOLS, ...SYMBOLS];
  for (let index = deck.length - 1; index > 0; index--) {
    const sample = random(), target = Math.max(0, Math.min(index, Math.floor(sample * (index + 1))));
    [deck[index], deck[target]] = [deck[target]!, deck[index]!];
  }
  return deck;
}

export function isPocketPairsSave(value: unknown): value is PocketPairsSave {
  if (!value || typeof value !== "object") return false;
  const save = value as Partial<PocketPairsSave>;
  if (!Array.isArray(save.deck) || save.deck.length !== 6 || save.deck.some(symbol => typeof symbol !== "string" || !SYMBOLS.includes(symbol as typeof SYMBOLS[number]))) return false;
  if (SYMBOLS.some(symbol => save.deck!.filter(item => item === symbol).length !== 2)) return false;
  const indices = (list: unknown): list is number[] => Array.isArray(list) && list.every(index => Number.isInteger(index) && index >= 0 && index < 6) && new Set(list).size === list.length;
  return indices(save.open) && save.open.length <= 2 && indices(save.matched) && save.matched.every(index => !save.open!.includes(index)) && Number.isSafeInteger(save.turns) && save.turns! >= 0 && save.turns! <= 10_000 && typeof save.paused === "boolean";
}
