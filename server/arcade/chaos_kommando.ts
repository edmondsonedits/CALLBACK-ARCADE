export const CHAOS_KOMMANDO_PLAYERS_MIN = 3;
export const CHAOS_KOMMANDO_PLAYERS_MAX = 10;
export const CHAOS_MISSION_DURATION_MS = 40_000;
export const CHAOS_MISSIONS = [
  { id: "blackout", title: "Citywide Blackout", briefing: "Restore power to the hospital before its backup runs out.", requiredTags: ["repair", "power"], tools: [{ id: "grid-kit", label: "Grid repair kit", tags: ["repair"] }, { id: "field-radio", label: "Field radio", tags: ["signal"] }, { id: "med-pack", label: "Medical pack", tags: ["medical"] }, { id: "spare-fuse", label: "Spare fuse", tags: ["power"] }] },
  { id: "floodgate", title: "Rising Water", briefing: "Keep the river from reaching the evacuation bridge.", requiredTags: ["pump", "barrier"], tools: [{ id: "pump-team", label: "Portable pump", tags: ["pump"] }, { id: "sandbags", label: "Sandbag wall", tags: ["barrier"] }, { id: "radio-check", label: "Radio check", tags: ["signal"] }, { id: "rescue-rope", label: "Rescue rope", tags: ["rescue"] }] },
  { id: "signal", title: "Lost Convoy", briefing: "Find the stranded convoy and guide it through the safe pass.", requiredTags: ["signal", "navigation"], tools: [{ id: "beacon", label: "Deploy beacon", tags: ["signal"] }, { id: "map-tablet", label: "Route tablet", tags: ["navigation"] }, { id: "repair-drone", label: "Repair drone", tags: ["repair"] }, { id: "first-aid", label: "First-aid kit", tags: ["medical"] }] },
  { id: "reactor", title: "Reactor Cooldown", briefing: "Stabilize the cooling loop and clear the control room.", requiredTags: ["coolant", "evacuation"], tools: [{ id: "coolant-line", label: "Coolant line", tags: ["coolant"] }, { id: "evac-siren", label: "Evacuation siren", tags: ["evacuation"] }, { id: "sensor-kit", label: "Sensor kit", tags: ["diagnostics"] }, { id: "shield-cart", label: "Shield cart", tags: ["protection"] }] },
] as const;

export type ChaosMission = (typeof CHAOS_MISSIONS)[number];
export interface ChaosSubmission { playerId: string; toolId: string | null }
export interface ChaosMissionResult { missionNumber: number; missionId: string; outcome: "contained" | "uncontained" | "timeout"; coveredTags: string[]; missingTags: string[]; submissions: ChaosSubmission[]; score: number }
export interface ChaosMatch { matchId: string; players: string[]; missionNumber: number; phase: "choosing" | "revealed"; mission: ChaosMission; choices: Record<string, string>; deadline: number; updatedAt: number; version: number; missionResults: ChaosMissionResult[]; result?: { matchId: string; missions: ChaosMissionResult[]; score: number; maxScore: number; outcome: "contained" | "critical" } }
export type ChaosMutation = { ok: true; state: ChaosMatch; idempotent?: boolean } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "MISSION_CLOSED" | "UNAUTHORIZED" | "TOO_EARLY" | "ALREADY_LOCKED" };
const clone = <T,>(value: T): T => structuredClone(value);
const tool = (mission: ChaosMission, id: string) => mission.tools.find((item) => item.id === id);
function valid(match: ChaosMatch): boolean {
  if (!match || !/^[\w-]{1,100}$/.test(match.matchId) || match.players.length < CHAOS_KOMMANDO_PLAYERS_MIN || match.players.length > CHAOS_KOMMANDO_PLAYERS_MAX || new Set(match.players).size !== match.players.length || match.players.some((id) => typeof id !== "string" || !id.trim()) || !Number.isSafeInteger(match.missionNumber) || match.missionNumber < 1 || match.missionNumber > CHAOS_MISSIONS.length || match.mission.id !== CHAOS_MISSIONS[match.missionNumber - 1]?.id || !Number.isSafeInteger(match.updatedAt) || !Number.isSafeInteger(match.deadline) || !Number.isSafeInteger(match.version) || !match.choices || Object.keys(match.choices).some((id) => !match.players.includes(id) || !tool(match.mission, match.choices[id]!))) return false;
  return match.phase === "choosing" ? match.deadline >= match.updatedAt && match.missionResults.length === match.missionNumber - 1 && !match.result : match.deadline === match.updatedAt && match.missionResults.length === match.missionNumber;
}
function resolve(match: ChaosMatch, timedOut: boolean, now: number): ChaosMatch {
  const chosen = match.players.map((playerId) => ({ playerId, toolId: match.choices[playerId] ?? null }));
  const coveredTags: string[] = [...new Set(chosen.flatMap((entry) => entry.toolId ? tool(match.mission, entry.toolId)?.tags ?? [] : []))].sort();
  const remainingPlayers = new Set(chosen.filter((entry) => entry.toolId).map((entry) => entry.playerId));
  const missingTags: string[] = [];
  for (const tag of match.mission.requiredTags) {
    const coveringPlayer = chosen.find((entry) => entry.toolId && remainingPlayers.has(entry.playerId) && tool(match.mission, entry.toolId)?.tags.some((candidate) => candidate === tag));
    if (coveringPlayer) remainingPlayers.delete(coveringPlayer.playerId); else missingTags.push(tag);
  }
  const score = missingTags.length === 0 && !timedOut ? 1_000 : 0;
  const missionResult: ChaosMissionResult = { missionNumber: match.missionNumber, missionId: match.mission.id, outcome: timedOut ? "timeout" : missingTags.length === 0 ? "contained" : "uncontained", coveredTags, missingTags, submissions: chosen, score };
  return { ...clone(match), phase: "revealed", deadline: now, updatedAt: now, version: match.version + 1, missionResults: [...match.missionResults, missionResult] };
}
export function createChaosMatch(input: { matchId: string; players: string[]; now: number; seed: number }): ChaosMatch {
  if (!input || !/^[\w-]{1,100}$/.test(input.matchId) || input.players.length < CHAOS_KOMMANDO_PLAYERS_MIN || input.players.length > CHAOS_KOMMANDO_PLAYERS_MAX || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0 || !Number.isSafeInteger(input.seed)) throw new TypeError("Invalid Chaos-Kommando match setup");
  const mission = CHAOS_MISSIONS[0]!;
  return { matchId: input.matchId, players: [...input.players], missionNumber: 1, phase: "choosing", mission, choices: {}, deadline: input.now + CHAOS_MISSION_DURATION_MS, updatedAt: input.now, version: 0, missionResults: [] };
}
export function chooseChaosTool(match: ChaosMatch, input: { matchId: string; missionNumber: number; playerId: string; toolId: string; now: number }): ChaosMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input.matchId !== "string" || typeof input.playerId !== "string" || typeof input.toolId !== "string" || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.missionNumber !== match.missionNumber || !match.players.includes(input.playerId) || !tool(match.mission, input.toolId)) return { ok: false, code: "UNAUTHORIZED" };
  const prior = match.choices[input.playerId];
  if (prior) return prior === input.toolId ? { ok: true, state: match, idempotent: true } : { ok: false, code: "ALREADY_LOCKED" };
  if (match.phase !== "choosing" || input.now >= match.deadline) return { ok: false, code: "MISSION_CLOSED" };
  const next = clone(match); next.choices[input.playerId] = input.toolId; next.updatedAt = input.now; next.version += 1; return { ok: true, state: next };
}
export function advanceChaosMission(match: ChaosMatch, input: { now: number }): ChaosMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "choosing") return { ok: false, code: "MISSION_CLOSED" };
  const timedOut = input.now >= match.deadline;
  if (!timedOut && match.players.some((id) => !match.choices[id])) return { ok: false, code: "TOO_EARLY" };
  return { ok: true, state: resolve(match, timedOut, input.now) };
}
export function nextChaosMission(match: ChaosMatch, input: { now: number }): ChaosMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (match.phase !== "revealed" || match.missionNumber >= CHAOS_MISSIONS.length || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > Number.MAX_SAFE_INTEGER - CHAOS_MISSION_DURATION_MS) return { ok: false, code: "MISSION_CLOSED" };
  const missionNumber = match.missionNumber + 1;
  return { ok: true, state: { ...clone(match), missionNumber, mission: CHAOS_MISSIONS[missionNumber - 1]!, phase: "choosing", choices: {}, deadline: input.now + CHAOS_MISSION_DURATION_MS, updatedAt: input.now, version: match.version + 1 } };
}
export function finishChaosMatch(match: ChaosMatch): ChaosMatch {
  if (!valid(match) || match.phase !== "revealed" || match.missionNumber !== CHAOS_MISSIONS.length) throw new TypeError("Chaos-Kommando requires all missions revealed");
  const missions = clone(match.missionResults); const score = missions.reduce((sum, entry) => sum + entry.score, 0);
  return { ...clone(match), result: { matchId: match.matchId, missions, score, maxScore: CHAOS_MISSIONS.length * 1_000, outcome: score >= 3_000 ? "contained" : "critical" } };
}
export function chaosSnapshot(match: ChaosMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }) {
  if (!valid(match)) throw new TypeError("Invalid Chaos-Kommando state");
  const base = { matchId: match.matchId, missionNumber: match.missionNumber, missionCount: CHAOS_MISSIONS.length, phase: match.phase, players: [...match.players], mission: { id: match.mission.id, title: match.mission.title, briefing: match.mission.briefing, requiredTags: [...match.mission.requiredTags], tools: match.mission.tools.map(({ id, label }) => ({ id, label })) }, deadline: match.deadline, version: match.version, submissionCount: Object.keys(match.choices).length, submitted: viewer.role === "player" && !!match.choices[viewer.playerId], missionResults: clone(match.missionResults), result: match.result ? clone(match.result) : undefined };
  if (match.phase === "revealed") return { ...base, submissions: match.missionResults.at(-1)?.submissions };
  if (viewer.role === "player" && match.choices[viewer.playerId]) return { ...base, ownToolId: match.choices[viewer.playerId] };
  return base;
}
