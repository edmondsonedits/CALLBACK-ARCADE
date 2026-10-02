import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CONTROLLERS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  HELD_INPUT_TIMEOUT_MS,
  createRoomRecord,
  claimSeat,
  publicRoom,
  validateControllerInput,
  acceptSequence,
  neutralInput,
  roomCanJoin,
  neutralizeStaleInputs,
  makeInputFrame,
} from '../src/room-state.ts';

const hash = (value) => `hash:${value}`;
const room = () => createRoomRecord({ code: 'ABC234', gameId: 'royal-sumo', hostTokenHash: hash('host'), now: 1000 });

test('room protocol reserves one host and nine reconnectable controller seats', () => {
  const state = room();
  assert.equal(MAX_CONTROLLERS, 9);
  assert.equal(HEARTBEAT_INTERVAL_MS, 5_000);
  assert.equal(HEARTBEAT_TIMEOUT_MS, 15_000);
  assert.equal(HELD_INPUT_TIMEOUT_MS, 2_000);
  for (let seat = 1; seat <= MAX_CONTROLLERS; seat++) {
    const result = claimSeat(state, { tokenHash: hash(`p${seat}`), name: `P${seat}`, now: 1100 + seat });
    assert.equal(result.seat, seat);
  }
  assert.throws(() => claimSeat(state, { tokenHash: hash('p10'), name: 'P10', now: 2000 }), { code: 'room-full' });
  assert.equal(publicRoom(state).slots.length, 10);
  assert.deepEqual(publicRoom(state).slots[0], { seat: 0, name: 'Host', connected: false, bot: false });
  assert.equal(JSON.stringify(publicRoom(state)).includes('hash:'), false);
});

test('room starts with exactly ten public contestant seats including nine bot placeholders', () => {
  const slots = publicRoom(room()).slots;
  assert.equal(slots.length, 10);
  assert.deepEqual(slots.slice(1).map(slot => slot.seat), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(slots.slice(1).every(slot => slot.bot && !slot.connected));
});

test('reconnect finds its original seat and does not create duplicate ownership', () => {
  const state = room();
  const first = claimSeat(state, { tokenHash: hash('stable'), name: 'Pilot', now: 1200 });
  const again = claimSeat(state, { tokenHash: hash('stable'), name: 'Pilot', now: 2200 });
  assert.equal(again.seat, first.seat);
  assert.equal(Object.keys(state.slots).length, 9);
  assert.equal(publicRoom(state).slots.length, 10);
  assert.equal(Object.values(state.slots).filter(slot => slot.tokenHash === hash('stable')).length, 1);
});

test('controller input accepts bounded axes and actions and rejects authority or malformed values', () => {
  const good = { moveX: -1, moveY: 0.25, primaryAction: true, secondaryAction: false, tertiaryAction: false, run: true, lane: 3 };
  assert.deepEqual(validateControllerInput(good), good);
  assert.equal(validateControllerInput({ ...good, score: 999 }), null);
  assert.equal(validateControllerInput({ ...good, moveX: 1.01 }), null);
  assert.equal(validateControllerInput({ ...good, lane: 4 }), null);
  assert.equal(validateControllerInput({ ...good, run: 1 }), null);
  assert.equal(validateControllerInput({ ...good, moveY: Number.NaN }), null);
});

test('input sequences strictly increase across socket replacement', () => {
  const state = room();
  const player = claimSeat(state, { tokenHash: hash('stable'), name: 'Pilot', now: 1200 });
  assert.equal(acceptSequence(state, player.seat, 1), true);
  assert.equal(acceptSequence(state, player.seat, 1), false);
  assert.equal(acceptSequence(state, player.seat, 0), false);
  assert.equal(acceptSequence(state, player.seat, 2), true);
  assert.equal(state.slots[player.seat].lastSequence, 2);
});

test('server timeout neutral frames are marked so game adapters can cancel charged actions safely', () => {
  const payload = neutralInput();
  assert.deepEqual(makeInputFrame(3, 12, payload), { v: 1, type: 'input', seat: 3, sequence: 12, payload });
  assert.deepEqual(makeInputFrame(3, 12, payload, true), { v: 1, type: 'input', seat: 3, sequence: 12, payload, neutral: true });
});

test('room join lifecycle blocks ended or expired rooms and disconnect neutralizes held controls', () => {
  const state = room();
  assert.equal(roomCanJoin(state, 3_599_000), true);
  assert.equal(roomCanJoin({ ...state, phase: 'ended' }, 2000), false);
  assert.equal(roomCanJoin(state, 3_602_000), false);
  assert.deepEqual(neutralInput(), { moveX: 0, moveY: 0, primaryAction: false, secondaryAction: false, tertiaryAction: false, run: false });
});

test('held inputs neutralize after two seconds without releasing the credential seat', () => {
  const state = room();
  const player = claimSeat(state, { tokenHash: hash('stable'), name: 'Pilot', now: 1200 });
  const slot = state.slots[player.seat];
  slot.connected = true;
  slot.bot = false;
  slot.input = { moveX: 1, moveY: 0, primaryAction: true, secondaryAction: false, tertiaryAction: false, run: false };
  slot.lastInputAt = 2000;
  assert.deepEqual(neutralizeStaleInputs(state, 3999), []);
  assert.deepEqual(neutralizeStaleInputs(state, 4000), [player.seat]);
  assert.deepEqual(slot.input, neutralInput());
  assert.equal(slot.connected, true);
  assert.equal(slot.bot, false);
});
