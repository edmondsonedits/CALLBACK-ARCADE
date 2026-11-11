import { SKETCH_CURSE_LABELS, type SnapshotSketchRelay } from "../arcade/sketch-relay";
import type { NarratorScenario } from "../content/sketch-narrator-lines";
import { makeNarratorCue, type NarratorContext, type NarratorCue } from "./sketch-narrator";

/** Public snapshot facts only. Never inspect anonymous entry ownership or private prompts. */
export function showdownCues(snapshot: SnapshotSketchRelay, remaining: number | null, players: Array<{ id: string; nickname: string }>) {
  const d = snapshot.showdown; if (!d) return [];
  const base = `${snapshot.matchId}:${snapshot.round}:${snapshot.phase}:${d.phaseStartedAt}:${snapshot.revealIndex}`;
  const name = (id: string) => players.find(p => p.id === id)?.nickname ?? "our mystery artist";
  const elapsed = Math.max(0, d.phaseDuration - (remaining ?? d.phaseDuration));
  const allFacts = phaseFacts(snapshot);
  let scenario: NarratorScenario = snapshot.phase === "revealing" ? "artist-reveal" : snapshot.phase in allFacts ? snapshot.phase as NarratorScenario : "drawing";
  let facts = allFacts[snapshot.phase] ?? "Follow the instructions on your phone.";
  let context: NarratorContext = {};
  if (snapshot.phase === "drawing") {
    const time = d.sorceryLength === "quick" ? (d.phaseDuration > 120_000 ? "three minutes" : "two minutes") : d.phaseDuration > 240_000 ? "six minutes" : "four minutes";
    facts = snapshot.totalRounds === 3 && snapshot.round === 3
      ? `Draw your own final assignment on your phone. You have ${time}. The curse is lifted. All points are tripled.`
      : `Artists, your turn. Draw the shared prompt on your phone. You have ${time}.${d.curse?.selected ? ` The curse is ${SKETCH_CURSE_LABELS[d.curse.selected]}. All points are doubled.` : ""} Lock your sketch when ready.`;
    if (elapsed > 15_000) facts = facts.replace(`You have ${time}.`, `About ${Math.max(1, Math.ceil((remaining ?? 0) / 1000))} seconds remain.`);
  }
  const cardIndex = snapshot.phase === "showcase" ? Math.min(d.entries.length - 1, Math.floor(elapsed / Math.max(1, d.phaseDuration / Math.max(1, d.entries.length)))) : -1;
  if (snapshot.phase === "showcase") {
    context = { letter: d.entries[cardIndex]?.letter };
    if (d.fallback && cardIndex <= 0) { scenario = "fallback"; facts = "Magic unavailable. Anonymous original sketches. Remember the letters."; }
    else facts = cardIndex <= 0 ? `Our anonymous exhibition. Remember the letters. Drawing ${context.letter ?? "?"}.` : `Drawing ${context.letter ?? "?"}.`;
  }
  if (snapshot.phase === "revealing" && d.revealEntry?.playerId) {
    const e = d.revealEntry;
    scenario = e.place === 1 && (e.laughterPoints ?? 0) > 0 ? "round-winner" : "artist-reveal";
    context = { name: name(e.playerId!) };
    facts = `${scenario === "round-winner" ? "The room crowned this drawing a winner." : "The artist is revealed."} Here is the original sketch. Use your phone to animate your avatar.`;
  }
  if (snapshot.phase === "complete" && d.champions.length > 1) { scenario = "tie"; facts = "The exhibition is complete. Our tied winners share the crown."; }
  if(snapshot.phase === "round-results" && d.workshop?.intermission) facts="The points are settled. Which drawing made you laugh most? Nominate on your phone for the Edmondson Hall of Questionable Art. This honour does not change scores.";
  if(['halfway','complete'].includes(snapshot.phase)&&d.workshop?.hallWinners.length){const letters=d.workshop.hallWinners.map(id=>d.revealedEntries.find(e=>e.entryId===id)?.letter).filter(Boolean);if(letters.length)facts+=` The Edmondson Hall of Questionable Art welcomes drawing ${letters.join(' and drawing ')}.`;}
  const cues: NarratorCue[] = [];
  const add = (suffix: string, scene: NarratorScenario, lead: string, args: NarratorContext = {}, priority = 50) => cues.push(makeNarratorCue(`${base}:${suffix}`, scene, lead, args, snapshot.matchId, priority));
  add(cardIndex >= 0 ? `card:${cardIndex}` : "intro", scenario, facts, context, 80);
  if(snapshot.phase === "drawing" && d.workshop?.closeUntil){cues.unshift(makeNarratorCue(`${snapshot.matchId}:${snapshot.round}:workshop-close`,"drawing","The main sketches are sealed. Workshop artists, ten seconds to finish. Unfinished work will be saved.",{},snapshot.matchId,100));}
  else if(d.workshop?.reaction?.narrate&&["drawing","transforming","round-results"].includes(snapshot.phase)){const r=d.workshop.reaction;cues.unshift(makeNarratorCue(`${snapshot.matchId}:${snapshot.round}:reaction:${Math.floor(r.at/20000)}`,"drawing",r.kind==="applause"?"A little applause from the workshop. Standards are rising.":r.kind==="ink"?"The ink department is getting carried away.":"A little extra sparkle. Entirely within the imaginary budget.",{},snapshot.matchId,40));}
  if (cardIndex >= 0) {
    const cardDuration = d.phaseDuration / Math.max(1, d.entries.length);
    cues[0]!.budgetMs = Math.max(0, cardDuration - elapsed % cardDuration);
  }
  if (["drawing", "prompt-writing"].includes(snapshot.phase) && d.pendingPlayers.length === 1 && remaining !== null && elapsed > 18_000 && remaining > 15_000) {
    add(`last:${d.pendingPlayers[0]}`, snapshot.phase === "drawing" ? "last-drawing" : "last-prompt", snapshot.phase === "drawing" ? "One sketch left to lock." : "One prompt left to submit.", { name: name(d.pendingPlayers[0]!) }, 30);
  }
  if (snapshot.phase === "drawing" && elapsed >= 45_000 && elapsed < 65_000 && d.pendingPlayers.length > 1) add("idle", "drawing-idle", "", {}, 10);
  if (snapshot.phase === "transforming" && elapsed >= 45_000 && elapsed < 60_000) add("waiting", "transforming", "The sketches are still being processed. The game will keep moving.", {}, 10);
  if (remaining !== null && remaining > 0 && ["drawing", "prompt-writing", "prompt-voting", "laughter-voting", "artist-guessing", "final-preparation"].includes(snapshot.phase)) {
    if (snapshot.phase === "drawing" && remaining <= d.phaseDuration / 2 && remaining > d.phaseDuration / 2 - 10_000) add("half", "drawing-half", "Half your drawing time is gone.", {}, 95);
    if (snapshot.phase === "drawing" && remaining <= 60_000 && remaining > 50_000) add("minute", "minute", "One minute left to draw.", {}, 100);
    if (remaining <= 30_000 && remaining > 20_000 && d.phaseDuration >= 50_000) add("thirty", "thirty", snapshot.phase === "drawing" ? "Thirty seconds. Finish and lock your drawing." : "Thirty seconds. Submit your choice on your phone.", {}, 105);
    if (remaining <= 10_000) add("ten", "ten", `${remaining > 9000 ? "Ten" : Math.ceil(remaining / 1000)} seconds. Lock it in.`, {}, 110);
  }
  return cues;
}

function phaseFacts(s: SnapshotSketchRelay): Record<string, string> {
  const mult = s.showdown?.multiplier ?? 1;
  return {
    "prompt-writing": "Welcome to Sketch and Sorcery. Write one short, funny drawing prompt on your phone, or browse the examples.",
    "prompt-voting": `Rank three favourite prompts. The top ${s.totalRounds === 2 ? "two" : "three"} become our challenges. Original player prompts win tied votes.`,
    "curse-selection": "Last place chooses a drawing curse for everyone. Round two awards double points.",
    "final-preparation": "Choose your final prompt twist and starter on your phone. Your assignment stays private. Final points are tripled.",
    drawing: "Draw on your phone.",
    transforming: "Brushes down. The magic is processing your sketches. Artists stay secret until the reveal.",
    showcase: "Remember the drawing letters. Artists stay anonymous.",
    "laughter-voting": `Pick the drawing you enjoyed the most. Rank up to three on your phone: ${100 * mult}, ${75 * mult}, then ${50 * mult} points per ballot. No self-voting.`,
    "artist-guessing": `Guess who drew your favourites. Each correct artist earns ${50 * mult} bonus points. Lock your guesses on your phone.`,
    revealing: "Here are the original sketches and their artists.",
    "round-results": "Laughter points and artist bonuses are in.",
    halfway: s.totalRounds === 2 ? "Halfway! Your second drawing is next." : s.round === 1 ? "Next: a drawing curse and double points." : "Next: your final twist and triple points.",
    complete: `${s.totalRounds} rounds complete. Give our winners a cheer.`,
  };
}
