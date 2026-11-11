import assert from "node:assert/strict";
import test from "node:test";
import { addOperation, emptyDrawing, floodFill, paintDrawingOperation, parseDraft, redoDrawing, screenDrawingSize, undoDrawing, type DrawingOperation } from "../lib/drawing-studio";
import { DEFAULT_DRAWING_PROMPTS, DRAWING_PROMPTS, nextDrawingPrompts } from "../lib/drawing-prompts";

const stroke: DrawingOperation = { type: "stroke", tool: "pen", color: "#111A39", width: 8, points: [{ x: .1, y: .2 }, { x: .4, y: .5 }] };

test("undo and redo preserve the sketch and a new stroke replaces the redo branch", () => {
  const first = addOperation(emptyDrawing(), stroke);
  const second = addOperation(first, { type: "clear" });
  const undone = undoDrawing(second);
  assert.equal(undone.cursor, 1);
  assert.equal(redoDrawing(undone).cursor, 2);
  const branched = addOperation(undone, { ...stroke, color: "#FF6F61" });
  assert.equal(branched.operations.length, 2);
  assert.equal(branched.cursor, 2);
  assert.equal(redoDrawing(branched).cursor, 2);
  assert.equal(branched.operations[1].type === "stroke" && branched.operations[1].color, "#FF6F61");
  assert.equal(undoDrawing(emptyDrawing()).cursor, 0);
});

test("versioned drafts round-trip and reject invalid coordinates, oversized data and unknown operations", () => {
  const document = addOperation(emptyDrawing(), stroke);
  assert.deepEqual(parseDraft(JSON.stringify(document)), document);
  assert.equal(parseDraft('{"version":2,"operations":[],"cursor":0}'), null);
  assert.equal(parseDraft(JSON.stringify({ ...document, cursor: 9 })), null);
  assert.equal(parseDraft(JSON.stringify({ ...document, operations: [{ ...stroke, points: [{ x: 8, y: 0 }] }] })), null);
  assert.equal(parseDraft(JSON.stringify({ ...document, operations: [{ type: "script" }] })), null);
  assert.equal(parseDraft("x".repeat(1_000_001)), null);
});

test("fill changes only connected pixels and never wraps across row edges", () => {
  // White pixels at the end of row one and start of row two are not neighbours.
  const data = new Uint8ClampedArray([
    0,0,0,255, 255,255,255,255,
    255,255,255,255, 0,0,0,255,
  ]);
  assert.equal(floodFill(data, 2, 2, 1, 0, "#FF0000"), true);
  assert.deepEqual([...data.slice(4, 8)], [255,0,0,255]);
  assert.deepEqual([...data.slice(8, 12)], [255,255,255,255]);
  assert.equal(floodFill(data, 2, 2, 1, 0, "#FF0000"), false);
});

test("fill handles a full canvas and bounds invalid seed positions", () => {
  const data = new Uint8ClampedArray(16 * 16 * 4).fill(255);
  assert.equal(floodFill(data, 16, 16, 0, 0, "#111A39"), true);
  assert.deepEqual([...data.slice(-4)], [17,26,57,255]);
  assert.equal(floodFill(data, 16, 16, -1, 0, "#FF0000"), false);
});

test("the largest accepted high-precision sketch survives saving and reload", () => {
  const points = Array.from({ length: 3000 }, (_, index) => ({ x: index / 3001, y: (index + .123456789) / 3001 }));
  let document = emptyDrawing();
  for (let index = 0; index < 10; index += 1) document = addOperation(document, { ...stroke, points });
  assert.equal(document.operations.length, 10);
  const serialized = JSON.stringify(document);
  assert.ok(serialized.length > 1_000_000);
  const restored = parseDraft(serialized);
  assert.ok(restored, "A supported sketch must remain restorable");
  assert.deepEqual(restored, document);
});

test("clear remains undoable at capacity and a fresh sheet can accept new marks", () => {
  let document = emptyDrawing();
  for (let index = 0; index < 250; index += 1) document = addOperation(document, stroke);
  assert.equal(document.cursor, 250);
  const cleared = addOperation(document, { type: "clear" });
  assert.equal(cleared.operations[cleared.cursor - 1].type, "clear");
  assert.equal(undoDrawing(cleared).cursor, 250);
  const resumed = addOperation(cleared, stroke);
  assert.notEqual(resumed, cleared);
  assert.deepEqual(resumed.operations.slice(0, resumed.cursor), [{ type: "clear" }, stroke]);
  assert.deepEqual(parseDraft(JSON.stringify(resumed)), resumed);
});

test("screen-shaped drafts preserve their prompt and size through history and reload", () => {
  const draft = { ...emptyDrawing(), size: { width: 480, height: 1024 }, prompt: "Cat in a hat" };
  const drawn = addOperation(draft, stroke);
  const restored = parseDraft(JSON.stringify(redoDrawing(undoDrawing(drawn))));
  assert.ok(restored);
  assert.deepEqual(restored, { ...draft, operations: [stroke], cursor: 1 });
  assert.equal(parseDraft(JSON.stringify({ ...draft, size: { width: 1025, height: 1024 } })), null);
  assert.ok(parseDraft(JSON.stringify(emptyDrawing())), "Existing square drafts remain supported");
});

test("rectangular drawing and clearing use the whole canvas without stretching its coordinates", () => {
  const rectangles: number[][] = [];
  const context = { canvas: { width: 800, height: 400 }, beginPath() {}, stroke() {},
    rect: (...values: number[]) => rectangles.push(values), fillRect: (...values: number[]) => rectangles.push(values),
  } as unknown as CanvasRenderingContext2D;
  paintDrawingOperation(context, { type: "rectangle", color: "#111A39", width: 8, from: { x: .1, y: .2 }, to: { x: .5, y: .6 } });
  paintDrawingOperation(context, { type: "clear" });
  assert.deepEqual(rectangles, [[80, 80, 320, 160], [0, 0, 800, 400]]);
});

test("a new canvas matches a phone or landscape viewport at a bounded resolution", () => {
  assert.deepEqual(screenDrawingSize(320, 640), { width: 512, height: 1024 });
  assert.deepEqual(screenDrawingSize(1280, 720), { width: 1024, height: 576 });
  assert.deepEqual(screenDrawingSize(0, 720), { width: 1024, height: 1024 });
});

test("prompt refresh offers three different short ideas without repeating the previous choices", () => {
  assert.equal(new Set(DRAWING_PROMPTS).size, DRAWING_PROMPTS.length);
  assert.ok(DRAWING_PROMPTS.every((prompt) => prompt.length <= 30 && prompt.split(" ").length <= 5));
  const next = nextDrawingPrompts(DEFAULT_DRAWING_PROMPTS, () => 0);
  assert.equal(next.length, 3);
  assert.equal(new Set(next).size, 3);
  assert.ok(next.every((prompt) => !DEFAULT_DRAWING_PROMPTS.includes(prompt as typeof DRAWING_PROMPTS[number])));
});


test("a full 140-character redraw caption preserves marks through edits and draft reload", () => {
  const caption = "A".repeat(140);
  const sketch = addOperation(emptyDrawing({ width: 512, height: 1024 }, caption), stroke);
  assert.equal(sketch.cursor, 1, "Long accepted captions must not make addOperation reject all marks");
  const restored = parseDraft(JSON.stringify(redoDrawing(undoDrawing(sketch))));
  assert.ok(restored);
  assert.equal(restored.prompt, caption);
  assert.deepEqual(restored.operations, [stroke]);
  assert.ok(parseDraft(JSON.stringify({ ...sketch, prompt: "A".repeat(240) })), "Composed gameplay prompts accept up to 240 characters");
  assert.equal(parseDraft(JSON.stringify({ ...sketch, prompt: "A".repeat(241) })), null);
});
