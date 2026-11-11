/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unused-expressions -- static source extraction keeps native declarations and neutralizes browser effects. */
/** Generated from royal-twisted/online-v65.html SHA-256 ebbcd72f681eab9cafb62e97a0377a4ca65313f9aa11b208b2059f766d78135a. */
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
 const PLAYER_T = .115;
const HELIX_TURNS = 2.18;
const HELIX_RADIUS = 4.55;
const HELIX_RISE = 7.9;
const HELIX_BASE = .55;
const HELIX_START = -PLAYER_T * HELIX_TURNS * Math.PI * 2;
const TUNING = Object.freeze({
    rounds: { maxLives: 7, bestOf: 3 },
    simulation: { fixedDt: 1 / 120, maxSubsteps: 7 },
    speed: { start: .083, accel: .00155, max: .185 },
    jump: { velocity: 5.15, gravity: 13.2, safeHeight: .40, inputBuffer: .13 },
    camera: { back: 8.15, side: 4.15, height: 3.0, lookAhead: 2.75, targetHeight: .78, follow: 8.8, baseFov: 46, portraitFov: 57, shakeX: .06, shakeY: .04, spreadFov: 9.0 },
    hit: { setbackT: .045, minTrackT: .028, recoverSpeed: .012, recoverDelay: .30 },
    hazards: { spawnT: .965, collisionWindow: .014, warnDistance: .16, cueEta: 1.05,
        transition: { "low>low": .90, "low>high": .90, "high>low": .58, "high>high": .48 } },
    pacing: { earlyEnd: 16, midEnd: 38, earlyCooldown: [1.42, 1.72], midCooldown: [1.08, 1.32], lateCooldown: [.90, 1.12] }
});
let MAX_LIVES = TUNING.rounds.maxLives;
const FIXED_DT = TUNING.simulation.fixedDt;
let arcadeTwistedView = "play";
let arcadeTwistedArena = "spiral";
const NAMES = ["YOU", "RUFUS", "MABEL", "GREGOR", "TILLY", "BRAM", "NELL", "OSRIC", "PIP", "AGNES"];
const AI = {
    easy: { reaction: .38, mistake: .17, duckHold: .48 },
    normal: { reaction: .31, mistake: .085, duckHold: .41 },
    hard: { reaction: .25, mistake: .035, duckHold: .35 }
};
let camera;
let fighters = [];
let hazards = [];
let playerCount=10;
let round = 1;
let roundWins = 0;
let phase = "countdown";
let phaseTimer = 3.3;
let roundTime = 0;
let paused = false;
let nextSpawn = 1.35;
let hazardId = 0;
let globalScore = 0;
let bestScore = 0;
let cameraShake = 0;
let patternQueue = [];
let activePattern = "single";
let lastSpawnType = null;
let choreographyStats = { spawned: 0, clamped: 0, minGap: 99, lastGap: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const currentSpeed = () => clamp(TUNING.speed.start + roundTime * TUNING.speed.accel, TUNING.speed.start, TUNING.speed.max);
function say(){}
function haptic(){}
function helixPoint(t) {
    const a = HELIX_START + t * HELIX_TURNS * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * HELIX_RADIUS, HELIX_BASE + t * HELIX_RISE, Math.sin(a) * HELIX_RADIUS);
}
function helixBasis(t) {
    const a = HELIX_START + t * HELIX_TURNS * Math.PI * 2;
    const right = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).normalize();
    const tangent = new THREE.Vector3(-Math.sin(a) * HELIX_RADIUS * HELIX_TURNS * Math.PI * 2, HELIX_RISE, Math.cos(a) * HELIX_RADIUS * HELIX_TURNS * Math.PI * 2).normalize();
    return { right, tangent, angle: a };
}
function buildDummy(){}
function makeLaneOffsets(count) {
    const spacing = .61, raw = [];
    for (let i = 0; i < count; i++)
        raw.push((i - (count - 1) / 2) * spacing);
    // Put P1 close to screen centre, then alternate outward so added players grow symmetrically.
    raw.sort((a, b) => Math.abs(a) - Math.abs(b) || (a - b));
    return raw;
}
function createFighters() {
    fighters.forEach(f => false(false));
    fighters = [];
    const laneOffsets = makeLaneOffsets(playerCount);
    const p = helixPoint(PLAYER_T), b = helixBasis(PLAYER_T);
    for (let i = 0; i < playerCount; i++) {
        ;
        if (playerCount >= 8 && i > 0) {
            ;
            ;
        }
        ;
        fighters.push({ id: i, player: i === 0, name: NAMES[i] || `P${i + 1}`, controller: i === 0 ? "local" : "ai", lane: laneOffsets[i], trackT: PLAYER_T, base: p.clone().addScaledVector(b.right, laneOffsets[i]), lives: MAX_LIVES, score: 0, roundWins: 0, alive: true, jumpY: 0, vy: 0, duck: false, duckTimer: 0, hitTimer: 0, recoverDelay: 0, flash: 0, ragdoll: 0, wobble: Math.random() * 6.28, aiHazard: -1, eliminated: false, fall: new THREE.Vector3(), offset: new THREE.Vector3(), tilt: 0, input: { duckHeld: false, jumpBuffer: 0 }, gamepadPrevJump: false, gamepadPrevDuck: false });
    }
}
function resetRound() {
    hazards.forEach(h => false(h.group));
    hazards = [];
    roundTime = 0;
    nextSpawn = 1.35;
    phase = "countdown";
    phaseTimer = 3.3;
    hazardId = 0;
    patternQueue = [];
    activePattern = "single";
    lastSpawnType = null;
    choreographyStats = { spawned: 0, clamped: 0, minGap: 99, lastGap: 0 };
    ;
    ;
    ;
    const p = helixPoint(PLAYER_T), b = helixBasis(PLAYER_T), lanes = makeLaneOffsets(playerCount);
    fighters.forEach((f, i) => { f.trackT = PLAYER_T; f.base.copy(p).addScaledVector(b.right, lanes[i]); f.lane = lanes[i]; f.lives = MAX_LIVES; f.score = 0; f.alive = true; f.jumpY = 0; f.vy = 0; f.duck = false; f.duckTimer = 0; f.resumeDuckTimer = 0; f.hitTimer = 0; f.recoverDelay = 0; f.flash = 0; f.ragdoll = 0; f.aiHazard = -1; f.aiPlan = null; f.eliminated = false; f.offset.set(0, 0, 0); f.fall.set(0, 0, 0); f.tilt = 0; f.input.duckSources?.clear(); f.input.duckHeld = false; f.input.jumpBuffer = 0; f.gamepadPrevJump = false; f.gamepadPrevDuck = false; ; });
    ;
    ;
    say(`${playerCount} contestants. Jump cyan. Duck coral. Seven mistakes and the tower keeps you.`);
    updateHUD();
}
function createHazard(type,t=.965){const h={id:++hazardId,type,t,checked:new Set(),warned:false};hazards.push(h);return h}
function positionHazard(){}
function transitionFloor(from, to) { return TUNING.hazards.transition[`${from}>${to}`] ?? .90; }
function pickPattern() {
    if (arcadeTwistedArena === "clockwork" && roundTime >= 10) {
        activePattern = "clockwork-switch";
        return [{ type: "high", gap: .68 }, { type: "low", gap: 1.06 }, { type: "high", gap: null }];
    }
    if (arcadeTwistedArena === "foundry" && roundTime >= 10) {
        activePattern = "foundry-duck-rush";
        return [{ type: "high", gap: .56 }, { type: "high", gap: .56 }, { type: "low", gap: null }];
    }
    const r = Math.random();
    if (roundTime < TUNING.pacing.earlyEnd) {
        activePattern = "single";
        return [{ type: Math.random() < .5 ? "low" : "high", gap: null }];
    }
    if (roundTime < TUNING.pacing.midEnd) {
        if (r < .42) {
            activePattern = "single";
            return [{ type: Math.random() < .5 ? "low" : "high", gap: null }];
        }
        if (r < .62) {
            activePattern = "duck-pair";
            return [{ type: "high", gap: .56 }, { type: "high", gap: null }];
        }
        if (r < .80) {
            activePattern = "rise-switch";
            return [{ type: "high", gap: .64 }, { type: "low", gap: null }];
        }
        activePattern = "fall-switch";
        return [{ type: "low", gap: .96 }, { type: "high", gap: null }];
    }
    if (r < .18) {
        activePattern = "single";
        return [{ type: Math.random() < .5 ? "low" : "high", gap: null }];
    }
    if (r < .38) {
        activePattern = "duck-rush";
        return [{ type: "high", gap: .50 }, { type: "high", gap: .50 }, { type: "high", gap: null }];
    }
    if (r < .58) {
        activePattern = "jump-pair";
        return [{ type: "low", gap: .92 }, { type: "low", gap: null }];
    }
    if (r < .79) {
        activePattern = "down-up";
        return [{ type: "high", gap: .60 }, { type: "low", gap: null }];
    }
    activePattern = "up-down-up";
    return [{ type: "low", gap: .92 }, { type: "high", gap: .60 }, { type: "low", gap: null }];
}
function betweenPatternCooldown() {
    const range = roundTime < TUNING.pacing.earlyEnd ? TUNING.pacing.earlyCooldown : roundTime < TUNING.pacing.midEnd ? TUNING.pacing.midCooldown : TUNING.pacing.lateCooldown;
    return rand(range[0], range[1]);
}
// Predict travel under the existing acceleration and speed cap, including fastest recovery.
// Using the farthest setback gives the smallest gap after acceleration compresses a pair.
function hazardTravelTime(distance, extraSpeed = 0) {
    if (distance <= 0)
        return 0;
    const v = currentSpeed() + extraSpeed, a = TUNING.speed.accel, cap = TUNING.speed.max + extraSpeed;
    const toCap = Math.max(0, (cap - v) / a), beforeCap = v * toCap + .5 * a * toCap * toCap;
    return distance <= beforeCap ? 2 * distance / (v + Math.sqrt(v * v + 2 * a * distance)) : toCap + (distance - beforeCap) / cap;
}
function arrivalGap(previous, nextT = TUNING.hazards.spawnT) {
    const origin = TUNING.hit.minTrackT + TUNING.hazards.collisionWindow, extra = TUNING.hit.recoverSpeed;
    return hazardTravelTime(nextT - origin, extra) - hazardTravelTime(previous.t - origin, extra);
}
function spawnPattern() {
    if (patternQueue.length === 0)
        patternQueue = pickPattern();
    const candidate = patternQueue[0], previous = hazards[hazards.length - 1];
    if (previous && arrivalGap(previous) < transitionFloor(previous.type, candidate.type) + FIXED_DT) {
        nextSpawn = FIXED_DT;
        return;
    }
    const step = patternQueue.shift();
    createHazard(step.type, TUNING.hazards.spawnT);
    choreographyStats.spawned++;
    let gap;
    if (patternQueue.length) {
        const nextType = patternQueue[0].type, floor = transitionFloor(step.type, nextType);
        gap = Math.max(step.gap ?? floor, floor);
        if ((step.gap ?? floor) < floor)
            choreographyStats.clamped++;
    }
    else
        gap = betweenPatternCooldown();
    choreographyStats.lastGap = gap;
    choreographyStats.minGap = Math.min(choreographyStats.minGap, gap);
    lastSpawnType = step.type;
    nextSpawn = gap;
}
function tone(){}
function sfxJump(){}
function sfxDuck(){}
function sfxClear(){}
function sfxHit(){}
function sfxOut(){}
function sfxWin(){}
function triggerFlash(){}
function spawnParticles(){}
function impactRing(){}
// Grounded duck takes priority; a jump edge may wait up to 130ms for release/landing.
function canAct(f) { return !!f && f.alive && phase === "fight" && !paused; }
function doJump(f) {
    if (!canAct(f) || f.jumpY !== 0 || f.vy !== 0 || f.input.duckHeld)
        return false;
    f.duck = false;
    f.vy = TUNING.jump.velocity;
    f.jumpY = .01;
    f.input.jumpBuffer = 0;
    if (f.player) {
        ;
        ;
        sfxJump();
        haptic(16);
    }
    return true;
}
function requestJump(f) { if (!canAct(f))
    return false; if (doJump(f))
    return true; f.input.jumpBuffer = TUNING.jump.inputBuffer; return true; }
function updateDuckPosture(f) {
    const was = f.duck;
    f.duck = f.input.duckHeld && f.jumpY === 0 && f.vy === 0;
    if (f.player) {
        ;
        if (f.duck && !was) {
            sfxDuck();
            haptic(10);
        }
    }
}
function setDuck(f, on, source = "direct") {
    if (!f || !f.alive || (on && !canAct(f)))
        return false;
    const sources = f.input.duckSources ??= new Set();
    on ? sources.add(source) : sources.delete(source);
    f.input.duckHeld = sources.size > 0;
    updateDuckPosture(f);
    return true;
}
function hitFighter(f, h, deferRoundEnd = false) {
    if (!f.alive || h.checked.has(f.id))
        return;
    h.checked.add(f.id);
    f.lives--;
    f.hitTimer = .58;
    f.recoverDelay = TUNING.hit.recoverDelay;
    f.flash = .22;
    f.ragdoll = 1.15;
    f.trackT = Math.max(TUNING.hit.minTrackT, f.trackT - TUNING.hit.setbackT);
    f.vy = 3.25;
    f.jumpY = Math.max(f.jumpY, .03);
    f.duck = false;
    f.input.jumpBuffer = 0;
    const hb = helixBasis(f.trackT), hp = helixPoint(f.trackT);
    f.base.copy(hp).addScaledVector(hb.right, f.lane);
    if (f.player)
        cameraShake = Math.max(cameraShake, .62);
    const pos = f.base.clone().add(f.offset).add(new THREE.Vector3(0, 1.0, 0));
    spawnParticles(pos, h.type === "low" ? 0x56c5dc : 0xe56f69, 14, 1.25);
    impactRing(pos, h.type === "low" ? 0x56c5dc : 0xe56f69);
    if (f.player)
        sfxHit();
    if (f.player) {
        triggerFlash();
        haptic(70);
        say(`${h.type === "low" ? "Low rod" : "High rod"} caught you — knocked back — keep reading the next rod. ${f.lives} strike${f.lives === 1 ? "" : "s"} left.`);
    }
    if (f.lives <= 0)
        eliminate(f, deferRoundEnd);
}
function clearHazard(f, h) { if (h.checked.has(f.id) || !f.alive)
    return; h.checked.add(f.id); f.score++; if (f.player) {
    globalScore++;
    bestScore = Math.max(bestScore, globalScore);
    sfxClear(h.type);
} }
function eliminate(f, deferRoundEnd = false) {
    if (!f.alive)
        return;
    f.alive = false;
    f.eliminated = true;
    f.duck = false;
    const b = helixBasis(f.trackT);
    f.fall.copy(b.right).multiplyScalar(f.lane > 0 ? 2.7 : -2.7);
    f.fall.z += rand(-1.0, 1.2);
    f.fall.y = 3.4;
    f.tilt = rand(-2.2, 2.2);
    sfxOut();
    if (f.player) {
        say("You are out. The surviving dummies keep running.");
        haptic(120);
    }
    else
        say(`${f.name} has been donated to the moat.`);
    if (!deferRoundEnd)
        checkRoundEnd();
}
let lastRoundWinner = null;
function checkRoundEnd() {
    if (phase !== "fight")
        return;
    const alive = fighters.filter(f => f.alive);
    if (alive.length <= 1) {
        phase = "roundover";
        phaseTimer = 2.4;
        const winner = alive[0];
        lastRoundWinner = winner || null;
        if (winner) {
            winner.roundWins++;
            if (winner.player) {
                roundWins = winner.roundWins;
                sfxWin();
                say("Round won — the Spiral Keep failed to remove you.");
            }
            else
                say(`${winner.name} wins the round.`);
        }
        else
            say("Everyone fell. The tower wins, which feels unfair.");
        ;
        ;
    }
}
function finishOrNext() {
    if (phase !== "roundover")
        return;
    const maxWins = Math.max(0, ...fighters.map(f => f.roundWins)), leaders = fighters.filter(f => f.roundWins === maxWins);
    const clinched = lastRoundWinner && lastRoundWinner.roundWins >= 2;
    const regulationDone = round >= TUNING.rounds.bestOf;
    if (clinched || (regulationDone && leaders.length === 1)) {
        const champ = clinched ? lastRoundWinner : leaders[0];
        phase = "matchover";
        ;
        ;
        say(champ?.player ? "Match won — Spiral Keep bows to the crown." : `${champ?.name || "A contestant"} takes the crown.`);
        updateHUD();
        return;
    }
    round++;
    if (regulationDone && leaders.length > 1)
        say("The crown is tied — sudden-death round!");
    resetRound();
}
function aiUpdate(f, dt) {
    if (f.controller !== "ai" || !f.alive)
        return;
    if (f.duckTimer > 0) {
        f.duckTimer -= dt;
        if (f.duckTimer <= 0)
            setDuck(f, false, "ai");
    }
    let h = null, best = 99;
    for (const x of hazards) {
        if (x.checked.has(f.id) || x.t < f.trackT - .03)
            continue;
        const d = x.t - f.trackT;
        if (d < best) {
            best = d;
            h = x;
        }
    }
    if (!h)
        return;
    const cfg = AI[botDifficulty];
    // Sample one imperfect plan per rod. Bots use the same buffer and posture rules as humans.
    if (f.aiPlan?.id !== h.id)
        f.aiPlan = { id: h.id, reaction: cfg.reaction + rand(-.035, .045), mistake: Math.random() < cfg.mistake, wrongAction: Math.random() < .55 };
    const closingSpeed = currentSpeed() + (f.recoverDelay <= 0 && f.trackT < PLAYER_T ? TUNING.hit.recoverSpeed : 0);
    const eta = (best - TUNING.hazards.collisionWindow) / closingSpeed;
    if (f.aiHazard === h.id || eta >= f.aiPlan.reaction)
        return;
    f.aiHazard = h.id;
    if (f.aiPlan.mistake && !f.aiPlan.wrongAction)
        return;
    const jump = f.aiPlan.mistake ? h.type !== "low" : h.type === "low";
    if (jump) {
        setDuck(f, false, "ai");
        requestJump(f);
    }
    else {
        setDuck(f, true, "ai");
        f.duckTimer = cfg.duckHold;
    }
}
function testHazard(h) {
    for (const f of fighters) {
        if (!f.alive || h.checked.has(f.id))
            continue;
        if (Math.abs(h.t - f.trackT) > TUNING.hazards.collisionWindow)
            continue;
        const safe = h.type === "low" ? f.jumpY > TUNING.jump.safeHeight : f.duck && f.jumpY <= .001;
        safe ? clearHazard(f, h) : hitFighter(f, h, true);
    }
    // Resolve the whole rod before awarding a survivor (including the existing all-out draw).
    checkRoundEnd();
}
function fixedUpdate(dt) {
    roundTime += dt;
    nextSpawn -= dt;
    if (nextSpawn <= 0)
        spawnPattern();
    const sp = currentSpeed();
    for (const h of hazards) {
        h.t -= sp * dt;
        positionHazard(h);
        const focus = fighters[0], closing = sp + (focus?.recoverDelay <= 0 && focus.trackT < PLAYER_T ? TUNING.hit.recoverSpeed : 0);
        const eta = (h.t - (focus?.trackT ?? PLAYER_T) - TUNING.hazards.collisionWindow) / closing;
        if (!h.warned && focus?.alive && !h.checked.has(0) && eta > 0 && eta < TUNING.hazards.cueEta) {
            h.warned = true;
            if (h.type === "low")
                tone(310, .035, "sine", .008, 1.12);
            else
                tone(220, .035, "sine", .008, .92);
        }
        testHazard(h);
        if (phase !== "fight")
            return;
    }
    for (let i = hazards.length - 1; i >= 0; i--) {
        if (hazards[i].t < -.03) {
            ;
            hazards.splice(i, 1);
        }
    }
    for (const f of fighters) {
        if (f.input.jumpBuffer > 0)
            f.input.jumpBuffer = Math.max(0, f.input.jumpBuffer - dt);
        aiUpdate(f, dt);
        if (f.alive) {
            if (f.recoverDelay > 0)
                f.recoverDelay = Math.max(0, f.recoverDelay - dt);
            else if (f.trackT < PLAYER_T)
                f.trackT = Math.min(PLAYER_T, f.trackT + TUNING.hit.recoverSpeed * dt);
            const fp = helixPoint(f.trackT), fb = helixBasis(f.trackT);
            f.base.copy(fp).addScaledVector(fb.right, f.lane);
            if (f.jumpY > 0 || f.vy !== 0) {
                f.vy -= TUNING.jump.gravity * dt;
                f.jumpY += f.vy * dt;
                if (f.jumpY <= 0) {
                    f.jumpY = 0;
                    f.vy = 0;
                    if (f.input.duckHeld)
                        updateDuckPosture(f);
                    else if (f.input.jumpBuffer > 0)
                        doJump(f);
                }
            }
            if (!f.jumpY) {
                updateDuckPosture(f);
                if (!f.input.duckHeld && f.input.jumpBuffer > 0)
                    doJump(f);
            }
            if (f.hitTimer > 0)
                f.hitTimer -= dt;
            if (f.flash > 0)
                f.flash -= dt;
            f.ragdoll = damp(f.ragdoll, 0, 5.4, dt);
        }
        else if (f.eliminated) {
            f.fall.y -= 8.9 * dt;
            f.offset.addScaledVector(f.fall, dt);
            ;
            if (f.base.y + f.offset.y < -7)
                ;
        }
    }
    if (arcadeTwistedView === "play")
        pollGamepads();
}
function pollGamepads(){}
function updatePhase(dt) {
    if (paused)
        return;
    if (phase === "roundover") {
        phaseTimer -= dt;
        if (phaseTimer <= 0)
            finishOrNext();
        return;
    }
    if (phase === "countdown") {
        phaseTimer -= dt;
        if (phaseTimer > 2.3)
            ;
        else if (phaseTimer > 1.3)
            ;
        else if (phaseTimer > .35)
            ;
        else
            ;
        if (phaseTimer <= 0) {
            phase = "fight";
            ;
            say("GO — read the rod’s arrow and action label.");
            tone(440, .06, "triangle", .035, 1.25);
        }
    }
}
function updateHUD(){}
 function packRefs(){return {}} function unpackRefs(){}
 
 function init(){playerCount=ids.length;arcadeTwistedView="online";arcadeTwistedArena=options.arena||"spiral";botDifficulty=["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal";MAX_LIVES=clamp(+options.lives||7,3,9);const speed=clamp(+options.speed||1,.7,1.3);for(const k of ["start","max","accel"])TUNING.speed[k]*=speed;if(arcadeTwistedArena==="frost"){TUNING.jump.gravity=10.5;TUNING.hazards.transition["low>low"]=1.12;TUNING.hazards.transition["low>high"]=1.12}if(arcadeTwistedArena==="foundry")TUNING.hit.recoverDelay=.48;createFighters();resetRound();}
 function tick(){for(const f of fighters){f.controller=botIds.includes(ids[f.id])?"ai":"online";if(f.controller!=="online")continue;const i=onlineInputs[ids[f.id]]||{};setDuck(f,i.action==="duck"||i.heldActions?.includes("duck"),"online");if(fresh(f.id)&&i.action==="jump")requestJump(f);}for(let n=0;n<4;n++){if(phase==="roundover"||phase==="matchover")break;updatePhase(1/120);if(phase==="fight")fixedUpdate(1/120);now+=1/120;}}
 function result(){const finished=phase==="roundover"||phase==="matchover";return {finished,winnerSlots:finished?fighters.filter(f=>f.roundWins>0).map(f=>f.id):[],slotScores:fighters.map(f=>f.score),view:saveData()};}

 function saveData(){return {TUNING,MAX_LIVES,arcadeTwistedArena,playerCount,round,roundWins,phase,phaseTimer,roundTime,paused,nextSpawn,hazardId,globalScore,bestScore,cameraShake,patternQueue,activePattern,lastSpawnType,choreographyStats,fighters,hazards,lastRoundWinner:lastRoundWinner?.id??null};}
 function save(){for(const id of ids)if(onlineInputs[id])nextPrevious[id]=onlineInputs[id].seq;return {kind:"twisted",ids,seed,options,now,rng,endAt,botDifficulty,previous:nextPrevious,data:encode({...saveData(),...(typeof packRefs==="function"?packRefs():{})})};}
 if(state){const data=decode(state.data);if(Object.hasOwn(data,"TUNING")){for(const key of Object.keys(data.TUNING))Object.assign(TUNING[key],data.TUNING[key]);}if(Object.hasOwn(data,"MAX_LIVES")){MAX_LIVES=data.MAX_LIVES;}if(Object.hasOwn(data,"arcadeTwistedArena")){arcadeTwistedArena=data.arcadeTwistedArena;}if(Object.hasOwn(data,"playerCount")){playerCount=data.playerCount;}if(Object.hasOwn(data,"round")){round=data.round;}if(Object.hasOwn(data,"roundWins")){roundWins=data.roundWins;}if(Object.hasOwn(data,"phase")){phase=data.phase;}if(Object.hasOwn(data,"phaseTimer")){phaseTimer=data.phaseTimer;}if(Object.hasOwn(data,"roundTime")){roundTime=data.roundTime;}if(Object.hasOwn(data,"paused")){paused=data.paused;}if(Object.hasOwn(data,"nextSpawn")){nextSpawn=data.nextSpawn;}if(Object.hasOwn(data,"hazardId")){hazardId=data.hazardId;}if(Object.hasOwn(data,"globalScore")){globalScore=data.globalScore;}if(Object.hasOwn(data,"bestScore")){bestScore=data.bestScore;}if(Object.hasOwn(data,"cameraShake")){cameraShake=data.cameraShake;}if(Object.hasOwn(data,"patternQueue")){patternQueue=data.patternQueue;}if(Object.hasOwn(data,"activePattern")){activePattern=data.activePattern;}if(Object.hasOwn(data,"lastSpawnType")){lastSpawnType=data.lastSpawnType;}if(Object.hasOwn(data,"choreographyStats")){choreographyStats=data.choreographyStats;}if(Object.hasOwn(data,"fighters")){fighters=data.fighters;}if(Object.hasOwn(data,"hazards")){hazards=data.hazards;} lastRoundWinner=data.lastRoundWinner===null?null:fighters[data.lastRoundWinner];if(typeof unpackRefs==="function")unpackRefs();}
 else init();
 return {save,tick,result};
}
