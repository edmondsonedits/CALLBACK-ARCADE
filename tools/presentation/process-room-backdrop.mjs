import { mkdir } from "node:fs/promises";
import { basename } from "node:path";
import sharp from "sharp";

const [inputPath, slug] = process.argv.slice(2);
if (!inputPath || !slug) throw new Error("Usage: node tools/presentation/process-room-backdrop.mjs <source.png> <room-slug>");

await mkdir(`assets/source/rooms/${slug}`, { recursive: true });
await mkdir(`public/media/rooms/${slug}`, { recursive: true });
const sourceCopy = `assets/source/rooms/${slug}/${slug}-native-${basename(inputPath)}`;
await sharp(inputPath).png({ compressionLevel: 9 }).toFile(sourceCopy);

const variants = [[2560, 1440], [1920, 1080], [1280, 720]];
const files = [];
for (const [width, height] of variants) {
  const base = sharp(inputPath).resize(width, height, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 });
  const avifPath = `public/media/rooms/${slug}/${slug}-${width}x${height}.avif`;
  const webpPath = `public/media/rooms/${slug}/${slug}-${width}x${height}.webp`;
  await base.clone().avif({ quality: width === 2560 ? 58 : 62, effort: 7, chromaSubsampling: "4:2:0" }).toFile(avifPath);
  await base.clone().webp({ quality: width === 2560 ? 78 : 82, effort: 6, smartSubsample: true }).toFile(webpPath);
  const [avif, webp] = await Promise.all([sharp(avifPath).metadata(), sharp(webpPath).metadata()]);
  files.push({ avifPath, width: avif.width, height: avif.height }, { webpPath, width: webp.width, height: webp.height });
}
console.log(JSON.stringify({ slug, sourceCopy, files }, null, 2));
