import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const transferFile = option("--transfer");
const ffmpeg = option("--ffmpeg");
if (!transferFile || !ffmpeg || !existsSync(ffmpeg)) throw new Error("Provide --transfer and an installed --ffmpeg path.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowedDownloads = realpathSync(option("--downloads-root") || "C:\\Users\\Danny's Ultimate PC\\Downloads");
const transfer = JSON.parse(readFileSync(transferFile, "utf8"));
const selection = new Map(transfer.selection.map((clip) => [clip.id, clip]));
const outputDirectory = join(root, "public", "media", "audio");
const receiptFile = join(root, "assets", "source", "audio", "approved-import.json");
mkdirSync(outputDirectory, { recursive: true });
mkdirSync(dirname(receiptFile), { recursive: true });
const previous = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, "utf8")) : { files: [] };
const files = new Map(previous.files.map((file) => [file.id, file]));
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const within = (base, target) => { const part = relative(base, target); return part !== "" && !part.startsWith("..") && !isAbsolute(part); };
const assertDownloadPath = (file) => {
  const actual = realpathSync(file);
  if (!within(allowedDownloads, actual) || extname(actual).toLowerCase() !== ".mp3") throw new Error("Refusing a source outside the authorized Downloads MP3 files.");
  return actual;
};
const classify = (title) => {
  const value = title.toLowerCase();
  if (value.includes("music")) return { category: "music", role: /music 0[12]/.test(value) ? "menu" : value.includes("music 03") ? "thinking" : value.includes("music 04") ? "voting" : value.includes("music 06") ? "results" : "game" };
  if (value.includes("tavern")) return { category: "ambience", role: "tavern" };
  if (value.includes("countdown")) return { category: "countdown", role: value.includes("urgent") ? "countdown-urgent" : "countdown-light" };
  const rules = [
    [/submission seal|sfx 01/, "response-lock"], [/vote received|sfx 02/, "vote-lock"],
    [/player join|sfx 03/, "join"], [/scroll reveal|sfx 04/, "reveal"],
    [/card landing|sfx 05/, "card"], [/round opening|sfx 06/, "round"],
    [/all votes locked|wooden latch|sfx 07/, "all-votes"], [/timer tick/, "timer"],
    [/time up/, "time-up"], [/score/, "score"], [/winner crown/, "winner"],
    [/royal tie/, "tie"], [/pigeon/, "pigeon"], [/comic stumble/, "comic"],
  ];
  const role = rules.find(([pattern]) => pattern.test(value))?.[1];
  if (!role) throw new Error(`Unclassified approved clip: ${title}`);
  return { category: "effect", role };
};
const limits = { "response-lock": .48, "vote-lock": .28, join: .95, reveal: 1.1, card: .5, round: 2.8, "all-votes": .7, timer: .18, "time-up": 1.4, score: .65, winner: 3.4, tie: 2.8, pigeon: 1.4, comic: 1.8 };
const run = (parameters, binary = false) => {
  const result = spawnSync(ffmpeg, parameters, { encoding: binary ? null : "utf8", maxBuffer: 32 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw new Error(`FFmpeg failed: ${String(result.stderr).slice(-900)}`);
  return result.stdout;
};
let imported = 0;
for (const download of transfer.downloads) {
  const clip = selection.get(download.id);
  if (!clip || !/^[0-9a-f-]{36}$/i.test(clip.id)) throw new Error("Download does not match an explicitly liked source ID.");
  const existing = files.get(clip.id);
  const source = existsSync(download.path) ? assertDownloadPath(download.path) : null;
  if (existing && existsSync(join(root, "public", existing.src.replace(/^\//, ""))) && hash(join(root, "public", existing.src.replace(/^\//, ""))) === existing.sha256) continue;
  if (!source) throw new Error(`Missing downloaded source: ${clip.title}`);
  const sourceSha256 = hash(source);
  const { category, role } = classify(clip.title);
  const pcm = run(["-v", "error", "-i", source, "-ac", "1", "-ar", "24000", "-f", "f32le", "pipe:1"], true);
  const sampleCount = Math.floor(pcm.length / 4);
  if (!sampleCount) throw new Error(`No decodable audio: ${clip.title}`);
  const fullDuration = sampleCount / 24000;
  let peak = 0;
  for (let sample = 0; sample < sampleCount; sample += 1) peak = Math.max(peak, Math.abs(pcm.readFloatLE(sample * 4)));
  if (peak < .0001) throw new Error(`Silent approved source: ${clip.title}`);
  let start = 0;
  if (category === "effect") {
    const threshold = Math.max(.001, peak * .025);
    let first = 0;
    while (first < sampleCount && Math.abs(pcm.readFloatLE(first * 4)) < threshold) first += 1;
    start = Math.max(0, first / 24000 - .014);
  }
  const duration = Math.min(fullDuration - start, category === "effect" ? (limits[role] || 1) : fullDuration);
  const boundary = category === "music" ? .45 : category === "effect" ? Math.min(.045, duration / 4) : .025;
  const attack = category === "effect" ? Math.min(.006, duration / 6) : boundary;
  const normalization = category === "music" ? "loudnorm=I=-19:TP=-3:LRA=7" : `volume=${Math.min(4, .501187 / peak).toFixed(6)}`;
  const filters = [`atrim=start=${start.toFixed(6)}:duration=${duration.toFixed(6)}`, "asetpts=PTS-STARTPTS", normalization, `afade=t=in:st=0:d=${attack.toFixed(6)}`, `afade=t=out:st=${Math.max(attack, duration-boundary).toFixed(6)}:d=${boundary.toFixed(6)}`].join(",");
  const filename = `suno-${role}-${clip.id.slice(0,8)}.mp3`;
  const target = join(outputDirectory, filename);
  run(["-y", "-v", "error", "-i", source, "-map_metadata", "0", "-af", filters, "-ac", category === "music" ? "2" : "1", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", category === "music" ? "128k" : "96k", target]);
  run(["-v", "error", "-i", target, "-f", "null", "-"]);
  const gain = category === "music" ? 1 : category === "ambience" ? .12 : category === "countdown" ? .18 : .3;
  files.set(clip.id, { id: clip.id, title: clip.title, src: `/media/audio/${filename}`, category, role, gain, durationSeconds: Number(duration.toFixed(3)), sourceUrl: `https://suno.com${clip.url}`, sourceSha256, sha256: hash(target), sourceFilename: download.path.split(/[\\/]/).pop(), sourceDurationSeconds: Number(fullDuration.toFixed(3)), trimStartSeconds: Number(start.toFixed(3)) });
  imported += 1;
}
const records = [...files.values()].sort((a,b) => a.category.localeCompare(b.category) || a.role.localeCompare(b.role) || a.id.localeCompare(b.id));
const manifest = records.map(({id,src,title,category,role,durationSeconds,gain}) => ({id,src,title,category,role,durationSeconds,gain}));
writeFileSync(join(root,"lib","game","audio-library.ts"), `// Generated by scripts/import-approved-audio.mjs from explicitly liked Suno clips.\nexport interface ApprovedAudioClip {\n  id: string;\n  src: string;\n  title: string;\n  category: "music" | "effect" | "ambience" | "countdown";\n  role: string;\n  durationSeconds: number;\n  gain: number;\n}\n\nexport const APPROVED_AUDIO: readonly ApprovedAudioClip[] = ${JSON.stringify(manifest,null,2)};\n`);
const receipt = { importedAt: new Date().toISOString(), workspaceUrl: "https://suno.com/create?wid=e90eaade-07c5-4524-8387-3214aca735df", selectedCount: selection.size, likedCount: transfer.likedInventory?.length ?? selection.size, skippedIds: transfer.skippedIds ?? [], importedCount: records.length, missingIds: [...selection.keys()].filter(id=>!files.has(id)), files: records };
writeFileSync(receiptFile, JSON.stringify(receipt,null,2)+"\n");
let removed = 0;
if (args.includes("--cleanup-downloads")) {
  for (const download of transfer.downloads) {
    if (!existsSync(download.path)) continue;
    const record = files.get(download.id);
    if (!record || hash(join(root,"public",record.src.replace(/^\//,""))) !== record.sha256) throw new Error("Imported copy did not verify; keeping Downloads original.");
    const source = assertDownloadPath(download.path);
    if (hash(source) !== record.sourceSha256) throw new Error("Downloads original changed; refusing deletion.");
    unlinkSync(source);
    removed += 1;
  }
}
console.log(JSON.stringify({ selected:selection.size, imported:records.length, newlyImported:imported, missing:receipt.missingIds.length, downloadsRemoved:removed, byCategory:records.reduce((counts,clip)=>({...counts,[clip.category]:(counts[clip.category]||0)+1}),{}) }));

