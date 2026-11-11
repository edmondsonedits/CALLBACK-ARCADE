import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ffmpeg = process.env.AI_VIDEO_STUDIO_FFMPEG;
if (!ffmpeg) throw new Error("Set AI_VIDEO_STUDIO_FFMPEG to the project-local FFmpeg executable.");

const videoPath = resolve("public/media/grand-hall/grand-hall-menu-loop.mp4");
const posterPath = resolve("assets/source/grand-hall/poster-master-review-2560x1440.png");
const reportPath = resolve("assets/source/grand-hall-loop/qa-report.json");
const logDirectory = resolve(".logs/grand-hall-loop");
await mkdir(logDirectory, { recursive: true });

function run(args, options = {}) {
  const result = spawnSync(ffmpeg, args, { maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.status !== 0) {
    throw new Error(`FFmpeg failed (${result.status}): ${(result.stderr ?? "").toString()}`);
  }
  return result;
}

function rawFrame(input, selector, extraFilters = []) {
  const filters = [`select='eq(n,${selector})'`, ...extraFilters].join(",");
  return run([
    "-hide_banner", "-loglevel", "error", "-i", input,
    "-vf", filters, "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1",
  ]).stdout;
}

function compareRgb(left, right, width, region = { x: 0, y: 0, width, height: 1080 }) {
  let squaredError = 0;
  let absoluteError = 0;
  let samples = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const offset = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = left[offset + channel] - right[offset + channel];
        squaredError += delta * delta;
        absoluteError += Math.abs(delta);
        samples += 1;
      }
    }
  }
  const mse = squaredError / samples;
  return {
    meanAbsoluteError: Number((absoluteError / samples).toFixed(4)),
    psnrDb: mse === 0 ? null : Number((10 * Math.log10((255 * 255) / mse)).toFixed(3)),
    exact: mse === 0,
  };
}

const inspection = run(["-hide_banner", "-i", videoPath, "-f", "null", "NUL"], { encoding: "utf8" });
const progress = run([
  "-hide_banner", "-loglevel", "error", "-i", videoPath,
  "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "NUL", "-progress", "pipe:1", "-nostats",
], { encoding: "utf8" }).stdout;
const decodedFrames = Number(progress.match(/frame=(\d+)/g)?.at(-1)?.split("=")[1] ?? 0);
if (decodedFrames < 2) throw new Error(`Expected a complete video decode; received ${decodedFrames} frames.`);

const frame0 = rawFrame(videoPath, 0);
const finalFrame = rawFrame(videoPath, decodedFrames - 1);
const poster = run([
  "-hide_banner", "-loglevel", "error", "-i", posterPath,
  "-vf", "scale=1944:1094:flags=lanczos,crop=1920:1080:12:7",
  "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1",
]).stdout;

const audioBytes = run([
  "-hide_banner", "-loglevel", "error", "-i", videoPath,
  "-map", "0:a:0", "-f", "f32le", "-ac", "2", "-ar", "48000", "pipe:1",
]).stdout;
const audio = new Float32Array(audioBytes.buffer, audioBytes.byteOffset, Math.floor(audioBytes.byteLength / 4));
const firstLeft = audio[0];
const firstRight = audio[1];
const lastLeft = audio[audio.length - 2];
const lastRight = audio[audio.length - 1];
const boundaryJump = Math.max(Math.abs(firstLeft - lastLeft), Math.abs(firstRight - lastRight));
const windowSamples = 960 * 2;
let firstWindowEnergy = 0;
let lastWindowEnergy = 0;
let adjacentDeltaEnergy = 0;
for (let index = 0; index < windowSamples; index += 1) {
  firstWindowEnergy += audio[index] ** 2;
  lastWindowEnergy += audio[audio.length - windowSamples + index] ** 2;
  if (index >= 2) adjacentDeltaEnergy += (audio[index] - audio[index - 2]) ** 2;
}
const adjacentDeltaRms = Math.sqrt(adjacentDeltaEnergy / Math.max(windowSamples - 2, 1));

const videoBytes = await readFile(videoPath);
const moovPosition = videoBytes.indexOf(Buffer.from("moov"));
const mdatPosition = videoBytes.indexOf(Buffer.from("mdat"));
const centralRegion = { x: Math.round(1920 * 0.16), y: Math.round(1080 * 0.14), width: Math.round(1920 * 0.68), height: Math.round(1080 * 0.70) };

const coverSizes = [[1366, 768], [1920, 1080], [2560, 1440], [390, 844], [375, 450]];
for (const [width, height] of coverSizes) {
  run([
    "-hide_banner", "-loglevel", "error", "-y", "-i", videoPath,
    "-vf", `select='eq(n,192)',scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`,
    "-frames:v", "1", resolve(logDirectory, `final-cover-${width}x${height}.png`),
  ]);
}

const metadataText = inspection.stderr;
const report = {
  generated: new Date().toISOString(),
  source: "Candidate A / poster-master-review-2560x1440.png",
  selectedTreatment: "Stage Breath",
  delivery: {
    path: "public/media/grand-hall/grand-hall-menu-loop.mp4",
    bytes: videoBytes.length,
    megabytes: Number((videoBytes.length / 1_000_000).toFixed(3)),
    sha256: createHash("sha256").update(videoBytes).digest("hex"),
    completeDecode: true,
    fastStart: moovPosition >= 0 && mdatPosition >= 0 && moovPosition < mdatPosition,
    h264: /Video: h264/.test(metadataText),
    aac: /Audio: aac/.test(metadataText),
    yuv420p: /yuv420p/.test(metadataText),
    resolution1920x1080: /1920x1080/.test(metadataText),
    fps24: /24 fps/.test(metadataText),
    decodedFrames,
    decodedDuration: progress.match(/out_time=([^\r\n]+)/)?.[1] ?? null,
  },
  visualSeam: {
    firstVsLastFullFrame: compareRgb(frame0, finalFrame, 1920),
    firstVsLastCentralQuietArea: compareRgb(frame0, finalFrame, 1920, centralRegion),
  },
  posterMatch: {
    firstFrameVsApprovedPosterFullFrame: compareRgb(frame0, poster, 1920),
    firstFrameVsApprovedPosterCentralQuietArea: compareRgb(frame0, poster, 1920, centralRegion),
  },
  audioSeam: {
    decodedSamplesPerChannel: audio.length / 2,
    boundaryPeakJump: Number(boundaryJump.toFixed(8)),
    first20msRms: Number(Math.sqrt(firstWindowEnergy / windowSamples).toFixed(8)),
    last20msRms: Number(Math.sqrt(lastWindowEnergy / windowSamples).toFixed(8)),
    typicalAdjacentSampleDeltaRms: Number(adjacentDeltaRms.toFixed(8)),
    boundaryJumpToTypicalDeltaRatio: Number((boundaryJump / Math.max(adjacentDeltaRms, 1e-12)).toFixed(4)),
  },
  responsiveCoverEvidence: coverSizes.map(([width, height]) => `.logs/grand-hall-loop/final-cover-${width}x${height}.png`),
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
