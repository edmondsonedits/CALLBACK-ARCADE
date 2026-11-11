import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("fine spray has a soft dense center, blends in layers, and stays deterministic in the incremental cache", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const loadModule = new Function("return import('/lib/drawing-studio.ts')") as () => Promise<typeof import("../lib/drawing-studio")>;
    const { paintSprayCached } = await loadModule();
    const make = (width = 320, height = 240) => {
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      return { canvas, context: canvas.getContext("2d")! };
    };
    const path = Array.from({ length: 201 }, (_, i) => ({ x: 0.2 + i * 0.003, y: 0.5 + Math.sin(i / 28) * 0.018 }));
    const operation = {};
    const onePass = make(); paintSprayCached(onePass.context, operation, path, "#FF0000", 0.5, 14, 21);
    const incremental = make(); const progressive = {};
    const appended: typeof path = [];
    for (const point of path) {
      appended.push(point);
      incremental.context.clearRect(0, 0, 320, 240);
      paintSprayCached(incremental.context, progressive, appended, "#FF0000", 0.5, 14, 21);
    }
    const reload = make(); paintSprayCached(reload.context, {}, path, "#FF0000", 0.5, 14, 21);
    const mixedLayer = make();
    paintSprayCached(mixedLayer.context, {}, path, "#FF0000", 0.5, 14, 21);
    paintSprayCached(mixedLayer.context, {}, path, "#0000FF", 0.5, 14, 21);
    const max = make();
    const maxOp = { points: path };
    paintSprayCached(max.context, maxOp, path, "#33B88C", 0.5, 48, 48);
    // Judge the artwork after the same kind of reduction used by the phone canvas.
    const phoneSize = 300;
    const phoneDefault = make(1024, 1024); paintSprayCached(phoneDefault.context, {}, path, "#FF6F61", 0.5, 14, 21);
    const phoneMax = make(1024, 1024); paintSprayCached(phoneMax.context, {}, path, "#33B88C", 0.5, 48, 48);
    const downsample = (source: HTMLCanvasElement) => {
      const phone = document.createElement("canvas"); phone.width = phoneSize; phone.height = phoneSize;
      phone.getContext("2d")!.drawImage(source, 0, 0, phoneSize, phoneSize);
      return phone;
    };
    const phoneDefaultPreview = downsample(phoneDefault.canvas);
    const phoneMaxPreview = downsample(phoneMax.canvas);
    const visibleCoverage = (canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, phoneSize, phoneSize).data;
      let covered = 0;
      for (let y = 24; y < 276; y++) for (let x = 24; x < 276; x++) if (pixels[(y * phoneSize + x) * 4 + 3]! >= 12) covered++;
      return covered;
    };
    const data = mixedLayer.context.getImageData(0, 0, 320, 240).data;
    const singleData = onePass.context.getImageData(0, 0, 320, 240).data;
    const incrementalData = incremental.context.getImageData(0, 0, 320, 240).data;
    const reloadData = reload.context.getImageData(0, 0, 320, 240).data;
    const alphaAt = (x: number, y: number) => data[(y * 320 + x) * 4 + 3]!;
    let core = 0, edge = 0, mixed = 0, corePixels = 0, edgePixels = 0;
    for (let y = 100; y < 140; y++) for (let x = 156; x < 164; x++) {
      const transverseDistance = Math.abs(y - 123);
      if (transverseDistance < 4) { core += alphaAt(x, y); corePixels++; }
      if (transverseDistance >= 10 && transverseDistance < 14) { edge += alphaAt(x, y); edgePixels++; }
      const i = (y * 320 + x) * 4;
      if (transverseDistance < 10 && data[i]! > 0 && data[i + 2]! > 0) mixed++;
    }
    document.body.innerHTML = "";
    document.body.style.cssText = "display:flex;gap:24px;padding:24px;background:#252525";
    for (const preview of [phoneDefaultPreview, phoneMaxPreview]) {
      preview.style.cssText = "width:300px;height:300px;background:repeating-conic-gradient(#ddd 0% 25%,white 0% 50%) 0/20px 20px";
      document.body.appendChild(preview);
    }
    return {
      coreAverage: core / corePixels,
      edgeAverage: edge / edgePixels,
      centerAlpha: alphaAt(160, 120), untouchedAlpha: alphaAt(0, 0), mixed,
      incrementalMatches: singleData.every((value, index) => value === incrementalData[index]),
      reloadMatches: singleData.every((value, index) => value === reloadData[index]),
      maxAlpha: Math.max(...Array.from({ length: 320 * 240 }, (_, index) => singleData[index * 4 + 3]!)),
      maxSizeAlpha: max.context.getImageData(0, 0, 320, 240).data[3],
      phoneDefaultCoverage: visibleCoverage(phoneDefaultPreview),
      phoneMaxCoverage: visibleCoverage(phoneMaxPreview),
    };
  });
  await expect.poll(async () => page.locator("canvas").count()).toBe(2);
  await mkdir(".logs/fish-acceptance/spray", { recursive: true });
  await page.screenshot({ path: ".logs/fish-acceptance/spray/spray-quality-preview.png" });
  expect(result.coreAverage).toBeGreaterThan(result.edgeAverage * 1.5);
  expect(result.coreAverage).toBeGreaterThan(0);
  expect(result.untouchedAlpha).toBe(0);
  expect(result.mixed).toBeGreaterThan(0);
  expect(result.maxAlpha).toBeLessThan(255);
  expect(result.maxSizeAlpha).toBe(0);
  expect(result.phoneDefaultCoverage).toBeGreaterThan(200);
  expect(result.phoneMaxCoverage).toBeGreaterThan(700);
  expect(result.incrementalMatches).toBe(true);
  expect(result.reloadMatches).toBe(true);
});

test("fish mist airbrush stays wide, softly fades, and interpolates a fast path consistently", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const loadModule = new Function("return import('/lib/drawing-studio.ts')") as () => Promise<typeof import("../lib/drawing-studio")>;
    const { paintSprayStyleCached } = await loadModule();
    const make = () => { const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 384; return { canvas, context: canvas.getContext("2d")! }; };
    // Sparse endpoints force distance interpolation through a fast pointer gap.
    const path = [{ x: 0.2, y: 0.5 }, { x: 0.5, y: 0.51 }, { x: 0.8, y: 0.5 }];
    const full = make(); paintSprayStyleCached(full.context, {}, path, "#FF6F61", 0.65, 80, 88, "mist-v1");
    const progressive = make(); const operation = {}; const points: typeof path = [];
    for (const point of path) { points.push(point); progressive.context.clearRect(0, 0, 512, 384); paintSprayStyleCached(progressive.context, operation, points, "#FF6F61", 0.65, 80, 88, "mist-v1"); }
    const one = full.context.getImageData(0, 0, 512, 384).data; const two = progressive.context.getImageData(0, 0, 512, 384).data;
    const alphaAt = (x: number, y: number) => one[(y * 512 + x) * 4 + 3]!;
    let core = 0, edge = 0, coreCount = 0, edgeCount = 0, gapPixels = 0;
    for (let x = 116; x < 397; x++) {
      for (let y = 122; y <= 262; y++) {
        const d = Math.abs(y - 192); const alpha = alphaAt(x, y);
        if (d <= 5) { core += alpha; coreCount++; }
        if (d >= 55 && d <= 65) { edge += alpha; edgeCount++; }
      }
      if (alphaAt(x, 192) < 8) gapPixels++;
    }
    let beyond = 0; for (let y = 0; y < 384; y++) for (let x = 0; x < 512; x++) if (one[(y * 512 + x) * 4 + 3]! > 0 && (x < 20 || x > 492 || y < 20 || y > 364)) beyond++;
    const preview = document.createElement("canvas"); preview.width = 320; preview.height = 240;
    preview.style.cssText = "width:320px;height:240px;background:repeating-conic-gradient(#ddd 0% 25%,white 0% 50%) 0/20px 20px";
    preview.getContext("2d")!.drawImage(full.canvas, 0, 0, 320, 240); document.body.replaceChildren(preview);
    return { core: core / coreCount, edge: edge / edgeCount, centerAlpha: alphaAt(256, 192), transparentOutside: alphaAt(0, 0), gapPixels, beyond, matches: one.every((value, index) => value === two[index]) };
  });
  await mkdir(".logs/fish-acceptance/spray", { recursive: true });
  await page.screenshot({ path: ".logs/fish-acceptance/spray/fish-mist-phone-preview.png" });
  expect(result.core).toBeGreaterThan(result.edge * 1.3);
  expect(result.centerAlpha).toBeGreaterThan(20);
  expect(result.transparentOutside).toBe(0);
  expect(result.gapPixels).toBe(0);
  expect(result.beyond).toBe(0);
  expect(result.matches).toBe(true);
});
