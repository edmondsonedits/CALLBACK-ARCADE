import type { RoomState } from "./types";

export function chooseLobbySlot(state: RoomState, replaceBot: boolean): number | null {
  const activePlayers = state.participants.filter((participant) => participant.role === "player" && !participant.removedAt);
  if (replaceBot) {
    const bot = activePlayers.find((participant) => participant.bot && participant.lobbySlot && participant.lobbySlot >= 1 && participant.lobbySlot <= 10);
    if (bot?.lobbySlot) return bot.lobbySlot;
  }
  const occupied = new Set(activePlayers.map((participant) => participant.lobbySlot).filter((slot): slot is number => Number.isInteger(slot) && slot! >= 1 && slot! <= 10));
  return Array.from({ length: 10 }, (_, index) => index + 1).find((slot) => !occupied.has(slot)) ?? null;
}

export function nextPhysicalSeat(state: RoomState): number {
  return state.participants.reduce((highest, participant) => Math.max(highest, participant.seat), 0) + 1;
}

/** Assigns logical lobby slots to pre-slot-format rooms without changing historical D1 seats. */
export function hydrateLobbySlots(state: RoomState): RoomState {
  const activePlayers = state.participants
    .filter((participant) => participant.role === "player" && !participant.removedAt)
    .sort((left, right) => left.seat - right.seat || left.id.localeCompare(right.id));
  const used = new Set<number>();
  for (const participant of activePlayers) {
    const slot = participant.lobbySlot;
    if (Number.isInteger(slot) && slot! >= 1 && slot! <= 10 && !used.has(slot!)) used.add(slot!);
    else participant.lobbySlot = undefined;
  }
  for (const participant of activePlayers) {
    if (participant.lobbySlot) continue;
    const slot = Array.from({ length: 10 }, (_, index) => index + 1).find((candidate) => !used.has(candidate));
    if (slot) { participant.lobbySlot = slot; used.add(slot); }
  }
  const preferences = new Set((state.botSeats ?? []).filter((slot) => Number.isInteger(slot) && slot >= 1 && slot <= 10));
  for (const participant of activePlayers) if (participant.bot && participant.lobbySlot) preferences.add(participant.lobbySlot);
  state.botSeats = [...preferences].sort((left, right) => left - right);
  return state;
}
