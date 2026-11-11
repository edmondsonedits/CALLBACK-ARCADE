"use client";
import { useEffect, useRef, type ReactNode } from 'react';

/** A continuous menu/dialog body with no measured slices or paging controls. */
export function ScrollPanel({children, active=true, resetKey, className=''}:{children:ReactNode;active?:boolean;resetKey?:string;className?:string}) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(active)root.current?.scrollTo({top:0});},[active,resetKey]);
  return <div ref={root} className={`scroll-panel ${className}`}>{children}</div>;
}
