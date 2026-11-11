import assert from "node:assert/strict";
import test from "node:test";
import { advanceMagicArenaRound, chooseMagicArenaAction, createMagicArenaMatch, isValidMagicArenaMatch, magicArenaSnapshot, revealMagicArenaRound } from "../server/arcade/magic_arena";
import { advanceMagicDuellRound, beginMagicDuell, chooseMagicDuellCast, createMagicDuellMatch, isValidMagicDuellMatch, magicDuellSnapshot, revealMagicDuellRound } from "../server/arcade/magic_duell";
import { advanceMinionsTdRound, createMinionsTdMatch, isValidMinionsTdMatch, minionsTdSnapshot, resolveMinionsTdRound, submitMinionsTdOrder } from "../server/arcade/minions_td";
import { applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";
import { AIR_HOCKEY_STEP_MS, airHockeyGame, applyAirHockeyInput, createAirHockeyState, stepAirHockey, toAirHockeySnapshot } from "../arcade-worker/src/games/air-hockey";

const players = Array.from({ length: 10 }, (_, i) => `p${i}`);
const bolt = [{ x: .1, y: .5 }, { x: .28, y: .34 }, { x: .45, y: .2 }, { x: .2, y: .8 }, { x: .85, y: .4 }];
const loop = Array.from({ length: 17 }, (_, i) => { const angle = i / 16 * Math.PI * 2; return { x: .5 + .38 * Math.cos(angle), y: .5 + .38 * Math.sin(angle) }; });
const restored = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

test("ten-player Magic Arena keeps all choices private, uses the whole ring, and continues after partial knockout", () => {
  let match = createMagicArenaMatch({ matchId: "ten-arena", players, now: 0 });
  for (let round = 1; round <= 5; round++) {
    for (const id of players.filter((id) => match.health[id]! > 0)) {
      const action = round === 3 ? "focus" : round >= 4 && id === "p0" ? "guard" : "strike";
      const chosen = chooseMagicArenaAction(restored(match), { matchId: match.matchId, round, playerId: id, action, now: match.updatedAt + 1 });
      assert.equal(chosen.ok, true, chosen.ok ? undefined : chosen.code); if (!chosen.ok) return;
      match = chosen.state;
    }
    assert.equal("choices" in magicArenaSnapshot(match, { role: "host" }), false);
    assert.equal("ownAction" in magicArenaSnapshot(match, { role: "player", playerId: "outsider" }), false);
    const revealed = revealMagicArenaRound(restored(match), { now: match.updatedAt + 1 });
    assert.equal(revealed.ok, true, revealed.ok ? undefined : revealed.code); if (!revealed.ok) return;
    match = revealed.state;
    assert.equal(isValidMagicArenaMatch(restored(match)), true);
    const forged = restored(match); forged.roundResults.at(-1)!.damage.p9 = 1; assert.equal(isValidMagicArenaMatch(forged), false);
    if (round === 1) { assert.deepEqual(Object.values(match.health), Array(10).fill(4)); assert.deepEqual(Object.values(match.energy), Array(10).fill(1)); }
    if (round === 4) {
      assert.equal(match.phase, "revealed"); assert.deepEqual(players.filter((id) => match.health[id]! > 0), ["p0", "p1"]);
      assert.deepEqual(magicArenaSnapshot(match, { role: "host" }).targets, Object.fromEntries(players.map((id) => [id, id === "p0" ? "p1" : id === "p1" ? "p0" : null])));
    }
    if (round < 5) { const next = advanceMagicArenaRound(restored(match), { now: match.updatedAt + 1 }); assert.equal(next.ok, true); if (!next.ok) return; match = next.state; if (round === 4) assert.equal(chooseMagicArenaAction(match, { matchId: match.matchId, round: 5, playerId: "p9", action: "focus", now: match.updatedAt + 1 }).ok, false); }
  }
  assert.equal(match.phase, "complete"); assert.equal(match.result?.winnerPlayerId, "p0");
});

test("ten-player Magic Duell casts all ten spells, preserves private drafts, and rejects forged replay damage", () => {
  let match = createMagicDuellMatch({ matchId: "ten-duell", players, now: 0 });
  const begun = beginMagicDuell(restored(match), { now: match.deadline }); assert.equal(begun.ok, true); if (!begun.ok) return; match = begun.state;
  for (let round = 1; round <= 5; round++) {
    for (const id of players) {
      const cast = chooseMagicDuellCast(restored(match), { matchId: match.matchId, round, playerId: id, spellId: id === "p0" ? "stillwater" : "spark-bolt", stroke: id === "p0" ? loop : bolt, now: match.updatedAt + 1 });
      assert.equal(cast.ok, true, cast.ok ? undefined : cast.code); if (!cast.ok) return; match = cast.state;
    }
    const host = magicDuellSnapshot(match, { role: "host" }); assert.equal("loadouts" in host, false); assert.equal("ownLoadout" in host, false); assert.equal("choices" in host, false);
    const resolved = revealMagicDuellRound(restored(match), { now: match.updatedAt + 1 }); assert.equal(resolved.ok, true); if (!resolved.ok) return; match = resolved.state;
    assert.equal(isValidMagicDuellMatch(restored(match)), true);
    if (round === 1) { assert.equal(match.health.p0, 10); assert.equal(match.health.p1, 12); assert.equal(match.health.p9, 10); }
    const forged = restored(match); forged.roundResults.at(-1)!.damage.p9 = 0; assert.equal(isValidMagicDuellMatch(forged), false);
    if (round < 5) { const next = advanceMagicDuellRound(restored(match), { now: match.updatedAt + 1 }); assert.equal(next.ok, true); if (!next.ok) return; match = next.state; }
  }
  assert.equal(match.result?.winnerPlayerId, "p1");
});

test("ten-player Minions TD moves all attacking waves through ring defenses and replays every seat", () => {
  let match = createMinionsTdMatch({ matchId: "ten-minions", players, now: 0 });
  for (let round = 1; round <= 6; round++) {
    for (const id of players) {
      const order = id === "p0" ? { type: "hold" as const } : { type: "deploy" as const, unitId: "runner" };
      const submitted = submitMinionsTdOrder(restored(match), { matchId: match.matchId, round, playerId: id, order, now: match.updatedAt + 1 });
      assert.equal(submitted.ok, true, submitted.ok ? undefined : submitted.code); if (!submitted.ok) return; match = submitted.state;
    }
    assert.equal("choices" in minionsTdSnapshot(match, { role: "host" }), false);
    assert.equal("ownOrder" in minionsTdSnapshot(match, { role: "player", playerId: "p0" }), true);
    const resolved = resolveMinionsTdRound(restored(match), { now: match.updatedAt + 1 }); assert.equal(resolved.ok, true); if (!resolved.ok) return; match = resolved.state;
    assert.equal(isValidMinionsTdMatch(restored(match)), true);
    if (round === 1) { assert.equal(match.towerHits.p0, 1); assert.equal(match.towerHits.p1, 0); assert.equal(match.towerHits.p9, 1); assert.equal(Object.values(match.waves).flat().length, 9); }
    const forged = restored(match); forged.roundResults.at(-1)!.baseDamage.p9 += 1; assert.equal(isValidMinionsTdMatch(forged), false);
    if (round < 6) { const next = advanceMinionsTdRound(restored(match), { transition: "next", now: match.updatedAt + 1 }); assert.equal(next.ok, true); if (!next.ok) return; match = next.state; }
  }
  assert.equal(match.result?.winnerPlayerId, "p1");
});

test("ten-player Air Hockey controls ten paddles, shares team goals, and returns all five winners after JSON continuation", () => {
  let state = createAirHockeyState("ten-air", 0, players);
  for (const [i, id] of players.entries()) {
    applyAirHockeyInput(state, id, { seq: 1, x: .7, y: i / 10 }, 1);
    assert.equal(state.lastInput[id]?.seq, 1);
    assert.ok(i % 2 === 0 ? state.paddles[i]!.x < 500 : state.paddles[i]!.x > 500);
  }
  assert.equal(state.paddles.length, 10);
  state = restored(state);
  for (let goal = 0; goal < 7; goal++) { state.puck = { x: 998, y: 300, vx: 240, vy: 0, serveTicks: 0 }; stepAirHockey(state, AIR_HOCKEY_STEP_MS, 100 + goal * 100); }
  assert.equal(state.status, "complete");
  const winners = players.filter((_, i) => i % 2 === 0);
  assert.deepEqual(airHockeyGame.finalResult(state)?.winners, winners);
  for (const [i, id] of players.entries()) assert.equal(state.score[id], i % 2 === 0 ? 7 : 0);
  assert.equal("lastInput" in (toAirHockeySnapshot(state, 3).state as object), false);
});

test("canonical duel factories and Air Hockey module reject eleven seats instead of dropping players", () => {
  const eleven = [...players, "p10"];
  assert.throws(() => createMagicArenaMatch({ matchId: "eleven", players: eleven, now: 0 }));
  assert.throws(() => createMagicDuellMatch({ matchId: "eleven", players: eleven, now: 0 }));
  assert.throws(() => createMinionsTdMatch({ matchId: "eleven", players: eleven, now: 0 }));
  assert.throws(() => createAirHockeyState("eleven", 0, eleven));
  assert.throws(() => airHockeyGame.createState("eleven", 0, eleven));
});

for (const gameId of ["magic-arena", "magic-duell", "minions-td"] as const) {
  test(`${gameId} room assigns all ten authenticated seats and retains private tenth-seat input through D1 JSON`, () => {
    let room = createRoomState("TENR", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: gameId }, 1_000);
    for (const [index, id] of players.entries()) room.participants.push({ id, nickname: id, nicknameNormalized: id, role: "player", seat: index + 1, lobbySlot: index + 1, avatar: index % 8, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null });
    room = applyHostAction(room, { type: "START_GAME", actionId: "start-ten-room", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1_001).next;
    const match = gameId === "magic-arena" ? room.magicArena! : gameId === "magic-duell" ? room.magicDuell! : room.minionsTd!;
    assert.deepEqual(match.players, players);
    const action = gameId === "magic-arena" ? { type: "SUBMIT_MAGIC_ARENA_ACTION", payload: { matchId: match.matchId, round: 1, action: "strike" } } : gameId === "magic-duell" ? { type: "SUBMIT_MAGIC_DUELL_LOADOUT", payload: { matchId: match.matchId, spellIds: ["spark-bolt", "prism-ward", "stillwater"] } } : { type: "SUBMIT_MINIONS_TD_ORDER", payload: { matchId: match.matchId, round: 1, order: { type: "deploy", unitId: "runner" } } };
    room = applyPlayerAction(room, "p9", { ...action, actionId: "tenth-seat", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE" } as never, 1_002).next;
    assert.deepEqual(deserializeRoomState(serializeRoomState(room)), room);
    const host = hostSnapshot(room, 1_002); const rival = playerSnapshot(room, room.participants[0]!, 1_002); const own = playerSnapshot(room, room.participants[9]!, 1_002);
    const views = gameId === "magic-arena" ? [host.magicArena!, rival.magicArena!, own.magicArena!] : gameId === "magic-duell" ? [host.magicDuell!, rival.magicDuell!, own.magicDuell!] : [host.minionsTd!, rival.minionsTd!, own.minionsTd!];
    const privateKey = gameId === "magic-arena" ? "ownAction" : gameId === "magic-duell" ? "ownLoadout" : "ownOrder";
    assert.equal(privateKey in views[0]!, false); assert.equal(privateKey in views[1]!, false); assert.equal(privateKey in views[2]!, true);
    assert.throws(() => applyPlayerAction(room, "outsider", { ...action, actionId: "forged-seat", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE" } as never, 1_003), /UNAUTHORIZED/);
  });
}
