import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, buildCatalog, normalizeSearch, validateCatalog, createIntakePlan } from '../src/catalog.ts';

const good = {
  id: 'sample-game', title: 'Sample Game', aliases: ['The Sample'], tags: ['cards'],
  description: 'A sample', players: { min: 2, max: 6 }, version: '0.1.0',
  source: { status: 'imported', paths: ['source/index.html'], provenance: 'Local project source', url: null },
  lifecycle: 'experimental', multiplayer: { status: 'not-integrated', evidence: [] },
};

test('accepts a complete manifest and rejects unsafe IDs and source paths', () => {
  assert.deepEqual(validateManifest(good, 'games/sample-game'), []);
  assert.ok(validateManifest({ ...good, id: '../escape' }, 'games/sample-game').some(x => x.includes('id')));
  assert.ok(validateManifest({ ...good, source: { ...good.source, paths: ['../../secret'] } }, 'games/sample-game').some(x => x.includes('path')));
});

test('blocks ready claims until source and integration evidence exist', () => {
  const ready = { ...good, source: { ...good.source, status: 'imported', paths: [] }, multiplayer: { status: 'verified', evidence: [] } };
  assert.ok(validateManifest(ready, 'games/sample-game').some(x => x.includes('ready')));
});

test('reports malformed nested source and evidence fields without throwing', () => {
  const malformed = { ...good, source: { status: 'imported', provenance: 'attached', url: null }, multiplayer: { status: 'verified' } };
  assert.doesNotThrow(() => validateManifest(malformed, 'games/sample-game'));
  const errors = validateManifest(malformed, 'games/sample-game');
  assert.ok(errors.some(x => x.includes('source status and relative source paths')));
  assert.ok(errors.some(x => x.includes('multiplayer status and evidence')));
});

test('builds a stable catalog and normalizes punctuation for search', () => {
  const entries = [good, { ...good, id: 'alpha-game', title: 'Alpha', aliases: [], tags: [] }];
  assert.deepEqual(buildCatalog(entries).games.map(x => x.id), ['alpha-game', 'sample-game']);
  assert.equal(normalizeSearch("THE SAMPLE — cards!"), 'the sample cards');
  assert.deepEqual(validateCatalog(buildCatalog(entries)), []);
});

test('rejects duplicate IDs and unsafe intake destination before writing', () => {
  assert.ok(validateCatalog(buildCatalog([good, good])).some(x => x.includes('duplicate')));
  assert.throws(() => createIntakePlan('../escape', 'games'), /unsafe/i);
  assert.equal(createIntakePlan('new-game', 'games').target, 'games/new-game');
});
