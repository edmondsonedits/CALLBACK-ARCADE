import { expect, test, type Browser } from "@playwright/test";

const baseURL = process.env.CALLBACK_TEST_BASE_URL ?? "http://localhost:3000";
const headers = { "Content-Type": "application/json", Origin: baseURL };
const sizes = [
  { name: "320x480", width: 320, height: 480 },
  { name: "375x600", width: 375, height: 600 },
  { name: "390x664", width: 390, height: 664 },
  { name: "412x700", width: 412, height: 700 },
  { name: "landscape 844x390", width: 844, height: 390 },
];

test("Arcade player style controls remain scroll reachable on compact phones", async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ baseURL, viewport: sizes[0], extraHTTPHeaders: { Origin: baseURL } });
  const created = await context.request.post("/api/rooms", { headers, data: { gameLength: "arcade", arcadeGameId: "arena-survivor", contentMode: "party", timerAccessibility: false } });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  const joined = await context.request.post(`/api/rooms/${code}/join`, { headers, data: { nickname: "Style Tester" } });
  expect(joined.status(), await joined.text()).toBe(201);
  const phone = await context.newPage();
  try {
    await phone.goto(`/play/${code}`);
    await expect(phone.locator(".phone-header")).toBeVisible();
    await expect(phone.locator(".phone-phase-row .arcade-touch-size")).toBeVisible();
    await phone.getByRole("button", { name: "Toggle larger touch controls" }).click();
    await expect(phone.getByRole("button", { name: "Toggle larger touch controls" })).toHaveAttribute("aria-pressed", "true");
    await phone.getByRole("button", { name: "Style", exact: true }).click();
    await expect(phone.getByText("Your look", { exact: true })).toBeVisible();

    for (const size of sizes) {
      await test.step(size.name, async () => {
        await phone.setViewportSize({ width: size.width, height: size.height });
        const buttons = [
          phone.getByRole("button", { name: "Customize character", exact: true }),
          phone.getByRole("button", { name: "Character saved", exact: true }),
        ];
        for (const button of buttons) {
          await button.evaluate(element => element.scrollIntoView({ block: "nearest", inline: "nearest" }));
          await expect(button).toBeVisible();
          const reachable = await button.evaluate(element => {
            const box = element.getBoundingClientRect();
            const x = Math.max(0, Math.min(innerWidth - 1, box.left + box.width / 2));
            const y = Math.max(0, Math.min(innerHeight - 1, box.top + box.height / 2));
            const hit = document.elementFromPoint(x, y);
            const screen = element.closest<HTMLElement>(".phone-style-screen");
            return {
              inViewport: box.top >= 0 && box.bottom <= innerHeight,
              hitTarget: hit === element || (hit instanceof Element && element.contains(hit)),
              scrollTop: screen?.scrollTop ?? -1,
              scrollHeight: screen?.scrollHeight ?? -1,
              clientHeight: screen?.clientHeight ?? -1,
            };
          });
          expect(reachable.inViewport, `${size.name} button is within the phone viewport: ${JSON.stringify(reachable)}`).toBe(true);
          expect(reachable.hitTarget, `${size.name} button receives pointer hit testing: ${JSON.stringify(reachable)}`).toBe(true);
        }
        await expect(phone.getByRole("navigation", { name: "Phone sections" })).toBeVisible();
      });
    }
    await phone.setViewportSize({width:390,height:664});
    await phone.getByRole("button",{name:"Customize character",exact:true}).scrollIntoViewIfNeeded();
    await phone.screenshot({path:".logs/fish-acceptance/phone-fit/style-controls.png"});
    await phone.getByRole("button",{name:"Customize character",exact:true}).click();
    await expect(phone.getByRole("dialog")).toBeVisible();
    await phone.getByRole("button",{name:/Use this avatar/}).click();
    await expect(phone.getByRole("dialog")).not.toBeVisible();
  } finally { await context.close(); }
});
