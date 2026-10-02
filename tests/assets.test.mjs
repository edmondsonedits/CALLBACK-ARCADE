import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { stageAssets } from "../scripts/build-assets.ts";
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "arcade-assets-"));
  await mkdir(path.join(root, "public"), { recursive: true });
  await writeFile(path.join(root, "public/index.html"), "catalog");
  await mkdir(path.join(root, "games/demo/source/vendor"), { recursive: true });
  const m = {
    id: "demo",
    title: "Demo",
    aliases: [],
    tags: [],
    description: "Demo",
    players: { min: 2, max: 10 },
    version: "1.0.0",
    source: {
      status: "imported",
      paths: ["source/index.html"],
      provenance: "test",
      url: null,
    },
    lifecycle: "experimental",
    multiplayer: { status: "not-integrated", evidence: [] },
  };
  await writeFile(
    path.join(root, "games/demo/manifest.json"),
    JSON.stringify(m),
  );
  await writeFile(path.join(root, "games/demo/source/index.html"), "game");
  await writeFile(
    path.join(root, "games/demo/source/vendor/engine.js"),
    "engine",
  );
  return root;
}
test("stages runnable game and relative dependencies, cleans stale outputs on rebuild", async () => {
  const root = await fixture();
  try {
    const out = await stageAssets(root);
    assert.equal(
      await readFile(
        path.join(out, "games/demo/source/vendor/engine.js"),
        "utf8",
      ),
      "engine",
    );
    await writeFile(path.join(out, "stale.txt"), "stale");
    await stageAssets(root);
    await assert.rejects(readFile(path.join(out, "stale.txt")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("rejects source paths and directory links escaping the game package", async () => {
  const root = await fixture();
  try {
    await symlink(
      path.join(root, "public"),
      path.join(root, "games/demo/source/escape"),
      "junction",
    );
    await assert.rejects(stageAssets(root), /symlink|link/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("refuses to remove an unowned build directory", async () => {
  const root = await fixture();
  try {
    await mkdir(path.join(root, ".local/site-assets"), { recursive: true });
    await writeFile(path.join(root, ".local/site-assets/user.txt"), "keep");
    await assert.rejects(stageAssets(root), /owned|marker/i);
    assert.equal(
      await readFile(path.join(root, ".local/site-assets/user.txt"), "utf8"),
      "keep",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
