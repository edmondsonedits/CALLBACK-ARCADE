import { createHash } from 'node:crypto';
import type { GameManifest } from '../src/catalog.ts';
export function revisionOf(entries: GameManifest[]): string {
  return createHash('sha256').update(JSON.stringify([...entries].sort((a,b) => a.id.localeCompare(b.id, 'en')))).digest('hex');
}
