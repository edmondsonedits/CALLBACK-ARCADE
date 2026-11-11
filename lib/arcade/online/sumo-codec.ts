import { MAPS, Sim, mulberry32 } from "./sumo-core.mjs";

export type SumoJson = null | boolean | number | string | SumoJson[] | { [key:string]:SumoJson };
export interface PackedSumoSim {mapId:string;rngState:number;data:{[key:string]:SumoJson}}

/** Preserve exact IEEE numbers, undefined, sets and Float32 hazard schedules. */
export function packSumoValue(value:unknown):SumoJson {
  if (value === undefined) return { $sumo:"undefined" };
  if (typeof value === "number" && (!Number.isFinite(value) || Object.is(value,-0))) return { $sumo:"number", value:Object.is(value,-0) ? "-0" : String(value) };
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Float32Array) return { $sumo:"Float32Array", values:Array.from(value) };
  if (value instanceof Set) return { $sumo:"Set", values:Array.from(value,packSumoValue) };
  if (Array.isArray(value)) return value.map(packSumoValue);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,v]) => [key,packSumoValue(v)]));
  throw new Error(`Cannot persist Sumo ${typeof value}`);
}

export function unpackSumoValue(value:SumoJson):unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(unpackSumoValue);
  if (value.$sumo === "undefined") return undefined;
  if (value.$sumo === "number") return Number(value.value);
  if (value.$sumo === "Float32Array") return new Float32Array(value.values as number[]);
  if (value.$sumo === "Set") return new Set((value.values as SumoJson[]).map(unpackSumoValue));
  return Object.fromEntries(Object.entries(value).map(([key,v]) => [key,unpackSumoValue(v)]));
}

export function persistSumoSim(sim:Sim):PackedSumoSim {
  const data:Record<string,unknown> = {};
  for (const [key,value] of Object.entries(sim)) {
    if (key === "map" || key === "rng") continue;
    // Inputs have a single canonical owner. Restore fighter aliases explicitly.
    data[key] = key === "fighters" ? sim.fighters.map(f => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "input"))) : value;
  }
  return {mapId:sim.map.id,rngState:sim.rng.state,data:packSumoValue(data) as PackedSumoSim["data"]};
}

export function restoreSumoSim(saved:PackedSumoSim):Sim {
  if (!Object.hasOwn(MAPS,saved.mapId)) throw new Error("Unknown persisted Sumo map");
  const sim = Object.assign(Object.create(Sim.prototype),unpackSumoValue(saved.data)) as Sim;
  sim.map = MAPS[saved.mapId];
  sim.rng = mulberry32(saved.rngState);
  for (const f of sim.fighters) f.input = sim.inputs[f.id];
  return sim;
}
