export interface NativeSyncEntry { ticket: string; nonce: string; version: number }
export interface NativeProjection { nonce: string; snapshot: unknown | null; version: number; revoked?: boolean; retry?: boolean }

/** One room transaction per batch; authorization and private projections stay per actor. */
export async function projectNativeBatch<C, A>(entries: NativeSyncEntry[], operations: {
  load: () => Promise<C>;
  authenticate: (entry: NativeSyncEntry, context: C) => Promise<A>;
  advance: (context: C, auth: A) => Promise<C>;
  project: (entry: NativeSyncEntry, context: C, auth: A) => Promise<NativeProjection>;
}): Promise<NativeProjection[]> {
  if (!entries.length) return [];
  let context = await operations.load();
  const actors = await Promise.all(entries.map(async entry => {
    try { return { entry, auth: await operations.authenticate(entry, context) }; }
    catch { return { entry, auth: null }; }
  }));
  const first = actors.find(actor => actor.auth !== null);
  if (first?.auth !== undefined && first.auth !== null) context = await operations.advance(context, first.auth);
  return Promise.all(actors.map(async ({ entry, auth }) => {
    if (auth === null) return { nonce: entry.nonce, snapshot: null, version: 0, revoked: true };
    try { return await operations.project(entry, context, auth); }
    catch { return { nonce: entry.nonce, snapshot: null, version: entry.version, retry: true }; }
  }));
}
