import type { DrawingOperation, DrawingPoint, DrawingSize, DrawingTool } from "./drawing-studio";

export type EditorTool = DrawingTool | "pan" | "select";
export const EDITOR_TOOLS: readonly EditorTool[] = ["pen", "eraser", "fill", "line", "rectangle", "ellipse", "select", "pan"];
export const OTHER_TOOLS: readonly EditorTool[] = ["spray"];
export const ALL_EDITOR_TOOLS: readonly EditorTool[] = [...EDITOR_TOOLS, ...OTHER_TOOLS];
export function toolAllowed(restriction: string | undefined, tool: EditorTool): boolean {
  if (tool === "pan") return true;
  if (restriction === "circles") return tool === "ellipse";
  if (restriction === "lines") return tool === "line";
  if (restriction === "no-erase") return !["eraser", "fill", "select"].includes(tool);
  if (restriction === "giant-brush") return tool === "pen";
  return restriction !== "no-fill" || tool !== "fill";
}
export function defaultTool(restriction?: string): EditorTool { return restriction === "circles" ? "ellipse" : restriction === "lines" ? "line" : "pen"; }
export function colorAllowed(restriction: string | undefined, color: string): boolean {
  if (!/^#[\da-f]{6}$/i.test(color)) return false;
  if (restriction === "limited-palette") return ["#111a39", "#ff6f61", "#ffd84b"].includes(color.toLowerCase());
  return restriction !== "no-erase" || ![1, 3, 5].every((offset) => parseInt(color.slice(offset, offset + 2), 16) >= 230);
}
export function operationAllowed(restriction: string | undefined, operation: DrawingOperation, size?: DrawingSize): boolean {
  if (!restriction) return true;
  if (operation.type === "clear" || operation.type === "remove") return restriction !== "no-erase";
  if (operation.type === "selection") return toolAllowed(restriction, "select");
  if (restriction === "circles" && operation.type === "ellipse" && size && Math.abs(Math.abs(operation.to.x - operation.from.x) * size.width - Math.abs(operation.to.y - operation.from.y) * size.height) > .001) return false;
  const tool = operation.type === "stroke" ? operation.tool : operation.type;
  return toolAllowed(restriction, tool) && colorAllowed(restriction, operation.color)
    && (restriction !== "giant-brush" || (operation.type === "stroke" && operation.width === 48));
}
// Equal physical axes, even on a portrait document; clamp both axes together at edges.
export function circleEnd(from: DrawingPoint, to: DrawingPoint, size: DrawingSize): DrawingPoint {
  const sx = to.x < from.x ? -1 : 1; const sy = to.y < from.y ? -1 : 1;
  const diameter = Math.min(Math.max(Math.abs(to.x - from.x) * size.width, Math.abs(to.y - from.y) * size.height),
    (sx > 0 ? 1 - from.x : from.x) * size.width, (sy > 0 ? 1 - from.y : from.y) * size.height);
  return { x: from.x + sx * diameter / size.width, y: from.y + sy * diameter / size.height };
}
export type Position = { x: number; y: number };
export type ViewTransform = { zoom: number; pan: Position };
export type Pinch = { center: Position; distance: number; view: ViewTransform; origin: Position };
export function beginPinch(a: Position, b: Position, view: ViewTransform, origin: Position): Pinch {
  return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), view, origin };
}
export function movePinch(start: Pinch, a: Position, b: Position): ViewTransform {
  const zoom = Math.max(.5, Math.min(4, start.view.zoom * Math.hypot(a.x - b.x, a.y - b.y) / start.distance));
  const ratio = zoom / start.view.zoom;
  return { zoom, pan: { x: (a.x + b.x) / 2 - start.origin.x - (start.center.x - start.origin.x - start.view.pan.x) * ratio,
    y: (a.y + b.y) / 2 - start.origin.y - (start.center.y - start.origin.y - start.view.pan.y) * ratio } };
}

export type SelectionRect = { x: number; y: number; width: number; height: number };
export type SelectionPixels = { width: number; height: number; runs: number[] };
export type SelectionTransform = SelectionRect & { rotation: number };
export function selectionRect(a: DrawingPoint, b: DrawingPoint, size: DrawingSize): SelectionRect {
  const x = Math.floor(Math.min(a.x, b.x) * size.width); const y = Math.floor(Math.min(a.y, b.y) * size.height);
  return { x: Math.min(x, size.width - 1), y: Math.min(y, size.height - 1),
    width: Math.max(1, Math.ceil(Math.max(a.x, b.x) * size.width) - x), height: Math.max(1, Math.ceil(Math.max(a.y, b.y) * size.height) - y) };
}
// Run-length RGBA keeps transparent selections synchronous, serializable and independent of browser image decoding.
export function encodeSelection(data: Uint8ClampedArray, width: number, height: number): SelectionPixels {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 1024 || height > 1024 || data.length !== width * height * 4) throw new Error("Invalid selection pixels");
  // Remove paper reachable from the crop edge; enclosed white details remain opaque.
  const paper = new Uint8Array(width * height); const queue = new Uint32Array(width * height);
  let head = 0; let tail = 0;
  const visit = (pixel: number) => {
    const i = pixel * 4;
    if (paper[pixel] || data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return;
    paper[pixel] = 1; queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const pixel = queue[head++]; const x = pixel % width;
    if (x > 0) visit(pixel - 1); if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width); if (pixel < width * (height - 1)) visit(pixel + width);
  }
  const runs: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const white = paper[i / 4];
    const rgba = white ? 0 : ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
    if (runs.length && runs[runs.length - 1] === rgba) runs[runs.length - 2] += 1;
    else runs.push(1, rgba);
    if (runs.length > 200_000) throw new Error("This selection is too detailed. Select a smaller area.");
  }
  return { width, height, runs };
}
export function decodeSelection(pixels: SelectionPixels): Uint8ClampedArray {
  if (!Number.isInteger(pixels.width) || !Number.isInteger(pixels.height) || pixels.width < 1 || pixels.height < 1 || pixels.width > 1024 || pixels.height > 1024 || pixels.runs.length % 2 || pixels.runs.length > 200_000) throw new Error("Invalid selection buffer");
  let count = 0;
  for (let i = 0; i < pixels.runs.length; i += 2) {
    const length = pixels.runs[i]; const rgba = pixels.runs[i + 1];
    if (!Number.isInteger(length) || length <= 0 || !Number.isInteger(rgba) || rgba < 0 || rgba > 0xffffffff) throw new Error("Invalid selection run");
    count += length;
  }
  if (count !== pixels.width * pixels.height) throw new Error("Invalid selection length");
  const data = new Uint8ClampedArray(pixels.width * pixels.height * 4); let index = 0;
  for (let i = 0; i < pixels.runs.length; i += 2) {
    const rgba = pixels.runs[i + 1];
    for (let n = 0; n < pixels.runs[i]; n++) { data[index++] = rgba >>> 24; data[index++] = (rgba >>> 16) & 255; data[index++] = (rgba >>> 8) & 255; data[index++] = rgba & 255; }
  }
  return data;
}
export function selectionContains(transform: SelectionTransform, point: Position): boolean {
  const angle = -transform.rotation * Math.PI / 180;
  const dx = point.x - transform.x; const dy = point.y - transform.y;
  return Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle)) <= transform.width / 2
    && Math.abs(dx * Math.sin(angle) + dy * Math.cos(angle)) <= transform.height / 2;
}

export function starterOperations(starter?: string): DrawingOperation[] {
  const color = "#111A39"; const width = 5;
  const line = (x: number, y: number, a: number, b: number): DrawingOperation => ({ type: "line", color, width, from: { x, y }, to: { x: a, y: b } });
  const path = (points: number[][]): DrawingOperation[] => points.slice(1).map((p, i) => line(points[i][0], points[i][1], p[0], p[1]));
  switch (starter) {
    case "sword": return [...path([[.5,.18],[.57,.29],[.53,.62],[.47,.62],[.43,.29],[.5,.18]]), line(.36,.64,.64,.64), line(.5,.65,.5,.8)];
    case "shield": return path([[.3,.25],[.7,.25],[.67,.58],[.5,.77],[.33,.58],[.3,.25]]);
    case "crown": return path([[.27,.62],[.23,.32],[.4,.46],[.5,.25],[.6,.46],[.77,.32],[.73,.62],[.27,.62]]);
    case "person": return [{ type: "ellipse", color, width, from: { x: .43, y: .2 }, to: { x: .57, y: .34 } }, line(.5,.34,.5,.6), line(.3,.42,.7,.42), line(.5,.6,.35,.8), line(.5,.6,.65,.8)];
    case "dragon": return [...path([[.2,.65],[.35,.57],[.43,.42],[.52,.48],[.64,.3],[.79,.3],[.72,.4],[.65,.42],[.6,.63],[.42,.68],[.2,.65]]), ...path([[.43,.42],[.32,.24],[.57,.34],[.52,.48]]), line(.45,.68,.4,.78), line(.58,.65,.64,.76)];
    default: return [];
  }
}
