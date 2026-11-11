"use client";

import { useCallback, useEffect, useRef } from "react";
import { joystickInputFromPoint, practiceInputForKeys } from "../../lib/arcade/practice/input";
import type { PracticeControl, PracticeInput } from "../../lib/arcade/practice/types";
import {PointerControls} from "../../lib/arcade/pointer-controls";

const LABELS: Readonly<Record<PracticeControl, string>> = {
  joystick: "Movement joystick", jump: "Jump", duck: "Duck", action: "Action", left: "Turn left", right: "Turn right",
  "lane-1": "Lane one", "lane-2": "Lane two", "lane-3": "Lane three", "lane-4": "Lane four", fire: "Fire", special: "Special", spray: "Spray",
};

export default function ArcadePracticeControls({ controls, onInput, disabled = false }: {
  readonly controls: readonly PracticeControl[];
  readonly onInput: (input: Omit<PracticeInput, "sequence">) => void;
  readonly disabled?: boolean;
}) {
  const stickElement=useRef<HTMLButtonElement>(null);
  const keys = useRef(new Set<string>()), pointers = useRef(new PointerControls()), axes = useRef({ x: 0, y: 0 }), pointerId = useRef<number | null>(null);
  const emit = useCallback(() => {
    if (disabled) { onInput({ x: 0, y: 0, buttons: {} }); return; }
    const mapped = practiceInputForKeys(keys.current, controls), buttons = { ...mapped.buttons };
    for (const control of controls) if(pointers.current.held(control)) buttons[control] = true;
    onInput({ x: pointerId.current===null?mapped.x:axes.current.x, y: pointerId.current===null?mapped.y:axes.current.y, buttons });
  }, [controls, disabled, onInput]);
  const clear = useCallback(() => { keys.current.clear(); pointers.current.clear(); axes.current = { x: 0, y: 0 }; pointerId.current = null;stickElement.current?.style.setProperty('--stick-x','0px');stickElement.current?.style.setProperty('--stick-y','0px'); emit(); }, [emit]);

  useEffect(() => {
    const recognized = new Set([" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "e", "f", "j", "k", "q", "shift", "1", "2", "3", "4"]);
    const changeKey = (event: KeyboardEvent, down: boolean) => {
      const key = event.key.toLowerCase(); if (!recognized.has(key)) return;
      if(down&&(disabled||event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable="true"],[data-arcade-tool],dialog[open]')))return;
      event.preventDefault(); if (down) keys.current.add(key); else keys.current.delete(key); emit();
    };
    const down = (event: KeyboardEvent) => changeKey(event, true), up = (event: KeyboardEvent) => changeKey(event, false);
    const visibility = () => { if (document.visibilityState !== "visible") clear(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", clear); window.addEventListener("arcade:controls-reset",clear);document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear);window.removeEventListener("arcade:controls-reset",clear); document.removeEventListener("visibilitychange", visibility); clear(); };
  }, [clear, emit,disabled]);

  const releaseButton=(control:PracticeControl,event:React.PointerEvent<HTMLButtonElement>)=>{if(!pointers.current.release(event.pointerId,control))return;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);emit();};
  const releaseStick=(event:React.PointerEvent<HTMLButtonElement>)=>{if(!pointers.current.release(event.pointerId,'joystick'))return;pointerId.current=null;axes.current={x:0,y:0};event.currentTarget.style.setProperty('--stick-x','0px');event.currentTarget.style.setProperty('--stick-y','0px');emit();};
  const moveStick=(event:React.PointerEvent<HTMLButtonElement>)=>{axes.current=joystickInputFromPoint(event.clientX,event.clientY,event.currentTarget.getBoundingClientRect());event.currentTarget.style.setProperty('--stick-x',axes.current.x*30+'px');event.currentTarget.style.setProperty('--stick-y',axes.current.y*30+'px');emit();};

  const button = (control: PracticeControl) => <button key={control} data-arcade-control="" className={`arcade-practice-button arcade-practice-button-${control.replace(/[^a-z0-9]+/g, "-")}`} type="button" aria-label={LABELS[control]} disabled={disabled}
    onPointerDown={(event) => { if(disabled||!pointers.current.claim(event.pointerId,control))return;event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);emit(); }}
    onPointerUp={(event)=>releaseButton(control,event)} onPointerCancel={(event)=>releaseButton(control,event)} onLostPointerCapture={(event)=>releaseButton(control,event)}
  >{control.startsWith("lane-") ? control.slice(-1) : control.toUpperCase()}</button>;

  return <div className="arcade-practice-controls" aria-label="Practice controls">
    {controls.includes("joystick") && <button ref={stickElement} data-arcade-control="" className="arcade-practice-joystick" type="button" aria-label={LABELS.joystick} disabled={disabled}
      onPointerDown={(event) => {if(disabled||!pointers.current.claim(event.pointerId,'joystick',true))return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointerId.current = event.pointerId;moveStick(event);}}
      onPointerMove={(event) => {if(pointers.current.owns(event.pointerId,'joystick'))moveStick(event);}}
      onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}
    ><span aria-hidden="true" /></button>}
    {controls.filter((control) => control !== "joystick").length > 0 && <div className="arcade-practice-button-grid">{controls.filter((control) => control !== "joystick").map(button)}</div>}
  </div>;
}
