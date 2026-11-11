'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ScrollPanel } from './ScrollPanel';

type MenuLoreDialogProps = {
  triggerLabel: string;
  triggerClassName?: string;
  triggerMark?: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
};

const subscribe=()=>()=>{};
function MenuLoreDialog({ triggerLabel, triggerClassName, triggerMark, title, eyebrow, children }: MenuLoreDialogProps) {
  const ready=useSyncExternalStore(subscribe,()=>true,()=>false);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <>
    <button type="button" disabled={!ready} className={triggerClassName ?? 'edmondson-trigger'} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      {triggerMark && <span className="menu-lore-trigger-mark" aria-hidden="true">{triggerMark}</span>}
      {triggerLabel}
    </button>
    <dialog ref={dialogRef} className="menu-lore-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); setOpen(false); }} onClose={() => setOpen(false)} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      const active = document.activeElement;
      if (!dialog.contains(active) || focusable.length === 1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }}>
      <div className="menu-lore-shell">
        <header className="menu-lore-header">
          <div>
            <p className="menu-lore-eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="menu-lore-close" aria-label="Close this page" onClick={() => setOpen(false)}>Close</button>
        </header>
        {children}
      </div>
    </dialog>
  </>;
}

export function HouseEdmondson() {
  return <MenuLoreDialog triggerLabel="House Edmondson" triggerMark="♜" title="House Edmondson" eyebrow="A fictional court tradition">
    <div className="edmondson-lore">
      <div className="edmondson-seal" role="img" aria-label="A potato wearing a tiny crown"><span aria-hidden="true">🥔</span><b aria-hidden="true">♛</b></div>
      <p className="edmondson-decree">“By royal decree: no one admits they drew the potato.”</p>
      <div className="edmondson-lore-note">
        <h3>From the entirely fictional family archives</h3>
        <p>The royal portrait bears a suspicious resemblance to a potato. The potato has declined to comment.</p>
      </div>
      <p className="edmondson-footnote">Draw boldly. Blame the quill.</p>
    </div>
  </MenuLoreDialog>;
}

export function SketchSorceryGuide() {
  return <MenuLoreDialog triggerLabel="How Sketch & Sorcery works" triggerClassName="edmondson-guide-trigger" title="Sketch & Sorcery" eyebrow="A quick field guide">
    <ScrollPanel>
      <div className="sketch-guide-content">
        <p className="sketch-guide-lede">Write a prompt, choose favourites, then draw. The phone guides every turn.</p>
        <div className="sketch-guide-rounds" aria-label="Round points: first round one times, second round two times, final round three times">
          <span><b>Round I</b><strong>1×</strong></span>
          <span><b>Last place’s curse</b><strong>2×</strong></span>
          <span><b>Private final twist</b><strong>3×</strong></span>
        </div>
        <ol className="sketch-guide-steps">
          <li><span aria-hidden="true">Ⅰ</span><div><strong>Draw and vote</strong><p>Write a prompt, rank the favourites, then sketch the winning challenge on your phone.</p></div></li>
          <li><span aria-hidden="true">Ⅱ</span><div><strong>Last place picks the curse</strong><p>Everyone draws under that restriction. Round points are doubled.</p></div></li>
          <li><span aria-hidden="true">Ⅲ</span><div><strong>Choose your final assignment</strong><p>Pick a private prompt twist and starter sketch. The finale triples points.</p></div></li>
        </ol>
        <p className="sketch-guide-note">After drawing, rank the sketches you enjoyed and guess their artists. The host screen reveals the anonymous gallery.</p>
      </div>
    </ScrollPanel>
  </MenuLoreDialog>;
}
