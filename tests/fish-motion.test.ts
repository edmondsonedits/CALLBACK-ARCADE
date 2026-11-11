import assert from "node:assert/strict";
import test from "node:test";
import { advanceSwimTime, chaseFeint, crossedFishCue, directedVictim, sampleSwim, separateFish, sharkAt, sharkMouth, swimPersonality, type PresentationEvent } from "../lib/fish-motion";

test("fish paths are bounded, seeded, varied, head first and never inverted across a long aquarium", () => {
  const traits = Array.from({ length: 10 }, (_, i) => swimPersonality(`fish-${i}`));
  assert.deepEqual(traits[0], swimPersonality("fish-0"));
  assert.equal(new Set(traits.map(p => p.beat)).size, 10);
  for (let time = 0; time < 900; time += .23) {
    const poses = separateFish(traits.map(p => sampleSwim(p, time)));
    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i]!;
      assert.ok(pose.x >= .14 && pose.x <= .86);
      assert.ok(pose.y >= .18 && pose.y <= .8);
      assert.ok(pose.yaw >= 0 && pose.yaw <= 1 && Math.abs(pose.pitch) <= .15);
      const free = sampleSwim(traits[i]!, time), next = sampleSwim(traits[i]!, time + .001);
      if (free.facing === next.facing) assert.ok((next.x - free.x) * free.facing >= -1e-9, "the nose faces the horizontal velocity, including a slowing turn");
      else assert.ok(free.yaw < .2 && next.yaw < .2, "a side swap happens only in the narrowed yaw pose");
    }
  }
});

test("reduced motion is a stable still and sampling never accumulates deformation drift", () => {
  const p = swimPersonality("ink");
  assert.deepEqual(sampleSwim(p, 3, true), sampleSwim(p, 300, true));
  assert.equal(sampleSwim(p, 3, true).amplitude, 0);
  assert.equal(sampleSwim(p, 3, true).yaw, 1, "a still never freezes on the unreadable edge of a turn");
  assert.equal(sampleSwim(p, 3, true).pitch, 0);
  const first = sampleSwim(p, 1);
  sampleSwim(p, 10000);
  assert.deepEqual(sampleSwim(p, 1), first);
});

test("both approach variations put the scheduled victim inside the authored mouth anchor", () => {
  for (const kind of ["hunt", "final-two"] as const) {
    for (let i = 0; i < 12; i++) {
      const event: PresentationEvent = { id: `shot-${i}`, kind, elapsedMs: 2500, durationMs: 3500, biteAtMs: 2500, targetEntryId: "only-this-fish" };
      for (const aspect of [1, 16 / 9, 2.4]) {
        const shark = sharkAt(event, 3, aspect)!;
        const free = sampleSwim(swimPersonality(i), 3);
        const victim = directedVictim(free, free, event, shark, aspect);
        const mouth = sharkMouth(shark, aspect);
        assert.equal(victim.x, mouth.x);
        assert.equal(victim.y, mouth.y);
        assert.ok(victim.opacity < 1 && victim.scale < free.scale);
      }
    }
  }
});

test("peaceful awards never produce a shark or a bite cue; seek does not replay bites", () => {
  const peaceful: PresentationEvent = { id: "awards", kind: "peaceful-awards", elapsedMs: 5000, durationMs: 12000 };
  assert.equal(sharkAt(peaceful, 5), undefined);
  assert.equal(crossedFishCue({ id: "before", elapsedMs: 0 }, peaceful), undefined);
  const hunt: PresentationEvent = { id: "hunt-one", kind: "hunt", elapsedMs: 2600, durationMs: 4000, biteAtMs: 2500 };
  assert.equal(crossedFishCue(null, hunt), undefined);
  assert.equal(crossedFishCue({ id: "hunt-one", elapsedMs: 0 }, hunt), undefined);
  assert.equal(crossedFishCue({ id: "hunt-one", elapsedMs: 2600 }, hunt), undefined);
  assert.equal(crossedFishCue({ id: "hunt-one", elapsedMs: 2400 }, hunt)?.kind, "bite");
  assert.equal(crossedFishCue({ id: "old-shot", elapsedMs: 2400 }, hunt), undefined);
});

test("the charge sends the shark off screen and has no elimination target derivation", () => {
  const charge: PresentationEvent = { id: "charge", kind: "charge", elapsedMs: 3999, durationMs: 4000, targetEntryId: "server-winner" };
  const shark = sharkAt(charge, 5)!;
  assert.ok(shark.x > 1.25 && shark.opacity < .01);
  assert.equal(charge.targetEntryId, "server-winner");
});


test("shark choreography leaves room for the heading and tank floor in wide host tanks", () => {
  for (const kind of ["hunt", "final-two"] as const) for (let variation = 0; variation < 12; variation++) {
    for (const aspect of [16 / 9, 2.4, 3]) for (let elapsedMs = 0; elapsedMs <= 4000; elapsedMs += 100) {
      const event: PresentationEvent = { id: `shot-${variation}`, kind, elapsedMs, durationMs: 4000, biteAtMs: 2900 };
      const shark = sharkAt(event, elapsedMs / 1000, aspect)!;
      // The authored dorsal fin reaches -.95 and the open lower jaw reaches +.75.
      assert.ok(shark.y - .95 * shark.size * aspect >= .18, `${kind} dorsal fin crowds heading at ${aspect}, ${elapsedMs}`);
      assert.ok(shark.y + .75 * shark.size * aspect <= .98, `${kind} jaw clips the floor at ${aspect}, ${elapsedMs}`);
    }
  }
});

test("single-drawing fish turn fully toward the viewer and cover the tank with varying depth", () => {
  const p = swimPersonality("runtime-volume");
  const samples = Array.from({ length: 601 }, (_, i) => sampleSwim(p, i / 20));
  assert.ok(Math.min(...samples.map(p => p.yaw)) < .015, "a continuous turn reaches the volume view");
  assert.ok(Math.max(...samples.map(p => p.x)) - Math.min(...samples.map(p => p.x)) > .6);
  assert.ok(Math.max(...samples.map(p => p.scale)) - Math.min(...samples.map(p => p.scale)) > .15);
  assert.ok(Math.max(...samples.map(p => p.depth)) - Math.min(...samples.map(p => p.depth)) > .1);
  let travel = 0; for (let i=1;i<201;i++) travel += Math.abs(samples[i]!.x-samples[i-1]!.x);
  assert.ok(travel > .75, "fish visibly travel during a ten-second watch");
});

test("the shark victim turns continuously from either copied side of its PNG", () => {
 const start={...sampleSwim(swimPersonality("victim"),0),facing:-1 as const,yaw:1,turn:0};
 const a:PresentationEvent={id:"continuous-bite",kind:"hunt",elapsedMs:2320,durationMs:4200,biteAtMs:3000};
 const b={...a,elapsedMs:2323}; const shark={...sharkAt(a,0)!,facing:1 as const};
 const pa=directedVictim(start,start,a,shark,16/9),pb=directedVictim(start,start,b,shark,16/9);
 assert.ok(Math.abs(pa.facing*pa.yaw-pb.facing*pb.yaw)<.02,"turn cannot pop between two flat sides during the bite approach");
});


test("missed frames do not slow analytic swimming and pause holds exact positions", () => {
  let time=0;for(let i=0;i<10;i++)time=advanceSwimTime(time,.2,false);
  assert.ok(Math.abs(time-2)<1e-9);
  assert.equal(advanceSwimTime(time,5,true),time);
  assert.equal(advanceSwimTime(time,NaN,false),time);
});

test("fish alternate between coasting and active strokes with vertical travel", () => {
  const traits=swimPersonality("coast-and-dart");
  const poses=Array.from({length:1200},(_,i)=>sampleSwim(traits,i/20));
  assert.ok(Math.max(...poses.map(p=>p.y))-Math.min(...poses.map(p=>p.y))>.18);
  assert.ok(Math.max(...poses.map(p=>p.amplitude))/Math.min(...poses.map(p=>p.amplitude))>2);
  for(let i=1;i<poses.length;i++)assert.ok(Math.abs(poses[i]!.x-poses[i-1]!.x)<.02);
});

test("shark feints follow decoys then rejoin the exact ranked-victim intercept",()=>{
 const event:PresentationEvent={id:"feint",kind:"hunt",elapsedMs:650,durationMs:4200,biteAtMs:3000,targetEntryId:"ranked-last"};
 const base=sharkAt(event,.65)!;const school=[sampleSwim(swimPersonality(1),.65),sampleSwim(swimPersonality(2),.65)];
 assert.notDeepEqual(chaseFeint(base,event,school,16/9),base);
 const bite={...event,elapsedMs:3000};const contact=sharkAt(bite,3)!;
 assert.deepEqual(chaseFeint(contact,bite,school,16/9),contact);
 assert.equal(event.targetEntryId,"ranked-last");
});


test("fast swimming has a stronger body wave than slow coasting", () => {
  const p = swimPersonality("speed-wave");
  const samples = Array.from({length:1000}, (_, i) => {
    const t = i / 20, pose = sampleSwim(p,t), next = sampleSwim(p,t + .001);
    return {speed: Math.hypot(next.x-pose.x,next.y-pose.y)/.001, amplitude:pose.amplitude};
  }).sort((a,b)=>a.speed-b.speed);
  assert.ok(samples.at(-1)!.amplitude > samples[0]!.amplitude * 2);
  assert.ok(samples.every(s=>s.amplitude >= .016 && s.amplitude <= .102));
});
