export type FloorTileState = "safe" | "damaged" | "cracking" | "destroyed";
export interface FloorTile { state: FloorTileState; ticksRemaining: number }
export interface DestructibleFloor { size: number; halfExtent: number; warningTicks: number; tiles: FloorTile[] }

export function createDestructibleFloor(size: number, halfExtent: number, warningTicks: number): DestructibleFloor {
  if (!Number.isInteger(size) || size < 1 || size > 32) throw new RangeError("Floor size must be an integer from 1 to 32.");
  if (!Number.isFinite(halfExtent) || halfExtent <= 0) throw new RangeError("Floor half extent must be positive.");
  if (!Number.isInteger(warningTicks) || warningTicks < 2) throw new RangeError("Floor warning must last at least two ticks.");
  return { size, halfExtent, warningTicks, tiles: Array.from({ length: size * size }, () => ({ state: "safe", ticksRemaining: 0 })) };
}

export function tileIndexAt(floor: DestructibleFloor, x: number, y: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < -floor.halfExtent || y < -floor.halfExtent || x >= floor.halfExtent || y >= floor.halfExtent) return null;
  const tileSize = floor.halfExtent * 2 / floor.size;
  const column = Math.floor((x + floor.halfExtent) / tileSize);
  const row = Math.floor((y + floor.halfExtent) / tileSize);
  return row * floor.size + column;
}

export function markFloorTile(floor: DestructibleFloor, x: number, y: number): boolean {
  const index = tileIndexAt(floor, x, y);
  if (index === null) return false;
  const tile = floor.tiles[index];
  if (!tile || tile.state === "destroyed") return false;
  if (tile.state === "safe") {
    tile.state = "damaged";
    tile.ticksRemaining = floor.warningTicks;
  }
  return true;
}

export function stepDestructibleFloor(floor: DestructibleFloor): DestructibleFloor {
  for (const tile of floor.tiles) {
    if (tile.state === "safe" || tile.state === "destroyed") continue;
    tile.ticksRemaining = Math.max(0, tile.ticksRemaining - 1);
    if (tile.ticksRemaining === 0) tile.state = "destroyed";
    else if (tile.ticksRemaining <= Math.ceil(floor.warningTicks * 2 / 3)) tile.state = "cracking";
  }
  return floor;
}
