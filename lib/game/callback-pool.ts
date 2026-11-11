export interface CallbackPoolEntry {
  coherence: number;
  answerability: number;
  surprise: number;
  used: boolean;
  usageCount?: number;
  lastUsedRoundIndex?: number | null;
}

export interface CallbackSelectionOptions {
  roundIndex: number;
  minimumCoherence: number;
  minimumAnswerability: number;
  minimumSurprise?: number;
}

export function callbackQuality(entry: CallbackPoolEntry): number {
  return entry.coherence * 0.5 + entry.answerability * 0.3 + entry.surprise * 0.2;
}

export function selectCallbackEntry<T extends CallbackPoolEntry>(entries: readonly T[], options: CallbackSelectionOptions): T | null {
  const eligible = entries.filter((entry) => !entry.used
    && entry.coherence >= options.minimumCoherence
    && entry.answerability >= options.minimumAnswerability
    && entry.surprise >= (options.minimumSurprise ?? 0));
  const ranked = [...eligible].sort((left, right) => {
    const leftPenalty = (left.usageCount ?? 0) * 0.08 + (left.lastUsedRoundIndex == null ? 0 : Math.max(0, 3 - (options.roundIndex - left.lastUsedRoundIndex)) * 0.04);
    const rightPenalty = (right.usageCount ?? 0) * 0.08 + (right.lastUsedRoundIndex == null ? 0 : Math.max(0, 3 - (options.roundIndex - right.lastUsedRoundIndex)) * 0.04);
    return (callbackQuality(right) - rightPenalty) - (callbackQuality(left) - leftPenalty);
  });
  return ranked[0] ?? null;
}

export function markCallbackUsed<T extends CallbackPoolEntry>(entry: T, roundIndex: number): void {
  entry.used = true;
  entry.usageCount = (entry.usageCount ?? 0) + 1;
  entry.lastUsedRoundIndex = roundIndex;
}
