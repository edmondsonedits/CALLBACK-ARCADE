import { expect, test } from "@playwright/test";

const retryMarker = "__callback_css_retry=1";

async function createJoinableSession(page: import("@playwright/test").Page) {
  const created = await page.request.post("/api/sessions", { data: {} });
  expect(created.status(), await created.text()).toBe(201);
  const { code } = await created.json() as { code: string };
  await page.context().clearCookies();
  return `/session/${code}/play`;
}

async function coreStylesheetPath(page: import("@playwright/test").Page, joinUrl: string) {
  const response = await page.request.get(joinUrl);
  expect(response.status()).toBe(200);
  const html = await response.text();
  const links = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(([tag]) => tag);
  const core = links.find((tag) => /(?:globals|layout)(?:[.-]|$)/i.test(tag.match(/href="([^"]+)/)?.[1] ?? ""))
    ?? links.find((tag) => tag.includes('data-precedence="vite-rsc/importer-resources"'));
  const href = core?.match(/href="([^"]+)/)?.[1];
  expect(href, "SSR should expose its root stylesheet as a link").toBeTruthy();
  return new URL(href!, process.env.CALLBACK_TEST_BASE_URL).pathname;
}

for (const hashed of [false,true]) test(`a transient SSR stylesheet failure recovers without losing the nickname (hashed=${hashed})`, async ({ page }) => {
  const joinUrl = await createJoinableSession(page);
  const originalStylesheetPath = await coreStylesheetPath(page, joinUrl);
  const rootStylesheetPath = hashed ? "/_next/static/css/layout.qa123.css" : originalStylesheetPath;
  const rootCss = hashed ? await (await page.request.get(originalStylesheetPath)).body() : undefined;
  let firstStylesheet = "";
  let retryRequests = 0;
  let releaseRetry!: () => void;
  const retryHeld = new Promise<void>((resolve) => { releaseRetry = resolve; });
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (hashed && request.isNavigationRequest()) {
      const response = await route.fetch();
      return route.fulfill({response,body:(await response.text()).replaceAll(`href="${originalStylesheetPath}"`,`href="${rootStylesheetPath}"`)});
    }
    if (request.resourceType() !== "stylesheet" || new URL(request.url()).pathname !== rootStylesheetPath) return route.continue();
    if (!firstStylesheet) {
      firstStylesheet = request.url();
      return route.abort("failed");
    }
    if (request.url().includes(retryMarker)) {
      retryRequests += 1;
      await retryHeld;
    }
    if (hashed) {
      return route.fulfill({status:200,contentType:"text/css",body:rootCss!});
    }
    return route.continue();
  });
  let documentRequests = 0;
  page.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests += 1; });

  await page.goto(joinUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await expect.poll(() => retryRequests).toBe(1);
  await page.getByLabel("Your name", { exact: true }).fill("Kept draft safely");
  releaseRetry();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--kp-night").trim())).not.toBe("");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Kept draft safely");
  expect(documentRequests).toBe(1);
  expect(firstStylesheet).toMatch(/(?:globals\.css|layout\.[^/]+\.css)/);
  expect(retryRequests).toBe(1);
});

test("healthy SSR styles load without a retry or redundant navigation", async ({ page }) => {
  const joinUrl = await createJoinableSession(page);
  const stylesheetRequests: string[] = [];
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "stylesheet") stylesheetRequests.push(route.request().url());
    await route.continue();
  });
  let documentRequests = 0;
  page.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests += 1; });

  await page.goto(joinUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--kp-night").trim())).not.toBe("");
  expect(stylesheetRequests.some((url) => url.includes(retryMarker))).toBe(false);
  expect(documentRequests).toBe(1);
});

test("a failed recovery request is not retried again", async ({ page }) => {
  const joinUrl = await createJoinableSession(page);
  const rootStylesheetPath = await coreStylesheetPath(page, joinUrl);
  const stylesheetRequests: string[] = [];
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "stylesheet" || new URL(route.request().url()).pathname !== rootStylesheetPath) return route.continue();
    stylesheetRequests.push(route.request().url());
    return route.abort("failed");
  });

  await page.goto(joinUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await expect.poll(() => stylesheetRequests.filter((url) => url.includes(retryMarker)).length).toBe(1);
  await page.waitForTimeout(250);
  expect(stylesheetRequests.filter((url) => url.includes(retryMarker))).toHaveLength(1);
});
