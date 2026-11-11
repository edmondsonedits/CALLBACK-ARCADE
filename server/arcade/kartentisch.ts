export const KARTENTISCH_MIN_PLAYERS = 3;
export const KARTENTISCH_MAX_PLAYERS = 10;
export const KARTENTISCH_TRICKS = 5;
export const KARTENTISCH_TRICK_MS = 40_000;
export const KARTENTISCH_SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type KartentischSuit = (typeof KARTENTISCH_SUITS)[number];
export interface KartentischCard { id: string; rank: number; suit: KartentischSuit }
export interface KartentischTrickResult { trick: number; leaderPlayerId: string; ledSuit: KartentischSuit; trumpSuit: KartentischSuit; plays: Array<{ playerId: string; card: KartentischCard }>; winnerPlayerId: string; scores: Record<string, number>; timedOut: boolean }
export interface KartentischMatch {
  matchId: string; players: string[]; trick: number; phase: "playing" | "revealed" | "complete"; trumpSuit: KartentischSuit;
  leaderPlayerId: string; turnPlayerId: string | null; hands: Record<string, KartentischCard[]>; initialHands: Record<string, KartentischCard[]>;
  plays: Record<string, KartentischCard>; scores: Record<string, number>; deadline: number; updatedAt: number; version: number;
  trickResults: KartentischTrickResult[]; seed: number;
  result?: { matchId: string; scores: Record<string, number>; winners: string[]; tricksPlayed: number; hands: Record<string, KartentischCard[]> };
}
export type KartentischMutation = { ok: true; state: KartentischMatch; idempotent?: boolean } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "TRICK_MISMATCH" | "WRONG_TURN" | "UNAUTHORIZED" | "CARD_NOT_HELD" | "MUST_FOLLOW_SUIT" | "TRICK_CLOSED" | "TOO_EARLY" };

function deck(): KartentischCard[] { return KARTENTISCH_SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, index) => { const rank = index + 2; return { id: `${rank}${suit[0]!.toUpperCase()}`, rank, suit }; })); }
function shuffle(cards: KartentischCard[], initialSeed: number): KartentischCard[] {
  let state = initialSeed >>> 0;
  const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
  for (let i = cards.length - 1; i > 0; i -= 1) { const j = next() % (i + 1); [cards[i], cards[j]] = [cards[j]!, cards[i]!]; }
  return cards;
}
const clone = <T,>(value: T): T => structuredClone(value);
function orderFor(match: KartentischMatch): string[] { const index = match.players.indexOf(match.leaderPlayerId); return [...match.players.slice(index), ...match.players.slice(0, index)]; }
function deriveTurn(match: KartentischMatch): string | null { return orderFor(match).find((id) => !match.plays[id]) ?? null; }
function legalCards(match: KartentischMatch, playerId: string): KartentischCard[] {
  const hand = match.hands[playerId] ?? [];
  const lead = match.plays[match.leaderPlayerId];
  return lead && hand.some((card) => card.suit === lead.suit) ? hand.filter((card) => card.suit === lead.suit) : [...hand];
}
function isValid(match: KartentischMatch): boolean {
  if (!match || !/^[\w-]{1,120}$/.test(match.matchId) || !Array.isArray(match.players) || match.players.length < 3 || match.players.length > KARTENTISCH_MAX_PLAYERS || new Set(match.players).size !== match.players.length || match.players.some((id) => typeof id !== "string" || !id.trim()) || !match.players.includes(match.leaderPlayerId) || !KARTENTISCH_SUITS.includes(match.trumpSuit) || !Number.isInteger(match.trick) || match.trick < 1 || match.trick > 5 || !["playing", "revealed", "complete"].includes(match.phase) || !Number.isSafeInteger(match.deadline) || !Number.isSafeInteger(match.updatedAt) || match.deadline < match.updatedAt || !Number.isInteger(match.version) || match.version < 0 || !Number.isSafeInteger(match.seed) || !match.hands || !match.initialHands || !match.plays || !match.scores || !Array.isArray(match.trickResults) || match.trickResults.length !== match.trick - (match.phase === "playing" ? 1 : 0)) return false;
  const cardIds = Object.values(match.initialHands).flat().map((card) => card.id);
  if (match.players.some((id) => {
    const hand = match.hands[id]; const dealt = match.initialHands[id]; const played = match.plays[id];
    if (!Array.isArray(hand) || hand.length !== KARTENTISCH_TRICKS - (match.trick - 1) - Number(Boolean(played)) || !Array.isArray(dealt) || dealt.length !== KARTENTISCH_TRICKS || !Number.isInteger(match.scores[id]) || match.scores[id]! < 0) return true;
    const original = new Set(dealt.map((card) => card.id)); const remaining = new Set(hand.map((card) => card.id));
    return remaining.size !== hand.length || hand.some((card) => !original.has(card.id)) || Boolean(played && (!original.has(played.id) || remaining.has(played.id))) || remaining.size + match.trick - 1 + Number(Boolean(played)) !== original.size;
  })) return false;
  if (match.phase === "playing" && (match.turnPlayerId !== deriveTurn(match) || Object.keys(match.plays).some((id) => !match.players.includes(id)) || match.result)) return false;
  if (match.phase === "revealed" && (!match.trickResults.at(-1) || match.turnPlayerId !== null || Object.keys(match.plays).length !== match.players.length || match.result)) return false;
  if (match.phase === "complete" && (!match.result || match.result.tricksPlayed !== KARTENTISCH_TRICKS || match.turnPlayerId !== null || match.trickResults.length !== KARTENTISCH_TRICKS)) return false;
  return cardIds.length === new Set(cardIds).size;
}
function finish(match: KartentischMatch): KartentischMatch {
  const max = Math.max(...Object.values(match.scores));
  return { ...match, phase: "complete", turnPlayerId: null, result: { matchId: match.matchId, scores: { ...match.scores }, winners: match.players.filter((id) => match.scores[id] === max), tricksPlayed: match.trickResults.length, hands: clone(match.initialHands) } };
}
export function createKartentischMatch(input: { matchId: string; players: string[]; now: number; seed: number }): KartentischMatch {
  if (!input || !/^[\w-]{1,120}$/.test(input.matchId) || !Array.isArray(input.players) || input.players.length < 3 || input.players.length > KARTENTISCH_MAX_PLAYERS || input.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0 || !Number.isSafeInteger(input.seed)) throw new TypeError("Kartentisch requires 3–10 players and a safe seed/clock");
  const cards = shuffle(deck(), input.seed); const hands: Record<string, KartentischCard[]> = Object.fromEntries(input.players.map((id) => [id, []]));
  for (let round = 0; round < KARTENTISCH_TRICKS; round += 1) for (const id of input.players) hands[id]!.push(cards.shift()!);
  const trumpSuit = cards[0]!.suit;
  const match: KartentischMatch = { matchId: input.matchId, players: [...input.players], trick: 1, phase: "playing", trumpSuit, leaderPlayerId: input.players[0]!, turnPlayerId: input.players[0]!, hands, initialHands: clone(hands), plays: {}, scores: Object.fromEntries(input.players.map((id) => [id, 0])), deadline: input.now + KARTENTISCH_TRICK_MS, updatedAt: input.now, version: 0, trickResults: [], seed: input.seed };
  return match;
}
export function kartentischLegalCards(match: KartentischMatch, playerId: string): KartentischCard[] { return clone(legalCards(match, playerId)); }
export function chooseKartentischCard(match: KartentischMatch, input: { matchId: string; trick: number; playerId: string; cardId: string; now: number }): KartentischMutation {
  if (!isValid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input.matchId !== "string" || typeof input.playerId !== "string" || typeof input.cardId !== "string" || !Number.isSafeInteger(input.trick) || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.trick !== match.trick) return { ok: false, code: "TRICK_MISMATCH" };
  if (!match.players.includes(input.playerId)) return { ok: false, code: "UNAUTHORIZED" };
  if (match.phase !== "playing" || match.turnPlayerId === null || input.now >= match.deadline) return { ok: false, code: "TRICK_CLOSED" };
  if (input.playerId !== match.turnPlayerId) return { ok: false, code: "WRONG_TURN" };
  const card = match.hands[input.playerId]!.find((held) => held.id === input.cardId);
  if (!card) return { ok: false, code: "CARD_NOT_HELD" };
  const legal = legalCards(match, input.playerId);
  if (!legal.some((held) => held.id === card.id)) return { ok: false, code: "MUST_FOLLOW_SUIT" };
  const next = clone(match); next.hands[input.playerId] = next.hands[input.playerId]!.filter((held) => held.id !== card.id); next.plays[input.playerId] = card; next.turnPlayerId = deriveTurn(next); next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}
export function revealKartentischTrick(match: KartentischMatch, input: { now: number }): KartentischMutation {
  if (!isValid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "playing") return { ok: false, code: "TRICK_CLOSED" };
  const timedOut = input.now >= match.deadline;
  if (!timedOut && match.turnPlayerId !== null) return { ok: false, code: "TOO_EARLY" };
  const next = clone(match);
  for (const playerId of orderFor(next)) if (!next.plays[playerId]) {
    const fallback = legalCards(next, playerId).sort((a, b) => a.rank - b.rank || KARTENTISCH_SUITS.indexOf(a.suit) - KARTENTISCH_SUITS.indexOf(b.suit))[0];
    if (!fallback) return { ok: false, code: "INVALID_STATE" };
    next.hands[playerId] = next.hands[playerId]!.filter((card) => card.id !== fallback.id); next.plays[playerId] = fallback;
  }
  const ordered = orderFor(next).map((playerId) => ({ playerId, card: next.plays[playerId]! })); const ledSuit = ordered[0]!.card.suit;
  const winner = ordered.reduce((best, entry) => {
    const rank = (card: KartentischCard) => card.suit === next.trumpSuit ? 100 + card.rank : card.suit === ledSuit ? card.rank : 0;
    return rank(entry.card) > rank(best.card) ? entry : best;
  });
  next.scores[winner.playerId] = next.scores[winner.playerId]! + 1;
  next.trickResults.push({ trick: next.trick, leaderPlayerId: next.leaderPlayerId, ledSuit, trumpSuit: next.trumpSuit, plays: ordered, winnerPlayerId: winner.playerId, scores: { ...next.scores }, timedOut });
  next.phase = "revealed"; next.turnPlayerId = null; next.deadline = input.now; next.updatedAt = input.now; next.version += 1;
  if (next.trick === KARTENTISCH_TRICKS) return { ok: true, state: finish(next) };
  return { ok: true, state: next };
}
export function advanceKartentischTrick(match: KartentischMatch, input: { now: number }): KartentischMutation {
  if (!isValid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > Number.MAX_SAFE_INTEGER - KARTENTISCH_TRICK_MS) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "revealed" || match.trick >= KARTENTISCH_TRICKS) return { ok: false, code: "TRICK_CLOSED" };
  const winner = match.trickResults.at(-1)!.winnerPlayerId;
  const next: KartentischMatch = { ...clone(match), trick: match.trick + 1, phase: "playing", leaderPlayerId: winner, turnPlayerId: winner, plays: {}, deadline: input.now + KARTENTISCH_TRICK_MS, updatedAt: input.now, version: match.version + 1 };
  return { ok: true, state: next };
}
export function kartentischSnapshot(match: KartentischMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }) {
  if (!isValid(match)) throw new TypeError("Invalid Kartentisch state");
  const lead = match.plays[match.leaderPlayerId];
  const base = { matchId: match.matchId, players: [...match.players], trick: match.trick, trickCount: KARTENTISCH_TRICKS as 5, phase: match.phase, trumpSuit: match.trumpSuit, leaderPlayerId: match.leaderPlayerId, turnPlayerId: match.turnPlayerId, deadline: match.deadline, version: match.version, scores: { ...match.scores }, handCounts: Object.fromEntries(match.players.map((id) => [id, match.hands[id]!.length])), playsCount: Object.keys(match.plays).length, submitted: viewer.role === "player" && Boolean(match.plays[viewer.playerId]), leadSuit: lead?.suit, trickResult: match.phase !== "playing" ? clone(match.trickResults.at(-1)) : undefined, trickResults: match.phase === "complete" ? clone(match.trickResults) : [], result: match.result ? clone(match.result) : undefined, ...(viewer.role === "player" && match.players.includes(viewer.playerId) ? { ownHand: clone(match.hands[viewer.playerId]!) } : {}) };
  return base;
}
