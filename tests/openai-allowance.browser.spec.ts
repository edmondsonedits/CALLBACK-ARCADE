import { expect, test } from "@playwright/test";

test("Sketch & Sorcery exposes the generator and explains an allowance stop", async ({ page }) => {
  await page.route("**/api/image-generators", route => route.fulfill({ json: {
    openaiLow: false, openaiCode: "OPENAI_IMAGES_EXPIRED",
    openaiMessage: "Image generation is stopped to protect the allowance.",
  } }));
  await page.goto("/host/new?gameLength=arcade&arcadeGameId=sketch-relay");
  await expect(page.locator(".room-setup-form")).toHaveAttribute("data-hydrated", "true");
  const generator = page.getByRole("combobox", { name: /^Image generator/ });
  await expect(generator).toBeVisible();
  const option = generator.locator('option[value="openai-low"]');
  await expect(option).toHaveJSProperty("disabled", true);
  await expect(option).toContainText("Allowance protection");
  await expect(generator).toHaveValue("flux-1-schnell");
  await page.screenshot({ path: ".logs/openai-allowance-blocked.png", fullPage: true });
});

test("a forged ready flag cannot enable OpenAI generation on an unconfigured server", async ({ page, request }) => {
  const status = await request.get("/api/image-generators");
  const actual = await status.json() as { openaiLow: boolean; openaiCode: string };
  test.skip(actual.openaiLow || actual.openaiCode !== "OPENAI_IMAGE_NOT_CONFIGURED", "This rejection check requires an unconfigured local provider.");
  await page.route("**/api/image-generators", route => route.fulfill({ json: { openaiLow: true } }));
  await page.goto("/host/new?gameLength=arcade&arcadeGameId=sketch-relay");
  await expect(page.locator(".room-setup-form")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("combobox", { name: /^Image generator/ }).selectOption("openai-low");
  const rejected = page.waitForResponse(response => response.url().endsWith("/api/rooms") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create Arcade room", exact: true }).click();
  expect((await rejected).status()).toBe(503);
  await expect(page.getByRole("alert")).toContainText(/OpenAI image generation is not configured/i);
  await expect(page).toHaveURL(/\/host\/new/);
});

test("the Sketch & Sorcery host can change its generator in the lobby", async ({ page }) => {
  const base = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
  const created = await page.request.post("/api/rooms", { headers: { Origin: base }, data: { gameLength: "arcade", arcadeGameId: "sketch-relay", imageModel: "flux-1-schnell" } });
  expect(created.status()).toBe(201);
  const { code } = await created.json() as { code: string };
  const hydrated = page.waitForResponse(response => response.url().includes("/sync") && response.ok());
  await page.goto("/host/" + code);
  await hydrated;
  const changed = page.waitForResponse(response => response.url().includes("/host-actions") && response.request().method() === "POST");
  await page.getByRole("combobox", { name: /^Image generator/ }).selectOption("flux-2-fast");
  expect((await changed).status()).toBe(200);
  const snapshot = await page.request.post("/api/rooms/" + code + "/sync", { headers: { Origin: base }, data: { version: 0 } });
  expect((await snapshot.json()).imageModel).toBe("flux-2-fast");
});
