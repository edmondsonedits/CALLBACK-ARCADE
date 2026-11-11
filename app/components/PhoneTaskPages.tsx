"use client";
import {useEffect,useRef,type ReactNode} from 'react';
export function PhoneTaskPages({children,active,taskKey}:{children:ReactNode;active:boolean;taskKey?:string}) {
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(active)root.current?.querySelector('.phone-content')?.scrollTo({top:0});},[active,taskKey]);
 return <div ref={root} className="phone-task-layout">{children}</div>;
}
