import { tickFishFinale, markUnavailableFish } from "./arcade/fish_finale";
import { audienceSnapshot, displaySnapshot, hostSnapshot, playerSnapshot } from "./snapshots";
import type { AuthenticatedRoom } from "./auth";
import { advanceState } from "./engine";
import { getD1, loadRoom, persistMutation, runtimeEnv } from "./database";
import { sha256Hex } from "./crypto";
import type { RoleSnapshot } from "../lib/contracts";

export async function syncAuthenticatedRoom(initial: AuthenticatedRoom, options: { displayToken?: string | null; displayTokenHash?: string; skipAdvance?: boolean; skipPresence?: boolean } = {}, now = Date.now()): Promise<{ auth: AuthenticatedRoom; snapshot: RoleSnapshot; version: number }> {
  let auth = initial;
  const advanced = options.skipAdvance ? null : await advanceState(auth.state, now);
  if (advanced?.changed) {
    const won = await persistMutation({ base: auth.state, next: advanced.next, actionId: advanced.actionId, actorId: "system", actionType: "ADVANCE_PHASE", effects: advanced.effects, recordAction: false });
    if (won) auth = { ...auth, state: advanced.next, participant: auth.participant ? advanced.next.participants.find((item) => item.id === auth.id) ?? null : null };
    else {
      const loaded = await loadRoom(auth.state.code); if (!loaded) throw new Error("ROOM_NOT_FOUND");
      auth = { ...auth, state: loaded.state, participant: auth.participant ? loaded.state.participants.find((item) => item.id === auth.id) ?? null : null };
    }
  }
  const fishMatch = auth.state.fishGame ?? auth.state.sketchRelay?.finale ?? null;
  if (!options.skipAdvance && fishMatch) {
    const current = fishMatch;
    let reconciled = current;
    if (current.phase === "readiness" && !current.pausedAt && now >= current.deadline && !current.readinessChecked) {
      const unavailable: string[] = [];
      for (const entry of current.entries) {
        if (entry.practice) continue;
        try {
          const row = await getD1().prepare("SELECT object_key FROM jobs WHERE room_id=? AND id=? AND kind='FISH_UPLOAD' AND status='READY'").bind(auth.state.id, entry.assetId ?? "").first<{object_key:string}>();
          if (!row || !await runtimeEnv().MEDIA?.head(row.object_key)) unavailable.push(entry.id);
        } catch { unavailable.push(entry.id); }
      }
      reconciled = markUnavailableFish(current, unavailable, now);
    }
    const finale = tickFishFinale(reconciled, now);
    if (finale.revision !== current.revision) {
      const next = structuredClone(auth.state); if (next.fishGame) next.fishGame = finale; else if (next.sketchRelay) next.sketchRelay.finale = finale;
      const won = await persistMutation({ base: auth.state, next, actionId: `fish-tick:${finale.finaleId}:${current.revision}`, actorId: "system", actionType: "FISH_TICK", effects: [], recordAction: false });
      const loaded = won ? { state: next } : await loadRoom(auth.state.code);
      if (loaded) auth = { ...auth, state: loaded.state, participant: auth.participant ? loaded.state.participants.find(p => p.id === auth.id) ?? null : null };
    }
  }
  if (!options.skipPresence && auth.role === "display") {
    const tokenHash = options.displayTokenHash ?? (options.displayToken ? await sha256Hex(options.displayToken) : null);
    if (tokenHash) await getD1().prepare("UPDATE display_sessions SET last_seen_at = ? WHERE id = ? AND room_id = ? AND last_seen_at < ?").bind(now, tokenHash, auth.state.id, now - 5_000).run();
  } else if (!options.skipPresence && auth.role !== "host") {
    await getD1().prepare("UPDATE players SET last_seen_at = ? WHERE room_id = ? AND id = ? AND last_seen_at < ?").bind(now, auth.state.id, auth.id, now - 5_000).run();
  }
  const snapshot = auth.role === "host" ? hostSnapshot(auth.state, now)
    : auth.role === "display" ? displaySnapshot(auth.state, now)
    : auth.role === "player" && auth.participant ? playerSnapshot(auth.state, auth.participant, now)
    : auth.participant ? audienceSnapshot(auth.state, auth.participant, now) : null;
  if (!snapshot) throw new Error("UNAUTHORIZED");
  if (auth.role !== "host" && auth.role !== "display" && !auth.participant) throw new Error("UNAUTHORIZED");
  return { auth, snapshot, version: auth.state.version };
}
