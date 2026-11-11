"use client";
import { useState } from "react";
import { FullscreenDialog } from "../FullscreenDialog";
import styles from "./SketchShowdown.module.css";

const chapters = [
  { title: "A beginner’s guide to mischief", mark: "✎", copy: "Write a short, drawable prompt. Vote for the room’s favourites, then draw the chosen assignment on your phone. A splendidly bad drawing is still a splendid entry.", tip: "Your drawing locks when you send it. Keep your name off the canvas: the artists stay secret." },
  { title: "The three enchantments", mark: "Ⅲ", copy: "Round 1: a shared prompt. Round 2: the lowest scorer chooses a drawing curse for everyone, and points double. Round 3: choose your own private twist and starter; points triple.", tip: "The final assignment stays on your phone until your artist reveal. The curse lifts for the final." },
  { title: "How to win the imaginary crown", mark: "♛", copy: "Rank up to three drawings: first earns its artist 100 points, second 75, third 50. Then guess who drew your picks: each correct guess earns you 50. Round multipliers apply to both.", tip: "No voting for yourself. Pick fewer than three or abstain if you wish. Tied leaders share the crown." },
  { title: "When the room points at you", mark: "✦", copy: "At the reveal, compare the original sketch with its enchanted version. When your avatar takes the stage, your phone becomes its remote. Dance, bow, wave, or plead artistic innocence.", tip: "If the magic service is unavailable, the exhibition uses everyone’s original drawings. The game and scoring continue." },
];

export function SorcerySpellbook({ twoRounds = false }: { twoRounds?: boolean }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(0), [secret, setSecret] = useState(false);
  const chapter = chapters[page]!;
  return <>
    <button type="button" className={styles.spellbookTrigger} aria-haspopup="dialog" onClick={() => setOpen(true)}>Spellbook</button>
    <FullscreenDialog open={open} onClose={() => setOpen(false)} title="The pocket spellbook" resetKey={String(page)} footer={<nav className={styles.bookNavigation} aria-label="Spellbook chapters"><button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous chapter</button><span>{page + 1} / {chapters.length}</span><button type="button" disabled={page === chapters.length - 1} onClick={() => setPage(p => p + 1)}>Next chapter</button></nav>}>
      <article className={styles.spellbookPage} key={page}>
        <span className={styles.bookMark} aria-hidden="true">{chapter.mark}</span>
        <p className={styles.bookEyebrow}>FIELD NOTES · {page + 1} / {chapters.length}</p>
        <h3>{twoRounds && page === 1 ? "Two rounds. Twice the mischief." : chapter.title}</h3>
        <p>{twoRounds && page === 1 ? "This exhibition uses the original two-round rules. Everyone draws the two elected prompts, with the same base points each round. There is no curse or private final twist." : twoRounds && page === 2 ? chapter.copy.replace(" Round multipliers apply to both.", "") : chapter.copy}</p>
        <aside>{twoRounds && page === 1 ? "Follow the task on your phone. Talent remains entirely optional." : chapter.tip}</aside>
        {page === chapters.length - 1 && <><button type="button" className={styles.secretSeal} aria-expanded={secret} onClick={() => setSecret(s => !s)}>♜ The Edmondson seal</button>{secret && <p role="status" className={styles.familyDecree}>House Edmondson’s first law of sorcery: if it looks like a potato, declare it a dragon egg. All complaints must be delivered by pigeon.</p>}</>}
        <small className={styles.bookReminder}>The room’s timer keeps running while you read. Back returns to your saved choices.</small>
      </article>
    </FullscreenDialog>
  </>;
}
