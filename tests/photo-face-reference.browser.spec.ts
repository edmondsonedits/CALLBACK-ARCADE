import {test,expect} from '@playwright/test';
import {defaultCharacterProfile} from '../lib/character-profile';
test('reference removes neck below adjustable curved chin before any provider upload',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/api/profile',r=>r.fulfill({json:{version:1,...defaultCharacterProfile(),created:false}}));
 await page.goto('/play');await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'Your character',exact:true}).click();await expect(page.getByRole('button',{name:'Use a face photo',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Use a face photo',exact:true}).click();
 const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d')!;x.fillStyle='#ac7856';x.fillRect(0,0,512,512);return c.toDataURL().split(',')[1];});
 await page.getByLabel('Your face photo (JPG, PNG or WebP)').setInputFiles({name:'head-and-neck.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 await page.getByRole('button',{name:/Set chin line/}).click();
 await page.getByRole('slider',{name:'Photo chin height',exact:true}).fill('70');
 await page.getByRole('slider',{name:'Photo chin curve',exact:true}).fill('20');
 await page.evaluate(()=>{const original=window.fetch;window.fetch=async(input,init)=>{if(input==='/api/profile/face' && init?.body instanceof Blob){const image=await createImageBitmap(init.body);const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d')!;x.drawImage(image,0,0);(window as unknown as {chinAlpha:number[]}).chinAlpha=[[384,400],[384,600],[20,460],[384,460]].map(([px,py])=>x.getImageData(px,py,1,1).data[3]);image.close();}return original(input,init);};});
 await page.route('**/api/profile/face',r=>r.fulfill({status:503,json:{message:'Test upload captured'}}));
 await page.screenshot({path:test.info().outputPath('photo-face-curve-reference.png'),fullPage:true});
 await page.getByRole('button',{name:'Generate cartoon face',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Test upload captured');
 expect(await page.evaluate(()=>(window as unknown as {chinAlpha:number[]}).chinAlpha)).toEqual([255,0,0,255]);
});
