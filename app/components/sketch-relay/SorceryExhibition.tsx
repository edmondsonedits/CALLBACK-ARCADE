"use client";
import { useState } from "react";
import type { ShowdownEntry } from "../../../lib/arcade/sketch-relay";
import { SKETCH_TRANSFORM_PROMPT } from "../../../lib/sketch-transform-prompt";
import { FullscreenDialog } from "../FullscreenDialog";
import { useHistoryPanel } from "../useHistoryPanel";
import { ShowdownArt, showdownMedia } from "./SketchShowdownStage";
import styles from "./SketchShowdown.module.css";

/** Only receives the already disclosed archive. Never infer artists from anonymous entries. */
export function SorceryExhibition({ entries, code, names, selfId }: { entries: ShowdownEntry[]; code: string; names: Map<string, string>; selfId: string }) {
  const [open, setOpen] = useState(false), [index, setIndex] = useState(0), [original, setOriginal] = useState(false), [mine, setMine] = useState(false), [details, setDetails] = useHistoryPanel(false);
  const shown = mine ? entries.filter(e => e.playerId === selfId) : entries;
  const current = Math.min(index, Math.max(0, shown.length - 1)), entry = shown[current];
  const close = () => { if (details) setDetails(false); else setOpen(false); };
  return <>
    <button type="button" className={styles.phonePrimary} aria-haspopup="dialog" onClick={() => { setDetails(false); setOpen(true); }}>Explore our exhibition</button>
    <FullscreenDialog open={open} onClose={close} title={details ? "Exhibit details" : "The royal exhibition"} paginate={details} resetKey={String(current)}
      footer={!details && <nav className={styles.bookNavigation} aria-label="Exhibition navigation"><button type="button" disabled={current === 0} onClick={() => setIndex(current - 1)}>Previous exhibit</button><span>{shown.length ? current + 1 : 0} / {shown.length}</span><button type="button" disabled={current >= shown.length - 1} onClick={() => setIndex(current + 1)}>Next exhibit</button></nav>}>
      {details && entry ? <section className={styles.exhibition} aria-label="Artwork details">
        <h3>{names.get(entry.playerId ?? "") ?? "Our artist"}’s masterpiece</h3>
        <p><strong>Drawing assignment:</strong> {entry.prompt}</p>
        <p>Round {entry.round ?? "—"} · {entry.laughterPoints ?? 0} laughter points · {entry.votes ?? 0} ballots</p>
        {entry.originalAssetId && <a className={styles.exhibitionDownload} href={showdownMedia(code, entry.originalAssetId)} download={"sketch-round-" + (entry.round ?? 1) + ".png"}>Save original sketch ↓</a>}
        <details className={styles.transformPrompt}><summary>AI transformation prompt</summary><p>{SKETCH_TRANSFORM_PROMPT}</p><small>The drawing assignment is for the artist. Practice art and fallback images are not AI transformations.</small></details>
      </section> : <section className={styles.exhibition} data-view="art" aria-label="Revealed artwork collection">
        <select aria-label="Collection" value={mine ? "mine" : "all"} onChange={e => { setMine(e.target.value === "mine"); setIndex(0); }}><option value="all">Everyone’s masterpieces</option><option value="mine">My masterpieces</option></select>
        {entry ? <>
          <p className={styles.bookEyebrow}>EXHIBIT {current + 1} OF {shown.length} · ROUND {entry.round ?? "—"}</p>
          <h3>{names.get(entry.playerId ?? "") ?? "Our artist"}’s masterpiece</h3>
          <div className={styles.exhibitionTabs} role="group" aria-label="Artwork version">
            <button type="button" aria-pressed={!original} onClick={() => setOriginal(false)}>Enchanted version</button>
            <button type="button" aria-pressed={original} onClick={() => setOriginal(true)}>Original sketch</button>
          </div>
          <div className={styles.exhibitionArt}><ShowdownArt key={entry.entryId + ":" + original} entry={entry} code={code} original={original} /></div>
          <button type="button" className={styles.exhibitionDetailsButton} onClick={() => setDetails(true)}>Drawing details &amp; download</button>
        </> : <p>No drawings in this collection yet. Your legend remains a work in progress.</p>}
      </section>}
    </FullscreenDialog>
  </>;
}
