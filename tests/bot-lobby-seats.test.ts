import assert from "node:assert/strict";
import test from "node:test";
import { HostActionSchema } from "../lib/contracts";
import { applyHostAction, createRoomState, scoringPlayers } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hydrateLobbySlots, chooseLobbySlot } from "../server/participant-seats";

const lobby = () => createRoomState("BOTSEAT", { gameLength: "standard", contentMode: "party", timerAccessibility: false }, 1000);
const setSeat = (seat: number, enabled: boolean) => ({
  type: "SET_BOT_SEAT", actionId: `bot-${seat}-${enabled}`, roundId: "lobby", expectedPhase: "LOBBY", payload: { seat, enabled },
});

test("host bot-seat action has a bounded physical seat and boolean preference", () => {
  assert.equal(HostActionSchema.safeParse(setSeat(10, true)).success, true);
  assert.equal(HostActionSchema.safeParse(setSeat(0, true)).success, false);
  assert.equal(HostActionSchema.safeParse(setSeat(11, true)).success, false);
  assert.equal(HostActionSchema.safeParse(setSeat(3, "yes" as unknown as boolean)).success, false);
});

test("turning one supported lobby seat on materializes a bot in that seat and off retires it", () => {
  let state = lobby();
  const enabled = applyHostAction(state, setSeat(4, true) as never, 2000);
  state = enabled.next;
  assert.deepEqual(state.botSeats, [4]);
  assert.deepEqual(scoringPlayers(state).map((player) => player.lobbySlot), [4]);
  assert.equal(scoringPlayers(state)[0]!.seat, 1);
  assert.equal(enabled.effects.some((effect) => effect.type === "participant_add"), true);

  const bot = scoringPlayers(state)[0]!;
  const disabled = applyHostAction(state, setSeat(4, false) as never, 3000);
  assert.deepEqual(disabled.next.botSeats, []);
  assert.equal(scoringPlayers(disabled.next).length, 0);
  assert.equal(disabled.next.participants.some((player) => player.id === bot.id && player.removedAt !== null), true);
  assert.equal(disabled.effects.some((effect) => effect.type === "participant_state" && effect.participant.id === bot.id), true);
});

test("bot preferences serialize and legacy rooms seed only their active bot seats", () => {
  let state = lobby();
  state = applyHostAction(state, setSeat(2, true) as never, 2000).next;
  assert.deepEqual(deserializeRoomState(serializeRoomState(state)).botSeats, [2]);

  const legacy = JSON.parse(serializeRoomState(state)) as Record<string, unknown>;
  delete legacy.botSeats;
  assert.deepEqual(deserializeRoomState(JSON.stringify(legacy)).botSeats, [2]);
});

test("removing a phone in a preferred lobby seat restores its bot, but disabled seats stay empty", () => {
  const state = lobby();
  state.participants = [{ id: "human", nickname: "Friend", nicknameNormalized: "friend", role: "player", seat: 31, lobbySlot: 3, avatar: 2, color: "#fff", active: true, pendingActivation: false, lastSeenAt: 1000, removedAt: null }];
  state.botSeats = [3];
  const removed = applyHostAction(state, { type: "REMOVE_PLAYER", actionId: "remove-human", roundId: "lobby", expectedPhase: "LOBBY", payload: { playerId: "human" } }, 2000);
  assert.deepEqual(scoringPlayers(removed.next).map((player) => player.lobbySlot), [3]);
  assert.equal(scoringPlayers(removed.next)[0]!.seat, 32);
  assert.equal(scoringPlayers(removed.next)[0]!.bot, true);
  assert.deepEqual(removed.effects.map((effect) => effect.type), ["participant_state", "participant_add"]);

  state.botSeats = [];
  const offSeat = applyHostAction(state, { type: "REMOVE_PLAYER", actionId: "remove-human-off", roundId: "lobby", expectedPhase: "LOBBY", payload: { playerId: "human" } }, 3000);
  assert.equal(scoringPlayers(offSeat.next).length, 0);
  assert.deepEqual(offSeat.effects.map((effect) => effect.type), ["participant_state"]);
});

test("removing a bot turns off that preference without rematerializing it", () => {
  const enabled = applyHostAction(lobby(), setSeat(4, true) as never, 2000).next;
  const bot = scoringPlayers(enabled)[0]!;
  const removed = applyHostAction(enabled, { type: "REMOVE_PLAYER", actionId: "remove-bot", roundId: "lobby", expectedPhase: "LOBBY", payload: { playerId: bot.id } }, 3000).next;
  assert.deepEqual(removed.botSeats, []);
  assert.equal(scoringPlayers(removed).length, 0);
  assert.equal(removed.participants.filter((player) => player.id === bot.id).length, 1);
  assert.equal(removed.participants.find((player) => player.id === bot.id)?.removedAt, 3000);
});

test("bot seats are unavailable to unsupported packs and full lobby preferences remain bounded", () => {
  assert.throws(() => applyHostAction(createRoomState("BIRTH", { gameLength: "birthday", birthdayName: "Birthday Guest", contentMode: "party", timerAccessibility: false }, 1000), setSeat(1, true) as never, 2000), /BOTS_UNAVAILABLE/);

  let state = lobby();
  for (let seat = 1; seat <= 10; seat += 1) state = applyHostAction(state, setSeat(seat, true) as never, 2000 + seat).next;
  assert.equal(scoringPlayers(state).length, 10);
  assert.deepEqual(state.botSeats, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(HostActionSchema.safeParse(setSeat(11, true)).success, false);
});

test("one human and one bot meet the two-player minimum and bot turns stay authoritative", () => {
  let state = lobby();
  state.participants = [{ id: "human", nickname: "Friend", nicknameNormalized: "friend", role: "player", seat: 1, avatar: 0, color: "#fff", active: true, pendingActivation: false, lastSeenAt: 1000, removedAt: null }];
  state = applyHostAction(state, setSeat(2, true) as never, 2000).next;
  assert.equal(scoringPlayers(state).length, 2);
  state = applyHostAction(state, { type: "START_GAME", actionId: "start-with-bot", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 3000).next;
  assert.equal(state.phase, "INTRO");
});

test("legacy active players above physical seat ten receive stable logical slots without ghost players", () => {
  const state = lobby();
  state.participants = [
    { id: "legacy-human", nickname: "Legacy", nicknameNormalized: "legacy", role: "player", seat: 14, avatar: 0, color: "#fff", active: true, pendingActivation: false, lastSeenAt: 1000, removedAt: null },
    { id: "legacy-bot", nickname: "Deadpan", nicknameNormalized: "deadpan", role: "player", seat: 27, avatar: 1, color: "#000", active: true, pendingActivation: false, bot: true, lastSeenAt: 1000, removedAt: null },
  ];
  hydrateLobbySlots(state);
  assert.deepEqual(state.participants.map((player) => player.lobbySlot), [1, 2]);
  assert.deepEqual(state.botSeats, [2]);
  assert.equal(chooseLobbySlot(state, false), 3);
  assert.equal(chooseLobbySlot(state, true), 2);
  assert.deepEqual(state.participants.map((player) => player.seat), [14, 27]);
});

test("bot additions never recycle another bot's historical physical seat or logical slot", () => {
  let state = lobby();
  for (let index = 0; index < 3; index += 1) state = applyHostAction(state, { type: "ADD_BOT", actionId: `add-${index}`, roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 2000 + index).next;
  assert.deepEqual(scoringPlayers(state).map((player) => player.lobbySlot), [1, 2, 3]);
  assert.deepEqual(scoringPlayers(state).map((player) => player.seat), [1, 2, 3]);
});
