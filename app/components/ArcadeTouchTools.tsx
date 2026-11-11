"use client";
import {useEffect,useRef} from 'react';
import {ARCADE_TOUCH_SCOPE,installArcadeTouchPolicy,installControlSizeToggle} from '../../lib/arcade/touch-ui';
export function ArcadeTouchPolicy(){useEffect(()=>installArcadeTouchPolicy(document),[]);return null;}
export default function ArcadeTouchTools(){const button=useRef<HTMLButtonElement>(null);useEffect(()=>{const el=button.current,root=el?.closest<HTMLElement>(ARCADE_TOUCH_SCOPE);if(el&&root)return installControlSizeToggle(el,root);},[]);return <button ref={button} className="arcade-touch-size" type="button" data-arcade-tool="" aria-label="Toggle larger touch controls" aria-pressed="false">Larger controls</button>;}
