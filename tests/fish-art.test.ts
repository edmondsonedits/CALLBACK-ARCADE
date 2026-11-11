import assert from "node:assert/strict";
import test from "node:test";
import { constrainFishPart, emptyFishDocument, fillFishPixels, fishHasArtwork, fishPartContains, FISH_ARTBOARD, FISH_TEMPLATE, makeFishPart, parseFishDraft, renderFish, snapFishAttachment } from "../lib/fish-art";

test("a fish starts blank with explicit right-facing canonical anchors", () => {
  assert.equal(fishHasArtwork(emptyFishDocument()), false);
  assert.deepEqual(FISH_ARTBOARD, { width: 1024, height: 768 });
  assert.ok(FISH_TEMPLATE.head.x > FISH_TEMPLATE.tail.x);
  assert.equal(FISH_TEMPLATE.head.y, FISH_TEMPLATE.tail.y);
  const fish = emptyFishDocument();
  fish.parts.push(makeFishPart("ellipse", "#FFFFFF", "eye"));
  assert.equal(fishHasArtwork(fish), true);
});

test("fish documents can omit the silhouette while legacy drafts retain it", () => {
  const blank = emptyFishDocument("blank");
  assert.equal(blank.template, "blank");
  assert.equal(parseFishDraft(JSON.stringify(blank))?.template, "blank");
  assert.equal(parseFishDraft(JSON.stringify({ version: 1, body: [], parts: [] }))?.template, "fish");
});

test("blank drafts keep their original paint when Draw becomes silhouette-only", () => {
  const stroke = { kind: "stroke", tool: "pen", color: "#FF0000", size: 30, points: [{ x: .5, y: .5 }] };
  const draft = { version: 1, template: "blank", body: [stroke], parts: [] };
  const upgraded = parseFishDraft(JSON.stringify(draft));
  assert.deepEqual(upgraded, { ...draft, version: 2, body: [], free: [stroke] });
  const layered = parseFishDraft(JSON.stringify({ ...draft, free: [{ ...stroke, tool: "eraser" }] }));
  assert.deepEqual(layered?.legacyBase, [stroke]);
  assert.deepEqual(layered?.body, []);
});

test("blank fish rendering leaves an empty canvas transparent without a template fill", () => {
  const fills: number[] = [];
  const createSurface = (width: number, height: number) => {
    const canvas = { width, height } as HTMLCanvasElement;
    const context = new Proxy({ canvas, fill() { fills.push(1); } }, {
      get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; },
      set(target, key, value) { Reflect.set(target, key, value); return true; },
    }) as unknown as CanvasRenderingContext2D;
    canvas.getContext = (() => context) as unknown as typeof canvas.getContext;
    return canvas;
  };
  const destination = createSurface(1024, 768);
  renderFish(destination.getContext("2d")!, emptyFishDocument("blank"), createSurface);
  assert.equal(fills.length, 0);
});

test("body bucket preserves transparent exterior and intentional white detail", () => {
  const data = new Uint8ClampedArray(7 * 3 * 4);
  for (let y = 0; y < 3; y++) for (let x = 1; x < 6; x++) data.set([255, 255, 255, 255], (y * 7 + x) * 4);
  for (let y = 0; y < 3; y++) data.set([17, 26, 57, 255], (y * 7 + 3) * 4);
  assert.equal(fillFishPixels(data, 7, 3, 1, 1, "#FFD84B"), true);
  assert.deepEqual([...data.slice((7 + 1) * 4, (7 + 2) * 4)], [255, 216, 75, 255]);
  assert.deepEqual([...data.slice((7 + 4) * 4, (7 + 5) * 4)], [255, 255, 255, 255]);
  assert.deepEqual([...data.slice(7 * 4, 8 * 4)], [0, 0, 0, 0]);
  assert.equal(fillFishPixels(data, 7, 3, 0, 1, "#FF6F61"), false);
});

test("body bucket keeps existing alpha instead of making faint Body additions opaque", () => {
  const data = new Uint8ClampedArray(2 * 2 * 4);
  for (let pixel = 0; pixel < 4; pixel++) data.set([255, 0, 0, 220], pixel * 4);
  assert.equal(fillFishPixels(data, 2, 2, 0, 0, "#0000FF"), true);
  assert.deepEqual([...data.slice(0, 4)], [0, 0, 255, 220]);
});

test("rotated accessories retain their whole bounds and attachment root inside the artboard", () => {
  const original = makeFishPart("rectangle", "#FF6F61", "hat");
  const part = constrainFishPart({ ...original, x: 1010, y: -40, width: 1000, height: 500, rotation: 41 });
  const angle = part.rotation * Math.PI / 180;
  for (const dx of [-part.width / 2, part.width / 2]) for (const dy of [-part.height / 2, part.height / 2]) {
    const x = part.x + dx * Math.cos(angle) - dy * Math.sin(angle);
    const y = part.y + dx * Math.sin(angle) + dy * Math.cos(angle);
    assert.ok(x >= 16 - .01 && x <= 1008 + .01);
    assert.ok(y >= 16 - .01 && y <= 752 + .01);
  }
  const root = snapFishAttachment({ x: part.x, y: part.y });
  assert.ok(Math.hypot((root.x - 548) / 266, (root.y - 384) / 156) <= 1.001);
});

test("part selection follows rotation rather than its unrotated screen rectangle", () => {
  const part = { ...makeFishPart("rectangle", "#FFFFFF", "fin"), x: 500, y: 380, width: 160, height: 40, rotation: 90 };
  assert.equal(fishPartContains(part, { x: 500, y: 440 }), true);
  assert.equal(fishPartContains(part, { x: 560, y: 380 }), false);
});

test("draft recovery rejects unbounded content and preserves opaque white parts", () => {
  const fish = emptyFishDocument();
  fish.parts.push(makeFishPart("triangle", "#FFFFFF", "white-fin"));
  const recovered = parseFishDraft(JSON.stringify(fish));
  assert.equal(recovered?.parts[0].color, "#FFFFFF");
  assert.equal(parseFishDraft(JSON.stringify({ ...fish, parts: Array(17).fill(fish.parts[0]) })), null);
  assert.equal(parseFishDraft(JSON.stringify({ ...fish, parts: [{ ...fish.parts[0], x: Infinity }] })), null);
  assert.equal(parseFishDraft("{broken"), null);
});

test("legacy free marks stay alpha additions beneath alpha-preserving Draw paint", () => {
  const legacy = { version: 1, body: [], parts: [] };
  const recovered = parseFishDraft(JSON.stringify(legacy));
  assert.deepEqual(recovered?.free, []);
  const fish = { ...emptyFishDocument(), body: [{ kind:"stroke" as const, tool:"pen" as const, color:"#00FF00", size:12, opacity:1, points:[{x:.05,y:.5}] }, { kind:"stroke" as const, tool:"eraser" as const, color:"#111A39", size:8, points:[{x:.05,y:.5}] }], free: [{ kind:"spray" as const, color:"#FF0000", size:48, opacity:.4, points:[{x:.05,y:.5}] }, { kind:"stroke" as const, tool:"eraser" as const, color:"#111A39", size:8, points:[{x:.05,y:.5}] }] };
  assert.equal(fishHasArtwork(fish), true);
  assert.equal(parseFishDraft(JSON.stringify(fish))?.free[0].kind, "spray");
  assert.equal(parseFishDraft(JSON.stringify({ ...fish, free:[{ ...fish.free[0], opacity:2 }] })), null);
  const layers: { canvas: HTMLCanvasElement; images: HTMLCanvasElement[]; clips: number; arcs: number; fills: number; composites: string[] }[] = [];
  const surface = (width:number,height:number) => {
    const record = { canvas: { width,height } as HTMLCanvasElement, images: [] as HTMLCanvasElement[], clips:0, arcs:0, fills:0, composites:[] as string[] };
    const context = new Proxy({ canvas:record.canvas, drawImage(image:HTMLCanvasElement){record.images.push(image);}, createRadialGradient(){return { addColorStop() {} } as CanvasGradient;}, clip(){record.clips += 1;}, arc(){record.arcs += 1;}, fill(){record.fills += 1;} }, { get(target,key){return key in target ? target[key as keyof typeof target] : () => {};}, set(target,key,value){if(key==="globalCompositeOperation")record.composites.push(value as string);Reflect.set(target,key,value);return true;} }) as unknown as CanvasRenderingContext2D;
    record.canvas.getContext = (() => context) as unknown as typeof record.canvas.getContext; layers.push(record); return record.canvas;
  };
  const destination=surface(1024,768); renderFish(destination.getContext("2d")!,fish,surface);
  assert.equal(layers[2].clips,0,"body additions remain transparent and are not clipped to the template silhouette");
  assert.ok(layers[2].composites.includes("destination-out"),"erasing body additions clears alpha instead of painting an opaque body colour");
  assert.ok(layers[2].arcs >= 8 && layers[2].fills >= 8,"spray emits visible deterministic paint dots");
  assert.deepEqual(layers[0].images,[layers[1].canvas],"the template and transparent body additions form one base before Draw");
  assert.ok(layers[1].composites.includes("source-atop"),"Draw is applied only onto existing fish alpha and preserves that alpha");
  assert.ok(layers[3].composites.includes("destination-out"),"Draw erasing removes prior ink from its overlay and reveals the body underneath");
});

test("fish mist draft version accepts the wider range while legacy spray keeps its bound", () => {
  const legacy = { version: 1, template: "blank", body: [{ kind: "spray", color: "#FF0000", size: 96, opacity: .5, points: [{ x: .5, y: .5 }] }], free: [], parts: [] };
  const mist = { ...legacy, body: [{ ...legacy.body[0], size: 160, style: "mist-v1" }] };
  assert.equal(parseFishDraft(JSON.stringify(legacy))?.free[0]?.kind, "spray");
  assert.equal(parseFishDraft(JSON.stringify(mist))?.free[0]?.kind, "spray");
  assert.equal(parseFishDraft(JSON.stringify({ ...legacy, body: [{ ...legacy.body[0], size: 160 }] })), null);
});


test("fish compositing masks isolated body/part buffers and retains projecting parts in front and behind", () => {
  const fish = emptyFishDocument();
  fish.parts = [{ ...makeFishPart("triangle", "#FFFFFF", "rear"), behind: true }, { ...makeFishPart("ellipse", "#FFFFFF", "front"), behind: false }];
  const surfaces: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; images: HTMLCanvasElement[]; composites: string[] }[] = [];
  const surface = (width: number, height: number) => {
    const images: HTMLCanvasElement[] = []; const composites: string[] = [];
    const canvas = { width, height } as HTMLCanvasElement;
    const context = new Proxy({ canvas, drawImage(image: HTMLCanvasElement) { images.push(image); } }, {
      get(target, key) { return key in target ? target[key as keyof typeof target] : () => {}; },
      set(target, key, value) { if (key === "globalCompositeOperation") composites.push(value); Reflect.set(target, key, value); return true; },
    }) as unknown as CanvasRenderingContext2D;
    canvas.getContext = (() => context) as unknown as typeof canvas.getContext;
    surfaces.push({ canvas, context, images, composites }); return canvas;
  };
  const destination = surface(1024, 768);
  renderFish(destination.getContext("2d")!, fish, surface);
  assert.deepEqual(surfaces[0].images, [surfaces[3].canvas, surfaces[1].canvas, surfaces[4].canvas]);
  assert.deepEqual(surfaces[0].composites, [], "the final composite must never receive a body mask");
  assert.ok(surfaces[3].composites.includes("destination-in") && surfaces[4].composites.includes("destination-in"));
});
