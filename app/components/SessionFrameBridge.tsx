'use client';
import { useEffect } from 'react';
export function SessionFrameBridge(){useEffect(()=>{const code=new URLSearchParams(location.search).get('session');if(!code||window.parent===window)return;document.documentElement.dataset.sessionFrame='true';
  const click=(e:MouseEvent)=>{const link=(e.target as Element)?.closest('a');if(!link)return;const url=new URL(link.href,location.origin);if(url.origin===location.origin&&['/','/host/new','/arcade','/party-games'].includes(url.pathname)){e.preventDefault();e.stopPropagation();window.parent.postMessage({type:'callback:new-game',code},location.origin);}};document.addEventListener('click',click,true);return()=>{document.removeEventListener('click',click,true);delete document.documentElement.dataset.sessionFrame;};},[]);return null;}
