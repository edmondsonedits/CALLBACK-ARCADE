import base64, gzip, hashlib, json
from pathlib import Path

root = Path('games/blind-crown')
parts = sorted(Path('.nightfall-transfer').glob('part-*.b64'))
assert len(parts) == 4, 'Incomplete Nightfall transfer'
data = json.loads(gzip.decompress(base64.b64decode(''.join(p.read_text() for p in parts), validate=True)))
entry = root / 'source/index.html'
original = entry.read_bytes()
assert hashlib.sha256(original).hexdigest() == data['base'] == '496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462', 'Baseline changed; stop rather than overwrite newer source'
lines = original.decode('utf-8').splitlines(keepends=True)
for start, end, replacement in reversed(data['ops']):
    assert 0 <= start <= end <= len(lines)
    lines[start:end] = [replacement]
updated = ''.join(lines).encode('utf-8')
assert hashlib.sha256(updated).hexdigest() == data['result'] == '06a0238b9827cd6f4395ec33cd0b2c8c7ce758bc15135a946ed7c737e53ef0e4', 'Nightfall source mismatch'
archive = root / 'source/original/blind-crown-v1.4.html'
archive.parent.mkdir(parents=True, exist_ok=True)
assert not archive.exists(), 'Refuse to overwrite original archive'
archive.write_bytes(original)
entry.write_bytes(updated)
for relative, content in data['files'].items():
    target = (root / relative).resolve()
    assert target.is_relative_to(root.resolve()), 'Unsafe transfer path'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')

manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
assert manifest['version'] == '1.4.0'
manifest['title'] = 'Blind Crown — Nightfall'
manifest['version'] = '1.5.0'
manifest['description'] = 'Private-plan medieval archery for 2–10 contestant slots. Nightfall adds textured diorama arenas, armored knights, torchlight, matching portraits, responsive controls and timed volley effects while preserving Classic rules. One local human with bots; first/third-person default to Canvas 2.5D. Hosted phone multiplayer is not integrated.'
manifest['source']['paths'] = ['source/index.html', 'source/original/blind-crown-v1.4.html']
manifest['source']['provenance'] = 'Nightfall v1.5 presentation upgrade from the exact supplied Refined v1.4 game, preserved under source/original/. New original Canvas/SVG art and synthesized audio; no external art/font/music packs added. Current standalone SHA-256: ' + data['result'] + '. Experimental pinned Three.js remains opt-in and unverified. See assets/README.md.'
assert manifest['multiplayer']['status'] == 'not-integrated'
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')

test_path = root / 'tests/standalone.test.mjs'
test = test_path.read_text()
assert data['base'] in test and '159955' in test
test = test.replace(data['base'], data['result']).replace('159955', str(len(updated)))
test = test.replace('Imported HTML matches supplied v1.4 bytes exactly', 'Nightfall HTML matches the verified v1.5 bytes exactly')
test += '''\ntest('Original v1.4 remains recoverable and deterministic engine is unchanged', async () => {
  const original = await readFile(new URL('../source/original/blind-crown-v1.4.html', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), '496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462');
  const originalScripts = [...original.toString('utf8').matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)];
  const select = list => list.find(([, , code]) => code.includes('deterministic, authoritative match rules'))[2];
  assert.equal(select(scripts), select(originalScripts));
});\n'''
test_path.write_text(test)
status_path = Path('STATUS.md')
status = status_path.read_text()
lines = status.splitlines()
for i, line in enumerate(lines):
    if line.startswith('- **Blind Crown'):
        lines[i] = '- **Blind Crown — Nightfall v1.5.0** — original presentation upgrade; v1.4 archived. One local human with bots in 2–10 contestant slots. Textured diorama arenas, armored knights and responsive HUD; Canvas 2D/2.5D remains default. Polygonal 3D is experimental; hosted phone multiplayer is not integrated.'
        break
else:
    raise AssertionError('Missing known Blind Crown status entry')
status_path.write_text('\n'.join(lines) + '\n')
(root / 'tests/evidence').mkdir(exist_ok=True)
print('Restored exact Nightfall:', len(updated), 'bytes; SHA-256:', data['result'])
