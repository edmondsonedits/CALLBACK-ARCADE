import assert from "node:assert/strict";
import test from "node:test";
import { addOperation, emptyDrawing, floodFill, paintDrawingOperation, parseDraft, redoDrawing, undoDrawing, type SelectionOperation } from "../lib/drawing-studio";
import { ALL_EDITOR_TOOLS, EDITOR_TOOLS, OTHER_TOOLS, beginPinch, circleEnd, colorAllowed, decodeSelection, defaultTool, encodeSelection, movePinch, operationAllowed, selectionContains, selectionRect, starterOperations, toolAllowed } from "../lib/drawing-editor";

const rgba = (r: number, g: number, b: number) => [r, g, b, 255];
function white(w: number, h: number) { return new Uint8ClampedArray(w * h * 4).fill(255); }
function pixel(data: Uint8ClampedArray, w: number, x: number, y: number) { return [...data.slice((y * w + x) * 4, (y * w + x + 1) * 4)]; }
function square(data: Uint8ClampedArray, w: number, min: number, max: number) {
  for (let i = min; i <= max; i++) for (const [x,y] of [[min,i],[max,i],[i,min],[i,max]]) data.set(rgba(0,0,0), (y * w + x) * 4);
}

test("smart fill closes a two-pixel gap without changing outline or exterior", () => {
  const data = white(32,32); square(data,32,6,25);
  data.set([...rgba(255,255,255),...rgba(255,255,255)], (6 * 32 + 15) * 4);
  assert.equal(floodFill(data,32,32,16,16,"#FF0000",2),true);
  assert.deepEqual(pixel(data,32,16,16),rgba(255,0,0));
  assert.deepEqual(pixel(data,32,0,0),rgba(255,255,255));
  assert.deepEqual(pixel(data,32,6,16),rgba(0,0,0));
  assert.equal(floodFill(data,32,32,16,16,"#FF0000",2),false);
});

test("smart fill preserves intentionally large openings; legacy fill retains its exact behavior", () => {
  for (const [gap, closing] of [[8,2],[2,0]]) {
    const data = white(32,32); square(data,32,6,25);
    for (let x=12;x<12+gap;x++) data.set(rgba(255,255,255),(6*32+x)*4);
    floodFill(data,32,32,16,16,"#FF0000",closing);
    assert.deepEqual(pixel(data,32,0,0),rgba(255,0,0));
  }
});

test("fill rejects invalid buffers, dimensions, colours and nonfinite seeds", () => {
  assert.equal(floodFill(white(2,2),2,2,NaN,0,"#000000",2),false);
  assert.equal(floodFill(white(2,2),2,2,0,0,"bad",2),false);
  assert.equal(floodFill(white(2,2),2,3,0,0,"#000000",2),false);
  assert.equal(floodFill(new Uint8ClampedArray(),0,0,0,0,"#000000",2),false);
});

test("selection removes exterior paper while preserving closed white interiors and coloured pixels", () => {
  const data=white(9,9); square(data,9,2,6); data.set(rgba(255,0,0),(4*9+4)*4);
  const encoded=encodeSelection(data,9,9); const decoded=decodeSelection(encoded);
  assert.deepEqual(pixel(decoded,9,0,0),[0,0,0,0]);
  assert.deepEqual(pixel(decoded,9,3,3),rgba(255,255,255));
  assert.deepEqual(pixel(decoded,9,4,4),rgba(255,0,0));
  assert.deepEqual(pixel(decoded,9,2,4),rgba(0,0,0));
  assert.deepEqual(pixel(data,9,0,0),rgba(255,255,255),"copy must not mutate its source");
});

const selection: SelectionOperation = { type:"selection", pixels:{width:2,height:1,runs:[1,0,1,0xff0000ff]}, source:{x:10,y:10,width:2,height:1}, transform:{x:20,y:20,width:4,height:2,rotation:45} };
test("selection move, paste, rotation and removal survive history branching and draft reload", () => {
  const moved=addOperation(emptyDrawing({width:800,height:400}),selection);
  const pasted=addOperation(moved,{type:"selection",pixels:selection.pixels,transform:{...selection.transform,x:50}});
  assert.deepEqual(parseDraft(JSON.stringify(redoDrawing(undoDrawing(pasted)))), pasted);
  const deleted=addOperation(undoDrawing(pasted),{type:"remove",source:selection.source!});
  assert.equal(deleted.operations.length,2); assert.equal(deleted.operations[1].type,"remove");
  assert.deepEqual(undoDrawing(deleted).operations[0],selection);
});

test("selection schemas and decoder reject unbounded or inconsistent run lengths before painting", () => {
  const document=addOperation(emptyDrawing(),selection);
  for (const pixels of [{width:1025,height:1,runs:[1025,0]}, {width:1,height:1,runs:[0xffffffff,0]}, {width:1,height:1,runs:[1]}, {width:1,height:1,runs:[0,0]}, {width:1,height:1,runs:[1,-1]}]) {
    assert.throws(()=>decodeSelection(pixels));
    assert.equal(parseDraft(JSON.stringify({...document,operations:[{...selection,pixels}]})),null);
  }
  assert.throws(()=>encodeSelection(white(2,2),3,2));
  assert.throws(()=>encodeSelection(new Uint8ClampedArray(),0,0));
});

test("bounded full-resolution selection and smart fill finish within an interactive-work budget", () => {
  const data=white(1024,1024); const start=performance.now();
  const encoded=encodeSelection(data,1024,1024);
  assert.deepEqual(encoded.runs,[1024*1024,0]);
  assert.equal(decodeSelection(encoded).length,4*1024*1024);
  assert.equal(floodFill(data,1024,1024,0,0,"#111A39",2),true);
  assert.deepEqual(pixel(data,1024,1023,1023),rgba(17,26,57));
  assert.ok(performance.now()-start<5000,"bounded million-pixel work should complete in under five seconds even on shared CI");
});

test("circle constraints have equal pixel axes on portrait and landscape documents, including edges", () => {
  for (const size of [{width:400,height:1024},{width:1024,height:400}]) for (const to of [{x:.8,y:.8},{x:0,y:.1},{x:1,y:1}]) {
    const from={x:.4,y:.6}; const end=circleEnd(from,to,size);
    assert.ok(Math.abs(Math.abs(end.x-from.x)*size.width-Math.abs(end.y-from.y)*size.height)<.0001);
    assert.ok(end.x>=0 && end.y>=0 && end.x<=1 && end.y<=1);
  }
  assert.equal(operationAllowed("circles",{type:"ellipse",color:"#111A39",width:8,from:{x:0,y:0},to:{x:.5,y:.5}},{width:400,height:800}),false);
});

test("restrictions block bypass tools, paper-colour overpaint and selection removal at the operation boundary", () => {
  assert.deepEqual(EDITOR_TOOLS.filter(t=>toolAllowed("circles",t)),["ellipse","pan"]);
  assert.deepEqual(EDITOR_TOOLS.filter(t=>toolAllowed("lines",t)),["line","pan"]);
  for (const color of ["#FFFFFF","#eeeeee","#f6f6f6"]) assert.equal(colorAllowed("no-erase",color),false);
  assert.equal(colorAllowed("no-erase","#FFD84B"),true);
  assert.equal(colorAllowed("limited-palette","#529AFF"),false);
  assert.equal(operationAllowed("no-erase",{type:"clear"}),false);
  assert.equal(operationAllowed("no-erase",{type:"remove",source:selection.source!}),false);
  assert.equal(operationAllowed("no-erase",selection),false);
  assert.equal(operationAllowed("no-fill",{type:"fill",color:"#111A39",point:{x:0,y:0}}),false);
  assert.equal(operationAllowed(undefined,selection),true);
  assert.equal(defaultTool("circles"),"ellipse"); assert.equal(defaultTool("lines"),"line");
});

test("giant pen scales with the logical canvas, not CSS zoom or device pixels", () => {
  let lineWidth=0;
  const context={canvas:{width:512,height:1024},set lineWidth(n:number){lineWidth=n;}, beginPath(){},arc(){},fill(){}} as unknown as CanvasRenderingContext2D;
  const op={type:"stroke",tool:"pen",color:"#111A39",width:48,points:[{x:.5,y:.5}]} as const;
  paintDrawingOperation(context,{...op,points:[...op.points]}); assert.equal(lineWidth,48);
  assert.equal(operationAllowed("giant-brush",{...op,points:[...op.points]}),true);
  assert.equal(operationAllowed("giant-brush",{...op,width:8,points:[...op.points]}),false);
  assert.deepEqual(EDITOR_TOOLS.filter(t=>toolAllowed("giant-brush",t)),["pen","pan"]);
});

test("spray is discoverable in Other and remains a deterministic opacity-controlled paint operation", async () => {
  assert.deepEqual(OTHER_TOOLS, ["spray"]);
  assert.ok(ALL_EDITOR_TOOLS.includes("spray"));
  assert.equal(toolAllowed(undefined, "spray"), true);
  assert.equal(toolAllowed("giant-brush", "spray"), false);
  const { paintDrawingOperation } = await import("../lib/drawing-studio");
  const draw = () => {
    const dots: number[][] = []; let alpha = 1; let fill = ""; const stack:number[]=[];
    const context = new Proxy({ canvas: { width: 512, height: 512 }, createRadialGradient(){return {addColorStop(){}} as CanvasGradient;}, arc(x:number,y:number,r:number){dots.push([x,y,r]);}, fill(){}, beginPath(){}, save(){stack.push(alpha);}, restore(){alpha=stack.pop() ?? alpha;}, set globalAlpha(value:number){alpha=value;}, get globalAlpha(){return alpha;}, set fillStyle(value:string){fill=value;} }, { get(target,key){return key in target ? target[key as keyof typeof target] : () => {};}, set(target,key,value){Reflect.set(target,key,value);return true;} }) as unknown as CanvasRenderingContext2D;
    paintDrawingOperation(context, { type:"spray", color:"#FF0000", width:36, opacity:.35, points:[{x:.5,y:.5}] });
    assert.equal(alpha, 1, "spray restores the canvas alpha after painting"); assert.equal(fill, "#FF0000");
    return dots;
  };
  assert.deepEqual(draw(), draw(), "identical saved spray data must export identically");
  assert.ok(draw().length >= 8);
});

test("pinch preserves the world point under the moving midpoint and clamps zoom", () => {
  const start=beginPinch({x:100,y:100},{x:200,y:100},{zoom:1,pan:{x:0,y:0}},{x:150,y:200});
  assert.deepEqual(movePinch(start,{x:50,y:120},{x:250,y:120}),{zoom:2,pan:{x:0,y:120}});
  assert.equal(movePinch(start,{x:-1000,y:100},{x:2000,y:100}).zoom,4);
  assert.equal(movePinch(start,{x:150,y:100},{x:150,y:100}).zoom,.5);
});

test("selection geometry handles reverse drags, document edges and rotated hit tests", () => {
  assert.deepEqual(selectionRect({x:1,y:1},{x:.5,y:.5},{width:400,height:800}),{x:200,y:400,width:200,height:400});
  assert.deepEqual(selectionRect({x:1,y:1},{x:1,y:1},{width:400,height:800}),{x:399,y:799,width:1,height:1});
  const transform={x:100,y:100,width:80,height:20,rotation:90};
  assert.equal(selectionContains(transform,{x:100,y:130}),true);
  assert.equal(selectionContains(transform,{x:130,y:100}),false);
});

test("starter IDs produce bounded, persistable original sketches; unknown IDs remain blank", () => {
  for (const id of ["sword","shield","crown","person","dragon"]) {
    let document=emptyDrawing(); for (const operation of starterOperations(id)) document=addOperation(document,operation);
    assert.ok(document.cursor>0); assert.deepEqual(parseDraft(JSON.stringify(document)),document);
  }
  assert.deepEqual(starterOperations(),[]); assert.deepEqual(starterOperations("unknown"),[]);
});


test("240-character composed gameplay prompts accept marks, undo/redo and draft reload", () => {
  const prompt = "A".repeat(140) + " — " + "B".repeat(97);
  const drawing = addOperation(emptyDrawing({width:512,height:1024}, prompt), { type:"line", color:"#111A39", width:8, from:{x:.1,y:.1},to:{x:.8,y:.8} });
  assert.equal(drawing.cursor,1);
  assert.deepEqual(parseDraft(JSON.stringify(redoDrawing(undoDrawing(drawing)))),drawing);
  assert.equal(parseDraft(JSON.stringify({...drawing,prompt:prompt+"!"})),null);
});
