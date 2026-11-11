/* eslint-disable @typescript-eslint/no-unused-vars, no-constant-condition, no-constant-binary-expression -- static source extraction keeps native declarations and neutralizes browser effects. */
/** Generated from royal-scratch-match/online-v65.html SHA-256 650a6dba553cc585672f3585cb1ff8affb471a4ad79e19e19e23f03aa1e8e4c7. */
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
 const LANES = [
    { label: 'A', color: '#ff5db1', dark: '#b61d73', tone: 130.81 },
    { label: 'B', color: '#ffd34f', dark: '#b98512', tone: 164.81 },
    { label: 'X', color: '#42d8ff', dark: '#236fc8', tone: 196.00 },
    { label: 'Y', color: '#ff7b57', dark: '#bf3c2f', tone: 261.63 }
];
const PLAYER_PROFILES = [
    { name: 'YOU', color: '#ff5db1' },
    { name: 'SQUIRE', color: '#ffd34f' },
    { name: 'BARD', color: '#52e69d' },
    { name: 'KNAVE', color: '#ff7b57' },
    { name: 'JESTER', color: '#9b62ff' },
    { name: 'ROGUE', color: '#41c7c7' },
    { name: 'MAGE', color: '#6f8cff' },
    { name: 'HERALD', color: '#ff9d4d' },
    { name: 'PAGE', color: '#d66cff' },
    { name: 'WARDEN', color: '#8fd45a' }
];
const TUNING = Object.freeze({
    simulation: { fixedDt: 1 / 120, maxSubsteps: 6 },
    round: { maxPhrases: 9, countdown: 3, callToResponseGap: .68, phraseGap: .82, endDelay: .85 },
    rhythm: { baseBpm: 96, bpmStep: 7, maxBpm: 152, minEvents: 4, maxEvents: 8, travelBeats: 2.2, leadPad: .16, chordStart: 3, maxChordChance: .20 },
    timing: { easy: { window: .190, perfect: .080, botDelta: -.045 }, normal: { window: .155, perfect: .063, botDelta: 0 }, hard: { window: .125, perfect: .050, botDelta: .025 } },
    ai: { baseSkill: .915, skillSpread: .035, phrasePenalty: .010, chordPenalty: .075 },
    scoring: { perfect: 100, good: 70, comboStep: 8, comboBonus: .35 }
});
let arcadeScratchArena = "moonlit";
let arcadeScratchPaused = false;
let arcadeFinishDeferred = false;
let phase = 'menu';
let difficulty = 'normal';
let playerCount = 4;
let humanSlots = new Set([0]);
let customProfiles = null;
let soundOn = true;
let countdownAt = 0;
let countdownStage = 3;
let songTime = 0;
let notes = [];
let players = [];
let particles = [];
let sparks = [];
let screenShake = 0;
let beatPulse = 0;
let lastBeatIndex = -1;
let finishQueued = false;
let flash = { a: 0, color: '#fff' };
let audioCtx = null;
let hitText = { text: '', sub: '', a: 0, color: '#fff' };
let eliminationCounter = 0;
let menuTime = 0;
let phraseIndex = -1;
let phraseBpm = TUNING.rhythm.baseBpm;
let phraseBeat = 60 / phraseBpm;
let phaseClock = 0;
let humanPhraseMisses = 0;
let roundStartedAt = 0;
let totalInputs = 0;
let totalResolved = 0;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function initPlayers() {
    randomState = configuredSeed >>> 0;
    stopAudio();
    const source = customProfiles?.length ? customProfiles : PLAYER_PROFILES;
    players = Array.from({ length: playerCount }, (_, i) => {
        const profile = source[i] || PLAYER_PROFILES[i] || { name: `PLAYER ${i + 1}`, color: `hsl(${(i * 47) % 360} 78% 60%)` };
        return {
            id: i, name: profile.name || `PLAYER ${i + 1}`, color: profile.color || PLAYER_PROFILES[i]?.color || '#ffffff',
            human: humanSlots.has(i), local: i === 0, lives: 8, score: 0, combo: 0, maxCombo: 0, alive: true,
            perfect: 0, good: 0, misses: 0, rank: null, eliminatedAt: null, stumble: 0, bop: Math.random() * 6.28, glow: 0, lastRating: '', botResolve: new Set()
        };
    });
    renderHud();
}
function arcadeText(v) { return String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function renderHud(){}
function renderPhraseProgress(){}
function setStatus(){}
let configuredSeed = null;
let randomState = 0;
function gameplayRandom() {
    if (configuredSeed === null)
        return Math.random();
    randomState = (randomState + 0x6D2B79F5) >>> 0;
    let t = randomState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gameClock(){return now;}
function diffSettings() { return TUNING.timing[difficulty] || TUNING.timing.normal; }
function pickRhythmGap() {
    const p = phraseIndex;
    const bag = p < 2 ? [1, 1, 1, 2] : p < 5 ? [.5, 1, 1, 1, 1.5, 2] : [.5, .5, 1, 1, 1.5, 2];
    return bag[Math.floor(gameplayRandom() * bag.length)];
}
function createPhrase(index) {
    phraseBpm = Math.min(TUNING.rhythm.maxBpm, TUNING.rhythm.baseBpm + index * TUNING.rhythm.bpmStep);
    phraseBeat = 60 / phraseBpm;
    const count = Math.min(TUNING.rhythm.maxEvents, TUNING.rhythm.minEvents + Math.floor(index / 2));
    const travel = Math.max(.90, phraseBeat * TUNING.rhythm.travelBeats);
    const lead = travel + TUNING.rhythm.leadPad;
    let beatPos = 0;
    notes = [];
    for (let i = 0; i < count; i++) {
        if (i > 0)
            beatPos += pickRhythmGap();
        const lane = Math.floor(gameplayRandom() * 4);
        let lanes = [lane];
        const chordChance = index >= TUNING.rhythm.chordStart ? Math.min(TUNING.rhythm.maxChordChance, .06 + (index - TUNING.rhythm.chordStart) * .035) : 0;
        if (gameplayRandom() < chordChance) {
            let l2 = Math.floor(gameplayRandom() * 4);
            if (l2 === lane)
                l2 = (l2 + 1 + Math.floor(gameplayRandom() * 3)) % 4;
            lanes = [lane, l2].sort((a, b) => a - b);
        }
        notes.push({ id: i, time: lead + beatPos * phraseBeat, lanes, callPlayed: false, responses: Array.from({ length: playerCount }, () => ({ hits: new Set(), errors: [], resolved: false })) });
    }
}
function resetResponseState() {
    for (const n of notes) {
        n.responses = Array.from({ length: playerCount }, () => ({ hits: new Set(), errors: [], resolved: false }));
    }
    humanPhraseMisses = 0;
}
function setControlMode(){}
function startPhrase(index) {
    if (index >= TUNING.round.maxPhrases) {
        queueRoundEnd(.35);
        return;
    }
    phraseIndex = index;
    createPhrase(index);
    phase = 'call';
    phaseClock = gameClock();
    songTime = 0;
    lastBeatIndex = -1;
    setControlMode('listen');
    ;
    ;
    refreshHighwayBounds();
    renderPhraseProgress();
    setStatus(`LISTEN · PHRASE ${index + 1}/${TUNING.round.maxPhrases}`, 'listen');
    kick(.12);
    ping(523.25, .07, .05);
}
function beginResponse() {
    resetResponseState();
    phase = 'response';
    phaseClock = gameClock();
    songTime = 0;
    lastBeatIndex = -1;
    setControlMode('respond');
    ;
    ;
    setStatus(`REPEAT · ${players[0].lives} LIVES`, 'respond');
    kick(.15);
}
function queueRoundEnd(delay=TUNING.round.endDelay){if(finishQueued)return;finishQueued=true;phase="finishing";phaseClock=gameClock();endAt=now+delay;}
function beginPlay() {
    roundStartedAt = gameClock();
    ;
    ;
    startPhrase(0);
}
function endRound() {
    if (arcadeScratchPaused) {
        arcadeFinishDeferred = true;
        return;
    }
    if (phase === 'results')
        return;
    phase = 'results';
    ;
    setStatus('ROUND OVER');
    ;
    ;
    const ranked = [...players].sort((a, b) => {
        if (a.alive !== b.alive)
            return a.alive ? -1 : 1;
        if (a.eliminatedAt !== b.eliminatedAt)
            return (b.eliminatedAt || Infinity) - (a.eliminatedAt || Infinity);
        return b.score - a.score;
    });
    ranked.forEach((p, i) => p.rank = i + 1);
    const human = players[0];
    ;
    ;
    ;
    ;
    fanfare(human.rank === 1);
}
function ordinal(n) { const mod100 = n % 100; if (mod100 >= 11 && mod100 <= 13)
    return `${n}TH`; return n % 10 === 1 ? `${n}ST` : n % 10 === 2 ? `${n}ND` : n % 10 === 3 ? `${n}RD` : `${n}TH`; }
function missPlayer(p, reason = 'MISS') {
    if (!p.alive)
        return;
    p.lives = Math.max(0, p.lives - 1);
    p.combo = 0;
    p.misses++;
    p.stumble = 1;
    p.glow = .25;
    if (p.human) {
        hitText = { text: 'MISS', sub: 'CROWN LOST', a: 1, color: '#ff625d' };
        screenShake = Math.max(screenShake, 6);
        flash = { a: .16, color: '#ff413f' };
        buzz();
        ;
    }
    if (p.lives <= 0) {
        p.alive = false;
        p.eliminatedAt = ++eliminationCounter;
        p.rank = null;
        p.stumble = 1.6;
        if (p.human) {
            ;
            ;
        }
    }
    renderHud();
}
function award(p, rating, chordSize = 1) {
    if (!p.alive)
        return;
    const perfect = rating === 'PERFECT';
    p.combo++;
    p.maxCombo = Math.max(p.maxCombo, p.combo);
    p[perfect ? 'perfect' : 'good']++;
    const mult = 1 + Math.min(3, Math.floor(p.combo / TUNING.scoring.comboStep)) * TUNING.scoring.comboBonus;
    p.score += (perfect ? TUNING.scoring.perfect : TUNING.scoring.good) * mult * chordSize;
    p.glow = .42;
    if (p.human) {
        hitText = { text: rating, sub: p.combo > 1 ? `${p.combo}× COMBO` : '', a: 1, color: perfect ? '#fff0a8' : '#9ce8ff' };
        if (perfect)
            ;
    }
    renderHud();
}
function tryPlayerHit(playerIndex, lane) {
    if (phase !== 'response' || false)
        return;
    songTime = Math.max(0, gameClock() - phaseClock);
    const p = players[playerIndex];
    if (!p || !p.alive || !p.human)
        return;
    judgeLane(playerIndex, lane, songTime);
}
function judgeLane(playerIndex, lane, at, target = null) {
    const p = players[playerIndex];
    if (phase !== 'response' || !p?.alive)
        return;
    lane = clamp(lane | 0, 0, 3);
    if (p.local) {
        totalInputs++;
        pressVisual(lane);
    }
    const d = diffSettings();
    let nearest = null, nearestErr = Infinity;
    for (const n of target ? [target] : notes) {
        const r = n.responses[playerIndex];
        if (!r || r.resolved)
            continue;
        const e = Math.abs(at - n.time);
        if (e < nearestErr) {
            nearestErr = e;
            nearest = n;
        }
    }
    if (!nearest || nearestErr > d.window) {
        if (p.local) {
            ping(LANES[lane].tone, .025, .022);
            if (nearest && songTime < nearest.time && nearest.time - songTime < d.window + .16)
                hitText = { text: 'WAIT', sub: '', a: .42, color: '#d7d0b7' };
        }
        return;
    }
    const r = nearest.responses[playerIndex];
    if (!nearest.lanes.includes(lane)) {
        r.resolved = true;
        if (p.local) {
            humanPhraseMisses++;
            totalResolved++;
            hitText = { text: 'WRONG', sub: 'CROWN LOST', a: 1, color: '#ff625d' };
            ping(LANES[lane].tone, .035, .032);
        }
        missPlayer(p, 'WRONG');
        return;
    }
    if (r.hits.has(lane))
        return;
    r.hits.add(lane);
    r.errors.push(nearestErr);
    if (p.local) {
        tone(LANES[lane].tone * 2, nearest.lanes.length > 1 ? .085 : .060, .055, 'sine');
        burstLane(lane, nearestErr <= d.perfect);
    }
    if (r.hits.size === nearest.lanes.length) {
        r.resolved = true;
        if (p.local)
            totalResolved++;
        const maxErr = Math.max(...r.errors);
        award(p, maxErr <= d.perfect ? 'PERFECT' : 'GOOD', nearest.lanes.length);
        if (p.local)
            hitText.sub = `${Math.round((at - nearest.time) * 1000)} ms · ${at < nearest.time ? 'EARLY' : 'LATE'}${p.combo > 1 ? ' · ' + p.combo + '×' : ''}`;
    }
}
function playDjEvent(){}
function updateBeatGuide(){}
function botSkillFor(i) {
    const wobble = ((i * 37) % 7 - 3) / 3 * TUNING.ai.skillSpread;
    return clamp(TUNING.ai.baseSkill + wobble, .84, .96);
}
function resolveBotsFor(n) {
    const d = diffSettings();
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.alive || p.human)
            continue;
        const r = n.responses[i];
        if (!r || r.resolved || songTime < n.time)
            continue;
        if (!r.intent) {
            const chance = clamp(botSkillFor(i) + d.botDelta - phraseIndex * TUNING.ai.phrasePenalty - (n.lanes.length > 1 ? TUNING.ai.chordPenalty : 0), .60, .985);
            const hit = gameplayRandom() < chance;
            const perfect = hit && gameplayRandom() < .67;
            // Preserve success/rating probabilities; realize them as legal timed actions.
            const error = hit ? (perfect ? d.perfect * .5 : (d.perfect + d.window) * .5) : d.window + .001;
            r.intent = { hit, at: n.time + error };
        }
        if (songTime < r.intent.at)
            continue;
        if (!r.intent.hit) {
            r.resolved = true;
            missPlayer(p);
            continue;
        }
        for (const lane of n.lanes)
            judgeLane(i, lane, r.intent.at, n);
    }
}
function phraseEndTime() {
    const lastNote = notes.length ? notes[notes.length - 1].time : 1;
    return lastNote + diffSettings().window + Math.max(.34, phraseBeat * .7);
}
function updateGame(dt) {
    if (arcadeScratchPaused)
        return;
    if (false)
        return;
    menuTime += dt;
    beatPulse = Math.max(0, beatPulse - dt * 3.4);
    flash.a = Math.max(0, flash.a - dt * 1.9);
    screenShake *= Math.pow(.05, dt);
    hitText.a = Math.max(0, hitText.a - dt * 1.25);
    for (const p of players) {
        p.stumble = Math.max(0, p.stumble - dt * 1.65);
        p.glow = Math.max(0, p.glow - dt * 2.2);
        p.bop += dt * (2.3 + p.combo * .006);
    }
    particles.forEach(q => { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; q.life -= dt; q.vx *= Math.pow(.5, dt); });
    particles = particles.filter(q => q.life > 0);
    sparks.forEach(q => { q.a -= dt * q.fade; q.r += dt * q.grow; });
    sparks = sparks.filter(q => q.a > 0);
    if (phase === 'countdown') {
        const e = gameClock() - countdownAt / 1000;
        const stage = 3 - Math.floor(e);
        if (stage !== countdownStage && stage >= 1) {
            countdownStage = stage;
            ;
            ping(392 + (3 - stage) * 65, .07, .05);
        }
        if (e >= false) {
            beginPlay();
        }
        return;
    }
    if (phase === 'menu' || phase === 'results' || phase === 'finishing')
        return;
    songTime = Math.max(0, gameClock() - phaseClock);
    if (phase === 'call') {
        updateBeatGuide();
        if (songTime > .72 && false === 'LISTEN') {
            ;
            ;
        }
        for (const n of notes) {
            if (!n.audioPlayed && n.time - songTime <= .10) {
                n.audioPlayed = true;
                if (songTime - n.time <= .035 && soundOn && audioCtx?.state === 'running') {
                    const when = Math.max(0, n.time - songTime);
                    for (const lane of n.lanes)
                        tone(LANES[lane].tone, .10, .052, 'triangle', when);
                }
            }
            if (!n.callPlayed && songTime >= n.time)
                playDjEvent(n);
        }
        if (songTime >= phraseEndTime()) {
            phase = 'handoff';
            phaseClock = gameClock();
            songTime = 0;
            setControlMode('listen');
            ;
            ;
            setStatus('GET READY TO ANSWER', 'respond');
            ping(659.25, .09, .05);
        }
        return;
    }
    if (phase === 'handoff') {
        if (songTime >= TUNING.round.callToResponseGap)
            beginResponse();
        return;
    }
    if (phase === 'response') {
        updateBeatGuide();
        if (songTime > .55 && false === 'YOUR TURN') {
            ;
            ;
        }
        const d = diffSettings();
        for (const n of notes) {
            if (songTime >= n.time)
                resolveBotsFor(n);
            if (songTime > n.time + d.window) {
                for (let i = 0; i < players.length; i++) {
                    const p = players[i], r = n.responses[i];
                    if (!p.alive || !p.human || !r || r.resolved)
                        continue;
                    r.resolved = true;
                    if (p.local) {
                        humanPhraseMisses++;
                        totalResolved++;
                    }
                    missPlayer(p);
                }
            }
        }
        const alive = players.filter(p => p.alive);
        setStatus(`REPEAT · ${Math.round(phraseBpm)} BPM · ${players[0].lives} LIVES`, 'respond');
        if (alive.length <= 1 && songTime > 1) {
            queueRoundEnd();
            return;
        }
        if (songTime >= phraseEndTime()) {
            if (phraseIndex + 1 >= TUNING.round.maxPhrases) {
                queueRoundEnd(.45);
                return;
            }
            phase = 'phraseGap';
            phaseClock = gameClock();
            songTime = 0;
            setControlMode('listen');
            ;
            ;
            setStatus(`PHRASE ${phraseIndex + 1} COMPLETE`);
        }
        return;
    }
    if (phase === 'phraseGap') {
        if (songTime >= TUNING.round.phraseGap)
            startPhrase(phraseIndex + 1);
    }
}
function refreshHighwayBounds(){}
function burstLane(){}
function pressVisual(){}
function stopAudio(){}
function tone(){}
function ping(){}
function kick(){}
function buzz(){}
function fanfare(){}
 function packRefs(){return {}} function unpackRefs(){}
 
 function init(){playerCount=ids.length;humanSlots=new Set(ids.flatMap((id,i)=>botIds.includes(id)?[]:[i]));arcadeScratchArena=options.arena||"moonlit";difficulty=["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal";configuredSeed=seed>>>0;if(arcadeScratchArena==="echo")Object.assign(TUNING.rhythm,{baseBpm:82,bpmStep:4,maxBpm:128,minEvents:6,maxEvents:10});if(arcadeScratchArena==="tempest")Object.assign(TUNING.rhythm,{baseBpm:104,bpmStep:9,maxBpm:170});if(arcadeScratchArena==="crystal")Object.assign(TUNING.rhythm,{baseBpm:90,chordStart:0,maxChordChance:.45});const tempo=clamp(+options.tempo||1,.75,1.2);TUNING.rhythm.baseBpm*=tempo;TUNING.rhythm.maxBpm*=tempo;TUNING.round.maxPhrases=clamp(+options.phrases||9,3,12);TUNING.ai.baseSkill=clamp(+options.botSkill||.915,.6,.98);initPlayers();phase="countdown";countdownAt=now*1000;}
 function tick(){for(const p of players)p.human=!botIds.includes(ids[p.id]);for(let n=0;n<4;n++){now+=1/120;updateGame(1/120);if(n===0)for(const p of players){const i=onlineInputs[ids[p.id]]||{};if(!fresh(p.id))continue;if(Number.isInteger(i.laneMask))for(let lane=0;lane<4;lane++){if(i.laneMask&(1<<lane))tryPlayerHit(p.id,lane)}else if(Number.isInteger(i.lane))tryPlayerHit(p.id,i.lane);}if(phase==="finishing"&&now>=endAt)endRound();if(phase==="results")break;}}
 function result(){const finished=phase==="results";return {finished,winnerSlots:finished?players.filter(p=>p.rank===1).map(p=>p.id):[],slotScores:players.map(p=>p.score),view:saveData()};}

 function saveData(){return {TUNING,arcadeScratchArena,phase,difficulty,playerCount,humanSlots,countdownAt,countdownStage,songTime,notes,players,particles,sparks,screenShake,beatPulse,lastBeatIndex,finishQueued,flash,hitText,eliminationCounter,menuTime,phraseIndex,phraseBpm,phraseBeat,phaseClock,humanPhraseMisses,roundStartedAt,totalInputs,totalResolved,configuredSeed,randomState};}
 function save(){for(const id of ids)if(onlineInputs[id])nextPrevious[id]=onlineInputs[id].seq;return {kind:"scratch",ids,seed,options,now,rng,endAt,botDifficulty,previous:nextPrevious,data:encode({...saveData(),...(typeof packRefs==="function"?packRefs():{})})};}
 if(state){const data=decode(state.data);if(Object.hasOwn(data,"TUNING")){for(const key of Object.keys(data.TUNING))Object.assign(TUNING[key],data.TUNING[key]);}if(Object.hasOwn(data,"arcadeScratchArena")){arcadeScratchArena=data.arcadeScratchArena;}if(Object.hasOwn(data,"phase")){phase=data.phase;}if(Object.hasOwn(data,"difficulty")){difficulty=data.difficulty;}if(Object.hasOwn(data,"playerCount")){playerCount=data.playerCount;}if(Object.hasOwn(data,"humanSlots")){humanSlots=data.humanSlots;}if(Object.hasOwn(data,"countdownAt")){countdownAt=data.countdownAt;}if(Object.hasOwn(data,"countdownStage")){countdownStage=data.countdownStage;}if(Object.hasOwn(data,"songTime")){songTime=data.songTime;}if(Object.hasOwn(data,"notes")){notes=data.notes;}if(Object.hasOwn(data,"players")){players=data.players;}if(Object.hasOwn(data,"particles")){particles=data.particles;}if(Object.hasOwn(data,"sparks")){sparks=data.sparks;}if(Object.hasOwn(data,"screenShake")){screenShake=data.screenShake;}if(Object.hasOwn(data,"beatPulse")){beatPulse=data.beatPulse;}if(Object.hasOwn(data,"lastBeatIndex")){lastBeatIndex=data.lastBeatIndex;}if(Object.hasOwn(data,"finishQueued")){finishQueued=data.finishQueued;}if(Object.hasOwn(data,"flash")){flash=data.flash;}if(Object.hasOwn(data,"hitText")){hitText=data.hitText;}if(Object.hasOwn(data,"eliminationCounter")){eliminationCounter=data.eliminationCounter;}if(Object.hasOwn(data,"menuTime")){menuTime=data.menuTime;}if(Object.hasOwn(data,"phraseIndex")){phraseIndex=data.phraseIndex;}if(Object.hasOwn(data,"phraseBpm")){phraseBpm=data.phraseBpm;}if(Object.hasOwn(data,"phraseBeat")){phraseBeat=data.phraseBeat;}if(Object.hasOwn(data,"phaseClock")){phaseClock=data.phaseClock;}if(Object.hasOwn(data,"humanPhraseMisses")){humanPhraseMisses=data.humanPhraseMisses;}if(Object.hasOwn(data,"roundStartedAt")){roundStartedAt=data.roundStartedAt;}if(Object.hasOwn(data,"totalInputs")){totalInputs=data.totalInputs;}if(Object.hasOwn(data,"totalResolved")){totalResolved=data.totalResolved;}if(Object.hasOwn(data,"configuredSeed")){configuredSeed=data.configuredSeed;}if(Object.hasOwn(data,"randomState")){randomState=data.randomState;} if(typeof unpackRefs==="function")unpackRefs();}
 else init();
 return {save,tick,result};
}
