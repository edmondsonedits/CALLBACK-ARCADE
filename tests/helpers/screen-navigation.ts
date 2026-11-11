import {expect,type Locator,type Page} from '@playwright/test';
/** Menu bodies scroll continuously; fixed canvases and primary actions stay put. */
export async function reachScreenControl(page:Page,control:Locator){
 await expect(page.getByRole('button',{name:'Next screen',exact:true})).toHaveCount(0);
 await control.scrollIntoViewIfNeeded();
 expect(await control.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1;}),'menu control must be reachable without clipping').toBe(true);
 return control;
}
