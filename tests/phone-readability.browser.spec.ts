import { expect, test } from "@playwright/test";

test("the Arcade join link stays clear of the primary button and has a phone-sized target", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/play");
  const next = await page.getByRole("button", { name: /Next/ }).boundingBox();
  const arcade = await page.getByRole("link", { name: /Joining a separate Arcade service/ }).boundingBox();
  await page.screenshot({ path: ".logs/qa-classic/join-readability.png", fullPage: true });
  expect(next).not.toBeNull();
  expect(arcade).not.toBeNull();
  expect(arcade!.y - (next!.y + next!.height)).toBeGreaterThanOrEqual(12);
  expect(arcade!.height).toBeGreaterThanOrEqual(48);
});

test("phone lobby instructions have readable contrast on the dark controller", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const created = await page.request.post("/api/rooms", {
    headers: { Origin: baseURL!, "X-Callback-Test-Mode": "deterministic-matrix" },
    data: { gameLength: "standard", contentMode: "party", soloMode: true, soloLiveImages: false, soloPlayerName: "Reader", botCount: 2 },
  });
  expect(created.status()).toBe(201);
  const { code } = await created.json();
  await page.goto(`/play/${code}`);
  const copy = page.locator(".solo-lobby > p");
  await expect(copy).toBeVisible();
  const colors = await copy.evaluate((element) => ({ foreground: getComputedStyle(element).color, background: getComputedStyle(document.querySelector(".phone-shell")!).getPropertyValue("--kp-navy").trim() || "#101a3b" }));
  function luminance(color: string) {
    const rgb = color.startsWith("#") ? color.slice(1).match(/.{2}/g)!.map((channel) => parseInt(channel, 16)) : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const channels = rgb.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const light = luminance(colors.foreground), dark = luminance(colors.background);
  await page.screenshot({ path: ".logs/qa-classic/lobby-readability.png" });
  expect((Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)).toBeGreaterThanOrEqual(4.5);
});
