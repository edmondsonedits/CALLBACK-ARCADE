import assert from "node:assert/strict";
import test from "node:test";
import { arcadeDirectoryRedirect, archivedArcadeEntryResponse } from "../lib/arcade/archive-gate";

async function hash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function env(gameId: string, status = "PLAYING", hostToken = "host-token", seatToken = "seat-token") {
  return {
    DB: {
      prepare(sql: string) {
        return {
          bind() {
            return {
              async first() {
                if (sql.includes("online_arcade_rooms")) return status === "PLAYING" ? { game_id: gameId, host_token_hash: await hash(hostToken), status } : null;
                if (sql.includes("online_arcade_seats")) return { seat_id: "00", token_hash: await hash(seatToken) };
                return null;
              },
            };
          },
        };
      },
    },
  } as never;
}

function mirrorEnv(options: { gameId?: string; parentActive?: boolean; parentExpired?: boolean; mirrorValid?: boolean; mirrorFresh?: boolean } = {}) {
  const mirrorToken = "mirror-secret";
  return {
    DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async first() {
                if (sql.includes("online_arcade_rooms")) return { game_id: options.gameId ?? "space-bash", host_token_hash: await hash("host-token"), status: "PLAYING" };
                if (sql.includes("callback_sessions")) return options.parentActive === false || options.parentExpired ? null : { code: "PARENT" };
                if (sql.includes("callback_session_mirrors")) {
                  if (options.mirrorValid === false || options.mirrorFresh === false) return null;
                  return values[0] === "PARENT" && values[1] === await hash(mirrorToken) ? { token_hash: values[1] } : null;
                }
                return null;
              },
            };
          },
        };
      },
    },
  } as never;
}

test("standalone archived game pages show an unavailable response", async () => {
  const direct = new Request("https://game.test/arcade-games/space-bash/index.html");
  const response = await archivedArcadeEntryResponse(direct, env("space-bash"));
  assert.equal(response?.status, 410);
  assert.match(await response!.text(), /Space Bash.*is archived/);
  const oldOnline = await archivedArcadeEntryResponse(new Request("https://game.test/arcade-games/royal-ballistix/online-v65.html?online=1"), env("sky-balls"));
  assert.equal(oldOnline?.status, 410);
  assert.equal((await archivedArcadeEntryResponse(new Request("https://game.test/arcade-games/space-bash/"), env("space-bash")))?.status, 410);
});

test("retained game directory links reach the canonical package and preserve queries", () => {
  for (const path of ["/arcade-games/royal-sumo", "/arcade-games/royal-sumo/"]) {
    const response = arcadeDirectoryRedirect(new Request(`https://game.test${path}?session=ABCD`));
    assert.equal(response?.status, 307);
    assert.equal(response?.headers.get("Location"), "https://game.test/arcade-games/royal-sumo/index.html?session=ABCD");
  }
  assert.equal(arcadeDirectoryRedirect(new Request("https://game.test/arcade-games/space-bash/")), null);
  assert.equal(arcadeDirectoryRedirect(new Request("https://game.test/arcade-games/unknown/")), null);
});

test("archived online view requires an authenticated host/player route and a playing matching room", async () => {
  const request = new Request("https://game.test/arcade-games/space-bash/online-v65.html?online=1", {
    headers: { Referer: "https://game.test/arcade/online/host/ABCD", Cookie: "callback_arcade_host_ABCD=host-token" },
  });
  assert.equal(await archivedArcadeEntryResponse(request, env("space-bash")), null);
  const player = new Request("https://game.test/arcade-games/space-bash/online-v65.html?online=1", {
    headers: { Referer: "https://game.test/arcade/online/join/ABCD", Cookie: "callback_arcade_seat_ABCD=seat-token" },
  });
  assert.equal(await archivedArcadeEntryResponse(player, env("space-bash")), null);
  const completed = await archivedArcadeEntryResponse(request, env("space-bash", "RESULT"));
  assert.equal(completed?.status, 410);
  const mismatch = await archivedArcadeEntryResponse(request, env("sky-balls"));
  assert.equal(mismatch?.status, 410);
});

test("archived online renderer permits only a fresh authenticated active mirror session", async () => {
  const request = new Request("https://game.test/arcade-games/space-bash/online-v65.html?online=1", {
    headers: { Referer: "https://game.test/arcade/online/display/ABCD", Cookie: "callback_lobby_mirror_PARENT=mirror-secret" },
  });
  assert.equal(await archivedArcadeEntryResponse(request, mirrorEnv()), null);
  assert.equal((await archivedArcadeEntryResponse(new Request(request.url, { headers: { Referer: request.headers.get("Referer")! } }), mirrorEnv()))?.status, 410, "missing mirror cookie is denied");
  assert.equal((await archivedArcadeEntryResponse(request, mirrorEnv({ mirrorValid: false })) )?.status, 410, "wrong mirror token is denied");
  assert.equal((await archivedArcadeEntryResponse(request, mirrorEnv({ mirrorFresh: false })) )?.status, 410, "stale mirror heartbeat is denied");
  assert.equal((await archivedArcadeEntryResponse(request, mirrorEnv({ parentActive: false })) )?.status, 410, "parent without an active online child is denied");
  assert.equal((await archivedArcadeEntryResponse(request, mirrorEnv({ parentExpired: true })) )?.status, 410, "expired parent session is denied");
});
