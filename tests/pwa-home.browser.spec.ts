import { expect, test } from "@playwright/test";

test("home manifest and install icons are served as a standalone app", async ({ page, request, baseURL }) => {
  const manifestResponse = await request.get(new URL("/manifest.webmanifest", baseURL).toString());
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", theme_color: "#101a3b" });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icons/callback-192.png", sizes: "192x192", type: "image/png" }),
    expect.objectContaining({ src: "/icons/callback-512.png", sizes: "512x512", type: "image/png" }),
  ]));
  for (const icon of ["/icons/callback-192.png", "/icons/callback-512.png", "/icons/apple-touch-icon.png"]) {
    const response = await request.get(new URL(icon, baseURL).toString());
    expect(response.ok(), icon).toBe(true);
    expect(response.headers()["content-type"], icon).toContain("image/png");
    expect(Buffer.from(await response.body()).subarray(0, 8).toString("hex"), icon).toBe("89504e470d0a1a0a");
  }
  await page.goto("/", {waitUntil:"domcontentloaded"});
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/icons/apple-touch-icon.png");
});

test("home install prompt opens only from a tap and hides after dismissal", async ({ page }) => {
  await page.goto("/", {waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button", { name: "Install Callback" })).toBeVisible();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "dismissed"; platform: string }>;
    };
    event.prompt = async () => { (window as typeof window & { __installPromptCalled?: boolean }).__installPromptCalled = true; };
    event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
    window.dispatchEvent(event);
  });
  const install = page.getByRole("button", { name: "Install Callback" });
  await expect(install).toBeVisible();
  await page.waitForTimeout(50);
  await install.click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __installPromptCalled?: boolean }).__installPromptCalled)).toBe(true);
  await expect(install).toHaveCount(0);
});

test("iOS home shows Add to Home Screen instructions and standalone mode hides the affordance", async ({ browser, baseURL }) => {
  const ios = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
  const iosPage = await ios.newPage();
  await iosPage.goto(new URL("/", baseURL).toString(), {waitUntil:"domcontentloaded"});
  const install = iosPage.getByRole("button", { name: "Install Callback" });
  await expect(install).toBeVisible();
  await install.click();
  await expect(iosPage.getByRole("status")).toContainText("Share");
  await expect(iosPage.getByRole("status")).toContainText("Add to Home Screen");
  await ios.close();

  const standalone = await browser.newContext();
  await standalone.addInitScript(() => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => query === "(display-mode: standalone)"
      ? ({ matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false } as MediaQueryList)
      : nativeMatchMedia(query);
  });
  const standalonePage = await standalone.newPage();
  await standalonePage.goto(new URL("/", baseURL).toString(), {waitUntil:"domcontentloaded"});
  await expect(standalonePage.getByRole("button", { name: "Install Callback" })).toHaveCount(0);
  await standalone.close();
});


test("install control stays reachable beside menu controls on phones and desktop",async({page,browserName})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const install=page.getByRole('button',{name:'Install Callback',exact:true});await expect(install).toBeVisible();
 await page.getByRole('button',{name:'Start Callback',exact:true}).click();
 for(const [width,height] of [[320,480],[390,664],[1280,720]]){
  await page.setViewportSize({width,height});
  expect(await install.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  const overlaps=await install.evaluate(el=>{const r=el.getBoundingClientRect();return [...document.querySelectorAll('button')].filter(b=>b!==el&&!b.closest('[hidden]')&&b.getBoundingClientRect().width>0).filter(b=>{const a=b.getBoundingClientRect();return a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top;}).map(b=>b.textContent);});
  expect(overlaps).toEqual([]);
 }
 if(browserName==='chromium'){
  const cdp=await page.context().newCDPSession(page);
  const result=await cdp.send('Page.getAppManifest');expect(result.errors).toEqual([]);
 }
 await page.screenshot({path:'.logs/fish-acceptance/pwa-home.png'});
});
