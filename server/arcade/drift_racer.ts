export const DRIFT_RACER_PLAYERS_MIN = 1;
export const DRIFT_RACER_PLAYERS_MAX = 10;
export const DRIFT_RACER_TURN_LIMIT = 8;
export const DRIFT_RACER_TURN_MS = 5_000;
export const DRIFT_RACER_FINISH_DISTANCE = 800;
export const DRIFT_RACER_MAX_BOOSTS = 3;

export type DriftRacerInput = { throttle: "accelerate" | "coast" | "brake"; steer: -1 | 0 | 1; drift: boolean; boost: boolean };
export interface DriftRacerDriver { distance: number; speed: number; lane: 0 | 1 | 2; boosts: number; cornerRewards: number }
export interface DriftRacerTurnResult {
  turn: number; inputs: Record<string, DriftRacerInput>; timedOutPlayers: string[];
  drivers: Record<string, DriftRacerDriver>; cornerMisses: string[]; finishers: string[];
}
export interface DriftRacerResult { matchId: string; winnerPlayerId: string | null; outcome: "finish" | "time_limit" | "tie" | "practice"; standings: Array<{ playerId: string; place: number; distance: number; speed: number; cornerRewards: number }> }
export interface DriftRacerMatch {
  matchId: string; players: string[]; turn: number; phase: "racing" | "results"; drivers: Record<string, DriftRacerDriver>;
  inputs: Record<string, DriftRacerInput>; turnResults: DriftRacerTurnResult[]; deadline: number; updatedAt: number; version: number; result?: DriftRacerResult;
}
export interface DriftRacerSnapshot {
  matchId: string; players: string[]; turn: number; phase: "racing" | "results"; drivers: Record<string, DriftRacerDriver>;
  deadline: number; version: number; submitted: boolean; inputCount: number; ownInput?: DriftRacerInput; result?: DriftRacerResult;
}
export type DriftRacerMutation = { ok: true; state: DriftRacerMatch; idempotent?: boolean } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "TURN_MISMATCH" | "ROUND_CLOSED" | "UNAUTHORIZED" | "ALREADY_LOCKED" | "BOOST_EMPTY" | "TOO_EARLY" };

const clone = <T,>(value: T): T => structuredClone(value);
const plain = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : plain(value) ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const validId = (value: unknown): value is string => typeof value === "string" && /^[\w-]{1,100}$/.test(value) && !Object.hasOwn(Object.prototype, value);
const validInput = (value: unknown): value is DriftRacerInput => plain(value) && Object.keys(value).length === 4 &&
  ["accelerate", "coast", "brake"].includes(String(value.throttle)) && [-1, 0, 1].includes(Number(value.steer)) && typeof value.drift === "boolean" && typeof value.boost === "boolean";
const validDriver = (value: unknown): value is DriftRacerDriver => plain(value) && Object.keys(value).length === 5 &&
  Number.isSafeInteger(value.distance) && Number(value.distance) >= 0 && Number(value.distance) <= DRIFT_RACER_FINISH_DISTANCE &&
  Number.isSafeInteger(value.speed) && Number(value.speed) >= 20 && Number(value.speed) <= 120 && [0, 1, 2].includes(Number(value.lane)) &&
  Number.isSafeInteger(value.boosts) && Number(value.boosts) >= 0 && Number(value.boosts) <= DRIFT_RACER_MAX_BOOSTS &&
  Number.isSafeInteger(value.cornerRewards) && Number(value.cornerRewards) >= 0 && Number(value.cornerRewards) <= 3;
const sameDriver = (a: unknown, b: unknown): boolean => validDriver(a) && validDriver(b) &&
  a.distance === b.distance && a.speed === b.speed && a.lane === b.lane && a.boosts === b.boosts && a.cornerRewards === b.cornerRewards;
const cornerAt = (distance: number): { distance: number; lane: 0 | 1 | 2; number: number } | undefined => {
  if (distance < 250) return { distance: 250, lane: 2, number: 1 };
  if (distance < 500) return { distance: 500, lane: 0, number: 2 };
  if (distance < 750) return { distance: 750, lane: 1, number: 3 };
  return undefined;
};

function validMatch(state: DriftRacerMatch): boolean {
  if (!plain(state) || !/^[\w-]{1,120}$/.test(state.matchId) || !Array.isArray(state.players) ||
    state.players.length < DRIFT_RACER_PLAYERS_MIN || state.players.length > DRIFT_RACER_PLAYERS_MAX || !state.players.every(validId) || new Set(state.players).size !== state.players.length ||
    !Number.isSafeInteger(state.turn) || state.turn < 1 || state.turn > DRIFT_RACER_TURN_LIMIT || !["racing", "results"].includes(state.phase) ||
    !Number.isSafeInteger(state.deadline) || !Number.isSafeInteger(state.updatedAt) || state.updatedAt < 0 || state.deadline < state.updatedAt ||
    !Number.isSafeInteger(state.version) || state.version < 0 || !plain(state.drivers) || !plain(state.inputs) || !Array.isArray(state.turnResults) ||
    Object.keys(state.drivers).length !== state.players.length || !state.players.every((id) => validDriver(state.drivers[id])) ||
    !Object.keys(state.drivers).every((id) => state.players.includes(id)) || Object.keys(state.inputs).some((id) => !state.players.includes(id) || !validInput(state.inputs[id])) ||
    !Array.isArray(state.turnResults) || state.turnResults.length !== state.turn - 1 + (state.phase === "results" && state.turnResults.at(-1)?.turn === state.turn ? 1 : 0)) return false;
  if (state.turnResults.some((value, index) => {
    if (!plain(value)) return true;
    const result = value as unknown as DriftRacerTurnResult;
    return result.turn !== index + 1 || !plain(result.inputs) || !plain(result.drivers) ||
      !Array.isArray(result.cornerMisses) || !Array.isArray(result.finishers) || !Array.isArray(result.timedOutPlayers) ||
      Object.keys(result.inputs).length !== state.players.length || Object.keys(result.drivers).length !== state.players.length ||
      !state.players.every((id) => validInput(result.inputs[id]) && validDriver(result.drivers[id])) ||
      !result.cornerMisses.every((id) => state.players.includes(id)) || new Set(result.cornerMisses).size !== result.cornerMisses.length ||
      !result.finishers.every((id) => state.players.includes(id)) || new Set(result.finishers).size !== result.finishers.length ||
      !result.timedOutPlayers.every((id) => state.players.includes(id)) || new Set(result.timedOutPlayers).size !== result.timedOutPlayers.length ||
      !state.players.every((id) => result.finishers.includes(id) === (result.drivers[id]!.distance === DRIFT_RACER_FINISH_DISTANCE));
  })) return false;
  if (state.turnResults.length > 0 && !state.players.every((id) => sameDriver(state.drivers[id], state.turnResults.at(-1)!.drivers[id]))) return false;
  if (state.phase === "racing" && (state.result !== undefined || state.turn > DRIFT_RACER_TURN_LIMIT || state.turnResults.length !== state.turn - 1)) return false;
  if (state.phase === "results" && (!plain(state.result) || state.turnResults.length < 1 || state.turnResults.length > DRIFT_RACER_TURN_LIMIT ||
    state.result.matchId !== state.matchId || !["finish", "time_limit", "tie", "practice"].includes(state.result.outcome) ||
    (state.players.length === 1 ? state.result.outcome !== "practice" || state.result.winnerPlayerId !== null : state.result.outcome === "practice") ||
    !Array.isArray(state.result.standings) || state.result.standings.length !== state.players.length)) return false;

  // Replay the compact, bounded turn history so a valid-shaped but forged
  // input, timeout marker, drift miss, or winner cannot survive D1 loading.
  let replay = createDriftRacerMatch({ matchId: state.matchId, players: state.players, now: 0 });
  for (const saved of state.turnResults) {
    if (replay.phase !== "racing" || replay.turn !== saved.turn) return false;
    const timedOut = new Set(saved.timedOutPlayers);
    for (const id of state.players) {
      const savedInput = saved.inputs[id]!;
      if (timedOut.has(id)) {
        if (canonical(savedInput) !== canonical({ throttle: "coast", steer: 0, drift: false, boost: false })) return false;
      } else replay.inputs[id] = clone(savedInput);
    }
    const resolved = resolveTurn(replay, timedOut.size ? replay.deadline : replay.updatedAt + 1);
    if (canonical(resolved.turnResults.at(-1)) !== canonical(saved)) return false;
    replay = resolved;
  }
  for (const id of Object.keys(state.inputs)) if (state.inputs[id]!.boost && replay.drivers[id]!.boosts < 1) return false;
  replay.inputs = clone(state.inputs);
  if (replay.phase !== state.phase || replay.turn !== state.turn || canonical(replay.drivers) !== canonical(state.drivers) || canonical(replay.inputs) !== canonical(state.inputs)) return false;
  if (state.phase === "racing") return true;

  const expectedOutcome = state.players.length === 1 ? "practice" : state.turnResults.at(-1)!.finishers.length ? "finish" : "time_limit";
  const expected = computeResult(state, expectedOutcome);
  return canonical(state.result) === canonical(expected) && canonical(replay.result) === canonical(expected);
}

export function isValidDriftRacerMatch(value: unknown): value is DriftRacerMatch {
  return Boolean(value && typeof value === "object" && validMatch(value as DriftRacerMatch));
}

function computeResult(state: DriftRacerMatch, outcome: DriftRacerResult["outcome"]): DriftRacerResult {
  const standings = [...state.players].sort((a, b) => state.drivers[b]!.distance - state.drivers[a]!.distance || state.drivers[b]!.speed - state.drivers[a]!.speed || state.drivers[b]!.cornerRewards - state.drivers[a]!.cornerRewards || a.localeCompare(b))
    .map((playerId, index) => ({ playerId, place: index + 1, distance: state.drivers[playerId]!.distance, speed: state.drivers[playerId]!.speed, cornerRewards: state.drivers[playerId]!.cornerRewards }));
  const first = standings[0]!, second = standings[1];
  const tied = Boolean(second && first.distance === second.distance && first.speed === second.speed && first.cornerRewards === second.cornerRewards);
  const soloPractice = state.players.length === 1;
  return { matchId: state.matchId, winnerPlayerId: soloPractice || tied ? null : first.playerId, outcome: soloPractice ? "practice" : tied ? "tie" : outcome, standings };
}

export function createDriftRacerMatch(input: { matchId: string; players: string[]; now: number }): DriftRacerMatch {
  if (!input || typeof input.matchId !== "string" || !/^[\w-]{1,120}$/.test(input.matchId) || !Array.isArray(input.players) || input.players.length < DRIFT_RACER_PLAYERS_MIN ||
    input.players.length > DRIFT_RACER_PLAYERS_MAX || !input.players.every(validId) || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0) throw new TypeError("Invalid Drift Racer match setup");
  return { matchId: input.matchId, players: [...input.players], turn: 1, phase: "racing",
    drivers: Object.fromEntries(input.players.map((id) => [id, { distance: 0, speed: 50, lane: 1, boosts: 2, cornerRewards: 0 }])),
    inputs: {}, turnResults: [], deadline: input.now + DRIFT_RACER_TURN_MS, updatedAt: input.now, version: 0 };
}

export function submitDriftRacerInput(state: DriftRacerMatch, input: { matchId: string; turn: number; playerId: string; input: DriftRacerInput; now: number }): DriftRacerMutation {
  if (!validMatch(state)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input !== "object" || !validId(input.playerId) || !validInput(input.input) || !Number.isSafeInteger(input.turn) || !Number.isSafeInteger(input.now) || input.now < state.updatedAt || input.now > state.deadline) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== state.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.turn !== state.turn) return { ok: false, code: "TURN_MISMATCH" };
  if (!state.players.includes(input.playerId)) return { ok: false, code: "UNAUTHORIZED" };
  if (state.phase !== "racing") return { ok: false, code: "ROUND_CLOSED" };
  const prior = state.inputs[input.playerId];
  if (prior) return JSON.stringify(prior) === JSON.stringify(input.input) ? { ok: true, state, idempotent: true } : { ok: false, code: "ALREADY_LOCKED" };
  if (input.input.boost && state.drivers[input.playerId]!.boosts < 1) return { ok: false, code: "BOOST_EMPTY" };
  const next = clone(state); next.inputs[input.playerId] = clone(input.input); next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}

function resolveTurn(state: DriftRacerMatch, now: number): DriftRacerMatch {
  const next = clone(state), nextDrivers = clone(state.drivers), allInputs: Record<string, DriftRacerInput> = {}, timedOutPlayers: string[] = [], cornerMisses: string[] = [], finishers: string[] = [];
  for (const id of state.players) {
    const action = state.inputs[id] ?? { throttle: "coast", steer: 0, drift: false, boost: false } as const;
    if (!state.inputs[id]) timedOutPlayers.push(id);
    allInputs[id] = clone(action);
    const driver = nextDrivers[id]!;
    const throttle = action.throttle === "accelerate" ? 15 : action.throttle === "brake" ? -20 : -4;
    const speed = Math.max(20, Math.min(120, driver.speed + throttle + (action.boost ? 18 : 0)));
    const lane = Math.max(0, Math.min(2, driver.lane + action.steer)) as 0 | 1 | 2;
    const oldDistance = driver.distance;
    let distance = Math.min(DRIFT_RACER_FINISH_DISTANCE, oldDistance + speed + (action.boost ? 22 : 0));
    let nextSpeed = speed;
    const corner = cornerAt(oldDistance);
    if (corner && distance >= corner.distance) {
      if (lane === corner.lane && action.drift) {
        driver.cornerRewards += 1; driver.boosts = Math.min(DRIFT_RACER_MAX_BOOSTS, driver.boosts + 1); distance = Math.min(DRIFT_RACER_FINISH_DISTANCE, distance + 12);
      } else {
        cornerMisses.push(id); nextSpeed = Math.max(20, speed - 18); distance = Math.min(DRIFT_RACER_FINISH_DISTANCE, corner.distance - 18);
      }
    }
    if (action.boost) driver.boosts -= 1;
    driver.speed = nextSpeed; driver.lane = lane; driver.distance = distance;
    if (distance >= DRIFT_RACER_FINISH_DISTANCE) finishers.push(id);
  }
  next.turnResults.push({ turn: state.turn, inputs: allInputs, timedOutPlayers, drivers: clone(nextDrivers), cornerMisses, finishers });
  next.drivers = nextDrivers; next.inputs = {}; next.updatedAt = now; next.version += 1;
  if (finishers.length || state.turn >= DRIFT_RACER_TURN_LIMIT) {
    next.phase = "results"; next.deadline = now; next.result = computeResult({ ...next, drivers: nextDrivers }, finishers.length ? "finish" : "time_limit");
  } else { next.turn += 1; next.deadline = now + DRIFT_RACER_TURN_MS; }
  return next;
}

export function advanceDriftRacer(state: DriftRacerMatch, input: { now: number }): DriftRacerMutation {
  if (!validMatch(state)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < state.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (state.phase !== "racing") return { ok: false, code: "ROUND_CLOSED" };
  if (Object.keys(state.inputs).length < state.players.length && input.now < state.deadline) return { ok: false, code: "TOO_EARLY" };
  return { ok: true, state: resolveTurn(state, input.now) };
}

export function driftRacerSnapshot(state: DriftRacerMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }): DriftRacerSnapshot {
  if (!validMatch(state) || !viewer || !["host", "spectator", "player"].includes(viewer.role)) throw new TypeError("Invalid Drift Racer snapshot request");
  const playerId = viewer.role === "player" ? viewer.playerId : undefined;
  if (playerId && (!validId(playerId) || !state.players.includes(playerId))) throw new TypeError("Drift Racer player is not assigned");
  const ownInput = playerId ? state.inputs[playerId] : undefined;
  return { matchId: state.matchId, players: [...state.players], turn: state.turn, phase: state.phase, drivers: clone(state.drivers), deadline: state.deadline, version: state.version,
    submitted: Boolean(ownInput), inputCount: Object.keys(state.inputs).length,
    ...(ownInput ? { ownInput: clone(ownInput) } : {}), ...(state.result ? { result: clone(state.result) } : {}) };
}

export function getDriftRacerResult(state: DriftRacerMatch): DriftRacerResult {
  if (!validMatch(state) || state.phase !== "results" || !state.result) throw new TypeError("Drift Racer result is not ready");
  return clone(state.result);
}
