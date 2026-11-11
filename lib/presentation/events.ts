import type { RoleSnapshot } from "../contracts";
import type { PresentationEvent, PresentationEventType } from "./types";

const revealPhases = new Set(["REVEAL", "MYSTERY_REVEAL", "RUMOUR_REVEAL", "WAR_TURN_REVEAL", "WAR_ROUND_REVEAL", "ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME"]);

function event(snapshot: RoleSnapshot, type: PresentationEventType, subjectId?: string, extra: Omit<Partial<PresentationEvent>, "key" | "stateVersion" | "type" | "subjectId" | "phase"> = {}): PresentationEvent {
  return {
    key: `${snapshot.stateVersion}:${type}:${subjectId ?? "room"}`,
    stateVersion: snapshot.stateVersion,
    type,
    subjectId,
    phase: snapshot.phase,
    ...extra,
  };
}

function playerMap(snapshot: RoleSnapshot) {
  return new Map(snapshot.players.filter((player) => player.role === "player").map((player) => [player.id, player]));
}

function publicAnswerIds(snapshot: RoleSnapshot): string[] {
  if (snapshot.role === "host" || snapshot.role === "display") return snapshot.answers.filter((answer) => Boolean(answer.authorId)).map((answer) => answer.id);
  if (snapshot.role === "player") return snapshot.revealAnswers.map((answer) => answer.id);
  return [];
}

export function derivePresentationEvents(previous: RoleSnapshot | null, next: RoleSnapshot): PresentationEvent[] {
  if (!previous) return [event(next, "snapshot.resumed", next.roundId, { payload: { phase: next.phase } })];
  if (next.stateVersion <= previous.stateVersion) return [];

  const events: PresentationEvent[] = [];
  if (previous.phase !== next.phase) events.push(event(next, "phase.entered", next.phase));
  if (previous.roundId !== next.roundId && next.roundId !== "lobby") events.push(event(next, "round.entered", next.roundId));

  const beforePlayers = playerMap(previous);
  const afterPlayers = playerMap(next);
  for (const [id, player] of afterPlayers) {
    const before = beforePlayers.get(id);
    if (!before) events.push(event(next, "player.joined", id));
    else if (!before.connected && player.connected) events.push(event(next, "player.reconnected", id));
    const beforeScore = before?.score ?? 0;
    const afterScore = player.score ?? 0;
    if (before && beforeScore !== afterScore) events.push(event(next, "score.changed", id, { delta: afterScore - beforeScore, payload: { total: afterScore } }));
  }
  for (const [id, player] of beforePlayers) {
    const after = afterPlayers.get(id);
    if (!after || (player.active && !after.active)) events.push(event(next, "player.left", id));
  }

  if ((previous.role === "host" || previous.role === "display") && (next.role === "host" || next.role === "display")) {
    const previousResponses = new Set(previous.submittedPlayerIds);
    for (const id of next.submittedPlayerIds) if (!previousResponses.has(id)) events.push(event(next, "response.locked", id));
    const previousVotes = new Set(previous.respondedVoterIds);
    for (const id of next.respondedVoterIds) if (!previousVotes.has(id)) events.push(event(next, "vote.locked", id));
  } else if (next.role === "player" && previous.role === "player") {
    if (!previous.submitted && next.submitted) events.push(event(next, next.phase.includes("VOT") ? "vote.locked" : "response.locked", next.selfId));
  }

  if (next.imageGenerationNotice?.kind === "RETRYING" && previous.imageGenerationNotice?.updatedAt !== next.imageGenerationNotice.updatedAt) {
    events.push(event(next, "image.retrying", next.roundId, { payload: { failedModel: next.imageGenerationNotice.failedModel, nextModel: next.imageGenerationNotice.nextModel } }));
  }
  if (next.imageGenerationNotice?.kind === "FAILED" && previous.imageGenerationNotice?.updatedAt !== next.imageGenerationNotice.updatedAt) {
    events.push(event(next, "image.fallback", next.roundId, { payload: { failedModel: next.imageGenerationNotice.failedModel } }));
  }
  if (previous.imageJobsPending && !next.imageJobsPending) events.push(event(next, "image.ready", next.roundId));

  if (!revealPhases.has(previous.phase) && revealPhases.has(next.phase)) {
    const ids = publicAnswerIds(next);
    if (ids.length) ids.forEach((id) => events.push(event(next, "answer.revealed", id)));
    else events.push(event(next, "answer.revealed", next.roundId));
  }

  const enteredResults = !["ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME"].includes(previous.phase) && ["ROUND_RESULTS", "FINAL_RESULTS", "POST_GAME"].includes(next.phase);
  if (enteredResults) {
    const scoring = next.players.filter((player) => player.role === "player" && player.active);
    const high = Math.max(...scoring.map((player) => player.score ?? 0), 0);
    const winners = scoring.filter((player) => (player.score ?? 0) === high);
    if (winners.length > 1) events.push(event(next, "tie.revealed", winners.map((player) => player.id).sort().join("+"), { payload: { playerIds: winners.map((player) => player.id) } }));
    else if (winners[0]) events.push(event(next, "winner.revealed", winners[0].id));
  }
  if (!['FINAL_RESULTS', 'POST_GAME'].includes(previous.phase) && ['FINAL_RESULTS', 'POST_GAME'].includes(next.phase)) events.push(event(next, "match.completed", next.roundId));

  return events;
}

export function dedupePresentationEvents(events: PresentationEvent[]): PresentationEvent[] {
  const seen = new Set<string>();
  return events.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}
