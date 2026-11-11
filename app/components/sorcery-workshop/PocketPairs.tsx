"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Workshop.module.css";
import { createPocketPairsDeck, isPocketPairsSave, type PocketPairsSave } from "./PocketPairsModel";

const LOCAL_PROFILE_KEY = "callback-pocket-profile-id";
const LOCAL_BEST_PREFIX = "callback-pocket-pairs-best";
const LOCAL_MATCH_PREFIX = "callback-pocket-pairs-match";
type Props = { paused: boolean; matchId: string; round: number };
function localProfileId(): string | null {
  try {
    let id = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(LOCAL_PROFILE_KEY, id); }
    return /^[0-9a-f-]{36}$/iu.test(id) ? id : null;
  } catch { return null; }
}
function readBest(key: string): number | null {
  try { const value = Number(localStorage.getItem(key)); return Number.isSafeInteger(value) && value > 0 ? value : null; }
  catch { return null; }
}
function readSave(key: string): PocketPairsSave | null {
  try { const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null"); return isPocketPairsSave(saved) ? saved : null; }
  catch { return null; }
}
const INITIAL_GAME: PocketPairsSave = { deck: ["♜", "♜", "✦", "✦", "♞", "♞"], open: [], matched: [], turns: 0, paused: false };
const newGame = (): PocketPairsSave => ({ deck: createPocketPairsDeck(), open: [], matched: [], turns: 0, paused: false });

export function PocketPairs({ paused, matchId, round }: Props) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [game, setGame] = useState<PocketPairsSave>(INITIAL_GAME);
  const gameRef = useRef(game);
  const lastRound = useRef(round);
  const [best, setBest] = useState<number | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const effectivePaused = paused || game.paused;
  const storageKey = useMemo(() => profileId && matchId ? `${LOCAL_MATCH_PREFIX}:${profileId}:${encodeURIComponent(matchId)}` : null, [profileId, matchId]);
  const bestKey = profileId ? `${LOCAL_BEST_PREFIX}:${profileId}` : null;

  useEffect(() => {
    let live = true;
    const frame = requestAnimationFrame(() => {
      if (!live) return;
      const id = localProfileId(); setProfileId(id);
      if (!id) { setLoadedFor(""); return; }
      const savedBest = readBest(`${LOCAL_BEST_PREFIX}:${id}`); setBest(savedBest);
      const key = `${LOCAL_MATCH_PREFIX}:${id}:${encodeURIComponent(matchId)}`;
      setGame(readSave(key) ?? newGame()); setLoadedFor(key);
    });
    return () => { live = false; cancelAnimationFrame(frame); };
  }, [matchId]);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => {
    if (lastRound.current !== round) {
      const frame = requestAnimationFrame(() => setGame(current => ({ ...current, paused: true })));
      lastRound.current = round;
      return () => cancelAnimationFrame(frame);
    }
    lastRound.current = round;
  }, [round]);

  useEffect(() => {
    if (!storageKey || loadedFor !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(game)); } catch { /* Keep the current game playable when storage is unavailable. */ }
  }, [game, loadedFor, storageKey]);
  useEffect(() => () => {
    if (storageKey && loadedFor === storageKey) try { localStorage.setItem(storageKey, JSON.stringify({ ...gameRef.current, paused: true })); } catch { /* Preserve the game in memory if local storage is unavailable. */ }
  }, [loadedFor, storageKey]);

  const ready = storageKey ? loadedFor === storageKey : loadedFor === "";
  const won = game.matched.length === 6;

  useEffect(() => {
    if (effectivePaused || game.open.length !== 2) return;
    const [left, right] = game.open;
    if (game.deck[left!] === game.deck[right!]) return;
    const timer = window.setTimeout(() => setGame(current => ({ ...current, open: [] })), 900);
    return () => window.clearTimeout(timer);
  }, [effectivePaused, game.deck, game.open]);

  function reveal(index: number) {
    if (effectivePaused || game.open.length >= 2 || game.open.includes(index) || game.matched.includes(index)) return;
    if (!game.open.length) { setGame(current => ({ ...current, open: [index] })); return; }
    const other = game.open[0]!;
    const matched = game.deck[other] === game.deck[index] ? [...game.matched, other, index] : game.matched;
    const turns = game.turns + 1;
    if (matched.length === 6 && (best === null || turns < best)) {
      setBest(turns);
      if (bestKey) try { localStorage.setItem(bestKey, String(turns)); } catch { /* Keep the in-memory best for this visit. */ }
    }
    setGame(current => ({ ...current, open: matched.length > current.matched.length ? [] : [other, index], matched, turns }));
  }

  return <div aria-label="Pocket pairs">
    <p>Find three pairs. {game.turns} turns. Progress saves on this device for this match. {best ? `Personal best: ${best} turns.` : "No personal best yet."} No competitive points.</p>
    {!ready && <p role="status">Loading your private pocket pairs…</p>}
    {effectivePaused && <p role="status">Pocket pairs paused for the room’s next activity.</p>}
    <div className={styles.cards} role="group" aria-label="Six pocket pairs cards">
      {game.deck.map((symbol, index) => {
        const visible = game.open.includes(index) || game.matched.includes(index);
        return <button key={index} type="button" disabled={!ready || effectivePaused || game.open.length >= 2 || game.matched.includes(index)} aria-label={visible ? `Card ${index + 1}: ${symbol}` : `Card ${index + 1}`} aria-pressed={visible} onClick={() => reveal(index)}>{visible ? symbol : "?"}</button>;
      })}
    </div>
    {won && <p role="status">All three pairs found in {game.turns} turns! Your best is {best ?? game.turns}. You earned no competitive points.</p>}
    <button type="button" disabled={!ready || paused} aria-pressed={game.paused} onClick={() => setGame(current => ({ ...current, paused: !current.paused }))}>{game.paused ? "Resume pairs" : "Pause pairs"}</button>
    <button type="button" disabled={!ready || paused} onClick={() => setGame(newGame())}>New game</button>
  </div>;
}
