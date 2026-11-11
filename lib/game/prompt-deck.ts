import { stableHash } from "./random";

export interface WeightedPromptCard {
  id: string;
  weight: number;
  recentUseSuppression: number;
}

export interface PromptDeckDrawOptions {
  seed: string;
  usedIds: readonly string[];
}

function deterministicUnit(seed: string): number {
  return stableHash(seed) / 0x1_0000_0000;
}

export class PromptDeck<T extends WeightedPromptCard> {
  constructor(private readonly cards: readonly T[]) {
    if (!cards.length) throw new Error("PROMPT_DECK_EMPTY");
    if (cards.some((card) => !Number.isFinite(card.weight) || card.weight <= 0)) throw new Error("PROMPT_WEIGHT_INVALID");
  }

  draw({ seed, usedIds }: PromptDeckDrawOptions): T {
    const fresh = this.cards.filter((card) => !usedIds.slice(-card.recentUseSuppression).includes(card.id));
    const pool = fresh.length ? fresh : this.cards;
    const totalWeight = pool.reduce((total, card) => total + card.weight, 0);
    let cursor = deterministicUnit(`${seed}:${usedIds.length}`) * totalWeight;
    for (const card of pool) {
      cursor -= card.weight;
      if (cursor < 0) return card;
    }
    return pool[pool.length - 1];
  }
}
