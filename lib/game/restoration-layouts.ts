export interface RestorationSlot {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clipPath: string;
  objectPosition: string;
  rotate: number;
}

const SLOTS: Record<string, RestorationSlot> = {
  topLeft: { id: "topLeft", label: "upper-left", x: 1, y: 1, width: 34, height: 39, clipPath: "polygon(2% 5%,18% 0,35% 7%,53% 2%,70% 8%,88% 1%,100% 11%,95% 34%,100% 57%,92% 79%,96% 100%,69% 95%,45% 100%,23% 92%,0 98%,5% 72%,0 49%,7% 27%)", objectPosition: "center", rotate: -1.5 },
  topMidLeft: { id: "topMidLeft", label: "upper middle-left", x: 20, y: 0, width: 29, height: 32, clipPath: "polygon(3% 8%,20% 1%,38% 6%,56% 0,75% 7%,97% 2%,100% 29%,94% 52%,100% 76%,91% 100%,66% 94%,43% 100%,20% 93%,0 98%,5% 68%,0 38%)", objectPosition: "center", rotate: .7 },
  topCenter: { id: "topCenter", label: "top-centre", x: 36, y: 0, width: 28, height: 31, clipPath: "polygon(0 9%,17% 1%,36% 7%,52% 0,70% 6%,89% 1%,100% 10%,95% 35%,100% 59%,93% 82%,100% 100%,74% 95%,50% 100%,27% 94%,0 100%,6% 72%,1% 43%)", objectPosition: "center", rotate: -.4 },
  topMidRight: { id: "topMidRight", label: "upper middle-right", x: 51, y: 0, width: 29, height: 32, clipPath: "polygon(1% 4%,22% 0,43% 7%,62% 1,82% 8%,100% 3%,95% 31%,100% 57%,92% 77%,98% 100%,72% 94%,48% 100%,25% 93%,0 98%,6% 70%,1% 39%)", objectPosition: "center", rotate: -.8 },
  topRight: { id: "topRight", label: "upper-right", x: 65, y: 1, width: 34, height: 39, clipPath: "polygon(0 10%,15% 2%,32% 8%,51% 1%,69% 7%,86% 0,100% 6%,95% 31%,100% 52%,93% 75%,100% 97%,76% 93%,53% 100%,30% 94%,4% 100%,8% 78%,0 58%,5% 35%)", objectPosition: "center", rotate: 1.4 },
  leftUpper: { id: "leftUpper", label: "left side", x: 0, y: 25, width: 30, height: 43, clipPath: "polygon(5% 0,29% 6%,49% 1%,72% 8%,98% 3%,93% 28%,100% 50%,94% 71%,100% 96%,73% 91%,50% 100%,27% 94%,0 100%,6% 74%,0 50%,7% 24%)", objectPosition: "center", rotate: .8 },
  leftLower: { id: "leftLower", label: "lower-left", x: 0, y: 57, width: 35, height: 42, clipPath: "polygon(1% 4%,26% 0,48% 7%,70% 1%,98% 8%,92% 31%,100% 52%,94% 76%,99% 100%,72% 94%,49% 100%,24% 93%,0 98%,7% 72%,1% 48%,6% 25%)", objectPosition: "center", rotate: -1.1 },
  rightUpper: { id: "rightUpper", label: "right side", x: 70, y: 25, width: 30, height: 43, clipPath: "polygon(2% 4%,27% 0,50% 7%,71% 1%,96% 8%,91% 30%,100% 52%,93% 74%,99% 100%,73% 94%,51% 100%,29% 93%,0 98%,6% 72%,0 49%,7% 25%)", objectPosition: "center", rotate: -.9 },
  rightLower: { id: "rightLower", label: "lower-right", x: 65, y: 57, width: 35, height: 42, clipPath: "polygon(2% 7%,25% 1%,47% 8%,70% 0,98% 5%,92% 28%,100% 49%,94% 73%,100% 97%,74% 92%,50% 100%,26% 94%,0 99%,7% 75%,1% 51%,6% 28%)", objectPosition: "center", rotate: 1.2 },
  bottomCenter: { id: "bottomCenter", label: "lower-centre", x: 34, y: 69, width: 32, height: 30, clipPath: "polygon(1% 6%,24% 0,47% 7%,69% 1%,97% 8%,92% 31%,100% 53%,94% 76%,99% 100%,74% 94%,49% 100%,25% 93%,0 98%,6% 72%,0 49%,7% 25%)", objectPosition: "center", rotate: -.3 },
};

const LAYOUT_IDS: Record<number, readonly string[]> = {
  3: ["topCenter", "leftUpper", "rightUpper"],
  4: ["topLeft", "topRight", "leftLower", "rightLower"],
  5: ["topCenter", "leftUpper", "leftLower", "rightUpper", "rightLower"],
  6: ["topLeft", "topCenter", "topRight", "leftLower", "bottomCenter", "rightLower"],
  7: ["topLeft", "topCenter", "topRight", "leftUpper", "leftLower", "rightUpper", "rightLower"],
  8: ["topLeft", "topMidLeft", "topMidRight", "topRight", "leftUpper", "leftLower", "rightUpper", "rightLower"],
  9: ["topLeft", "topMidLeft", "topCenter", "topMidRight", "topRight", "leftUpper", "leftLower", "rightUpper", "rightLower"],
  10: ["topLeft", "topMidLeft", "topCenter", "topMidRight", "topRight", "leftUpper", "leftLower", "rightUpper", "rightLower", "bottomCenter"],
};

export const RESTORATION_BASES = [
  "/restoration/king-throne.webp",
  "/restoration/king-family.webp",
  "/restoration/king-banquet.webp",
] as const;

export function restorationLayout(playerCount: number): RestorationSlot[] {
  const count = Math.max(3, Math.min(10, Math.round(playerCount)));
  return (LAYOUT_IDS[count] ?? LAYOUT_IDS[3]).map((id) => SLOTS[id]);
}

export function restorationBase(matchNumber: number): string {
  return RESTORATION_BASES[(Math.max(1, matchNumber) - 1) % RESTORATION_BASES.length];
}

