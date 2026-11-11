import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { OpenAILowImageAI } from "../server/openai-image";

const webp = new Uint8Array(1024);
webp.set([0x52, 0x49, 0x46, 0x46]); webp.set([0x57, 0x45, 0x42, 0x50], 8);
const imageResponse = () => Response.json({ created: 1, data: [{ b64_json: Buffer.from(webp).toString("base64") }], output_format: "webp", quality: "low", size: "1024x1024" });

test("OpenAI low sends the real SDK an explicit low-quality square generation", async () => {
  let payload: Record<string, unknown> = {};
  const client = new OpenAI({ apiKey: "test-only", fetch: async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, "/v1/images/generations");
    payload = await request.json() as Record<string, unknown>;
    return imageResponse();
  } });
  const image = await new OpenAILowImageAI(client).generate("A pigeon hosting a royal game show", { model: "openai-low", aspect: "square", outputSize: 480 });
  assert.deepEqual(payload, { model: "gpt-image-2", prompt: "A pigeon hosting a royal game show", size: "1024x1024", quality: "low", output_format: "webp", n: 1 });
  assert.deepEqual(image?.bytes, webp);
  assert.equal(image?.contentType, "image/webp");
});

test("comic continuity uses image edits with the previous artwork and low quality", async () => {
  const client = new OpenAI({ apiKey: "test-only", fetch: async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, "/v1/images/edits");
    const body = await request.formData();
    assert.equal(body.get("model"), "gpt-image-2");
    assert.equal(body.get("quality"), "low");
    assert.equal(body.get("size"), "1536x1024");
    const images = body.getAll("image[]") as File[];
    assert.equal(images.length, 1);
    assert.deepEqual(new Uint8Array(await images[0].arrayBuffer()), webp);
    return imageResponse();
  } });
  await new OpenAILowImageAI(client).generate("The pigeon returns", { model: "openai-low", aspect: "landscape", references: [{ bytes: webp, contentType: "image/webp" }] });
});

test("a failed paid image request is not automatically submitted again", async () => {
  let requests = 0;
  const client = new OpenAI({ apiKey: "test-only", fetch: async () => {
    requests += 1;
    return Response.json({ error: { message: "Unavailable", type: "server_error", code: "server_error" } }, { status: 500 });
  } });
  await assert.rejects(() => new OpenAILowImageAI(client).generate("A pigeon", { model: "openai-low", aspect: "square" }));
  assert.equal(requests, 1);
});

test("non-image API output cannot become a ready game image", async () => {
  const client = new OpenAI({ apiKey: "test-only", fetch: async () => Response.json({ created: 1, data: [{ b64_json: Buffer.alloc(1024).toString("base64") }] }) });
  await assert.rejects(() => new OpenAILowImageAI(client).generate("A pigeon", { model: "openai-low", aspect: "square" }), /UNSUPPORTED_IMAGE_BYTES/);
});
