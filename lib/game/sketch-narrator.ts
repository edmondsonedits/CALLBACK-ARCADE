import { NARRATOR_LINES, NARRATOR_MOODS, NARRATOR_SCENARIOS, type NarratorMood, type NarratorScenario } from "../content/sketch-narrator-lines";
import { deterministicShuffle, stableHash } from "./random";

export const NARRATOR_PERSONALITIES: Record<NarratorMood, { label: string; description: string }> = {
  nice: { label: "Nice", description: "Your wildly supportive art teacher" },
  funny: { label: "Funny", description: "A dry emcee with an imaginary budget" },
  quirky: { label: "Quirky", description: "The museum's surreal paperwork department" },
  silly: { label: "Silly", description: "A wizard whose spells need supervision" },
  sassy: { label: "Sassy", description: "A dramatic diva at the gallery door" },
  critical: { label: "Critical", description: "A pompous critic with a tiny monocle" },
  analytical: { label: "Analytical", description: "Deadpan research into questionable art" },
  mean: { label: "Mean", description: "A theatrical roast of the art and the show" },
};
export const isNarratorMood = (value: unknown): value is NarratorMood => NARRATOR_MOODS.includes(value as NarratorMood);
export const automaticNarratorMood = (matchId: string): NarratorMood => NARRATOR_MOODS[stableHash(`host-mood:${matchId}`) % NARRATOR_MOODS.length]!;
export type NarratorContext = { name?: string; letter?: string };
type Pick = { event: string; scenario: NarratorScenario; index: number };
export type NarratorHistory = { picks: Pick[]; counts?: Partial<Record<NarratorScenario, number>> };

/** Plain text only; callback replacement prevents $& expansion and recursive placeholders. */
export function formatNarratorLine(template: string, context: NarratorContext) {
  const clean = (value: string | undefined, fallback: string) => Array.from((value ?? "").replace(/[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu, " ").replace(/\s+/g, " ").trim()).slice(0, 40).join("") || fallback;
  const values = { name: clean(context.name, "our mystery artist"), letter: clean(context.letter, "?") };
  return template.replace(/\{(name|letter)\}/g, (_, key: "name" | "letter") => values[key]);
}

/** A reproducible shuffled bag. Repeated snapshots never draw another card. */
export function createNarratorDeck(matchId: string, mood: NarratorMood, saved?: unknown) {
  const picks: Pick[] = [];
  const counts: Partial<Record<NarratorScenario, number>> = {};
  if (saved && typeof saved === "object" && "picks" in saved && Array.isArray(saved.picks)) {
    for (const p of saved.picks.slice(0, 400)) {
      if (p && typeof p === "object" && typeof p.event === "string" && p.event.length < 300 && NARRATOR_SCENARIOS.includes(p.scenario) && Number.isInteger(p.index) && p.index >= 0 && p.index < 10 && !picks.some(old => old.event === p.event)) picks.push({ event: p.event, scenario: p.scenario, index: p.index });
    }
    for (const scenario of NARRATOR_SCENARIOS) {
      const loaded = picks.filter(p => p.scenario === scenario).length;
      const value = "counts" in saved && saved.counts && typeof saved.counts === "object" ? (saved.counts as Record<string, unknown>)[scenario] : undefined;
      counts[scenario] = typeof value === "number" && Number.isSafeInteger(value) && value >= loaded && value < 1_000_000 ? value : loaded;
    }
  }
  return {
    pick(scenario: NarratorScenario, event: string, context: NarratorContext) {
      let p = picks.find(item => item.event === event);
      if (!p) {
        const used = counts[scenario] ?? 0;
        const order = deterministicShuffle(Array.from({ length: 10 }, (_, i) => i), `${matchId}:${mood}:${scenario}`);
        p = { event, scenario, index: order[used % 10]! }; picks.push(p);
        counts[scenario] = used + 1;
        if (picks.length > 400) picks.splice(0, 10);
      }
      return formatNarratorLine(NARRATOR_LINES[mood][p.scenario][p.index]!, context);
    },
    history: (): NarratorHistory => ({ picks: picks.map(p => ({ ...p })), counts: { ...counts } }),
  };
}

export interface NarratorCue {
  key: string;
  text: string;
  facts: string;
  scenario: NarratorScenario;
  context: NarratorContext;
  priority: number;
  budgetMs?: number;
}

export function makeNarratorCue(key: string, scenario: NarratorScenario, facts: string, context: NarratorContext, matchId: string, priority = 50): NarratorCue {
  const line = createNarratorDeck(matchId, automaticNarratorMood(matchId)).pick(scenario, key, context);
  return { key, scenario, facts, context, priority, text: `${facts} ${line}`.trim() };
}

export type NarratorSelection = NarratorMood | "auto";
export interface NarratorSave {
  matchId: string; selection: NarratorSelection; heard: string[];
  histories: Partial<Record<NarratorMood, NarratorHistory>>;
}

/** Presentation scheduler: no scores, phases, deadlines or identities are decided here. */
export function createNarratorDirector(matchId: string, saved?: unknown) {
  let selection: NarratorSelection = "auto";
  const heard = new Set<string>();
  const decks = new Map<NarratorMood, ReturnType<typeof createNarratorDeck>>();
  if (saved && typeof saved === "object" && "matchId" in saved && saved.matchId === matchId) {
    const value = saved as Partial<NarratorSave>;
    if (value.selection === "auto" || isNarratorMood(value.selection)) selection = value.selection;
    if (Array.isArray(value.heard)) for (const key of value.heard.slice(0, 600)) if (typeof key === "string" && key.length < 330) heard.add(key);
    for (const mood of NARRATOR_MOODS) decks.set(mood, createNarratorDeck(matchId, mood, value.histories?.[mood]));
  }
  let quietUntil = 0;
  const mood = () => selection === "auto" ? automaticNarratorMood(matchId) : selection;
  function present(cue: NarratorCue, remaining: number | null) {
    const currentMood = mood();
    let deck = decks.get(currentMood);
    if (!deck) { deck = createNarratorDeck(matchId, currentMood); decks.set(currentMood, deck); }
    const quip = deck.pick(cue.scenario, cue.key, cue.context);
    const full = `${cue.facts} ${quip}`.trim();
    // Never trade a required instruction for a joke in a short transition.
    const available = Math.min(remaining ?? Infinity, cue.budgetMs ?? Infinity);
    const budget = Math.max(0, (available / 1000 - 0.5) * 2.5);
    const text = full.split(/\s+/).length <= budget ? full : cue.facts || quip;
    return { key: `${currentMood}:${cue.key}`, text };
  }
  return {
    mood,
    selection: () => selection,
    setSelection(value: NarratorSelection) { selection = value; quietUntil = 0; },
    present,
    next(cues: NarratorCue[], now: number, remaining: number | null) {
      const candidates = cues.filter(c => !heard.has(`${mood()}:${c.key}`)).sort((a, b) => b.priority - a.priority);
      const cue = candidates[0];
      if (!cue || cue.priority < 80 && now < quietUntil) return null;
      const next = present(cue, remaining);
      // Suppress superseded instructions/timer windows instead of queuing stale speech.
      for (const c of candidates) if (c.priority <= cue.priority && (c.key === cue.key || c.priority >= 80 || cue.priority >= 95)) heard.add(`${mood()}:${c.key}`);
      while (heard.size > 600) heard.delete(heard.values().next().value!);
      quietUntil = now + Math.max(8000, next.text.split(/\s+/).length * 400 + 1500);
      return next;
    },
    save: (): NarratorSave => ({ matchId, selection, heard: [...heard].slice(-600), histories: Object.fromEntries([...decks].map(([m, d]) => [m, d.history()])) }),
  };
}
