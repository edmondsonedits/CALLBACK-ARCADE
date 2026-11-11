import { expect, test } from '@playwright/test';
import { defaultCharacterProfile } from '../lib/character-profile';
async function openCharacterProfile(page: import('@playwright/test').Page) {
  await page.goto('/play');
  await page.waitForLoadState('networkidle');
  const entry = page.getByRole('button', { name: 'Your character', exact: true });
  await expect(entry).toBeEnabled();
  await entry.click();
  await expect(page.getByRole('button', { name: 'Customize character', exact: true })).toBeEnabled();
}
async function openPhotoEditor(page: import('@playwright/test').Page) {
  await openCharacterProfile(page);
  const photoButton = page.getByRole('button', { name: 'Use a face photo', exact: true });
  await expect(photoButton).toBeEnabled();
  await photoButton.click();
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/profile/face/trim', r => r.fulfill({json:{faceId:r.request().postDataJSON().faceId}}));
  await page.addInitScript(() => {
    const original = window.fetch;
    window.fetch = async (input, init) => {
      if (input === '/api/profile/face' && init?.body instanceof Blob) {
        const bytes = new Uint8Array(await init.body.arrayBuffer());
        (window as unknown as { __photoUpload: number[] }).__photoUpload = Array.from(bytes);
      }
      return original(input, init);
    };
  });
});
const faceId = 'ba11958b-767c-4e45-a92d-b6a59ad3346c';
const trimmedFaceId = 'cc11958b-767c-4e45-a92d-b6a59ad3346c';

test('camera and upload are separate compact choices that share the crop flow', async ({ page }) => {
  await page.setViewportSize({width:320,height:640});
  await page.route('**/api/profile',route=>route.fulfill({json:{version:1,...defaultCharacterProfile(),created:false}}));
  let generations=0;
  await page.route('**/api/profile/face',async route=>{generations++;await route.fulfill({json:{faceId}});});
  await openPhotoEditor(page);

  const editor=page.locator('.photo-face-editor');
  await expect(page.getByRole('button',{name:'Take a photo',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Upload photo',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Take a photo',exact:true}).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByText('Photo privacy and tips',{exact:true})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Generating sends it to OpenAI/)).toBeVisible();
  await page.keyboard.press('Enter');
  const cameraInput=page.locator('input[type="file"][capture="user"]');
  await expect(cameraInput).toHaveAttribute('accept','image/*');
  await expect(cameraInput).toHaveAttribute('capture','user');
  const chooser=await page.locator('.photo-face-chooser').boundingBox();
  expect(chooser).not.toBeNull();
  expect(chooser!.y+chooser!.height).toBeLessThanOrEqual(640);
  await expect(page.locator('.photo-face-workspace')).toBeHidden();
  await expect(page.getByRole('button',{name:'Generate cartoon face',exact:true})).toHaveCount(0);
  const visibleRows=await editor.locator(':scope > *:not([hidden])').evaluateAll(elements=>elements.filter(element=>getComputedStyle(element).display!=='none').map(element=>{const rect=element.getBoundingClientRect();return{top:rect.top,bottom:rect.bottom};}));
  expect(visibleRows.every(row=>row.top>=0&&row.bottom<=640)).toBe(true);

  const canceledPicker=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Take a photo',exact:true}).click();
  await (await canceledPicker).setFiles([]);
  expect(generations).toBe(0);
  await expect(page.getByRole('button',{name:'Generate cartoon face',exact:true})).toHaveCount(0);
  const data=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const context=canvas.getContext('2d')!;context.fillStyle='#d69b72';context.beginPath();context.ellipse(64,64,38,52,0,0,Math.PI*2);context.fill();return canvas.toDataURL('image/png').split(',')[1];});
  const cameraPicker=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Take a photo',exact:true}).click();
  await (await cameraPicker).setFiles({name:'camera-face.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.getByRole('img',{name:/Circular face crop guide/})).toBeVisible();
  await expect(page.getByRole('button',{name:'Generate cartoon face',exact:true})).toBeEnabled();
  const generateBounds=await page.getByRole('button',{name:'Generate cartoon face',exact:true}).boundingBox();
  expect(generateBounds!.height,'primary action remains a button instead of stretching into an empty grid row').toBeLessThan(90);
  expect(generations).toBe(0);
  const uploadPicker=page.waitForEvent('filechooser');
  await page.getByRole('button',{name:'Upload a different photo',exact:true}).click();
  await (await uploadPicker).setFiles({name:'uploaded-face.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.getByRole('img',{name:/Circular face crop guide/})).toBeVisible();
  expect(generations).toBe(0);
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();
  await expect.poll(()=>generations).toBe(1);
});

test('a saved face can be trimmed without running another generation', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  const profile=defaultCharacterProfile();profile.avatarConfig.photoFaceId=faceId;
  await page.route('**/api/profile',async route=>{
    if(route.request().method()==='PUT'){profile.avatarConfig=route.request().postDataJSON().profile.avatarConfig;await route.fulfill({json:{version:2}});}
    else await route.fulfill({json:{version:1,...profile,created:false}});
  });
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d')!;x.fillStyle='#df9b72';x.fillRect(12,5,40,54);x.clearRect(0,0,64,4);return c.toDataURL('image/png').split(',')[1];});
  await page.route('**/api/profile/face/*',route=>route.fulfill({contentType:'image/png',body:Buffer.from(data,'base64')}));
  let trimBody:unknown;
  await page.route('**/api/profile/face/trim',async route=>{trimBody=route.request().postDataJSON();await route.fulfill({json:{faceId:trimmedFaceId}});});
  await openCharacterProfile(page);
  await page.getByRole('button',{name:'Trim neck',exact:true}).click();
  await page.locator('.photo-face-editor').getByRole('button',{name:'Trim neck',exact:true}).click();
  const heightSlider=page.getByRole('slider',{name:'Chin height'});
  await expect(heightSlider).toHaveValue('70');
  await heightSlider.fill('60');
  const curveSlider=page.getByRole('slider',{name:'Chin curve'});
  await expect(curveSlider).toHaveValue('20');
  await curveSlider.fill('25');
  await expect(page.getByRole('img',{name:/Trim preview with a curved boundary centered at 60%, rising 25% at the edges/})).toBeVisible();
  await expect(page.locator('.photo-face-trim-result img')).toHaveAttribute('style',/clip-path: polygon\(/);
  await page.locator('.photo-face-editor').screenshot({path:test.info().outputPath('photo-face-trim-preview-390.png')});
  await page.getByRole('button',{name:'Save trimmed face',exact:true}).click();
  await expect(page.getByRole('button',{name:'Use this face',exact:true})).toBeEnabled();
  expect(trimBody).toEqual({faceId,cutoffPercent:60,curvePercent:25});
  await page.getByRole('button',{name:'Use this face',exact:true}).click();
  await page.getByRole('button',{name:'Save character',exact:true}).click();
  await expect(page.getByText("Character saved to this browser's private profile.")).toBeVisible();
  expect(profile.avatarConfig.photoFaceId).toBe(trimmedFaceId);
});

test('generation finishes at the selected chin curve and opens manual trim controls if finishing fails', async ({ page }) => {
  const failedSourceFaceId='dd11958b-767c-4e45-a92d-b6a59ad3346c';
  await page.route('**/api/profile',route=>route.fulfill({json:{version:1,...defaultCharacterProfile(),created:false}}));
  const imageData=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const context=canvas.getContext('2d')!;context.fillStyle='#df9b72';context.fillRect(4,4,56,56);return canvas.toDataURL('image/png').split(',')[1];});
  const imageBytes=Buffer.from(imageData,'base64');
  await page.route('**/api/profile/face/*',route=>route.fulfill({contentType:'image/png',body:imageBytes}));
  const generatedIds=[faceId,failedSourceFaceId];let generationCount=0;
  await page.route('**/api/profile/face',route=>route.fulfill({json:{faceId:generatedIds[generationCount++]}}));
  const trimBodies:unknown[]=[];
  await page.route('**/api/profile/face/trim',async route=>{
    trimBodies.push(route.request().postDataJSON());
    if(trimBodies.length===1) await route.fulfill({json:{faceId:trimmedFaceId}});
    else await route.fulfill({status:503,json:{message:'Adjust and save the chin curve to finish.'}});
  });

  await openPhotoEditor(page);
  const fileInput=page.getByLabel('Your face photo (JPG, PNG or WebP)');
  await fileInput.setInputFiles({name:'face.png',mimeType:'image/png',buffer:imageBytes});
  await page.getByRole('button',{name:/Set chin line/}).click();
  await page.getByRole('slider',{name:'Photo chin height',exact:true}).fill('72');
  await page.getByRole('slider',{name:'Photo chin curve',exact:true}).fill('28');
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();
  await expect(page.locator('.photo-face-cutout')).toHaveAttribute('src',`/api/profile/face/${trimmedFaceId}`);
  await expect(page.getByRole('button',{name:'Use this face',exact:true})).toBeEnabled();
  expect(trimBodies[0]).toEqual({faceId,cutoffPercent:72,curvePercent:28});

  await page.locator('.photo-face-trim-controls').getByRole('button',{name:'Trim neck',exact:true}).click();
  await expect(page.locator('.photo-face-trim-source img')).toHaveAttribute('src',`/api/profile/face/${faceId}`);
  await page.locator('.photo-face-trim-controls .photo-face-actions').getByRole('button',{name:'Keep original',exact:true}).click();

  await fileInput.setInputFiles({name:'face-again.png',mimeType:'image/png',buffer:imageBytes});
  await page.getByRole('button',{name:/Set chin line/}).click();
  await page.getByRole('slider',{name:'Photo chin height',exact:true}).fill('68');
  await page.getByRole('slider',{name:'Photo chin curve',exact:true}).fill('27');
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Adjust and save the chin curve to finish.');
  await expect(page.getByRole('slider',{name:'Chin height'})).toHaveValue('68');
  await expect(page.getByRole('slider',{name:'Chin curve'})).toHaveValue('27');
  await expect(page.locator('.photo-face-trim-source img')).toHaveAttribute('src',`/api/profile/face/${failedSourceFaceId}`);
  await expect(page.getByRole('button',{name:'Save trimmed face',exact:true})).toBeVisible();
  expect(trimBodies[1]).toEqual({faceId:failedSourceFaceId,cutoffPercent:68,curvePercent:27});
});

test('optional photo face previews, applies, saves, restores and fits a narrow phone', async ({ page }) => {
  await page.setViewportSize({width:320,height:640});
  let profile = defaultCharacterProfile();
  await page.route('**/api/profile', async route => {
    if (route.request().method() === 'PUT') { profile = route.request().postDataJSON().profile; await route.fulfill({json:{version:2}}); }
    else await route.fulfill({json:{version:1,...profile,created:false}});
  });
  await openPhotoEditor(page);
  const data = await page.evaluate(() => { const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#e5ad80';c.beginPath();c.ellipse(64,64,40,55,0,0,7);c.fill();return canvas.toDataURL('image/png').split(',')[1]; });
  const png=Buffer.from(data,'base64');
  await page.route(`**/api/profile/face/${faceId}`, route=>route.fulfill({contentType:'image/png',body:png}));
  let requests=0; let key='';
  await page.route('**/api/profile/face', async route=> { requests++; expect(route.request().headers()['content-type']).toBe('image/png');key=route.request().headers()['idempotency-key'];expect(key).toMatch(/^[0-9a-f-]{36}$/);await route.fulfill({json:{faceId}}); });
  await page.getByLabel('Your face photo (JPG, PNG or WebP)').setInputFiles({name:'face.png',mimeType:'image/png',buffer:png});
  await expect(page.getByRole('img',{name:/Circular face crop guide/})).toBeVisible();
  await expect(page.getByRole('button',{name:'Generate cartoon face',exact:true})).toBeEnabled();
  expect(requests).toBe(0);
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();
  await expect(page.getByRole('button',{name:'Use this face',exact:true})).toBeEnabled();
  expect(profile.avatarConfig.photoFaceId).toBeUndefined();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('photo-face-preview-320.png'),fullPage:true});
  await page.getByRole('button',{name:'Use this face',exact:true}).click();
  await page.getByRole('button',{name:'Save character',exact:true}).click();
  await expect(page.getByText("Character saved to this browser's private profile.")).toBeVisible();
  expect(profile.avatarConfig.photoFaceId).toBe(faceId);expect(requests).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Your character', exact: true }).click();
  await expect(page.locator('.character-profile-preview image[data-photo-face]')).toHaveAttribute('href',`/api/profile/face/${faceId}`);
  await page.getByRole('button',{name:'Use drawn face',exact:true}).click();
  await expect(page.locator('.character-profile-preview image[data-photo-face]')).toHaveCount(0);
  await page.getByRole('button',{name:'Save character',exact:true}).click();
  await expect(page.getByRole('button',{name:'Character saved',exact:true})).toBeVisible();
  expect(profile.avatarConfig.photoFaceId).toBeUndefined();
});

test('generation errors preserve the character and retry keeps the request key', async ({ page }) => {
  await page.route('**/api/profile',route=>route.fulfill({json:{version:1,...defaultCharacterProfile(),created:false}}));
  await openPhotoEditor(page);
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;return c.toDataURL().split(',')[1];});
  const keys:string[]=[];const bodies:Buffer[]=[];
  await page.route('**/api/profile/face',async route=>{keys.push(route.request().headers()['idempotency-key']);bodies.push(Buffer.from(await page.evaluate(() => (window as unknown as { __photoUpload: number[] }).__photoUpload)));await route.fulfill({status:503,json:{message:'Transparent generation unavailable. Your character is unchanged.'}});});
  await page.getByLabel('Your face photo (JPG, PNG or WebP)').setInputFiles({name:'face.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Transparent generation unavailable');
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();await expect.poll(()=>keys.length).toBe(2);expect(keys[1]).toBe(keys[0]);await expect.poll(()=>bodies.length).toBe(2);expect(bodies[1]).toEqual(bodies[0]);
  await page.getByRole('button',{name:'Cancel photo',exact:true}).click();await expect(page.locator('.photo-face-editor')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Character saved',exact:true})).toBeVisible();
});

test('face crop submits the positioned square pixels and changing it starts a new request key', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/profile',route=>route.fulfill({json:{version:1,...defaultCharacterProfile(),created:false}}));
  await openPhotoEditor(page);
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d')!;x.fillStyle='#ff0000';x.fillRect(0,0,256,256);x.fillStyle='#00ff00';x.fillRect(256,0,256,256);x.fillStyle='#0000ff';x.fillRect(0,256,256,256);x.fillStyle='#ffff00';x.fillRect(256,256,256,256);return c.toDataURL('image/png').split(',')[1];});
  await page.route(`**/api/profile/face/${faceId}`,route=>route.fulfill({contentType:'image/png',body:Buffer.from(data,'base64')}));
  await page.getByLabel('Your face photo (JPG, PNG or WebP)').setInputFiles({name:'quadrants.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.getByRole('slider',{name:'Face zoom'})).toBeVisible();
  await page.getByRole('slider',{name:'Face zoom'}).fill('1.5');
  await page.getByRole('slider',{name:'Horizontal face position'}).fill('100');
  await page.getByRole('slider',{name:'Vertical face position'}).fill('100');
  const uploads:{key:string;bytes:Buffer}[]=[];
  await page.route('**/api/profile/face',async route=>{const request=route.request();uploads.push({key:request.headers()['idempotency-key'],bytes:Buffer.from(await page.evaluate(() => (window as unknown as { __photoUpload: number[] }).__photoUpload))});if(uploads.length===1)await route.fulfill({status:503,json:{message:'Try again.'}});else await route.fulfill({json:{faceId}});});
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();
  await expect.poll(()=>uploads.length).toBe(1);
  const center=await page.evaluate(async base64=>{const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);const pixel=[...context.getImageData(image.width/2,image.height/2,1,1).data];image.close();return{width:canvas.width,height:canvas.height,pixel};},Buffer.from(uploads[0]!.bytes).toString('base64'));
  expect(center.width).toBe(768);expect(center.height).toBe(768);expect(center.pixel[0]).toBeGreaterThan(240);expect(center.pixel[1]).toBeGreaterThan(240);expect(center.pixel[2]).toBeLessThan(15);
  await expect(page.getByRole('alert')).toContainText('Try again.');
  await page.getByRole('slider',{name:'Horizontal face position'}).fill('-100');
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();
  await expect.poll(()=>uploads.length).toBe(2);expect(uploads[1]!.key).not.toBe(uploads[0]!.key);
  const moved=await page.evaluate(async base64=>{const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);const pixel=[...context.getImageData(image.width/2,image.height/2,1,1).data];image.close();return pixel;},Buffer.from(uploads[1]!.bytes).toString('base64'));
  expect(moved[2]).toBeGreaterThan(240);expect(moved[0]).toBeLessThan(15);
});

test('phone drag pans the crop by the same visible distance before submission', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/profile',route=>route.fulfill({json:{version:1,...defaultCharacterProfile(),created:false}}));
  await openPhotoEditor(page);
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d')!;x.fillStyle='#ff0000';x.fillRect(0,0,256,256);x.fillStyle='#00ff00';x.fillRect(256,0,256,256);x.fillStyle='#0000ff';x.fillRect(0,256,256,256);x.fillStyle='#ffff00';x.fillRect(256,256,256,256);return c.toDataURL('image/png').split(',')[1];});
  await page.getByLabel('Your face photo (JPG, PNG or WebP)').setInputFiles({name:'quadrants.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await page.getByRole('slider',{name:'Face zoom'}).fill('1.5');
  const frame=page.getByRole('img',{name:/Circular face crop guide/});await frame.scrollIntoViewIfNeeded();await frame.hover();const bounds=await frame.boundingBox();expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);await page.mouse.down();await page.mouse.move(bounds!.x+bounds!.width/2+30,bounds!.y+bounds!.height/2);await page.mouse.up();
  const expectedHorizontal=Math.round(-30*200/(bounds!.width*.5));
  await expect.poll(()=>page.getByRole('slider',{name:'Horizontal face position'}).inputValue()).toBe(String(expectedHorizontal));
  await page.screenshot({path:test.info().outputPath('photo-face-crop-390.png'),fullPage:true});
  await page.route(`**/api/profile/face/${faceId}`,route=>route.fulfill({contentType:'image/png',body:Buffer.from(data,'base64')}));
  let bytes=Buffer.alloc(0);
  await page.route('**/api/profile/face',async route=>{bytes=Buffer.from(await page.evaluate(() => (window as unknown as { __photoUpload: number[] }).__photoUpload));await route.fulfill({json:{faceId}});});
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();
  await expect.poll(()=>bytes.length).toBeGreaterThan(0);
  const lowerLeft=await page.evaluate(async base64=>{const encoded=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));const image=await createImageBitmap(new Blob([encoded],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d')!;context.drawImage(image,0,0);const pixel=[...context.getImageData(200,500,1,1).data];image.close();return pixel;},Buffer.from(bytes).toString('base64'));
  expect(lowerLeft[2]).toBeGreaterThan(240);expect(lowerLeft[0]).toBeLessThan(15);
});

test('an unavailable saved photo head falls back to the drawn character', async ({ page }) => {
  const profile=defaultCharacterProfile();profile.avatarConfig.photoFaceId=faceId;
  await page.route('**/api/profile',route=>route.fulfill({json:{version:2,...profile,created:false}}));
  await page.route(`**/api/profile/face/${faceId}`,route=>route.fulfill({status:404}));
  await openCharacterProfile(page);
  await expect(page.getByRole('button',{name:'Use drawn face',exact:true})).toBeVisible();
  await expect(page.locator('.character-profile-preview image[data-photo-face]')).toHaveCount(0);
  await expect(page.locator('.character-profile-preview [data-avatar-piece="nose"]')).toBeAttached();
});

test('a confirmed failed attempt offers an explicit new generation', async ({ page }) => {
  await page.route('**/api/profile',route=>route.fulfill({json:{version:1,...defaultCharacterProfile(),created:false}}));
  await openPhotoEditor(page);
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;return c.toDataURL().split(',')[1];});
  const keys:string[]=[];
  await page.route('**/api/profile/face',async route=>{keys.push(route.request().headers()['idempotency-key']);await route.fulfill({status:502,json:{message:'No transparent output was returned.',terminal:true}});});
  await page.getByLabel('Your face photo (JPG, PNG or WebP)').setInputFiles({name:'face.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();
  await expect(page.getByText('The previous attempt ended. Trying again starts a new image generation.')).toBeVisible();
  expect(keys).toHaveLength(1);
  await page.getByRole('button',{name:'Generate a new cartoon',exact:true}).click();
  await expect.poll(()=>keys.length).toBe(2);expect(keys[1]).not.toBe(keys[0]);
});
