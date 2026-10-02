export type SourceStatus = 'awaiting-import' | 'imported';
export type Readiness = 'not-integrated' | 'in-progress' | 'verified';
export interface GameManifest {
  id: string; title: string; aliases: string[]; tags: string[]; description: string;
  players: { min: number; max: number }; version: string;
  source: { status: SourceStatus; paths: string[]; provenance: string; url: string | null };
  lifecycle: 'intake' | 'experimental' | 'verified' | 'archived';
  multiplayer: { status: Readiness; evidence: string[] };
}
export interface GameCatalog { version: number; revision?: string; generatedFrom: string; games: GameManifest[] }
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_PATH = /^(?:source|assets|tests|integration)\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const asRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function validateManifest(value: unknown, gameDirectory: string): string[] {
  const errors: string[] = [];
  if (!asRecord(value)) return ['manifest must be an object'];
  const m = value as unknown as Partial<GameManifest>;
  const source = asRecord(m.source) ? m.source : undefined;
  const sourcePaths = source && Array.isArray(source.paths) ? source.paths : [];
  const multiplayer = asRecord(m.multiplayer) ? m.multiplayer : undefined;
  const evidence = multiplayer && Array.isArray(multiplayer.evidence) ? multiplayer.evidence : [];
  if (typeof m.id !== 'string' || !ID.test(m.id)) errors.push('id must be a safe lowercase hyphenated identifier');
  if (gameDirectory !== `games/${String(m.id)}`) errors.push('id must match its games/<id> directory');
  if (typeof m.title !== 'string' || !m.title.trim()) errors.push('title is required');
  if (!Array.isArray(m.aliases) || m.aliases.some(x => typeof x !== 'string')) errors.push('aliases must be strings');
  if (!Array.isArray(m.tags) || m.tags.some(x => typeof x !== 'string')) errors.push('tags must be strings');
  if (typeof m.description !== 'string' || !m.description.trim()) errors.push('description is required');
  if (!asRecord(m.players) || !Number.isInteger(m.players.min) || !Number.isInteger(m.players.max) || Number(m.players.min) < 1 || Number(m.players.max) < Number(m.players.min) || Number(m.players.max) > 10) errors.push('players must be integer limits from 1 to 10 with min <= max');
  if (typeof m.version !== 'string' || !SEMVER.test(m.version)) errors.push('version must be semantic version');
  if (!asRecord(m.source) || !['awaiting-import', 'imported'].includes(String(m.source.status)) || !Array.isArray(m.source.paths) || m.source.paths.some(p => typeof p !== 'string' || !SAFE_PATH.test(p) || p.split('/').some(part => part === '.' || part === '..'))) errors.push('source status and relative source paths are invalid');
  if (asRecord(m.source) && typeof m.source.provenance !== 'string') errors.push('source provenance is required');
  if (asRecord(m.source) && m.source.url !== null && typeof m.source.url !== 'string') errors.push('source url must be a URL or null');
  if (!['intake', 'experimental', 'verified', 'archived'].includes(String(m.lifecycle))) errors.push('lifecycle is invalid');
  if (!asRecord(m.multiplayer) || !['not-integrated', 'in-progress', 'verified'].includes(String(m.multiplayer.status)) || !Array.isArray(m.multiplayer.evidence) || m.multiplayer.evidence.some(x => typeof x !== 'string')) errors.push('multiplayer status and evidence are invalid');
  if (multiplayer?.status === 'verified' && (source?.status !== 'imported' || sourcePaths.length === 0 || evidence.length === 0)) errors.push('ready multiplayer requires imported source paths and explicit integration evidence');
  if (m.lifecycle === 'verified' && (source?.status !== 'imported' || sourcePaths.length === 0)) errors.push('verified lifecycle requires imported source paths');
  if (source?.status === 'awaiting-import' && sourcePaths.length > 0) errors.push('awaiting-import games cannot claim imported source paths');
  if (source?.status === 'imported' && sourcePaths.length === 0) errors.push('imported games require at least one source path');
  if (source?.status === 'imported' && !sourcePaths.some(p => typeof p === 'string' && /^source\/.+\.(?:html?|mjs?|ts)$/i.test(p))) errors.push('imported games require a source game entry file (.html, .htm, .js, .mjs, or .ts)');
  if (source && typeof source.url === 'string') { try { const u = new URL(source.url); if (!['https:', 'http:'].includes(u.protocol)) errors.push('source url must use http or https'); } catch { errors.push('source url is invalid'); } }
  if (Array.isArray(multiplayer?.evidence) && evidence.some(p => typeof p !== 'string' || !SAFE_PATH.test(p) || p.split('/').some(part => part === '.' || part === '..'))) errors.push('multiplayer evidence must use safe relative test/integration paths');
  if (multiplayer?.status === 'verified' && evidence.some(p => typeof p !== 'string' || !/^(?:integration|tests)\/.+\.json$/i.test(p))) errors.push('verified multiplayer evidence must reference JSON verification records under integration/ or tests/');
  return errors;
}

export function buildCatalog(entries: GameManifest[]): GameCatalog {
  const games = entries.map(entry => structuredClone(entry)).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return { version: 1, generatedFrom: 'games/*/manifest.json', games };
}
export function validateCatalog(value: unknown): string[] {
  if (!asRecord(value) || !Array.isArray(value.games)) return ['catalog must contain a games array'];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of value.games) {
    const id = asRecord(item) ? item.id : undefined;
    if (typeof id !== 'string') { errors.push('catalog game is missing id'); continue; }
    if (seen.has(id)) errors.push(`duplicate game id: ${id}`);
    seen.add(id);
    errors.push(...validateManifest(item, `games/${id}`).map(x => `${id}: ${x}`));
  }
  return errors;
}
export function normalizeSearch(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function createIntakePlan(id: string, root: string): { target: string } {
  if (!ID.test(id) || id === '_template') throw new Error('unsafe game id');
  if (root !== 'games') throw new Error('unsafe intake root');
  return { target: `${root}/${id}` };
}
