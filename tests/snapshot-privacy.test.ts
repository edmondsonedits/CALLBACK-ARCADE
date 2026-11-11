import assert from "node:assert/strict";
import test from "node:test";
import { applyPlayerAction, createRoomState, mysteryPublicIdsForRound } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { restorationLayout } from "../lib/game/restoration-layouts";
import { audienceSnapshot, displaySnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";
import type { ParticipantState, RoomState, RoundState } from "../server/types";

const now = 1_800_000_000_000;

function participant(id: string, role: "player" | "audience" = "player"): ParticipantState {
  return { id, nickname: id.toUpperCase(), nicknameNormalized: id, role, seat: Number(id.slice(1)) || 1, avatar: 0, color: "#456789", active: true, pendingActivation: false, lastSeenAt: now, removedAt: null };
}

function roundState(kind: "KING_REQUEST_MYSTERY" | "KING_PROMPTER_FINAL"): RoundState {
  return {
    id: "round-private-1", index: 0, kind, label: "Private round", promptId: "prompt-1", prompt: "Private source prompt", instruction: null, catchModifier: null, choiceOptions: [], callbackSourceLoreIds: [], startedAt: now,
    answers: [
      { id: "answer_real_secret", playerId: "p1", text: "The true original answer", hidden: false, submittedAt: now },
      { id: "answer_other_secret", playerId: "p2", text: "Another submitted answer", hidden: false, submittedAt: now },
    ], votes: [], personalChoices: {}, kingPollEvents: [], predictions: {}, authorAssignments: {}, authorGuesses: {}, authorGuessesScored: false, authorGuessResults: {}, wagers: {}, voteStage: null, scored: false, results: null, image: null, featuredAnswerId: "answer_real_secret", developerScoreCap: null,
    kingMysteryOrder: ["answer_real_secret"], kingMysteryIndex: 0,
    kingMysteryDecoys: { answer_real_secret: [{ id: "decoy_fake_secret", playerId: "p2", text: "A plausible decoy", submittedAt: now, sealed: false }] },
    kingMysterySealUsedByPlayer: {}, kingMysteryVotes: { answer_real_secret: {} }, kingMysteryResults: {},
    royalRumourAssignments: {}, royalRumourGuesses: {}, royalRumourRevealOrder: [], royalRumourRevealIndex: 0, warRankings: {}, warTrueOrder: [], warTargetRanks: [], warPlacements: {}, warClues: [], warTurnTeam: "LION", warTurnNumber: 0, warMaxTurns: 0, warLastMove: null,
    foolScrolls: [], foolRoundNumber: 1, foolPool: [], foolTurnTeam: "BELLS", foolClueGiverId: null, foolTeamTurns: { BELLS: 0, MOTLEY: 0 }, foolPassUsed: false, foolCurrentScrollId: null, foolOneWord: null, foolSpokenClue: null, foolPerformanceCue: null, foolBotClueAt: null, foolStrokes: [], foolLastResult: null, foolUndo: null, foolSuddenDeath: false,
  };
}

function room(kind: "KING_REQUEST_MYSTERY" | "KING_PROMPTER_FINAL", phase: RoomState["phase"]): RoomState {
  const state = createRoomState("TEST", { gameLength: kind === "KING_REQUEST_MYSTERY" ? "king-mystery" : "pictures", contentMode: "family", timerAccessibility: false }, now);
  state.phase = phase;
  state.status = "ACTIVE";
  state.participants = [participant("p1"), participant("p2"), participant("p3"), participant("aud", "audience")];
  state.currentRound = roundState(kind);
  state.kingImages = {
    answer_real_secret: { status: "READY", assetId: "image-real", conceptTitle: "True image", conceptCaption: "" },
    answer_other_secret: { status: "READY", assetId: "image-other", conceptTitle: "Other image", conceptCaption: "" },
    decoy_fake_secret: { status: "READY", assetId: "image-decoy", conceptTitle: "Decoy image", conceptCaption: "" },
  } as RoomState["kingImages"];
  state.kingRestorationBase = "restoration-base-image";
  state.kingRestorationAssignments = { p1: "topCenter", p2: "leftUpper" };
  return state;
}

function snapshots(state: RoomState) {
  const player = state.participants.find((item) => item.id === "p3")!;
  const audience = state.participants.find((item) => item.id === "aud")!;
  return [hostSnapshot(state, now), displaySnapshot(state, now), playerSnapshot(state, player, now), audienceSnapshot(state, audience, now)];
}

test("Frame-Up voting uses opaque ballot and turn identifiers with no answer or decoy ID correlation", () => {
  const state = room("KING_REQUEST_MYSTERY", "MYSTERY_VOTING");
  const publicSnapshots = snapshots(state);
  const publicBallotIds = publicSnapshots[0]!.mystery!.options.map((option) => option.id).sort();
  for (const snapshot of publicSnapshots) {
    assert.equal("featuredAnswerId" in snapshot.mystery!, false);
    assert.match(snapshot.mystery?.turnId ?? "", /^turn_(?:[a-f0-9]{16}|[a-f0-9]{32})$/);
    const options = snapshot.mystery?.options ?? [];
    assert.equal(options.length, 2);
    assert.ok(options.every((option) => /^ballot_(?:[a-f0-9]{16}|[a-f0-9]{32})$/.test(option.id)));
    assert.equal(new Set(options.map((option) => option.id)).size, 2);
    assert.deepEqual(options.map((option) => option.id).sort(), publicBallotIds);
    const serialized = JSON.stringify(snapshot);
    assert.doesNotMatch(serialized, /answer_real_secret|answer_other_secret|decoy_fake_secret/);
  }
  assert.equal(publicSnapshots[0]!.mystery!.turnId, publicSnapshots[3]!.mystery!.turnId, "the public turn ID stays the same across roles and reloadable snapshots");
});

test("Frame-Up progress counts never reveal the original author by exposing who sat out", () => {
  const decoyState = room("KING_REQUEST_MYSTERY", "MYSTERY_DECOYS");
  const votingState = room("KING_REQUEST_MYSTERY", "MYSTERY_VOTING");
  votingState.currentRound!.kingMysteryVotes.answer_real_secret = { p2: "answer_real_secret", p3: "decoy_fake_secret" };
  for (const snapshot of [...snapshots(decoyState), ...snapshots(votingState)]) {
    if ("submittedPlayerIds" in snapshot) assert.ok(snapshot.submittedPlayerIds.every((id) => !["p1", "p2", "p3"].includes(id)));
    if ("respondedVoterIds" in snapshot) assert.ok(snapshot.respondedVoterIds.every((id) => !["p1", "p2", "p3"].includes(id)));
  }
  for (const snapshot of snapshots(decoyState)) if ("submittedPlayerIds" in snapshot) assert.equal(snapshot.submittedPlayerIds.length, 1);
  for (const snapshot of snapshots(votingState)) if ("respondedVoterIds" in snapshot) assert.equal(snapshot.respondedVoterIds.length, 2);
});

test("Frame-Up voting resolves only public ballot IDs and preserves their mapping through room reload", () => {
  const state = room("KING_REQUEST_MYSTERY", "MYSTERY_VOTING");
  const round = state.currentRound!;
  const publicIds = mysteryPublicIdsForRound(round, "answer_real_secret");
  const realBallotId = publicIds.choices.answer_real_secret!;
  const action = { type: "SUBMIT_KING_MYSTERY_VOTE", actionId: "vote-action-0001", roundId: round.id, expectedPhase: "MYSTERY_VOTING", payload: { choiceId: realBallotId } } as const;
  const voted = applyPlayerAction(state, "p3", action, now).next;
  assert.equal(voted.currentRound?.kingMysteryVotes.answer_real_secret?.p3, "answer_real_secret");
  const reloaded = deserializeRoomState(serializeRoomState(voted));
  const reloadedSnapshot = playerSnapshot(reloaded, reloaded.participants.find((item) => item.id === "p3")!, now);
  assert.equal((reloadedSnapshot.taskData as { kingMystery: { options: Array<{ id: string }> } }).kingMystery.options.find((option) => option.id === realBallotId)?.id, realBallotId);

  const forged = { ...action, actionId: "vote-action-0002", payload: { choiceId: "answer_real_secret" } } as const;
  assert.throws(() => applyPlayerAction(state, "p3", forged, now), /INVALID_CHOICE/);
});

test("an in-progress legacy Frame-Up round hydrates a stable opaque mapping before its first write", () => {
  const state = room("KING_REQUEST_MYSTERY", "MYSTERY_VOTING");
  const legacy = JSON.parse(serializeRoomState(state)) as Record<string, unknown> & { currentRound: Record<string, unknown> };
  delete legacy.currentRound.kingMysteryPublicIds;
  const legacyJson = JSON.stringify(legacy);
  const firstLoad = deserializeRoomState(legacyJson);
  const secondLoad = deserializeRoomState(legacyJson);
  const first = hostSnapshot(firstLoad, now).mystery!;
  const second = hostSnapshot(secondLoad, now).mystery!;
  assert.equal(first.turnId, second.turnId);
  assert.deepEqual(first.options, second.options);
  assert.ok(first.options.every((option) => !option.id.startsWith("answer_") && !option.id.startsWith("decoy_")));

  const realBallotId = first.options.find((option) => option.text === "The true original answer")!.id;
  const action = { type: "SUBMIT_KING_MYSTERY_VOTE", actionId: "legacy-vote-0001", roundId: firstLoad.currentRound!.id, expectedPhase: "MYSTERY_VOTING", payload: { choiceId: realBallotId } } as const;
  const written = applyPlayerAction(firstLoad, "p3", action, now).next;
  assert.equal(written.currentRound!.kingMysteryVotes.answer_real_secret?.p3, "answer_real_secret");
  const persisted = JSON.parse(serializeRoomState(written)) as { currentRound: { kingMysteryPublicIds: Record<string, { turnId: string }> } };
  assert.equal(persisted.currentRound.kingMysteryPublicIds.answer_real_secret!.turnId, first.turnId);
});

test("Frame-Up reveal uses the same opaque IDs and does not leak internal IDs through generic results", () => {
  const state = room("KING_REQUEST_MYSTERY", "MYSTERY_REVEAL");
  const round = state.currentRound!;
  const result = { realChoiceId: "answer_real_secret", originalRequest: "Private source prompt", originalAuthorId: "p1", votes: { p3: "answer_real_secret" }, choiceAuthors: { answer_real_secret: null, decoy_fake_secret: "p2" }, correctPlayerIds: ["p3"], fooledByChoice: { decoy_fake_secret: [] }, sealedChoiceIds: [] };
  round.kingMysteryResults.answer_real_secret = result;
  round.results = { kind: "king_request_mystery", currentAnswerId: "answer_real_secret", currentResult: result, completedTurns: 1, totalTurns: 1 };
  const revealSnapshots = snapshots(state);
  const voting = room("KING_REQUEST_MYSTERY", "MYSTERY_VOTING");
  const ballotId = snapshots(voting)[0]!.mystery!.options.find((option) => option.text === "The true original answer")!.id;
  for (const snapshot of revealSnapshots) assert.equal(snapshot.mystery?.result?.realChoiceId, ballotId);

  state.phase = "FINAL_RESULTS";
  round.results = { kind: "king_request_mystery_final", results: { answer_real_secret: result }, totals: {}, winnerIds: ["p3"] };
  for (const snapshot of snapshots(state)) {
    const serialized = JSON.stringify(snapshot);
    assert.doesNotMatch(serialized, /answer_real_secret|answer_other_secret|decoy_fake_secret/);
    assert.deepEqual((snapshot.results as {winnerIds:string[]}).winnerIds, ["p3"], "privacy projection must retain the authoritative final winners");
  }
});

test("Royal Restoration keeps layout during answering and hides authorship and prompts in the anonymous gallery", () => {
  for (const phase of ["ANSWERING", "ANSWER_LOCK", "IMAGE_REVEAL", "FINAL_VOTING", "VOTE_LOCK"] as const) {
    const state = room("KING_PROMPTER_FINAL", phase);
    const privateSnapshots = snapshots(state);
    for (const snapshot of privateSnapshots) {
      assert.equal(snapshot.restoration?.base, "restoration-base-image");
      assert.equal(snapshot.restoration?.slots.length, restorationLayout(3).length);
      const slots = snapshot.restoration!.slots;
      if (phase === "ANSWERING" || phase === "ANSWER_LOCK") {
        assert.ok(slots.every((slot) => !slot.image && slot.answerId === undefined && slot.playerId === undefined && slot.prompt === undefined));
      }
      if (["IMAGE_REVEAL", "FINAL_VOTING", "VOTE_LOCK"].includes(phase)) {
        assert.ok(slots.every((slot) => !slot.playerId && !slot.prompt && !slot.answerId));
        assert.ok(slots.some((slot) => slot.image?.assetId === "image-real"), "anonymous collage retains generated image patches");
        const hostAnswers = "answers" in snapshot ? snapshot.answers : "answerOrder" in snapshot ? snapshot.answerOrder : [];
        for (const slot of slots.filter((item) => item.image?.assetId && hostAnswers.length)) {
          const matchingBallot = hostAnswers.find((answer) => answer.image?.assetId === slot.image?.assetId);
          assert.ok(matchingBallot, "the collage patch still corresponds to a playable image ballot");
          assert.equal("authorId" in matchingBallot ? matchingBallot.authorId : undefined, undefined, "the shared image asset cannot correlate the ballot to a player before reveal");
        }
      }
    }
    const ownerSnapshot = playerSnapshot(state, state.participants.find((item) => item.id === "p1")!, now);
    assert.equal((ownerSnapshot.taskData as { restorationSlotId: string }).restorationSlotId, "topCenter");
    if (phase === "ANSWERING") assert.equal(ownerSnapshot.ownAnswer, "The true original answer");
  }
  const revealed = snapshots(room("KING_PROMPTER_FINAL", "REVEAL"));
  for (const snapshot of revealed) {
    assert.equal(snapshot.restoration?.slots.find((slot) => slot.id === "topCenter")?.playerId, "p1");
    assert.equal(snapshot.restoration?.slots.find((slot) => slot.id === "topCenter")?.prompt, "The true original answer");
  }
});

test("Royal Restoration holds the whole anonymous collage until every image is ready", () => {
  const state = room("KING_PROMPTER_FINAL", "IMAGE_REVEAL");
  state.kingImages.answer_other_secret = { status: "GENERATING", jobId: "job-pending", conceptTitle: "Pending patch", conceptCaption: "" };
  for (const snapshot of snapshots(state)) {
    assert.ok(snapshot.restoration?.slots.every((slot) => !slot.image), "no partial image-to-slot correlations appear during generation");
  }
  state.kingImages.answer_other_secret = { status: "READY", assetId: "image-other", conceptTitle: "Other image", conceptCaption: "" };
  for (const snapshot of snapshots(state)) {
    assert.ok(snapshot.restoration?.slots.some((slot) => slot.image?.assetId === "image-real"), "ready anonymous patches appear once generation completes");
  }
});
