import { Buffer } from "node:buffer";
import { test, expect, type Page } from "@playwright/test";
import type { PublicSketchWinner } from "../server/sketch-showcase";

// These explicit QA fixtures never enter D1, R2, or the production winners feed.
async function menu(page: Page, opts: { reduced?: boolean; broken?: boolean } = {}) {
  await page.setViewportSize({ width: 1366, height: 768 });
  if (opts.reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  const entries: PublicSketchWinner[] = ["a", "b"].map((x,i)=>({ id:`skw_${x.repeat(64)}`, artistName:`QA fixture ${i ? 'River' : 'Rose'}`, round:i+1, tiedCount:i+1, completedAt:100+i, originalUrl:`/api/showcase/sketch-winners/skw_${x.repeat(64)}/original`, transformedUrl:`/api/showcase/sketch-winners/skw_${x.repeat(64)}/transformed` }));
  const bytes = await page.evaluate(() => {
    const output: string[] = [];
    for (let i=0;i<4;i++) { const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d')!;c.fillStyle=i%2?'#265f86':'#fff4d6';c.fillRect(0,0,512,512);c.fillStyle=i%2?'#46dbdc':'#172451';c.beginPath();c.ellipse(256,256,160,90,0,0,Math.PI*2);c.fill();c.fillStyle='#ffd84b';c.font='28px sans-serif';c.fillText(`QA ${Math.floor(i/2)+1} ${i%2?'transformed':'original'}`,40,450);output.push(canvas.toDataURL('image/png').split(',')[1]!); } return output;
  });
  let feed = [...entries];
  await page.route('**/api/showcase/sketch-winners*', route=>route.fulfill({json:{entries:feed,nextOffset:null}}));
  await page.route('**/api/showcase/sketch-winners/*/*', async route=>{
    const index=entries.findIndex(e=>route.request().url().includes(e.id));
    if(opts.broken&&index===0) return route.fulfill({status:404,body:'Unavailable fixture'});
    const transformed=route.request().url().endsWith('/transformed');
    return route.fulfill({contentType:'image/png',body:Buffer.from(bytes[index*2+(transformed?1:0)]!,'base64')});
  });
  await page.route('**/intro.mp4', route=>route.abort());
  await page.goto('/');
  await page.getByRole('button',{name:'Start Callback',exact:true}).click();
  await page.getByRole('button',{name:'Winning artwork',exact:true}).click();
  const card=page.locator('.winners-showcase');
  await expect(card.locator('.winners-attribution')).toBeVisible();
  return {card, entries, removeFirst:()=>{feed=entries.slice(1);}};
}

test('menu shows a correctly paired original, fade and transformation; pause and navigation keep attribution together',async({page})=>{
  const {card}=await menu(page); const art=card.locator('[data-showcase-phase]');
  await expect(art).toHaveAttribute('data-showcase-phase','original');
  await expect(card.locator('.winners-attribution')).toContainText('QA fixture Rose');
  await page.screenshot({path:'.logs/fish-acceptance/menu-original.png'});
  await expect(art).toHaveAttribute('data-showcase-phase','fade');
  await page.waitForTimeout(700);
  const fade=card.locator('.winners-transformation');
  const opacity=await fade.evaluate(e=>Number(getComputedStyle(e).opacity));expect(opacity).toBeGreaterThan(.15);expect(opacity).toBeLessThan(.9);
  await page.screenshot({path:'.logs/fish-acceptance/menu-fade.png'});
  await card.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(card.getByRole('button',{name:'Play',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(fade).toHaveCSS('animation-play-state','paused');
  const pauseState=await fade.evaluate(async e=>{
    const animation=e.getAnimations()[0];
    if(!animation)throw new Error('The fade animation must still exist when paused');
    // CSS pause may still be pending on the browser's animation timeline.
    // Measure only once that pause has settled; keep exact equality below.
    await animation.ready;
    return {pending:animation.pending,state:animation.playState,opacity:getComputedStyle(e).opacity};
  });
  expect(pauseState.pending).toBe(false);expect(pauseState.state).toBe('paused');
  const frozen=pauseState.opacity;
  await page.waitForTimeout(2400);expect(await fade.evaluate(e=>getComputedStyle(e).opacity)).toBe(frozen);await expect(art).toHaveAttribute('data-showcase-phase','fade');
  await card.getByRole('button',{name:'Play',exact:true}).click();
  await expect(art).toHaveAttribute('data-showcase-phase','transformed');
  await page.screenshot({path:'.logs/fish-acceptance/menu-transformed.png'});
  await card.getByRole('button',{name:'Next winning artwork'}).click();
  await expect(card.locator('.winners-attribution')).toContainText('QA fixture River');await expect(art).toHaveAttribute('data-showcase-phase','original');
  await expect(card.locator('img')).toHaveCount(2);for(const image of await card.locator('img').all())await expect(image).toHaveAttribute('alt',/River/);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('button',{name:'Host a game',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Join a game',exact:true})).toBeVisible();
});

test('reduced motion and a broken pair keep the menu usable and never mismatch the next artist',async({page})=>{
  const {card}=await menu(page,{reduced:true,broken:true});
  await expect(card.locator('.winners-attribution')).toContainText('QA fixture River');
  await expect(card.locator('[data-showcase-phase]')).toHaveAttribute('data-showcase-phase','comparison');
  expect(await card.locator('.winners-comparison figure').evaluateAll(items=>{const [a,b]=items.map(el=>el.getBoundingClientRect());return a.width>0&&b.width>0&&a.right<=b.left+1;})).toBe(true);
  await expect(card.getByRole('button',{name:'Pause',exact:true})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('link',{name:'Join a game',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.logs/fish-acceptance/menu-phone.png',fullPage:true});
});

test('leaving the artwork screen for menu settings pauses its cycle until returning',async({page})=>{
  const {card}=await menu(page);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const phase=await card.locator('[data-showcase-phase]').getAttribute('data-showcase-phase');
  const artist=await card.locator('.winners-attribution').textContent();
  await page.waitForTimeout(9000);
  expect(await card.locator('[data-showcase-phase]').getAttribute('data-showcase-phase')).toBe(phase);
  expect(await card.locator('.winners-attribution').textContent()).toBe(artist);
  await page.getByRole('button',{name:'Close settings'}).click();
});
