import { PlayerActionSchema, type PlayerAction } from "../../lib/contracts";
import type { RoomState } from "../types";
import { arenaSurvivorSnapshot } from "./arena_survivor";
import { buzzwortSnapshot } from "./buzzwort";
import { chaosSnapshot } from "./chaos_kommando";
import { drawGuessSnapshot } from "./draw_guess";
import { driftRacerSnapshot } from "./drift_racer";
import { dungeonPartySnapshot } from "./dungeon_party";
import { flatterfluffSnapshot } from "./flatterfluff";
import { imposterSnapshot } from "./imposter";
import { kartentischSnapshot } from "./kartentisch";
import { magicArenaSnapshot } from "./magic_arena";
import { magicDuellSnapshot } from "./magic_duell";
import { minionsTdSnapshot } from "./minions_td";
import { pantomimeSnapshot } from "./pantomime";
import { schaetzoramaSnapshot } from "./schaetzorama";
import { schattenjagdSnapshot } from "./schattenjagd";
import { wordTilesSnapshot } from "./word_tiles";
import { WORD_TILES_DICTIONARY } from "./word_tiles";

const makeAction = (state: RoomState, type: string, payload: Record<string, unknown>): PlayerAction => PlayerActionSchema.parse({
  type, actionId: `bot:${state.arcadeMatch?.id}:${state.version}:${type}`, roundId: state.currentRound?.id ?? state.arcadeMatch?.id ?? "arcade", expectedPhase: state.phase, payload,
});

function index(seed: string, length: number): number {
  if (!length) return 0;
  let hash = 2166136261;
  for (const char of seed) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) % length;
}

function relatedClue(word: string): string {
  const clues: Record<string, string> = {
    cinnamon: "spice", colander: "strainer", apricot: "fruit", tidepool: "shore", moss: "green", canyon: "cliff", mosaic: "tiles", scarecrow: "field", kite: "wind", ferry: "crossing", roundabout: "traffic", saddle: "riding", whistle: "signal", echo: "repeat", metronome: "rhythm", lighthouse: "coast", greenhouse: "plants", workshop: "tools", hailstone: "storm", fog: "visibility", aurora: "sky", jigsaw: "puzzle", marbles: "glass", "yo-yo": "string",
  };
  return clues[word.toLocaleLowerCase()] ?? "something familiar";
}

const GUESS_WORDS = ["garden", "bicycle", "dragon", "storm", "castle", "coffee", "river", "puzzle", "train", "lantern", "sailboat", "penguin", "spaceship", "wizard", "market", "thunder"];

/** Returns a validated ordinary player action using only the selected bot's player snapshot. */
export function arcadeBotAction(state: RoomState, playerId: string): PlayerAction | null {
  const matchId = state.arcadeMatch?.id;
  if (state.gameLength !== "arcade" || state.phase !== "ARCADE_ACTIVE" || !matchId) return null;
  const viewer = { role: "player" as const, playerId };
  const seed = `${state.code}:${matchId}:${state.arcadeGameId}:${playerId}`;
  switch (state.arcadeGameId) {
    case "schaetzorama": {
      if (!state.schaetzorama) return null;
      const view = schaetzoramaSnapshot(state.schaetzorama, viewer);
      if (view.phase !== "estimating" || view.submitted) return null;
      return makeAction(state, "SUBMIT_SCHAETZORAMA_ESTIMATE", { matchId, round: view.round, estimate: Math.round((view.min + view.max) / 2) });
    }
    case "imposter": {
      if (!state.imposter) return null;
      const view = imposterSnapshot(state.imposter, viewer);
      if (view.phase === "cluing" && !view.submitted) {
        const clue = view.assignment?.role === "civilian" && view.assignment.word ? relatedClue(view.assignment.word) : ["everyday", "familiar", "interesting"][index(seed, 3)]!;
        return makeAction(state, "SUBMIT_IMPOSTER_CLUE", { matchId, round: view.round, clue });
      }
      if (view.phase === "voting" && !view.submitted) {
        const candidates = view.clues.filter((entry) => entry.playerId !== playerId).map((entry) => entry.playerId);
        if (!candidates.length) return null;
        return makeAction(state, "SUBMIT_IMPOSTER_VOTE", { matchId, round: view.round, targetPlayerId: candidates[index(seed + ":vote:" + view.clues.map((clue) => clue.clue).join("|"), candidates.length)]! });
      }
      return null;
    }
    case "buzzwort": {
      if (!state.buzzwort) return null;
      const view = buzzwortSnapshot(state.buzzwort, viewer);
      if (view.phase === "clue" && view.clueGiverId === playerId && !view.submitted && view.assignment?.card) {
        const card = view.assignment.card;
        const clue = [relatedClue(card.word), "connection", "association"].find((candidate) => candidate.toLocaleLowerCase() !== card.word.toLocaleLowerCase() && !card.tabooWords.some((taboo) => candidate.toLocaleLowerCase().includes(taboo.toLocaleLowerCase()))) ?? "connection";
        return makeAction(state, "SUBMIT_BUZZWORT_CLUE", { matchId, round: view.round, attempt: view.attempt, text: clue });
      }
      if (view.phase === "guess" && view.guesserId === playerId && !view.submitted) {
        const clue = view.currentClue?.toLocaleLowerCase() ?? "";
        const match = GUESS_WORDS.find((word) => clue.includes(word.slice(0, 3)));
        return makeAction(state, "SUBMIT_BUZZWORT_GUESS", { matchId, round: view.round, attempt: view.attempt, guess: match ?? GUESS_WORDS[index(seed + ":guess:" + view.attempt, GUESS_WORDS.length)]! });
      }
      return null;
    }
    case "pantomime": {
      if (!state.pantomime) return null;
      const view = pantomimeSnapshot(state.pantomime, viewer);
      if (view.phase !== "acting") return null;
      if (playerId === view.performerId && !state.pantomime.performanceCue) {
        const prompt = view.assignment?.prompt?.toLocaleLowerCase() ?? "";
        const cue = /horse|dog|cat|penguin|bird|butterfly|shark|dragon|squirrel|sheep|crocodile|kangaroo|fish|ghost|robot|knight|pirate|king|mime/iu.test(prompt)
          ? "Mime a creature or character with a clear repeated movement and a big reaction."
          : /building|making|planting|pitching|carrying|flipping|kneading|mixing|tuning|steering|climbing|reeling|searching|opening|brushing|taking|reading|sawing|fighting|swatting|eating|trying/iu.test(prompt)
            ? "Show the task with an invisible object, then exaggerate when something goes wrong."
            : "Use a broad action, a clear shape, and one exaggerated reaction.";
        return makeAction(state, "SUBMIT_PANTOMIME_PERFORMANCE", { matchId, cue });
      }
      if (playerId === view.performerId || view.submitted) return null;
      return makeAction(state, "SUBMIT_PANTOMIME_GUESS", { matchId, round: view.round, attempt: view.attempt, guess: GUESS_WORDS[index(seed + ":mime:" + view.attempt, GUESS_WORDS.length)]! });
    }
    case "zeichnen-und-erraten": {
      if (!state.drawGuess) return null;
      const view = drawGuessSnapshot(state.drawGuess, viewer);
      if (view.phase === "drawing" && playerId === view.artistId && !view.submitted && view.assignment?.prompt) {
        const prompt = view.assignment.prompt.toLocaleLowerCase();
        const circle = (cx: number, cy: number, rx: number, ry: number) => Array.from({ length: 9 }, (_, point) => ({ x: Math.round(cx + Math.cos(point * Math.PI / 4) * rx), y: Math.round(cy + Math.sin(point * Math.PI / 4) * ry) }));
        const shape = prompt.includes("whale") || prompt.includes("fish") ? [circle(500, 500, 240, 120), [{ x: 250, y: 500 }, { x: 120, y: 420 }, { x: 120, y: 580 }, { x: 250, y: 500 }]]
          : prompt.includes("lighthouse") ? [[{ x: 420, y: 800 }, { x: 450, y: 250 }, { x: 550, y: 250 }, { x: 580, y: 800 }, { x: 420, y: 800 }], [{ x: 450, y: 250 }, { x: 500, y: 120 }, { x: 550, y: 250 }]]
          : prompt.includes("bicycle") ? [circle(300, 650, 170, 170), circle(700, 650, 170, 170), [{ x: 300, y: 650 }, { x: 480, y: 400 }, { x: 700, y: 650 }, { x: 300, y: 650 }]]
          : [circle(500, 430, 210, 180), [{ x: 330, y: 580 }, { x: 280, y: 820 }], [{ x: 600, y: 580 }, { x: 680, y: 820 }]];
        const drawing = shape.map((points) => ({ color: "#202040", width: 5, points }));
        return makeAction(state, "SUBMIT_DRAW_GUESS_DRAWING", { matchId, round: view.round, drawing });
      }
      if (view.phase === "guessing" && playerId !== view.artistId && !view.submitted) return makeAction(state, "SUBMIT_DRAW_GUESS", { matchId, round: view.round, attempt: view.attempt, guess: GUESS_WORDS[index(seed + ":draw:" + view.attempt, GUESS_WORDS.length)]! });
      return null;
    }
    case "arena-survivor": {
      if (!state.arenaSurvivor) return null;
      const view = arenaSurvivorSnapshot(state.arenaSurvivor, viewer);
      if (view.phase !== "answering" || view.submitted) return null;
      const safest = view.scenario.choices.find((choice) => /shelter|wait|stay|cover|signal|slow/iu.test(choice.text));
      return makeAction(state, "SUBMIT_ARENA_SURVIVOR_CHOICE", { matchId, round: view.round, choiceId: safest?.id ?? view.scenario.choices[index(seed, view.scenario.choices.length)]!.id });
    }
    case "chaos-kommando": {
      if (!state.chaosKommando) return null;
      const view = chaosSnapshot(state.chaosKommando, viewer);
      if (view.phase !== "choosing" || view.submitted) return null;
      return makeAction(state, "SUBMIT_CHAOS_TOOL", { matchId, missionNumber: view.missionNumber, toolId: view.mission.tools[index(seed, view.mission.tools.length)]!.id });
    }
    case "magic-arena": {
      if (!state.magicArena) return null;
      const view = magicArenaSnapshot(state.magicArena, viewer);
      if (view.phase !== "choosing" || view.submitted) return null;
      return makeAction(state, "SUBMIT_MAGIC_ARENA_ACTION", { matchId, round: view.round, action: view.energy[playerId]! > 0 ? "strike" : "focus" });
    }
    case "magic-duell": {
      if (!state.magicDuell) return null;
      const view = magicDuellSnapshot(state.magicDuell, viewer);
      if (view.phase === "drafting" && !view.draftSubmitted) return makeAction(state, "SUBMIT_MAGIC_DUELL_LOADOUT", { matchId, spellIds: view.spells.slice(0, 3).map((spell) => spell.id) });
      if (view.phase === "casting" && !view.submitted && view.ownLoadout?.length) {
        const affordable = view.ownLoadout.map((id) => view.spells.find((candidate) => candidate.id === id)).filter((spell) => spell && spell.cost <= view.mana[playerId]! + 1);
        const spell = affordable[index(seed + ":spell:" + view.round, affordable.length)];
        const spellId = spell?.id ?? "rest";
        const glyph = spell?.glyph ?? "loop";
        const stroke = glyph === "loop"
          ? Array.from({ length: 17 }, (_, point) => ({ x: 0.5 + Math.cos(point * Math.PI / 8) * 0.3, y: 0.5 + Math.sin(point * Math.PI / 8) * 0.3 }))
          : glyph === "shield"
            ? [{ x: 0.2, y: 0.25 }, { x: 0.8, y: 0.25 }, { x: 0.75, y: 0.65 }, { x: 0.5, y: 0.85 }, { x: 0.25, y: 0.65 }, { x: 0.2, y: 0.25 }]
            : [{ x: 0.15, y: 0.7 }, { x: 0.8, y: 0.25 }, { x: 0.3, y: 0.72 }, { x: 0.75, y: 0.3 }, { x: 0.2, y: 0.7 }, { x: 0.85, y: 0.35 }];
        return makeAction(state, "SUBMIT_MAGIC_DUELL_CAST", { matchId, round: view.round, spellId, stroke });
      }
      return null;
    }
    case "minions-td": {
      if (!state.minionsTd) return null;
      const view = minionsTdSnapshot(state.minionsTd, viewer);
      if (view.phase !== "choosing" || view.submitted) return null;
      const unit = [...view.units].filter((candidate) => candidate.cost <= view.gold[playerId]!).sort((left, right) => right.damage + right.health / 10 - left.damage - left.health / 10)[0];
      return makeAction(state, "SUBMIT_MINIONS_TD_ORDER", { matchId, round: view.round, order: unit ? { type: "deploy", unitId: unit.id } : { type: "brace" } });
    }
    case "kartentisch": {
      if (!state.kartentisch) return null;
      const view = kartentischSnapshot(state.kartentisch, viewer);
      if (view.phase !== "playing" || view.turnPlayerId !== playerId || !view.ownHand?.length) return null;
      const legal = view.leadSuit ? view.ownHand.filter((card) => card.suit === view.leadSuit) : [];
      const card = [...(legal.length ? legal : view.ownHand)].sort((left, right) => left.rank - right.rank)[0]!;
      return makeAction(state, "SUBMIT_KARTENTISCH_CARD", { matchId, trick: view.trick, cardId: card.id });
    }
    case "dungeon-party": {
      if (!state.dungeonParty) return null;
      const view = dungeonPartySnapshot(state.dungeonParty, viewer);
      if (view.phase !== "choosing" || view.submitted) return null;
      const action = [...view.definition.actions].sort((left, right) => (right.progress + right.healing * 2 + right.guard) - (left.progress + left.healing * 2 + left.guard) || left.id.localeCompare(right.id))[index(seed, view.definition.actions.length)]!;
      return makeAction(state, "SUBMIT_DUNGEON_PARTY_ACTION", { matchId, encounter: view.encounter, actionId: action.id });
    }
    case "flatterfluff": {
      if (!state.flatterfluff) return null;
      const view = flatterfluffSnapshot(state.flatterfluff, viewer);
      if (view.phase !== "aiming" || view.submitted) return null;
      const target = [...view.targets].sort((left, right) => right.points - left.points)[0]!;
      return makeAction(state, "SUBMIT_FLATTERFLUFF_SHOT", { matchId, round: view.round, x: target.x, y: target.y });
    }
    case "drift-racer": {
      if (!state.driftRacer) return null;
      const view = driftRacerSnapshot(state.driftRacer, viewer);
      if (view.phase !== "racing" || view.submitted) return null;
      const driver = view.drivers[playerId]!;
      return makeAction(state, "SUBMIT_DRIFT_RACER_INPUT", { matchId, turn: view.turn, throttle: "accelerate", steer: driver.lane === 1 ? 0 : driver.lane === 0 ? 1 : -1, drift: driver.speed > 0, boost: driver.boosts > 0 });
    }
    case "word-tiles": {
      if (!state.wordTiles) return null;
      const view = wordTilesSnapshot(state.wordTiles, viewer);
      if (view.phase !== "choosing" || view.submitted) return null;
      const letters = view.letters.toLocaleLowerCase();
      const rack = [...letters];
      const words = [...WORD_TILES_DICTIONARY].filter((word) => word.length <= rack.length).sort((left, right) => right.length - left.length || left.localeCompare(right));
      const word = words.find((candidate) => {
        const remaining = [...rack];
        for (const char of candidate) { const at = remaining.indexOf(char); if (at < 0) return false; remaining.splice(at, 1); }
        return true;
      }) ?? null;
      return makeAction(state, "SUBMIT_WORD_TILES_WORD", { matchId, round: view.round, word });
    }
    case "schattenjagd": {
      if (!state.schattenjagd) return null;
      const view = schattenjagdSnapshot(state.schattenjagd, viewer);
      if (view.phase !== "choosing" || view.submitted) return null;
      const clue = view.ownClue;
      const target = clue ? view.suspects.find((suspect) => suspect[clue.field] === clue.value) : undefined;
      return makeAction(state, "SUBMIT_SCHATTENJAGD_VOTE", { matchId, round: view.round, suspectId: target?.id ?? view.suspects[index(seed, view.suspects.length)]!.id });
    }
    default: return null;
  }
}
