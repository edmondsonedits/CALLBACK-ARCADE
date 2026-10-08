const input = document.querySelector('#search');
const grid = document.querySelector('#games');
const count = document.querySelector('#count');
const empty = document.querySelector('#empty');
const error = document.querySelector('#error');
const normalize = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
let games = [];
function render() {
  const query = normalize(input.value);
  const visible = games.filter(game => normalize([game.id, game.title, ...game.aliases, ...game.tags, game.source.status, game.multiplayer.status].join(' ')).includes(query));
  grid.replaceChildren(...visible.map(game => {
    const card = document.createElement('article'); card.className = 'game-card';
    const status = document.createElement('p'); status.className = 'status'; status.textContent = game.source.status === 'awaiting-import' ? 'Source awaiting import' : 'Source imported';
    const title = document.createElement('h2'); title.textContent = game.title;
    const desc = document.createElement('p'); desc.className = 'description'; desc.textContent = game.description;
    const facts = document.createElement('p'); facts.className = 'facts'; facts.textContent = `${game.players.min}–${game.players.max} contestant slots · v${game.version} · Multiplayer ${game.multiplayer.status}`;
    const links = document.createElement('p'); links.className = 'links';
    const hasLocalBuild = location.hostname.endsWith('.github.io') || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (hasLocalBuild && game.source.paths.includes('source/index.html')) { const play = document.createElement('a'); play.href = `games/${encodeURIComponent(game.id)}/`; play.textContent = 'Play'; links.append(play); }
    const manifest = document.createElement('a'); manifest.href = `https://github.com/edmondsonedits/CALLBACK-ARCADE/blob/main/games/${encodeURIComponent(game.id)}/manifest.json`; manifest.textContent = 'Manifest';
    links.append(manifest);
    const readme = document.createElement('a'); readme.href = `https://github.com/edmondsonedits/CALLBACK-ARCADE/blob/main/games/${encodeURIComponent(game.id)}/README.md`; readme.textContent = 'Game guide'; links.append(readme);
    if (game.source.url) { const source = document.createElement('a'); source.href = game.source.url; source.target = '_blank'; source.rel = 'noreferrer'; source.textContent = 'Known source'; links.append(source); }
    else if (game.source.paths.length) { const source = document.createElement('a'); source.href = `https://github.com/edmondsonedits/CALLBACK-ARCADE/blob/main/games/${encodeURIComponent(game.id)}/${game.source.paths[0].split('/').map(encodeURIComponent).join('/')}`; source.textContent = 'Source'; links.append(source); }
    card.append(status, title, desc, facts, links); return card;
  }));
  count.textContent = `${visible.length} of ${games.length} games`;
  empty.hidden = visible.length > 0;
}
input.addEventListener('input', render);
try {
  let response = await fetch('/api/games');
  if (!response.ok) response = await fetch('catalog/games.json');
  if (!response.ok) throw new Error('catalog request failed');
  const payload = await response.json(); games = payload.games ?? payload; render();
}
catch { count.textContent = ''; error.hidden = false; }
