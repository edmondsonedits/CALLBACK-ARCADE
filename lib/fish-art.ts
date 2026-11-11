import { z } from "zod";
import { floodFill, paintSprayCached, paintSprayStyleCached } from "./drawing-studio";
import { drawingToPngBlob } from "./drawing-export";

export const FISH_ARTBOARD = { width: 1024, height: 768 } as const;
export const FISH_MAX_PARTS = 16;
export const FISH_MAX_PNG_BYTES = 3 * 1024 * 1024;
export const FISH_BASE_COLOR = "#FFF4D6";
export const FISH_TEMPLATE = {
  id: "friendly-right-v1", head: { x: 820, y: 384 }, body: { x: 548, y: 384 }, tail: { x: 164, y: 384 },
  bounds: { x: 164, y: 228, width: 656, height: 312 },
} as const;
const Point = z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).strict();
const Color = z.string().regex(/^#[0-9a-f]{6}$/i);
const Stroke = z.object({ kind: z.literal("stroke"), tool: z.enum(["pen", "eraser"]), color: Color, size: z.number().min(1).max(64), opacity: z.number().min(0.05).max(1).optional(), points: z.array(Point).min(1).max(1200) }).strict();
const Spray = z.object({ kind: z.literal("spray"), color: Color, size: z.number().min(2).max(160), opacity: z.number().min(0.05).max(1), style: z.literal("mist-v1").optional(), points: z.array(Point).min(1).max(1200) }).strict()
  .refine(value => value.style === "mist-v1" || value.size <= 96);
const Fill = z.object({ kind: z.literal("fill"), color: Color, point: Point }).strict();
const Paint = z.discriminatedUnion("kind", [Stroke, Spray, Fill]);
const Part = z.object({
  id: z.string().min(1).max(80), shape: z.enum(["ellipse", "triangle", "rectangle", "freeform"]), color: Color,
  x: z.number().finite().min(16).max(1008), y: z.number().finite().min(16).max(752),
  width: z.number().finite().min(24).max(300), height: z.number().finite().min(24).max(300), rotation: z.number().finite().min(-180).max(180),
  behind: z.boolean(), root: z.object({ x: z.number().finite().min(164).max(820), y: z.number().finite().min(228).max(540) }).strict(),
  points: z.array(Point).min(3).max(600).optional(), paint: z.array(Paint).max(180),
}).strict();
const Fish = z.object({ version: z.union([z.literal(1), z.literal(2)]), template: z.enum(["fish", "blank"]).default("fish"), body: z.array(Paint).max(500), free: z.array(Paint).max(500).default([]), legacyBase: z.array(Paint).max(500).optional(), parts: z.array(Part).max(FISH_MAX_PARTS) }).strict().refine(value => {
  const operations = [...value.body, ...value.free, ...(value.legacyBase ?? []), ...value.parts.flatMap(part => part.paint)];
  return operations.length <= 500 && operations.reduce((sum, op) => sum + (op.kind === "stroke" || op.kind === "spray" ? op.points.length : 1), 0) <= 50_000
    && new Set(value.parts.map(part => part.id)).size === value.parts.length
    && value.parts.every(part => part.shape !== "freeform" || Boolean(part.points));
});
export type FishPoint = z.infer<typeof Point>;
export type FishPaint = z.infer<typeof Paint>;
export type FishPart = z.infer<typeof Part>;
export type FishShape = FishPart["shape"];
export type FishDocument = z.infer<typeof Fish>;
export type ArtPoint = { x: number; y: number };
export function emptyFishDocument(template: FishDocument["template"] = "fish"): FishDocument { return { version: 2, template, body: [], free: [], parts: [] }; }
export function fishHasArtwork(fish: FishDocument): boolean { return fish.body.length > 0 || fish.free.length > 0 || Boolean(fish.legacyBase?.length) || fish.parts.length > 0; }
export function upgradeFishDocument(fish: FishDocument): FishDocument {
  if (fish.version === 2) return fish;
  if (fish.template === "blank" && fish.body.length) {
    if (!fish.free.length) return { ...fish, version: 2, free: fish.body, body: [] };
    return { ...fish, version: 2, legacyBase: fish.body, body: [] };
  }
  return { ...fish, version: 2 };
}
export function parseFishDraft(value: string | null): FishDocument | null {
  if (!value || value.length > 2_000_000) return null;
  try { const result = Fish.safeParse(JSON.parse(value)); return result.success ? upgradeFishDocument(result.data) : null; } catch { return null; }
}
export function validFishDocument(value: FishDocument): boolean { return Fish.safeParse(value).success; }
export function snapFishAttachment(point: ArtPoint): ArtPoint {
  const dx = (point.x - 548) / 266; const dy = (point.y - 384) / 156;
  const distance = Math.max(1, Math.hypot(dx, dy));
  return { x: 548 + dx / distance * 266, y: 384 + dy / distance * 156 };
}
export function constrainFishPart(part: FishPart): FishPart {
  const width = Math.max(24, Math.min(300, part.width)); const height = Math.max(24, Math.min(300, part.height));
  const rotation = ((part.rotation + 540) % 360) - 180; const angle = rotation * Math.PI / 180;
  const rx = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
  const ry = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / 2;
  const x = Math.max(16 + rx, Math.min(1008 - rx, part.x)); const y = Math.max(16 + ry, Math.min(752 - ry, part.y));
  return { ...part, x, y, width, height, rotation, root: snapFishAttachment({ x, y }) };
}
export function makeFishPart(shape: FishShape, color: string, id: string): FishPart {
  return constrainFishPart({ id, shape, color, x: shape === "triangle" ? 465 : 665, y: shape === "triangle" ? 235 : 330, width: shape === "ellipse" ? 90 : 160, height: shape === "ellipse" ? 90 : 130, rotation: 0, behind: shape === "triangle", root: { x: 548, y: 384 }, paint: [], ...(shape === "freeform" ? { points: [{ x: .5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] } : {}) });
}
export function fishPartPoint(part: FishPart, point: ArtPoint): FishPoint {
  const angle = -part.rotation * Math.PI / 180; const dx = point.x - part.x; const dy = point.y - part.y;
  return { x: (dx * Math.cos(angle) - dy * Math.sin(angle)) / part.width + .5, y: (dx * Math.sin(angle) + dy * Math.cos(angle)) / part.height + .5 };
}
export function fishPartContains(part: FishPart, point: ArtPoint): boolean {
  const p = fishPartPoint(part, point); return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
}
/** Transparent pixels are never a bucket target. White is real artwork, not a cutout key. */
export function fillFishPixels(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: string): boolean {
  const px = Math.floor(x); const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width || py >= height || data[(py * width + px) * 4 + 3] < 200) return false;
  const alpha = new Uint8ClampedArray(width * height); for (let pixel = 0; pixel < alpha.length; pixel++) alpha[pixel] = data[pixel * 4 + 3];
  const filled = floodFill(data, width, height, px, py, color, Math.min(2, Math.floor(Math.min(width, height) / 64)));
  if (filled) for (let pixel = 0; pixel < alpha.length; pixel++) if (alpha[pixel] > 0) data[pixel * 4 + 3] = alpha[pixel];
  return filled;
}
export function traceFishBody(context: CanvasRenderingContext2D): void {
  context.beginPath(); context.moveTo(820, 384);
  context.bezierCurveTo(797, 282, 690, 228, 548, 228);
  context.bezierCurveTo(427, 228, 338, 282, 292, 347);
  context.lineTo(164, 275); context.quadraticCurveTo(189, 384, 164, 493); context.lineTo(292, 421);
  context.bezierCurveTo(338, 486, 427, 540, 548, 540);
  context.bezierCurveTo(690, 540, 797, 486, 820, 384); context.closePath();
}
function tracePart(context: CanvasRenderingContext2D, part: FishPart): void {
  const { width, height } = context.canvas; context.beginPath();
  if (part.shape === "ellipse") context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  else if (part.shape === "rectangle") context.roundRect(0, 0, width, height, Math.min(width, height) * .18);
  else {
    const points = part.shape === "freeform" ? part.points! : [{ x: .5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    context.moveTo(points[0].x * width, points[0].y * height);
    for (const point of points.slice(1)) context.lineTo(point.x * width, point.y * height);
    context.closePath();
  }
}
function paintLayer(context: CanvasRenderingContext2D, operations: FishPaint[], baseColor: string, trace: () => void, clip = true): void {
  const { width, height } = context.canvas;
  for (const op of operations) {
    if (op.kind === "fill") {
      const image = context.getImageData(0, 0, width, height);
      if (fillFishPixels(image.data, width, height, op.point.x * width, op.point.y * height, op.color)) context.putImageData(image, 0, 0);
      continue;
    }
    context.save(); if (clip) { trace(); context.clip(); } context.beginPath();
    if (op.kind === "spray") {
      const mist = op.style === "mist-v1";
      const radius = op.size / 2; const density = mist ? 120 : Math.max(16, Math.min(48, Math.round(op.size * 0.6)));
      if (mist) paintSprayStyleCached(context, op, op.points, op.color, op.opacity, radius, density, "mist-v1");
      else paintSprayCached(context, op, op.points, op.color, op.opacity, radius, density);
      context.restore(); continue;
    }
    context.globalCompositeOperation = !clip && op.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = context.fillStyle = op.tool === "eraser" ? (clip ? baseColor : "#000000") : op.color;
    context.globalAlpha *= op.opacity ?? 1;
    context.lineWidth = op.size; context.lineCap = "round"; context.lineJoin = "round";
    const [first, ...points] = op.points;
    if (!points.length) { context.arc(first.x * width, first.y * height, op.size / 2, 0, Math.PI * 2); context.fill(); }
    else { context.moveTo(first.x * width, first.y * height); for (const point of points) context.lineTo(point.x * width, point.y * height); context.stroke(); }
    context.restore();
  }
}
/** Paint one non-mutating tool stamp for the editor cursor, using the same renderer as saved strokes. */
export function renderFishToolPreview(context: CanvasRenderingContext2D, operation: FishPaint, fish: FishDocument, target: "body" | "free"): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.save(); context.scale(context.canvas.width / 1024, context.canvas.height / 768);
  paintLayer(context, [operation], FISH_BASE_COLOR, () => {}, false);
  if (target === "body") {
    const mask = browserSurface(1024, 768); const maskContext = mask.getContext("2d");
    if (maskContext) {
      if (fish.template !== "blank") { traceFishBody(maskContext); maskContext.fillStyle = FISH_BASE_COLOR; maskContext.fill(); }
      if (fish.legacyBase) paintLayer(maskContext, fish.legacyBase, FISH_BASE_COLOR, () => {}, false);
      if (fish.free.length) { const additions = browserSurface(1024, 768); const addContext = additions.getContext("2d"); if (addContext) { paintLayer(addContext, fish.free, FISH_BASE_COLOR, () => {}, false); maskContext.drawImage(additions, 0, 0); } }
      context.globalCompositeOperation = "destination-in"; context.drawImage(mask, 0, 0);
    }
  }
  context.restore();
}
export type FishSurfaceFactory = (width: number, height: number) => HTMLCanvasElement;
const browserSurface: FishSurfaceFactory = (width, height) => { const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; return canvas; };
type LayerCache = { bodyTemplate?: FishDocument["template"]; bodyOperations?: FishPaint[]; bodyAdditions?: FishPaint[]; legacyBase?: FishPaint[]; body?: HTMLCanvasElement; parts: Map<FishPart, HTMLCanvasElement>; workingPart?: HTMLCanvasElement };
const layerCaches = new WeakMap<FishSurfaceFactory, LayerCache>();
function bodyLayer(fish: FishDocument, createSurface: FishSurfaceFactory): HTMLCanvasElement {
  const body = createSurface(1024, 768); const context = body.getContext("2d");
  if (!context) throw new Error("Your browser could not open the fish canvas.");
  if (fish.template !== "blank") { traceFishBody(context); context.fillStyle = FISH_BASE_COLOR; context.fill(); }
  if (fish.legacyBase) paintLayer(context, fish.legacyBase, FISH_BASE_COLOR, () => {}, false);
  if (fish.free.length) {
    const additions = createSurface(1024, 768); const addContext = additions.getContext("2d");
    if (!addContext) throw new Error("The transparent body layer is unavailable.");
    paintLayer(addContext, fish.free, FISH_BASE_COLOR, () => {}, false); context.drawImage(additions, 0, 0);
  }
  const overlay = createSurface(1024, 768); const overlayContext = overlay.getContext("2d");
  if (!overlayContext) throw new Error("The Draw paint layer is unavailable.");
  for (const operation of fish.body) {
    if (operation.kind !== "fill") { paintLayer(overlayContext, [operation], FISH_BASE_COLOR, () => {}, false); continue; }
    const visible = createSurface(1024, 768); const visibleContext = visible.getContext("2d");
    if (!visibleContext) throw new Error("The fill preview layer is unavailable.");
    visibleContext.drawImage(body, 0, 0); visibleContext.globalCompositeOperation = "source-atop"; visibleContext.drawImage(overlay, 0, 0);
    const before = visibleContext.getImageData(0, 0, 1024, 768); paintLayer(visibleContext, [operation], FISH_BASE_COLOR, () => {}, false);
    const after = visibleContext.getImageData(0, 0, 1024, 768); const patch = createSurface(1024, 768); const patchContext = patch.getContext("2d");
    if (!patchContext) throw new Error("The fill overlay is unavailable.");
    const changed = patchContext.createImageData(1024, 768); const red = Number.parseInt(operation.color.slice(1, 3), 16); const green = Number.parseInt(operation.color.slice(3, 5), 16); const blue = Number.parseInt(operation.color.slice(5, 7), 16);
    for (let offset = 0; offset < after.data.length; offset += 4) if (after.data[offset + 3] && (after.data[offset] !== before.data[offset] || after.data[offset + 1] !== before.data[offset + 1] || after.data[offset + 2] !== before.data[offset + 2])) { changed.data[offset] = red; changed.data[offset + 1] = green; changed.data[offset + 2] = blue; changed.data[offset + 3] = 255; }
    patchContext.putImageData(changed, 0, 0); overlayContext.drawImage(patch, 0, 0);
  }
  context.save(); context.globalCompositeOperation = "source-atop"; context.drawImage(overlay, 0, 0); context.restore();
  return body;
}
/** Compositing order is rear parts → opaque masked body + clipped paint → front parts.
 * Keep only the current committed layers cached; undo history must not retain canvas buffers.
 */
export function renderFish(context: CanvasRenderingContext2D, fish: FishDocument, createSurface: FishSurfaceFactory = browserSurface, provisional?: { target: string; operation: FishPaint }): void {
  let cache = layerCaches.get(createSurface);
  if (!cache) { cache = { parts: new Map() }; layerCaches.set(createSurface, cache); }
  if (!cache.body || cache.bodyTemplate !== fish.template || cache.bodyOperations !== fish.body || cache.bodyAdditions !== fish.free || cache.legacyBase !== fish.legacyBase) {
    cache.body = bodyLayer(fish, createSurface); cache.bodyTemplate = fish.template; cache.bodyOperations = fish.body; cache.bodyAdditions = fish.free; cache.legacyBase = fish.legacyBase;
  }
  let body = cache.body;
  if (provisional && ["body", "free"].includes(provisional.target)) body = bodyLayer({ ...fish, ...(provisional.target === "body" ? { body: [...fish.body, provisional.operation] } : { free: [...fish.free, provisional.operation] }) }, createSurface);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.save(); context.scale(context.canvas.width / 1024, context.canvas.height / 768);
  const drawPart = (part: FishPart) => {
    let surface = cache.parts.get(part);
    if (!surface) {
      surface = createSurface(Math.max(24, Math.ceil(part.width)), Math.max(24, Math.ceil(part.height)));
      const target = surface.getContext("2d"); if (!target) throw new Error("Your browser could not open an added part.");
      tracePart(target, part); target.fillStyle = part.color; target.fill();
      paintLayer(target, part.paint, part.color, () => tracePart(target, part));
      target.save(); target.globalCompositeOperation = "destination-in"; tracePart(target, part); target.fill(); target.restore();
      cache.parts.set(part, surface);
    }
    if (provisional?.target === part.id) {
      if (!cache.workingPart || cache.workingPart.width !== surface.width || cache.workingPart.height !== surface.height) cache.workingPart = createSurface(surface.width, surface.height);
      const target = cache.workingPart.getContext("2d"); if (!target) throw new Error("The part brush canvas is unavailable.");
      target.clearRect(0, 0, surface.width, surface.height); target.drawImage(surface, 0, 0);
      paintLayer(target, [provisional.operation], part.color, () => tracePart(target, part)); surface = cache.workingPart;
    }
    context.save(); context.translate(part.x, part.y); context.rotate(part.rotation * Math.PI / 180);
    context.drawImage(surface, -part.width / 2, -part.height / 2, part.width, part.height); context.restore();
  };
  fish.parts.filter(part => part.behind).forEach(drawPart);
  context.drawImage(body, 0, 0);
  fish.parts.filter(part => !part.behind).forEach(drawPart);
  context.restore();
  const currentParts = new Set(fish.parts); for (const part of cache.parts.keys()) if (!currentParts.has(part)) cache.parts.delete(part);
}

export async function exportFishPng(fish: FishDocument): Promise<Blob> {
  if (!validFishDocument(fish) || !fishHasArtwork(fish)) throw new Error("Add a colour or a part to make this fish yours.");
  const canvas = browserSurface(1024, 768); const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare the fish. Your draft is saved.");
  renderFish(context, fish); const blob = await drawingToPngBlob(canvas);
  if (blob.size > FISH_MAX_PNG_BYTES) throw new Error("This fish is too detailed to send. Undo a few marks and try again.");
  return blob;
}
/** Same strip deformation can be used in the editor and aquarium; source pixels stay intact. */
export function drawSwimmingFish(context: CanvasRenderingContext2D, image: CanvasImageSource, time: number, box: { x: number; y: number; width: number; height: number; reducedMotion?: boolean }): void {
  const strips = box.reducedMotion ? 1 : 48;
  for (let index = 0; index < strips; index++) {
    const u = index / strips; const sw = 1024 / strips;
    const tail = Math.max(0, 1 - u * 1.18); const wave = box.reducedMotion ? 0 : Math.sin(time * 4.5 - u * 7) * tail * tail * box.height * .045;
    context.drawImage(image, u * 1024, 0, Math.min(sw + 1, 1024 - u * 1024), 768, box.x + u * box.width, box.y + wave, box.width / strips + .6, box.height);
  }
}
