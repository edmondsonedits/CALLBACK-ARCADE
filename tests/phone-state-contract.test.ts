import test from 'node:test';
import assert from 'node:assert/strict';
import { hostSchema } from '../server/arcade-phone/contracts';
import { game as sumo } from './phone-worlds/royal-sumo-harness.mjs';
import { game as ballistix } from './phone-worlds/royal-ballistix-harness.mjs';
import { runtime as scratch } from './phone-worlds/royal-scratch-match-harness.mjs';
import { harness as roller } from './phone-worlds/royal-roller-ruckus-harness.mjs';
import { runtime as twisted } from './phone-worlds/royal-twisted-harness.mjs';
import { game as space } from './phone-worlds/space-bash-harness.mjs';
import { appHarness as blind } from './phone-worlds/blind-crown-harness.mjs';

interface PhoneAdapter {
  assign(seat: number, name: string): unknown;
  start(): unknown;
  status(): { phase: string; paused: boolean; active: boolean };
  phoneState(seat: number): unknown;
}
const adapter = (surface: unknown): PhoneAdapter => (surface as { CallbackPhoneGame: PhoneAdapter }).CallbackPhoneGame;
const games: [string, () => PhoneAdapter][] = [
  ['sumo', () => sumo().c.CallbackPhoneGame],
  ['ballistix', () => ballistix(2, 123, { initial: true }).sandbox.CallbackPhoneGame],
  ['scratch', () => adapter(scratch().g)],
  ['roller', () => roller().context.window.CallbackPhoneGame],
  ['twisted', () => adapter(twisted().game)],
  ['space', () => space().sandbox.CallbackPhoneGame],
  ['blind', () => blind().c.CallbackPhoneGame],
];
for (const [name, make] of games) {
  test(`${name} ten-seat phone states pass the actual host schema and 96 KiB body limit`, () => {
    const api = make();
    for (let seat = 0; seat < 10; seat++) api.assign(seat, `Player ${seat + 1}`);
    api.start();
    const body = {
      status: { ...api.status(), text: '' },
      privateStates: Object.fromEntries(Array.from({ length: 10 }, (_, seat) => [String(seat), api.phoneState(seat)])),
    };
    const result = hostSchema.safeParse(body);
    assert.equal(result.success, true, result.success ? undefined : JSON.stringify(result.error.issues));
    assert.ok(Buffer.byteLength(JSON.stringify(body)) <= 96 * 1024);
  });
}
