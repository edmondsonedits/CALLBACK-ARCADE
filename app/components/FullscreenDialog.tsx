"use client";
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {ScrollPanel} from './ScrollPanel';
import {useHistoryPanel} from './useHistoryPanel';
export function FullscreenDialog({open,onClose,title,children,footer,resetKey,paginate=true}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;footer?:ReactNode;resetKey?:string;paginate?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),id=useId(),lastProp=useRef(false),disposeGeneration=useRef({value:0});
 const [historyOpen,setHistoryOpen,,discardHistoryBranch]=useHistoryPanel(false,value=>{if(!value)onClose();});
 const visible=historyOpen;
 useEffect(()=>{if(lastProp.current===open)return;lastProp.current=open;setHistoryOpen(open,{replace:!open});},[open,setHistoryOpen]);
 useEffect(()=>{const dialog=ref.current;if(visible&&!dialog?.open)dialog?.showModal();if(!visible&&dialog?.open)dialog.close();},[visible]);
 useEffect(()=>{const url=window.location.href,tracker=disposeGeneration.current,generation=++tracker.value;return()=>{queueMicrotask(()=>{if(tracker.value===generation&&window.location.href===url)discardHistoryBranch();});};},[discardHistoryBranch]);
 return <dialog ref={ref} className="fullscreen-dialog" aria-labelledby={id} onCancel={event=>{event.preventDefault();setHistoryOpen(false);}}><header><button type="button" onClick={()=>setHistoryOpen(false)}>Back</button><h2 id={id}>{title}</h2></header>{paginate?<ScrollPanel active={visible} resetKey={resetKey}>{children}</ScrollPanel>:<div className="fullscreen-dialog-content">{children}</div>}{footer}</dialog>;
}
