export type FishVolumePixels = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type FishVolumeAnchors = {
  head: { x: number; y: number };
  body: { x: number; y: number };
  tail: { x: number; y: number };
};

const GRID_X = 16;
const GRID_Y = 12;
const GRID_SIZE = (GRID_X + 1) * (GRID_Y + 1);
const THICKNESS = 0.1;
const BODY_RADIUS_X = 0.23;
const BODY_RADIUS_Y = 0.22;
const EDGE_FADE_WIDTH = 0.08;

/** Builds two UV-identical fish shells with a small, body-weighted volume. */
export function buildFishVolume(
  pixels: FishVolumePixels,
  anchors: FishVolumeAnchors,
): { vertices: Float32Array; indices: Uint16Array } {
  const width = Number.isFinite(pixels.width) ? Math.max(1, Math.floor(pixels.width)) : 1;
  const height = Number.isFinite(pixels.height) ? Math.max(1, Math.floor(pixels.height)) : 1;
  const alpha = new Uint8Array(GRID_SIZE);
  const uv = new Float32Array(GRID_SIZE * 2);
  const depth = new Float32Array(GRID_SIZE);

  for (let y = 0; y <= GRID_Y; y++) {
    const v = y / GRID_Y;
    const py = Math.min(height - 1, Math.round(v * (height - 1)));
    for (let x = 0; x <= GRID_X; x++) {
      const u = x / GRID_X;
      const index = y * (GRID_X + 1) + x;
      const px = Math.min(width - 1, Math.round(u * (width - 1)));
      uv[index * 2] = u;
      uv[index * 2 + 1] = v;
      const pixelOffset = (py * width + px) * 4;
      alpha[index] = pixels.data.length > pixelOffset + 3 ? pixels.data[pixelOffset + 3]! : 0;
    }
  }

  const bodyX = Number.isFinite(anchors.body.x) ? anchors.body.x : 0.5;
  const bodyY = Number.isFinite(anchors.body.y) ? anchors.body.y : 0.5;
  const heightInWidthUnits = height / width;
  for (let y = 0; y <= GRID_Y; y++) {
    for (let x = 0; x <= GRID_X; x++) {
      const index = y * (GRID_X + 1) + x;
      if (alpha[index]! === 0) continue;

      let nearestTransparent = Number.POSITIVE_INFINITY;
      for (let otherY = 0; otherY <= GRID_Y; otherY++) {
        for (let otherX = 0; otherX <= GRID_X; otherX++) {
          const other = otherY * (GRID_X + 1) + otherX;
          if (alpha[other]! !== 0) continue;
          const dx = (otherX - x) / GRID_X;
          const dy = ((otherY - y) / GRID_Y) * heightInWidthUnits;
          const distance = Math.hypot(dx, dy);
          if (distance < nearestTransparent) nearestTransparent = distance;
        }
      }

      // Treat the outside of the sampled image as transparent for fully opaque inputs.
      if (!Number.isFinite(nearestTransparent)) {
        nearestTransparent = Math.min(
          (x + 1) / GRID_X,
          (GRID_X - x + 1) / GRID_X,
          ((y + 1) / GRID_Y) * heightInWidthUnits,
          ((GRID_Y - y + 1) / GRID_Y) * heightInWidthUnits,
        );
      }

      const u = uv[index * 2]!;
      const v = uv[index * 2 + 1]!;
      const ellipse = ((u - bodyX) / BODY_RADIUS_X) ** 2 + ((v - bodyY) / BODY_RADIUS_Y) ** 2;
      const bodyWeight = Math.max(0, 1 - ellipse);
      const edgeWeight = Math.min(1, nearestTransparent / EDGE_FADE_WIDTH);
      depth[index] = Math.min(THICKNESS, THICKNESS * bodyWeight * edgeWeight);
    }
  }

  const vertices = new Float32Array(GRID_SIZE * 2 * 3);
  for (let face = 0; face < 2; face++) {
    const sign = face === 0 ? 1 : -1;
    for (let i = 0; i < GRID_SIZE; i++) {
      const output = (face * GRID_SIZE + i) * 3;
      vertices[output] = uv[i * 2]!;
      vertices[output + 1] = uv[i * 2 + 1]!;
      vertices[output + 2] = depth[i]! * sign;
    }
  }

  const indices = new Uint16Array(GRID_X * GRID_Y * 6 * 2);
  let out = 0;
  for (let y = 0; y < GRID_Y; y++) {
    for (let x = 0; x < GRID_X; x++) {
      const a = y * (GRID_X + 1) + x;
      const b = a + 1;
      const d = a + GRID_X + 1;
      const c = d + 1;
      const back = GRID_SIZE;
      indices[out++] = a; indices[out++] = b; indices[out++] = c;
      indices[out++] = a; indices[out++] = c; indices[out++] = d;
      indices[out++] = back + a; indices[out++] = back + c; indices[out++] = back + b;
      indices[out++] = back + a; indices[out++] = back + d; indices[out++] = back + c;
    }
  }
  return { vertices, indices };
}
