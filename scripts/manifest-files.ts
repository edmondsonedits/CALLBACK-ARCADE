import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { GameManifest } from '../src/catalog.ts';

const ENTRY = /^source\/.+\.(?:html?|mjs?|ts)$/i;
const RECORD = /^(?:integration|tests)\/.+\.json$/i;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

async function readGameFile(root: string, realDirectory: string, gameDirectory: string, rel: string, errors: string[]): Promise<Buffer | undefined> {
  if (rel.split('/').some(part => !part || part === '.' || part === '..') || rel.includes('\\')) {
    errors.push(`unsafe source/evidence path: ${rel}`);
    return undefined;
  }
  const directory = path.resolve(root, gameDirectory);
  const resolved = path.resolve(directory, rel);
  if (!resolved.startsWith(directory + path.sep)) {
    errors.push(`unsafe source/evidence path: ${rel}`);
    return undefined;
  }
  try {
    const actual = await realpath(resolved);
    if (!actual.startsWith(realDirectory + path.sep) || !(await stat(actual)).isFile()) {
      errors.push(`source/evidence path is not a repository file: ${rel}`);
      return undefined;
    }
    return await readFile(actual);
  } catch {
    errors.push(`missing source/evidence file: ${rel}`);
    return undefined;
  }
}

function validVerificationRecord(record: unknown): record is {
  schemaVersion: 1; kind: 'arcade-multiplayer-verification'; result: 'passed'; scope: 'automated-checks';
  checks: Array<{ name: string; result: 'passed' }>; sourceHashes: Array<{ path: string; sha256: string }>;
} {
  if (!isObject(record) || record.schemaVersion !== 1 || record.kind !== 'arcade-multiplayer-verification' || record.result !== 'passed' || record.scope !== 'automated-checks') return false;
  if (!Array.isArray(record.checks) || record.checks.length === 0 || record.checks.some(check => !isObject(check) || typeof check.name !== 'string' || !check.name.trim() || check.result !== 'passed')) return false;
  if (!Array.isArray(record.sourceHashes) || record.sourceHashes.some(item => !isObject(item) || typeof item.path !== 'string' || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256))) return false;
  return true;
}

async function validateAttestation(root: string, gameDirectory: string, realDirectory: string, evidencePath: string, sourcePaths: string[], errors: string[]): Promise<void> {
  if (!RECORD.test(evidencePath)) {
    errors.push(`verified multiplayer evidence must be a JSON record under integration/ or tests/: ${evidencePath}`);
    return;
  }
  const bytes = await readGameFile(root, realDirectory, gameDirectory, evidencePath, errors);
  if (!bytes) return;
  if (bytes.byteLength > 1024 * 1024) { errors.push(`verification record is too large: ${evidencePath}`); return; }
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch { errors.push(`verification record is not valid JSON: ${evidencePath}`); return; }
  if (!validVerificationRecord(parsed)) { errors.push(`verification record has an invalid schema or non-passing checks: ${evidencePath}`); return; }
  const actual = parsed.sourceHashes;
  const expectedPaths = [...new Set(sourcePaths)].sort();
  const actualPaths = actual.map(hash => hash.path).sort();
  if (actual.length !== expectedPaths.length || new Set(actualPaths).size !== actualPaths.length || actualPaths.some((p, i) => p !== expectedPaths[i])) {
    errors.push(`verification record must hash every declared source file exactly once: ${evidencePath}`);
    return;
  }
  for (const item of actual) {
    const source = await readGameFile(root, realDirectory, gameDirectory, item.path, errors);
    if (source && createHash('sha256').update(source).digest('hex') !== item.sha256) errors.push(`verification source hash mismatch for ${item.path}`);
  }
}

export async function validateManifestFiles(root: string, gameDirectory: string, manifest: GameManifest): Promise<string[]> {
  const errors: string[] = [];
  const directory = path.resolve(root, gameDirectory);
  let realDirectory: string;
  try { realDirectory = await realpath(directory); } catch { return [`missing game directory: ${gameDirectory}`]; }
  const sourcePaths = Array.isArray(manifest.source?.paths) ? manifest.source.paths : [];
  const evidencePaths = Array.isArray(manifest.multiplayer?.evidence) ? manifest.multiplayer.evidence : [];
  for (const rel of [...sourcePaths, ...evidencePaths]) if (typeof rel === 'string') await readGameFile(root, realDirectory, gameDirectory, rel, errors);
  if (manifest.source?.status === 'imported' && !sourcePaths.some(rel => typeof rel === 'string' && ENTRY.test(rel))) errors.push('imported source is missing an actual game entry file under source/');
  if (manifest.multiplayer?.status === 'verified') {
    for (const evidencePath of evidencePaths) {
      if (typeof evidencePath === 'string') await validateAttestation(root, gameDirectory, realDirectory, evidencePath, sourcePaths.filter((p): p is string => typeof p === 'string'), errors);
    }
  }
  return errors;
}
