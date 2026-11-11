import assert from "node:assert/strict";
import test from "node:test";
import { SKETCH_PROMPT_CATALOGUE } from "../lib/content/sketch-prompts";
import { loadPromptWeights } from "../server/sorcery/prompt-learning";
import type { D1Database } from "@cloudflare/workers-types";

const [favorite, alternative, third] = SKETCH_PROMPT_CATALOGUE.slice(0, 3).map(prompt => prompt.id);
function database(rows: Array<Record<string, unknown>>): D1Database {
  const db = { prepare() { return { bind() { return this; }, async all<T>() { return { results: rows as T[] }; } }; } };
  return db as unknown as D1Database;
}
function ballot(index: number, room: number, options = [favorite!, alternative!, third!], choice: string | null = favorite!, hostHash: string | null = null) {
  return { room_id: `room-${room}`, match_id: `match-${index}`, profile_hash: index.toString(16).padStart(64, "0"), host_hash: hostHash, options_json: JSON.stringify(options), choice_id: choice, accepted_at: 1_800_000_000_000 + index * 86_400_000 };
}

test("global weights stay uniform before both profile and room thresholds", async () => {
  const rows = Array.from({ length: 19 }, (_, index) => ballot(index, index % 5));
  const weights = await loadPromptWeights(database(rows), undefined, 1_805_000_000_000);
  assert.equal(weights[favorite!], 1);
  assert.equal(weights[alternative!], 1);
});

test("global weights activate after 20 profiles across five rooms and stay bounded", async () => {
  const rows = Array.from({ length: 20 }, (_, index) => ballot(index, index % 5));
  const weights = await loadPromptWeights(database(rows), undefined, 1_805_000_000_000);
  assert.ok(weights[favorite!]! > weights[alternative!]!);
  assert.ok(Object.values(weights).every(weight => weight >= 0.5 && weight <= 2));
});

test("host-only weights activate after three matches and profiles without global threshold", async () => {
  const host = "a".repeat(64), rows = Array.from({ length: 3 }, (_, index) => ballot(index, index, [favorite!, alternative!, third!], alternative!, host));
  const weights = await loadPromptWeights(database(rows), host, 1_805_000_000_000);
  assert.ok(weights[alternative!]! > weights[favorite!]!);
  assert.ok(Object.values(weights).every(weight => weight >= 0.5 && weight <= 2));
});
