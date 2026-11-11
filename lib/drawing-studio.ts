import { z } from "zod";
import { decodeSelection } from "./drawing-editor";

export const DRAWING_SIZE = 1024;
export const DRAWING_PROMPT_MAX_LENGTH = 240;
export const DRAWING_DRAFT_KEY = "callback:drawing-studio:v1";
export const DRAWING_COLORS = ["#111A39", "#FFFFFF", "#FF6F61", "#FFA63D", "#FFD84B", "#33B88C", "#529AFF", "#9C7CFF"] as const;
export type DrawingTool = "pen" | "eraser" | "fill" | "line" | "rectangle" | "ellipse" | "spray";
const PointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict();
export type DrawingPoint = z.infer<typeof PointSchema>;
const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
const Style = { color: ColorSchema, width: z.number().min(1).max(48) };
const SelectionRectSchema = z.object({ x: z.number().min(0).max(1024), y: z.number().min(0).max(1024), width: z.number().min(1).max(1024), height: z.number().min(1).max(1024) }).strict();
const SelectionPixelsSchema = z.object({ width: z.number().int().min(1).max(1024), height: z.number().int().min(1).max(1024), runs: z.array(z.number().int().min(0).max(0xffffffff)).min(2).max(200_000) }).strict().refine((p) => {
  if (p.runs.length % 2) return false;
  let total = 0; for (let i = 0; i < p.runs.length; i += 2) { if (!p.runs[i]) return false; total += p.runs[i]; }
  return total === p.width * p.height;
});
const OperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stroke"), tool: z.enum(["pen", "eraser"]), ...Style, points: z.array(PointSchema).min(1).max(3000) }).strict(),
  z.object({ type: z.literal("spray"), color: ColorSchema, width: z.number().min(2).max(96), opacity: z.number().min(0.05).max(1), points: z.array(PointSchema).min(1).max(3000) }).strict(),
  z.object({ type: z.enum(["line", "rectangle", "ellipse"]), ...Style, from: PointSchema, to: PointSchema }).strict(),
  z.object({ type: z.literal("fill"), color: ColorSchema, point: PointSchema, gap: z.number().int().min(0).max(6).optional() }).strict(),
  z.object({ type: z.literal("clear") }).strict(),
  z.object({ type: z.literal("remove"), source: SelectionRectSchema }).strict(),
  z.object({ type: z.literal("selection"), source: SelectionRectSchema.optional(), pixels: SelectionPixelsSchema,
    transform: z.object({ x: z.number().min(-4096).max(4096), y: z.number().min(-4096).max(4096), width: z.number().min(1).max(4096), height: z.number().min(1).max(4096), rotation: z.number().min(-360).max(360) }).strict() }).strict(),
]);
export type DrawingOperation = z.infer<typeof OperationSchema>;
export type SelectionOperation = Extract<DrawingOperation, { type: "selection" }>;
const SizeSchema = z.object({ width: z.number().int().min(1).max(DRAWING_SIZE), height: z.number().int().min(1).max(DRAWING_SIZE) }).strict();
export type DrawingSize = z.infer<typeof SizeSchema>;
const DocumentSchema = z.object({ version: z.literal(1), size: SizeSchema.optional(), prompt: z.string().trim().min(1).max(DRAWING_PROMPT_MAX_LENGTH).optional(), operations: z.array(OperationSchema).max(251), cursor: z.number().int().min(0) }).strict()
  .refine((value) => value.cursor <= value.operations.length)
  .refine((value) => value.operations.reduce((count, op) => count + (op.type === "stroke" || op.type === "spray" ? op.points.length : 0), 0) <= 30_000);
export type DrawingDocument = z.infer<typeof DocumentSchema>;

type SprayPoint = { x: number; y: number };
export type SprayStyle = "legacy" | "mist-v1";
type SprayScratch = { operation: object; style: SprayStyle; surface: HTMLCanvasElement; context: CanvasRenderingContext2D; points: number; width: number; height: number; radius: number; density: number; color: string; opacity: number; factory?: (width: number, height: number) => HTMLCanvasElement };
const sprayScratchByContext = new WeakMap<CanvasRenderingContext2D, SprayScratch>();

function drawSprayDabs(context: CanvasRenderingContext2D, points: readonly SprayPoint[], start: number, color: string, opacity: number, radius: number, density: number, width: number, height: number): void {
  context.save(); context.fillStyle = color;
  const inheritedAlpha = context.globalAlpha;
  const channels = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
  const rgba = (alpha: number) => `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  for (let pointIndex = start; pointIndex < points.length; pointIndex += 1) {
    const point = points[pointIndex]!;
    const centerX = point.x * width; const centerY = point.y * height;
    // A low-opacity soft dab makes the brush read as paint after phone-scale downsampling.
    // Fine randomized particles remain visible over it and keep the airbrushed grain.
    const coreRadius = Math.max(1, radius * 0.58);
    const core = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
    core.addColorStop(0, rgba(0.42)); core.addColorStop(0.24, rgba(0.34)); core.addColorStop(0.62, rgba(0.09)); core.addColorStop(1, rgba(0));
    context.globalAlpha = inheritedAlpha * opacity;
    context.fillStyle = core; context.beginPath(); context.arc(centerX, centerY, coreRadius, 0, Math.PI * 2); context.fill();
    context.fillStyle = color;
    let seed = (pointIndex + 1) * 2654435761 >>> 0;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < density; i += 1) {
      const angle = random() * Math.PI * 2;
      const distanceRatio = random() ** 1.4;
      const distance = distanceRatio * radius;
      // Fine grain stays small relative to the cloud while surviving mobile downsampling.
      const dot = 0.55 + random() * 0.65;
      // Keep the center rich while alpha fades smoothly into the cloud edge.
      context.globalAlpha = inheritedAlpha * opacity * (0.12 + 0.88 * (1 - distanceRatio) ** 1.35);
      context.beginPath(); context.arc(point.x * width + Math.cos(angle) * distance, point.y * height + Math.sin(angle) * distance, dot, 0, Math.PI * 2); context.fill();
    }
  }
  context.restore();
}

/** Keep one reusable spray raster per destination context; new pointer samples are rasterized once. */
export function paintSprayCached(context: CanvasRenderingContext2D, operation: object, points: readonly SprayPoint[], color: string, opacity: number, radius: number, density: number, createSurface?: (width: number, height: number) => HTMLCanvasElement): void {
  const width = context.canvas.width; const height = context.canvas.height;
  const factory = createSurface ?? ((w, h) => {
    const owner = context.canvas.ownerDocument ?? (typeof document !== "undefined" ? document : undefined);
    if (!owner) throw new Error("A canvas surface is unavailable.");
    const surface = owner.createElement("canvas"); surface.width = w; surface.height = h; return surface;
  });
  let cached = sprayScratchByContext.get(context);
  if (!cached) {
    let surface: HTMLCanvasElement;
    try { surface = factory(width, height); } catch { drawSprayDabs(context, points, 0, color, opacity, radius, density, width, height); return; }
    const scratch = surface.getContext("2d");
    if (!scratch) { drawSprayDabs(context, points, 0, color, opacity, radius, density, width, height); return; }
    cached = { operation, style: "legacy", surface, context: scratch, points: 0, width, height, radius, density, color, opacity, factory: createSurface };
    sprayScratchByContext.set(context, cached);
  }
  const reset = cached.style !== "legacy" || cached.operation !== operation || points.length < cached.points || cached.width !== width || cached.height !== height
    || cached.radius !== radius || cached.density !== density || cached.color !== color || cached.opacity !== opacity || cached.factory !== createSurface;
  if (reset) {
    if (cached.width !== width || cached.height !== height) { cached.surface.width = width; cached.surface.height = height; }
    else cached.context.clearRect(0, 0, width, height);
    cached.operation = operation; cached.style = "legacy"; cached.points = 0; cached.width = width; cached.height = height;
    cached.radius = radius; cached.density = density; cached.color = color; cached.opacity = opacity; cached.factory = createSurface;
  }
  if (points.length > cached.points) {
    drawSprayDabs(cached.context, points, cached.points, color, opacity, radius, density, width, height);
    cached.points = points.length;
  }
  context.save(); context.drawImage(cached.surface, 0, 0); context.restore();
}

/** A broad, soft airbrush cloud for fish artwork. Interpolation is based on distance,
 * so fast pointer movement leaves the same connected plume as a slow stroke. */
function drawMistDabs(context: CanvasRenderingContext2D, points: readonly SprayPoint[], start: number, color: string, opacity: number, radius: number, density: number, width: number, height: number): void {
  if (!points.length) return;
  context.save();
  const inheritedAlpha = context.globalAlpha;
  const channels = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
  const rgba = (alpha: number) => `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  context.fillStyle = color;
  const spacing = Math.max(2, radius * 0.28);
  const paintDab = (x: number, y: number, index: number) => {
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, rgba(0.13)); cloud.addColorStop(0.18, rgba(0.11)); cloud.addColorStop(0.48, rgba(0.07)); cloud.addColorStop(0.78, rgba(0.025)); cloud.addColorStop(1, rgba(0));
    context.globalAlpha = inheritedAlpha * opacity;
    context.fillStyle = cloud; context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
    // Seed each interpolated dab by its stable path-segment/index identity.
    let seed = Math.imul(index + 1, 2654435761) >>> 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    context.fillStyle = color;
    for (let i = 0; i < density; i += 1) {
      const angle = random() * Math.PI * 2;
      const distanceRatio = Math.sqrt(random());
      const distance = distanceRatio * radius;
      const grain = 0.58 + random() * 0.42;
      context.globalAlpha = inheritedAlpha * opacity * 0.20 * (1 - distanceRatio) ** 1.1;
      context.beginPath(); context.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, grain, 0, Math.PI * 2); context.fill();
    }
  };
  // Initial and stationary samples still build up gently while the pointer is held.
  if (start === 0) paintDab(points[0]!.x * width, points[0]!.y * height, 0);
  const firstSegment = Math.max(1, start);
  for (let segment = firstSegment; segment < points.length; segment += 1) {
    const from = points[segment - 1]!; const to = points[segment]!;
    const dx = (to.x - from.x) * width; const dy = (to.y - from.y) * height;
    const distance = Math.hypot(dx, dy);
    // Raw pointer histories are capped by fish-art; this per segment cap also
    // bounds worst-case raster work while still overlapping at the default size.
    const steps = Math.max(1, Math.min(48, Math.ceil(distance / spacing)));
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      paintDab((from.x * width) + dx * t, (from.y * height) + dy * t, segment * 2049 + step);
    }
  }
  context.restore();
}

/** Shared versioned cache for the fish mist style; legacy callers stay byte-compatible. */
export function paintSprayStyleCached(context: CanvasRenderingContext2D, operation: object, points: readonly SprayPoint[], color: string, opacity: number, radius: number, density: number, style: SprayStyle, createSurface?: (width: number, height: number) => HTMLCanvasElement): void {
  if (style === "legacy") { paintSprayCached(context, operation, points, color, opacity, radius, density, createSurface); return; }
  const width = context.canvas.width; const height = context.canvas.height;
  const factory = createSurface ?? ((w, h) => {
    const owner = context.canvas.ownerDocument ?? (typeof document !== "undefined" ? document : undefined);
    if (!owner) throw new Error("A canvas surface is unavailable.");
    const surface = owner.createElement("canvas"); surface.width = w; surface.height = h; return surface;
  });
  let cached = sprayScratchByContext.get(context);
  if (!cached) {
    let surface: HTMLCanvasElement;
    try { surface = factory(width, height); } catch { drawMistDabs(context, points, 0, color, opacity, radius, density, width, height); return; }
    const scratch = surface.getContext("2d");
    if (!scratch) { drawMistDabs(context, points, 0, color, opacity, radius, density, width, height); return; }
    cached = { operation, style: "mist-v1", surface, context: scratch, points: 0, width, height, radius, density, color, opacity, factory: createSurface };
    sprayScratchByContext.set(context, cached);
  }
  const reset = cached.style !== "mist-v1" || cached.operation !== operation || points.length < cached.points || cached.width !== width || cached.height !== height
    || cached.radius !== radius || cached.density !== density || cached.color !== color || cached.opacity !== opacity || cached.factory !== createSurface;
  if (reset) {
    if (cached.width !== width || cached.height !== height) { cached.surface.width = width; cached.surface.height = height; }
    else cached.context.clearRect(0, 0, width, height);
    cached.operation = operation; cached.style = "mist-v1"; cached.points = 0; cached.width = width; cached.height = height;
    cached.radius = radius; cached.density = density; cached.color = color; cached.opacity = opacity; cached.factory = createSurface;
  }
  if (points.length > cached.points) {
    drawMistDabs(cached.context, points, cached.points, color, opacity, radius, density, width, height);
    cached.points = points.length;
  }
  context.save(); context.drawImage(cached.surface, 0, 0); context.restore();
}

export function emptyDrawing(size?: DrawingSize, prompt?: string): DrawingDocument { return { version: 1, ...(size ? { size } : {}), ...(prompt ? { prompt } : {}), operations: [], cursor: 0 }; }
export function drawingSize(document: DrawingDocument): DrawingSize { return document.size ?? { width: DRAWING_SIZE, height: DRAWING_SIZE }; }
export function screenDrawingSize(width: number, height: number): DrawingSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return { width: DRAWING_SIZE, height: DRAWING_SIZE };
  const scale = DRAWING_SIZE / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export function parseDraft(value: string | null): DrawingDocument | null {
  if (!value || value.length > 4_000_000) return null;
  try { const result = DocumentSchema.safeParse(JSON.parse(value)); return result.success ? result.data : null; } catch { return null; }
}
export function addOperation(document: DrawingDocument, operation: DrawingOperation): DrawingDocument {
  let operations = [...document.operations.slice(0, document.cursor), operation];
  const valid = () => (operation.type === "clear" || operations.length <= 250) && DocumentSchema.safeParse({ ...document, operations, cursor: operations.length }).success && JSON.stringify({ ...document, operations }).length <= 4_000_000;
  if (!valid()) {
    // A clear is a safe history checkpoint: older marks cannot affect the current sheet.
    // Reserve one extra clear so a full sketch can still be cleared and immediately undone.
    const checkpoint = operations.findLastIndex((item) => item.type === "clear");
    if (checkpoint < 0) return document;
    operations = operations.slice(checkpoint);
    if (!valid()) return document;
  }
  return { ...document, operations, cursor: operations.length };
}
export function undoDrawing(document: DrawingDocument): DrawingDocument { return { ...document, cursor: Math.max(0, document.cursor - 1) }; }
export function redoDrawing(document: DrawingDocument): DrawingDocument { return { ...document, cursor: Math.min(document.operations.length, document.cursor + 1) }; }

export function floodFill(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, color: string, gap = 0): boolean {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > DRAWING_SIZE || height > DRAWING_SIZE) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !/^#[0-9a-f]{6}$/i.test(color)) return false;
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height || data.length !== width * height * 4) return false;
  const start = (y * width + x) * 4;
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  const replacement = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), 255];
  const matches = (offset: number) => target.every((channel, index) => Math.abs(channel - data[offset + index]) <= 20);
  if (target.every((channel, index) => Math.abs(channel - replacement[index]) <= 20)) return false;
  // Close only the traversal barrier, never paint over the original outline.
  // The small morphological closing seals gaps while keeping larger openings open.
  let barrier: Uint8Array | null = null;
  const radius = Math.max(0, Math.min(6, Math.floor(gap)));
  if (radius) {
    barrier = new Uint8Array(width * height);
    for (let i = 0; i < barrier.length; i++) barrier[i] = matches(i * 4) ? 0 : 1;
    const filter = (source: Uint8Array, horizontal: boolean, dilate: boolean) => {
      const result = new Uint8Array(source.length);
      // Sliding sums make each separable morphology pass O(pixels), independent of gap size.
      const lines = horizontal ? height : width; const length = horizontal ? width : height;
      const stride = horizontal ? 1 : width; const windowSize = radius * 2 + 1;
      for (let line = 0; line < lines; line++) {
        const start = horizontal ? line * width : line;
        let sum = 0;
        for (let d = -radius; d <= radius; d++) sum += source[start + Math.max(0, Math.min(length - 1, d)) * stride];
        for (let position = 0; position < length; position++) {
          result[start + position * stride] = (dilate ? sum > 0 : sum === windowSize) ? 1 : 0;
          sum -= source[start + Math.max(0, position - radius) * stride];
          sum += source[start + Math.min(length - 1, position + radius + 1) * stride];
        }
      }
      return result;
    };
    barrier = filter(filter(filter(filter(barrier, true, true), false, true), true, false), false, false);
  }
  const queue = new Uint32Array(width * height);
  let head = 0; let tail = 0;
  const enqueue = (pixel: number) => {
    const offset = pixel * 4;
    if (barrier?.[pixel] || !matches(offset)) return;
    for (let index = 0; index < 4; index += 1) data[offset + index] = replacement[index];
    queue[tail++] = pixel;
  };
  enqueue(y * width + x);
  while (head < tail) {
    const pixel = queue[head++]; const column = pixel % width;
    if (column > 0) enqueue(pixel - 1);
    if (column < width - 1) enqueue(pixel + 1);
    if (pixel >= width) enqueue(pixel - width);
    if (pixel < width * (height - 1)) enqueue(pixel + width);
  }
  return tail > 0;
}

const selectionSurfaces = new WeakMap<object, HTMLCanvasElement>();

export function paintDrawingOperation(context: CanvasRenderingContext2D, op: DrawingOperation) {
  const { width, height } = context.canvas;
  if (op.type === "clear") { context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, width, height); return; }
  if (op.type === "remove" || op.type === "selection") {
    if (op.source) { context.fillStyle = "#FFFFFF"; context.fillRect(op.source.x, op.source.y, op.source.width, op.source.height); }
    if (op.type === "remove") return;
    let surface = selectionSurfaces.get(op.pixels);
    if (!surface) {
      surface = document.createElement("canvas"); surface.width = op.pixels.width; surface.height = op.pixels.height;
      const target = surface.getContext("2d"); if (!target) return;
      const image = target.createImageData(surface.width, surface.height); image.data.set(decodeSelection(op.pixels)); target.putImageData(image, 0, 0);
      selectionSurfaces.set(op.pixels, surface);
    }
    context.save(); context.translate(op.transform.x, op.transform.y); context.rotate(op.transform.rotation * Math.PI / 180);
    context.drawImage(surface, -op.transform.width / 2, -op.transform.height / 2, op.transform.width, op.transform.height); context.restore(); return;
  }
  if (op.type === "fill") {
    const image = context.getImageData(0, 0, width, height);
    if (floodFill(image.data, width, height, Math.min(width - 1, op.point.x * width), Math.min(height - 1, op.point.y * height), op.color, op.gap ?? 0)) context.putImageData(image, 0, 0);
    return;
  }
  if (op.type === "spray") {
    const radius = op.width * Math.max(width, height) / DRAWING_SIZE / 2;
    const density = Math.max(16, Math.min(48, Math.round(op.width * 0.75)));
    paintSprayCached(context, op, op.points, op.color, op.opacity, radius, density); return;
  }
  context.strokeStyle = op.type === "stroke" && op.tool === "eraser" ? "#FFFFFF" : op.color;
  context.fillStyle = context.strokeStyle;
  context.lineWidth = op.width * Math.max(width, height) / DRAWING_SIZE;
  context.lineCap = "round"; context.lineJoin = "round"; context.beginPath();
  if (op.type === "stroke") {
    const first = op.points[0];
    if (op.points.length === 1) { context.arc(first.x * width, first.y * height, context.lineWidth / 2, 0, Math.PI * 2); context.fill(); return; }
    context.moveTo(first.x * width, first.y * height);
    for (let index = 1; index < op.points.length - 1; index += 1) {
      const point = op.points[index]; const next = op.points[index + 1];
      context.quadraticCurveTo(point.x * width, point.y * height, (point.x + next.x) * width / 2, (point.y + next.y) * height / 2);
    }
    const last = op.points[op.points.length - 1]; context.lineTo(last.x * width, last.y * height);
  } else {
    const x = op.from.x * width; const y = op.from.y * height; const w = (op.to.x - op.from.x) * width; const h = (op.to.y - op.from.y) * height;
    if (op.type === "line") { context.moveTo(x, y); context.lineTo(x + w, y + h); }
    else if (op.type === "rectangle") context.rect(x, y, w, h);
    else context.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
  }
  context.stroke();
}
export function renderDrawing(context: CanvasRenderingContext2D, document: DrawingDocument) {
  context.fillStyle = "#FFFFFF"; context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  for (const operation of document.operations.slice(0, document.cursor)) paintDrawingOperation(context, operation);
}
