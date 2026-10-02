import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  realpath,
  lstat,
  copyFile,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateManifest, type GameManifest } from "../src/catalog.ts";
import { validateManifestFiles } from "./manifest-files.ts";
const MARKER = ".arcade-generated";
async function replaceDirectory(from:string,to:string):Promise<void>{
  for(let attempt=0;;attempt++){
    try{await rename(from,to);return;}
    catch(error){if(attempt>=3||!['EPERM','EBUSY'].includes((error as NodeJS.ErrnoException).code||''))throw error;await new Promise(resolve=>setTimeout(resolve,200));}
  }
}
async function copyTree(
  from: string,
  to: string,
  boundary: string,
): Promise<void> {
  const entry = await lstat(from);
  if (entry.isSymbolicLink())
    throw Error(`symlink not allowed in packaged assets: ${from}`);
  const actual = await realpath(from);
  if (actual !== boundary && !actual.startsWith(boundary + path.sep))
    throw Error("asset path escapes package");
  if (entry.isDirectory()) {
    await mkdir(to, { recursive: true });
    for (const child of await readdir(from)) {
      if (
        child === "original" ||
        child.startsWith("original-") ||
        child.startsWith(".")
      )
        continue;
      await copyTree(path.join(from, child), path.join(to, child), boundary);
    }
  } else if (entry.isFile()) {
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
  }
}
export async function stageAssets(directory = process.cwd()): Promise<string> {
  const root = await realpath(directory);
  const local = path.join(root, ".local");
  await mkdir(local, { recursive: true });
  if ((await realpath(local)) !== local)
    throw Error("build directory link is unsafe");
  const output = path.join(local, "site-assets");
  try {
    await lstat(output);
    if ((await realpath(output)) !== output)
      throw Error("build output link is unsafe");
    if (
      (await readFile(path.join(output, MARKER), "utf8")) !==
      "callback-arcade-build-v1"
    )
      throw Error("build directory is not owned");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    try {
      await lstat(output);
      throw Error("existing build directory has no ownership marker");
    } catch (inner) {
      if ((inner as NodeJS.ErrnoException).code !== "ENOENT") throw inner;
    }
  }
  const staging = await mkdtemp(path.join(local, "site-assets-"));
  try {
    const publicRoot = path.join(root, "public");
    await copyTree(publicRoot, staging, await realpath(publicRoot));
    const games = path.join(root, "games");
    for (const id of await readdir(games)) {
      if (id.startsWith("_") || id.startsWith(".")) continue;
      const game = path.join(games, id);
      if (!(await lstat(game)).isDirectory()) continue;
      if ((await realpath(game)) !== game)
        throw Error("game directory link is unsafe");
      const manifest = JSON.parse(
        await readFile(path.join(game, "manifest.json"), "utf8"),
      ) as GameManifest;
      const errors = [
        ...validateManifest(manifest, `games/${id}`),
        ...(await validateManifestFiles(root, `games/${id}`, manifest)),
      ];
      if (errors.length) throw Error(errors.join("; "));
      if (
        manifest.source.status !== "imported" ||
        manifest.lifecycle === "archived"
      )
        continue;
      for (const folder of ["source", "assets"]) {
        const src = path.join(game, folder);
        try {
          await lstat(src);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw e;
        }
        await copyTree(src, path.join(staging, "games", id, folder), game);
      }
    }
    // Tiny local QR runtime; no external QR service receives room links.
    const qr = path.join(root, "node_modules/qrcode-generator/dist/qrcode.js");
    try {
      await lstat(qr);
      await mkdir(path.join(staging, "vendor"), { recursive: true });
      await copyFile(qr, path.join(staging, "vendor/qrcode.js"));
      await copyFile(
        path.join(root, "node_modules/qrcode-generator/README.md"),
        path.join(staging, "vendor/QR-NOTICE.md"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    await writeFile(path.join(staging, MARKER), "callback-arcade-build-v1");
    const previous = `${staging}-previous`;
    let movedPrevious = false;
    try {
      await lstat(output);
      if (path.dirname(output) !== local || (await realpath(output)) !== output)
        throw Error("unsafe build cleanup");
      // A running Windows preview locks this directory. Rename fails before
      // touching its contents, preserving the last working package.
      await replaceDirectory(output, previous);
      movedPrevious = true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    try {
      await replaceDirectory(staging, output);
    } catch (error) {
      if (movedPrevious) await replaceDirectory(previous, output);
      throw error;
    }
    if (movedPrevious) {
      if (
        path.dirname(previous) !== local ||
        (await realpath(previous)) !== previous ||
        (await readFile(path.join(previous, MARKER), "utf8")) !==
          "callback-arcade-build-v1"
      )
        throw Error("unsafe prior build cleanup");
      await rm(previous, { recursive: true, force: true });
    }
    return output;
  } finally {
    try {
      await lstat(staging);
      if (
        path.dirname(staging) !== local ||
        (await realpath(staging)) !== staging
      )
        throw Error("unsafe staging cleanup");
      await rm(staging, { recursive: true, force: true });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  console.log(`Packaged assets: ${await stageAssets()}`);
