import { apiError, type Role } from "../lib/contracts";
import { sha256Hex } from "./crypto";
import { getD1, authenticateDisplay, authenticateHost, authenticateSeat, loadRoom } from "./database";
import { displayCookieName, getCookie, hostCookieName, seatCookieName } from "./http";
import type { ParticipantState, RoomState } from "./types";

export interface AuthenticatedRoom {
  state: RoomState;
  role: Role;
  id: string;
  participant: ParticipantState | null;
  profileHash?: string;
}

export async function authenticateRoom(request: Request, code: string, roles: Role[]): Promise<AuthenticatedRoom | Response> {
  const normalized = code.toUpperCase();
  const loaded = await loadRoom(normalized);
  if (!loaded) return apiError("ROOM_NOT_FOUND", "That room could not be found.", 404);
  if (roles.includes("host") && await authenticateHost(getCookie(request, hostCookieName(normalized)), loaded)) {
    const token=getCookie(request,'callback_profile');let profileHash:string|undefined;
    if(token&&/^[A-Za-z0-9_-]{40,64}$/.test(token)){const hash=await sha256Hex(token);if(await getD1().prepare('SELECT 1 FROM character_profiles WHERE token_hash=?').bind(hash).first())profileHash=hash;}
    return { state: loaded.state, role: "host", id: "host", participant: null,profileHash };
  }
  if (roles.includes("display") && await authenticateDisplay(loaded.state.id, getCookie(request, displayCookieName(normalized)))) return { state: loaded.state, role: "display", id: "display", participant: null };
  const seat = await authenticateSeat(loaded.state.id, getCookie(request, seatCookieName(normalized)));
  if (seat && roles.includes(seat.role)) {
    const participant = loaded.state.participants.find((item) => item.id === seat.id && !item.removedAt) ?? null;
    if (participant) return { state: loaded.state, role: seat.role, id: seat.id, participant };
  }
  return apiError("UNAUTHORIZED", "Your room session is missing or expired.", 401);
}
