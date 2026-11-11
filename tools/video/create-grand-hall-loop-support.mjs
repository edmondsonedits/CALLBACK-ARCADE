import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const WIDTH = 2048;
const HEIGHT = 1152;
const LOOP_SECONDS = 16;
const SAMPLE_RATE = 48_000;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function writePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    rows[rowOffset] = 0;
    pixels.copy(rows, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createLightShafts() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  const shafts = [
    { origin: 280, slope: 0.25, width: 105, alpha: 15 },
    { origin: 1640, slope: -0.22, width: 125, alpha: 13 },
    { origin: 920, slope: 0.08, width: 150, alpha: 7 },
  ];
  for (let y = 0; y < HEIGHT; y += 1) {
    const verticalFade = Math.max(0, 1 - y / (HEIGHT * 0.88));
    for (let x = 0; x < WIDTH; x += 1) {
      let alpha = 0;
      for (const shaft of shafts) {
        const center = shaft.origin + shaft.slope * y;
        const distance = (x - center) / shaft.width;
        alpha += shaft.alpha * Math.exp(-distance * distance * 0.5) * verticalFade;
      }
      if (alpha < 0.35) continue;
      const offset = (y * WIDTH + x) * 4;
      pixels[offset] = 70;
      pixels[offset + 1] = 219;
      pixels[offset + 2] = 220;
      pixels[offset + 3] = Math.min(23, Math.round(alpha));
    }
  }
  return writePng(WIDTH, HEIGHT, pixels);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function createDust() {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  const random = seededRandom(0x4b50524d);
  for (let particle = 0; particle < 74; particle += 1) {
    const x = Math.floor(random() * WIDTH);
    const y = Math.floor(random() * HEIGHT);
    const radius = random() < 0.82 ? 1 : 2;
    const alpha = 10 + Math.floor(random() * 22);
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > radius + 0.15) continue;
        const offset = (py * WIDTH + px) * 4;
        pixels[offset] = 255;
        pixels[offset + 1] = 239;
        pixels[offset + 2] = 190;
        pixels[offset + 3] = Math.max(pixels[offset + 3], Math.round(alpha * (1 - distance / (radius + 0.8))));
      }
    }
  }
  return writePng(WIDTH, HEIGHT, pixels);
}

function createPeriodicRoomTone() {
  const sampleCount = SAMPLE_RATE * LOOP_SECONDS;
  const channelCount = 2;
  const bitsPerSample = 16;
  const data = Buffer.alloc(sampleCount * channelCount * 2);
  const partials = [
    [880, 0.012], [1760, 0.004], [2640, 0.0025],
    [97, 0.006], [131, 0.004], [173, 0.003], [223, 0.002],
  ];
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const phase = sample / SAMPLE_RATE / LOOP_SECONDS;
    let left = 0;
    let right = 0;
    for (let index = 0; index < partials.length; index += 1) {
      const [cycles, amplitude] = partials[index];
      const angle = Math.PI * 2 * cycles * phase;
      left += Math.sin(angle + index * 0.71) * amplitude;
      right += Math.sin(angle + index * 0.71 + (index % 2 ? 0.18 : -0.13)) * amplitude;
    }
    const slowBreath = 0.72 + 0.16 * Math.sin(Math.PI * 2 * 2 * phase - 0.4);
    const boundaryDistance = Math.min(sample / SAMPLE_RATE, LOOP_SECONDS - sample / SAMPLE_RATE);
    const boundaryProgress = Math.min(1, boundaryDistance / 0.35);
    const seamEnvelope = Math.sin(boundaryProgress * Math.PI / 2) ** 2;
    const shimmer = Math.sin(Math.PI * 2 * 3520 * phase + 1.1) * 0.0018 * (0.5 + 0.5 * Math.sin(Math.PI * 2 * phase));
    left = Math.max(-1, Math.min(1, (left * slowBreath + shimmer) * seamEnvelope));
    right = Math.max(-1, Math.min(1, (right * slowBreath + shimmer) * seamEnvelope));
    data.writeInt16LE(Math.round(left * 32767), sample * 4);
    data.writeInt16LE(Math.round(right * 32767), sample * 4 + 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channelCount, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * channelCount * bitsPerSample / 8, 28);
  header.writeUInt16LE(channelCount * bitsPerSample / 8, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const outputDirectory = resolve("assets/source/grand-hall-loop/support");
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, "cyan-light-shafts.png"), createLightShafts()),
  writeFile(resolve(outputDirectory, "dust.png"), createDust()),
  writeFile(resolve(outputDirectory, "periodic-room-tone.wav"), createPeriodicRoomTone()),
]);

console.log(`Created deterministic loop support assets in ${outputDirectory}`);
