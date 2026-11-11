"use client";
import {useSyncExternalStore,type ReactNode} from 'react';
import {sorceryReveal} from '../../../lib/sorcery-reveal';
import styles from './SketchShowdown.module.css';
const subscribe=(cb:()=>void)=>{const q=matchMedia('(prefers-reduced-motion: reduce)');q.addEventListener('change',cb);return()=>q.removeEventListener('change',cb);};
export function SorceryReveal({elapsed,original,enchanted,fallback}:{elapsed:number;original:ReactNode;enchanted:ReactNode;fallback:boolean}){
 const reduced=useSyncExternalStore(subscribe,()=>matchMedia('(prefers-reduced-motion: reduce)').matches,()=>true);
 const {opacity,split}=sorceryReveal(elapsed,reduced||fallback);
 return <div className={styles.morphPair} data-testid="sorcery-reveal-morph" data-original-opacity={opacity.toFixed(2)}>
 <figure style={{opacity,transform:`translateX(${(1-split)*50}%)`,zIndex:2}}><div className={styles.artFrame}>{original}</div><figcaption>THE ORIGINAL SKETCH</figcaption></figure>
 <figure style={{transform:`translateX(${-(1-split)*50}%)`}}><div className={`${styles.artFrame} ${styles.enchanted}`}>{enchanted}</div><figcaption>{fallback?'ORIGINAL SKETCH · MAGIC UNAVAILABLE':'THE ENCHANTED VERSION'}</figcaption></figure>
 </div>;
}
