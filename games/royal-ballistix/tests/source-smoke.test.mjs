import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../source/index.html', import.meta.url), 'utf8');

test('Royal Ballistix v0.12 source is self-contained and parseable', () => {
  assert.match(html, /Royal Ballistix — Beach Siege/);
  assert.match(html, /version:"0\.12-adjustable-large-arena"/);
  assert.equal((html.match(/<script[^>]+src=/gi) || []).length, 0);
  assert.equal((html.match(/<link[^>]+href=/gi) || []).length, 0);
  assert.equal((html.match(/\bfetch\s*\(/g) || []).length, 0);
  const start = html.indexOf('<script>') + '<script>'.length;
  const end = html.lastIndexOf('</script>');
  assert.ok(start > '<script>'.length - 1 && end > start, 'inline script must exist');
  assert.doesNotThrow(() => new Function(html.slice(start, end)));
});

test('declares 2–10 contestants and preserved simulation/integration hooks', () => {
  assert.match(html, /players:\{min:2,max:10/);
  assert.match(html, /10 Players — MAX/);
  assert.match(html, /fixedDt:1\/120/);
  assert.match(html, /window\.RoyalBallistix=\{maxPlayers:10/);
  assert.match(html, /setPlayerCount:setPlayerCount/);
  assert.match(html, /setArenaSize:setArenaSize/);
  assert.match(html, /setPlayerInput:function/);
  assert.match(html, /releasePlayer:function/);
  assert.match(html, /getState:publicState/);
  assert.match(html, /window\.GameDebug=\{getState:publicState\}/);
});
