'use client';
import { useRef } from 'react';
import Image from 'next/image';
import styles from './ExpandableQr.module.css';

/** Native dialog supplies focus trapping, Escape and focus restoration. */
export function ExpandableQr({src,code,size=220,className}:{src:string;code:string;size?:number;className?:string}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const close=useRef<HTMLButtonElement>(null);
  return <><button type="button" className={styles.trigger} onClick={()=>{dialog.current?.showModal();close.current?.focus();}} aria-label={`Enlarge QR code to join ${code}`} title="Click to enlarge"><Image unoptimized className={className} src={src} width={size} height={size} alt={`Scan to join room ${code}`}/><span className={styles.hint}>Tap to enlarge</span></button><dialog ref={dialog} className={styles.dialog} onPointerDown={e=>{if(e.target===e.currentTarget)dialog.current?.close();}} aria-label={`Join room ${code}`}><div className={styles.content}><button ref={close} type="button" className={styles.close} onClick={()=>dialog.current?.close()}>Close ×</button><h2>Scan to join</h2><Image unoptimized src={src} width={720} height={720} alt={`QR code to join room ${code}`}/><p>Room <strong>{code}</strong></p><p>Or enter this room code on your phone.</p></div></dialog></>;
}
