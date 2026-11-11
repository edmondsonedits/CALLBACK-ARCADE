import type { PracticeGameId } from "../../lib/arcade/practice/types";

type Dict = Record<string, unknown>;
const record = (value: unknown): Dict => value && typeof value === "object" ? value as Dict : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export interface PracticeSceneModel {
  readonly state: Dict;
  readonly entities: readonly Dict[];
  readonly notes: readonly Dict[];
  readonly cues: readonly Dict[];
  readonly paths: readonly (readonly (readonly [number, number])[])[];
}

/** Normalize game-specific snapshots for the shared practice renderer. */
export function practiceSceneEntities(gameId: PracticeGameId, raw: unknown): PracticeSceneModel {
  const outer = record(raw);
  // Tie-Breaker wraps its shared combat state; flatten it for the common renderer.
  const state = gameId === "tie-breaker" ? { ...record(outer.core), ...outer } : outer;
  const entityKeys = ["obstacles", "hazards", "projectiles", "specialProjectiles", "sonicWaves", "bombs", "balls", "bugs", "creatures", "targets", "jewels", "shots", "crates", "pickups", "mines"];
  const entities = entityKeys.flatMap((key) => list(state[key]).map((value) => ({ ...record(value), sceneKind: key })));
  for (const key of ["target", "penguin", "hazard"]) {
    const value = record(state[key]);
    if (typeof value.x === "number" && typeof value.y === "number") entities.push({ ...value, sceneKind: key });
  }
  const notes = gameId === "mystery-beat" ? list(state.chart).map(record) : list(state.upcoming).map(record);
  const cues = gameId === "twisted-system" ? list(state.cueSequence).map(record) : [];
  const paths = list(state.trails).map((trail) => list(record(trail).segments)
    .filter((point): point is readonly [number, number] => Array.isArray(point) && point.length === 2 && point.every((n) => typeof n === "number")));
  return { state, entities, notes, cues, paths };
}
