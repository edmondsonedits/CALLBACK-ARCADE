import type { GameCatalog, GameManifest } from './catalog.ts';
export interface D1Statement { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }>; }
export interface D1Database { prepare(query: string): D1Statement; }
export interface AssetBinding { fetch(request: Request): Promise<Response>; }
export interface Env { DB?: D1Database; CATALOG?: GameCatalog; ASSETS?: AssetBinding; }
const json = (body: unknown, status = 200, cache = true) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache ? 'public, max-age=60' : 'no-store' } });
type DbState = { database: 'connected' | 'unavailable' | 'not-configured'; catalog: 'current' | 'stale' | 'unknown' };
function fingerprint(games: GameManifest[] = []): string {
  const text = JSON.stringify([...games].sort((a,b) => a.id.localeCompare(b.id, 'en')));
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) { hash ^= BigInt(text.charCodeAt(i)); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return hash.toString(16).padStart(16, '0');
}
async function databaseStatus(env: Env): Promise<DbState> {
  if (!env.DB) return { database: 'not-configured', catalog: 'unknown' };
  try { await env.DB.prepare('SELECT 1 AS ok').first(); }
  catch { return { database: 'unavailable', catalog: 'unknown' }; }
  try {
    const row = await env.DB.prepare('SELECT revision FROM catalog_meta WHERE id = 1').first<{ revision: string }>();
    if (!row?.revision) return { database: 'connected', catalog: 'stale' };
    return { database: 'connected', catalog: row.revision === (env.CATALOG?.revision ?? fingerprint(env.CATALOG?.games)) ? 'current' : 'stale' };
  } catch { return { database: 'connected', catalog: 'stale' }; }
}
export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/health' && request.method === 'GET') return json({ status: 'ok', ...await databaseStatus(env), catalogSource: 'checked-in-repository' }, 200, false);
  if (url.pathname === '/api/games' && request.method === 'GET') {
    const state = await databaseStatus(env);
    return json({ ...env.CATALOG, database: state.database, catalogSync: state.catalog });
  }
  const detail = url.pathname.match(/^\/api\/games\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (detail && request.method === 'GET') {
    const game = env.CATALOG?.games.find(item => item.id === detail[1]);
    return game ? json(game) : json({ error: 'game-not-found' }, 404);
  }
  if (!url.pathname.startsWith('/api/') && env.ASSETS) return env.ASSETS.fetch(request);
  return json({ error: 'not-found' }, 404);
}
