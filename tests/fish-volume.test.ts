import assert from "node:assert/strict";
import test from "node:test";
import { buildFishVolume } from "../lib/fish-volume";

const anchors = {
  head: { x: 0.25, y: 0.5 },
  body: { x: 0.5, y: 0.5 },
  tail: { x: 0.82, y: 0.5 },
};

function image(width: number, height: number, opaque: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = 30; data[i + 1] = 100; data[i + 2] = 220;
    data[i + 3] = opaque(x, y) ? 255 : 0;
  }
  return { width, height, data };
}

test("transparent input produces a bounded finite flat double shell", () => {
  const { vertices, indices } = buildFishVolume(image(64, 48, () => false), anchors);
  assert.equal(vertices.length, 17 * 13 * 2 * 3);
  assert.equal(indices.length, 16 * 12 * 6 * 2);
  assert.ok(indices instanceof Uint16Array);
  assert.ok([...vertices].every(Number.isFinite));
  assert.ok([...vertices].every((_, i) => i % 3 !== 2 || vertices[i] === 0));
  assert.ok(Math.max(...indices) < vertices.length / 3);
});

test("opaque body receives positive bounded mirrored thickness with matching UVs", () => {
  const { vertices } = buildFishVolume(image(128, 96, (x, y) => {
    const dx = (x / 127 - 0.5) / 0.23;
    const dy = (y / 95 - 0.5) / 0.22;
    return dx * dx + dy * dy <= 1;
  }), anchors);
  const perFace = 17 * 13;
  let bodyIndex = -1;
  for (let i = 0; i < perFace; i++) {
    const offset = i * 3;
    if (Math.abs(vertices[offset]! - 0.5) < 0.02 && Math.abs(vertices[offset + 1]! - 0.5) < 0.02) { bodyIndex = i; break; }
  }
  assert.notEqual(bodyIndex, -1);
  const front = bodyIndex * 3;
  const back = (perFace + bodyIndex) * 3;
  assert.ok(vertices[front + 2]! > 0);
  assert.ok(vertices[front + 2]! <= 0.100001);
  assert.equal(vertices[back], vertices[front]);
  assert.equal(vertices[back + 1], vertices[front + 1]);
  assert.equal(vertices[back + 2], -vertices[front + 2]!);
});

test("external fins and a transparent hole remain flat while body stays thick", () => {
  const { vertices } = buildFishVolume(image(128, 96, (x, y) => {
    const u = x / 127; const v = y / 95;
    const body = ((u - 0.5) / 0.23) ** 2 + ((v - 0.5) / 0.22) ** 2 <= 1;
    const fin = u > 0.65 && u < 0.88 && v > 0.18 && v < 0.3;
    const hole = ((u - 0.5) / 0.055) ** 2 + ((v - 0.5) / 0.065) ** 2 < 1;
    return (body || fin) && !hole;
  }), anchors);
  const perFace = 17 * 13;
  const zAt = (face: number, u: number, v: number) => {
    const x = Math.round(u * 16); const y = Math.round(v * 12);
    return vertices[(face * perFace + y * 17 + x) * 3 + 2]!;
  };
  assert.ok(zAt(0, 0.375, 0.5) > 0);
  assert.equal(zAt(0, 0.5, 0.5), 0, "transparent hole must stay flat");
  assert.equal(zAt(0, 0.75, 0.25), 0, "thin external fin stays flat");
});

test("mesh allocation is fixed and every index addresses a duplicated face vertex", () => {
  const { vertices, indices } = buildFishVolume(image(128, 96, (x, y) => x > 20 && x < 108 && y > 15 && y < 80), anchors);
  assert.equal(vertices.length / 3, 442);
  assert.equal(indices.length / 3, 16 * 12 * 2 * 2);
  assert.ok([...indices].every(index => index < vertices.length / 3));
});
