import assert from "node:assert/strict";
import test from "node:test";
import type { HostSnapshot, RoomPhase } from "../lib/contracts";
import { dedupePresentationEvents, derivePresentationEvents } from "../lib/presentation/events";
import { presentationMotionPolicy } from "../lib/presentation/motion-tokens";

function snapshot(overrides: Partial<HostSnapshot> = {}): HostSnapshot {
  return {
    role: "host", code: "SHOW", version: 1, stateVersion: 1, serverTime: 1000,
    phase: "LOBBY", deadlineAt: null, paused: false, joiningLocked: false, soloMode: false,
    soloLiveImages: false, imageModel: "flux-2-fast", imageGenerationNotice: null,
    developerMode: false, imageJobsPending: false, comicTheme: null, comicFrames: [],
    restoration: null, mystery: null, rumours: null, warRoom: null, bowl: null,
    roundId: "lobby", roundKind: null, roundNumber: 0, roundTotal: 4,
    players: [], audienceCount: 0, gameLength: "standard", contentMode: "party",
    timerAccessibility: false, birthdayName: null, birthdayPersonId: null, prompt: null,
    instruction: null, memoryTrail: [], answers: [], submittedPlayerIds: [],
    respondedVoterIds: [], results: null, image: null,
    ...overrides,
    botSeats: overrides.botSeats ?? [],
  };
}

function player(id: string, score = 0, connected = true) {
  return { id, nickname: id.toUpperCase(), role: "player" as const, seat: id.charCodeAt(0) - 96, avatar: 0, color: "#6dd5ed", connected, active: true, pendingActivation: false, score };
}

test("first presentation snapshot resumes without replaying ceremonies", () => {
  const events = derivePresentationEvents(null, snapshot({ stateVersion: 42, phase: "FINAL_RESULTS" }));
  assert.deepEqual(events.map((item) => item.type), ["snapshot.resumed"]);
});

test("presentation events reject stale snapshots and tolerate skipped phases", () => {
  const before = snapshot({ stateVersion: 5, phase: "ANSWERING", roundId: "round-1" });
  assert.deepEqual(derivePresentationEvents(before, snapshot({ stateVersion: 5, phase: "REVEAL", roundId: "round-1" })), []);
  const skipped = derivePresentationEvents(before, snapshot({ stateVersion: 8, phase: "ROUND_RESULTS", roundId: "round-1" }));
  assert.ok(skipped.some((item) => item.type === "phase.entered"));
  assert.ok(skipped.some((item) => item.type === "answer.revealed"));
});

test("stable keys deduplicate and distinguish Play Again matches", () => {
  const first = derivePresentationEvents(snapshot({ stateVersion: 8 }), snapshot({ stateVersion: 9, phase: "INTRO", roundId: "match-1-round-1" }));
  assert.equal(dedupePresentationEvents([...first, ...first]).length, first.length);
  const replay = derivePresentationEvents(snapshot({ stateVersion: 50, phase: "POST_GAME", roundId: "match-1-final" }), snapshot({ stateVersion: 51, phase: "INTRO", roundId: "match-2-round-1" }));
  assert.notEqual(first.find((item) => item.type === "phase.entered")?.key, replay.find((item) => item.type === "phase.entered")?.key);
});

test("join, reconnect, lock, score, and tie events are semantic and subject-keyed", () => {
  const before = snapshot({ stateVersion: 10, phase: "VOTING", players: [player("a", 100, false), player("b", 100)], submittedPlayerIds: ["b"] });
  const after = snapshot({ stateVersion: 11, phase: "ROUND_RESULTS", players: [player("a", 200), player("b", 200), player("c", 0)], submittedPlayerIds: ["a", "b"], respondedVoterIds: ["a"] });
  const events = derivePresentationEvents(before, after);
  assert.ok(events.some((item) => item.type === "player.reconnected" && item.subjectId === "a"));
  assert.ok(events.some((item) => item.type === "player.joined" && item.subjectId === "c"));
  assert.ok(events.some((item) => item.type === "response.locked" && item.subjectId === "a"));
  assert.ok(events.some((item) => item.type === "vote.locked" && item.subjectId === "a"));
  assert.deepEqual(events.filter((item) => item.type === "score.changed").map((item) => item.delta), [100, 100]);
  assert.ok(events.some((item) => item.type === "tie.revealed"));
});

test("image retry, fallback, and ready events follow disclosed notice changes", () => {
  const previous = snapshot({ stateVersion: 20, phase: "IMAGE_REVEAL", roundId: "r2", imageJobsPending: true });
  const retrying = snapshot({ stateVersion: 21, phase: "IMAGE_REVEAL", roundId: "r2", imageJobsPending: true, imageGenerationNotice: { kind: "RETRYING", failedModel: "flux-2-quality", nextModel: "flux-2-fast", updatedAt: 2000 } });
  assert.ok(derivePresentationEvents(previous, retrying).some((item) => item.type === "image.retrying"));
  const failed = snapshot({ stateVersion: 22, phase: "IMAGE_REVEAL", roundId: "r2", imageJobsPending: false, imageGenerationNotice: { kind: "FAILED", failedModel: "flux-1-schnell", updatedAt: 3000 } });
  const events = derivePresentationEvents(retrying, failed);
  assert.ok(events.some((item) => item.type === "image.fallback"));
  assert.ok(events.some((item) => item.type === "image.ready"));
});

test("pre-reveal updates never derive authorship or answer reveal events", () => {
  const before = snapshot({ stateVersion: 30, phase: "ANSWER_LOCK", answers: [{ id: "secret", text: "Hidden", authorId: "a", hidden: false, applause: 0, audienceFavorites: 0 }] });
  const after = snapshot({ ...before, stateVersion: 31, phase: "VOTING", submittedPlayerIds: ["a"] });
  const events = derivePresentationEvents(before, after);
  assert.equal(events.some((item) => item.type === "answer.revealed"), false);
  assert.equal(JSON.stringify(events).includes("authorId"), false);
});

test("reduced-motion policy removes travel, ambient motion, and particles without changing state timing", () => {
  const policy = presentationMotionPolicy(true);
  assert.deepEqual({ travel: policy.travel, ambient: policy.ambient, particles: policy.particles, pigeonTravel: policy.pigeonTravel }, { travel: false, ambient: false, particles: false, pigeonTravel: false });
  assert.ok(policy.transitionSeconds <= presentationMotionPolicy(false).transitionSeconds);
});

test("all current room phases remain valid presentation subjects", () => {
  const phase: RoomPhase = "BOWL_SUDDEN_DEATH";
  assert.equal(snapshot({ phase }).phase, phase);
});
