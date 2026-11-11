export const DUNGEON_PARTY_PLAYERS_MIN = 3;
export const DUNGEON_PARTY_PLAYERS_MAX = 10;
export const DUNGEON_PARTY_ENCOUNTERS = 3;
export const DUNGEON_PARTY_HEALTH = 10;
export const DUNGEON_PARTY_ENCOUNTER_MS = 35_000;
export const DUNGEON_PARTY_FAILURE_DAMAGE = 4;

export interface DungeonAction { id: string; label: string; progress: number; guard: number; healing: number }
export interface DungeonEncounter { id: string; title: string; briefing: string; target: number; threat: number; fallbackActionId: string; actions: DungeonAction[] }
export interface DungeonPartyActionResult { playerId: string; actionId: string; timedOut: boolean }
export interface DungeonPartyEncounterResult { encounter: number; encounterId: string; success: boolean; timedOut: boolean; progress: number; target: number; guard: number; healing: number; damage: number; health: number; scoreEarned: number; actions: DungeonPartyActionResult[] }
export interface DungeonPartyMatch { matchId: string; players: string[]; encounter: number; phase: "choosing" | "revealed" | "complete"; definition: DungeonEncounter; choices: Record<string, string>; health: number; score: number; deadline: number; updatedAt: number; version: number; encounterResults: DungeonPartyEncounterResult[]; result?: { matchId: string; outcome: "escaped" | "survived" | "fallen"; health: number; score: number; maxScore: number; completedEncounters: number; successfulEncounters: number } }
export type DungeonPartyMutation = { ok: true; state: DungeonPartyMatch; idempotent?: boolean } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "ENCOUNTER_MISMATCH" | "ENCOUNTER_CLOSED" | "UNAUTHORIZED" | "INVALID_ACTION" | "ALREADY_LOCKED" | "TOO_EARLY" };

const clone = <T,>(value: T): T => structuredClone(value);
function definition(encounter: number, players: number): DungeonEncounter {
  const target = Math.ceil(players / 2);
  if (encounter === 1) return { id: "goblin-patrol", title: "Goblin Patrol", briefing: "The goblins block the old road. Push through, hold the line, or patch up the party.", target, threat: 2, fallbackActionId: "guard", actions: [{ id: "strike", label: "Strike", progress: 1, guard: 0, healing: 0 }, { id: "guard", label: "Guard", progress: 0, guard: 1, healing: 0 }, { id: "heal", label: "Patch up", progress: 0, guard: 0, healing: 1 }] };
  if (encounter === 2) return { id: "rune-gate", title: "Rune Gate", briefing: "A sealed arch hums with old magic. Decode the marks, brace the arch, or rally your companions.", target, threat: 2, fallbackActionId: "brace", actions: [{ id: "decode", label: "Decode runes", progress: 1, guard: 0, healing: 0 }, { id: "brace", label: "Brace the arch", progress: 0, guard: 1, healing: 0 }, { id: "rally", label: "Rally the party", progress: 0, guard: 0, healing: 1 }] };
  if (encounter === 3) return { id: "dragon-vault", title: "Dragon Vault", briefing: "A young dragon guards the exit. A spell can break its hold; wards keep the party standing.", target, threat: 2, fallbackActionId: "ward", actions: [{ id: "spell", label: "Cast a spell", progress: 2, guard: 0, healing: 0 }, { id: "ward", label: "Raise a ward", progress: 0, guard: 1, healing: 0 }, { id: "heal", label: "Restore a companion", progress: 0, guard: 0, healing: 1 }] };
  throw new RangeError("Unknown Dungeon Party encounter");
}
function valid(match: DungeonPartyMatch): boolean {
  return Boolean(match && /^[\w-]{1,120}$/.test(match.matchId) && Array.isArray(match.players) && match.players.length >= 3 && match.players.length <= DUNGEON_PARTY_PLAYERS_MAX && new Set(match.players).size === match.players.length && match.players.every((id) => typeof id === "string" && id.trim()) && Number.isInteger(match.encounter) && match.encounter >= 1 && match.encounter <= 3 && ["choosing", "revealed", "complete"].includes(match.phase) && Number.isSafeInteger(match.deadline) && Number.isSafeInteger(match.updatedAt) && match.deadline >= match.updatedAt && Number.isInteger(match.version) && match.version >= 0 && Number.isInteger(match.health) && match.health >= 0 && match.health <= 10 && Number.isInteger(match.score) && match.score >= 0 && match.score <= 3_000 && match.definition?.id === definition(match.encounter, match.players.length).id && match.encounterResults.length === match.encounter - (match.phase === "choosing" ? 1 : 0) && Object.keys(match.choices).every((id) => match.players.includes(id) && match.definition.actions.some((action) => action.id === match.choices[id])) && (match.phase === "choosing" ? match.deadline >= match.updatedAt && !match.result : match.deadline === match.updatedAt && (match.phase === "complete") === Boolean(match.result)));
}
function finish(match: DungeonPartyMatch): DungeonPartyMatch {
  const successes = match.encounterResults.filter((result) => result.success).length;
  const outcome = match.health <= 0 ? "fallen" : match.encounter === DUNGEON_PARTY_ENCOUNTERS ? successes === DUNGEON_PARTY_ENCOUNTERS ? "escaped" : "survived" : "survived";
  return { ...match, phase: "complete", result: { matchId: match.matchId, outcome, health: match.health, score: match.score, maxScore: 3_000, completedEncounters: match.encounterResults.length, successfulEncounters: successes } };
}
export function createDungeonPartyMatch(input: { matchId: string; players: string[]; now: number }): DungeonPartyMatch {
  if (!input || !/^[\w-]{1,120}$/.test(input.matchId) || !Array.isArray(input.players) || input.players.length < 3 || input.players.length > DUNGEON_PARTY_PLAYERS_MAX || input.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - DUNGEON_PARTY_ENCOUNTER_MS) throw new TypeError("Dungeon Party requires 3–10 players and a safe clock");
  return { matchId: input.matchId, players: [...input.players], encounter: 1, phase: "choosing", definition: definition(1, input.players.length), choices: {}, health: DUNGEON_PARTY_HEALTH, score: 0, deadline: input.now + DUNGEON_PARTY_ENCOUNTER_MS, updatedAt: input.now, version: 0, encounterResults: [] };
}
export function chooseDungeonPartyAction(match: DungeonPartyMatch, input: { matchId: string; encounter: number; playerId: string; actionId: string; now: number }): DungeonPartyMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input.matchId !== "string" || typeof input.playerId !== "string" || typeof input.actionId !== "string" || !Number.isSafeInteger(input.encounter) || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.encounter !== match.encounter) return { ok: false, code: "ENCOUNTER_MISMATCH" };
  if (!match.players.includes(input.playerId)) return { ok: false, code: "UNAUTHORIZED" };
  if (match.phase !== "choosing" || input.now >= match.deadline) return { ok: false, code: "ENCOUNTER_CLOSED" };
  const existing = match.choices[input.playerId];
  if (existing) return existing === input.actionId ? { ok: true, state: match, idempotent: true } : { ok: false, code: "ALREADY_LOCKED" };
  if (!match.definition.actions.some((action) => action.id === input.actionId)) return { ok: false, code: "INVALID_ACTION" };
  const next = clone(match); next.choices[input.playerId] = input.actionId; next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}
export function revealDungeonPartyEncounter(match: DungeonPartyMatch, input: { now: number }): DungeonPartyMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "choosing") return { ok: false, code: "ENCOUNTER_CLOSED" };
  const timedOut = match.players.some((playerId) => !match.choices[playerId]);
  if (input.now < match.deadline && timedOut) return { ok: false, code: "TOO_EARLY" };
  const actions = match.players.map((playerId) => ({ playerId, actionId: match.choices[playerId] ?? match.definition.fallbackActionId, timedOut: !match.choices[playerId] }));
  const totals = actions.reduce((sum, entry) => { const action = match.definition.actions.find((option) => option.id === entry.actionId)!; sum.progress += action.progress; sum.guard += action.guard; sum.healing += action.healing; return sum; }, { progress: 0, guard: 0, healing: 0 });
  const success = totals.progress >= match.definition.target; const damage = Math.max(0, match.definition.threat - totals.guard - Number(success)) + (success ? 0 : DUNGEON_PARTY_FAILURE_DAMAGE); const health = Math.min(DUNGEON_PARTY_HEALTH, Math.max(0, match.health - damage + totals.healing)); const scoreEarned = success ? 1_000 : totals.progress * 100;
  const next = clone(match); next.health = health; next.score += scoreEarned; next.encounterResults.push({ encounter: match.encounter, encounterId: match.definition.id, success, timedOut, progress: totals.progress, target: match.definition.target, guard: totals.guard, healing: totals.healing, damage, health, scoreEarned, actions });
  next.phase = "revealed"; next.deadline = input.now; next.updatedAt = input.now; next.version += 1;
  if (health <= 0 || match.encounter === DUNGEON_PARTY_ENCOUNTERS) return { ok: true, state: finish(next) };
  return { ok: true, state: next };
}
export function nextDungeonPartyEncounter(match: DungeonPartyMatch, input: { now: number }): DungeonPartyMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > Number.MAX_SAFE_INTEGER - DUNGEON_PARTY_ENCOUNTER_MS) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "revealed" || match.encounter >= 3) return { ok: false, code: "ENCOUNTER_CLOSED" };
  const encounter = match.encounter + 1;
  return { ok: true, state: { ...clone(match), encounter, definition: definition(encounter, match.players.length), choices: {}, phase: "choosing", deadline: input.now + DUNGEON_PARTY_ENCOUNTER_MS, updatedAt: input.now, version: match.version + 1 } };
}
export function dungeonPartySnapshot(match: DungeonPartyMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }): import("../../lib/contracts").SnapshotDungeonParty {
  if (!valid(match)) throw new TypeError("Invalid Dungeon Party state");
  const base = { matchId: match.matchId, players: [...match.players], encounter: match.encounter, encounterCount: DUNGEON_PARTY_ENCOUNTERS as 3, phase: match.phase, definition: clone(match.definition), health: match.health, score: match.score, deadline: match.deadline, version: match.version, submissionCount: Object.keys(match.choices).length, submitted: viewer.role === "player" && Boolean(match.choices[viewer.playerId]), encounterResults: match.phase === "complete" ? clone(match.encounterResults) : [], encounterResult: match.phase !== "choosing" ? clone(match.encounterResults.at(-1)) : undefined, result: match.result ? clone(match.result) : undefined };
  if (match.phase === "choosing" && viewer.role === "player" && match.choices[viewer.playerId]) return { ...base, ownActionId: match.choices[viewer.playerId] };
  return base;
}
