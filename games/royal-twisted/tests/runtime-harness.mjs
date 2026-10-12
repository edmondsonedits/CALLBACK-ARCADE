import vm from "node:vm";
import { readFileSync } from "node:fs";
export const source = readFileSync(
  new URL("../source/index.html", import.meta.url),
  "utf8",
);
const noop = () => {};
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    Object.assign(this, { x, y, z });
  }
  set(x, y, z) {
    Object.assign(this, { x, y, z });
    return this;
  }
  copy(v) {
    return this.set(v.x, v.y, v.z);
  }
  clone() {
    return new Vector3().copy(this);
  }
  add(v) {
    return this.addScaledVector(v, 1);
  }
  sub(v) {
    return this.addScaledVector(v, -1);
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  multiplyScalar(s) {
    return this.set(this.x * s, this.y * s, this.z * s);
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  normalize() {
    return this.multiplyScalar(1 / Math.sqrt(this.lengthSq()));
  }
  lerp(v, s) {
    return this.addScaledVector(v.clone().sub(this), s);
  }
  crossVectors(a, b) {
    return this.set(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x,
    );
  }
  applyAxisAngle(a, r) {
    const v = this.clone(),
      c = Math.cos(r),
      s = Math.sin(r),
      d = v.x * a.x + v.y * a.y + v.z * a.z;
    return this.copy(v)
      .multiplyScalar(c)
      .addScaledVector(new Vector3().crossVectors(a, v), s)
      .addScaledVector(a, d * (1 - c));
  }
}
function element() {
  const classes = new Set(),
    listeners = {};
  return {
    listeners,
    style: {},
    children: [],
    value: "normal",
    textContent: "",
    classList: {
      add: (x) => classes.add(x),
      remove: (x) => classes.delete(x),
      contains: (x) => classes.has(x),
      toggle(x, on) {
        on ??= !classes.has(x);
        on ? classes.add(x) : classes.delete(x);
      },
    },
    appendChild(x) {
      this.children.push(x);
    },
    addEventListener(n, fn) {
      (listeners[n] ??= []).push(fn);
    },
    setPointerCapture: noop,
    releasePointerCapture: noop,
  };
}
export function runtime(count = 4, seed = 19) {
  const elements = new Map(),
    listeners = {},
    timers = [],
    pads = [];
  let rng = seed;
  const random = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const el = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const math = Object.create(Math);
  math.random = random;
  const game = {
    Math: math,
    THREE: { Vector3 },
    URLSearchParams,
    location: { search: `?players=${count}` },
    performance: { now: () => 0 },
    innerWidth: 1280,
    innerHeight: 720,
    localStorage: { getItem: () => null, setItem: noop },
    navigator: { getGamepads: () => pads },
    setTimeout(fn) {
      timers.push(fn);
      return timers.length;
    },
    clearTimeout: noop,
    document: {
      querySelector: el,
      createElement: element,
      addEventListener(n, fn) {
        listeners[n] = fn;
      },
    },
    addEventListener(n, fn) {
      listeners[n] = fn;
    },
  };
  game.window = game;
  vm.createContext(game);
  const script = source.slice(
    source.indexOf("const $="),
    source.indexOf("try{initRenderer();"),
  );
  vm.runInContext(script, game);
  const run = (code) => vm.runInContext(code, game);
  // Stub only scene construction, rendering and audiovisual output. Gameplay stays real.
  run(`scene={add(){},remove(){}};hazardGroup={remove(){}};
 buildDummy=()=>({root:{visible:true,position:new THREE.Vector3(),rotation:{z:0},add(){},remove(){}},label:{scale:{set(){}},position:{}}});
 createHazard=(type,t)=>{const h={id:++hazardId,type,t,checked:new Set(),warned:false};hazards.push(h);return h};
 positionHazard=()=>{};spawnParticles=()=>{};impactRing=()=>{};tone=()=>{};sfxHit=()=>{};sfxOut=()=>{};sfxWin=()=>{};sfxJump=()=>{};sfxDuck=()=>{};sfxClear=()=>{};triggerFlash=()=>{};
 camera={position:new THREE.Vector3(),fov:46,lookAt(v){this.target=v.clone()},updateProjectionMatrix(){}};
 createFighters();resetRound();phase='fight';nextSpawn=999;`);
  return {
    run,
    game,
    pads,
    timers,
    el,
    fire(name, props = {}) {
      listeners[name]?.({ preventDefault: noop, repeat: false, ...props });
    },
    click(id) {
      for (const fn of el(id).listeners.click ?? []) fn();
    },
    tick(seconds) {
      for (let i = 0; i < Math.round(seconds * 120); i++)
        run(
          'if(!paused&&phase==="fight")fixedUpdate(FIXED_DT);updatePhase(FIXED_DT)',
        );
    },
  };
}
