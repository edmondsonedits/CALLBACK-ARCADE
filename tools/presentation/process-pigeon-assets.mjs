import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const [inputPath, outputStem = "neutral"] = process.argv.slice(2);
if (!inputPath) throw new Error("Usage: node tools/presentation/process-pigeon-assets.mjs <green-source.png> [output-stem]");

const source = sharp(inputPath).removeAlpha();
const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(info.width * info.height * 4);

for (let sourceIndex = 0, targetIndex = 0; sourceIndex < data.length; sourceIndex += 3, targetIndex += 4) {
  const red = data[sourceIndex];
  const green = data[sourceIndex + 1];
  const blue = data[sourceIndex + 2];
  const greenExcess = green - Math.max(red, blue);
  const alpha = greenExcess >= 118 ? 0 : greenExcess <= 10 ? 255 : Math.round(255 * (118 - greenExcess) / 108);
  const despilledGreen = greenExcess > 0 ? Math.min(green, Math.max(red, blue) + 4) : green;
  rgba[targetIndex] = red;
  rgba[targetIndex + 1] = despilledGreen;
  rgba[targetIndex + 2] = blue;
  rgba[targetIndex + 3] = alpha;
}

await mkdir("assets/source/pigeon", { recursive: true });
await mkdir("public/media/pigeon", { recursive: true });
const keyed = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
const master = `assets/source/pigeon/pigeon-${outputStem}-master-2048.png`;
await keyed.clone().resize(2048, 2048, { fit: "fill", kernel: sharp.kernel.lanczos3 }).png({ compressionLevel: 9 }).toFile(master);
await sharp(master).resize(1024, 1024).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`public/media/pigeon/pigeon-${outputStem}.webp`);
await sharp(master).resize(1024, 1024).png({ compressionLevel: 9 }).toFile(`public/media/pigeon/pigeon-${outputStem}.png`);

const metadata = await sharp(master).metadata();
console.log(JSON.stringify({ master, width: metadata.width, height: metadata.height, channels: metadata.channels, hasAlpha: metadata.hasAlpha }, null, 2));
