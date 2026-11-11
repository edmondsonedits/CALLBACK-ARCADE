import assert from "node:assert/strict";
import test from "node:test";
import { errorResponse } from "../server/errors";

for (const [code, status] of [["ARCADE_RESULT_REQUIRED", 409], ["ROUND_CLOSED", 409], ["STALE_SKETCH_RELAY_ASSIGNMENT", 409], ["INVALID_GUESSES", 422], ["INVALID_EMOTE", 422], ["TOO_FAST", 429]] as const) {
  test(`expected sketch rejection ${code} returns actionable HTTP ${status}`, async () => {
    const response = errorResponse(new Error(code));
    assert.equal(response.status, status);
    const payload = await response.json() as { error: { code: string; message: string } }; assert.equal(payload.error.code, code); assert.notEqual(payload.error.message, "Something went wrong. The room is still safe; try again.");
  });
}
