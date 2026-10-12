// Optional browser matrix. Install Playwright separately; no runtime/package changes are needed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const html = await readFile(
  new URL("../source/index.html", import.meta.url),
  "utf8",
);
const out = process.env.TWISTED_EVIDENCE_DIR || "/tmp/royal-twisted-browser";
await mkdir(out, { recursive: true });
// Test-only access to module-local state. All production simulation/render/input functions are unchanged.
const instrumented = html.replace(
  "try{initRenderer();",
  "window.__quality={run:code=>eval(code)};try{initRenderer();",
);
const sourceRoot = new URL("../source/", import.meta.url);
const pagesRoot = process.env.TWISTED_PAGES_DIR;
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(instrumented);
      return;
    }
    let root = sourceRoot;
    let relative = pathname.slice(1);
    if (pathname.startsWith("/standalone/")) relative = pathname.slice(12);
    if (pathname.startsWith("/pages/games/royal-twisted/")) {
      assert.ok(pagesRoot, "TWISTED_PAGES_DIR must identify the actual Pages build");
      root = new URL(`file://${pagesRoot}/games/royal-twisted/`);
      relative = pathname.slice("/pages/games/royal-twisted/".length) || "index.html";
    }
    const file = new URL(relative, root);
    assert.ok(file.href.startsWith(root.href));
    res.setHeader("Content-Type", relative.endsWith(".js") ? "text/javascript" : "text/html");
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    chromiumSandbox: true,
    // Retain browser security; do not enable Playwright's unsafe software fallback.
    ignoreDefaultArgs: ["--enable-unsafe-swiftshader", "--unsafely-disable-devtools-self-xss-warnings"],
  });
} catch (error) {
  await writeFile(`${out}/browser-quality.json`, JSON.stringify({
    sourceSha256: createHash("sha256").update(html).digest("hex"),
    status: "blocked",
    reason: "Browser launch failed with sandbox and certificate validation retained",
    detail: error.message,
    checks: [],
  }, null, 2));
  server.close();
  throw error;
}
const report = {
  sourceSha256: createHash("sha256").update(html).digest("hex"),
  conditions: {
    browser: await browser.version(),
    renderer: "Chromium default WebGL; inspect renderer on the target machine",
    tlsValidation: "default; no certificate overrides",
    physicalPhone: false,
    realGamepad: false,
  },
  checks: [],
};
const context = await browser.newContext({
  hasTouch: true,
});
const check = (name, detail) => {
  report.checks.push({ name, result: "passed", detail });
  console.log("PASS", name, detail ?? "");
};
const run = (p, code) => p.evaluate((code) => window.__quality.run(code), code);
async function pageFor(viewport) {
  const p = await context.newPage();
  await p.setViewportSize(viewport);
  p.on("requestfailed", (r) =>
    console.log("REQUEST FAILED", r.url(), r.failure()?.errorText),
  );
  await p.addInitScript(() => {
    window.requestAnimationFrame = (cb) => {
      window.__nextFrame = cb;
      return 1;
    };
  });
  return p;
}
try {
  // External traffic is forbidden throughout this matrix; local bundles must suffice.
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === new URL(url).origin
      ? route.continue()
      : route.abort(),
  );
  for (const path of ["standalone/index.html", "pages/games/royal-twisted/"]) {
    const p = await context.newPage();
    const errors = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto(url + path);
    await p.waitForFunction(() => window.RoyalTwisted && document.querySelector("canvas") && getComputedStyle(document.querySelector("#loading")).display === "none");
    assert.deepEqual(errors, []);
    assert.equal(await p.evaluate(() => typeof window.__quality), "undefined");
    check(`ordinary uninstrumented ${path} loads with external traffic blocked`);
    await p.close();
  }
  for (const dependency of ["three.module.js", "three.core.js"]) {
    const p = await pageFor({ width: 390, height: 844 });
    await p.route(`**/vendor/three/${dependency}`, (r) => r.abort());
    await p.goto(url);
    await p.waitForFunction(
      () => document.querySelector("#loading h1").textContent === "Three.js unavailable",
      {}, { polling: 100 },
    );
    assert.match(await p.locator("#loading").innerText(), /including vendor\/three/);
    check(`missing bundled ${dependency} reports an explicit failure`);
    await p.close();
  }
  const noGPU = await pageFor({ width: 390, height: 844 });
  await noGPU.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith("webgl")
        ? null
        : original.call(this, type, ...args);
    };
  });
  await noGPU.goto(url);
  await noGPU.waitForFunction(
    () =>
      document.querySelector("#loading h1").textContent === "Renderer Error",
    {},
    { timeout: 30000, polling: 100 },
  );
  check("unavailable WebGL reports Renderer Error");
  await noGPU.close();
  for (const [name, width, height, count] of [
    ["desktop", 1280, 720, 4],
    ["portrait", 390, 844, 10],
    ["small", 320, 568, 2],
    ["landscape", 844, 390, 10],
  ].filter(
    (p) => !process.env.TWISTED_PROFILE || p[0] === process.env.TWISTED_PROFILE,
  )) {
    const p = await pageFor({ width, height });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(`${url}?players=${count}`);
    await p
      .waitForFunction(
        () => !!window.__quality && !!document.querySelector("canvas"),
        {},
        { timeout: 60000, polling: 100 },
      )
      .catch(async (error) => {
        console.log(
          "STARTUP",
          name,
          await p.locator("#loading").innerText(),
          errors,
        );
        throw error;
      });
    await p.locator("#loading").waitFor({ state: "hidden" });
    assert.equal(await run(p, "!!renderer"), true);
    assert.deepEqual(errors, []);
    await run(
      p,
      "updatePhase(3.4);debugOn=true;soundOn=false;nextSpawn=999;updateHUD();updateDebug()",
    );
    const cueBox = await p.locator("#reactionCue").boundingBox(),
      hostBox = await p.locator(".host").boundingBox();
    if (hostBox)
      assert.ok(
        cueBox.y >= hostBox.y + hostBox.height,
        JSON.stringify({ name, cueBox, hostBox }),
      );
    const code = await p.evaluate(() => window.CallbackCamera.code());
    assert.equal(code, "CAM-3R-23-U");
    await p.evaluate(() => {
      window.CallbackCamera.set({ rotate: 100, zoom: 1.4, tilt: 15 });
      window.CallbackCamera.reset();
    });
    assert.equal(await p.evaluate(() => window.CallbackCamera.code()), code);
    await p.keyboard.down("Shift");
    await p.keyboard.down("s");
    await p.keyboard.up("Shift");
    assert.equal(await run(p, "fighters[0].duck"), true);
    await p.keyboard.up("s");
    assert.equal(await run(p, "fighters[0].duck"), false);
    const duckBox = await p.locator("#duckBtn").boundingBox();
    await p.mouse.move(
      duckBox.x + duckBox.width / 2,
      duckBox.y + duckBox.height / 2,
    );
    await p.mouse.down();
    assert.equal(await run(p, "fighters[0].duck"), true);
    await p
      .locator("#duckBtn")
      .dispatchEvent("pointercancel", { pointerId: 1 });
    await p.mouse.up();
    assert.equal(await run(p, "fighters[0].input.duckHeld"), false);
    await p.locator("#jumpBtn").tap();
    assert.ok((await run(p, "fighters[0].jumpY")) > 0);
    await p.locator("#settingsBtn").click();
    await p.keyboard.press("Escape");
    assert.equal(await run(p, 'settingsModal.classList.contains("open")'), false);
    assert.equal(await run(p, "paused"), true);
    await p.keyboard.press("Escape");
    assert.equal(await run(p, "paused"), false);
    await p.keyboard.press("Escape");
    assert.equal(await run(p, "paused"), true);
    await p.keyboard.press("Escape");
    assert.equal(await run(p, "paused"), false);
    await p.locator("#settingsBtn").click();
    await p.locator("#closeSettings").click();
    assert.equal(await run(p, "paused"), true);
    await p.locator("#resumeBtn").click();
    assert.equal(await run(p, "paused"), false);
    await p.evaluate(() => window.dispatchEvent(new Event("blur")));
    assert.equal(await run(p, "paused"), true);
    assert.equal(
      await run(p, "fighters.every(f=>!f.input.duckHeld&&!f.input.jumpBuffer)"),
      true,
    );
    await p.locator("#resumeBtn").click();
    // Real Three.js camera projection for both ends of P1's setback range.
    const projections = [];
    for (const setback of [false, true]) {
      await run(
        p,
        `hazards.forEach(h=>hazardGroup.remove(h.group));hazards=[];fighters[0].trackT=${setback ? ".028" : ".115"};fighters[0].jumpY=0;fighters[0].vy=0;fighters[0].base.copy(helixPoint(fighters[0].trackT)).addScaledVector(helixBasis(fighters[0].trackT).right,fighters[0].lane);cameraShake=0;createHazard('low',fighters[0].trackT+.014+currentSpeed()*.3);createHazard('high',fighters[0].trackT+.014+currentSpeed()*1.05);updateVisuals(.016,0);updateCamera(10,0);updateHUD();renderer.render(scene,camera)`,
      );
      const coords = await run(
        p,
        "hazards.map(h=>{const v=h.group.position.clone().project(camera);return {x:v.x,y:v.y,z:v.z}})",
      );
      for (const v of coords) {
        assert.ok(
          Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z > -1 && v.z < 1,
          JSON.stringify({ name, setback, v }),
        );
      }
      projections.push({ setback, coords });
      for (const selector of [
        "#jumpBtn",
        "#duckBtn",
        ".life-card",
        ".speed-card",
      ]) {
        const box = await p.locator(selector).boundingBox();
        for (const v of coords) {
          const x = ((v.x + 1) * width) / 2,
            y = ((1 - v.y) * height) / 2;
          assert.ok(
            !(
              x >= box.x &&
              x <= box.x + box.width &&
              y >= box.y &&
              y <= box.y + box.height
            ),
            JSON.stringify({ name, setback, selector, x, y, box }),
          );
        }
      }
      await p.screenshot({
        path: `${out}/${name}-${setback ? "setback" : "normal"}.png`,
      });
    }
    const target = await run(p, "JSON.stringify(camera.position)");
    await run(p, "fighters[1].trackT=.028;updateCamera(10,0)");
    assert.equal(await run(p, "JSON.stringify(camera.position)"), target);
    for (const id of ["jumpBtn", "duckBtn"]) {
      const box = await p.locator(`#${id}`).boundingBox();
      assert.ok(
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= width + 1 &&
          box.y + box.height <= height + 1 &&
          box.height >= 44,
      );
    }
    assert.deepEqual(errors, []);
    check(`${name}: input, lifecycle, controls and camera projections`, {
      width,
      height,
      count,
      projections,
    });
    // Software-render timing is diagnostic, not a physical-device performance claim.
    const timing = await run(
      p,
      "(()=>{const samples=[];for(let i=0;i<10;i++){const start=performance.now();updateVisuals(1/60,i/60);updateCamera(1/60,i/60);renderer.render(scene,camera);samples.push(performance.now()-start)}return {meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,maxMs:Math.max(...samples),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,dpr:renderer.getPixelRatio()}})()",
    );
    check(`${name}: software render sample (CPU submission only)`, timing);
    await p.close();
  }
} catch (error) {
  report.checks.push({
    name: "browser matrix",
    result: "failed",
    detail: error.stack,
  });
  throw error;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}
