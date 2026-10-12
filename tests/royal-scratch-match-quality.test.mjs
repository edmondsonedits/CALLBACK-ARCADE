import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../games/royal-scratch-match/tests/runtime.mjs';
for (const [difficulty, perfect, window] of [['easy', .080, .190], ['normal', .063, .155], ['hard', .050, .125]])
    for (const bpm of [96, 152])
        test(`${difficulty} ${bpm} BPM authoritative input boundaries`, () => {
            for (const sign of [-1, 1])
                for (const [delta, rating] of [[perfect - .000001, 'perfect'], [perfect + .000001, 'good'], [window - .000001, 'good'], [window + .000001, 'none']]) {
                    const r = runtime();
                    r.setup(difficulty);
                    r.run(`phraseBpm=${bpm};phraseBeat=60/phraseBpm`);
                    r.advance((1 + sign * delta) * 1000);
                    r.g.ScratchMatchAPI.press(0, 0);
                    assert.equal(r.run(`players[0].${rating === 'none' ? 'score' : rating}`), rating === 'none' ? 0 : 1);
                }
        });
test('audio state never changes gameplay clock origin', () => {
    const r = runtime();
    r.setup();
    const before = r.run('gameClock()');
    r.run("audioCtx.state='suspended'");
    assert.equal(r.run('gameClock()'), before);
    r.advance(25);
    assert.ok(Math.abs(r.run('gameClock()') - before - .025) < 1e-9);
});
test('hidden interval freezes clock, rejects input and resumes at same note position', () => {
    const r = runtime();
    r.setup();
    r.advance(1000);
    r.hidden(true);
    const t = r.run('gameClock()');
    r.advance(30000);
    r.g.ScratchMatchAPI.press(0, 0);
    assert.equal(r.run('players[0].score'), 0);
    assert.equal(r.run('gameClock()'), t);
    r.hidden(false);
    assert.equal(r.run('gameClock()'), t);
    r.g.ScratchMatchAPI.press(0, 0);
    assert.equal(r.run('players[0].perfect'), 1);
});
test('independent pointer chord, cancellation, repeat and phase guards', () => {
    const r = runtime();
    r.setup('normal', [0, 2]);
    r.advance(1000);
    for (const i of [0, 2])
        r.buttons[i].pointerdown({ pointerId: i + 1, preventDefault() {
            } });
    assert.equal(r.run('players[0].perfect'), 1);
    assert.equal(r.run('players[0].score'), 200);
    r.buttons[0].pointercancel({ pointerId: 1 });
    assert.equal(r.buttons[0].captures.size, 0);
    assert.equal(r.buttons[0].classes.has('hit'), false);
    r.listeners.keydown({ key: 'd', repeat: true });
    assert.equal(r.run('players[0].score'), 200);
    for (const p of ['call', 'handoff', 'countdown', 'results', 'finishing']) {
        r.run(`phase='${p}'`);
        r.g.ScratchMatchAPI.press(1, 0);
    }
    assert.equal(r.run('players[1].score'), 0);
});
test('seeded phrases unaffected by cosmetic randomness', () => {
    const a = runtime(), b = runtime();
    for (const r of [a, b])
        r.g.ScratchMatchAPI.start({ seed: 77 });
    a.run('draw();draw();draw()');
    for (const r of [a, b])
        r.run('startPhrase(7)');
    assert.equal(a.run('JSON.stringify(notes.map(n=>[n.time,n.lanes]))'), b.run('JSON.stringify(notes.map(n=>[n.time,n.lanes]))'));
});
test('ten repeated restarts reject forced stale result callbacks', () => {
    const r = runtime();
    const stale = [];
    for (let i = 0; i < 10; i++) {
        r.g.ScratchMatchAPI.start();
        r.run('queueRoundEnd()');
        stale.push(r.timers.at(-1));
        r.g.ScratchMatchAPI.start();
        assert.equal(stale.at(-1).cancelled, true);
        for (const timer of stale)
            timer.fn();
        assert.equal(r.run('phase'), 'countdown');
    }
    r.run('queueRoundEnd()');
    const done = r.timers.at(-1);
    done.fn();
    const count = r.sounds.length;
    done.fn();
    assert.equal(r.run('phase'), 'results');
    assert.equal(r.sounds.length, count);
});
test('overdue call notes are consumed silently after a long foreground stall', () => {
    const r = runtime();
    r.setup();
    r.run("phase='call';notes.push({...notes[0],id:1,time:1.1,callPlayed:false})");
    r.sounds.length = 0;
    r.advance(3000);
    r.tick();
    assert.ok(r.sounds.length <= 3, 'no catch-up phrase burst (only transition/beat cues allowed)');
    assert.equal(r.run('notes.every(n=>n.callPlayed)'), true);
});
test('mute cancels queued voices, suspended context creates none, unmute preserves time', () => {
    const r = runtime();
    r.setup();
    r.run('fanfare(true)');
    const voices = r.run('activeVoices.size');
    assert.ok(voices > 0);
    const time = r.run('gameClock()');
    r.g.ScratchMatchAPI.setSound(false);
    assert.equal(r.run('activeVoices.size'), 0);
    r.run("audioCtx.state='suspended'");
    r.sounds.length = 0;
    r.run('soundOn=true;ping(440)');
    assert.equal(r.sounds.length, 0);
    r.g.ScratchMatchAPI.setSound(true);
    assert.equal(r.run('gameClock()'), time);
});
test('linear note travel and layout reserve hit-ring clearance', () => {
    const r = runtime();
    r.run('W=844;H=390');
    const geom = r.run('highwayGeom()');
    assert.ok(geom.targetY <= 290);
    assert.ok(geom.topY >= 148);
});
for (const seats of [2, 4, 10])
    test(`complete seeded ${seats}-seat round and rematch preserve ownership`, () => {
        const r = runtime();
        r.g.ScratchMatchAPI.start({ playerCount: seats, humanPlayers: [0, 1], seed: 902 });
        let steps = 0;
        while (r.run('phase') !== 'finishing' && steps++ < 40000) {
            r.tick(10);
            if (r.run('phase') === 'response') {
                const state = r.g.ScratchMatchAPI.getState();
                for (const n of state.pattern)
                    if (Math.abs(state.phaseTime - n.time) < .012)
                        for (const seat of [0, 1])
                            for (const lane of n.lanes)
                                r.g.ScratchMatchAPI.press(seat, lane);
            }
        }
        assert.ok(steps < 40000);
        r.timers.at(-1).fn();
        assert.equal(r.run('phase'), 'results');
        assert.equal(r.run('players.length'), seats);
        r.g.ScratchMatchAPI.start();
        assert.equal(r.run('phase'), 'countdown');
        assert.equal(r.run('players.filter(p=>p.human).map(p=>p.id).join()'), '0,1');
        assert.equal(r.run('players.every(p=>p.score===0&&p.lives===8)'), true);
    });
test('rapid high BPM bot chord judges its intended event once', () => {
    const r = runtime();
    r.g.ScratchMatchAPI.start({ seed: 1, playerCount: 2 });
    r.run(`phase='response';phraseIndex=8;difficulty='easy';songTime=1.14;notes=[1,1.197].map((time,id)=>({id,time,lanes:[0,2],responses:players.map(()=>({hits:new Set(),errors:[],resolved:false}))}));notes[0].responses[1].intent={hit:true,at:1.135};resolveBotsFor(notes[0]);`);
    assert.equal(r.run('notes[0].responses[1].resolved'), true);
    assert.equal(r.run('notes[1].responses[1].resolved'), false);
    assert.equal(r.run('players[1].good'), 1);
});
test('miss deadline is exclusive and each missing chord resolves once', () => {
    for (const difficulty of ['easy', 'normal', 'hard']) {
        const r = runtime();
        r.setup(difficulty, [0, 2]);
        const w = r.run('diffSettings().window');
        r.advance((1 + w - .000001) * 1000);
        r.run('updateGame(0)');
        assert.equal(r.run('players[0].misses'), 0);
        r.advance(.002);
        r.run('updateGame(0);updateGame(0)');
        assert.equal(r.run('players[0].misses'), 1);
        assert.equal(r.run('totalResolved'), 1);
    }
});
test('scheduled call tone aligns with clock and future cancelled notes can reschedule', () => {
    const r = runtime();
    r.setup();
    r.run("phase='call'");
    r.advance(920);
    r.run('updateGame(0)');
    assert.ok(r.sounds.some(s => Math.abs(s.t - 3.08) < 1e-9));
    r.g.ScratchMatchAPI.setSound(false);
    r.g.ScratchMatchAPI.setSound(true);
    r.sounds.length = 0;
    r.advance(20);
    r.run('updateGame(0)');
    assert.ok(r.sounds.some(s => Math.abs(s.t - 3.06) < 1e-9));
});
test('camera transforms never change lane ownership or clock judgment', () => {
    const r = runtime();
    r.setup();
    const code = r.run('callbackCameraSet({rotate:80,zoom:1.8,tilt:35});callbackCameraCode()');
    assert.equal(r.run(`callbackCameraLoad('${code}',false)`), true);
    r.advance(1000);
    r.g.ScratchMatchAPI.press(1, 0);
    assert.equal(r.run('players[1].perfect'), 1);
    assert.equal(r.run('players[0].score'), 0);
});
test('audio suspension cancels voices independently of page visibility', () => {
    const r = runtime();
    r.setup();
    r.run("fanfare(true);audioCtx.state='suspended';audioCtx.onstatechange?.()");
    assert.equal(r.run('activeVoices.size'), 0);
    const t = r.run('gameClock()');
    r.advance(10000);
    r.run("audioCtx.state='running';audioCtx.onstatechange?.()");
    assert.ok(Math.abs(r.run('gameClock()') - t - 10) < 1e-9);
});
test('note center travels linearly and reaches the hit line at its timestamp', () => {
    const r = runtime();
    r.setup();
    r.run("phase='call';notes[0].time=2;songTime=2-Math.max(.90,phraseBeat*TUNING.rhythm.travelBeats)/2;drawNotes()");
    const geom = r.run('highwayGeom()');
    assert.ok(Math.abs(r.drawCalls.find(c => c[0] === 'arc')[2] - (geom.topY + geom.targetY) / 2) < 1e-9);
    r.drawCalls.length = 0;
    r.run('songTime=2;drawNotes()');
    assert.equal(r.drawCalls.find(c => c[0] === 'arc')[2], geom.targetY);
});
test('ordinary play stays stochastic unless a seed is supplied', () => {
    const r = runtime();
    r.g.Math.random = () => .123;
    assert.equal(r.run('gameplayRandom()'), .123);
    r.g.ScratchMatchAPI.configure({ seed: 17 });
    assert.notEqual(r.run('gameplayRandom()'), .123);
    r.g.ScratchMatchAPI.configure({ seed: null });
    assert.equal(r.run('gameplayRandom()'), .123);
});
test('unlock before an upcoming call note rearms it without replaying past notes', () => {
    const r = runtime();
    r.setup();
    r.run("phase='call';audioCtx.state='suspended';audioCtx.onstatechange()");
    r.advance(920);
    r.run('updateGame(0)');
    r.sounds.length = 0;
    r.advance(20);
    r.run("audioCtx.state='running';audioCtx.onstatechange();updateGame(0)");
    assert.ok(r.sounds.some(s => Math.abs(s.t - 3.06) < 1e-9));
});
for (const seats of [2, 4, 10])
    test(`default local slot survives ownership through elimination with ${seats} seats`, () => {
        const r = runtime();
        r.g.ScratchMatchAPI.start({ playerCount: seats, seed: 902 });
        let steps = 0;
        while (r.run('phase') !== 'finishing' && steps++ < 40000)
            r.tick(10);
        assert.ok(steps < 40000);
        assert.equal(r.run('players.filter(p=>p.human).map(p=>p.id).join()'), '0');
        assert.equal(r.run('players[0].alive'), false);
        r.timers.at(-1).fn();
        assert.equal(r.run('phase'), 'results');
        assert.ok(r.run('players.slice(1).some(p=>p.score>0)'));
    });
test('seeded bot judgments are reproducible despite cosmetic draws', () => {
    const outcomes = [];
    for (const draws of [0, 7]) {
        const r = runtime();
        r.g.ScratchMatchAPI.start({ playerCount: 10, seed: 555 });
        for (let i = 0; i < draws; i++)
            r.run('draw()');
        r.run("phraseIndex=7;createPhrase(7);phase='response';for(const n of notes){songTime=n.time;resolveBotsFor(n);songTime=n.time+.2;resolveBotsFor(n)}");
        outcomes.push(r.run('JSON.stringify(players.map(p=>[p.score,p.lives,p.perfect,p.good,p.misses]))'));
    }
    assert.equal(outcomes[0], outcomes[1]);
});
