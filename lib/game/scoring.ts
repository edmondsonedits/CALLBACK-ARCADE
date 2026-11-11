export const roundTo10 = (value: number) => Math.round(value / 10) * 10;
export function creativeScore(roundCap: number, applauseReceived: number, maximumPossibleApplause: number): number { return maximumPossibleApplause <= 0 ? 0 : roundTo10(roundCap * applauseReceived / maximumPossibleApplause); }
export function readTheRoomScore(predicted: readonly number[], actual: readonly number[]) {
  if (predicted.length !== 10 || actual.length !== 10) throw new Error("TEN_CHIPS_REQUIRED");
  return distributionPredictionScore(predicted, actual);
}
export function distributionPredictionScore(predicted: readonly number[], actual: readonly number[]) {
  if (predicted.length < 2 || predicted.length !== actual.length) throw new Error("DISTRIBUTION_SHAPE_MISMATCH");
  const error = 0.5 * predicted.reduce((sum, value, index) => sum + Math.abs(value - actual[index]), 0);
  const accuracy = Math.max(0, Math.min(100, 100 - error));
  return { error, accuracy, points: Math.round(accuracy * 10) };
}
export const finalWager = (correct: boolean, wager: 100 | 250 | 500) => correct ? wager : -wager;
export function winnersFromTotals(totals: Record<string, number>): string[] { const entries = Object.entries(totals); if (!entries.length) return []; const high = Math.max(...entries.map(([, points]) => points)); return entries.filter(([, points]) => points === high).map(([id]) => id); }
export const maximumPossibleApplause = (voterCount: number, ranked: boolean) => ranked ? voterCount * 2 : voterCount;
