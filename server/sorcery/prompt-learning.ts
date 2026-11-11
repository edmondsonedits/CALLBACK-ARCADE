import { SKETCH_PROMPT_CATALOGUE } from "../../lib/content/sketch-prompts";

const DAY_MS = 86_400_000;
const LOOKBACK_MS = 90 * DAY_MS;
const MAX_ROWS = 50_000;
const MAX_PROFILE_DAY_COMPARISONS = 20;
const MAX_ROOM_COMPARISONS = 40;
const GLOBAL_MIN_PROFILES = 20;
const GLOBAL_MIN_ROOMS = 5;
const HOST_MIN_MATCHES = 3;
const HOST_MIN_PROFILES = 3;
const CATALOGUE_IDS = SKETCH_PROMPT_CATALOGUE.map(prompt => prompt.id);
const CATALOGUE_ID_SET = new Set(CATALOGUE_IDS);

type PreferenceRow = { room_id: string; match_id: string; profile_hash: string; host_hash: string | null; options_json: string; choice_id: string | null; accepted_at: number };
type LearningCounts = { exposures: Map<string, number>; choices: Map<string, number>; profiles: Set<string>; rooms: Set<string>; matches: Set<string> };
function emptyCounts(): LearningCounts { return { exposures: new Map(), choices: new Map(), profiles: new Set(), rooms: new Set(), matches: new Set() }; }
function utcDay(timestamp: number): number { return Math.floor(timestamp / DAY_MS); }
function bucketKey(profile: string, day: number): string { return `${profile}:${day}`; }
function parseOptions(serialized: string): string[] {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is string => typeof id === "string" && CATALOGUE_ID_SET.has(id)))];
  } catch { return []; }
}
function add(map: Map<string, number>, key: string, value = 1): void { map.set(key, (map.get(key) ?? 0) + value); }

function collect(rows: PreferenceRow[]): LearningCounts {
  const result = emptyCounts(), comparisonCount = new Map<string, number>(), roomCount = new Map<string, number>();
  const seenOptions = new Set<string>(), seenChoice = new Set<string>();
  for (const row of rows) {
    if (!row.profile_hash || !row.room_id || !row.match_id || !Number.isFinite(row.accepted_at)) continue;
    const day = utcDay(row.accepted_at), profileDay = bucketKey(row.profile_hash, day);
    if ((comparisonCount.get(profileDay) ?? 0) >= MAX_PROFILE_DAY_COMPARISONS || (roomCount.get(row.room_id) ?? 0) >= MAX_ROOM_COMPARISONS) continue;
    const options = parseOptions(row.options_json);
    if (!options.length) continue;
    const newOptions = options.filter(id => !seenOptions.has(`${profileDay}:${id}`));
    if (!newOptions.length) continue;
    comparisonCount.set(profileDay, (comparisonCount.get(profileDay) ?? 0) + 1);
    roomCount.set(row.room_id, (roomCount.get(row.room_id) ?? 0) + 1);
    result.profiles.add(row.profile_hash); result.rooms.add(row.room_id); result.matches.add(row.match_id);
    for (const id of newOptions) { seenOptions.add(`${profileDay}:${id}`); add(result.exposures, id); }
    if (row.choice_id && options.includes(row.choice_id)) {
      const choiceKey = `${profileDay}:${row.choice_id}`;
      if (!seenChoice.has(choiceKey)) { seenChoice.add(choiceKey); add(result.choices, row.choice_id); }
    }
  }
  return result;
}

function scores(counts: LearningCounts): Map<string, number> {
  const result = new Map<string, number>();
  for (const id of CATALOGUE_IDS) result.set(id, ((counts.choices.get(id) ?? 0) + 1) / ((counts.exposures.get(id) ?? 0) + 2));
  return result;
}
function average(values: Iterable<number>): number { const list = [...values]; return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 1; }
function uniformWeights(): Record<string, number> { return Object.fromEntries(CATALOGUE_IDS.map(id => [id, 1])); }

/** Returns conservative future-sampling weights. These values must never affect current-match winners or points. */
export async function loadPromptWeights(db: D1Database, hostHash?: string, now = Date.now()): Promise<Record<string, number>> {
  const rows = await db.prepare("SELECT room_id,match_id,profile_hash,host_hash,options_json,choice_id,accepted_at FROM sorcery_prompt_preferences WHERE accepted_at >= ? ORDER BY accepted_at DESC LIMIT ?")
    .bind(now - LOOKBACK_MS, MAX_ROWS).all<PreferenceRow>();
  const recent = rows.results ?? [], globalCounts = collect(recent);
  let output = uniformWeights();
  if (globalCounts.profiles.size >= GLOBAL_MIN_PROFILES && globalCounts.rooms.size >= GLOBAL_MIN_ROOMS) {
    const raw = scores(globalCounts), baseline = average(raw.values());
    output = Object.fromEntries(CATALOGUE_IDS.map(id => [id, Math.max(0.5, Math.min(2, 0.7 * ((raw.get(id) ?? baseline) / baseline) + 0.3))]));
  }
  if (!hostHash || !/^[a-f0-9]{64}$/u.test(hostHash)) return output;
  const hostRows = recent.filter(row => row.host_hash === hostHash);
  const hostCounts = collect(hostRows);
  if (hostCounts.matches.size < HOST_MIN_MATCHES || hostCounts.profiles.size < HOST_MIN_PROFILES) return output;
  const local = scores(hostCounts), localAverage = average(local.values());
  for (const id of CATALOGUE_IDS) {
    const localFactor = Math.max(1 / 1.5, Math.min(1.5, 0.7 * ((local.get(id) ?? localAverage) / localAverage) + 0.3));
    output[id] = Math.max(0.5, Math.min(2, output[id]! * localFactor));
  }
  return output;
}
