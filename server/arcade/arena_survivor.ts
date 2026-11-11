export const ARENA_SURVIVOR_PLAYERS_MIN = 3;
export const ARENA_SURVIVOR_PLAYERS_MAX = 10;
export const ARENA_SURVIVOR_CHOICE_DURATION_MS = 45_000;
export const ARENA_SURVIVOR_SURVIVE_POINTS = 1_000;

export interface ArenaSurvivorChoice { id: string; text: string }
export interface ArenaSurvivorScenario { id: string; title: string; description: string; choices: [ArenaSurvivorChoice, ArenaSurvivorChoice, ArenaSurvivorChoice]; correctChoiceId: string; explanation: string }
export interface ArenaSurvivorEntry { playerId: string; choiceId: string | null; survived: boolean }
export type ArenaSurvivorPublicScenario = Omit<ArenaSurvivorScenario, 'correctChoiceId' | 'explanation'>;
export interface ArenaSurvivorMatch {
  matchId: string; players: string[]; round: 1; phase: 'answering' | 'revealed'; scenario: ArenaSurvivorScenario;
  successfulChoiceId: string; choices: Record<string, string>; deadline: number; updatedAt: number; version: number;
  scores: Record<string, number>; outcome?: 'revealed' | 'timeout'; entries?: ArenaSurvivorEntry[];
}
export interface ArenaSurvivorResult {
  matchId: string; round: 1; outcome: 'revealed' | 'timeout'; scenario: ArenaSurvivorPublicScenario;
  correctChoiceId: string; explanation: string; submissions: ArenaSurvivorEntry[]; choiceCounts: Record<string, number>;
  winners: string[]; scores: Record<string, number>;
}
export interface ArenaSurvivorSnapshot {
  matchId: string; round: 1; phase: 'answering' | 'revealed'; players: string[]; scenario: ArenaSurvivorPublicScenario;
  deadline: number; version: number; submitted: boolean; answerCount: number; ownChoiceId?: string; assignment?: { role: 'survivor' };
  result?: ArenaSurvivorResult;
}
export type ArenaSurvivorMutationResult =
  | { ok: true; state: ArenaSurvivorMatch; idempotent?: boolean }
  | { ok: false; code: 'INVALID_STATE' | 'INVALID_INPUT' | 'MATCH_MISMATCH' | 'ROUND_CLOSED' | 'UNAUTHORIZED' | 'TOO_EARLY' | 'ALREADY_LOCKED' };

const SCENARIOS: readonly ArenaSurvivorScenario[] = [
  { id: 'avalanche', title: 'Avalanche Escape', description: 'An avalanche is moving toward you. If you can still move, what is the best chance to escape the slide?', correctChoiceId: 'side', explanation: 'If possible, get off the moving slab or out of the slide. If swept up, fight to stay near the surface and protect your airway as it slows; conditions vary.', choices: [
    { id: 'side', text: 'Try to get off the moving slab or out of the slide' }, { id: 'run', text: 'Sprint downhill in the same direction as the avalanche' }, { id: 'tent', text: 'Hide inside your tent and wait it out' },
  ] },
  { id: 'desert', title: 'Desert Survival', description: 'You are lost in a desert and cannot safely retrace your route. What is the best next step?', correctChoiceId: 'shade', explanation: 'Contact emergency services and share your location if possible. Staying in one place helps rescuers find you; shade and reduced exertion limit heat exposure.', choices: [
    { id: 'shade', text: 'Call for help, share your location, and rest in shade' }, { id: 'wander', text: 'Walk toward the hottest-looking horizon' }, { id: 'ration', text: 'Drink all your water at once to lighten your pack' },
  ] },
  { id: 'shipwreck', title: 'Shipwreck', description: 'Your small boat capsizes but remains afloat. You are wearing a life jacket. What gives you the best chance of rescue?', correctChoiceId: 'float', explanation: 'Keep your life jacket on and stay with the capsized boat if it remains afloat; it offers shelter and is easier for rescuers to spot. Stay together when possible.', choices: [
    { id: 'float', text: 'Keep your life jacket on, stay with the boat, and signal for help' }, { id: 'dive', text: 'Dive underwater to search for the boat keys' }, { id: 'split', text: 'Swim in different directions from your group' },
  ] },
  { id: 'power', title: 'Storm Blackout', description: 'The power goes out during a storm. What is a safer way to light the room?', correctChoiceId: 'flashlight', explanation: 'Flashlights or battery-powered lanterns avoid the fire risk of candles.', choices: [
    { id: 'flashlight', text: 'Use a flashlight or battery-powered lantern' }, { id: 'candles', text: 'Light candles beside curtains' }, { id: 'outside', text: 'Go outside to check the power lines' },
  ] },
  { id: 'smoke', title: 'Smoke in the Hall', description: 'A fire alarm sounds in your apartment building. You approach smoke near an exit. What should you do?', correctChoiceId: 'stairs', explanation: 'Do not enter a smoke-filled route. Use stairs only when the route is clear; if you cannot exit safely, close the door, call emergency services, and signal for help.', choices: [
    { id: 'stairs', text: 'Use stairs only if the route is clear; otherwise close the door and call for help' }, { id: 'elevator', text: 'Take the elevator to the lobby' }, { id: 'closet', text: 'Hide in a closet and block the door' },
  ] },
  { id: 'ice', title: 'Thin Ice', description: 'You fall through thin ice into freezing water. Which sequence is recommended?', correctChoiceId: 'back', explanation: 'Call out, grab the unbroken edge, kick to get horizontal onto the ice, then roll away to spread your weight.', choices: [
    { id: 'back', text: 'Shout, grab the edge, kick onto the ice, then roll away' }, { id: 'stand', text: 'Stand straight up immediately' }, { id: 'splash', text: 'Splash hard to break more ice around you' },
  ] },
  { id: 'forest', title: 'Wildfire', description: 'Officials issue an evacuation order as a wildfire approaches your area. What should you do?', correctChoiceId: 'evacuate', explanation: 'Follow the evacuation order and designated route promptly. Local emergency authorities provide location-specific instructions.', choices: [
    { id: 'evacuate', text: 'Leave promptly using the designated evacuation route' }, { id: 'cave', text: 'Hide in a small cave surrounded by trees' }, { id: 'wait', text: 'Wait to see flames before deciding to leave' },
  ] },
  { id: 'current', title: 'Rip Current', description: 'A strong rip current pulls you away from shore. What is the safer response?', correctChoiceId: 'parallel', explanation: 'Do not fight the current. Float or tread water and signal for help; if able, swim parallel to shore to leave the current, then angle back toward shore.', choices: [
    { id: 'parallel', text: 'Float or tread water, signal for help, and swim parallel if able' }, { id: 'straight', text: 'Fight directly against the current toward shore' }, { id: 'dive', text: 'Dive down and try to touch the seabed' },
  ] },
];

function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 100 && !Object.hasOwn(Object.prototype, value);
}
function validClock(now: unknown, updatedAt: number): now is number {
  return typeof now === 'number' && Number.isSafeInteger(now) && now >= updatedAt;
}
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items]; let value = seed >>> 0;
  for (let i = result.length - 1; i > 0; i -= 1) {
    value = (value + 0x6d2b79f5) >>> 0; let random = value;
    random = Math.imul(random ^ (random >>> 15), random | 1); random ^= random + Math.imul(random ^ (random >>> 7), random | 61);
    const swap = Math.floor((((random ^ (random >>> 14)) >>> 0) / 4_294_967_296) * (i + 1));
    [result[i], result[swap]] = [result[swap]!, result[i]!];
  }
  return result;
}
function clone<T>(value: T): T { return structuredClone(value); }
function sameScenario(candidate: unknown, scenarioId: string): candidate is ArenaSurvivorScenario {
  const expected = SCENARIOS.find((item) => item.id === scenarioId);
  if (!expected || !plain(candidate)) return false;
  const actual = candidate as unknown as ArenaSurvivorScenario;
  return actual.id === expected.id && actual.title === expected.title && actual.description === expected.description &&
    actual.correctChoiceId === expected.correctChoiceId && actual.explanation === expected.explanation && Array.isArray(actual.choices) &&
    actual.choices.length === expected.choices.length && actual.choices.every((choice, index) =>
      choice?.id === expected.choices[index]?.id && choice?.text === expected.choices[index]?.text);
}
function validMatch(state: ArenaSurvivorMatch): boolean {
  const players = state?.players;
  if (!(state && typeof state === 'object' && /^[\w-]{1,100}$/.test(state.matchId) && Array.isArray(players) &&
    players.length >= ARENA_SURVIVOR_PLAYERS_MIN && players.length <= ARENA_SURVIVOR_PLAYERS_MAX && players.every(validId) && new Set(players).size === players.length &&
    state.round === 1 && ['answering', 'revealed'].includes(state.phase) && sameScenario(state.scenario, state.scenario?.id) &&
    state.scenario.choices.some((choice) => choice.id === state.successfulChoiceId) && state.successfulChoiceId === state.scenario.correctChoiceId && plain(state.choices) &&
    Object.keys(state.choices).every((id) => players.includes(id) && state.scenario.choices.some((choice) => choice.id === state.choices[id])) &&
    Object.values(state.choices).every((id) => typeof id === 'string') && plain(state.scores) && players.every((id) => Number.isSafeInteger(state.scores[id]) && state.scores[id]! >= 0) &&
    Number.isSafeInteger(state.deadline) && Number.isSafeInteger(state.updatedAt) && state.updatedAt >= 0 && Number.isSafeInteger(state.version) && state.version >= 0)) return false;
  if (state.phase === 'answering') return state.outcome === undefined && state.entries === undefined && players.every((id) => state.scores[id] === 0) && state.deadline >= state.updatedAt;
  if (!state.entries || !['revealed', 'timeout'].includes(state.outcome ?? '') || state.deadline !== state.updatedAt || state.entries.length !== players.length ||
    new Set(state.entries.map((entry) => entry.playerId)).size !== players.length || !players.every((id) => state.entries!.some((entry) => entry.playerId === id && entry.choiceId === (state.choices[id] ?? null)))) return false;
  return state.entries.every((entry) => entry.survived === (entry.choiceId !== null && entry.choiceId === state.successfulChoiceId) && state.scores[entry.playerId] === (entry.survived ? ARENA_SURVIVOR_SURVIVE_POINTS : 0));
}
function finish(state: ArenaSurvivorMatch, outcome: 'revealed' | 'timeout', now: number): ArenaSurvivorMatch {
  const next = clone(state); next.phase = 'revealed'; next.outcome = outcome; next.entries = next.players.map((playerId) => ({
    playerId, choiceId: next.choices[playerId] ?? null, survived: next.choices[playerId] === next.successfulChoiceId,
  }));
  for (const playerId of next.players) next.scores[playerId] = next.choices[playerId] === next.successfulChoiceId ? ARENA_SURVIVOR_SURVIVE_POINTS : 0;
  next.updatedAt = now; next.deadline = now; next.version += 1; return next;
}

export function createArenaSurvivorMatch(input: { matchId: string; players: string[]; now: number; seed: number }): ArenaSurvivorMatch {
  if (!input || typeof input.matchId !== 'string' || !/^[\w-]{1,100}$/.test(input.matchId) || !Array.isArray(input.players) ||
    input.players.length < ARENA_SURVIVOR_PLAYERS_MIN || input.players.length > ARENA_SURVIVOR_PLAYERS_MAX || !input.players.every(validId) || new Set(input.players).size !== input.players.length ||
    !Number.isSafeInteger(input.now) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - ARENA_SURVIVOR_CHOICE_DURATION_MS || !Number.isSafeInteger(input.seed)) throw new TypeError('Invalid Arena Survivor match setup');
  const scenario = clone(shuffle(SCENARIOS, input.seed)[0]!);
  const successfulChoiceId = scenario.correctChoiceId;
  return { matchId: input.matchId, players: [...input.players], round: 1, phase: 'answering', scenario, successfulChoiceId,
    choices: {}, deadline: input.now + ARENA_SURVIVOR_CHOICE_DURATION_MS, updatedAt: input.now, version: 0,
    scores: Object.fromEntries(input.players.map((id) => [id, 0])) };
}

export function chooseArenaSurvivor(state: ArenaSurvivorMatch, input: { matchId: string; round: number; playerId: string; choiceId: string; now: number }): ArenaSurvivorMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input !== 'object' || typeof input.matchId !== 'string' || !validId(input.playerId) || typeof input.choiceId !== 'string' ||
    !Number.isSafeInteger(input.round) || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (input.matchId !== state.matchId) return { ok: false, code: 'MATCH_MISMATCH' };
  if (input.round !== 1 || !state.players.includes(input.playerId)) return { ok: false, code: 'UNAUTHORIZED' };
  if (!state.scenario.choices.some((choice) => choice.id === input.choiceId)) return { ok: false, code: 'INVALID_INPUT' };
  const prior = state.choices[input.playerId];
  if (prior !== undefined) return prior === input.choiceId ? { ok: true, state, idempotent: true } : { ok: false, code: 'ALREADY_LOCKED' };
  if (state.phase !== 'answering' || input.now >= state.deadline) return { ok: false, code: 'ROUND_CLOSED' };
  const next = clone(state); next.choices[input.playerId] = input.choiceId; next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}

export function advanceArenaSurvivor(state: ArenaSurvivorMatch, input: { now: number }): ArenaSurvivorMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'revealed') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.now < state.deadline) return { ok: false, code: 'TOO_EARLY' };
  return { ok: true, state: finish(state, 'timeout', input.now) };
}

export function revealArenaSurvivor(state: ArenaSurvivorMatch, input: { now: number }): ArenaSurvivorMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'revealed') return { ok: false, code: 'ROUND_CLOSED' };
  return { ok: true, state: finish(state, 'revealed', input.now) };
}

export function arenaSurvivorSnapshot(state: ArenaSurvivorMatch, viewer: { role: 'host' } | { role: 'spectator' } | { role: 'player'; playerId: string }): ArenaSurvivorSnapshot {
  if (!validMatch(state) || !viewer || !['host', 'spectator', 'player'].includes(viewer.role)) throw new TypeError('Invalid Arena Survivor snapshot request');
  if (viewer.role === 'player' && (!validId(viewer.playerId) || !state.players.includes(viewer.playerId))) throw new TypeError('Arena Survivor snapshot player is not assigned');
  const playerId = viewer.role === 'player' ? viewer.playerId : undefined;
  return { matchId: state.matchId, round: 1, phase: state.phase, players: [...state.players],
    deadline: state.deadline, version: state.version, submitted: Boolean(playerId && state.choices[playerId]), answerCount: Object.keys(state.choices).length,
    scenario: { id: state.scenario.id, title: state.scenario.title, description: state.scenario.description, choices: clone(state.scenario.choices) },
    ...(playerId ? { assignment: { role: 'survivor' as const } } : {}),
    ...(playerId && state.choices[playerId] ? { ownChoiceId: state.choices[playerId] } : {}),
    ...(state.phase === 'revealed' ? { result: getArenaSurvivorResult(state) } : {}) };
}

export function getArenaSurvivorResult(state: ArenaSurvivorMatch): ArenaSurvivorResult {
  if (!validMatch(state) || state.phase !== 'revealed' || !state.outcome || !state.entries) throw new TypeError('Arena Survivor result is not ready');
  const choiceCounts = Object.fromEntries(state.scenario.choices.map(({ id }) => [id, state.entries!.filter((entry) => entry.choiceId === id).length]));
  return { matchId: state.matchId, round: 1, outcome: state.outcome,
    scenario: { id: state.scenario.id, title: state.scenario.title, description: state.scenario.description, choices: clone(state.scenario.choices) }, correctChoiceId: state.successfulChoiceId,
    explanation: state.scenario.explanation, submissions: clone(state.entries), choiceCounts,
    winners: state.entries.filter((entry) => entry.survived).map((entry) => entry.playerId), scores: { ...state.scores } };
}
