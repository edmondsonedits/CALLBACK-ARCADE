import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { applyArchiveGates } from "../scripts/apply-arcade-archive-gates.mjs";

async function runRendererGate(bootstrap: string, options: { referrer?: string; ok?: boolean; gameId?: string; status?: string; role?: string; topLevel?: boolean } = {}) {
  let rendered: string | null = null;
  let requestedRole: string | null = null;
  let requests = 0;
  const windowLike: { parent?: object } = {};
  windowLike.parent = options.topLevel ? windowLike : {};
  const context = {
    URL,
    URLSearchParams,
    window: windowLike,
    location: { origin: "https://game.test", search: "?online=1" },
    document: {
      referrer: options.referrer ?? "",
      open() {},
      write(value: string) { rendered = value; },
      close() {},
    },
    fetch: async (_url: string, init: { headers: Record<string, string> }) => {
      requests++;
      requestedRole = init.headers["x-callback-online-role"] ?? null;
      return {
        ok: options.ok ?? true,
        json: async () => ({ status: options.status ?? "PLAYING", gameId: options.gameId ?? "sky-balls", role: options.role ?? "host" }),
      };
    },
  };
  vm.runInNewContext(bootstrap, context);
  await new Promise(resolve => setTimeout(resolve, 0));
  return { rendered: rendered as string | null, requestedRole: requestedRole as string | null, requests };
}

test("production build runs the archived Arcade static-output gate", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts.postbuild, "node scripts/apply-arcade-archive-gates.mjs");
});

test("build output gates archived directory entries and guards retained online renderers", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "arcade-archive-build-"));
  const sourceFile = new URL("../public/arcade-games/royal-ballistix/online-v65.html", import.meta.url);
  const originalBefore = await readFile(sourceFile, "utf8");
  try {
    const count = await applyArchiveGates({ clientDir: path.join(output, "arcade-games") });
    assert.equal(count, 17);

    const directPage = await readFile(path.join(output, "arcade-games", "space-bash", "index.html"), "utf8");
    assert.match(directPage, /Space Bash · Orbital Breakout is archived/u);
    assert.doesNotMatch(directPage, /<canvas|<script[^>]+src=/iu);

    const alias = await readFile(path.join(output, "arcade-games", "royal-ballistix", "index.html"), "utf8");
    assert.match(alias, /Royal Ballistix · Beach Siege is archived/u);

    const online = await readFile(path.join(output, "arcade-games", "royal-ballistix", "online-v65.html"), "utf8");
    assert.match(online, /This Arcade game is unavailable for new play/u);
    assert.match(online, /document\.referrer/u);
    assert.match(online, /x-callback-online-role/u);
    assert.match(online, /room\.status!=="PLAYING"/u);
    assert.match(online, /room\.gameId!=="sky-balls"/u);
    assert.match(online, /room\.role!==role/u);
    assert.ok(online.indexOf("document.write(original)") > online.indexOf("room.role!==role"));
    assert.doesNotMatch(online, /<canvas\s+id=/iu, "legacy renderer markup remains escaped in the bootstrap");
    const bootstrap = online.match(/<script>([\s\S]*?)<\/script>/u)?.[1];
    assert.ok(bootstrap);
    new vm.Script(bootstrap);

    const directAttempt = await runRendererGate(bootstrap);
    assert.equal(directAttempt.requests, 0, "top-level access does not query or render the retained game");
    const noAuth = await runRendererGate(bootstrap, { referrer: "https://game.test/arcade/online/host/ABCD", ok: false });
    assert.equal(noAuth.rendered, null);
    const topLevelWithValidRoom = await runRendererGate(bootstrap, { referrer: "https://game.test/arcade/online/host/ABCD", topLevel: true });
    assert.equal(topLevelWithValidRoom.requests, 0, "a top-level page cannot unlock the renderer with a forged matching referrer");
    assert.equal(topLevelWithValidRoom.rendered, null);
    const mismatch = await runRendererGate(bootstrap, { referrer: "https://game.test/arcade/online/host/ABCD", gameId: "space-bash" });
    assert.equal(mismatch.rendered, null);
    const validHost = await runRendererGate(bootstrap, { referrer: "https://game.test/arcade/online/host/ABCD", topLevel: false });
    assert.ok(validHost.rendered?.startsWith("<!doctype html>"));
    assert.equal(validHost.requestedRole, "host");
    const validPlayer = await runRendererGate(bootstrap, { referrer: "https://game.test/arcade/online/join/ABCD", role: "player", topLevel: false });
    assert.ok(validPlayer.rendered?.startsWith("<!doctype html>"));
    assert.equal(validPlayer.requestedRole, "player", "join requests prefer the authenticated player seat");
    const validDisplay = await runRendererGate(bootstrap, { referrer: "https://game.test/arcade/online/display/ABCD", role: "display", topLevel: false });
    assert.ok(validDisplay.rendered?.startsWith("<!doctype html>"));
    assert.equal(validDisplay.requestedRole, "display");
    const wrongDisplayRole = await runRendererGate(bootstrap, { referrer: "https://game.test/arcade/online/display/ABCD", role: "host", topLevel: false });
    assert.equal(wrongDisplayRole.rendered, null, "display route rejects a non-display authenticated response");

    assert.equal(await readFile(sourceFile, "utf8"), originalBefore, "raw public restoration source remains unchanged");
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
