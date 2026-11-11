/* eslint-disable @typescript-eslint/no-unused-vars -- static source extraction keeps native declarations and neutralizes browser effects. */
/** Generated from space-bash/online-v65.html SHA-256 fef496e364d53ae1dee0e700425314eb1dabecc7d8aff863acb4ed27a79fb7ca. */
import {Vector3,Quaternion,CatmullRomCurve3} from './imported-math.mjs';
import {encode,decode} from './imported-codec.mjs';
const THREE={Vector3,Quaternion,CatmullRomCurve3};
const courseCache=new Map();
export function runtime(ids,seed,options,botIds,state,onlineInputs={}){
 let now=state?.now||0,rng=state?.rng??(seed>>>0),endAt=state?.endAt??0;
 const previous=state?.previous||{},nextPrevious={...previous};
 const Math=Object.create(globalThis.Math);Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
 const performance={now:()=>now*1000};let botDifficulty=state?.botDifficulty||"normal";
 function fresh(slot){const i=onlineInputs[ids[slot]];return !!i&&Number.isFinite(i.seq)&&i.seq>(previous[ids[slot]]??-1);}
 const HALF = 4;
let ROUND_TIME = 90;
const COLORS = ["#67e8f9", "#ff6f91", "#ffd166", "#a879ff", "#87f58b", "#ff9f5b", "#5bd7ff", "#f47cff", "#e8f06a", "#9aa8ff"];
const NAMES = ["YOU", "NOVA", "BOLT", "PIXEL", "COMET", "ROOK", "MICA", "JET", "LUMA", "AXIS"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const norm = (x, z) => { const d = Math.hypot(x, z) || 1; return [x / d, z / d]; };
const TUNE = { move: { accel: 15.2, max: 3.65, drag: 4.15, airAccel: 5.4, airDrag: .55 }, jump: 5.15, kickForce: 3.45, throwSpeed: 7.35, crateKick: 6.8, gravity: 9.5 };
let arcadeView = "play";
let arcadeArena = "orbital";
let arcadeWins = 3;
let arcadeMeteorTimer = 0;
let arcadeMeteors = [];
let arcadeName = "YOU";
const baseSpaceTune = JSON.parse(JSON.stringify(TUNE));
let playerCount = 4;
let difficulty = 1;
let tiles = [];
let fighters = [];
let crates = [];
let particles = [];
let phase = "countdown";
let phaseT = 3.2;
let round = 1;
let timeLeft = ROUND_TIME;
let wins = Array(10).fill(0);
let spawnT = 1;
let powerT = 12;
let paused = false;
let acc = 0;
let flash = 0;
const joy = { x: 0, z: 0, active: false, id: null };
let crateId = 0;
function say(){}
function vibrate(){}
function beep(){}
function resetTiles() { tiles = Array.from({ length: 64 }, (_, i) => ({ alive: true, r: (i / 8) | 0, c: i % 8, fall: 0 })); }
function cell(x, z) { const c = Math.floor(x + HALF), r = Math.floor(z + HALF); return r >= 0 && c >= 0 && r < 8 && c < 8 ? { r, c, i: r * 8 + c } : null; }
function tileAlive(x, z) { const q = cell(x, z); return !!(q && tiles[q.i].alive); }
function destroyTile(x, z) { const q = cell(x, z); if (!q || !tiles[q.i].alive)
    return; tiles[q.i].alive = false; tiles[q.i].fall = 1; burst(x, z, "#ff9c68", 18); }
function safeSpawn() { const a = tiles.filter(t => t.alive && t.r > 1 && t.r < 6 && t.c > 1 && t.c < 6); const t = a[(Math.random() * a.length) | 0] || tiles[27]; return { x: t.c - 3.5, z: t.r - 3.5 }; }
function makeFighter(id, x, z) { const [fx, fz] = norm(-x, -z); return { id, name: id === 0 ? arcadeName : NAMES[id], color: COLORS[id], x, z, y: 0, vx: 0, vz: 0, vy: 0, faceX: fx, faceZ: fz, hp: 100, alive: true, falling: false, grounded: true, carrying: null, kickCd: 0, jumpCd: 0, stagger: 0, shield: 0, boost: 0, slow: 0, weight: 0, think: rand(.15, .5), control: id === 0 && arcadeView === "play" ? "local" : "cpu", anim: rand(0, 10), land: 0 }; }
function createFighters() { fighters = []; const radius = playerCount >= 8 ? 3.25 : 3.0; for (let i = 0; i < playerCount; i++) {
    const a = Math.PI / 2 + i / playerCount * Math.PI * 2;
    fighters.push(makeFighter(i, Math.cos(a) * radius, Math.sin(a) * radius));
} }
function crateType() { const t = timeLeft < 12 ? [.22, .43, .35] : timeLeft < 30 ? [.34, .41, .25] : timeLeft < 60 ? [.5, .35, .15] : [.66, .27, .07], r = Math.random(); return r < t[0] ? "normal" : r < t[0] + t[1] ? "tnt" : "nitro"; }
function spawnCrate(initial = false) { const max = 10 + Math.max(0, playerCount - 4); if (crates.filter(c => c.alive).length >= max)
    return; const spots = tiles.filter(t => t.alive && t.r > 0 && t.r < 7 && t.c > 0 && t.c < 7).sort(() => Math.random() - .5); for (const t of spots) {
    const x = t.c - 3.5, z = t.r - 3.5;
    if (fighters.some(f => f.alive && Math.hypot(f.x - x, f.z - z) < .8))
        continue;
    const type = crateType();
    crates.push({ id: ++crateId, type, x, z, y: initial ? 0.22 : 3.4, vx: 0, vz: 0, vy: initial ? 0 : -1, r: .32, alive: true, grounded: initial, held: null, armed: false, fuse: 3, warn: false });
    return;
} }
function burst(){}
// All crate exits clear both sides; no visual effect owns simulation state.
function releaseCrate(c) {
    if (c.held && c.held.carrying === c)
        c.held.carrying = null;
    c.held = null;
}
function armCrate(c, seconds) { c.fuse = c.armed ? Math.min(c.fuse, seconds) : seconds; c.armed = true; }
function facing(f) { const d = Math.hypot(f.faceX, f.faceZ); return d > .001 ? [f.faceX / d, f.faceZ / d] : [1, 0]; }
function launchCrate(c, f, speed, lift) {
    const [nx, nz] = facing(f);
    releaseCrate(c);
    c.x = f.x + nx * .55;
    c.z = f.z + nz * .55;
    c.y = f.y + .8;
    c.vx = nx * speed;
    c.vz = nz * speed;
    c.vy = lift;
    c.grounded = false;
    c.launcher = f.id;
    c.ownerGrace = .12;
    c.impactUsed = false;
}
function canAct(f) { return phase === "fight" && !paused && f && f.alive && !f.falling && f.stagger <= 0; }
function explode(c) {
    if (!c.alive)
        return;
    const x = c.x, z = c.z, type = c.type;
    c.alive = false;
    releaseCrate(c);
    // A crate already below the deck cannot blast the deck from the void.
    if (c.y < -.5)
        return;
    destroyTile(x, z);
    burst(x, z, type === "nitro" ? "#aaff73" : "#ff816f", type === "nitro" ? 34 : 26);
    flash = .16;
    beep(type === "nitro" ? 90 : 70, .2, .05);
    vibrate(40);
    const rad = type === "nitro" ? 1.7 : 1.5;
    for (const f of fighters) {
        if (!f.alive || f.falling)
            continue;
        const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz);
        if (d < rad) {
            const [nx, nz] = d > .001 ? norm(dx, dz) : facing(f);
            damage(f, (type === "nitro" ? 34 : 24) * (1 - d / rad * .45), nx, nz, (type === "nitro" ? 6.5 : 5.4) * (1 - d / rad * .35), true);
        }
    }
    for (const o of crates)
        if (o !== c && o.alive && o.type !== "normal" && Math.hypot(o.x - x, o.z - z) < rad * 1.05)
            armCrate(o, rand(.08, .25));
}
function damage(f, amt, nx, nz, force, explosive = false) { if (!f.alive || f.falling || f.stagger > 0)
    return; if (f.shield) {
    f.shield = 0;
    amt = 0;
    force *= .65;
} f.hp = clamp(f.hp - amt, 0, 100); f.vx += nx * force; f.vz += nz * force; f.vy = Math.max(f.vy, explosive ? 2.6 : 1.2); f.grounded = false; f.stagger = explosive ? .26 : .14; burst(f.x, f.z, "#ffffff", 5); if (f.id === 0)
    vibrate(force > 5 ? 36 : 18); if (f.hp <= 0)
    eliminate(f); }
function eliminate(f) { if (f.falling || !f.alive)
    return; f.falling = true; f.vy = Math.max(f.vy, .8); if (f.carrying) {
    drop(f);
} ; say(f.id === 0 ? "You are out — the round continues." : f.name + " is out!"); beep(120, .18, .03); }
function drop(f) {
    const c = f.carrying;
    if (!c)
        return;
    f.carrying = null;
    releaseCrate(c);
    if (!c.alive)
        return;
    const [nx, nz] = facing(f);
    c.x = f.x + nx * .45;
    c.z = f.z + nz * .45;
    c.y = f.y + .6;
    c.grounded = false;
    c.vx = f.vx;
    c.vz = f.vz;
    c.vy = .7;
    c.impactUsed = true;
}
function nearCrate(f) {
    let best = null, score = Infinity;
    const [nx, nz] = facing(f);
    for (const c of crates) {
        if (!c.alive || c.held || !c.grounded || c.type === "nitro" || Math.abs(c.y - f.y - .22) > .5)
            continue;
        const dx = c.x - f.x, dz = c.z - f.z, d = Math.hypot(dx, dz);
        if (d >= .75)
            continue;
        const intent = d + .16 * (1 - (d > .001 ? (dx * nx + dz * nz) / d : 1));
        if (intent < score) {
            best = c;
            score = intent;
        }
    }
    return best;
}
function grabThrow(f) {
    if (!canAct(f))
        return;
    if (f.carrying) {
        const c = f.carrying;
        if (!c.alive) {
            releaseCrate(c);
            f.carrying = null;
            return;
        }
        launchCrate(c, f, TUNE.throwSpeed, 2.4);
        if (c.type === "tnt")
            armCrate(c, 2.8);
        f.throwFx = .22;
        beep(280, .07);
        return;
    }
    const c = nearCrate(f);
    if (c) {
        f.carrying = c;
        c.held = f;
        c.grounded = false;
        c.vx = c.vz = c.vy = 0;
        if (c.type === "tnt")
            armCrate(c, 3);
        f.grabFx = .18;
        beep(420, .04);
    }
    else if (f.id === 0)
        say("Move closer to a blue or TNT crate to grab it.");
}
function kick(f) {
    if (!canAct(f) || f.kickCd > 0)
        return;
    f.kickCd = .52;
    f.kickFx = .18;
    const [fx, fz] = facing(f);
    let best = null, bd = 1;
    for (const c of crates) {
        if (!c.alive || c.held || Math.abs(c.y - f.y - .22) > .6)
            continue;
        const dx = c.x - f.x, dz = c.z - f.z, d = Math.hypot(dx, dz);
        if (d < bd && (d < .001 || (dx * fx + dz * fz) / d > .05)) {
            best = c;
            bd = d;
        }
    }
    if (best) {
        if (best.type === "nitro")
            armCrate(best, .1);
        else {
            best.vx = fx * TUNE.crateKick;
            best.vz = fz * TUNE.crateKick;
            best.vy = .5;
            best.grounded = false;
            best.launcher = f.id;
            best.ownerGrace = .12;
            best.impactUsed = false;
            if (best.type === "tnt")
                armCrate(best, 3);
        }
        beep(180, .06);
        return;
    }
    for (const o of fighters) {
        if (o === f || !o.alive || o.falling || Math.abs(o.y - f.y) > .65)
            continue;
        const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz);
        if (d < .9 && (d < .001 || (dx * fx + dz * fz) / d > .05)) {
            const [nx, nz] = d > .001 ? norm(dx, dz) : [fx, fz];
            damage(o, 7, nx, nz, TUNE.kickForce);
            beep(135, .07);
            return;
        }
    }
    beep(210, .025, .01);
}
function jump(f) { if (!canAct(f) || !f.grounded || f.jumpCd > 0)
    return; f.vy = TUNE.jump; f.grounded = false; f.jumpCd = .68; f.land = 0; beep(320, .045); }
function drive(f, dx, dz, dt, m = 1) { const spd = (f.boost > 0 ? 1.35 : 1) * (f.slow > 0 ? .55 : 1), acc = (f.grounded ? TUNE.move.accel : TUNE.move.airAccel) * spd * m; f.vx += dx * acc * dt; f.vz += dz * acc * dt; f.faceX += (dx - f.faceX) * Math.min(1, dt * 13); f.faceZ += (dz - f.faceZ) * Math.min(1, dt * 13); }
function hazardAt(x, z) { if (!tileAlive(x, z))
    return 99; let s = 0; const q = cell(x, z); if (q) {
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r = q.r + dr, c = q.c + dc;
        if (r >= 0 && c >= 0 && r < 8 && c < 8 && !tiles[r * 8 + c].alive)
            s += 3;
    }
} for (const c of crates) {
    if (c.alive && c.armed && Math.hypot(c.x - x, c.z - z) < 1.9)
        s += 6;
} return s; }
function enemy(f) { let b = null, bs = -99; for (const o of fighters) {
    if (o === f || !o.alive || o.falling)
        continue;
    const d = Math.hypot(o.x - f.x, o.z - f.z), score = 4 - d + hazardAt(o.x, o.z) * .12;
    if (score > bs) {
        bs = score;
        b = o;
    }
} return b; }
function botDrive(f, dx, dz, dt, m = 1) {
    const look = .48 + Math.hypot(f.vx, f.vz) * .12;
    let best = null, score = Infinity;
    for (const a of [0, .65, -.65, 1.3, -1.3, Math.PI]) {
        const x = dx * Math.cos(a) - dz * Math.sin(a), z = dx * Math.sin(a) + dz * Math.cos(a);
        const px = f.x + x * look, pz = f.z + z * look;
        if (Math.abs(px) > 3.6 || Math.abs(pz) > 3.6 || !tileAlive(px, pz) || !tileAlive(f.x + x * look * .5, f.z + z * look * .5))
            continue;
        const cost = Math.abs(a) + hazardAt(px, pz) * .25;
        if (cost < score) {
            score = cost;
            best = [x, z];
        }
    }
    if (best)
        drive(f, best[0], best[1], dt, m);
    else {
        f.vx *= Math.exp(-12 * dt);
        f.vz *= Math.exp(-12 * dt);
    }
}
function ai(f, dt) {
    const D = difficulty;
    f.think -= dt;
    const e = enemy(f);
    if (f.carrying) {
        const c = f.carrying;
        if (c.armed && c.fuse < 1.15) {
            if (e) {
                [f.faceX, f.faceZ] = norm(e.x - f.x, e.z - f.z);
            }
            grabThrow(f);
            f.think = rand(.2, .55);
            return;
        }
        if (e) {
            const dx = e.x - f.x, dz = e.z - f.z, d = Math.hypot(dx, dz), n = norm(dx, dz);
            f.faceX = n[0];
            f.faceZ = n[1];
            if (d < 4.4 && f.think <= 0) {
                grabThrow(f);
                f.think = rand(.2, .55);
                return;
            }
            botDrive(f, n[0], n[1], dt, D);
        }
        return;
    }
    let danger = null, bd = 9;
    for (const c of crates) {
        if (c.alive && c.armed && c.y > -.5) {
            const d = Math.hypot(c.x - f.x, c.z - f.z);
            if (d < 1.9 && d < bd) {
                danger = c;
                bd = d;
            }
        }
    }
    if (danger) {
        const [dx, dz] = Math.hypot(f.x - danger.x, f.z - danger.z) > .001 ? norm(f.x - danger.x, f.z - danger.z) : facing(f);
        botDrive(f, dx, dz, dt, D * 1.15);
        return;
    }
    let c = null, cd = 9;
    for (const q of crates) {
        if (!q.alive || q.held || !q.grounded || q.type === "nitro" || hazardAt(q.x, q.z) > 5)
            continue;
        const d = Math.hypot(q.x - f.x, q.z - f.z);
        if (d < cd) {
            cd = d;
            c = q;
        }
    }
    if (c) {
        if (cd < .75 && nearCrate(f)) {
            grabThrow(f);
            return;
        }
        const [dx, dz] = norm(c.x - f.x, c.z - f.z);
        botDrive(f, dx, dz, dt, D);
    }
    else if (e) {
        const [dx, dz] = norm(e.x - f.x, e.z - f.z);
        botDrive(f, dx, dz, dt, D);
    }
    if (e && Math.hypot(e.x - f.x, e.z - f.z) < .9 && f.kickCd <= 0 && f.think <= 0) {
        kick(f);
        f.think = rand(.18, .5) / D;
    }
}
function collide() {
    for (let i = 0; i < fighters.length; i++)
        for (let j = i + 1; j < fighters.length; j++) {
            const a = fighters[i], b = fighters[j];
            if (!a.alive || !b.alive || a.falling || b.falling || Math.abs(a.y - b.y) > .65)
                continue;
            const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = .68;
            if (d < min) {
                const nx = d > .001 ? dx / d : 1, nz = d > .001 ? dz / d : 0, over = min - d;
                a.x = clamp(a.x - nx * over * .5, -3.65, 3.65);
                a.z = clamp(a.z - nz * over * .5, -3.65, 3.65);
                b.x = clamp(b.x + nx * over * .5, -3.65, 3.65);
                b.z = clamp(b.z + nz * over * .5, -3.65, 3.65);
                const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
                if (rel < 0) {
                    const imp = -rel * .62;
                    a.vx -= nx * imp;
                    a.vz -= nz * imp;
                    b.vx += nx * imp;
                    b.vz += nz * imp;
                }
            }
        }
}
// Earliest intersection with a fighter-sized ellipsoid, including jump height.
function crateHitTime(c, old, f) {
    const ox = (old.x - f.x) / .62, oz = (old.z - f.z) / .62, oy = (old.y - f.y - .35) / .65;
    const dx = (c.x - old.x) / .62, dz = (c.z - old.z) / .62, dy = (c.y - old.y) / .65;
    const a = dx * dx + dz * dz + dy * dy, b = 2 * (ox * dx + oz * dz + oy * dy), q = ox * ox + oz * oz + oy * oy - 1;
    if (q <= 0)
        return 0;
    if (a < 1e-9)
        return Infinity;
    const disc = b * b - 4 * a * q;
    if (disc < 0)
        return Infinity;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : Infinity;
}
function updateCrates(dt) {
    for (const c of crates) {
        if (!c.alive) {
            releaseCrate(c);
            continue;
        }
        c.land = Math.max(0, (c.land || 0) - dt);
        c.ownerGrace = Math.max(0, (c.ownerGrace || 0) - dt);
        if (c.held) {
            const f = c.held;
            if (!f.alive || f.falling || f.carrying !== c) {
                releaseCrate(c);
                c.grounded = false;
                c.vy = 0;
            }
            else {
                c.x = f.x;
                c.z = f.z;
                c.y = f.y + .75;
            }
        }
        if (c.armed) {
            c.fuse -= dt;
            const beat = Math.ceil(Math.max(0, c.fuse) / (c.fuse < .7 ? .12 : .4));
            if (c.fuse < 1.4 && beat !== c.lastBeat) {
                c.lastBeat = beat;
                beep(c.type === "nitro" ? 760 : 620, .025, .012);
            }
            if (c.fuse <= 0) {
                explode(c);
                continue;
            }
        }
        if (c.held)
            continue;
        if (c.grounded && !tileAlive(c.x, c.z)) {
            c.grounded = false;
            c.vy = -1.2;
        }
        if (!c.grounded) {
            const old = { x: c.x, z: c.z, y: c.y }, speed = Math.hypot(c.vx, c.vz);
            c.vy -= 8.5 * (TUNE.gravity / baseSpaceTune.gravity) * dt;
            c.x = clamp(c.x + c.vx * dt, -3.65, 3.65);
            c.z = clamp(c.z + c.vz * dt, -3.65, 3.65);
            c.y += c.vy * dt;
            c.vx *= Math.exp(-.9 * dt);
            c.vz *= Math.exp(-.9 * dt);
            if (c.y <= .22 && old.y >= .22 && tileAlive(c.x, c.z)) {
                c.y = .22;
                c.grounded = true;
                c.vy = 0;
                c.land = .2;
                if (speed < 2) {
                    c.vx = c.vz = 0;
                }
                beep(110, .025, .008);
            }
            if (speed > 2 && !c.impactUsed) {
                let target = null, first = Infinity;
                for (const f of fighters) {
                    if (!f.alive || f.falling || (c.launcher === f.id && c.ownerGrace > 0))
                        continue;
                    const t = crateHitTime(c, old, f);
                    if (t < first) {
                        first = t;
                        target = f;
                    }
                }
                if (target) {
                    const dx = c.x - old.x, dz = c.z - old.z, [nx, nz] = Math.hypot(dx, dz) > .001 ? norm(dx, dz) : facing(target);
                    c.x = old.x + dx * first;
                    c.z = old.z + dz * first;
                    c.y = old.y + (c.y - old.y) * first;
                    c.impactUsed = true;
                    damage(target, c.type === "tnt" ? 14 : 10, nx, nz, 4);
                    beep(155, .06, .02);
                    if (c.type === "tnt") {
                        armCrate(c, .25);
                        c.vx *= .2;
                        c.vz *= .2;
                        c.grounded = false;
                    }
                    else {
                        c.alive = false;
                        releaseCrate(c);
                        burst(c.x, c.z, "#8dc9ff", 8);
                    }
                }
            }
            if (c.y < -3.8) {
                c.alive = false;
                releaseCrate(c);
            }
        }
        if (c.type === "nitro" && c.grounded) {
            for (const f of fighters)
                if (f.alive && !f.falling && Math.hypot(f.x - c.x, f.z - c.z) < .55 && f.y < .4)
                    armCrate(c, .1);
        }
    }
    // Retire spent objects so long rounds do not accumulate hidden work.
    crates = crates.filter(c => c.alive);
}
function checkRound() { if (phase !== "fight")
    return; const a = fighters.filter(f => f.alive && !f.falling); if (a.length <= 1)
    finishRound(a[0]); }
function finishRound(winner, timedOut = false) { if (phase !== "fight")
    return; phase = "over"; phaseT = 2.5; if (winner) {
    wins[winner.id]++;
    say(timedOut ? "Time — " + winner.name + " wins on health!" : winner.name + " wins the round!");
    if (wins[winner.id] >= arcadeWins) {
        phase = "match";
        ;
        ;
        say(winner.name + " wins the match!");
    }
}
else if (!timedOut)
    say("Nobody survived!"); updateHUD(); }
function resetRound() { arcadeMeteorTimer = 0; arcadeMeteors = []; for (const c of crates)
    releaseCrate(c); for (const f of fighters)
    f.carrying = null; clearInput(); flash = 0; resetTiles(); crates = []; particles = []; createFighters(); for (let i = 0; i < Math.min(12, Math.max(6, Math.round(playerCount * 1.15))); i++)
    spawnCrate(true); timeLeft = ROUND_TIME; spawnT = .8; phase = "countdown"; phaseT = 3.2; ; ; say("Move with one thumb while jumping, kicking, or throwing with the other."); updateHUD(); }
function step(dt) {
    if (paused)
        return;
    if (phase === "countdown") {
        phaseT -= dt;
        ;
        if (phaseT <= 0) {
            phase = "fight";
            ;
            say("GO — break the floor and survive.");
            beep(440, .08);
        }
        return;
    }
    if (phase === "over") {
        phaseT -= dt;
        if (phaseT <= 0) {
            round++;
            resetRound();
        }
        return;
    }
    if (phase !== "fight")
        return;
    timeLeft -= dt;
    spaceArenaStep(dt);
    spawnT -= dt;
    const stage = timeLeft < 12 ? .72 : timeLeft < 30 ? 1.05 : timeLeft < 60 ? 1.55 : 2.15;
    if (spawnT <= 0) {
        spawnT = rand(stage, stage * 1.45) * lerpCrowd();
        spawnCrate();
    }
    const p = fighters[0];
    if (arcadeView === "play" && p && p.alive && !p.falling && p.stagger <= 0) {
        const m = Math.hypot(joy.x, joy.z);
        if (m > .05) {
            const n = norm(joy.x, joy.z);
            drive(p, n[0], n[1], dt, clamp(m, .25, 1));
        }
    }
    for (const f of fighters) {
        if (!f.alive)
            continue;
        f.anim += dt;
        f.land = Math.max(0, (f.land || 0) - dt);
        f.kickFx = Math.max(0, (f.kickFx || 0) - dt);
        f.throwFx = Math.max(0, (f.throwFx || 0) - dt);
        f.grabFx = Math.max(0, (f.grabFx || 0) - dt);
        f.kickCd = Math.max(0, f.kickCd - dt);
        f.jumpCd = Math.max(0, f.jumpCd - dt);
        f.stagger = Math.max(0, f.stagger - dt);
        f.boost = Math.max(0, f.boost - dt);
        f.slow = Math.max(0, f.slow - dt);
        if ((f.control === "cpu") && !f.falling && f.stagger <= 0)
            ai(f, dt);
        if (f.falling) {
            f.vy -= TUNE.gravity * dt;
            f.y += f.vy * dt;
            f.x += f.vx * dt;
            f.z += f.vz * dt;
            if (f.y < -3.8)
                f.alive = false;
            continue;
        }
        const max = TUNE.move.max * (f.boost > 0 ? 1.35 : 1) * (f.slow > 0 ? .55 : 1), sp = Math.hypot(f.vx, f.vz);
        if (sp > max) {
            f.vx = f.vx / sp * max;
            f.vz = f.vz / sp * max;
        }
        f.x += f.vx * dt;
        f.z += f.vz * dt;
        const drag = f.grounded ? TUNE.move.drag : TUNE.move.airDrag;
        f.vx *= Math.exp(-drag * dt);
        f.vz *= Math.exp(-drag * dt);
        f.x = clamp(f.x, -3.65, 3.65);
        f.z = clamp(f.z, -3.65, 3.65);
        f.vy -= TUNE.gravity * dt;
        f.y += f.vy * dt;
        if (f.y <= 0) {
            if (!f.grounded && f.vy < -1 && tileAlive(f.x, f.z)) {
                f.land = .22;
                burst(f.x, f.z, "#bdefff", 5);
                beep(100, .035, .01);
            }
            f.y = 0;
            f.vy = 0;
            f.grounded = true;
        }
        else
            f.grounded = false;
        if (f.grounded && !tileAlive(f.x, f.z)) {
            eliminate(f);
        }
    }
    collide();
    updateCrates(dt);
    for (const f of fighters)
        if (f.alive && !f.falling && f.grounded && !tileAlive(f.x, f.z))
            eliminate(f);
    for (const p of particles) {
        p.life -= dt;
        p.vy -= 5 * dt;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.y += p.vy * dt;
    }
    particles = particles.filter(p => p.life > 0);
    flash = Math.max(0, flash - dt * 2.8);
    if (timeLeft <= 0) {
        const a = fighters.filter(f => f.alive && !f.falling).sort((a, b) => b.hp - a.hp);
        finishRound(a[0], true);
    }
    checkRound();
    updateHUD();
}
function lerpCrowd() { return 1 - clamp((playerCount - 4) / 6, 0, 1) * .24; }
function updateHUD(){}
function clearInput(){}
function spaceArenaStep(dt) {
    if (arcadeArena !== "meteor")
        return;
    arcadeMeteorTimer += dt;
    if (arcadeMeteorTimer >= 7) {
        arcadeMeteorTimer = 0;
        const p = safeSpawn();
        arcadeMeteors.push({ ...p, wait: 1.8 });
        say("METEOR WARNING — leave the red ring!");
    }
    for (const m of arcadeMeteors) {
        m.wait -= dt;
        if (m.wait <= 0 && !m.hit) {
            m.hit = true;
            explode({ id: ++crateId, type: "tnt", x: m.x, z: m.z, y: .22, alive: true, held: null });
        }
    }
    arcadeMeteors = arcadeMeteors.filter(m => !m.hit);
}

 
 
 function init(){playerCount=ids.length;arcadeView="online";arcadeWins=1;arcadeArena=options.arena||"orbital";ROUND_TIME=clamp(+options.duration||90,30,180);difficulty=clamp(+options.difficulty||1,.78,1.18);if(arcadeArena==="gravity")TUNE.gravity=4.9;if(arcadeArena==="ion"){TUNE.move.drag=1.35;TUNE.move.accel=10.8}resetRound();}
 function tick(){for(let n=0;n<4;n++){if(phase==="over"||phase==="match")break;for(const f of fighters){f.control=botIds.includes(ids[f.id])?"cpu":"online";if(f.control!=="online")continue;const i=onlineInputs[ids[f.id]]||{};if(canAct(f)){const m=Math.hypot(i.x||0,i.y||0);if(m>.05){const d=norm(i.x||0,i.y||0);drive(f,d[0],d[1],1/120,clamp(m,.25,1))}if(n===0&&fresh(f.id)){if(i.action==="jump")jump(f);if(i.action==="kick")kick(f);if(i.action==="grab")grabThrow(f);}}}step(1/120);now+=1/120;}}
 function packRefs(){const fs=fighters.map(f=>({...f,carrying:f.carrying?.id??null})),cs=crates.map(c=>({...c,held:c.held?.id??null}));return {fighters:fs,crates:cs};}
 function unpackRefs(){for(const c of crates)c.held=c.held===null?null:fighters[c.held];for(const f of fighters)f.carrying=f.carrying===null?null:crates.find(c=>c.id===f.carrying)||null;}
 function result(){const finished=phase==="over"||phase==="match";return {finished,winnerSlots:finished?wins.map((v,i)=>v?i:-1).filter(i=>i>=0):[],slotScores:fighters.map(f=>f.hp),view:{...saveData(),...packRefs()}};}

 function saveData(){return {ROUND_TIME,TUNE,arcadeArena,arcadeWins,arcadeMeteorTimer,arcadeMeteors,playerCount,difficulty,tiles,fighters,crates,particles,phase,phaseT,round,timeLeft,wins,spawnT,powerT,paused,flash,crateId};}
 function save(){for(const id of ids)if(onlineInputs[id])nextPrevious[id]=onlineInputs[id].seq;return {kind:"space",ids,seed,options,now,rng,endAt,botDifficulty,previous:nextPrevious,data:encode({...saveData(),...(typeof packRefs==="function"?packRefs():{})})};}
 if(state){const data=decode(state.data);if(Object.hasOwn(data,"ROUND_TIME")){ROUND_TIME=data.ROUND_TIME;}if(Object.hasOwn(data,"TUNE")){Object.assign(TUNE,data.TUNE);}if(Object.hasOwn(data,"arcadeArena")){arcadeArena=data.arcadeArena;}if(Object.hasOwn(data,"arcadeWins")){arcadeWins=data.arcadeWins;}if(Object.hasOwn(data,"arcadeMeteorTimer")){arcadeMeteorTimer=data.arcadeMeteorTimer;}if(Object.hasOwn(data,"arcadeMeteors")){arcadeMeteors=data.arcadeMeteors;}if(Object.hasOwn(data,"playerCount")){playerCount=data.playerCount;}if(Object.hasOwn(data,"difficulty")){difficulty=data.difficulty;}if(Object.hasOwn(data,"tiles")){tiles=data.tiles;}if(Object.hasOwn(data,"fighters")){fighters=data.fighters;}if(Object.hasOwn(data,"crates")){crates=data.crates;}if(Object.hasOwn(data,"particles")){particles=data.particles;}if(Object.hasOwn(data,"phase")){phase=data.phase;}if(Object.hasOwn(data,"phaseT")){phaseT=data.phaseT;}if(Object.hasOwn(data,"round")){round=data.round;}if(Object.hasOwn(data,"timeLeft")){timeLeft=data.timeLeft;}if(Object.hasOwn(data,"wins")){wins=data.wins;}if(Object.hasOwn(data,"spawnT")){spawnT=data.spawnT;}if(Object.hasOwn(data,"powerT")){powerT=data.powerT;}if(Object.hasOwn(data,"paused")){paused=data.paused;}if(Object.hasOwn(data,"flash")){flash=data.flash;}if(Object.hasOwn(data,"crateId")){crateId=data.crateId;} if(typeof unpackRefs==="function")unpackRefs();}
 else init();
 return {save,tick,result};
}
