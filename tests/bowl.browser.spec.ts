import { expect, test } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };

test("Bowl of Fools Classic cannot be launched from an old setup URL", async ({ page }) => {
  await page.goto("/host/new?game=bowl");
  await expect(page).toHaveURL(/\/archived-game\?pack=bowl$/);
  await expect(page.getByRole("heading", { name: "Bowl of Fools Classic is unavailable." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to the active menu" })).toHaveAttribute("href", "/?menu=1");
});

test("Bowl of Fools Classic room creation is rejected by the public API", async ({ request }) => {
  const response = await request.post(`${baseURL}/api/rooms`, {
    headers,
    data: { gameLength: "bowl", contentMode: "party", timerAccessibility: false, playEnvironment: "remote_live" },
  });
  expect(response.status()).toBe(422);
  expect(await response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
});
