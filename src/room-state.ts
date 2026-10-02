export const MAX_CONTROLLERS = 9;
export const ROOM_TTL_MS = 60 * 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 5_000;
export const HEARTBEAT_TIMEOUT_MS = 15_000;
export const HELD_INPUT_TIMEOUT_MS = 2_000;
export const MAX_INPUTS_PER_SECOND = 30;

export type RoomPhase = 'waiting' | 'running' | 'paused' | 'ended';
export type ControllerInput = {
  moveX: number; moveY: number; primaryAction: boolean; secondaryAction: boolean;
  tertiaryAction: boolean; run: boolean; lane?: number;
};
export type RoomSlot = {
  seat: number; name: string; tokenHash: string; connected: boolean; bot: boolean;
  lastSequence: number; lastSeenAt: number; rateWindowAt: number; rateCount: number;
  input: ControllerInput; lastInputAt: number; socketGeneration?: number;
};
export type RoomRecord = {
  code: string; gameId: string; createdAt: number; updatedAt: number; phase: RoomPhase;
  hostTokenHash: string; hostConnected: boolean; hostLastSeenAt: number; hostSocketGeneration: number;
  slots: Record<number, RoomSlot>; inputRateWindowAt: number; inputRateCount: number;
};

export function createRoomRecord(input: { code: string; gameId: string; hostTokenHash: string; now: number }): RoomRecord {
  const state: RoomRecord = {
    code: input.code, gameId: input.gameId, createdAt: input.now, updatedAt: input.now,
    phase: 'waiting', hostTokenHash: input.hostTokenHash, hostConnected: false,
    hostLastSeenAt: input.now, hostSocketGeneration: 0, slots: {}, inputRateWindowAt: input.now, inputRateCount: 0,
  };
  for (let seat = 1; seat <= MAX_CONTROLLERS; seat++) state.slots[seat] = {
    seat, name: `Bot ${seat}`, tokenHash: '', connected: false, bot: true,
    lastSequence: 0, lastSeenAt: input.now, rateWindowAt: input.now, rateCount: 0, socketGeneration: 0,
    input: neutralInput(), lastInputAt: input.now,
  };
  return state;
}

export function claimSeat(state: RoomRecord, input: { tokenHash: string; name: string; now: number }): { seat: number; resumed: boolean } {
  const prior = Object.values(state.slots).find(slot => slot.tokenHash === input.tokenHash);
  if (prior) {
    prior.name = input.name; prior.lastSeenAt = input.now; state.updatedAt = input.now;
    return { seat: prior.seat, resumed: true };
  }
  for (let seat = 1; seat <= MAX_CONTROLLERS; seat++) {
    const available = state.slots[seat];
    if (!available || available.tokenHash) continue;
    Object.assign(available, {
      name: input.name, tokenHash: input.tokenHash, connected: false, bot: true,
      lastSequence: 0, lastSeenAt: input.now, rateWindowAt: input.now, rateCount: 0,
      input: neutralInput(), lastInputAt: input.now,
    });
    state.updatedAt = input.now;
    return { seat, resumed: false };
  }
  throw Object.assign(new Error('room is full'), { code: 'room-full' });
}

export function publicRoom(state: RoomRecord) {
  return {
    code: state.code, gameId: state.gameId, phase: state.phase, hostConnected: state.hostConnected,
    slots: [
      { seat: 0, name: 'Host', connected: state.hostConnected, bot: false },
      ...Object.values(state.slots).sort((a, b) => a.seat - b.seat).map(({ seat, name, connected, bot }) => ({ seat, name, connected, bot })),
    ],
  };
}

export function validateControllerInput(value: unknown): ControllerInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const allowed = new Set(['moveX', 'moveY', 'primaryAction', 'secondaryAction', 'tertiaryAction', 'run', 'lane']);
  if (Object.keys(input).some(key => !allowed.has(key))) return null;
  if (typeof input.moveX !== 'number' || !Number.isFinite(input.moveX) || input.moveX < -1 || input.moveX > 1) return null;
  if (typeof input.moveY !== 'number' || !Number.isFinite(input.moveY) || input.moveY < -1 || input.moveY > 1) return null;
  for (const key of ['primaryAction', 'secondaryAction', 'tertiaryAction', 'run']) if (typeof input[key] !== 'boolean') return null;
  if (input.lane !== undefined && (!Number.isInteger(input.lane) || (input.lane as number) < 0 || (input.lane as number) > 3)) return null;
  return input as ControllerInput;
}

export function acceptSequence(state: RoomRecord, seat: number, sequence: unknown): boolean {
  const slot = state.slots[seat];
  if (!slot || !Number.isSafeInteger(sequence) || (sequence as number) <= slot.lastSequence) return false;
  slot.lastSequence = sequence as number;
  return true;
}

export function neutralInput(): ControllerInput {
  return { moveX: 0, moveY: 0, primaryAction: false, secondaryAction: false, tertiaryAction: false, run: false };
}

export function makeInputFrame(seat: number, sequence: number, payload: ControllerInput, neutral = false) {
  return { v: 1 as const, type: 'input' as const, seat, sequence, payload, ...(neutral ? { neutral: true as const } : {}) };
}

export function isNeutral(input: ControllerInput): boolean {
  return input.moveX === 0 && input.moveY === 0 && !input.primaryAction && !input.secondaryAction && !input.tertiaryAction && !input.run;
}

export function neutralizeStaleInputs(state: RoomRecord, now: number): number[] {
  const stale: number[] = [];
  for (const slot of Object.values(state.slots)) {
    if (slot.connected && !isNeutral(slot.input) && now - slot.lastInputAt >= HELD_INPUT_TIMEOUT_MS) {
      slot.input = neutralInput(); stale.push(slot.seat);
    }
  }
  if (stale.length) state.updatedAt = now;
  return stale;
}

export function roomCanJoin(state: RoomRecord, now: number): boolean {
  return state.phase !== 'ended' && now - state.createdAt < ROOM_TTL_MS;
}
