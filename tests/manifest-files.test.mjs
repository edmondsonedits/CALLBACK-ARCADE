import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateManifestFiles } from '../scripts/manifest-files.ts';
const base = { id: 'game', title: 'Game', aliases: [], tags: [], description: 'Game', players: { min: 1, max: 2 }, version: '0.1.0', source: { status: 'imported', paths: ['source/index.html'], provenance: 'attached', url: null }, lifecycle: 'experimental', multiplayer: { status: 'in-progress', evidence: ['integration/contract.md'] } };
test('readiness references must resolve to files inside the game folder', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arcade-files-'));
  const gameDir = path.join(root, 'games/game');
  try {
    await mkdir(path.join(gameDir, 'source'), { recursive: true });
    await mkdir(path.join(gameDir, 'integration'), { recursive: true });
    await writeFile(path.join(gameDir, 'source/index.html'), '<!doctype html>');
    await writeFile(path.join(gameDir, 'integration/contract.md'), 'Evidence');
    assert.deepEqual(await validateManifestFiles(root, 'games/game', base), []);
    const missing = { ...base, multiplayer: { ...base.multiplayer, evidence: ['integration/no-proof.md'] } };
    assert.ok((await validateManifestFiles(root, 'games/game', missing)).some(x => x.includes('missing source/evidence file')));
    const escape = { ...base, source: { ...base.source, paths: ['source/../../outside'] } };
    assert.ok((await validateManifestFiles(root, 'games/game', escape)).some(x => x.includes('unsafe source/evidence path')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('rejects README-only imports, accepts a hash-bound passed verification record, and catches source drift', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arcade-attest-'));
  const gameDir = path.join(root, 'games/game');
  const sourceDir = path.join(gameDir, 'source');
  const integrationDir = path.join(gameDir, 'integration');
  try {
    await mkdir(sourceDir, { recursive: true });
    await mkdir(integrationDir, { recursive: true });
    await writeFile(path.join(sourceDir, 'README.md'), 'source intake instructions');
    const docOnly = { ...base, source: { ...base.source, paths: ['source/README.md'] }, lifecycle: 'verified', multiplayer: { status: 'verified', evidence: ['integration/verification.json'] } };
    await writeFile(path.join(integrationDir, 'verification.json'), JSON.stringify({ schemaVersion: 1, kind: 'arcade-multiplayer-verification', result: 'passed', scope: 'automated-checks', checks: [{ name: 'integration', result: 'passed' }], sourceHashes: [{ path: 'source/README.md', sha256: createHash('sha256').update('source intake instructions').digest('hex') }] }));
    const documentErrors = await validateManifestFiles(root, 'games/game', docOnly);
    assert.ok(documentErrors.some(x => x.includes('game entry file')));
    await writeFile(path.join(sourceDir, 'game.html'), '<!doctype html><script>startGame()</script>');
    const sourcePath = 'source/game.html';
    const sourceBytes = await readFile(path.join(gameDir, sourcePath));
    const verified = { ...docOnly, source: { ...base.source, paths: [sourcePath] }, multiplayer: { status: 'verified', evidence: ['integration/verification.json'] } };
    const record = { schemaVersion: 1, kind: 'arcade-multiplayer-verification', result: 'passed', scope: 'automated-checks', checks: [{ name: 'input validation', result: 'passed' }, { name: 'reconnect', result: 'passed' }], sourceHashes: [{ path: sourcePath, sha256: createHash('sha256').update(sourceBytes).digest('hex') }] };
    await writeFile(path.join(integrationDir, 'verification.json'), JSON.stringify(record));
    assert.deepEqual(await validateManifestFiles(root, 'games/game', verified), []);
    await writeFile(path.join(gameDir, sourcePath), '<!doctype html><script>changed()</script>');
    const driftErrors = await validateManifestFiles(root, 'games/game', verified);
    assert.ok(driftErrors.some(x => x.includes('hash mismatch')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
