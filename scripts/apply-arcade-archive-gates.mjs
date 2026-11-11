import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "public", "arcade-games");
const outputRoot = path.resolve(process.env.ARCADE_CLIENT_DIR ?? path.join(root, "dist", "client", "arcade-games"));

function archiveEntries(source) {
  const start = source.indexOf("export const ARCHIVED_ARCADE_GAMES");
  const end = source.indexOf("];", start);
  if (start < 0 || end < 0) throw new Error("Could not find ARCHIVED_ARCADE_GAMES in lib/arcade/archived-games.ts");
  const entries = [];
  const block = source.slice(start, end);
  for (const match of block.matchAll(/\{\s*id:\s*"([a-z-]+)"[^\n]*?aliases:\s*\[([^\]]*)\]/gu)) {
    const id = match[1];
    const aliases = [...match[2].matchAll(/"([a-z-]+)"/gu)].map(alias => alias[1]);
    const title = block.slice(match.index, match.index + match[0].length).match(/title:\s*"([^"]+)"/u)?.[1] ?? id;
    if (!id || !/^[a-z-]+$/u.test(id) || aliases.some(alias => !/^[a-z-]+$/u.test(alias))) throw new Error("Invalid archived Arcade identifier");
    entries.push({ id, title, aliases });
  }
  if (!entries.length) throw new Error("No archived Arcade games found");
  return entries;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function scriptString(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

function noticePage(title, trustedHtml, gameId) {
  const guardedBootstrap = trustedHtml === null ? "" : `<script>(()=>{const original=${scriptString(trustedHtml)};if(window.parent===window)return;const p=new URLSearchParams(location.search);if(p.get("online")!=="1")return;let frame;try{frame=new URL(document.referrer)}catch{return}if(frame.origin!==location.origin)return;const match=frame.pathname.match(/^\\/arcade\\/online\\/(host|join|display)\\/([A-HJ-KM-NP-Z2-9]{4})$/);if(!match)return;const role=match[1]==="join"?"player":match[1];fetch("/api/arcade/online/rooms/"+match[2],{method:"GET",credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json","x-callback-online-role":role}}).then(async response=>{if(!response.ok)return;const room=await response.json();if(room.status!=="PLAYING"||room.gameId!==${scriptString(gameId)}||room.role!==role)return;document.open();document.write(original);document.close()}).catch(()=>{})})();</script>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#101a3b"><title>Game archived · King Prompter</title><style>*{box-sizing:border-box}html{color-scheme:dark;background:#101a3b;color:#fff4d6;font-family:system-ui,sans-serif}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:clamp(18px,5vw,48px)}main{width:min(100%,640px);padding:clamp(22px,5vw,42px);border:1px solid #526a9e;border-radius:22px;background:#1b2b4c;box-shadow:0 20px 70px #0005}p.kicker{margin:0 0 12px;color:#46dbdc;font-size:.75rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}h1{margin:0 0 14px;font-size:clamp(1.7rem,6vw,2.5rem);line-height:1.15;overflow-wrap:anywhere}p{line-height:1.6;color:#d3ddf1}a{display:inline-flex;align-items:center;min-height:48px;margin-top:8px;color:#ffd84b;font-weight:700;text-underline-offset:4px}a:focus-visible{outline:3px solid #8ed8ff;outline-offset:4px;border-radius:4px}</style></head><body><main><p class="kicker">Arcade update</p><h1>${escapeHtml(title)} is archived</h1><p>This Arcade game is unavailable for new play.</p><a href="/arcade">Return to the active Arcade</a></main>${guardedBootstrap}</body></html>`;
}

export async function applyArchiveGates({ archiveSource = path.join(root, "lib", "arcade", "archived-games.ts"), sourceDir = sourceRoot, clientDir = outputRoot } = {}) {
  const entries = archiveEntries(await readFile(archiveSource, "utf8"));
  for (const entry of entries) {
    for (const id of [entry.id, ...entry.aliases]) {
      const outputDir = path.join(clientDir, id);
      await mkdir(outputDir, { recursive: true });
      await writeFile(path.join(outputDir, "index.html"), noticePage(entry.title, null, entry.id), "utf8");

      const originalPath = path.join(sourceDir, id, "online-v65.html");
      let originalHtml;
      try { originalHtml = await readFile(originalPath, "utf8"); }
      catch (error) {
        if (error?.code !== "ENOENT") throw error;
        try { originalHtml = await readFile(path.join(outputDir, "online-v65.html"), "utf8"); }
        catch (outputError) { if (outputError?.code === "ENOENT") continue; throw outputError; }
      }
      await writeFile(path.join(outputDir, "online-v65.html"), noticePage(entry.title, originalHtml, entry.id), "utf8");
    }
  }
  return entries.reduce((count, entry) => count + 1 + entry.aliases.length, 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await applyArchiveGates();
  console.log(`Applied static archive gates to ${count} archived Arcade IDs and aliases.`);
}
