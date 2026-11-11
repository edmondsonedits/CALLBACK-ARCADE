import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// DOM contract doubles only: execute the actual shipping menu's lifecycle handlers.
class Element {
  className = ''; id = ''; type = ''; value: string | number = ''; checked = false;
  open = false; hidden = false; innerHTML = ''; textContent = '';
  children: Element[] = []; parts = new Map<string, Element>();
  onclick?: () => void;
  setAttribute() {} focus() {}
  append(...children: Element[]) { this.children.push(...children); }
  querySelector(selector: string) {
    if (!this.parts.has(selector)) this.parts.set(selector, new Element());
    return this.parts.get(selector)!;
  }
  addEventListener() {}
  showModal() { this.open = true; } close() { this.open = false; }
}
function menu() {
  const events = new Map<string, () => void>(), pauses: boolean[] = [];
  const body = Object.assign(new Element(), { dataset: {} });
  const document = { body, hidden: false, createElement: () => new Element(), querySelector:(s:string)=>body.children.find(e=>'.'+e.className===s)??null,
    addEventListener: (name: string, fn: () => void) => events.set(name, fn) };
  const game = { id: 'test', title: 'Test', summary: 'Test game',
    defaults: { arena: 'one', players: 10 }, arenas: [{ id: 'one', name: 'One', skill: 'Timing' }],
    fields: [{ id: 'arena', choices: [{ value: 'one', label: 'One' }] }, { id: 'players', min: 2, max: 10 }],
    pause: (on: boolean) => pauses.push(on), start() {}, state: () => ({}) };
  vm.runInNewContext(readFileSync(new URL('../public/arcade-games/shared/arcade-menu.js', import.meta.url), 'utf8'), {
    window: { CallbackArcadeGame: game, addEventListener() {} }, document,
    localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {},
  });
  return { document, body, pauses, visibility(hidden: boolean) { document.hidden = hidden; events.get('visibilitychange')!(); } };
}
test('title bot demo recovers when the tab becomes visible', () => {
  const m = menu(); m.visibility(true); m.visibility(false);
  assert.deepEqual(m.pauses, [true, false]);
});
test('returning to a playing tab offers an explicit Resume control', () => {
  const m = menu(); m.body.children.find(e => e.className === 'arcade-title-menu')!.querySelector('.play').onclick!();
  m.visibility(true); m.visibility(false);
  const pause = m.body.children.find(e => e.className === 'arcade-return-pause');
  assert.equal(pause?.open, true); assert.deepEqual(m.pauses, [true,true]);
  pause!.querySelector('.resume').onclick!();
  assert.equal(pause!.open, false); assert.deepEqual(m.pauses, [true,true,false]);
});
test('a customization dialog retains pause after a tab switch', () => {
  const m = menu(); m.body.children.find(e => e.className === 'arcade-title-menu')!.querySelector('.setup').onclick!();
  m.visibility(true); m.visibility(false);
  assert.ok(m.body.children.find(e => e.className === 'arcade-setup')!.open);
  assert.equal(m.body.children.find(e => e.className === 'arcade-return-pause')?.open ?? false, false);
  assert.deepEqual(m.pauses, [true, true]);
});
