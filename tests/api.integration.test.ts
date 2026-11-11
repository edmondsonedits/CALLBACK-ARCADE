import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.CALLBACK_TEST_BASE_URL;

interface ApiResult<T = Record<string, unknown>> { response: Response; body: T; cookie: string }

async function api<T = Record<string, unknown>>(path: string, options: { cookie?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl!, ...(options.cookie ? { Cookie: options.cookie } : {}) },
    body: JSON.stringify(options.body ?? {}),
  });
  const body = response.status === 204 ? {} as T : await response.json() as T;
  const setCookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  return { response, body, cookie: setCookie };
}

async function waitForPhase(code: string, cookie: string, phases: string[], timeoutMs = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await api<{ phase: string; roundId: string; version: number; answers?: Array<Record<string, unknown>>; players: Array<Record<string, unknown>> }>(`/api/rooms/${code}/sync`, { cookie, body: { version: 0 } });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    if (phases.includes(result.body.phase)) return result.body;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Timed out waiting for ${phases.join(" or ")}`);
}

test("unconfigured OpenAI images are blocked without changing the host's generator", { skip: !baseUrl, timeout: 30_000 }, async (t) => {
  const availability = await fetch(`${baseUrl}/api/image-generators`).then((response) => response.json()) as { openaiLow: boolean };
  if (availability.openaiLow) { t.skip("This check needs a site without an OpenAI image key."); return; }
  const rejected = await api<{ error: { code: string } }>("/api/rooms", { body: { gameLength: "pictures", imageModel: "openai-low" } });
  assert.equal(rejected.response.status, 503);
  assert.equal(rejected.body.error.code, "OPENAI_IMAGE_NOT_CONFIGURED");
  const created = await api<{ code: string }>("/api/rooms", { body: { gameLength: "pictures", imageModel: "flux-2-fast" } });
  assert.equal(created.response.status, 201);
  const attempted = await api<{ error: { code: string } }>(`/api/rooms/${created.body.code}/host-actions`, { cookie: created.cookie, body: { type: "SET_CONFIG", actionId: crypto.randomUUID(), roundId: "lobby", expectedPhase: "LOBBY", payload: { imageModel: "openai-low" } } });
  assert.equal(attempted.response.status, 503);
  assert.equal(attempted.body.error.code, "OPENAI_IMAGE_NOT_CONFIGURED");
  const snapshot = await api<{ imageModel: string }>(`/api/rooms/${created.body.code}/sync`, { cookie: created.cookie, body: { version: 0 } });
  assert.equal(snapshot.body.imageModel, "flux-2-fast");
});

test("room start is host-only and player start attempts are rejected", { skip: !baseUrl, timeout: 20_000 }, async () => {
  const created = await api<{ code: string }>("/api/rooms", { body: { gameLength: "standard", contentMode: "party", timerAccessibility: false } });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const code = created.body.code;
  const one = await api<{ id: string }>(`/api/rooms/${code}/join`, { body: { nickname: "Arcade Host Guard 1" } });
  const two = await api<{ id: string }>(`/api/rooms/${code}/join`, { body: { nickname: "Arcade Host Guard 2" } });
  assert.equal(one.response.status, 201); assert.equal(two.response.status, 201);
  const lobby = await api<{ roundId: string }>(`/api/rooms/${code}/sync`, { cookie: created.cookie, body: { version: 0 } });
  const playerStart = await api<{ error: { code: string } }>(`/api/rooms/${code}/host-actions`, { cookie: one.cookie, body: { type: "START_GAME", actionId: crypto.randomUUID(), roundId: lobby.body.roundId, expectedPhase: "LOBBY", payload: {} } });
  assert.equal(playerStart.response.status, 401);
  const hostStart = await api(`/api/rooms/${code}/host-actions`, { cookie: created.cookie, body: { type: "START_GAME", actionId: crypto.randomUUID(), roundId: lobby.body.roundId, expectedPhase: "LOBBY", payload: {} } });
  assert.equal(hostStart.response.status, 200, JSON.stringify(hostStart.body));
});

test("Arcade room creation rejects catalog games that are not playable", { skip: !baseUrl, timeout: 20_000 }, async () => {
  const response = await api<{ error: { code: string } }>("/api/rooms", { body: { gameLength: "arcade", arcadeGameId: "tap-race", contentMode: "party", timerAccessibility: false } });
  assert.equal(response.response.status, 409);
  assert.equal(response.body.error.code, "ARCADE_GAME_UNAVAILABLE");
});

test("archived packs cannot create rooms or be selected through host settings", { skip: !baseUrl, timeout: 20_000 }, async () => {
  for (const gameLength of ["bowl", "royal-war-room", "birthday"] as const) {
    const rejected = await api<{ error: { code: string } }>("/api/rooms", { body: { gameLength, birthdayName: "Alex", contentMode: "party", timerAccessibility: false } });
    assert.equal(rejected.response.status, 422, gameLength);
    assert.equal(rejected.body.error.code, "INVALID_REQUEST", gameLength);
  }
  const created = await api<{ code: string }>("/api/rooms", { body: { gameLength: "standard", contentMode: "party", timerAccessibility: false } });
  const lobby = await api<{ roundId: string; phase: string }>(`/api/rooms/${created.body.code}/sync`, { cookie: created.cookie, body: { version: 0 } });
  const archivedChange = await api<{ error: { code: string } }>(`/api/rooms/${created.body.code}/host-actions`, { cookie: created.cookie, body: { type: "SET_CONFIG", actionId: crypto.randomUUID(), roundId: lobby.body.roundId, expectedPhase: lobby.body.phase, payload: { gameLength: "royal-war-room" } } });
  assert.equal(archivedChange.response.status, 409);
  assert.equal(archivedChange.body.error.code, "GAME_ARCHIVED");
});

test("local D1 vertical slice: create, join three, answer, vote, reveal, reconnect, isolate", { skip: !baseUrl, timeout: 40_000 }, async () => {
  const created = await api<{ code: string }>("/api/rooms", { body: { gameLength: "standard", contentMode: "party", timerAccessibility: false } });
  assert.equal(created.response.status, 201); assert.match(created.body.code, /^[A-HJ-KM-NP-Z2-9]{4}$/); assert.ok(created.cookie.includes(`callback_host_${created.body.code}`));
  const code = created.body.code;
  const playerSessions: Array<{ id: string; cookie: string; nickname: string }> = [];
  for (const nickname of ["Zoë 🎉", "<b>Alex</b>", "Riley"]) {
    const joined = await api<{ id: string; nickname: string; role: string }>(`/api/rooms/${code}/join`, { body: { nickname } });
    assert.equal(joined.response.status, 201, JSON.stringify(joined.body)); assert.equal(joined.body.role, "player");
    playerSessions.push({ id: joined.body.id, cookie: joined.cookie, nickname });
  }
  const duplicate = await api<{ error: { code: string; detail: { suggestion: string } } }>(`/api/rooms/${code}/join`, { body: { nickname: "riley" } });
  assert.equal(duplicate.response.status, 409); assert.equal(duplicate.body.error.code, "DUPLICATE_NICKNAME"); assert.equal(duplicate.body.error.detail.suggestion, "riley 2");
  const audience = await api<{ role: string; id: string }>(`/api/rooms/${code}/join`, { body: { nickname: "Audience", audience: true } });
  assert.equal(audience.response.status, 201); assert.equal(audience.body.role, "audience");

  const lobby = await api<{ phase: string; roundId: string }>(`/api/rooms/${code}/sync`, { cookie: created.cookie, body: { version: 0 } });
  assert.equal(lobby.body.phase, "LOBBY");
  const started = await api(`/api/rooms/${code}/host-actions`, { cookie: created.cookie, body: { type: "START_GAME", actionId: crypto.randomUUID(), roundId: lobby.body.roundId, expectedPhase: "LOBBY", payload: {} } });
  assert.equal(started.response.status, 200, JSON.stringify(started.body));
  const lateJoin = await api<{ error: { code: string } }>(`/api/rooms/${code}/join`, { body: { nickname: "Late Friend" } });
  assert.equal(lateJoin.response.status, 409); assert.equal(lateJoin.body.error.code, "JOINING_LOCKED");
  const answering = await waitForPhase(code, created.cookie, ["ANSWERING"]);
  const actionId = crypto.randomUUID();
  for (let index = 0; index < playerSessions.length; index += 1) {
    const submitted = await api(`/api/rooms/${code}/player-actions`, { cookie: playerSessions[index].cookie, body: { type: "SUBMIT_ANSWER", actionId: index === 0 ? actionId : crypto.randomUUID(), roundId: answering.roundId, expectedPhase: "ANSWERING", payload: { answer: ["A goose with admin access", "The moon owes me ten dollars", "Soup, but make it formal"][index] } } });
    assert.equal(submitted.response.status, 200, JSON.stringify(submitted.body));
  }
  const duplicateAction = await api(`/api/rooms/${code}/player-actions`, { cookie: playerSessions[0].cookie, body: { type: "SUBMIT_ANSWER", actionId, roundId: answering.roundId, expectedPhase: "ANSWERING", payload: { answer: "A goose with admin access" } } });
  assert.equal(duplicateAction.response.status, 200); assert.equal(duplicateAction.response.headers.get("x-callback-idempotent"), "true");

  const voting = await waitForPhase(code, created.cookie, ["VOTING"]);
  assert.ok(voting.answers?.length === 3); assert.ok(voting.answers?.every((answer) => !("authorId" in answer)), "host response leaked authors before reveal");
  for (const player of playerSessions) {
    const phone = await api<{ phase: string; roundId: string; answerOrder: Array<{ id: string }> }>(`/api/rooms/${code}/sync`, { cookie: player.cookie, body: { version: 0 } });
    assert.equal(phone.body.phase, "VOTING"); assert.equal(phone.body.answerOrder.length, 2);
    const vote = await api(`/api/rooms/${code}/player-actions`, { cookie: player.cookie, body: { type: "SUBMIT_VOTE", actionId: crypto.randomUUID(), roundId: phone.body.roundId, expectedPhase: "VOTING", payload: { answerIds: [phone.body.answerOrder[0].id] } } });
    assert.equal(vote.response.status, 200, JSON.stringify(vote.body));
  }
  const revealed = await waitForPhase(code, created.cookie, ["REVEAL", "ROUND_RESULTS"]);
  assert.ok(revealed.answers?.every((answer) => "authorId" in answer));
  assert.ok(revealed.players.every((player) => player.id === audience.body.id ? player.score === undefined : typeof player.score === "number"));

  const restoredPlayer = await api<{ selfId: string; version: number }>(`/api/rooms/${code}/sync`, { cookie: playerSessions[0].cookie, body: { version: 0 } });
  assert.equal(restoredPlayer.response.status, 200); assert.equal(restoredPlayer.body.selfId, playerSessions[0].id);
  const restoredHost = await api<{ role: string }>(`/api/rooms/${code}/sync`, { cookie: created.cookie, body: { version: 0 } });
  assert.equal(restoredHost.body.role, "host");

  const roomB = await api<{ code: string }>("/api/rooms", { body: { gameLength: "standard", contentMode: "family", timerAccessibility: false } });
  const crossRoom = await api(`/api/rooms/${roomB.body.code}/sync`, { cookie: created.cookie, body: { version: 0 } });
  assert.equal(crossRoom.response.status, 401);
});
