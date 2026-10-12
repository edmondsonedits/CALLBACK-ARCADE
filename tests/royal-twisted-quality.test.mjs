import test from "node:test";
import assert from "node:assert/strict";
import { runtime } from "../games/royal-twisted/tests/runtime-harness.mjs";

test("jump cannot reset upward velocity just after takeoff", () => {
  const r = runtime();
  r.run("requestJump(fighters[0]);fighters[0].vy=4.9;requestJump(fighters[0])");
  assert.equal(r.run("fighters[0].vy"), 4.9);
});
test("duck is held until every keyboard or pointer source releases", () => {
  const r = runtime();
  r.fire("keydown", { code: "ShiftLeft" });
  r.fire("keydown", { code: "KeyS" });
  r.fire("keyup", { code: "ShiftLeft" });
  assert.equal(r.run("fighters[0].duck"), true);
  r.fire("keyup", { code: "KeyS" });
  assert.equal(r.run("fighters[0].duck"), false);
});
test("jump while ducking buffers briefly; release launches once", () => {
  const r = runtime();
  r.fire("keydown", { code: "KeyS" });
  r.fire("keydown", { code: "Space" });
  r.fire("keyup", { code: "KeyS" });
  r.tick(0.025);
  assert.ok(r.run("fighters[0].jumpY") > 0);
  r.tick(1);
  assert.equal(r.run("fighters[0].jumpY"), 0);
});
test("held duck wins landing; expired buffers do not launch", () => {
  const r = runtime();
  r.run(
    "requestJump(fighters[0]);setDuck(fighters[0],true);requestJump(fighters[0])",
  );
  r.tick(1);
  assert.equal(r.run("fighters[0].duck"), true);
  r.run("setDuck(fighters[0],false)");
  r.tick(0.1);
  assert.equal(r.run("fighters[0].jumpY"), 0);
});
test("landing buffer launches once within 130ms", () => {
  const r = runtime();
  r.run("requestJump(fighters[0])");
  r.tick(0.7);
  r.run("requestJump(fighters[0])");
  r.tick(0.15);
  assert.ok(r.run("fighters[0].jumpY") > 0);
  r.tick(1);
  assert.equal(r.run("fighters[0].jumpY"), 0);
});
test("focus loss pauses and clears all contestants held inputs and buffers", () => {
  const r = runtime();
  r.run("fighters.forEach(f=>{setDuck(f,true);f.input.jumpBuffer=.13})");
  r.fire("blur");
  assert.equal(r.run("paused"), true);
  assert.equal(
    r.run("fighters.every(f=>!f.duck&&!f.input.duckHeld&&!f.input.jumpBuffer)"),
    true,
  );
});
test("remote actions cannot mutate posture during pause or countdown", () => {
  const r = runtime();
  for (const phase of ["countdown", "roundover", "matchover"]) {
    r.run(`phase='${phase}'`);
    assert.equal(r.game.RoyalTwisted.jump(), false);
    r.game.RoyalTwisted.duck(true);
    assert.equal(r.run("fighters[0].duck"), false);
  }
  r.run('phase="fight";paused=true');
  assert.equal(r.game.RoyalTwisted.input(0, "jump"), false);
});
test("gamepad disconnect releases duck and remote seats are not overwritten", () => {
  const r = runtime();
  r.pads[1] = { buttons: [{ pressed: false }, { pressed: true }] };
  r.run("pollGamepads()");
  assert.equal(r.run("fighters[1].duck"), true);
  r.pads[1] = null;
  r.run("pollGamepads()");
  assert.equal(r.run("fighters[1].duck"), false);
  r.game.RoyalTwisted.registerRemotePlayer(1);
  r.pads[1] = { buttons: [{ pressed: true }] };
  r.run("pollGamepads()");
  assert.equal(r.run("fighters[1].jumpY"), 0);
});
test("settings and Escape never resume simulation; Resume is explicit", () => {
  const r = runtime();
  r.click("#settingsBtn");
  r.click("#closeSettings");
  r.fire("keydown", { code: "Escape" });
  assert.equal(r.run("paused"), true);
  r.click("#resumeBtn");
  assert.equal(r.run("paused"), false);
});
for (const n of [2, 4, 10])
  test(`${n} contestants: seven distinct hits, pause-aware rounds, results and rematch`, () => {
    const r = runtime(n);
    for (let round = 0; round < 2; round++) {
      r.run('phase="fight"');
      for (let id = 1; id < n; id++)
        for (let hit = 1; hit <= 7; hit++) {
          r.run(
            `h={id:${id * 100 + hit},type:'low',checked:new Set()};hitFighter(fighters[${id}],h);hitFighter(fighters[${id}],h)`,
          );
          assert.equal(r.run(`fighters[${id}].lives`), 7 - hit);
          assert.equal(r.run(`fighters[${id}].alive`), hit < 7);
        }
      assert.equal(r.run("phase"), "roundover");
      r.run("paused=true");
      r.timers.slice(1).forEach((fn) => fn());
      r.tick(4);
      assert.equal(r.run("phase"), "roundover");
      r.run("paused=false");
      r.tick(3);
      assert.equal(r.run("phase"), round ? "matchover" : "countdown");
    }
    r.game.RoyalTwisted.restart();
    assert.equal(r.run("round"), 1);
    assert.equal(
      r.run("fighters.every(f=>f.alive&&f.lives===7&&f.roundWins===0)"),
      true,
    );
  });
test("setback is bounded and recovers without changing camera for bot hits", () => {
  const r = runtime();
  r.run('hitFighter(fighters[1],{type:"low",checked:new Set()})');
  assert.equal(r.run("cameraShake"), 0);
  r.run(
    'for(let i=0;i<6;i++)hitFighter(fighters[0],{type:"low",checked:new Set()})',
  );
  assert.equal(r.run("fighters[0].trackT"), 0.028);
  r.tick(8);
  assert.equal(r.run("fighters[0].trackT"), 0.115);
});
test("CAM-3R-23-U roundtrips and camera focus ignores a far-back bot", () => {
  const r = runtime();
  assert.equal(r.game.CallbackCamera.code(), "CAM-3R-23-U");
  r.game.CallbackCamera.set({ rotate: 90, zoom: 1.5, tilt: 20 });
  assert.equal(r.game.CallbackCamera.load("CAM-3R-23-U"), true);
  r.game.CallbackCamera.reset();
  assert.equal(r.game.CallbackCamera.code(), "CAM-3R-23-U");
  r.run("updateCamera(10,0)");
  const before = r.run("JSON.stringify(camera.target)");
  r.run("fighters[3].trackT=.028;updateCamera(10,0)");
  assert.equal(r.run("JSON.stringify(camera.target)"), before);
  r.run("fighters[0].trackT=.028;updateCamera(10,0)");
  assert.notEqual(r.run("JSON.stringify(camera.target)"), before);
});
for (const time of [0, 26, 66])
  for (const kind of ["low", "high"])
    test(`${kind} legal response at time ${time}; one collision outcome`, () => {
      const r = runtime();
      r.run(
        `roundTime=${time};h=createHazard('${kind}',fighters[0].trackT+currentSpeed()*.30);${kind === "low" ? "requestJump(fighters[0])" : "setDuck(fighters[0],true)"}`,
      );
      r.tick(0.65);
      assert.equal(r.run("fighters[0].lives"), 7);
      assert.equal(r.run("fighters[0].score"), 1);
      r.run("testHazard(h)");
      assert.equal(r.run("fighters[0].score"), 1);
    });

for (const time of [0, 26, 66])
  for (const pair of [
    ["low", "low"],
    ["low", "high"],
    ["high", "low"],
    ["high", "high"],
  ])
    test(`arrival spacing respects ${pair.join(">")} floor at ${time}s including recovery`, () => {
      const r = runtime();
      r.run(
        `roundTime=${time};patternQueue=[{type:'${pair[0]}',gap:0},{type:'${pair[1]}',gap:null}];spawnPattern();`,
      );
      let elapsed = 0;
      while (r.run("hazards.length") < 2 && elapsed < 3) {
        r.tick(1 / 120);
        elapsed += 1 / 120;
      }
      assert.equal(r.run("hazards.length"), 2);
      const [a, b] = r.run("hazards.map(h=>h.t)"),
        speed = r.run("currentSpeed()");
      // Independent numerical arrival prediction at the farthest setback and fastest closing rate.
      function arrival(t) {
        let elapsed = 0;
        while (t > 0.028 + 0.014) {
          const v = Math.min(0.185, speed + 0.00155 * elapsed) + 0.012;
          t -= v / 120;
          elapsed += 1 / 120;
        }
        return elapsed;
      }
      assert.ok(
        arrival(b) - arrival(a) >=
          r.run(`transitionFloor('${pair[0]}','${pair[1]}')`) - 1 / 120,
        `arrival gap ${arrival(b) - arrival(a)}s`,
      );
    });
for (const time of [0, 26, 66])
  test(`hard bot can legally jump low rod at ${time}s without a hidden height boost`, () => {
    const r = runtime(2, 9);
    r.run(
      `roundTime=${time};difficultyEl.value='hard';Math.random=()=>.5;createHazard('low',PLAYER_T+currentSpeed()*1);`,
    );
    r.tick(1.2);
    assert.equal(r.run("fighters[1].lives"), 7);
    assert.equal(r.run("fighters[1].score"), 1);
  });
test("collision boundaries honor safe height and only resolve once", () => {
  const r = runtime();
  r.run(
    'h=createHazard("low",PLAYER_T+TUNING.hazards.collisionWindow+.00001);testHazard(h)',
  );
  assert.equal(r.run("fighters[0].lives"), 7);
  r.run("h.t=PLAYER_T;fighters[0].jumpY=.4;testHazard(h);testHazard(h)");
  assert.equal(r.run("fighters[0].lives"), 6);
  r.run(
    'h=createHazard("low",fighters[0].trackT);fighters[0].jumpY=.40001;testHazard(h)',
  );
  assert.equal(r.run("fighters[0].score"), 1);
});
for (const time of [0, 26, 66])
  for (const pair of [
    ["low", "low"],
    ["low", "high"],
    ["high", "low"],
    ["high", "high"],
  ])
    test(`legal human sequence ${pair.join(">")} at ${time}s`, () => {
      const r = runtime();
      const gap = r.run(`transitionFloor('${pair[0]}','${pair[1]}')`);
      r.run(
        `roundTime=${time};fighters.slice(1).forEach(f=>f.controller='remote');createHazard('${pair[0]}',PLAYER_T+.014+currentSpeed()*.30);createHazard('${pair[1]}',PLAYER_T+.014+currentSpeed()*${0.3 + gap});`,
      );
      const act = (type) =>
        r.run(
          `setDuck(fighters[0],false);${type === "low" ? "requestJump(fighters[0])" : "setDuck(fighters[0],true)"}`,
        );
      act(pair[0]);
      r.tick(gap);
      act(pair[1]);
      r.tick(0.6);
      assert.equal(r.run("fighters[0].lives"), 7);
      assert.equal(r.run("fighters[0].score"), 2);
    });
test("reduced graphics keeps identical collision timing", () => {
  const run = (mode) => {
    const r = runtime(4, 77);
    r.run(`graphicsMode='${mode}';nextSpawn=.1`);
    r.tick(25);
    return r.run(
      "JSON.stringify(fighters.map(f=>({lives:f.lives,score:f.score,trackT:f.trackT,jumpY:f.jumpY})))",
    );
  };
  assert.equal(run("performance"), run("quality"));
});

test("cue separates next action from safe jump timing and shows recovery", () => {
  const r = runtime();
  r.run(
    'createHazard("low",PLAYER_T+TUNING.hazards.collisionWindow+currentSpeed()*.9);updateHUD()',
  );
  assert.match(r.el("#reactionCue").textContent, /NEXT.*JUMP/);
  r.run(
    "hazards[0].t=PLAYER_T+TUNING.hazards.collisionWindow+currentSpeed()*.3;updateHUD()",
  );
  assert.match(r.el("#reactionCue").textContent, /JUMP NOW/);
  r.run("hitFighter(fighters[0],hazards[0]);updateHUD()");
  assert.match(r.el("#reactionCue").textContent, /RECOVERING/);
});
for (const count of [2, 4, 10])
  for (const difficulty of ["easy", "normal", "hard"])
    test(`unassisted ${count}-contestant ${difficulty} match completes and rematches`, (t) => {
      const r = runtime(count, 55);
      r.run(
        `difficultyEl.value='${difficulty}';nextSpawn=1.35;for(var ticks=0;ticks<120*2400&&phase!=="matchover";ticks++){if(phase==="fight")fixedUpdate(FIXED_DT);updatePhase(FIXED_DT)}`,
      );
      t.diagnostic(
        r.run(
          "JSON.stringify({round,seconds:ticks/120,wins:fighters.map(f=>f.roundWins)})",
        ),
      );
      assert.equal(r.run("phase"), "matchover");
      assert.ok(r.run("fighters.some(f=>f.roundWins>=2)||round>=3"));
      r.game.RoyalTwisted.restart();
      assert.equal(r.run("phase"), "countdown");
      assert.equal(r.run("round"), 1);
    });

test("remote takeover clears the outgoing controller posture and queued jump", () => {
  const r = runtime();
  r.run('setDuck(fighters[1],true,"ai");fighters[1].input.jumpBuffer=.13');
  r.game.RoyalTwisted.registerRemotePlayer(1);
  r.game.RoyalTwisted.duck(false, 1);
  assert.equal(r.run("fighters[1].duck"), false);
  assert.equal(r.run("fighters[1].input.jumpBuffer"), 0);
});
test("implicit remote takeover clears the outgoing controller posture", () => {
  const r = runtime();
  r.run('setDuck(fighters[1],true,"ai")');
  r.game.RoyalTwisted.input(1, "duck", false);
  assert.equal(r.run("fighters[1].duck"), false);
});
test("pointer capture loss releases touch without releasing a keyboard hold", () => {
  const r = runtime();
  r.fire("keydown", { code: "KeyS" });
  const e = { preventDefault() {}, pointerId: 7 };
  r.el("#duckBtn").listeners.pointerdown[0](e);
  r.el("#duckBtn").listeners.lostpointercapture[0](e);
  assert.equal(r.run("fighters[0].duck"), true);
  r.fire("keyup", { code: "KeyS" });
  assert.equal(r.run("fighters[0].duck"), false);
});
test("paused gamepad and repeated keyboard jump cannot create buffered exploits", () => {
  const r = runtime();
  r.run("paused=true");
  r.pads[0] = { buttons: [{ pressed: true }] };
  r.run("pollGamepads()");
  assert.equal(r.run("fighters[0].input.jumpBuffer"), 0);
  r.run("paused=false");
  r.fire("keydown", { code: "Space" });
  r.tick(0.2);
  r.fire("keydown", { code: "Space", repeat: true });
  r.tick(1);
  assert.equal(r.run("fighters[0].jumpY"), 0);
});

test("a shared seventh-hit rod cannot crown an already eliminated contestant", () => {
  const r = runtime(2);
  r.run(
    'fighters.forEach(f=>{f.lives=1;f.controller="remote"});testHazard(createHazard("low",PLAYER_T))',
  );
  assert.equal(r.run("phase"), "roundover");
  assert.equal(r.run("fighters.every(f=>!f.alive)"), true);
  assert.equal(r.run("fighters.reduce((sum,f)=>sum+f.roundWins,0)"), 0);
});
test("legal responses sweep the supported speed range and setback positions", () => {
  for (let time = 0; time <= 66; time += 3)
    for (const track of [0.028, 0.07, 0.115])
      for (const type of ["low", "high"]) {
        const r = runtime(2);
        r.run(
          `roundTime=${time};fighters[0].trackT=${track};createHazard('${type}',${track}+.014+(currentSpeed()+${track < 0.115 ? 0.012 : 0})*.3);${type === "low" ? "requestJump(fighters[0])" : "setDuck(fighters[0],true)"}`,
        );
        r.tick(0.65);
        assert.equal(
          r.run("fighters[0].lives"),
          7,
          `${type}, ${time}s, track ${track}`,
        );
        assert.equal(r.run("fighters[0].score"), 1);
      }
});

test("paused keyboard arrows remain available to settings and camera controls", () => {
  const r = runtime();
  r.click("#settingsBtn");
  let prevented = false;
  r.fire("keydown", {
    code: "ArrowDown",
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, false);
});

test("results cue names the winner when compact layout hides the host message", () => {
  const r = runtime();
  r.run('phase="matchover";say("RUFUS takes the crown.");updateHUD()');
  assert.match(r.el("#reactionCue").textContent, /RUFUS/);
});
test("a suspended audio context can resume on the next interaction", () => {
  const r = runtime();
  r.run(
    'var resumes=0;audioCtx={state:"suspended",resume(){resumes++;return Promise.resolve()}};initAudio()',
  );
  assert.equal(r.run("resumes"), 1);
});

test("pause preserves a bots sampled duck response without rerolling its plan", () => {
  const r = runtime(2);
  r.run(
    'Math.random=()=>.5;difficultyEl.value="hard";createHazard("high",PLAYER_T+.014+currentSpeed()*.5)',
  );
  r.tick(0.3);
  const plan = r.run("JSON.stringify(fighters[1].aiPlan)");
  assert.equal(r.run("fighters[1].duck"), true);
  r.run("togglePause(true);togglePause(true)");
  assert.equal(r.run("fighters[1].duck"), false);
  r.run("togglePause(false)");
  assert.equal(r.run("JSON.stringify(fighters[1].aiPlan)"), plan);
  r.tick(0.3);
  assert.equal(r.run("fighters[1].lives"), 7);
  assert.equal(r.run("fighters[1].score"), 1);
});

test("actual animation loop pauses accumulation and transitions once after resume", () => {
  const r = runtime(2);
  r.game.requestAnimationFrame = () => {};
  r.run(
    'updateVisuals=()=>{};renderer={render(){}};phase="roundover";phaseTimer=.01;lastRoundWinner=fighters[0];fighters[0].roundWins=2;paused=true;accumulator=.05;animate(1000)',
  );
  assert.equal(r.run("phase"), "roundover");
  assert.equal(r.run("accumulator"), 0);
  r.run("togglePause(false);animate(1020)");
  assert.equal(r.run("phase"), "matchover");
  r.run("animate(1040)");
  assert.equal(r.run("fighters[0].roundWins"), 2);
  r.game.RoyalTwisted.restart();
  r.run("updatePhase(3.4);animate(1060)");
  assert.ok(r.run("roundTime") > 0);
  r.run("togglePause(true)");
  const time = r.run("roundTime");
  r.run("animate(1080)");
  assert.equal(r.run("roundTime"), time);
});
