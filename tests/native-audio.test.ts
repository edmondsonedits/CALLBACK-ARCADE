import assert from "node:assert/strict";
import test from "node:test";
import type { SnapshotSketchRelay } from "../lib/arcade/sketch-relay";
import { observeSketchAudio, sketchAudioEvents, sketchMusicContext } from "../lib/game/native-audio";

function snapshot(phase: SnapshotSketchRelay["phase"] = "drawing"): SnapshotSketchRelay {
  return { matchId: "match-one", round: 1, totalRounds: 2, phase, deadline: 12000, players: ["p1","p2","p3"], totalPlayers: 3, submittedCount: 0, scores: {p1:0,p2:0,p3:0}, revealIndex: 0, revealTotal: 0, applauseOptions: [], applauded: false };
}

test("native music follows actual task phases and reserves celebration for results", () => {
  for (const phase of ["prompt-writing","drawing","redrawing","captioning"]) assert.equal(sketchMusicContext(phase), "thinking");
  for (const phase of ["prompt-voting","laughter-voting","artist-guessing"]) assert.equal(sketchMusicContext(phase), "voting");
  for (const phase of ["showcase","revealing","transforming","transforming-redraw"]) assert.equal(sketchMusicContext(phase), "game");
  for (const phase of ["round-results","complete","halfway"]) assert.equal(sketchMusicContext(phase), "results");
  assert.equal(sketchMusicContext("drawing", true), "menu");
});

test("initial native snapshot and repeated polls do not replay historical cues", () => {
  const room = snapshot(); room.submittedCount = 2;
  const frame = observeSketchAudio(room, 6000);
  assert.deepEqual(sketchAudioEvents(null, frame), []);
  assert.deepEqual(sketchAudioEvents(frame, observeSketchAudio(room, 5000)), []);
  assert.deepEqual(sketchAudioEvents(frame, {...frame, submittedCount:1}), []);
});

test("accepted native submissions cue their action and voting completion only once", () => {
  const room = snapshot("laughter-voting");
  const before = observeSketchAudio(room, 10000);
  const first = observeSketchAudio({...room,submittedCount:1},9000);
  assert.deepEqual(sketchAudioEvents(before,first).map(c=>c.role), ["vote-lock"]);
  const all = observeSketchAudio({...room,submittedCount:3},8000);
  assert.deepEqual(sketchAudioEvents(first,all).map(c=>c.role), ["vote-lock","all-votes"]);
  assert.deepEqual(sketchAudioEvents(all,all), []);
  assert.deepEqual(sketchAudioEvents(before,first,true), []);
  const drawing = snapshot();
  assert.deepEqual(sketchAudioEvents(observeSketchAudio(drawing,10000),observeSketchAudio({...drawing,submittedCount:1},9000)).map(c=>c.role), ["response-lock"]);
});

test("public native reveals, scoreboards and tied champions use matching cues", () => {
  const room = snapshot("artist-guessing");
  const before = observeSketchAudio(room,10000);
  const reveal = observeSketchAudio({...room,phase:"revealing",revealIndex:1},9000);
  assert.deepEqual(sketchAudioEvents(before,reveal).map(c=>c.role), ["reveal"]);
  const results = observeSketchAudio({...room,phase:"round-results",scores:{p1:2,p2:2,p3:0}},8000);
  assert.deepEqual(sketchAudioEvents(reveal,results).map(c=>c.role), ["score"]);
  const complete = {...results,identity:"match-one:1:complete",phase:"complete",championsCount:2};
  assert.deepEqual(sketchAudioEvents(results,complete).map(c=>c.role), ["tie"]);
  assert.deepEqual(sketchAudioEvents(results,{...complete,matchId:"new-match"}), []);
});

test("showcase sounds follow the visible card without leaking artist identity", () => {
  const room = snapshot("showcase");
  room.showdown = {phaseStartedAt:0,phaseDuration:18000,examples:[],entries:[{entryId:"card-a",letter:"A",image:{status:"FALLBACK"}},{entryId:"card-b",letter:"B",image:{status:"FALLBACK"}}],submitted:false,pendingPlayers:[],revealedEntries:[],fallback:true,champions:[]};
  const first = observeSketchAudio(room,18000), second = observeSketchAudio(room,8000);
  assert.deepEqual(sketchAudioEvents(first,observeSketchAudio(room,13000)), [], "audio waits for the current server-sized spotlight");
  const cues = sketchAudioEvents(first,second);
  assert.deepEqual(cues.map(c=>c.role), ["card"]);
  assert.ok(cues[0]!.key.includes("card-b"));
  assert.equal(JSON.stringify(cues).includes("playerId"), false);
});


test("revealed artist moves get one distinct cue per fresh animation", () => {
  const room = snapshot("revealing");
  room.showdown = {phaseStartedAt:0,phaseDuration:18000,examples:[],entries:[],submitted:false,pendingPlayers:[],revealedEntries:[],fallback:true,champions:[]};
  const before = observeSketchAudio(room,15000);
  for (const name of ["dance","cheer","wave","bow","shrug","facepalm"] as const) {
    const current = observeSketchAudio({...room,showdown:{...room.showdown,emote:{name,playerId:"p1",sequence:1,expiresAt:20000}}},14000);
    assert.deepEqual(sketchAudioEvents(before,current).map(cue=>cue.role), [`emote-${name}`]);
    assert.deepEqual(sketchAudioEvents(current,current), []);
    assert.deepEqual(sketchAudioEvents(null,current), []);
    assert.deepEqual(sketchAudioEvents(before,current,true), []);
  }
});
