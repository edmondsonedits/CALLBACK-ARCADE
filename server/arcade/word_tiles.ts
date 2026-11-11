export const WORD_TILES_MIN_PLAYERS = 2;
export const WORD_TILES_MAX_PLAYERS = 10;
export const WORD_TILES_ROUNDS = 5;
export const WORD_TILES_RACK_SIZE = 7;
export const WORD_TILES_ROUND_MS = 45_000;

// First-party starter lexicon. It is intentionally shipped with the game so word
// validation never depends on a paid API, remote dictionary, or client claims.
export const WORD_TILES_DICTIONARY = new Set((
  "about above actor adapt admit adopt adult after again agent agree ahead alarm album alert alien alike alive allow alone along alter among anger angle angry ankle apart apple apply arena argue arise armor aroma array arrow aside asset audio avoid awake award aware awful badge badly baker basic basin basis beach began begin being below bench berry birth black blade blame blank blind block blood board boost booth bound brain brand brass brave bread break brick brief bring broad broke brown brush build bunch burst buyer cable camel candy carry carve catch cause chain chair charm chart chase cheap check chess chest chief child chill china choice chose civil claim class clean clear clerk click climb clock close cloth cloud coach coast coral couch count court cover craft crane crash crazy cream creek crime crisp cross crowd crown curve cycle dance doubt dozen draft drama dream dress drink drive eager early earth eight elbow elect else email empty enemy enjoy enter entry equal error event every exact exist extra faith false fancy fault feast fence fever field fifth fifty fight final first flame flash fleet floor flour fluid focus force frame fresh front fruit funny giant given glass globe glove going grace grade grand grant grape graph grass great green greet grief group guard guess guide habit happy heart heavy hello hence honey honor horse hotel human hurry ideal image imply index inner input issue ivory jewel joint judge juice keeps knife knock known label labor laser later laugh layer learn least leave legal lemon level light limit links lively local logic lonely loose lucky lunch magic major maker match maybe medal media metal meter might mild minor model money month moral motor mount mouse mouth movie music nerve never night noble noise north novel nurse ocean offer often olive onion order other ought owner packer paint panel paper party peace pearl penny phase phone photo piano piece pilot place plain plane plant plate point power press price pride prime print prize proof proud queen quick quiet quite radio raise range rapid ratio reach ready realm relax reply right river robot rock roof rough round route royal ruler rural salad scale scene scope score scout sense serve seven shall shape share sharp sheep sheet shelf shell shift shine shirt shock shore short shout shown sight since skill sleep slice slide small smart smell smile smoke snack solve sorry sound south space spare speak speed spell spend spice split sport stack staff stage stair stand start state steel stick still stock stone storm story strip sugar suite super sweet swift table taken taste teach team thank their theme there these thick thing think third those three throw tight tiger timer tissue title toast today token topic total tough tower trace track trade train treat trend trial tribe trick trust truth twice uncle under union until upper urban usage usual valid value video visit vocal voice waste watch water wheel where which while white whole whose woman wonder world worry worth write wrong yacht yield young zebra "
).split(/\s+/u).filter(Boolean));

const LETTER_VALUES: Record<string, number> = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10 };
const clone = <T,>(value: T): T => structuredClone(value);

export interface WordTilesRoundData { letters: string; solutionWord: string }
export interface WordTilesEntry { playerId: string; word: string | null; timedOut: boolean; tileScore: number; bonus: number; scoreEarned: number }
export interface WordTilesRoundResult { round: number; letters: string; timedOut: boolean; submissions: WordTilesEntry[]; scores: Record<string, number>; leaders: string[] }
export interface WordTilesMatch { matchId: string; players: string[]; round: number; phase: "choosing" | "revealed" | "complete"; roundData: WordTilesRoundData[]; choices: Record<string, string | null>; scores: Record<string, number>; deadline: number; updatedAt: number; version: number; roundResults: WordTilesRoundResult[]; result?: { matchId: string; scores: Record<string, number>; winners: string[]; roundsPlayed: number; rounds: WordTilesRoundResult[] } }
export type WordTilesMutation = { ok: true; state: WordTilesMatch; idempotent?: boolean } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "ROUND_MISMATCH" | "ROUND_CLOSED" | "UNAUTHORIZED" | "INVALID_WORD" | "WORD_NOT_IN_RACK" | "ALREADY_LOCKED" | "TOO_EARLY" };

function rng(seed: number) { let state = seed >>> 0 || 0x9e3779b9; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x1_0000_0000; }; }
function createRoundData(seed: number): WordTilesRoundData[] {
  const random = rng(seed); const bank = [...WORD_TILES_DICTIONARY].filter((word) => word.length >= 5 && word.length <= WORD_TILES_RACK_SIZE).sort();
  return Array.from({ length: WORD_TILES_ROUNDS }, () => {
    const solutionWord = bank[Math.floor(random() * bank.length)]!;
    const letters = [...solutionWord.toUpperCase()];
    while (letters.length < WORD_TILES_RACK_SIZE) letters.push("AEIOURSTLN"[Math.floor(random() * 10)]!);
    for (let index = letters.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [letters[index], letters[other]] = [letters[other]!, letters[index]!]; }
    return { letters: letters.join(""), solutionWord };
  });
}
function sameScores(actual: Record<string, number>, expected: Record<string, number>, players: string[]): boolean {
  return Object.keys(actual).length === players.length && players.every((id) => actual[id] === expected[id]);
}
function sameRoundResult(actual: WordTilesRoundResult, expected: WordTilesRoundResult, players: string[]): boolean {
  return actual.round === expected.round && actual.letters === expected.letters && actual.timedOut === expected.timedOut &&
    actual.leaders.length === expected.leaders.length && actual.leaders.every((id, index) => id === expected.leaders[index]) &&
    sameScores(actual.scores, expected.scores, players) && actual.submissions.length === expected.submissions.length &&
    actual.submissions.every((entry, index) => {
      const other = expected.submissions[index];
      return Boolean(other) && entry.playerId === other!.playerId && entry.word === other!.word && entry.timedOut === other!.timedOut && entry.tileScore === other!.tileScore && entry.bonus === other!.bonus && entry.scoreEarned === other!.scoreEarned;
    });
}

/** Full trust-boundary validator shared by the engine and D1 persistence parser. */
export function isValidWordTilesMatch(value: unknown): value is WordTilesMatch {
  const match = value as WordTilesMatch;
  if (!match || typeof match !== "object" || !/^[\w-]{1,120}$/.test(match.matchId) || !Array.isArray(match.players) || match.players.length < WORD_TILES_MIN_PLAYERS || match.players.length > WORD_TILES_MAX_PLAYERS || new Set(match.players).size !== match.players.length || match.players.some((id) => typeof id !== "string" || !id.trim()) || !Number.isInteger(match.round) || match.round < 1 || match.round > WORD_TILES_ROUNDS || !["choosing", "revealed", "complete"].includes(match.phase) || !Array.isArray(match.roundData) || match.roundData.length !== WORD_TILES_ROUNDS || !Array.isArray(match.roundResults) || !match.choices || typeof match.choices !== "object" || !match.scores || typeof match.scores !== "object" || !Number.isSafeInteger(match.deadline) || !Number.isSafeInteger(match.updatedAt) || match.deadline < match.updatedAt || !Number.isInteger(match.version) || match.version < 0) return false;
  if (match.roundData.some((round) => !round || !/^[A-Z]{7}$/.test(round.letters) || !WORD_TILES_DICTIONARY.has(round.solutionWord) || !canBuild(round.letters, round.solutionWord))) return false;
  const currentRack = match.roundData[match.round - 1]!.letters;
  if (Object.keys(match.choices).some((id) => !match.players.includes(id) || (match.choices[id] !== null && (!WORD_TILES_DICTIONARY.has(match.choices[id]!) || !canBuild(currentRack, match.choices[id]!))))) return false;
  if (!sameScores(match.scores, match.scores, match.players) || match.players.some((id) => !Number.isInteger(match.scores[id]) || match.scores[id]! < 0) || match.roundResults.length !== (match.phase === "choosing" ? match.round - 1 : match.round)) return false;
  if ((match.phase === "choosing" && (match.deadline < match.updatedAt || match.result)) || (match.phase !== "choosing" && match.deadline !== match.updatedAt) || (match.phase === "complete") !== Boolean(match.result)) return false;

  let totals = Object.fromEntries(match.players.map((id) => [id, 0])) as Record<string, number>;
  for (const [index, result] of match.roundResults.entries()) {
    const round = match.roundData[index]!;
    if (!result || result.round !== index + 1 || result.letters !== round.letters || !Array.isArray(result.submissions) || result.submissions.length !== match.players.length || new Set(result.submissions.map((entry) => entry.playerId)).size !== match.players.length || result.submissions.some((entry, seat) => !entry || entry.playerId !== match.players[seat] || (entry.word !== null && (!WORD_TILES_DICTIONARY.has(entry.word) || !canBuild(round.letters, entry.word))) || (entry.timedOut && entry.word !== null))) return false;

    const tileScores = result.submissions.map((entry) => entry.word ? scoreWord(entry.word) : 0);
    const best = Math.max(0, ...tileScores);
    const leaders = best > 0 ? match.players.filter((_, seat) => tileScores[seat] === best) : [];
    const nextTotals = { ...totals };
    const scoringValid = result.submissions.every((entry, seat) => {
      const tileScore = tileScores[seat]!;
      const bonus = leaders.includes(entry.playerId) ? leaders.length === 1 ? 3 : 1 : 0;
      const scoreEarned = tileScore + bonus;
      nextTotals[entry.playerId]! += scoreEarned;
      return entry.tileScore === tileScore && entry.bonus === bonus && entry.scoreEarned === scoreEarned;
    });
    if (!scoringValid || result.timedOut !== result.submissions.some((entry) => entry.timedOut) || leaders.length !== result.leaders.length || leaders.some((id, seat) => id !== result.leaders[seat]) || !sameScores(result.scores, nextTotals, match.players)) return false;
    totals = nextTotals;
  }
  if (!sameScores(match.scores, totals, match.players)) return false;

  if (match.phase !== "choosing") {
    const last = match.roundResults[match.round - 1]!;
    if (last.submissions.some((entry) => entry.timedOut ? Object.hasOwn(match.choices, entry.playerId) : !Object.hasOwn(match.choices, entry.playerId) || match.choices[entry.playerId] !== entry.word)) return false;
  }
  if (!match.result) return true;
  const winners = match.players.filter((id) => match.scores[id] === Math.max(...Object.values(match.scores)));
  return match.result.matchId === match.matchId && match.result.roundsPlayed === WORD_TILES_ROUNDS && match.result.rounds.length === WORD_TILES_ROUNDS &&
    sameScores(match.result.scores, match.scores, match.players) && winners.length === match.result.winners.length && winners.every((id, index) => id === match.result!.winners[index]) &&
    match.result.rounds.every((round, index) => sameRoundResult(round, match.roundResults[index]!, match.players));
}
function canBuild(letters: string, word: string): boolean {
  if (!/^[a-z]{3,7}$/.test(word)) return false;
  const counts = new Map<string, number>(); for (const letter of letters.toLowerCase()) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  for (const letter of word) { const count = counts.get(letter) ?? 0; if (count < 1) return false; counts.set(letter, count - 1); }
  return true;
}
function scoreWord(word: string): number {
  const points = [...word.toUpperCase()].reduce((sum, letter) => sum + LETTER_VALUES[letter]!, 0);
  return points + (word.length === WORD_TILES_RACK_SIZE ? 3 : 0);
}
function complete(match: WordTilesMatch): WordTilesMatch {
  const winners = match.players.filter((id) => match.scores[id] === Math.max(...Object.values(match.scores)));
  return { ...match, phase: "complete", result: { matchId: match.matchId, scores: { ...match.scores }, winners, roundsPlayed: WORD_TILES_ROUNDS, rounds: clone(match.roundResults) } };
}

export function createWordTilesMatch(input: { matchId: string; players: string[]; now: number; seed: number }): WordTilesMatch {
  if (!input || !/^[\w-]{1,120}$/.test(input.matchId) || !Array.isArray(input.players) || input.players.length < WORD_TILES_MIN_PLAYERS || input.players.length > WORD_TILES_MAX_PLAYERS || input.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || !Number.isSafeInteger(input.seed) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - WORD_TILES_ROUND_MS) throw new TypeError("Word Tiles requires 2–10 players and a safe seed/clock");
  const match: WordTilesMatch = { matchId: input.matchId, players: [...input.players], round: 1, phase: "choosing", roundData: createRoundData(input.seed), choices: {}, scores: Object.fromEntries(input.players.map((id) => [id, 0])), deadline: input.now + WORD_TILES_ROUND_MS, updatedAt: input.now, version: 0, roundResults: [] };
  if (!isValidWordTilesMatch(match)) throw new TypeError("Could not create a valid Word Tiles match");
  return match;
}
export function chooseWordTilesWord(match: WordTilesMatch, input: { matchId: string; round: number; playerId: string; word: string | null; now: number }): WordTilesMutation {
  if (!isValidWordTilesMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input.matchId !== "string" || typeof input.playerId !== "string" || (input.word !== null && typeof input.word !== "string") || !Number.isSafeInteger(input.round) || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.round !== match.round) return { ok: false, code: "ROUND_MISMATCH" };
  if (!match.players.includes(input.playerId)) return { ok: false, code: "UNAUTHORIZED" };
  if (match.phase !== "choosing" || input.now >= match.deadline) return { ok: false, code: "ROUND_CLOSED" };
  const normalized = input.word === null ? null : input.word.trim().toLowerCase();
  const previous = match.choices[input.playerId];
  if (Object.hasOwn(match.choices, input.playerId)) return previous === normalized ? { ok: true, state: match, idempotent: true } : { ok: false, code: "ALREADY_LOCKED" };
  if (normalized !== null && (!/^[a-z]{3,7}$/.test(normalized) || !WORD_TILES_DICTIONARY.has(normalized))) return { ok: false, code: "INVALID_WORD" };
  if (normalized !== null && !canBuild(match.roundData[match.round - 1]!.letters, normalized)) return { ok: false, code: "WORD_NOT_IN_RACK" };
  const next = clone(match); next.choices[input.playerId] = normalized; next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}
export function revealWordTilesRound(match: WordTilesMatch, input: { now: number }): WordTilesMutation {
  if (!isValidWordTilesMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "choosing") return { ok: false, code: "ROUND_CLOSED" };
  const missing = match.players.some((playerId) => !Object.hasOwn(match.choices, playerId));
  if (missing && input.now < match.deadline) return { ok: false, code: "TOO_EARLY" };
  const letters = match.roundData[match.round - 1]!.letters;
  const entries = match.players.map((playerId) => { const word = match.choices[playerId] ?? null; return { playerId, word, timedOut: !Object.hasOwn(match.choices, playerId), tileScore: word ? scoreWord(word) : 0, bonus: 0, scoreEarned: 0 }; });
  const best = Math.max(0, ...entries.map((entry) => entry.tileScore)); const leaders = best ? entries.filter((entry) => entry.tileScore === best).map((entry) => entry.playerId) : [];
  const next = clone(match);
  for (const entry of entries) { entry.bonus = leaders.length && entry.tileScore === best ? leaders.length === 1 ? 3 : 1 : 0; entry.scoreEarned = entry.tileScore + entry.bonus; next.scores[entry.playerId]! += entry.scoreEarned; }
  next.roundResults.push({ round: match.round, letters, timedOut: entries.some((entry) => entry.timedOut), submissions: entries, scores: { ...next.scores }, leaders }); next.phase = "revealed"; next.deadline = input.now; next.updatedAt = input.now; next.version += 1;
  if (match.round === WORD_TILES_ROUNDS) return { ok: true, state: complete(next) };
  return { ok: true, state: next };
}
export function nextWordTilesRound(match: WordTilesMatch, input: { now: number }): WordTilesMutation {
  if (!isValidWordTilesMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > Number.MAX_SAFE_INTEGER - WORD_TILES_ROUND_MS) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "revealed" || match.round >= WORD_TILES_ROUNDS) return { ok: false, code: "ROUND_CLOSED" };
  return { ok: true, state: { ...clone(match), round: match.round + 1, choices: {}, phase: "choosing", deadline: input.now + WORD_TILES_ROUND_MS, updatedAt: input.now, version: match.version + 1 } };
}
export function wordTilesSnapshot(match: WordTilesMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }): import("../../lib/contracts").SnapshotWordTiles {
  if (!isValidWordTilesMatch(match)) throw new TypeError("Invalid Word Tiles state");
  const base = { matchId: match.matchId, players: [...match.players], round: match.round, roundCount: WORD_TILES_ROUNDS as 5, phase: match.phase, letters: match.roundData[match.round - 1]!.letters, scores: { ...match.scores }, deadline: match.deadline, version: match.version, submissionCount: Object.keys(match.choices).length, submitted: viewer.role === "player" && Object.hasOwn(match.choices, viewer.playerId), roundResults: match.phase === "complete" ? clone(match.roundResults) : [], roundResult: match.phase !== "choosing" ? clone(match.roundResults.at(-1)) : undefined, result: match.result ? clone(match.result) : undefined };
  if (match.phase === "choosing" && viewer.role === "player" && Object.hasOwn(match.choices, viewer.playerId)) return { ...base, ownWord: match.choices[viewer.playerId] ?? null };
  return base;
}
