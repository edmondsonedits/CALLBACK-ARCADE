import assert from "node:assert/strict";
import test from "node:test";
import { errorResponse } from "../server/errors";

test("locked Arcade room configuration is a clear conflict, not an unexpected server error", async () => {
  const response = errorResponse(new Error("ARCADE_CONFIG_LOCKED"));
  assert.equal(response.status, 409);
  const body = await response.json() as { error: { code: string; message: string } };
  assert.equal(body.error.code, "ARCADE_CONFIG_LOCKED");
  assert.match(body.error.message, /Arcade game is selected when you create the room/i);
});
