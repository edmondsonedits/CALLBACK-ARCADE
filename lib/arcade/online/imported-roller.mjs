/* eslint-disable @typescript-eslint/no-unused-vars -- static source extraction keeps native declarations and neutralizes browser effects. */
/** Generated from royal-roller-ruckus/online-v65.html SHA-256 eef52c27f99b818ff678c4daf055d6d1a9076143bcd0b1b0456d273f9a8f6b9b. */
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
 const MAX_PLAYERS = 10;
const DEFAULT_RACERS = 4;
const TRACK_SAMPLES = 640;
const TRACK_WIDTH = 4.6;
const CAGE_R = .56;
const GRAVITY = 11.5;
const TUNING = {
    movement: { maxSpeed: 7.7, driveAccel: 11.8, reverseBrake: 22, lowSpeedGrip: 8.8, highSpeedGrip: 3.15, inputResponse: 11.5, steerAssist: 2.2, coastDrag: .34, edgeDrag: .78, minInput: .055 },
    collision: { restitution: .78, packMinContacts: 2, packLowSpeed: 2.35, packReleaseAccel: 4.4, packReleaseMax: .82, packSideBias: .34, packCooldown: .22 },
    camera: { yawFollow: 4.6, positionFollow: 7.4, baseFov: 49, speedFov: 7.2, lookAheadMin: 12, lookAheadMax: 38, lookAheadWorld: 2.0, rivalRadius: 3.4, rivalWeight: .10, edgeLift: .72, edgePull: .32, fallDistance: 6.2, fallHeight: 4.25, fallLookDrop: .25, fovFollow: 6.2 },
    animation: { leanForward: .34, leanSide: .42, leanResponse: 7.5, impactKick: .62, impactDecay: 6.5, fallFlail: 2.8, speedFlail: .48, bodyBob: .045, bodyTwist: .18 },
    feedback: { mediumImpact: .62, heavyImpact: 1.02, criticalImpact: 1.34, shakeLight: .12, shakeMedium: .25, shakeHeavy: .42, flashMedium: .12, flashHeavy: .22, edgeWarnStart: .72, edgeWarnFull: .96, edgePulseHz: 4.8, hitCooldown: .075 },
    audio: { master: .72, rollMinHz: 48, rollMaxHz: 118, rollGain: .035, rattleGain: .018, windGain: .024, crowdGain: .012, finalLapCrowd: 1.65, battleCrowd: 1.32, roughRattle: 1.8, rushPitch: 1.18, smoothing: 7.5 },
    input: { deadzone: .14, gamepadDeadzone: .16, networkTimeout: .35, sequenceWindow: 512, handoffGrace: .55 },
    rounds: { defaultLaps: 3, finishReveal: 1.05, finalLapBanner: 1.35, closeFinishProgress: .045, countdownPulse: .16 },
    course: { rushBoost: 3.15, rushMaxBonus: 1.12, rushCooldown: .7, rushLane: 1.52, rushWidth: .56, rushLength: 28, roughDrag: 2.15, roughWidth: .62, roughLength: 24, finalLapBoost: 1.12 },
    track: { supportMargin: .16, edgeAssist: .26, edgePush: 1.05, slopeGravity: .58, airDrag: .16, airControl: .85, landingSkin: .16, landingEdgeForgiveness: .18, landingBounce: .08, landingSpeedKeep: .90, respawnY: -13.5, respawnDelay: 4.25 },
    ai: { decisionMin: .55, decisionMax: 1.15, avoidRadius: 2.05, passDistance: 4.0, passLane: .68, defendLane: .42, cornerScan: 24, cornerBrake: 5.4, steerAccel: 10.8, brakeStrength: 7.2, reactionEasy: .24, reactionNormal: .14, reactionHard: .08 },
};
let arcadeRollerArena = "crownway";
let arcadeRollerView = "play";
const NAMES = ["YOU", "RUFUS", "MABEL", "GREGOR", "TILLY", "BAXTER", "BEA", "OSWALD", "NELL", "PERCY"];
const AI_LEVELS = { easy: { speed: .91, accel: .92, look: .92, lane: .72, error: .16, aggression: .34 }, normal: { speed: .985, accel: 1, look: 1, lane: .9, error: .09, aggression: .56 }, hard: { speed: 1.035, accel: 1.035, look: 1.08, lane: 1, error: .045, aggression: .72 } };
const CHECKPOINT_COUNT = 8;
// The start/end spline cusp doubles back at sample 0. The existing finish stripe
// is on the forward-facing deck at sample 5; use that same gate for lap credit.
function checkpointIndex(checkpoint) { return checkpoint === 0 ? 5 : checkpoint * TRACK_SAMPLES / CHECKPOINT_COUNT; }
const networkInputs = Array.from({ length: MAX_PLAYERS }, () => ({ moveX: 0, moveY: 0, primaryAction: false, secondaryAction: false, sequence: -1, timestamp: -Infinity, connected: false, name: "" }));
const humanControl = Array.from({ length: MAX_PLAYERS }, (_, i) => i === 0);
const lastHumanPacket = Array(MAX_PLAYERS).fill(-Infinity);
let camera;
let curve;
let trackSamples = [];
let trackTangents = [];
let trackNormals = [];
let trackLengths = [];
let trackLength = 1;
let trackSampleSpacing = .25;
let rushZones = [];
let roughZones = [];
let racers = [];
let phase = "countdown";
let phaseTimer = 3.35;
let raceTime = 0;
let targetLaps = 3;
let activeRacerCount = DEFAULT_RACERS;
let paused = false;
let finished = false;
let finishOrder = [];
let cameraNeedsReset = true;
let checkpointNotice = 0;
let finalLapAnnounced = false;
let finishRevealTimer = 0;
let bannerTimer = 0;
let playerFinishTime = 0;
let playerFinishGap = 999;
let cameraShake = 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const len2 = (x, z) => Math.hypot(x, z);
const ordinal = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
function norm2(x, z) { const d = Math.hypot(x, z) || 1; return [x / d, z / d]; }
function say(){}
function showRaceBanner(){}
function updateRaceBanner(){}
function nearestRaceGap(player) { let best = 999; for (const r of racers) {
    if (r === player)
        continue;
    best = Math.min(best, Math.abs(raceProgress(player) - raceProgress(r)));
} return best; }
function revealFinish(){}
function buildCurve() {
    // Large Vertical Crownway: broad sweepers, real climbs/descents and a raised crossover.
    const pts = (arcadeRollerArena === "clockwork" ? [[-25, 0.3, 0], [-23, 1, -15], [-8, 1.8, -24], [13, 1.3, -22], [26, 0.4, -8], [23, 0.2, 13], [6, 2.8, 25], [-16, 2.5, 20], [-27, 1, 8]] : arcadeRollerArena === "glacier" ? [[-26, 1, -2], [-20, 2, -22], [-2, 1, -26], [19, 0.5, -18], [24, 2, 3], [12, 3, 20], [-9, 2, 24], [-24, 1, 14]] : [
        [-27, .2, -3], [-23, 1.1, -17], [-12, 2.3, -25], [4, 1.55, -24], [14, .25, -15],
        [3, -.9, 0], [18, .4, 13], [13, 2.6, 24], [-2, 3.5, 27], [-17, 2.2, 19],
        [-21, 1.0, 8], [-12, 3.1, 5], [3, 5.0, 0], [-8, 2.2, -10], [-22, .6, -9]
    ]).map(([x, y, z]) => new THREE.Vector3(x, y, z));
    curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", .48);
    trackSamples.length = 0;
    trackTangents.length = 0;
    trackNormals.length = 0;
    trackLengths.length = 0;
    let cumulative = 0, last = null;
    for (let i = 0; i < TRACK_SAMPLES; i++) {
        const t = i / TRACK_SAMPLES, p = curve.getPointAt(t), tan = curve.getTangentAt(t).normalize();
        const horiz = Math.hypot(tan.x, tan.z) || 1, n = new THREE.Vector3(-tan.z / horiz, 0, tan.x / horiz);
        trackSamples.push(p);
        trackTangents.push(tan);
        trackNormals.push(n);
        if (last)
            cumulative += p.distanceTo(last);
        trackLengths.push(cumulative);
        last = p;
    }
    cumulative += trackSamples[0].distanceTo(trackSamples[TRACK_SAMPLES - 1]);
    trackLength = cumulative;
    trackSampleSpacing = trackLength / TRACK_SAMPLES;
}
function buildCourseZones() {
    rushZones = [
        { idx: Math.round(TRACK_SAMPLES * .105), side: -1 },
        { idx: Math.round(TRACK_SAMPLES * .355), side: 1 },
        { idx: Math.round(TRACK_SAMPLES * .655), side: -1 },
        { idx: Math.round(TRACK_SAMPLES * .865), side: 1 }
    ];
    roughZones = [
        { idx: Math.round(TRACK_SAMPLES * .225), side: 1 },
        { idx: Math.round(TRACK_SAMPLES * .485), side: -1 },
        { idx: Math.round(TRACK_SAMPLES * .765), side: 1 }
    ];
}
function zoneDelta(idx, center) { let d = Math.abs(idx - center); return Math.min(d, TRACK_SAMPLES - d); }
function courseSurface(r) {
    const C = TUNING.course, p = trackSamples[r.trackIdx], n = trackNormals[r.trackIdx];
    const lateral = (r.x - p.x) * n.x + (r.z - p.z) * n.z;
    let rush = null, rough = null;
    for (const z of rushZones)
        if (zoneDelta(r.trackIdx, z.idx) <= C.rushLength * .5 && Math.abs(lateral - z.side * C.rushLane) < C.rushWidth)
            rush = z;
    for (const z of roughZones)
        if (zoneDelta(r.trackIdx, z.idx) <= C.roughLength * .5 && Math.abs(lateral - z.side * C.rushLane) < C.roughWidth)
            rough = z;
    return { rush, rough, lateral };
}
function buildCage(){}
function sampleTrackIndex(pos, guess = 0, window = 44) {
    let best = guess, bestD = Infinity;
    for (let o = -window; o <= window; o++) {
        let i = (guess + o) % TRACK_SAMPLES;
        if (i < 0)
            i += TRACK_SAMPLES;
        const p = trackSamples[i], dx = pos.x - p.x, dz = pos.z - p.z, d = dx * dx + dz * dz;
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return { idx: best, dist: Math.sqrt(bestD) };
}
function findTrackLanding(x, z, prevBottom, newBottom) {
    const T = TUNING.track, half = TRACK_WIDTH * .5 + T.landingEdgeForgiveness, alongLimit = Math.max(trackSampleSpacing * 1.8, .32);
    let best = null, bestY = -Infinity;
    for (let i = 0; i < TRACK_SAMPLES; i++) {
        const p = trackSamples[i], n = trackNormals[i], t = trackTangents[i], h = Math.hypot(t.x, t.z) || 1, dx = x - p.x, dz = z - p.z;
        const lateral = dx * n.x + dz * n.z;
        if (Math.abs(lateral) > half)
            continue;
        const along = dx * (t.x / h) + dz * (t.z / h);
        if (Math.abs(along) > alongLimit)
            continue;
        const sy = p.y;
        if (prevBottom >= sy - T.landingSkin && newBottom <= sy + T.landingSkin && sy > bestY) {
            bestY = sy;
            best = { idx: i, lateral, surfaceY: sy };
        }
    }
    return best;
}
function lanePosition(idx, lane = 0) { const p = trackSamples[idx], n = trackNormals[idx]; return new THREE.Vector3(p.x + n.x * lane, p.y + CAGE_R, p.z + n.z * lane); }
function makeRacer(id, idx, lane, player = false) { const pos = lanePosition(idx, lane); ; const t = trackTangents[idx]; return { id, player, name: (networkInputs[id]?.name || NAMES[id]), x: pos.x, y: pos.y, z: pos.z, vx: t.x * .01, vy: 0, vz: t.z * .01, r: CAGE_R, mass: 1, trackIdx: idx, lastTrackIdx: idx, gateX: pos.x, gateY: pos.y, gateZ: pos.z, gateIdx: idx, offDist: 0, lane, lap: 0, nextCheckpoint: 1, lastCheckpointIdx: idx, falling: false, fallTime: 0, finished: false, finishRank: 0, aiRecoveryCheckpoint: null, aiRecoveringGate: false, aiGateReturning: true, aiLane: lane, aiLaneTimer: rand(1.5, 3.5), speed: 0, impact: 0, stuck: 0, inputX: 0, inputZ: 0, slip: 0, aiState: "RACE", aiDecision: rand(.2, .8), aiReaction: 0, aiTargetLane: lane, aiPersonality: { aggression: rand(.82, 1.18), risk: rand(.86, 1.14), mistake: rand(.82, 1.18) }, animLeanX: 0, animLeanZ: 0, animKick: 0, prevVx: 0, prevVz: 0, rushCooldown: 0, onRush: false, onRough: false, contactCount: 0, contactX: 0, contactZ: 0, packReleaseCooldown: 0, grounded: true, lastSurfaceY: pos.y - CAGE_R, landingCount: 0 }; }
function clearRacers() { for (const r of racers)
    ; racers.length = 0; }
function createRacers() {
    clearRacers();
    const base = 10;
    const count = clamp(activeRacerCount, 2, MAX_PLAYERS);
    for (let id = 0; id < count; id++) {
        const row = Math.floor(id / 2);
        const idx = (base - row * 4 + TRACK_SAMPLES) % TRACK_SAMPLES;
        const lane = (id % 2 === 0 ? -1 : 1) * (row % 2 === 0 ? .68 : .56);
        racers.push(makeRacer(id, idx, lane, id === 0));
    }
}
function tone(){}
function haptic(){}
function sfxFall(){}
function sfxLap(){}
function impactFeedback(){}
function spark(){}
function radialDeadzone(x, y, dz = TUNING.input.deadzone) {
    const m = Math.hypot(x, y);
    if (m <= dz)
        return { x: 0, y: 0, mag: 0 };
    const scaled = clamp((m - dz) / (1 - dz), 0, 1), k = scaled / (m || 1);
    return { x: x * k, y: y * k, mag: scaled };
}
function samplePlayerInput(id=0){const i=onlineInputs[ids[id]]||{};const v=radialDeadzone(clamp(i.x||0,-1,1),clamp(i.y||0,-1,1),TUNING.input.deadzone);return {moveX:v.x,moveY:v.y}}
function cameraBasis(){return {f:new THREE.Vector3(0,0,-1),right:new THREE.Vector3(1,0,0)}}
function updatePlayer(r, dt) {
    if (r.falling || r.finished)
        return;
    const M = TUNING.movement, raw = samplePlayerInput(r.id);
    // Smooth tiny touch/keyboard changes without adding perceptible input lag.
    const rawMag = Math.hypot(raw.moveX, raw.moveY), targetX = rawMag > M.minInput ? raw.moveX : 0, targetZ = rawMag > M.minInput ? raw.moveY : 0;
    r.inputX = damp(r.inputX, targetX, M.inputResponse, dt);
    r.inputZ = damp(r.inputZ, targetZ, M.inputResponse, dt);
    const mag = clamp(Math.hypot(r.inputX, r.inputZ), 0, 1), sp = len2(r.vx, r.vz);
    if (mag > M.minInput) {
        const { f, right } = cameraBasis();
        let dx = right.x * r.inputX + f.x * (-r.inputZ), dz = right.z * r.inputX + f.z * (-r.inputZ);
        [dx, dz] = norm2(dx, dz);
        // A rolling cage is accelerated, not teleported toward the stick. Counter-steering
        // scrubs speed, while committing to the current line preserves momentum.
        let along = sp > .08 ? (r.vx * dx + r.vz * dz) / sp : 1;
        const braking = along < -.18;
        const accel = (braking ? M.reverseBrake : M.driveAccel) * (.32 + .68 * mag) * (braking ? .72 : 1);
        r.vx += dx * accel * dt;
        r.vz += dz * accel * dt;
        // Traction falls with speed: low speed is responsive; high speed requires planning.
        if (sp > .15) {
            const speed01 = clamp(sp / M.maxSpeed, 0, 1), grip = lerp(M.lowSpeedGrip, M.highSpeedGrip, speed01);
            const forwardX = r.vx / sp, forwardZ = r.vz / sp;
            const cross = forwardX * dz - forwardZ * dx;
            r.slip = Math.abs(cross);
            const steer = grip * (.35 + .65 * mag) * M.steerAssist * .18;
            r.vx += dx * steer * dt;
            r.vz += dz * steer * dt;
        }
    }
    else
        r.slip = damp(r.slip, 0, 5, dt);
}
function progressDelta(a, b) { let d = b.trackIdx - a.trackIdx; if (d > TRACK_SAMPLES * .5)
    d -= TRACK_SAMPLES; if (d < -TRACK_SAMPLES * .5)
    d += TRACK_SAMPLES; return d; }
function trackCurvature(idx, span = 10) { const a = trackTangents[(idx - span + TRACK_SAMPLES) % TRACK_SAMPLES], b = trackTangents[(idx + span) % TRACK_SAMPLES]; return a.angleTo(b); }
// Nearest-sample projection can jump between the two legs of the finish hairpin.
// If a required gate is behind us, physically return to its approach and recross.
// This only chooses a steering target: checkpointUpdate remains the sole authority.
function botGateTarget(r, idx) {
    const gateIdx = checkpointIndex(r.nextCheckpoint), gate = trackSamples[gateIdx], t = trackTangents[gateIdx];
    const routeDelta = ((r.trackIdx - gateIdx + TRACK_SAMPLES * 1.5) % TRACK_SAMPLES) - TRACK_SAMPLES * .5;
    const plane = (r.x - gate.x) * t.x + (r.z - gate.z) * t.z;
    if (r.aiRecoveryCheckpoint !== r.nextCheckpoint) {
        r.aiRecoveryCheckpoint = r.nextCheckpoint;
        r.aiRecoveringGate = false;
        r.aiGateReturning = true;
    }
    if (routeDelta >= 2 && routeDelta < 20 && plane > 0) {
        if (!r.aiRecoveringGate || routeDelta > 6)
            r.aiGateReturning = true;
        r.aiRecoveringGate = true;
    }
    if (!r.aiRecoveringGate)
        return { idx, lane: r.aiLane };
    if (r.aiGateReturning && plane < -.6 && Math.abs(routeDelta) < 8)
        r.aiGateReturning = false;
    return { idx: (gateIdx + (r.aiGateReturning ? -4 : 4) + TRACK_SAMPLES) % TRACK_SAMPLES, lane: 0 };
}
function updateAI(r, dt) {
    if (r.falling || r.finished)
        return;
    const D = AI_LEVELS[botDifficulty], A = TUNING.ai, sp = len2(r.vx, r.vz);
    r.aiDecision -= dt;
    r.aiReaction = Math.max(0, r.aiReaction - dt);
    let nearestAhead = null, aheadDist = 999, nearestSide = null, sideDist = 999;
    for (const o of racers) {
        if (o === r || o.falling || o.finished || Math.abs(o.y - r.y) > CAGE_R * 2)
            continue;
        const pd = progressDelta(r, o);
        const world = Math.hypot(o.x - r.x, o.z - r.z);
        if (pd > 0 && pd < 36 && world < aheadDist) {
            nearestAhead = o;
            aheadDist = world;
        }
        if (world < sideDist) {
            nearestSide = o;
            sideDist = world;
        }
    }
    if (r.aiDecision <= 0) {
        r.aiDecision = rand(A.decisionMin, A.decisionMax) + (botDifficulty === 'easy' ? .12 : 0);
        const n = trackNormals[r.trackIdx], p = trackSamples[r.trackIdx];
        const lateral = (r.x - p.x) * n.x + (r.z - p.z) * n.z;
        let desired = clamp(lateral / (TRACK_WIDTH * .5), -.72, .72), state = 'RACE';
        if (nearestAhead && aheadDist < A.passDistance) {
            const on = trackNormals[nearestAhead.trackIdx], op = trackSamples[nearestAhead.trackIdx];
            const olat = (nearestAhead.x - op.x) * on.x + (nearestAhead.z - op.z) * on.z;
            const side = olat >= 0 ? -1 : 1;
            desired = side * A.passLane * D.lane;
            state = 'PASS';
        }
        else {
            const behind = racers.find(o => o !== r && !o.falling && !o.finished && Math.abs(o.y - r.y) <= CAGE_R * 2 && progressDelta(r, o) < 0 && progressDelta(r, o) > -28 && Math.hypot(o.x - r.x, o.z - r.z) < 3.2);
            if (behind && r.aiPersonality.aggression * D.aggression > .52) {
                desired = clamp(desired * .35 + Math.sign(((behind.x - r.x) * n.x + (behind.z - r.z) * n.z) || 1) * A.defendLane, -.7, .7);
                state = 'DEFEND';
            }
            else
                desired = rand(-.22, .22) * D.lane;
        }
        if (Math.random() < D.error * r.aiPersonality.mistake) {
            desired = clamp(desired + rand(-.28, .28), -.76, .76);
            state = 'MISTAKE';
        }
        r.aiTargetLane = desired;
        r.aiState = state;
        r.aiReaction = botDifficulty === 'easy' ? A.reactionEasy : botDifficulty === 'hard' ? A.reactionHard : A.reactionNormal;
    }
    r.aiLane = damp(r.aiLane, r.aiTargetLane, 2.4, dt);
    let worst = 0;
    for (let k = 6; k <= A.cornerScan; k += 6)
        worst = Math.max(worst, trackCurvature((r.trackIdx + k) % TRACK_SAMPLES, 7));
    const cornerFactor = clamp(worst / .72, 0, 1), edgeFactor = clamp((r.offDist - TRACK_WIDTH * .28) / (TRACK_WIDTH * .28), 0, 1);
    // Aim through the next gate before looking beyond it; no progress is awarded here.
    const gateAhead = (checkpointIndex(r.nextCheckpoint) - r.trackIdx + TRACK_SAMPLES) % TRACK_SAMPLES;
    const look = Math.min(Math.floor((11 + sp * 2.25) * D.look * (1 - cornerFactor * .8)), gateAhead < 40 ? Math.max(2, gateAhead + 1) : 40), idx = (r.trackIdx + look) % TRACK_SAMPLES, guide = botGateTarget(r, idx), p = trackSamples[guide.idx], n = trackNormals[guide.idx];
    let tx = p.x + n.x * guide.lane, tz = p.z + n.z * guide.lane, dx = tx - r.x, dz = tz - r.z;
    let [nx, nz] = norm2(dx, dz);
    // Physical local avoidance: bias away from overlapping trajectories, never teleport or frame-perfect dodge.
    if (nearestSide && sideDist < A.avoidRadius && sideDist > .05) {
        const awayX = (r.x - nearestSide.x) / sideDist, awayZ = (r.z - nearestSide.z) / sideDist, w = (A.avoidRadius - sideDist) / A.avoidRadius;
        nx += awayX * w * .58;
        nz += awayZ * w * .58;
        [nx, nz] = norm2(nx, nz);
    }
    const targetSpeed = (TUNING.movement.maxSpeed * (.97 - cornerFactor * .31 - edgeFactor * .18)) * D.speed;
    if (r.aiReaction <= 0) {
        const accel = sp < targetSpeed ? A.steerAccel * D.accel : -A.brakeStrength;
        r.vx += nx * accel * dt;
        r.vz += nz * accel * dt;
        // Grip toward intended travel direction, using the same momentum rules as the human rather than rail-following.
        if (sp > .25) {
            const blend = (2.4 + cornerFactor * 2.2);
            r.vx = damp(r.vx, nx * sp, blend, dt);
            r.vz = damp(r.vz, nz * sp, blend, dt);
        }
    }
}
function collide(a, b, feedback = true) {
    if (a.falling || b.falling || a.finished || b.finished)
        return false;
    const dy = b.y - a.y, radius = a.r + b.r;
    if (Math.abs(dy) >= radius)
        return false;
    let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = Math.sqrt(radius * radius - dy * dy);
    if (d >= min)
        return false;
    // A deterministic normal also separates cages whose centers exactly coincide.
    const angle = (a.id * 7 + b.id * 13) * 2.399963229728653;
    const nx = d > 1e-6 ? dx / d : Math.cos(angle), nz = d > 1e-6 ? dz / d : Math.sin(angle), over = min - d;
    if (feedback) {
        a.contactCount++;
        b.contactCount++;
        a.contactX -= nx;
        a.contactZ -= nz;
        b.contactX += nx;
        b.contactZ += nz;
    }
    a.x -= nx * over * .5;
    a.z -= nz * over * .5;
    b.x += nx * over * .5;
    b.z += nz * over * .5;
    const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rel < 0) {
        const restitution = TUNING.collision.restitution, imp = -(1 + restitution) * rel / (1 / a.mass + 1 / b.mass);
        a.vx -= nx * imp / a.mass;
        a.vz -= nz * imp / a.mass;
        b.vx += nx * imp / b.mass;
        b.vz += nz * imp / b.mass;
        const p = clamp(Math.abs(rel) / 6, .25, 1.55), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, cz = (a.z + b.z) / 2;
        if (feedback)
            impactFeedback(a, b, p, cx, cy, cz);
    }
    return true;
}
function releasePackedRacer(r, dt) {
    const C = TUNING.collision;
    r.packReleaseCooldown = Math.max(0, r.packReleaseCooldown - dt);
    if (r.falling || r.finished || r.contactCount < C.packMinContacts || r.packReleaseCooldown > 0)
        return;
    const sp = Math.hypot(r.vx, r.vz);
    if (sp >= C.packLowSpeed)
        return;
    const tan = trackTangents[r.trackIdx], n = trackNormals[r.trackIdx];
    let side = r.contactX * n.x + r.contactZ * n.z;
    side = Math.abs(side) > .08 ? Math.sign(side) : ((r.id & 1) ? 1 : -1);
    const pressure = clamp((r.contactCount - C.packMinContacts + 1) / 3, .34, 1);
    const need = clamp(1 - sp / C.packLowSpeed, 0, 1);
    const impulse = Math.min(C.packReleaseMax, C.packReleaseAccel * dt * pressure * need * 6);
    r.vx += tan.x * impulse + n.x * side * impulse * C.packSideBias;
    r.vz += tan.z * impulse + n.z * side * impulse * C.packSideBias;
    r.packReleaseCooldown = C.packCooldown;
}
function startFall(r) {
    if (r.falling || r.finished)
        return;
    r.falling = true;
    r.grounded = false;
    r.fallTime = 0;
    r.vy = clamp(r.vy, -4.5, 4.5);
    ;
    ;
    if (r.player) {
        say("AIRBORNE — stay with it. You can land on another part of the Crownway.");
        haptic(40);
    }
    sfxFall();
}
function landOnTrack(r, hit) {
    const impact = Math.abs(r.vy);
    r.falling = false;
    r.grounded = true;
    r.fallTime = 0;
    r.trackIdx = hit.idx;
    r.lastTrackIdx = hit.idx;
    r.offDist = Math.abs(hit.lateral);
    r.y = hit.surfaceY + CAGE_R;
    r.vy = Math.max(0, impact * TUNING.track.landingBounce);
    r.vx *= TUNING.track.landingSpeedKeep;
    r.vz *= TUNING.track.landingSpeedKeep;
    r.landingCount++;
    seedCheckpointSweep(r);
    ;
    ;
    if (r.player) {
        cameraShake = Math.max(cameraShake, clamp(impact * .045, .12, .38));
        spark(r.x, r.y - CAGE_R * .65, r.z, 0xf0c861, Math.round(clamp(impact * 1.5, 5, 14)), .7);
        tone(150, .075, "triangle", .028, .72);
        haptic(impact > 4 ? [28, 20, 35] : 18);
        say(r.landingCount === 1 ? "LANDED! You caught another section of track — keep racing." : "Recovered on the track again!");
    }
}
function respawn(r) {
    let idx = r.lastCheckpointIdx;
    idx = (idx + 6) % TRACK_SAMPLES;
    const lane = r.player ? -.45 : r.aiLane * .65, pos = lanePosition(idx, lane), tan = trackTangents[idx], h = Math.hypot(tan.x, tan.z) || 1;
    r.x = pos.x;
    r.y = pos.y;
    r.z = pos.z;
    r.vx = tan.x / h * 1.7;
    r.vy = 0;
    r.vz = tan.z / h * 1.7;
    r.trackIdx = idx;
    r.lastTrackIdx = idx;
    r.falling = false;
    r.grounded = true;
    r.fallTime = 0;
    r.lastSurfaceY = trackSamples[idx].y;
    r.rushCooldown = .35;
    r.onRush = false;
    r.onRough = false;
    r.aiRecoveryCheckpoint = null;
    r.aiRecoveringGate = false;
    r.aiGateReturning = true;
    r.offDist = Math.abs(lane);
    r.speed = 1.7;
    r.inputX = r.inputZ = 0;
    r.contactCount = 0;
    r.packReleaseCooldown = 0;
    seedCheckpointSweep(r);
    ;
    ;
    ;
    if (r.player) {
        cameraNeedsReset = true;
        say("Back at the last checkpoint — the track only respawns you after a real fall.");
        haptic(22);
    }
}
function updateAirborne(r, dt) {
    const T = TUNING.track, prevY = r.y, prevBottom = prevY - CAGE_R;
    if (r.id === 0 || humanControl[r.id]) {
        const raw = samplePlayerInput(r.id), mag = clamp(Math.hypot(raw.moveX, raw.moveY), 0, 1);
        if (mag > .08) {
            const { f, right } = cameraBasis();
            let dx = right.x * raw.moveX + f.x * (-raw.moveY), dz = right.z * raw.moveX + f.z * (-raw.moveY);
            [dx, dz] = norm2(dx, dz);
            r.vx += dx * T.airControl * mag * dt;
            r.vz += dz * T.airControl * mag * dt;
        }
    }
    r.fallTime += dt;
    r.vy -= GRAVITY * dt;
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.z += r.vz * dt;
    const airDrag = Math.exp(-T.airDrag * dt);
    r.vx *= airDrag;
    r.vz *= airDrag;
    r.speed = len2(r.vx, r.vz);
    const hit = findTrackLanding(r.x, r.z, prevBottom, r.y - CAGE_R);
    if (hit && r.vy <= 0) {
        landOnTrack(r, hit);
        return;
    }
    if (r.fallTime > T.respawnDelay || r.y < T.respawnY)
        respawn(r);
}
function seedCheckpointSweep(r) { r.gateX = r.x; r.gateY = r.y; r.gateZ = r.z; r.gateIdx = r.trackIdx; }
function checkpointUpdate(r) {
    const idx = checkpointIndex(r.nextCheckpoint), p = trackSamples[idx], t = trackTangents[idx], n = trackNormals[idx];
    const before = (r.gateX - p.x) * t.x + (r.gateZ - p.z) * t.z, after = (r.x - p.x) * t.x + (r.z - p.z) * t.z;
    const near = i => Math.abs(((i - idx + TRACK_SAMPLES * 1.5) % TRACK_SAMPLES) - TRACK_SAMPLES * .5) < 8;
    const onDeck = y => Math.abs(y - CAGE_R - p.y) < .55;
    const lateral = Math.abs((r.x - p.x) * n.x + (r.z - p.z) * n.z);
    const crossed = !r.falling && !r.finished && r.grounded && near(r.gateIdx) && near(r.trackIdx) && onDeck(r.gateY) && onDeck(r.y)
        && lateral <= TRACK_WIDTH * .5 + TUNING.track.supportMargin && before < 0 && after >= 0
        && Math.hypot(r.x - r.gateX, r.z - r.gateZ) <= trackSampleSpacing * 4;
    seedCheckpointSweep(r);
    if (!crossed)
        return;
    r.lastCheckpointIdx = idx;
    r.nextCheckpoint = (r.nextCheckpoint + 1) % CHECKPOINT_COUNT;
    if (r.player) {
        checkpointNotice = 1.1;
    }
    if (r.nextCheckpoint !== 1)
        return;
    r.lap++;
    sfxLap();
    if (r.lap >= targetLaps) {
        finishRacer(r);
        return;
    }
    if (r.player) {
        if (r.lap === targetLaps - 1 && !finalLapAnnounced) {
            finalLapAnnounced = true;
            showRaceBanner("⚜ FINAL LAP ⚜", 1.55);
            say("FINAL LAP! Crownlines are stronger — every corner matters.");
            tone(610, .09, "square", .03, 1.25);
            haptic([28, 25, 38]);
        }
        else
            say(`Lap ${r.lap + 1}. ${targetLaps - r.lap} to go.`);
    }
}
function participatingHumans(){return racers;}
function multiplayerRaceComplete() {
    const humans = participatingHumans();
    return humans.length ? humans.every(r => r.finished) : finishOrder.length >= racers.length;
}
function beginFinishReveal() {
    if (finished)
        return;
    finished = true;
    phase = "finish";
    finishRevealTimer = TUNING.rounds.finishReveal;
}
function finishRacer(r) {
    if (r.finished)
        return;
    r.finished = true;
    r.finishRank = finishOrder.length + 1;
    finishOrder.push(r.id);
    const isHuman = r.id === 0 || networkInputs[r.id]?.connected;
    if (r.player) {
        playerFinishTime = raceTime;
        playerFinishGap = nearestRaceGap(r);
        showRaceBanner(r.finishRank === 1 ? "♛ CROWN CLAIMED ♛" : `${ordinal(r.finishRank).toUpperCase()} PLACE`, .95);
        cameraShake = Math.max(cameraShake, .32);
        say(r.finishRank === 1 ? "Across the line! The race continues until the court is settled." : "Across the line! The remaining racers are still fighting for place.");
        tone(r.finishRank === 1 ? 740 : 440, .12, "triangle", .035, 1.3);
    }
    else if (isHuman) {
        showRaceBanner(`${r.name.toUpperCase()} · ${ordinal(r.finishRank).toUpperCase()}`, .72);
        say(`${r.name} crossed ${ordinal(r.finishRank)}. The ruckus continues.`);
    }
    else if (finishOrder.length === racers.length - 1 && !racers[0].finished) {
        say("Every rival is home — one final push!");
    }
    if (multiplayerRaceComplete() || finishOrder.length >= racers.length)
        beginFinishReveal();
}
function updateTrackState(r, dt) {
    const T = TUNING.track, found = sampleTrackIndex({ x: r.x, z: r.z }, r.trackIdx, 44);
    r.lastTrackIdx = r.trackIdx;
    r.trackIdx = found.idx;
    const p = trackSamples[r.trackIdx], n = trackNormals[r.trackIdx], tan = trackTangents[r.trackIdx];
    const lateral = (r.x - p.x) * n.x + (r.z - p.z) * n.z;
    r.offDist = Math.abs(lateral);
    const half = TRACK_WIDTH * .5, desiredY = p.y + CAGE_R;
    if (r.offDist <= half + T.supportMargin) {
        const oldY = r.y, trackVy = clamp((desiredY - oldY) / Math.max(dt, .001), -5.5, 5.5);
        r.y = desiredY;
        r.vy = damp(r.vy, trackVy, 14, dt);
        r.grounded = true;
        r.lastSurfaceY = p.y;
        const horiz = Math.hypot(tan.x, tan.z) || 1, slope = tan.y / horiz, slopeAccel = -GRAVITY * slope * T.slopeGravity;
        r.vx += (tan.x / horiz) * slopeAccel * dt;
        r.vz += (tan.z / horiz) * slopeAccel * dt;
        if (r.offDist > half - T.edgeAssist) {
            const edge = Math.sign(lateral) * clamp((r.offDist - (half - T.edgeAssist)) / (T.edgeAssist + T.supportMargin), 0, 1);
            r.vx -= n.x * edge * T.edgePush * dt;
            r.vz -= n.z * edge * T.edgePush * dt;
        }
    }
    else
        startFall(r);
}
function updateCourseInteraction(r, dt) {
    const C = TUNING.course, s = courseSurface(r);
    r.rushCooldown = Math.max(0, r.rushCooldown - dt);
    r.onRush = !!s.rush;
    r.onRough = !!s.rough;
    if (s.rough) {
        const drag = Math.exp(-C.roughDrag * dt);
        r.vx *= drag;
        r.vz *= drag;
    }
    if (s.rush && r.rushCooldown <= 0 && !r.falling) {
        const tan = trackTangents[r.trackIdx], finalMult = r.lap >= targetLaps - 1 ? C.finalLapBoost : 1;
        r.vx += tan.x * C.rushBoost * finalMult;
        r.vz += tan.z * C.rushBoost * finalMult;
        const cap = TUNING.movement.maxSpeed * C.rushMaxBonus, sp = Math.hypot(r.vx, r.vz);
        if (sp > cap) {
            r.vx = r.vx / sp * cap;
            r.vz = r.vz / sp * cap;
        }
        r.rushCooldown = C.rushCooldown;
        if (r.player) {
            spark(r.x, r.y - .35, r.z, 0xf4cf65, 10, .85);
            tone(520, .06, "triangle", .018, 1.35);
            haptic(16);
            say(r.lap >= targetLaps - 1 ? "FINAL LAP CROWNLINE! Risk the edge for speed!" : "Crownline! Clean apex — momentum awarded.");
        }
    }
}
function fixedUpdate(dt) {
    if ((phase !== "race" && phase !== "finish") || paused)
        return;
    if (phase === "race")
        raceTime += dt;
    const now = performance.now() / 1000;
    for (const r of racers) {
        r.contactCount = 0;
        r.contactX = 0;
        r.contactZ = 0;
    }
    for (const r of racers) {
        if (r.finished || r.falling)
            continue;
        const net = networkInputs[r.id];
        if (r.id > 0 && humanControl[r.id] && (!net.connected || now - lastHumanPacket[r.id] > TUNING.input.handoffGrace))
            humanControl[r.id] = false;
        if (humanControl[r.id])
            updatePlayer(r, dt);
        else
            updateAI(r, dt);
    }
    for (const r of racers) {
        if (r.finished) {
            r.vx *= Math.exp(-2.4 * dt);
            r.vz *= Math.exp(-2.4 * dt);
        }
        if (r.falling) {
            updateAirborne(r, dt);
            continue;
        }
        const sp = len2(r.vx, r.vz), max = TUNING.movement.maxSpeed * (r.rushCooldown > .42 ? TUNING.course.rushMaxBonus : 1);
        if (sp > max) {
            r.vx = r.vx / sp * max;
            r.vz = r.vz / sp * max;
        }
        r.x += r.vx * dt;
        r.z += r.vz * dt;
        const drag = r.offDist > TRACK_WIDTH * .5 ? TUNING.movement.edgeDrag : TUNING.movement.coastDrag;
        r.vx *= Math.exp(-drag * dt);
        r.vz *= Math.exp(-drag * dt);
        r.speed = len2(r.vx, r.vz);
        updateTrackState(r, dt);
        updateCourseInteraction(r, dt);
        checkpointUpdate(r);
    }
    for (let pass = 0; pass < 3; pass++)
        for (let i = 0; i < racers.length; i++)
            for (let j = i + 1; j < racers.length; j++)
                collide(racers[i], racers[j], pass === 0);
    for (const r of racers)
        releasePackedRacer(r, dt);
}
function updatePhase(dt) { if (paused)
    return; updateRaceBanner(dt); if (phase === "countdown") {
    phaseTimer -= dt;
    const pulse = 1 + Math.sin(Math.max(0, phaseTimer) * Math.PI * 2) * TUNING.rounds.countdownPulse;
    ;
    if (phaseTimer > 2.25)
        ;
    else if (phaseTimer > 1.25)
        ;
    else if (phaseTimer > .25)
        ;
    else
        ;
    if (phaseTimer <= 0) {
        phase = "race";
        ;
        ;
        showRaceBanner("ROLL!", .55);
        say("ROLL! Carry momentum through the bends and bump clean.");
        tone(330, .08, "square", .025, 1.4);
        haptic(20);
    }
}
else if (phase === "finish") {
    finishRevealTimer -= dt;
    if (finishRevealTimer <= 0) {
        phase = "finished";
        revealFinish();
    }
} }
function raceProgress(r) {
    if (r.finished)
        return targetLaps + 1 + (racers.length - r.finishRank) * .001;
    const passed = (r.nextCheckpoint + CHECKPOINT_COUNT - 1) % CHECKPOINT_COUNT, span = TRACK_SAMPLES / CHECKPOINT_COUNT;
    const delta = ((r.trackIdx - passed * span + TRACK_SAMPLES * 1.5) % TRACK_SAMPLES) - TRACK_SAMPLES * .5;
    return r.lap + (passed + clamp(delta / span, 0, .999)) / CHECKPOINT_COUNT;
}
function standings() { return racers.slice().sort((a, b) => raceProgress(b) - raceProgress(a)); }
 function packRefs(){return {}} function unpackRefs(){}
 
 function geometry(){let cached=courseCache.get(arcadeRollerArena);if(!cached){buildCurve();buildCourseZones();cached={trackSamples,trackTangents,trackNormals,trackLengths,trackLength,trackSampleSpacing,rushZones,roughZones};courseCache.set(arcadeRollerArena,cached);}({trackSamples,trackTangents,trackNormals,trackLengths,trackLength,trackSampleSpacing,rushZones,roughZones}=cached);}
 function init(){activeRacerCount=ids.length;arcadeRollerView="play";arcadeRollerArena=options.arena||"crownway";targetLaps=clamp(+options.laps||3,1,7);botDifficulty=["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal";const speed=clamp(+options.speed||1,.75,1.2);TUNING.movement.maxSpeed*=speed;TUNING.movement.driveAccel*=speed;if(arcadeRollerArena==="glacier"){TUNING.movement.highSpeedGrip=2.05;TUNING.movement.lowSpeedGrip=6.8;TUNING.movement.coastDrag=.19;TUNING.course.rushBoost=2.5}geometry();createRacers();}
 function tick(){geometry();for(let i=0;i<ids.length;i++){humanControl[i]=!botIds.includes(ids[i]);networkInputs[i].connected=humanControl[i];lastHumanPacket[i]=now;}for(let n=0;n<4;n++){if(finished)break;updatePhase(1/120);fixedUpdate(1/120);now+=1/120;}}
 function result(){const ranked=standings();return {finished,winnerSlots:finished&&ranked[0]?[ranked[0].id]:[],slotScores:racers.map(r=>raceProgress(r)*1000),view:saveData()};}

 function saveData(){return {TUNING,arcadeRollerArena,arcadeRollerView,racers,phase,phaseTimer,raceTime,targetLaps,activeRacerCount,paused,finished,finishOrder,checkpointNotice,finalLapAnnounced,finishRevealTimer,bannerTimer,playerFinishTime,playerFinishGap,cameraShake};}
 function save(){for(const id of ids)if(onlineInputs[id])nextPrevious[id]=onlineInputs[id].seq;return {kind:"roller",ids,seed,options,now,rng,endAt,botDifficulty,previous:nextPrevious,data:encode({...saveData(),...(typeof packRefs==="function"?packRefs():{})})};}
 if(state){const data=decode(state.data);if(Object.hasOwn(data,"TUNING")){for(const key of Object.keys(data.TUNING))Object.assign(TUNING[key],data.TUNING[key]);}if(Object.hasOwn(data,"arcadeRollerArena")){arcadeRollerArena=data.arcadeRollerArena;}if(Object.hasOwn(data,"arcadeRollerView")){arcadeRollerView=data.arcadeRollerView;}if(Object.hasOwn(data,"racers")){racers=data.racers;}if(Object.hasOwn(data,"phase")){phase=data.phase;}if(Object.hasOwn(data,"phaseTimer")){phaseTimer=data.phaseTimer;}if(Object.hasOwn(data,"raceTime")){raceTime=data.raceTime;}if(Object.hasOwn(data,"targetLaps")){targetLaps=data.targetLaps;}if(Object.hasOwn(data,"activeRacerCount")){activeRacerCount=data.activeRacerCount;}if(Object.hasOwn(data,"paused")){paused=data.paused;}if(Object.hasOwn(data,"finished")){finished=data.finished;}if(Object.hasOwn(data,"finishOrder")){finishOrder=data.finishOrder;}if(Object.hasOwn(data,"checkpointNotice")){checkpointNotice=data.checkpointNotice;}if(Object.hasOwn(data,"finalLapAnnounced")){finalLapAnnounced=data.finalLapAnnounced;}if(Object.hasOwn(data,"finishRevealTimer")){finishRevealTimer=data.finishRevealTimer;}if(Object.hasOwn(data,"bannerTimer")){bannerTimer=data.bannerTimer;}if(Object.hasOwn(data,"playerFinishTime")){playerFinishTime=data.playerFinishTime;}if(Object.hasOwn(data,"playerFinishGap")){playerFinishGap=data.playerFinishGap;}if(Object.hasOwn(data,"cameraShake")){cameraShake=data.cameraShake;} if(typeof unpackRefs==="function")unpackRefs();}
 else init();
 return {save,tick,result};
}
