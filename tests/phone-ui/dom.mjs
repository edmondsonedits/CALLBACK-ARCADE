// A deliberate DOM boundary simulation, not a browser/layout engine.
import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
export function dom(script, { game = 'royal-sumo', search = '', fetch = async () => ({ ok: true, json: async () => ({}) }) } = {}) {
  const events = new Map(), timers = new Map(), storage = new Map(); let timerID = 0, now = 1000;
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.dataset = {}; this.listeners = new Map(); this.style = { setProperty() {} }; this.hidden = false; this.disabled = false; this.value = ''; this.className = ''; this._text = ''; this.width = 1000; this.height = 640; this.open = false; this.classList = { add: (...names) => { this.className += ' ' + names.join(' '); } }; this.draws = []; }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = value; if (name === 'class') this.className = value; if (name.startsWith('data-')) this.dataset[name.slice(5)] = String(value); if (name === 'value') this.value = value; if (name === 'hidden') this.hidden = true; }
    getAttribute(name) { return this.attributes[name]; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set innerHTML(html) { this.children = []; const stack = [this]; for (const match of html.matchAll(/<\/?([a-z0-9-]+)([^>]*)>/gi)) { const token = match[0], tag = match[1]; if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; } const node = new Element(tag); for (const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(attr[1], attr[2] ?? ''); stack.at(-1).append(node); if (!['input', 'img', 'link', 'meta', 'br'].includes(tag)) stack.push(node); } }
    matches(selector) { return selector.split(',').some(part => { const s = part.trim(); if (s.startsWith('.')) return this.className.split(/\s+/).includes(s.slice(1)); if (s.startsWith('#')) return this.id === s.slice(1); const match = s.match(/^(\w+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/); if (!match) return false; return (!match[1] || this.tagName.toLowerCase() === match[1]) && (!match[2] || match[3] === undefined ? !match[2] || Object.hasOwn(this.attributes, match[2]) || (match[2].startsWith('data-') && Object.hasOwn(this.dataset, match[2].slice(5))) : (match[2].startsWith('data-') ? this.dataset[match[2].slice(5)] : this.attributes[match[2]]) === match[3]); }); }
    closest(selector) { const ancestry = [this]; while (ancestry.at(-1).parent) ancestry.push(ancestry.at(-1).parent); return ancestry.find(node => node.matches(selector)) || null; }
    querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    setPointerCapture(id) { this.capture = id; }
    getBoundingClientRect() { return this.tagName === 'CANVAS' ? { left: 0, top: 0, width: 1000, height: 640 } : { left: 0, top: 0, width: 200, height: 200 }; }
    getContext() { return new Proxy({ canvas: this }, { get: (_target, key) => (...args) => this.draws.push([key, ...args]), set: () => true }); }
  }
  const document = { readyState: 'loading', hidden: false, currentScript: { dataset: { game } }, head: new Element('head'), body: new Element('body'), addEventListener: (type, fn) => { if (!events.has('doc:' + type)) events.set('doc:' + type, []); events.get('doc:' + type).push(fn); }, createElement: tag => new Element(tag), querySelector(selector) { return this.body.querySelector(selector); }, getElementById(id) { return this.body.querySelector('#' + id); } };
  if (script === 'controller.js') { const html = readFileSync(new URL('../../public/arcade-games/phone/controller.html', import.meta.url), 'utf8'); document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1]; }
  const context = createContext({ console, document, URL, URLSearchParams, AbortController, Date: class extends Date { static now() { return now; } }, location: { origin: 'https://arcade.test', href: 'https://arcade.test/arcade-games/phone/controller.html' + search, search }, fetch,
    history: { replaceState(_state, _title, url) { context.location.href = url; } }, navigator: { clipboard: { writeText: async () => {} } },
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    setTimeout: (fn, delay) => { timers.set(++timerID, { fn, delay }); return timerID; }, clearTimeout: id => timers.delete(id), setInterval: (fn, delay) => { timers.set(++timerID, { fn, delay, interval: true }); return timerID; }, clearInterval: id => timers.delete(id),
    addEventListener: (type, fn, capture) => { if (!events.has(type)) events.set(type, []); events.get(type).push({ fn, capture: !!capture }); }, CallbackPhoneQR: { toDataURL: async () => 'data:image/png;base64,LOCAL' } }); context.window = context;
  runInContext(readFileSync(new URL('../../public/arcade-games/phone/' + script, import.meta.url), 'utf8'), context);
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  async function emit(target, type, fields = {}) {
    const event = { type, target, currentTarget: target, key: '', code: '', detail: 1, pointerId: 1, clientX: 100, clientY: 100, repeat: false, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...fields };
    for (const listener of events.get(type) || []) { if (!listener.capture || event.stopped) continue; listener.fn(event); }
    for (let node = target; node && !event.stopped; node = node.parent) for (const fn of node.listeners.get(type) || []) fn(event);
    if (!event.stopped) for (const fn of events.get('doc:' + type) || []) fn(event);
    for (const listener of events.get(type) || []) { if (listener.capture || event.stopped) continue; listener.fn(event); }
    await settle(); return event;
  }
  return { context, document, events, timers, storage, emit, settle, setNow(value) { now = value; }, docEvent(type) { for (const fn of events.get('doc:' + type) || []) fn({ type }); } };
}
