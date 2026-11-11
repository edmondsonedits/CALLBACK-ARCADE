import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const root = new URL('../../public/arcade-games/', import.meta.url);
function load(file) {
  const path = new URL(`phone/${file}`, root);
  assert.ok(existsSync(path), `${file} shared runtime exists`);
  const context = createContext({ console, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, performance, Date, location: { origin: 'https://arcade.test', search: '', href: 'https://arcade.test/arcade-games/phone/controller.html' }, document: { readyState: 'loading', currentScript: { dataset: { game: 'royal-sumo' } }, addEventListener() {} }, addEventListener() {}, navigator: {} });
  context.window = context;
  runInContext(readFileSync(path, 'utf8'), context);
  return context;
}
const plain = value => JSON.parse(JSON.stringify(value));
const snapshot = (overrides = {}) => ({ code: 'ABCD', game: 'royal-sumo', seat: 0, name: '<Alice>', lastSeq: 0, hostAlive: true, status: { phase: 'fight', paused: false, active: true, text: 'Playing' }, privateState: { alive: true }, ...overrides });
function phone(options = {}) {
  const c = load('controller.js'); const sent = [];
  const session = new c.CallbackPhoneController.Session({ code: 'ABCD', request: async (action, body) => { sent.push({ action, body: plain(body) }); return action === 'input' ? { accepted: true, seq: body.seq } : snapshot(); }, ...options });
  session.receive(snapshot()); return { c, session, sent };
}
function host(options = {}) {
  const c = load('host.js'); const calls = []; let state = { phase: 'fight', paused: false, active: true };
  const adapter = Object.fromEntries(['assign', 'release', 'clear', 'input', 'start', 'pause', 'resume', 'stop'].map(key => [key, (...args) => { calls.push([key, ...plain(args)]); if (key === 'pause') state.paused = true; if (key === 'resume') state.paused = false; return true; }]));
  adapter.status = () => state; adapter.phoneState = seat => ({ seat, alive: true });
  const room = new c.CallbackPhoneHost.Room({ code: 'ABCD', adapter, request: async action => action === 'start' ? { activeSeatIds: Array.from({ length: 10 }, (_, seat) => seat), botEnabled: Object.fromEntries(Array.from({ length: 10 }, (_, seat) => [seat, true])), version: 2 } : { roster: [], inputs: [], serverNow: 1000 }, ...options });
  room.started = true; return { c, room, adapter, calls, state };
}

test('phone queue preserves short press/release and later edges during an in-flight send', async () => {
  let finish; const sends = [];
  const { session } = phone({ request: async (action, body) => { if (action === 'poll') return snapshot(); sends.push(plain(body)); if (sends.length === 1) await new Promise(resolve => { finish = resolve; }); return { accepted: true }; } });
  session.button(1, true, 'finger1'); const flight = session.flush();
  session.button(1, false, 'finger1'); session.button(2, true, 'finger2'); session.axes(.8, -.6); session.axes(.9, -.5);
  const blocked = session.flush(); await blocked; assert.equal(sends.length, 1, 'one input request in flight');
  finish(); await flight;
  while (session.queue.length) await session.flush();
  assert.deepEqual(sends.slice(0, 3).map(p => p.buttons), [1, 0, 2]);
  assert.deepEqual(sends.map(p => p.seq), [1, 2, 3, 4]);
  assert.ok(Math.abs(sends[3].x / sends[3].y - .9 / -.5) < 1e-9); assert.ok(Math.abs(Math.hypot(sends[3].x, sends[3].y) - 1) < 1e-9);
});

test('accepted-but-lost response reconciles lastSeq and retains later queued release', async () => {
  const sends = []; let lost = true;
  const { session } = phone({ request: async (action, body) => { if (action === 'poll') return snapshot({ lastSeq: 1 }); sends.push(plain(body)); if (lost) { lost = false; throw new Error('Lost response'); } return { accepted: true }; } });
  session.button(1, true, 'finger'); session.button(1, false, 'finger'); await session.flush(); await session.flush();
  assert.deepEqual(sends.map(p => [p.seq, p.buttons]), [[1, 1], [2, 0]]);
  assert.equal(session.queue.length, 0);
});

test('phone restoration starts after own lastSeq, paused/lost-host/timeout/elimination disables input', () => {
  let now = 1000; const { session } = phone({ now: () => now });
  session.receive(snapshot({ lastSeq: 33 })); session.button(1, true, 'key'); assert.equal(session.queue[0].seq, 34);
  session.receive(snapshot({ status: { phase: 'fight', paused: true, active: true } })); assert.equal(session.enabled, false); assert.equal(session.queue.length, 0); assert.equal(session.buttons, 0);
  session.receive(snapshot({ hostAlive: false })); session.button(2, true, 'key'); assert.equal(session.queue.length, 0);
  session.receive(snapshot()); now += 8001; session.watchdog(); assert.equal(session.enabled, false);
  session.receive(snapshot({ privateState: { alive: false } })); assert.equal(session.enabled, false);
  session.receive(snapshot({ status: { phase: 'countdown', active: true, paused: false }, privateState: { alive: true } })); assert.equal(session.enabled, true);
});

test('multi-touch/key sources hold independent masks and blur neutralizes axes/buttons', () => {
  const { session } = phone(); session.button(1, true, 'finger'); session.button(1, true, 'key'); session.button(2, true, 'finger2'); session.button(1, false, 'finger'); assert.equal(session.buttons, 3);
  session.axes(1, 1); assert.ok(Math.hypot(session.x, session.y) <= 1.00001); session.neutral(); assert.equal(session.buttons, 0); assert.equal(session.x, 0); assert.equal(session.y, 0); assert.equal(session.queue.at(-1).buttons, 0);
});

test('host applies seat0 once, acknowledges only applied packets, and observes native pause without restart', async () => {
  const { room, calls, state, adapter } = host();
  const data = { serverNow: 1000, roster: [{ seat: 0, name: 'Zero', connected: true, stale: false, inputAgeMs: 0, lastSeq: 2 }], inputs: [{ seat: 0, receivedAt: 1000, packet: { seq: 1, x: 1, y: 0, buttons: 1 } }, { seat: 0, receivedAt: 1000, packet: { seq: 2, x: 0, y: 0, buttons: 0 } }] };
  room.receive(data); room.receive(data);
  assert.equal(calls.filter(c => c[0] === 'input').length, 2); assert.equal(calls.filter(c => c[0] === 'assign').length, 1); assert.equal(room.ack[0], 2);
  adapter.input = () => false; room.receive({ ...data, inputs: [{ seat: 0, receivedAt: 1000, packet: { seq: 3, x: 0, y: 0, buttons: 2 } }] }); assert.equal(room.ack[0], 2);
  state.paused = true; await room.poll(); assert.ok(calls.some(c => c[0] === 'clear' && c[1] === 0)); assert.equal(calls.filter(c => c[0] === 'start').length, 0); assert.equal(room.status().paused, true);
});

test('host watchdog clears after500ms without inventing seq, releases after3sec, and restores same seat', () => {
  let now = 1000; const { room, calls } = host({ now: () => now });
  const data = { serverNow: 1000, roster: [{ seat: 0, name: 'Zero', connected: true, stale: false, inputAgeMs: 0 }], inputs: [{ seat: 0, receivedAt: 1000, packet: { seq: 7, x: 1, y: 0, buttons: 1 } }] };
  room.receive(data); now = 1501; room.sweep(); assert.ok(calls.some(c => c[0] === 'clear' && c[1] === 0)); assert.equal(room.ack[0], 7);
  now = 4001; room.sweep(); assert.ok(calls.some(c => c[0] === 'release' && c[1] === 0));
  room.receive({ ...data, serverNow: 4001, inputs: [{ seat: 0, receivedAt: 4001, packet: { seq: 8, x: -1, y: 0, buttons: 0 } }] }); assert.equal(room.ack[0], 8); assert.equal(calls.filter(c => c[0] === 'assign').length, 2);
});

test('host posted status follows every adapter phase, sends only assigned own private state plus appliedSeq', async () => {
  let body; const { room, state } = host({ request: async (_action, value) => { body = plain(value); return { roster: [], inputs: [], serverNow: 1000 }; } });
  room.receive({ serverNow: 1000, roster: [{ seat: 9, name: 'Nine', connected: true, stale: true, occupancyId: '9'.repeat(64), inputAgeMs: null }], inputs: [] });
  state.phase = 'planning'; await room.poll(); assert.equal(body.status.phase, 'planning'); assert.deepEqual(Object.keys(body.privateStates), ['9']); assert.deepEqual(body.privateStates[9], { occupancyId: '9'.repeat(64), state: { seat: 9, alive: true, appliedSeq: 0 } });
});

test('Blind draft sends normalized Place/Aim/Lock and reconciles only acknowledged idle draft/newround', () => {
  const { session } = phone();
  const own = { alive: true, phase: 'planning', round: 1, appliedSeq: 0, plan: { x: .5, y: .5, a: 0, locked: false }, board: { width: 1000, height: 640 } };
  session.receive(snapshot({ game: 'blind-crown', privateState: own })); session.editing = true; session.place(.8, .7); session.aim(-Math.PI / 2); session.lock();
  const packet = session.queue.at(-1); assert.deepEqual(plain(packet.plan), { x: .8, y: .7, a: -Math.PI / 2, locked: true });
  session.receive(snapshot({ game: 'blind-crown', privateState: own })); assert.equal(session.plan.x, .8);
  session.editing = false; session.receive(snapshot({ game: 'blind-crown', privateState: { ...own, appliedSeq: packet.seq, plan: { x: .78, y: .68, a: -Math.PI / 2, locked: true } } })); assert.equal(session.plan.x, .78);
  session.receive(snapshot({ game: 'blind-crown', privateState: { ...own, round: 2 } })); assert.equal(session.plan.x, .5);
});

test('seven game-specific mappings include actual Recover and exact rune palette', () => {
  const c = load('controller.js'); const games = plain(c.CallbackPhoneController.games);
  assert.equal(Object.keys(games).length, 7);
  assert.deepEqual(games['royal-roller-ruckus'].buttons.map(b => [b.label, b.mask]), [['Recover', 1]]);
  assert.deepEqual(games['space-bash'].buttons.map(b => [b.label, b.mask]), [['Grab / Throw', 1], ['Kick', 2], ['Jump', 4]]);
  assert.deepEqual(games['royal-scratch-match'].buttons.map(b => [b.label, b.mask, b.color]), [['A', 1, '#ff5db1'], ['B', 2, '#ffd34f'], ['X', 4, '#42d8ff'], ['Y', 8, '#ff7b57']]);
  assert.deepEqual(games['royal-twisted'].buttons.map(b => b.label), ['Jump', 'Duck']);
});

test('all7 standalone worlds inject exactly one classic defer shared host with correct route', () => {
  for (const game of ['royal-sumo', 'royal-ballistix', 'royal-scratch-match', 'royal-roller-ruckus', 'royal-twisted', 'space-bash', 'blind-crown']) {
    const html = readFileSync(new URL(`${game}/index.html`, root), 'utf8');
    const tags = html.match(/<script[^>]+src=['"]\.\.\/phone\/host\.js['"][^>]*>/g) || [];
    assert.equal(tags.length, 1, game); assert.match(tags[0], /\bdefer\b/); assert.ok(tags[0].includes(`data-game="${game}"`)); assert.doesNotMatch(tags[0], /type=['"]module/);
  }
});

test('phone route loads only shared controller, scoped responsiveCSS preserves worlds', () => {
  const html = readFileSync(new URL('phone/controller.html', root), 'utf8'); const css = readFileSync(new URL('phone/phone.css', root), 'utf8');
  assert.match(html, /controller\.js/); assert.doesNotMatch(html, /simulation|three\.js|iframe/); assert.match(html, /viewport-fit=cover/);
  assert.match(css, /env\(safe-area-inset/); assert.match(css, /minmax\(0,\s*1fr\)/); assert.match(css, /prefers-reduced-motion/); assert.match(css, /orientation:\s*landscape/);
  // Every selector is widget scoped (font-face / media contents excluded).
  const selectors = [...css.matchAll(/(?:^|})\s*([^@{}][^{}]*)\{/g)].map(m => m[1].trim());
  for (const group of selectors.filter(group => !group.startsWith('@'))) for (const selector of group.split(',')) assert.match(selector.trim(), /^\.cp-(host|controller)/, selector);
});

import { dom } from './dom.mjs';
const ok = data => ({ ok: true, json: async () => data });

test('mounted phone releases keys after focus changes and resets independent thumb controls', async () => {
  const h = dom('controller.js', { search: '?code=ABCD', fetch: async url => ok(url.endsWith('/input') ? { accepted: true } : snapshot()) });
  const ui = h.context.CallbackPhoneController.mount(); await h.settle();
  await h.emit(h.document.body, 'keydown', { code: 'Space' });
  assert.equal(ui.session.buttons, 1);
  await h.emit(h.document.getElementById('cp-name'), 'keyup', { code: 'Space' });
  assert.equal(ui.session.buttons, 0, 'typing focus must not swallow a game key release');
  const stick = h.document.getElementById('cp-stick'), action = h.document.getElementById('cp-buttons').children[0];
  await h.emit(stick, 'pointerdown', { pointerId: 1, clientX: 140, clientY: 100 });
  await h.emit(action, 'pointerdown', { pointerId: 2 });
  await h.emit(action, 'pointerdown', { pointerId: 3 });
  await h.emit(action, 'pointerup', { pointerId: 2 });
  assert.equal(ui.session.buttons, 1); assert.ok(ui.session.x > 0);
  await h.emit(stick, 'pointerup', { pointerId: 1 });
  assert.equal(ui.session.buttons, 1); assert.equal(ui.session.x, 0);
  await h.emit(h.document.body, 'arcade:controls-reset');
  assert.equal(ui.session.buttons, 0); assert.equal(ui.session.x, 0);
  await h.emit(stick, 'pointermove', { pointerId: 1, clientX: 180, clientY: 100 });
  assert.equal(ui.session.x, 0, 'old fingers cannot resume a reset gesture');
});

test('host new room cannot accept input from a currently running offline game before explicit Start', async () => {
  const { room } = host(); room.started = false;
  assert.equal(room.status().active, false); assert.equal(room.status().paused, true);
});

test('restored TV returns a server-frozen featured roster to lobby before a rematch', async () => {
  const requests = [], calls = [], hostBodies = [];
  const state = { phase: 'menu', paused: false, active: false };
  const adapter = { status: () => state, phoneState: () => ({ oldMatchBoard: true }), assign() {}, release() {}, clear() {}, input() { return true; }, stop() {}, start(options) { calls.push(options); } };
  const request = async (action, body) => {
    requests.push([action, plain(body)]);
    if (action === 'host') {
      hostBodies.push(plain(body));
      if (hostBodies.length === 1) return { status: body.status, activeSeatIds: [0, 2], botEnabled: { 0: true, 1: false, 2: true }, version: 8, roster: [{ seat: 0, name: 'Phone', connected: true, stale: false, occupancyId: 'a'.repeat(64) }], inputs: [], serverNow: 1000 };
      return { status: body.status, activeSeatIds: null, botEnabled: { 0: true, 1: false, 2: true }, version: 9, roster: [{ seat: 0, name: 'Phone', connected: true, stale: false, occupancyId: 'a'.repeat(64) }], inputs: [], serverNow: 1000 };
    }
    if (action === 'lobby') return { activeSeatIds: null, botEnabled: { 0: true, 1: false, 2: true }, version: 9 };
    if (action === 'start') return { activeSeatIds: [0, 2], botEnabled: { 0: true, 1: false, 2: true }, version: 10 };
    throw new Error(`Unexpected action: ${action}`);
  };
  const c = load('host.js');
  const room = new c.CallbackPhoneHost.Room({ code: 'ABCD', adapter, request });

  await room.poll();
  assert.deepEqual(requests.map(([action]) => action), ['host', 'lobby']);
  assert.deepEqual(requests[1][1], { version: 8 });
  assert.equal(room.started, false);
  assert.equal(room.activeSeatIds, null);
  assert.equal(room.version, 9);
  await room.poll();
  assert.deepEqual(hostBodies[1].privateStates['0'], { occupancyId: 'a'.repeat(64), state: null }, 'lobby host polls must clear the old match board and applied sequence');

  assert.equal(await room.start(), true);
  assert.deepEqual(plain(calls), [{ activeSeatIds: [0, 2] }]);
  assert.equal(room.version, 10);
});

test('authoritative seat removal clears its ack so a replacement phone can restart input sequence at one', async () => {
  const hostBodies = [], applied = [];
  const state = { phase: 'fight', paused: false, active: true };
  let poll = 0;
  const adapter = { status: () => state, phoneState: () => null, assign() {}, release() {}, clear() {}, input(seat, packet) { applied.push([seat, packet.seq]); return true; }, stop() {} };
  const request = async (action, body) => {
    assert.equal(action, 'host');
    hostBodies.push(plain(body)); poll += 1;
    if (poll === 1) return { status: body.status, activeSeatIds: [0, 1], version: 3, roster: [{ seat: 0, name: 'First phone', connected: true, stale: false }], inputs: [{ seat: 0, packet: { seq: 50, x: 0, y: 0, buttons: 1 }, receivedAt: 1000 }], serverNow: 1000 };
    if (poll === 2) return { status: body.status, activeSeatIds: [0, 1], version: 4, roster: [], inputs: [], serverNow: 1000 };
    return { status: body.status, activeSeatIds: [0, 1], version: 5, roster: [{ seat: 0, name: 'Replacement', connected: true, stale: false }], inputs: [{ seat: 0, packet: { seq: 1, x: 1, y: 0, buttons: 1 }, receivedAt: 1000 }], serverNow: 1000 };
  };
  const c = load('host.js');
  const room = new c.CallbackPhoneHost.Room({ code: 'ABCD', adapter, request, now: () => 1000 });
  room.started = true; room.activeSeatIds = [0, 1];

  await room.poll();
  assert.equal(room.ack[0], 50);
  room.receive({ roster: [{ seat: 0, name: 'First phone', connected: false }], inputs: [] });
  assert.equal(room.ack[0], 50, 'a disconnected row can reconnect with its existing sequence');
  await room.poll();
  assert.equal(Object.hasOwn(room.ack, '0'), false, 'an absent authoritative roster row ends the prior phone session');
  await room.poll();

  assert.deepEqual(applied, [[0, 50], [0, 1]]);
  assert.equal(hostBodies[2].ack['0'], undefined, 'the replacement input is not acknowledged with the prior phone sequence');
  assert.equal(room.ack[0], 1);
});

test('same-seat replacement with the same name resets native ack and accepts its first packet', async () => {
  const hostBodies = [], applied = [], assigned = [], released = [];
  const state = { phase: 'fight', paused: false, active: true };
  let poll = 0;
  const adapter = { status: () => state, phoneState: () => null, assign(seat, name) { assigned.push([seat, name]); }, release(seat) { released.push(seat); }, clear() {}, input(seat, packet) { applied.push([seat, packet.seq]); return true; }, stop() {} };
  const request = async (action, body) => {
    assert.equal(action, 'host');
    hostBodies.push(plain(body)); poll += 1;
    const occupancyId = poll === 1 ? 'a'.repeat(64) : 'b'.repeat(64);
    const seq = poll === 1 ? 10 : 1;
    return { status: body.status, activeSeatIds: [0, 1], version: poll + 1, roster: [{ seat: 0, name: 'Same Name', connected: true, stale: false, occupancyId }], inputs: [{ seat: 0, packet: { seq, x: 1, y: 0, buttons: 1 }, receivedAt: 1000 }], serverNow: 1000 };
  };
  const c = load('host.js');
  const room = new c.CallbackPhoneHost.Room({ code: 'ABCD', adapter, request, now: () => 1000 });
  room.started = true; room.activeSeatIds = [0, 1];

  await room.poll();
  await room.poll();

  assert.deepEqual(applied, [[0, 10], [0, 1]]);
  assert.deepEqual(plain(hostBodies[1].ack), { 0: { seq: 10, occupancyId: 'a'.repeat(64) } });
  assert.deepEqual(assigned, [[0, 'Same Name'], [0, 'Same Name']]);
  assert.deepEqual(released, [0]);
  assert.equal(room.ack[0], 1);
});

test('legacy numeric ack response asks the TV to reload and does not deliver unbound input', async () => {
  const { room, calls } = host({ request: async () => ({ hostRefreshRequired: true, roster: [{ seat: 0, name: 'Replacement', connected: true, stale: false, occupancyId: 'd'.repeat(64) }], inputs: [{ seat: 0, packet: { seq: 1, x: 1, y: 0, buttons: 1 }, receivedAt: 1000 }], serverNow: 1000 }) });
  await room.poll();
  assert.equal(room.error, 'Reload this TV tab to safely reconnect phone players.');
  assert.equal(calls.some(call => call[0] === 'input'), false);
});

test('host defer waits for DOMContentLoaded adapter initialization even when document is interactive', () => {
  const h = dom('host.js'); h.document.readyState = 'interactive';
  // Re-execute in the same interactive boundary, before the game boot callback.
  runInContext(readFileSync(new URL('phone/host.js', root), 'utf8'), h.context);
  assert.equal(h.document.querySelector('.cp-host-launch'), null);
  const callbacks = h.events.get('doc:DOMContentLoaded') || [];
  assert.equal(callbacks.length, 2, 'each deferred script registers a post-parser mount');
});

test('mounted TV room shows safe roster, local QR, roomcode-only storage, Start/collapse and native modal isolation', async () => {
  const requests = [], calls = []; let active = false, botEnabled = true;
  const prefs = () => Object.fromEntries(Array.from({ length: 10 }, (_, seat) => [seat, seat === 1 ? botEnabled : true]));
  const h = dom('host.js', { fetch: async (url, options) => {
    requests.push([url, JSON.parse(options.body), options.credentials]);
    if (url.endsWith('/create')) return ok({ code: 'ABCD' });
    if (url.endsWith('/bot')) { botEnabled = !botEnabled; return ok({ botEnabled: prefs(), version: 2 }); }
    if (url.endsWith('/start')) return ok({ activeSeatIds: Array.from({ length: 10 }, (_, seat) => seat).filter(seat => seat !== 1 || botEnabled), botEnabled: prefs(), version: 3 });
    return ok({ version: botEnabled ? 1 : 2, botEnabled: prefs(), activeSeatIds: null, serverNow: 1000, roster: [{ seat: 0, name: '<img src=x>', connected: true, stale: true }], inputs: [] });
  } });
  h.context.CallbackPhoneGame = { status: () => ({ phase: active ? 'fight' : 'menu', active, paused: false }), assign: (...args) => calls.push(['assign', ...args]), clear() {}, release() {}, phoneState: () => null, input: () => true, start() { calls.push(['start']); active = true; }, pause() {}, resume() {}, stop() { calls.push(['stop']); } };
  const ui = h.context.CallbackPhoneHost.mount(); assert.ok(ui);
  let gameKeys = 0; h.context.addEventListener('keydown', () => gameKeys++);
  await h.emit(ui.launcher, 'click'); assert.equal(ui.dialog.open, true); assert.equal(h.document.activeElement.getAttribute('aria-label'), 'Close phone lobby');
  await h.emit(ui.dialog.querySelector('[data-action="create"]'), 'click');
  await ui.room.poll();
  await h.settle();
  assert.equal(ui.room.code, 'ABCD'); assert.deepEqual([...h.storage.values()], ['ABCD']);
  const roster = ui.dialog.querySelector('.cp-host-roster'); assert.match(roster.children[0].textContent, /<img src=x>/); assert.equal(roster.children[0].querySelector('img'), null); assert.equal(roster.children[0].children.length, 2);
  const humanSwitch = ui.dialog.querySelector('[aria-label="Bot 1"]'), botSwitch = ui.dialog.querySelector('[aria-label="Bot 2"]');
  assert.equal(humanSwitch.hidden, true, 'human seats hide the switch'); assert.equal(botSwitch.getAttribute('role'), 'switch'); assert.equal(botSwitch.getAttribute('aria-checked'), 'true');
  await h.emit(botSwitch, 'click'); assert.equal(botSwitch.getAttribute('aria-checked'), 'false'); assert.equal(botSwitch.children[1].textContent, 'Off');
  assert.equal(ui.dialog.querySelector('.cp-host-qr').src, 'data:image/png;base64,LOCAL');
  assert.equal(ui.dialog.querySelector('[data-action="start"]').disabled, false);
  await h.emit(ui.dialog.querySelector('[data-action="start"]'), 'click'); assert.equal(ui.dialog.open, false); assert.equal(calls.filter(c => c[0] === 'start').length, 1);
  await h.emit(ui.launcher, 'click'); await h.emit(ui.dialog.querySelector('[data-action="pause"]'), 'keydown', { key: 'Escape', code: 'Escape' }); assert.equal(gameKeys, 0); assert.equal(ui.dialog.open, false);
  const outside = h.document.createElement('button'); h.document.body.append(outside); await h.emit(outside, 'keydown', { key: 'ArrowUp', code: 'ArrowUp' }); assert.equal(gameKeys, 1, 'game events outside widgets remain untouched');
  await h.emit(ui.dialog.querySelector('[data-action="end"]'), 'click'); assert.equal(h.storage.size, 0); assert.ok(calls.some(c => c[0] === 'stop'));
  assert.ok(requests.every(r => r[2] === 'same-origin')); assert.ok(requests.every(r => !JSON.stringify(r).includes('token')));
});

test('mounted phone cookie-restores seat without join, emits ordered touch edges and neutralizes blur', async () => {
  const requests = []; const h = dom('controller.js', { search: '?code=abcd', fetch: async (url, options) => { const body = JSON.parse(options.body); requests.push([url, body]); return ok(url.endsWith('/input') ? { accepted: true } : snapshot({ lastSeq: 20 })); } });
  const ui = h.context.CallbackPhoneController.mount(); await h.settle();
  assert.equal(ui.session.snapshot.seat, 0); assert.equal(h.document.getElementById('cp-code').value, 'ABCD'); assert.equal(requests.some(r => r[0].endsWith('/join')), false);
  assert.equal(h.document.getElementById('cp-identity').children.length, 0); assert.match(h.document.getElementById('cp-identity').textContent, /<Alice>.*Seat 1/);
  const buttons = h.document.getElementById('cp-buttons').children;
  await h.emit(buttons[0], 'pointerdown', { pointerId: 2 }); await h.emit(buttons[1], 'pointerdown', { pointerId: 3 }); await h.emit(buttons[0], 'pointercancel', { pointerId: 2 }); await h.emit(h.document.body, 'blur');
  while (ui.session.queue.length) await ui.session.flush();
  assert.deepEqual(requests.filter(r => r[0].endsWith('/input')).map(r => [r[1].seq, r[1].buttons]), [[21, 1], [22, 3], [23, 2], [24, 0]]);
  await h.emit(h.document.getElementById('cp-change'), 'click'); assert.equal(ui.session, null); assert.equal(h.document.getElementById('cp-join').hidden, false); assert.equal(h.context.location.href.includes('?'), false);
});

test('mounted Blind phone touch Place/Aim/Lock sends actual normalized plan, draws only own board', async () => {
  const requests = [], own = { alive: true, phase: 'planning', round: 1, appliedSeq: 0, plan: { x: .5, y: .5, a: 0, locked: false }, board: { width: 1000, height: 640, geometry: { bounds: { minX: 60, maxX: 940, minY: 60, maxY: 580 }, walls: [{ x: 100, y: 200, w: 50, h: 40, open: false }] } }, players: [{ x: 999, y: 999, a: 1 }] };
  const h = dom('controller.js', { search: '?code=ABCD', fetch: async (url, options) => { requests.push([url, JSON.parse(options.body)]); return ok(url.endsWith('/input') ? { accepted: true } : snapshot({ game: 'blind-crown', privateState: own })); } });
  const ui = h.context.CallbackPhoneController.mount(); await h.settle(); const canvas = h.document.getElementById('cp-map');
  await h.emit(canvas, 'pointerdown', { pointerId: 4, clientX: 750, clientY: 320 }); await h.emit(canvas, 'pointerup', { pointerId: 4 });
  await h.emit(h.document.getElementById('cp-aim'), 'click'); await h.emit(canvas, 'pointerdown', { pointerId: 5, clientX: 750, clientY: 0 }); await h.emit(canvas, 'pointerup', { pointerId: 5 });
  await h.emit(h.document.getElementById('cp-lock'), 'click'); while (ui.session.queue.length) await ui.session.flush();
  const packets = requests.filter(r => r[0].endsWith('/input')).map(r => r[1]);
  assert.deepEqual(packets.at(-1).plan, { x: .75, y: .5, a: -Math.PI / 2, locked: true });
  assert.ok(canvas.draws.some(op => op[0] === 'arc' && op[1] === 750 && op[2] === 320)); assert.equal(canvas.draws.some(op => op[0] === 'arc' && op[1] === 999), false);
});

test('Roller radar renders own seat9 dot from track bounds and disables Recover while grounded', async () => {
  const own = { alive: true, falling: false, lap: 2, laps: 3, checkpoint: 4, radar: { bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, track: [[-10, -10], [10, -10], [10, 10]], own: [5, 0] } };
  const h = dom('controller.js', { search: '?code=ABCD', fetch: async () => ok(snapshot({ game: 'royal-roller-ruckus', seat: 9, privateState: own })) });
  const ui = h.context.CallbackPhoneController.mount(); await h.settle(); const canvas = h.document.getElementById('cp-map');
  assert.ok(canvas.draws.some(op => op[0] === 'lineTo')); assert.ok(canvas.draws.some(op => op[0] === 'arc' && op[1] > 500));
  assert.equal(h.document.getElementById('cp-buttons').children[0].disabled, true);
  ui.session.receive(snapshot({ game: 'royal-roller-ruckus', seat: 9, privateState: { ...own, falling: true } })); assert.equal(h.document.getElementById('cp-buttons').children[0].disabled, false); assert.match(h.document.getElementById('cp-feedback').textContent, /Recover/);
});

test('unaccepted input retries same sequence with bounded backoff and preserves later release', async () => {
  let now = 1000, reject = true; const sends = [];
  const { session } = phone({ now: () => now, request: async (action, body) => { if (action === 'poll') return snapshot(); sends.push(plain(body)); if (reject) throw Object.assign(new Error('Queue full'), { status: 429 }); return { accepted: true }; } });
  session.button(1, true, 'finger'); session.button(1, false, 'finger'); await session.flush(); await session.flush(); assert.equal(sends.length, 1);
  now += 999; await session.flush(); assert.equal(sends.length, 1); now += 1; reject = false; await session.flush(); await session.flush(); assert.deepEqual(sends.map(p => [p.seq, p.buttons]), [[1, 1], [1, 1], [2, 0]]);
});

test('persistent input failures stop after3attempts, neutralize controls, and do not spin', async () => {
  let now = 1000, inputs = 0; const { session } = phone({ now: () => now, request: async action => { if (action === 'poll') return snapshot(); inputs++; throw new Error('Offline input'); } });
  session.button(1, true, 'finger'); for (let i = 0; i < 5; i++) { await session.flush(); now += 2000; }
  assert.equal(inputs, 3); assert.equal(session.queue.length, 0); assert.equal(session.buttons, 0); assert.match(session.error, /delayed/);
});

test('phone poll deduplicates concurrent recovery requests and refreshes held controls every150ms', async () => {
  let now = 1000, complete, polls = 0; const { session } = phone({ now: () => now, request: async action => { if (action === 'input') return { accepted: true }; polls++; await new Promise(resolve => { complete = resolve; }); return snapshot(); } });
  const a = session.poll(), b = session.poll(); assert.equal(polls, 1); complete(); await a; await b;
  session.axes(.5, 0); await session.flush(); now += 149; session.refreshHeld(); assert.equal(session.queue.length, 0); now++; session.refreshHeld(); assert.equal(session.queue.length, 1); assert.equal(session.queue[0].x, .5);
});

test('host poll is oneflight and late response after explicit close cannot reassign or deliver input', async () => {
  let complete, requests = 0; const { room, calls } = host({ request: async action => { if (action === 'close') return { closed: true }; requests++; return new Promise(resolve => { complete = resolve; }); } });
  const flight = room.poll(); await room.poll(); assert.equal(requests, 1); await room.close();
  complete({ serverNow: 1000, roster: [{ seat: 0, name: 'Old', connected: true, stale: false }], inputs: [{ seat: 0, receivedAt: 1000, packet: { seq: 1, x: 1, y: 0, buttons: 1 } }] }); await flight;
  assert.equal(calls.some(c => c[0] === 'assign' || c[0] === 'input'), false);
});

test('host rejected packet does not suppress a later accepted action and ack map retries lost host responses', async () => {
  let requests = 0, posted; const { room, adapter } = host({ request: async (_action, body) => { posted = plain(body); if (++requests === 1) throw new Error('Response lost'); return { roster: [], inputs: [], serverNow: 1000 }; } });
  adapter.input = (_seat, packet) => packet.seq !== 1;
  room.receive({ serverNow: 1000, roster: [{ seat: 0, name: 'A', connected: true, stale: false, occupancyId: 'c'.repeat(64) }], inputs: [{ seat: 0, receivedAt: 1000, packet: { seq: 1, x: 0, y: 0, buttons: 1 } }, { seat: 0, receivedAt: 1000, packet: { seq: 2, x: 0, y: 0, buttons: 0 } }] });
  assert.equal(room.ack[0], 2); await room.poll(); await room.poll(); assert.deepEqual(posted.ack[0], { seq: 2, occupancyId: 'c'.repeat(64) });
});

test('mounted hidden cancellation never replays a queued Jump after an in-flight axis request and visible reconnect', async () => {
  const inputs = []; let complete, lastSeq = 0;
  const h = dom('controller.js', { search: '?code=ABCD', fetch: async (url, options) => {
    if (!url.endsWith('/input')) return ok(snapshot({ game: 'space-bash', lastSeq }));
    const packet = JSON.parse(options.body); inputs.push(packet);
    if (inputs.length === 1) return new Promise(resolve => { complete = () => { lastSeq = packet.seq; resolve(ok({ accepted: true })); }; });
    lastSeq = packet.seq; return ok({ accepted: true });
  } });
  const ui = h.context.CallbackPhoneController.mount(); await h.settle();
  await h.emit(h.document.getElementById('cp-stick'), 'pointerdown', { pointerId: 1, clientX: 140, clientY: 100 });
  await h.emit(h.document.getElementById('cp-buttons').children[2], 'pointerdown', { pointerId: 2 });
  assert.equal(ui.session.inflight, true); assert.equal(ui.session.queue.some(p => p.buttons === 4), true);
  h.document.hidden = true; h.docEvent('visibilitychange'); complete(); await h.settle();
  h.setNow(3000); h.document.hidden = false; h.docEvent('visibilitychange'); await h.settle();
  while (ui.session.queue.length) await ui.session.flush();
  assert.equal(inputs.some(p => p.buttons === 4), false, 'the abandoned Jump must never enter the mailbox');
  assert.deepEqual(inputs.map(p => [p.seq, p.x, p.y, p.buttons]), [[1, .5, 0, 0], [3, 0, 0, 0]]);
});

test('blur cancellation does not retry an abandoned in-flight packet after either lost success or unaccepted failure', async () => {
  for (const accepted of [false, true]) {
    let complete; const inputs = [];
    const { session } = phone({ request: async (action, packet) => {
      if (action === 'poll') return snapshot({ lastSeq: accepted ? 1 : 0 });
      inputs.push(plain(packet));
      if (inputs.length === 1) await new Promise((_resolve, reject) => { complete = () => reject(new Error('Response lost')); });
      return { accepted: true };
    } });
    session.axes(.5, 0); const flight = session.flush(); session.button(1, true, 'finger'); session.neutral(); complete(); await flight;
    await session.flush(); session.button(2, true, 'new-finger'); await session.flush();
    assert.deepEqual(inputs.map(p => [p.seq, p.x, p.buttons]), [[1, .5, 0], [3, 0, 0], [4, 0, 2]], `accepted=${accepted}`);
  }
});

test('delayed host success still rejects a2second-old packet and clears an already-held seat without changing ack', async () => {
  for (const held of [false, true]) {
    let now = 1000, complete;
    const { room, calls } = host({ now: () => now, request: async () => new Promise(resolve => { complete = resolve; }) });
    const data = { serverNow: 700000, roster: [{ seat: 0, name: 'Zero', connected: true, stale: false }], inputs: [{ seat: 0, receivedAt: 700000, packet: { seq: 1, x: 1, y: 0, buttons: 1 } }] };
    if (held) room.receive(data);
    calls.length = 0; const flight = room.poll(); now = 3000;
    complete({ ...data, inputs: [{ ...data.inputs[0], packet: { seq: 2, x: -1, y: 0, buttons: 1 } }] }); await flight;
    assert.equal(calls.some(c => c[0] === 'input'), false, `held=${held}`);
    assert.ok(calls.some(c => c[0] === 'clear' && c[1] === 0), 'stale controls are neutralized');
    assert.equal(room.ack[0] || 0, held ? 1 : 0); assert.equal(room.seats.get(0).cleared, true);
  }
});

test('host accepts under-window transport age but gives held input500ms from arrival without synchronized clocks', async () => {
  let now = 1000, complete;
  const { room, calls } = host({ now: () => now, request: async () => new Promise(resolve => { complete = resolve; }) });
  const flight = room.poll(); now = 1200;
  complete({ serverNow: 900000, roster: [{ seat: 9, name: 'Nine', connected: true, stale: false }], inputs: [{ seat: 9, receivedAt: 899800, packet: { seq: 8, x: 1, y: 0, buttons: 0 } }] }); await flight;
  assert.equal(room.ack[9], 8); now = 1301; room.sweep();
  assert.equal(calls.some(c => c[0] === 'clear' && c[1] === 9), false, 'transport age does not consume the local held-control budget');
  now = 1700; room.sweep(); assert.equal(calls.some(c => c[0] === 'clear' && c[1] === 9), false);
  now = 1701; room.sweep(); assert.ok(calls.some(c => c[0] === 'clear' && c[1] === 9));
});

import { game as sumoGame } from '../phone-worlds/royal-sumo-harness.mjs';
const roomRoster = names => ({ serverNow: 1000, roster: names.map(([seat, name]) => ({ seat, name, connected: true, stale: true })), inputs: [] });
const startRoomResponse = () => ({ activeSeatIds: Array.from({ length: 10 }, (_, seat) => seat), botEnabled: Object.fromEntries(Array.from({ length: 10 }, (_, seat) => [seat, true])), version: 2 });
const localHostRequest = async action => action === 'start' ? startRoomResponse() : { roster: [], inputs: [], serverNow: 1000 };

test('actual Sumo adapter keeps same-room restart owners but successful close releases old seats before the next room', async () => {
  const game = sumoGame(), adapter = game.c.CallbackPhoneGame, c = load('host.js');
  const first = new c.CallbackPhoneHost.Room({ code: 'ABCD', adapter, request: async action => action === 'start' ? startRoomResponse() : ({ closed: true }) });
  first.receive(roomRoster([[0, 'Old Zero'], [9, 'Old Nine']])); assert.equal(await first.start(), true);
  game.c.RoyalSumo.restart(); assert.equal(game.sim().ownerOf(0), 'remote'); assert.equal(game.sim().ownerOf(9), 'remote');
  await first.close();
  const second = new c.CallbackPhoneHost.Room({ code: 'EFGH', adapter, request: localHostRequest });
  second.receive(roomRoster([[0, 'New Zero']])); assert.equal(await second.start(), true);
  assert.deepEqual([...second.seats.keys()], [0]); assert.equal(game.sim().n, 10); assert.equal(game.sim().ownerOf(0), 'remote'); assert.equal(game.sim().fighters[0].name, 'New Zero');
  assert.equal(game.sim().ownerOf(9), 'bot'); assert.equal(adapter.phoneState(9), null);
  for (let seat = 1; seat < 10; seat++) assert.equal(game.sim().ownerOf(seat), 'bot');
});

test('terminal401/404 disposal releases actual Sumo ownership so the replacement room has only its own phone', async () => {
  for (const status of [401, 404]) {
    const game = sumoGame(), adapter = game.c.CallbackPhoneGame, c = load('host.js');
    const first = new c.CallbackPhoneHost.Room({ code: 'ABCD', adapter, request: async action => { if (action === 'start') return startRoomResponse(); throw Object.assign(new Error('Terminal room failure'), { status }); } });
    first.receive(roomRoster([[0, 'Old Zero'], [9, 'Old Nine']])); await first.start(); await first.poll();
    assert.equal(first.closed, true); assert.equal(first.seats.size, 0, `status=${status}`); assert.equal(adapter.phoneState(0), null); assert.equal(adapter.phoneState(9), null);
    const next = new c.CallbackPhoneHost.Room({ code: 'EFGH', adapter, request: localHostRequest }); next.receive(roomRoster([[0, 'New Zero']])); await next.start();
    assert.equal(game.sim().ownerOf(0), 'remote'); assert.equal(game.sim().ownerOf(9), 'bot'); assert.equal(adapter.phoneState(9), null);
  }
});

test('closed room ignores delayed401/404 poll failures without stopping or releasing its newly started replacement', async () => {
  for (const status of [401, 404]) {
    let rejectPoll, changes = 0;
    const { room: first, adapter, state, calls, c } = host({ onChange: () => changes++, request: async action => action === 'start' ? startRoomResponse() : action === 'close' ? { closed: true } : new Promise((_resolve, reject) => { rejectPoll = reject; }) });
    adapter.stop = () => { calls.push(['stop']); state.active = false; };
    adapter.start = () => { calls.push(['start']); state.active = true; state.paused = false; };
    first.receive(roomRoster([[0, 'Old Zero'], [9, 'Old Nine']])); const pending = first.poll(); await first.close();
    const next = new c.CallbackPhoneHost.Room({ code: 'EFGH', adapter, request: localHostRequest }); next.receive(roomRoster([[0, 'New Zero'], [9, 'New Nine']])); await next.start();
    const before = plain(calls), notifications = changes, oldError = first.error, oldFailures = first.failures;
    rejectPoll(Object.assign(new Error('Old room expired'), { status })); await pending;
    assert.deepEqual(plain(calls), before, `status=${status}: no adapter mutation after old-room closure`);
    assert.equal(changes, notifications); assert.equal(first.error, oldError); assert.equal(first.failures, oldFailures);
    assert.equal(next.closed, false); assert.equal(next.status().active, true); assert.deepEqual([...next.seats.keys()], [0, 9]);
    await first.close(); first.sweep();
    assert.deepEqual(plain(calls), before, 'repeated old-room disposal is also inert');
  }
});

test('750ms-delayed movement/button input is accepted then held controls clear500ms after arrival, independently of roster transport staleness', async () => {
  let now = 1000, complete;
  const { room, calls } = host({ now: () => now, request: async () => new Promise(resolve => { complete = resolve; }) });
  const flight = room.poll(); now = 1750;
  complete({ serverNow: 900000, roster: [{ seat: 0, name: 'Zero', connected: true, stale: false }], inputs: [{ seat: 0, receivedAt: 900000, packet: { seq: 3, x: .5, y: -.25, buttons: 2 } }] }); await flight;
  assert.deepEqual(calls.filter(c => c[0] === 'input'), [['input', 0, { seq: 3, x: .5, y: -.25, buttons: 2 }]]);
  assert.equal(room.ack[0], 3); assert.equal(room.seats.get(0).inputAt, 1750);
  now = 1950; room.receive({ serverNow: 900200, roster: [{ seat: 0, name: 'Zero', connected: true, stale: true }], inputs: [] });
  assert.equal(calls.some(c => c[0] === 'clear'), false, 'mailbox staleness does not prematurely cancel recently delivered controls');
  now = 2250; room.sweep(); assert.equal(calls.some(c => c[0] === 'clear'), false);
  now = 2251; room.sweep(); assert.ok(calls.some(c => c[0] === 'clear' && c[1] === 0)); assert.equal(room.ack[0], 3);
});

test('1501ms total delivery age rejects input and clears old holds whether delay is transit-only or mixed with server age', async () => {
  for (const serverAge of [0, 750]) {
    let now = 1000, complete;
    const { room, calls } = host({ now: () => now, request: async () => new Promise(resolve => { complete = resolve; }) });
    const roster = [{ seat: 0, name: 'Zero', connected: true, stale: false }];
    room.receive({ serverNow: 900000, roster, inputs: [{ seat: 0, receivedAt: 900000, packet: { seq: 1, x: 1, y: 0, buttons: 1 } }] }); calls.length = 0;
    const flight = room.poll(); now += 1501 - serverAge;
    complete({ serverNow: 900000, roster, inputs: [{ seat: 0, receivedAt: 900000 - serverAge, packet: { seq: 2, x: -1, y: 0, buttons: 2 } }] }); await flight;
    assert.equal(calls.some(c => c[0] === 'input'), false, `serverAge=${serverAge}`);
    assert.ok(calls.some(c => c[0] === 'clear' && c[1] === 0)); assert.equal(room.ack[0], 1);
  }
});
