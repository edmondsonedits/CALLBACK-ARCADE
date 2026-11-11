/* eslint-disable @typescript-eslint/no-unused-vars -- static source extraction keeps native declarations and neutralizes browser effects. */
/** Generated from royal-ballistix/online-v65.html SHA-256 da1c3327a34ca3869bf7e793fcbc9cd86d1bcbec59d36fe0bf791eb889d54ca3. */
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
 var arcadeBallArena = 'beach';
var arcadeBallView = 'play';
var arcadeBallTime = 0;
var arcadeBallCrowns = 3;
var COLORS = ['#f2c85f', '#ef725f', '#55cbd5', '#9b7be6', '#72d18f', '#f19ac3', '#ff9f55', '#6fa8ff', '#d6df68', '#c68cff'];
var NAMES = ['YOU', 'RUFUS', 'MABEL', 'GREGOR', 'PIP', 'BEA', 'OSWALD', 'TILLY', 'BARNABY', 'WREN'];
var S = { w: 0, h: 0, dpr: 1, cx: 0, cy: 0, size: 0, radius: 0, playerRadius: 0, sector: 0, gateHalf: 0, moveLimit: 0, pad: 0 };
var G = { phase: 'countdown', count: 3.15, round: 1, playerCount: 4, arenaScale: 1.15, wins: [], paused: false, last: performance.now(), spawn: 0, nextSpawn: .7, balls: [], parts: [], rings: [], shake: 0, sound: true, diff: 'normal', launch: null, resultEpoch: 0, resultTimer: null };
var input = { axis: 0, strength: 0, keyAxis: 0, drag: false, pointer: null, mag: false, run: false, pulse: false };
var externalInputs = {};
var externalControlled = {};
var AI = { easy: { speed: .82, react: .18, catch: .55, pulse: .35, aimError: .32 }, normal: { speed: 1, react: .09, catch: .76, pulse: .62, aimError: .18 }, hard: { speed: 1.13, react: .04, catch: .92, pulse: .82, aimError: .10 } };
var AI_PERSONAS = [null, { name: "RUFUS", style: "hunter", risk: .82, hold: .72, targetHuman: .55 }, { name: "MABEL", style: "schemer", risk: .58, hold: 1.15, targetHuman: .34 }, { name: "GREGOR", style: "bully", risk: .72, hold: .88, targetHuman: .72 }, { name: "PIP", style: "sprinter", risk: .78, hold: .68, targetHuman: .40 }, { name: "BEA", style: "guardian", risk: .52, hold: 1.22, targetHuman: .28 }, { name: "OSWALD", style: "sniper", risk: .70, hold: .96, targetHuman: .45 }, { name: "TILLY", style: "chaos", risk: .88, hold: .62, targetHuman: .35 }, { name: "BARNABY", style: "planner", risk: .60, hold: 1.08, targetHuman: .38 }, { name: "WREN", style: "rival", risk: .76, hold: .84, targetHuman: .60 }];
var TUNING = { simulation: { fixedDt: 1 / 120, maxFrame: .05, maxSteps: 6 }, ball: { spawnMin: .34, spawnMax: .42, minSpeed: .30, maxSpeed: 1.05, wallRestitution: .985, paddleRestitution: 1.025, collisionRestitution: .94, maxTravelPerSubstep: .42, stuckSpeed: .09, stuckTime: 1.15 }, paddle: { normalSpeed: .50, runSpeed: .78, aiNormal: .47, aiRun: .72 }, magnet: { overheat: 5, maxHeld: 4, releaseSpeed: .88, fizzleSpeed: .18, aimMax: .72, aimResponse: 10, volleySpread: .10 }, ai: { retargetMin: .35, retargetMax: .72, releaseJitter: .08, weakLifeBias: .85, openLaneBias: .55 }, pulse: { speed: .94, perfectSpeed: 1.12, missCooldown: 2, hitCooldown: .42, perfectCooldown: .22, activeWindow: .18, perfectWindow: .055, perfectCenter: .46 }, readability: { contactFlash: .12, contactRecoil: .005, pulseFeedback: .45, heatWarning: .8, launchTelegraph: .72, trailMin: .52, trailLength: .11, threatTime: .72 }, gate: { criticalLife: 3, hitFlash: .34, criticalPulseHz: 2.4, normalShake: .7, eliminationShake: 1.15, crackMax: 5 }, arena: { gateCoverage: .68, paddleCoverage: .32, minBalls: 3, maxBalls: 6, launcherMin: 4, launcherMax: 7 }, players: { min: 2, max: 10, defaultCount: 4 } };
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(a, b, l, dt) { return lerp(a, b, 1 - Math.exp(-l * dt)); }
function rand(a, b) { return a + Math.random() * (b - a); }
function tone(){}
function say(){}
function refreshArenaGeometry() { S.radius = S.size * .46; S.playerRadius = S.radius - S.size * .055; S.sector = Math.PI * 2 / Math.max(2, G.playerCount); S.gateHalf = S.sector * TUNING.arena.gateCoverage * .5; S.moveLimit = S.playerRadius * S.sector * .25; S.pad = Math.min(S.size * .07, S.playerRadius * S.sector * TUNING.arena.paddleCoverage * .5); }
function startLives() { return G.playerCount <= 4 ? 12 : G.playerCount <= 6 ? 9 : G.playerCount <= 8 ? 7 : 6; }
function makeP(id) { var ml = startLives(); return { id: id, life: ml, maxLife: ml, alive: true, pos: 0, vel: 0, target: 0, think: 0, mag: false, magT: 0, lock: 0, held: [], contactT: 0, impactSide: 0, pulseFeedbackT: 0, pulseCooldownMax: 2, pulseCd: 0, pulseT: 0, pulseAge: 0, lastPulse: 'none', run: false, aim: 0, aimIntent: 0, attackTarget: -1, attackThink: 0, aiState: "POSITION", gateHit: 0, remoteSecondaryPrev: false }; }
var P = [];
function baseAngle(id) { return Math.PI / 2 + id * S.sector; }
function playerAngle(p) { return baseAngle(p.id) - p.pos / Math.max(S.playerRadius, 1); }
function pxy(p) { var a = playerAngle(p); return [S.cx + Math.cos(a) * S.playerRadius, S.cy + Math.sin(a) * S.playerRadius]; }
function inward(p) { var a = playerAngle(p); return [-Math.cos(a), -Math.sin(a)]; }
function tangent(p) { var a = playerAngle(p); return [Math.sin(a), -Math.cos(a)]; }
function normAngle(a) { while (a <= -Math.PI)
    a += Math.PI * 2; while (a > Math.PI)
    a -= Math.PI * 2; return a; }
function sectorOwner(a) { var rel = (a - Math.PI / 2) / S.sector, id = Math.round(rel); id = ((id % P.length) + P.length) % P.length; return id; }
function maxBalls() { return clamp(Math.ceil(P.length * .60), TUNING.arena.minBalls, TUNING.arena.maxBalls); }
function launcherCount() { return clamp(Math.ceil(P.length * .60), TUNING.arena.launcherMin, TUNING.arena.launcherMax); }
function queueBall() { if (G.balls.length >= maxBalls() || G.launch)
    return; G.launch = { launcher: Math.floor(Math.random() * launcherCount()), t: TUNING.readability.launchTelegraph }; tone(130, .07, .012, 'triangle'); }
function addBall(launcherIndex) { if (G.balls.length >= maxBalls())
    return; var pts = cannonPoints(), q = pts[launcherIndex == null ? Math.floor(Math.random() * pts.length) : launcherIndex % pts.length], x = q[0], y = q[1], dx = S.cx - x + rand(-S.size * .09, S.size * .09), dy = S.cy - y + rand(-S.size * .09, S.size * .09), n = Math.hypot(dx, dy) || 1, sp = rand(S.size * TUNING.ball.spawnMin, S.size * TUNING.ball.spawnMax); G.balls.push({ x: x, y: y, vx: dx / n * sp, vy: dy / n * sp, r: S.size * .021, held: null, age: 0, last: -1 }); burst(x, y, '#fff0aa', 8); tone(260); }
function burst(){}
function ring(){}
function startMag(p) { if (!p.alive || p.lock > 0 || p.pulseT > 0)
    return; p.mag = true; p.magT = 0; tone(190); }
function releaseMag(p, fizzle) { if (!p.mag && !p.held.length)
    return; var q = pxy(p), x = q[0], y = q[1], n = inward(p), t = tangent(p), arr = p.held.slice(); p.held = []; for (var i = 0; i < arr.length; i++) {
    var b = arr[i], spread = (i - (arr.length - 1) / 2) * TUNING.magnet.volleySpread + p.aim * TUNING.magnet.aimMax, dx = n[0] + t[0] * spread, dy = n[1] + t[1] * spread, m = Math.hypot(dx, dy) || 1, sp = fizzle ? S.size * TUNING.magnet.fizzleSpeed : S.size * (TUNING.magnet.releaseSpeed + arr.length * .03);
    b.held = null;
    b.x = x + n[0] * S.size * .065;
    b.y = y + n[1] * S.size * .065;
    b.vx = dx / m * sp;
    b.vy = dy / m * sp;
    b.last = p.id;
} if (arr.length) {
    ring(x, y, COLORS[p.id]);
    tone(fizzle ? 110 : 180, .1, .03, fizzle ? 'sawtooth' : 'square');
} if (fizzle) {
    p.lock = 1.4;
    if (p.id === 0)
        say('Magnet overheated — volley dropped.');
}
else if (arr.length > 1 && p.id === 0)
    say('Volley away — ' + arr.length + ' balls!'); p.mag = false; p.magT = 0; }
function pulse(p) { if (!p.alive || p.pulseCd > 0 || p.mag || G.phase !== 'fight')
    return; var q = pxy(p), x = q[0], y = q[1], n = inward(p), t = tangent(p), hit = false, perfect = false; p.pulseT = TUNING.pulse.activeWindow; p.pulseAge = 0; p.lastPulse = 'miss'; for (var i = 0; i < G.balls.length; i++) {
    var b = G.balls[i];
    if (b.held !== null)
        continue;
    var dx = b.x - x, dy = b.y - y, front = dx * n[0] + dy * n[1], side = dx * t[0] + dy * t[1];
    if (front > 0 && front < S.size * .12 && Math.abs(side) < S.pad * .9) {
        var isPerfect = Math.abs(side) <= S.pad * TUNING.pulse.perfectCenter, sp = Math.max(S.size * (isPerfect ? TUNING.pulse.perfectSpeed : TUNING.pulse.speed), Math.hypot(b.vx, b.vy) * (isPerfect ? 1.42 : 1.3));
        b.vx = n[0] * sp + t[0] * side * (isPerfect ? 4.1 : 3);
        b.vy = n[1] * sp + t[1] * side * (isPerfect ? 4.1 : 3);
        b.last = p.id;
        burst(b.x, b.y, isPerfect ? '#ffe77a' : COLORS[p.id], isPerfect ? 22 : 12);
        hit = true;
        perfect = perfect || isPerfect;
    }
} p.lastPulse = perfect ? 'perfect' : hit ? 'hit' : 'miss'; p.pulseFeedbackT = TUNING.readability.pulseFeedback; p.pulseCd = perfect ? TUNING.pulse.perfectCooldown : hit ? TUNING.pulse.hitCooldown : TUNING.pulse.missCooldown; p.pulseCooldownMax = p.pulseCd; ring(x, y, perfect ? '#ffe77a' : COLORS[p.id]); if (perfect) {
    G.shake = Math.max(G.shake, .62);
    tone(620, .06, .035, 'square');
    if (p.id === 0)
        say('PERFECT PULSE — royal counter!');
}
else
    tone(hit ? 430 : 240, .07, .025, 'square'); }
function capture(b, p) { b.held = p.id; b.vx = b.vy = 0; p.held.push(b); burst(b.x, b.y, COLORS[p.id], 5); tone(330); }
function player(dt, p) { var a = input.drag ? input.axis : input.keyAxis, run = input.run || input.strength > .82 || Math.abs(a) > .82, max = run ? S.size * TUNING.paddle.runSpeed : S.size * TUNING.paddle.normalSpeed; p.vel = damp(p.vel, a * max, 18, dt); p.pos = clamp(p.pos + p.vel * dt, -S.moveLimit, S.moveLimit); p.aimIntent = p.mag ? a : 0; p.aim = damp(p.aim, p.aimIntent, TUNING.magnet.aimResponse, dt); if (input.mag && !p.mag && p.lock <= 0)
    startMag(p); if (!input.mag && p.mag)
    releaseMag(p, false); if (input.pulse) {
    input.pulse = false;
    pulse(p);
} }
function incoming(p, b) { if (b.held !== null)
    return null; var q = pxy(p), n = inward(p), t = tangent(p), dx = b.x - q[0], dy = b.y - q[1], toward = -(b.vx * n[0] + b.vy * n[1]), front = dx * n[0] + dy * n[1]; if (toward <= 1 || front < 0)
    return null; var tm = front / toward; if (tm > 2.2)
    return null; return { time: tm, pos: dx * t[0] + dy * t[1] + (b.vx * t[0] + b.vy * t[1]) * tm, b: b }; }
function chooseAttackTarget(p, cfg) { var persona = AI_PERSONAS[p.id] || AI_PERSONAS[1], best = -1, bestScore = -999; for (var i = 0; i < P.length; i++) {
    var o = P[i];
    if (i === p.id || !o.alive)
        continue;
    var score = (o.maxLife - o.life) / Math.max(o.maxLife, 1) * TUNING.ai.weakLifeBias + Math.random() * .18;
    if (i === 0)
        score += persona.targetHuman * .22;
    var oq = pxy(o), pq = pxy(p), dist = Math.hypot(oq[0] - pq[0], oq[1] - pq[1]) / Math.max(S.size, 1);
    score += (1 - clamp(dist, 0, 1.5)) * TUNING.ai.openLaneBias;
    if (score > bestScore) {
        bestScore = score;
        best = i;
    }
} p.attackTarget = best; p.attackThink = rand(TUNING.ai.retargetMin, TUNING.ai.retargetMax); return best; }
function aimAtTarget(p, targetId, cfg) { if (targetId < 0 || !P[targetId] || !P[targetId].alive)
    return 0; var q = pxy(p), oq = pxy(P[targetId]), n = inward(p), t = tangent(p), dx = oq[0] - q[0], dy = oq[1] - q[1], front = dx * n[0] + dy * n[1], side = dx * t[0] + dy * t[1], desired = front > 1 ? clamp(side / front, -TUNING.magnet.aimMax, TUNING.magnet.aimMax) / TUNING.magnet.aimMax : 0; return clamp(desired + rand(-cfg.aimError, cfg.aimError), -1, 1); }
function ai(dt, p) { var cfg = AI[G.diff], persona = AI_PERSONAS[p.id] || AI_PERSONAS[1]; p.think -= dt; p.attackThink -= dt; var best = null; for (var i = 0; i < G.balls.length; i++) {
    var z = incoming(p, G.balls[i]);
    if (z && Math.abs(z.pos) < S.moveLimit + S.pad * 1.2 && (!best || z.time < best.time))
        best = z;
} if (p.mag && p.held.length) {
    p.aiState = "ATTACK";
    if (p.attackThink <= 0 || p.attackTarget < 0 || !P[p.attackTarget] || !P[p.attackTarget].alive)
        chooseAttackTarget(p, cfg);
    p.aimIntent = aimAtTarget(p, p.attackTarget, cfg);
    p.aim = damp(p.aim, p.aimIntent, TUNING.magnet.aimResponse * .7, dt);
    var releaseAt = persona.hold + (p.held.length - 1) * -.12;
    if (p.magT > releaseAt || p.held.length >= 3 || p.magT > 3.6)
        releaseMag(p, false);
}
else {
    p.aimIntent = 0;
    p.aim = damp(p.aim, 0, 6, dt);
    if (p.think <= 0) {
        p.think = rand(cfg.react, cfg.react + .1);
        if (best) {
            p.aiState = best.time < .45 ? "DEFEND" : "INTERCEPT";
            p.target = clamp(best.pos, -S.moveLimit, S.moveLimit);
            p.run = Math.abs(p.target - p.pos) > S.size * .09;
            if (best.time < .52 && Math.abs(best.pos - p.pos) < S.pad * .88 && p.lock <= 0 && Math.random() < cfg.catch * persona.risk && !p.mag) {
                startMag(p);
                chooseAttackTarget(p, cfg);
            }
            else if (best.time < .17 && Math.abs(best.pos - p.pos) < S.pad && p.pulseCd <= 0 && !p.mag && Math.random() < cfg.pulse)
                pulse(p);
        }
        else {
            p.aiState = "POSITION";
            p.target = damp(p.target, 0, .8, .1);
            p.run = false;
        }
    }
} var d = clamp((p.target - p.pos) / Math.max(S.size * .09, 1), -1, 1), max = (p.run ? S.size * TUNING.paddle.aiRun : S.size * TUNING.paddle.aiNormal) * cfg.speed; p.vel = damp(p.vel, d * max, 11, dt); p.pos = clamp(p.pos + p.vel * dt, -S.moveLimit, S.moveLimit); }
function externalPlayer(dt, p) { var ri = externalInputs[p.id] || {}, a = clamp(Number(ri.moveX) || 0, -1, 1), run = !!ri.run || Math.abs(a) > .82, max = run ? S.size * TUNING.paddle.runSpeed : S.size * TUNING.paddle.normalSpeed; p.vel = damp(p.vel, a * max, 18, dt); p.pos = clamp(p.pos + p.vel * dt, -S.moveLimit, S.moveLimit); p.aimIntent = p.mag ? a : 0; p.aim = damp(p.aim, p.aimIntent, TUNING.magnet.aimResponse, dt); var mag = !!ri.primaryAction; if (mag && !p.mag && p.lock <= 0)
    startMag(p); if (!mag && p.mag)
    releaseMag(p, false); var sec = !!ri.secondaryAction; if (sec && !p.remoteSecondaryPrev)
    pulse(p); p.remoteSecondaryPrev = sec; }
function paddles(dt) { for (var i = 0; i < P.length; i++) {
    var p = P[i];
    p.contactT = Math.max(0, p.contactT - dt);
    p.pulseFeedbackT = Math.max(0, p.pulseFeedbackT - dt);
    p.pulseCd = Math.max(0, p.pulseCd - dt);
    if (p.pulseT > 0)
        p.pulseAge += dt;
    p.pulseT = Math.max(0, p.pulseT - dt);
    p.lock = Math.max(0, p.lock - dt);
    p.gateHit = Math.max(0, p.gateHit - dt);
    if (!p.alive)
        continue;
    if (externalControlled[p.id])
        externalPlayer(dt, p);
    else if (p.id === 0 && arcadeBallView === 'play')
        player(dt, p);
    else
        ai(dt, p);
    if (p.mag) {
        p.magT += dt;
        if (p.magT >= TUNING.magnet.overheat)
            releaseMag(p, true);
    }
    var q = pxy(p), n = inward(p), t = tangent(p);
    for (var j = 0; j < p.held.length; j++) {
        var b = p.held[j], off = (j - (p.held.length - 1) / 2) * S.size * .032;
        b.x = q[0] + n[0] * S.size * .065 + t[0] * off;
        b.y = q[1] + n[1] * S.size * .065 + t[1] * off;
    }
} }
function hitPaddle(b, p) { if (!p.alive || b.held !== null)
    return false; var q = pxy(p), n = inward(p), t = tangent(p), dx = b.x - q[0], dy = b.y - q[1], side = dx * t[0] + dy * t[1], front = dx * n[0] + dy * n[1], toward = -(b.vx * n[0] + b.vy * n[1]); if (Math.abs(side) > S.pad + b.r || Math.abs(front) > S.size * .032 + b.r || toward <= 0)
    return false; if (p.mag && p.held.length < TUNING.magnet.maxHeld && front > 0 && front < S.size * .11) {
    capture(b, p);
    return true;
} var sp = Math.max(S.size * TUNING.ball.minSpeed, Math.hypot(b.vx, b.vy) * TUNING.ball.paddleRestitution), kick = side / (S.pad + b.r) * S.size * .16 + p.vel * .22; if (p.pulseT > 0) {
    var perfect = p.pulseAge <= TUNING.pulse.perfectWindow && Math.abs(side) <= S.pad * TUNING.pulse.perfectCenter;
    sp = Math.max(sp, S.size * (perfect ? TUNING.pulse.perfectSpeed : TUNING.pulse.speed));
    p.pulseT = 0;
    p.lastPulse = perfect ? 'perfect' : 'hit';
    p.pulseCd = perfect ? TUNING.pulse.perfectCooldown : TUNING.pulse.hitCooldown;
    p.pulseCooldownMax = p.pulseCd;
    p.pulseFeedbackT = TUNING.readability.pulseFeedback;
    burst(b.x, b.y, perfect ? '#ffe77a' : COLORS[p.id], perfect ? 22 : 12);
    ring(q[0], q[1], perfect ? '#ffe77a' : COLORS[p.id]);
    if (perfect) {
        G.shake = Math.max(G.shake, .62);
        tone(620, .06, .035, 'square');
        if (p.id === 0)
            say('PERFECT PULSE — royal counter!');
    }
} b.vx = n[0] * sp + t[0] * kick; b.vy = n[1] * sp + t[1] * kick; b.x = q[0] + n[0] * (S.size * .032 + b.r + 2) + t[0] * side; b.y = q[1] + n[1] * (S.size * .032 + b.r + 2) + t[1] * side; b.last = p.id; p.contactT = TUNING.readability.contactFlash; p.impactSide = side; tone(155 + Math.min(90, Math.abs(side) / Math.max(S.pad, 1) * 90), .045, .018); return true; }
function scoreGoal(id, b) { var p = P[id]; if (G.phase !== 'fight' || !p || !p.alive || G.balls.indexOf(b) < 0)
    return; p.life = Math.max(0, p.life - 1); burst(b.x, b.y, COLORS[id], 18); ring(b.x, b.y, '#ff7461'); ; G.shake = p.life <= 1 ? TUNING.gate.eliminationShake : TUNING.gate.normalShake; tone(p.life <= 3 ? 72 : 90, p.life <= 3 ? .22 : .16, p.life <= 3 ? .05 : .035, 'square'); var bi = G.balls.indexOf(b); if (bi >= 0)
    G.balls.splice(bi, 1); say(id === 0 ? 'Your gate is hit — ' + p.life + ' remaining.' : NAMES[id] + "'s gate drops to " + p.life + '.'); if (p.life <= 0) {
    p.alive = false;
    releaseMag(p, true);
    say(id === 0 ? 'Your gate is sealed. Survive the round as a spectator.' : NAMES[id] + ' is washed out — that sector is now a wall.');
    endCheck();
} ; }
function endCheck(){if(G.phase!=="fight")return;const alive=P.filter(p=>p.alive);if(alive.length>1)return;G.phase="end";if(alive[0])G.wins[alive[0].id]++;}
function boundaries(b) { var dx = b.x - S.cx, dy = b.y - S.cy, dist = Math.hypot(dx, dy) || .001; if (dist < S.radius - b.r)
    return false; var nx = dx / dist, ny = dy / dist, a = Math.atan2(dy, dx), id = sectorOwner(a), delta = Math.abs(normAngle(a - baseAngle(id))), open = delta <= S.gateHalf && P[id] && P[id].alive; if (open && dist > S.radius + b.r * .25) {
    scoreGoal(id, b);
    return true;
} if (open)
    return false; b.x = S.cx + nx * (S.radius - b.r); b.y = S.cy + ny * (S.radius - b.r); var vn = b.vx * nx + b.vy * ny; if (vn > 0) {
    b.vx -= (1 + TUNING.ball.wallRestitution) * vn * nx;
    b.vy -= (1 + TUNING.ball.wallRestitution) * vn * ny;
} return false; }
function clampBallSpeed(b) { var s = Math.hypot(b.vx, b.vy), max = S.size * TUNING.ball.maxSpeed; if (s > max) {
    b.vx = b.vx / s * max;
    b.vy = b.vy / s * max;
} }
function balls(dt) { for (var i = G.balls.length - 1; i >= 0; i--) {
    if (G.phase !== 'fight')
        return;
    var b = G.balls[i];
    if (b.held !== null)
        continue;
    b.age += dt;
    var speed = Math.hypot(b.vx, b.vy), maxTravel = Math.max(2, b.r * TUNING.ball.maxTravelPerSubstep), subs = Math.max(1, Math.ceil(speed * dt / maxTravel)), sd = dt / subs, removed = false;
    for (var s = 0; s < subs && !removed; s++) {
        b.x += b.vx * sd;
        b.y += b.vy * sd;
        for (var p = 0; p < P.length; p++)
            if (hitPaddle(b, P[p]))
                break;
        if (boundaries(b)) {
            removed = true;
            break;
        }
        for (var j = i - 1; j >= 0; j--) {
            var o = G.balls[j];
            if (o.held !== null)
                continue;
            var dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy) || 1, min = b.r + o.r;
            if (d < min) {
                var nx = dx / d, ny = dy / d, ov = min - d;
                b.x += nx * ov * .5;
                b.y += ny * ov * .5;
                o.x -= nx * ov * .5;
                o.y -= ny * ov * .5;
                var rv = (b.vx - o.vx) * nx + (b.vy - o.vy) * ny;
                if (rv < 0) {
                    var imp = -rv * TUNING.ball.collisionRestitution;
                    b.vx += nx * imp;
                    b.vy += ny * imp;
                    o.vx -= nx * imp;
                    o.vy -= ny * imp;
                    clampBallSpeed(o);
                }
            }
        }
        clampBallSpeed(b);
    }
} }
function step(dt) { if (G.phase === 'fight') {
    G.spawn += dt;
    if (G.launch) {
        G.launch.t -= dt;
        if (G.launch.t <= 0) {
            addBall(G.launch.launcher);
            G.launch = null;
            G.spawn = 0;
            G.nextSpawn = G.balls.length ? rand(2.7, 4.2) : .8;
        }
    }
    else if (G.spawn >= G.nextSpawn && G.balls.length < maxBalls()) {
        queueBall();
    }
    arcadeBallPhysics(dt);
    paddles(dt);
    balls(dt);
    arcadeBallBumpers();
} for (var i = 0; i < G.parts.length; i++) {
    var p = G.parts[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= .985;
    p.vy *= .985;
} G.parts = G.parts.filter(function (p) { return p.life > 0; }); for (var j = 0; j < G.rings.length; j++) {
    G.rings[j].life -= dt;
    G.rings[j].r += S.size * .5 * dt;
} G.rings = G.rings.filter(function (r) { return r.life > 0; }); G.shake = damp(G.shake, 0, 5, dt); }
function phase(dt){if(G.phase==="countdown"){G.count-=dt;if(G.count<=0)G.phase="fight";}}
function cannonPoints() { var pts = [], count = launcherCount(), r = S.radius * .76; for (var i = 0; i < count; i++) {
    var a = -Math.PI / 2 + (i + .5) * Math.PI * 2 / count;
    pts.push([S.cx + Math.cos(a) * r, S.cy + Math.sin(a) * r]);
} return pts; }
;
function arcadeBallPhysics(dt) { arcadeBallTime += dt; if (arcadeBallArena !== 'current')
    return; for (var b of G.balls) {
    if (b.held !== null)
        continue;
    var dx = b.x - S.cx, dy = b.y - S.cy, d = Math.max(1, Math.hypot(dx, dy)), force = S.size * .11;
    b.vx -= dy / d * force * dt;
    b.vy += dx / d * force * dt;
} }
function arcadeBallBumpers() { if (arcadeBallArena !== 'bumpers')
    return; for (var b of G.balls) {
    if (b.held !== null)
        continue;
    for (var side of [-1, 1]) {
        var x = S.cx + side * S.radius * .33, y = S.cy, dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy), r = S.size * .042 + b.r;
        if (d >= r)
            continue;
        var nx = d > .001 ? dx / d : 1, ny = d > .001 ? dy / d : 0, vn = b.vx * nx + b.vy * ny;
        b.x = x + nx * (r + .05);
        b.y = y + ny * (r + .05);
        if (vn < 0) {
            b.vx -= 2 * vn * nx;
            b.vy -= 2 * vn * ny;
        }
    }
} }
 
 
 function init(){arcadeBallView="online";G.playerCount=ids.length;G.wins=ids.map(()=>0);G.sound=false;G.arenaScale=clamp(+options.size||1.1,.85,1.3);G.diff=["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal";arcadeBallArena=options.arena||"beach";arcadeBallCrowns=1;const speed=clamp(+options.speed||1,.75,1.2);TUNING.ball.minSpeed*=speed;TUNING.ball.maxSpeed*=speed;S={...S,w:1280,h:720,cx:640,cy:298.8,size:Math.min(1280*.99,720*.74*G.arenaScale,720*.76)};refreshArenaGeometry();P=ids.map((_,i)=>makeP(i));}
 function tick(){for(let i=0;i<ids.length;i++){externalControlled[i]=!botIds.includes(ids[i]);const v=onlineInputs[ids[i]]||{};externalInputs[i]={moveX:v.x||0,primaryAction:v.action==="magnet"||v.heldActions?.includes("magnet"),secondaryAction:v.action==="pulse"&&fresh(i),run:Math.abs(v.x||0)>.82};}for(let n=0;n<4;n++){if(G.phase==="end")break;phase(1/120);step(1/120);now+=1/120;}}
 function packRefs(){return {P:P.map(p=>({...p,held:p.held.map(b=>G.balls.indexOf(b))}))};}
 function unpackRefs(){for(const p of P)p.held=p.held.map(i=>G.balls[i]).filter(Boolean);}
 function result(){const finished=G.phase==="end";return {finished,winnerSlots:finished?G.wins.flatMap((w,i)=>w?[i]:[]):[],slotScores:P.map(p=>p.life),view:{...saveData(),...packRefs()}};}

 function saveData(){return {TUNING,arcadeBallArena,arcadeBallTime,arcadeBallCrowns,S,G,P};}
 function save(){for(const id of ids)if(onlineInputs[id])nextPrevious[id]=onlineInputs[id].seq;return {kind:"ball",ids,seed,options,now,rng,endAt,botDifficulty,previous:nextPrevious,data:encode({...saveData(),...(typeof packRefs==="function"?packRefs():{})})};}
 if(state){const data=decode(state.data);if(Object.hasOwn(data,"TUNING")){for(const key of Object.keys(data.TUNING))Object.assign(TUNING[key],data.TUNING[key]);}if(Object.hasOwn(data,"arcadeBallArena")){arcadeBallArena=data.arcadeBallArena;}if(Object.hasOwn(data,"arcadeBallTime")){arcadeBallTime=data.arcadeBallTime;}if(Object.hasOwn(data,"arcadeBallCrowns")){arcadeBallCrowns=data.arcadeBallCrowns;}if(Object.hasOwn(data,"S")){S=data.S;}if(Object.hasOwn(data,"G")){G=data.G;}if(Object.hasOwn(data,"P")){P=data.P;} if(typeof unpackRefs==="function")unpackRefs();}
 else init();
 return {save,tick,result};
}
