import test from 'node:test';
import assert from 'node:assert/strict';
import { signSessionSocketTicket, verifySessionSocketTicket } from '../lib/session-socket-ticket';

const claims = { code: 'ABCD', generation: 'a'.repeat(64), role: 'host' as const, actor: 'host', tokenHash: 'b'.repeat(64), expiresAt: 20_000 };

test('session socket tickets are short lived, signed, and cannot be changed or used across rooms', async () => {
  const ticket = await signSessionSocketTicket(claims, 'party-secret', 10_000);
  assert.deepEqual(await verifySessionSocketTicket(ticket, 'party-secret', 10_000), { ...claims, v: 1 });
  await assert.rejects(verifySessionSocketTicket(ticket, 'wrong-secret', 10_000));
  await assert.rejects(verifySessionSocketTicket(ticket + 'x', 'party-secret', 10_000));
  await assert.rejects(verifySessionSocketTicket(ticket, 'party-secret', 20_000));
  await assert.rejects(signSessionSocketTicket({ ...claims, expiresAt: 40_001 }, 'party-secret', 10_000));
});
