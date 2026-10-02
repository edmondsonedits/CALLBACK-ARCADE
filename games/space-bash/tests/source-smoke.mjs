import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(here, "..", "source", "index.html"), "utf8");

const checks = [
  ["version 1.13.1", /const VERSION="1\.13\.1-standalone"/],
  ["self-contained script", /<script>[\s\S]*\(function\(\)\{/],
  ["no external scripts", !/<script[^>]+src=/i.test(html)],
  ["no ES module import", !/\bimport\s+(?:[\w*{]|["'])/.test(html)],
  ["player range includes 10", /for\(let i=2;i<=10;i\+\+\)/],
  ["fixed 120 Hz simulation", /FIXED=1\/120/],
  ["pointer capture", /setPointerCapture/],
  ["keyboard controls", /KeyE/.test(html) && /KeyF/.test(html) && /Space/.test(html)],
  ["public SpaceBash API", /window\.SpaceBash=\{/],
  ["bot AI", /function ai\(f,dt\)/],
  ["destructible tiles", /function destroyTile\(x,z\)/],
  ["TNT and Nitro", /"tnt"/.test(html) && /"nitro"/.test(html)]
];
for (const [name, expected] of checks) {
  if (expected instanceof RegExp) assert.match(html, expected, name);
  else assert.equal(expected, true, name);
}
console.log("Space Bash source smoke checks passed (" + checks.length + ").");
