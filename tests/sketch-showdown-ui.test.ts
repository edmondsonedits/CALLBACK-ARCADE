import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createSketchRelayMatch, advanceSketchRelay, sketchRelaySnapshot } from "../server/arcade/sketch_relay";
import { showdownCopy, showdownCues, showdownProgress } from "../lib/game/sketch-showdown-script";
import { SKETCH_TRANSFORM_PROMPT } from "../lib/sketch-transform-prompt";

const shims = registerHooks({ load(url, context, nextLoad) { return url.endsWith(".css") ? { format: "module", source: "export default {}", shortCircuit: true } : nextLoad(url, context); } });
const { SketchShowdownStage } = await import("../app/components/sketch-relay/SketchShowdownStage");
const { SketchShowdownController } = await import("../app/components/sketch-relay/SketchShowdownController");
shims.deregister();
const players = ["a", "b", "c"];
const renderedText=(text:string)=>renderToStaticMarkup(createElement('span',null,text)).slice(6,-7);
function at(phase: string, round: number) {
  let m = createSketchRelayMatch({ matchId: "render", players, botIds: players, now: 1000, rulesVersion: 3 });
  for (let i = 0; i < 80; i++) { if (m.phase === phase && m.round === round) return m; m = advanceSketchRelay(m, m.deadline).state; }
  throw new Error("Missing phase");
}
function stage(m: ReturnType<typeof at>) { return renderToStaticMarkup(createElement(SketchShowdownStage, { snapshot: sketchRelaySnapshot(m, { role: "host" }), roomCode: "SHOW", allowAudio: false })); }
function phone(m: ReturnType<typeof at>, selfId = "a") { return renderToStaticMarkup(createElement(SketchShowdownController, { snapshot: { role: "player", selfId, code: "SHOW", paused: false, players: [], sketchRelay: sketchRelaySnapshot(m, { role: "player", playerId: selfId }) } as never, remaining: m.deadline - m.updatedAt, act: async () => {}, refresh: () => {} })); }

test("final stage withholds the individual assignment until that artist is revealed, phones separate the AI instruction", () => {
  const gallery = at("artist-guessing", 3);
  const html = stage(gallery);
  for (const c of gallery.chains.filter(c => c.round === 3)) assert.equal(html.includes(renderedText(c.promptChoices[0]!)), false);
  const reveal = advanceSketchRelay(gallery, gallery.deadline).state;
  const entry = sketchRelaySnapshot(reveal, { role: "host" }).showdown!.revealEntry!;
  // Bot prompt selection can include apostrophes and ampersands; compare the
  // exact React-escaped text rather than a randomly unescaped HTML substring.
  const renderedPrompt=renderedText(entry.prompt!);
  assert.ok(stage(reveal).includes(renderedPrompt));
  const controller = phone(reveal);
  assert.ok(controller.includes(renderedPrompt)); assert.match(controller, /Drawing assignment/);
  assert.match(controller, /<summary>AI transformation prompt<\/summary>/);
  assert.ok(controller.includes(SKETCH_TRANSFORM_PROMPT));
  const archive = phone(at("complete", 3)); assert.match(archive, /Explore our exhibition/); assert.match(archive, /Drawing details &amp; download/);
});
test("new narration names all three rounds and displays actual multiplied vote and guess values", () => {
  for (const round of [1, 2, 3]) {
    const vote = sketchRelaySnapshot(at("laughter-voting", round), { role: "host" });
    assert.ok(showdownCopy(vote).instruction.includes(String(100 * round)));
    assert.ok(phone(at("artist-guessing", round)).includes(`${50 * round} bonus points`));
    assert.equal(showdownCues(vote, vote.showdown!.phaseDuration, []).some(c => /Two prompts|top two/.test(c.text)), false);
  }
  assert.match(stage(at("halfway", 1)), /One down. Two to draw/);
  assert.match(stage(at("halfway", 2)), /One last spell/);
});

test("preparation, creation and result phases always identify the current task on the TV rail", () => {
  const cases = [
    ["prompt-writing", "Write prompts"], ["prompt-voting", "Elect prompts"],
    ["curse-selection", "Cast curse"], ["final-preparation", "Final twist"],
    ["drawing", "Draw"], ["transforming", "Enchant"], ["showcase", "Watch"],
    ["laughter-voting", "Vote"], ["artist-guessing", "Guess"], ["revealing", "Reveal"],
    ["halfway", "Next round"], ["round-results", "Results"], ["complete", "Results"],
  ] as const;
  for (const [phase, label] of cases) assert.deepEqual(showdownProgress(phase).filter(step => step.active).map(step => step.label), [label]);
  assert.match(stage(at("prompt-writing", 1)), /aria-current="step"/);
});
test('the TV celebrates the settled Hall honour using already revealed artwork',()=>{
 const m=at('halfway',1);m.showdown!.version=4;m.botIds=[];
 const c=m.chains.find(c=>c.round===1&&c.originalPlayerId==='a')!;c.drawing!.practice=false;c.drawing!.assetId='human-art';
 m.showdown!.workshop={leases:[],closedRound:1,closeUntil:null,intermissionRound:1,ballots:[],reactions:[],nominations:[{actor:'b',round:1,entry:c.chainId}]};
 const html=renderToStaticMarkup(createElement(SketchShowdownStage,{snapshot:sketchRelaySnapshot(m,{role:'host'}),roomCode:'SHOW',allowAudio:false,players:players.map(id=>({id,nickname:`Human ${id}`}))}));
 assert.match(html,/data-testid="sorcery-hall-honours"/);assert.match(html,/Edmondson Hall honour/);assert.match(html,/Human a/);
});
