import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { useRoomSync } from "../app/components/useRoomSync";
import * as stateSync from "../lib/game/state-sync";
import * as nativeSocketTickets from "../lib/arcade/native-socket-ticket";

// Execute the real hook with deterministic state/ref storage and HTTP responses.
// Polls are invoked explicitly; this does not simulate React scheduling or a DOM.
const compiledHook = ts.transpileModule(readFileSync(new URL("../app/components/useRoomSync.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

function harness() {
  const slots: unknown[] = [];
  let cursor = 0;
  let clock = 10_000;
  const replies: (Response | Error | Promise<Response>)[] = [];
  const requests: { url: string; body: string }[] = [];
  const exports = {} as { useRoomSync: typeof useRoomSync };
  runInNewContext(compiledHook, {
    exports,
    Date: class extends Date { static now() { return clock; } },
    WebSocket: { OPEN: 1 },
    navigator: { onLine: true },
    require(name: string) {
      if (name === "../../lib/game/state-sync") return stateSync;
      if (name === "../../lib/arcade/native-socket-ticket") return nativeSocketTickets;
      assert.equal(name, "react");
      return {
        useState<T>(initial: T) {
          const index = cursor++;
          if (!(index in slots)) slots[index] = initial;
          return [slots[index], (next: T | ((previous: T) => T)) => {
            slots[index] = typeof next === "function" ? (next as (previous: T) => T)(slots[index] as T) : next;
          }];
        },
        useRef<T>(initial: T) {
          const index = cursor++;
          if (!(index in slots)) slots[index] = { current: initial };
          return slots[index];
        },
        useCallback: <T>(callback: T) => callback,
        useEffect: () => {},
      };
    },
    async fetch(url: string, options: { body: string }) {
      requests.push({ url, body: options.body });
      assert.ok(replies.length, "Every HTTP request must have a queued response");
      const reply = replies.shift()!;
      if (reply instanceof Error) throw reply;
      return reply;
    },
  });
  return {
    requests,
    advance(ms: number) { clock += ms; },
    respond(...responses: (Response | Error | Promise<Response>)[]) { replies.push(...responses); },
    read() { cursor = 0; return exports.useRoomSync("TEST", "host"); },
  };
}

const unchanged = (version = 7) => new Response(null, { status: 204, headers: { "x-callback-version": String(version) } });
const failure = (status: number, code: string) => Response.json({ error: { code, message: `Failure: ${code}` } }, { status });
const snapshot = () => Response.json({ stateVersion: 7, phase: "LOBBY", soloMode: true, soloLiveImages: false, imageJobsPending: false, image: null });

for (const outage of ["offline", "server"] as const) {
  test(`unchanged-room recovery clears the stale ${outage} sync error without replacing the snapshot`, async () => {
    const h = harness();
    h.respond(snapshot(), outage === "offline" ? new Error("Network unavailable") : failure(503, "SERVICE_UNAVAILABLE"), unchanged());
    await h.read().sync();
    const before = h.read().snapshot;
    await h.read().sync();
    assert.equal(h.read().reconnecting, true);
    assert.equal(h.read().error?.code, outage === "offline" ? "OFFLINE" : "SERVICE_UNAVAILABLE");
    await h.read().sync();
    assert.equal(h.read().reconnecting, false);
    assert.equal(h.read().error, null);
    assert.equal(h.read().snapshot, before);
    assert.deepEqual(h.requests.map(({ body }) => JSON.parse(body).version), [0, 7, 7]);
  });
}

test("another failed poll retains the connection error and reconnecting state", async () => {
  const h = harness();
  h.respond(new Error("Offline"), failure(503, "UNAVAILABLE"));
  await h.read().sync();
  await h.read().sync();
  assert.equal(h.read().reconnecting, true);
  assert.equal(h.read().error?.code, "UNAVAILABLE");
});

for (const [status, code] of [[401, "UNAUTHORIZED"], [404, "ROOM_NOT_FOUND"], [422, "INVALID_REQUEST"]] as const) {
  test(`204 recovery preserves a newer ${status} sync error`, async () => {
    const h = harness();
    h.respond(new Error("Offline"), failure(status, code), unchanged());
    await h.read().sync();
    await h.read().sync();
    const error = h.read().error;
    assert.equal(error?.code, code);
    await h.read().sync();
    assert.equal(h.read().error, error);
    assert.equal(h.read().reconnecting, false);
  });
}

for (const [status, code] of [[409, "ACTION_CONFLICT"], [500, "ACTION_FAILED"], [503, "SERVICE_UNAVAILABLE"]] as const) {
  test(`204 recovery preserves an intervening ${status} action error`, async () => {
    const h = harness();
    let recover!: (response: Response) => void;
    h.respond(failure(503, "SERVICE_UNAVAILABLE"), new Promise<Response>((resolve) => { recover = resolve; }), failure(status, code));
    await h.read().sync();
    const recovering = h.read().sync();
    await assert.rejects(h.read().send({ type: "START_GAME", actionId: "action-test", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }), new RegExp(code));
    const actionError = h.read().error;
    assert.equal(actionError?.code, code);
    recover(unchanged());
    await recovering;
    assert.equal(h.read().error, actionError);
    assert.equal(h.read().reconnecting, false);
  });
}

test("unchanged-room recovery does not move the accepted version backwards", async () => {
  const h = harness();
  h.respond(snapshot(), new Error("Offline"), unchanged(6), unchanged());
  await h.read().sync();
  await h.read().sync();
  await h.read().sync();
  await h.read().sync();
  assert.equal(JSON.parse(h.requests.at(-1)!.body).version, 7);
  assert.equal(h.read().snapshot?.stateVersion, 7);
});


test("ten queued sketch transformations dispatch concurrently and unchanged polls preserve in-flight guards", async () => {
  const h = harness();
  const jobs = Array.from({ length: 10 }, (_, index) => `sketch-transform-${index}`);
  const resolvers: Array<(value: Response) => void> = [];
  h.respond(Response.json({ stateVersion: 7, phase: "ARCADE_ACTIVE", soloMode: false, sketchImageJobs: jobs, imageJobsPending: true, players: [] }), ...jobs.map(() => new Promise<Response>(resolve => resolvers.push(resolve))));
  await h.read().sync();
  assert.deepEqual(h.requests.filter(request => request.url.endsWith("/jobs/run")).map(request => JSON.parse(request.body).jobId), jobs);
  h.respond(unchanged()); await h.read().sync();
  assert.equal(h.requests.filter(request => request.url.endsWith("/jobs/run")).length, 10);
  for (const resolve of resolvers) resolve(Response.json({ status: "READY" }));
});

test("an unchanged sketch snapshot retries a failed job dispatch after the bounded retry interval", async () => {
  const h = harness();
  h.respond(Response.json({ stateVersion: 7, phase: "ARCADE_ACTIVE", soloMode: false, sketchImageJobs: ["sketch-1"], imageJobsPending: true, players: [] }), new Error("Connection dropped"));
  await h.read().sync(); await Promise.resolve(); await Promise.resolve();
  h.advance(5001);
  h.respond(unchanged(), Response.json({ status: "READY" })); await h.read().sync();
  assert.deepEqual(h.requests.filter(request => request.url.endsWith("/jobs/run")).map(request => JSON.parse(request.body).jobId), ["sketch-1", "sketch-1"]);
});
