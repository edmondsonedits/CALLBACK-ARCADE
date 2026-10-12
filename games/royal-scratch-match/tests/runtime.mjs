// Execute the complete production script. Only browser, audio and wall-time boundaries
// are stubbed. The closure accessor is injected in memory, never shipped in the game.
import fs from 'node:fs';
import vm from 'node:vm';
export function runtime() {
    const source = fs.readFileSync(new URL('../source/index.html', import.meta.url), 'utf8');
    let now = 100000;
    const listeners = {}, elements = {}, timers = [], sounds = [], drawCalls = [];
    const noop = () => {
    };
    const ctx = new Proxy({}, { get: (_, k) => k.startsWith('create') ? () => ({ addColorStop: noop }) : (...args) => drawCalls.push([k, ...args]), set: () => true });
    const element = (id = '') => {
        const classes = new Set(), captures = new Set();
        return { id, classes, captures, dataset: {}, style: { setProperty: noop }, classList: { add: v => classes.add(v), remove: v => classes.delete(v), toggle(v, on) {
                    if (on)
                        classes.add(v);
                    else
                        classes.delete(v);
                } }, textContent: '', innerHTML: '', children: [], getContext: () => ctx, setAttribute: noop, appendChild: noop, addEventListener(n, f) {
                this[n] = f;
            }, setPointerCapture: id => captures.add(id), releasePointerCapture: id => captures.delete(id), getBoundingClientRect: () => ({ top: 700, bottom: 140 }), };
    };
    const buttons = Array.from({ length: 4 }, (_, i) => Object.assign(element(), { dataset: { lane: String(i) } }));
    class AudioContext {
        state = 'running';
        currentTime = 3;
        destination = {};
        resume() {
            this.state = 'running';
            return Promise.resolve();
        }
        createGain() {
            return { gain: { value: 1, setValueAtTime: noop, exponentialRampToValueAtTime: noop, cancelScheduledValues: noop }, connect: noop, disconnect: noop };
        }
        createOscillator() {
            const n = { type: '', frequency: { setValueAtTime: noop, exponentialRampToValueAtTime: noop }, connect: noop, disconnect: noop, start(t) {
                    sounds.push({ t, node: n });
                }, stop() {
                    n.stopped = true;
                } };
            return n;
        }
    }
    const document = { hidden: false, documentElement: element(), head: element(), getElementById: id => elements[id] ??= element(id), querySelector: s => s.startsWith('.beat-btn') ? buttons[+s.match(/\d/)[0]] : null, querySelectorAll: s => s === '.beat-btn' ? buttons : [], createElement: () => element(), addEventListener: (n, f) => listeners[n] = f };
    const g = { console, Math: Object.create(Math), Set, URLSearchParams, performance: { now: () => now }, innerWidth: 390, innerHeight: 844, document, navigator: {}, location: { search: '' }, localStorage: { getItem: () => null }, AudioContext, addEventListener: (n, f) => listeners[n] = f, requestAnimationFrame: noop, setTimeout: (fn, delay) => {
            timers.push({ fn, delay, cancelled: false });
            return timers.length;
        }, clearTimeout: id => {
            if (timers[id - 1])
                timers[id - 1].cancelled = true;
        } };
    g.window = g;
    vm.createContext(g);
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\}\)\(\);\s*$/, 'window.inspect=(code)=>eval(code);})();');
    vm.runInContext(script, g);
    return { g, buttons, listeners, timers, sounds, drawCalls, run: s => g.inspect(s), advance(ms) {
            now += ms;
        }, hidden(v) {
            document.hidden = v;
            listeners.visibilitychange?.();
        }, tick(ms = 1000 / 120) {
            now += ms;
            g.inspect('updateGame(1/120)');
        }, setup(difficulty = 'normal', lanes = [0]) {
            g.ScratchMatchAPI.start({ difficulty, humanPlayers: [0, 1], seed: 123 });
            g.inspect(`phase='response';phaseClock=gameClock();songTime=0;notes=[{id:0,time:1,lanes:${JSON.stringify(lanes)},callPlayed:false,responses:players.map(()=>({hits:new Set(),errors:[],resolved:false}))}];`);
        } };
}
