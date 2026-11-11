/* eslint-disable @typescript-eslint/no-explicit-any -- HTTP fixture exercises several independent snapshot contracts. */
import assert from 'node:assert/strict';
import test from 'node:test';

const base = process.env.CALLBACK_TEST_BASE_URL;
function client() {
  const cookies = new Map<string, string>();
  return async (path: string, body?: unknown) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { origin: base!, 'content-type': 'application/json', 'x-callback-test-mode': 'deterministic-matrix', cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; ') }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    for (const value of response.headers.getSetCookie()) { const pair = value.split(';')[0]!; const at = pair.indexOf('='); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
    const text = await response.text();
    assert.ok(text, `${path}: empty HTTP ${response.status}`);
    return { response, data: JSON.parse(text) as any };
  };
}

test('replay history keeps each match’s own round identity and answers', { skip: !base, timeout: 90_000 }, async () => {
  const host = client();
  const created = await host('/api/rooms', { gameLength: 'standard', contentMode: 'party', timerAccessibility: false, soloMode: true, soloPlayerName: 'Archive regression', botCount: 2 });
  assert.equal(created.response.status, 201);
  const code = created.data.code;
  const sync = async () => (await host(`/api/rooms/${code}/sync`, { version: 0 })).data;
  const act = async (s: {roundId:string;phase:string}, type: string) => {
    const r = await host(`/api/rooms/${code}/host-actions`, { type, actionId: crypto.randomUUID(), roundId: s.roundId, expectedPhase: s.phase, payload: {} });
    assert.equal(r.response.status, 200, JSON.stringify(r.data));
  };
  const archives = [];
  for (let match = 1; match <= 2; match++) {
    let s = await sync(); await act(s, match === 1 ? 'START_GAME' : 'PLAY_AGAIN'); let submitted = false;
    for (let step = 0; step < 160; step++) {
      s = await sync(); if (s.phase === 'POST_GAME') break;
      if (!submitted && s.phase === 'ANSWERING' && s.roundNumber === 1) {
        const r = await host(`/api/rooms/${code}/player-actions`, { type: 'SUBMIT_ANSWER', actionId: crypto.randomUUID(), roundId: s.roundId, expectedPhase: s.phase, payload: { answer: `Unique archive marker match ${match} goose` } });
        assert.equal(r.response.status, 200, JSON.stringify(r.data)); submitted = true; s = await sync();
      }
      await act(s, s.phase === 'LOBBY' ? 'START_GAME' : 'SKIP');
    }
    assert.equal(s.phase, 'POST_GAME'); assert.ok(submitted);
    const list = (await host('/api/history')).data.matches as Array<{id:string;room_code:string;match_number:number}>;
    const receipt = list.find(m => m.room_code === code && m.match_number === match); assert.ok(receipt);
    const result = (await host(`/api/history/${receipt.id}`)).data;
    const archive = result.match ?? result;
    assert.equal(archive.rounds.at(-1).id, s.roundId, 'archive must retain the current match’s actual final round ID');
    const texts = archive.rounds.flatMap((r: {answers:Array<{text:string}>}) => r.answers.map(a => a.text));
    assert.ok(texts.includes(`Unique archive marker match ${match} goose`));
    assert.ok(!texts.includes(`Unique archive marker match ${3 - match} goose`));
    archives.push(archive);
  }
  assert.notEqual(archives[0].rounds[0].id, archives[1].rounds[0].id);
});

test('session-owned children reject direct joins, including after a kick, while parent rejoin remains possible', { skip: !base, timeout: 30_000 }, async () => {
  const host = client(), phone = client();
  const made = await host('/api/sessions', {}); assert.equal(made.response.status, 201);
  const code = made.data.code;
  const joined = await phone(`/api/sessions/${code}/join`, { nickname: 'Parent member' }); assert.equal(joined.response.status, 201);
  const view = await host(`/api/sessions/${code}`);
  const launch = await host(`/api/sessions/${code}/host`, { operation: 'launch', version: view.data.version, game: {kind:'main',gameId:'pictures'} });
  assert.equal(launch.response.status, 200, JSON.stringify(launch.data));
  const child = launch.data.activeGame.code;
  const before = await client()(`/api/rooms/${child}/join`, { nickname: 'Unlisted guest' });
  assert.equal(before.response.status, 409, 'fresh child admission must go through the parent');
  assert.equal(before.data.error.code, 'SESSION_JOIN_REQUIRED');
  await phone(`/api/sessions/${code}?role=player`);
  const snap = (await host(`/api/rooms/${child}/sync`, { version: 0 })).data;
  const member = snap.players.find((p: {nickname:string}) => p.nickname === 'Parent member'); assert.ok(member);
  const removed = await host(`/api/rooms/${child}/host-actions`, { type:'REMOVE_PLAYER',actionId:crypto.randomUUID(),roundId:snap.roundId,expectedPhase:snap.phase,payload:{playerId:member.id} });
  assert.equal(removed.response.status,200);
  const direct = await phone(`/api/rooms/${child}/join`, {nickname:'Parent member'});
  assert.equal(direct.response.status,409);
  assert.equal((await host(`/api/sessions/${code}`)).data.players.length,0);
  const rejoined = await phone(`/api/sessions/${code}/join`, {nickname:'Parent member'});
  assert.equal(rejoined.response.status,201);
  assert.equal((await host(`/api/sessions/${code}`)).data.players.length,1);
});
