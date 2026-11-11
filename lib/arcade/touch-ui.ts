export const ARCADE_TOUCH_SCOPE='[data-arcade-touch],.online-phone,.online-host,.arcade-host,.arcade-practice-page,.full-arcade-game';
const EDITABLE='input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,select,[contenteditable]:not([contenteditable="false"])';
const SIZE_KEY='callback.arcade.touch-size';
export function suppressArcadeCallout(target:EventTarget|null):boolean {
 const raw=target as Element|null,element=raw?.closest?raw:raw?.parentElement;
 return !!element?.closest(ARCADE_TOUCH_SCOPE)&&!element.closest(EDITABLE);
}
/** Prevent native copy/drag UI only on Arcade surfaces; never cancel touchmove. */
export function installArcadeTouchPolicy(doc:Document):()=>void {
 const pressed=new Map<number,HTMLElement>();
 const suppress=(e:Event)=>{if(suppressArcadeCallout(e.target))e.preventDefault();};
 const protectEditing=(e:KeyboardEvent)=>{const target=e.target as Element;if(target?.closest?.(ARCADE_TOUCH_SCOPE)&&(target.closest(EDITABLE)||target.closest('[data-arcade-tool]')))e.stopPropagation();};
 const down=(e:PointerEvent)=>{if(e.pointerType==='mouse'&&e.button!==0||!suppressArcadeCallout(e.target))return;const button=(e.target as Element)?.closest<HTMLElement>('button');if(!button||button.hasAttribute('disabled'))return;pressed.set(e.pointerId,button);button.dataset.touchPressed='true';};
 const up=(e:PointerEvent)=>{const button=pressed.get(e.pointerId);pressed.delete(e.pointerId);if(button&&![...pressed.values()].includes(button))delete button.dataset.touchPressed;};
 const clear=()=>{for(const button of pressed.values())delete button.dataset.touchPressed;pressed.clear();};
 const visibility=()=>{if(doc.hidden)clear();};
 const reset=()=>{clear();doc.defaultView?.dispatchEvent(new Event('arcade:controls-reset'));};
 for(const name of ['contextmenu','selectstart','dragstart'])doc.addEventListener(name,suppress,{capture:true});
 doc.addEventListener('keydown',protectEditing,{capture:true});doc.addEventListener('pointerdown',down,{capture:true});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])doc.addEventListener(name,up as EventListener,{capture:true});
 doc.addEventListener('visibilitychange',visibility);doc.defaultView?.addEventListener('blur',clear);doc.defaultView?.addEventListener('arcade:controls-reset',clear);doc.defaultView?.addEventListener('resize',reset);doc.defaultView?.addEventListener('pagehide',reset);
 return ()=>{clear();for(const name of ['contextmenu','selectstart','dragstart'])doc.removeEventListener(name,suppress,true);doc.removeEventListener('keydown',protectEditing,true);doc.removeEventListener('pointerdown',down,true);for(const name of ['pointerup','pointercancel','lostpointercapture'])doc.removeEventListener(name,up as EventListener,true);doc.removeEventListener('visibilitychange',visibility);doc.defaultView?.removeEventListener('blur',clear);doc.defaultView?.removeEventListener('arcade:controls-reset',clear);doc.defaultView?.removeEventListener('resize',reset);doc.defaultView?.removeEventListener('pagehide',reset);};
}
export function installControlSizeToggle(button:HTMLButtonElement,root:HTMLElement):()=>void {
 const win=root.ownerDocument.defaultView!;let large=false;
 const apply=()=>{root.dataset.arcadeControls=large?'large':'standard';button.setAttribute('aria-pressed',String(large));button.textContent=large?'Standard controls':'Larger controls';};
 const restore=()=>{try{large=win.localStorage.getItem(SIZE_KEY)==='large';}catch{large=false;}apply();};
 const storage=(e:StorageEvent)=>{if(e.key===SIZE_KEY){win.dispatchEvent(new Event('arcade:controls-reset'));restore();}};
 const click=()=>{win.dispatchEvent(new Event('arcade:controls-reset'));large=!large;try{win.localStorage.setItem(SIZE_KEY,large?'large':'standard');}catch{button.title='This control size applies to the current game.';}apply();};
 button.classList.add('arcade-touch-size');button.dataset.arcadeTool='';button.type='button';button.setAttribute('aria-label','Toggle larger touch controls');restore();button.addEventListener('click',click);win.addEventListener('storage',storage);
 return ()=>{button.removeEventListener('click',click);win.removeEventListener('storage',storage);};
}
