import assert from "node:assert/strict";
import test from "node:test";
import { classifyFaceProviderError } from "../server/profile-faces/provider-error";
test("portrait provider failures retain actionable classification without provider text or credentials", () => {
  for (const [error, expected] of [
    [{status:400,param:"background"}, "IMAGE_BACKGROUND_UNSUPPORTED"],
    [{status:400}, "IMAGE_REQUEST_REJECTED"],
    [{status:401}, "IMAGE_AUTH_FAILED"],
    [{status:403}, "IMAGE_ACCESS_DENIED"],
    [{code:"model_not_found"}, "IMAGE_ACCESS_DENIED"],
    [{status:429}, "IMAGE_RATE_LIMITED"],
    [{name:"APIConnectionTimeoutError"}, "IMAGE_TIMEOUT"],
    [{code:"moderation_blocked"}, "IMAGE_CONTENT_REJECTED"],
    [{message:"private provider text sk-secret",code:"untrusted"}, "IMAGE_PROVIDER_FAILED"],
  ] as const) assert.equal(classifyFaceProviderError(error), expected);
});
