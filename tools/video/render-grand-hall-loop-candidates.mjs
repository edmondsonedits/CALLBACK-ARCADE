import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ffmpeg = process.env.AI_VIDEO_STUDIO_FFMPEG;
if (!ffmpeg) throw new Error("Set AI_VIDEO_STUDIO_FFMPEG to the project-local FFmpeg executable.");

const seconds = 16;
const fps = 24;
const frameCount = seconds * fps;
const poster = resolve("assets/source/grand-hall/poster-master-review-2560x1440.png");
const light = resolve("assets/source/grand-hall-loop/support/cyan-light-shafts.png");
const dust = resolve("assets/source/grand-hall-loop/support/dust.png");
const audio = resolve("assets/source/grand-hall-loop/support/periodic-room-tone.wav");
const outputDirectory = resolve("assets/source/grand-hall-loop/candidates");
await mkdir(outputDirectory, { recursive: true });

const variants = [
  {
    name: "candidate-1-stage-breath.mp4",
    label: "Stage Breath",
    baseX: "12+1.5*sin(2*PI*n/384)",
    baseY: "7+0.8*cos(2*PI*n/384)",
    curtain: 1.5,
    light: 5,
    dust: 6,
    overlayAlpha: 0.72,
  },
  {
    name: "candidate-2-curtain-drift.mp4",
    label: "Curtain Drift",
    baseX: "12+0.6*sin(2*PI*n/384)",
    baseY: "7+0.4*cos(2*PI*n/384)",
    curtain: 2.8,
    light: 11,
    dust: 9,
    overlayAlpha: 0.86,
  },
];

for (const variant of variants) {
  const filters = [
    `[0:v]scale=1944:1094:flags=lanczos,crop=1920:1080:x='${variant.baseX}':y='${variant.baseY}',fps=${fps},split=3[base][leftsrc][rightsrc]`,
    `[leftsrc]crop=360:1080:0:0,format=rgba,colorchannelmixer=aa=0.16[left]`,
    `[rightsrc]crop=360:1080:1560:0,format=rgba,colorchannelmixer=aa=0.16[right]`,
    `[base][left]overlay=x='${variant.curtain}*sin(2*PI*n/${frameCount})':y=0:eval=frame[withleft]`,
    `[withleft][right]overlay=x='1560-${variant.curtain}*sin(2*PI*n/${frameCount})':y=0:eval=frame[withcurtains]`,
    `[1:v]crop=1920:1080:x='64+${variant.light}*sin(2*PI*n/${frameCount})':y='36+2*cos(2*PI*n/${frameCount})',format=rgba,colorchannelmixer=aa=${variant.overlayAlpha}[light]`,
    `[2:v]crop=1920:1080:x='64+${variant.dust}*sin(2*PI*n/${frameCount})':y='36-${variant.dust}*cos(2*PI*n/${frameCount})',format=rgba,colorchannelmixer=aa=0.74[dust]`,
    `[withcurtains][light]overlay=0:0:eval=frame[lit]`,
    `[lit][dust]overlay=0:0:eval=frame,format=yuv420p[outv]`,
  ].join(";");

  const result = spawnSync(ffmpeg, [
    "-hide_banner", "-loglevel", "warning", "-y",
    "-loop", "1", "-framerate", String(fps), "-i", poster,
    "-loop", "1", "-framerate", String(fps), "-i", light,
    "-loop", "1", "-framerate", String(fps), "-i", dust,
    "-i", audio,
    "-filter_complex", filters,
    "-map", "[outv]", "-map", "3:a:0",
    "-t", String(seconds), "-r", String(fps),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-maxrate", "6M", "-bufsize", "12M",
    "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
    "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart", resolve(outputDirectory, variant.name),
  ], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${variant.label} render failed with status ${result.status}.`);
  console.log(`Rendered ${variant.label}: ${resolve(outputDirectory, variant.name)}`);
}
