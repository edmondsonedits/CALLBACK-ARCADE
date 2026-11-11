import {FullscreenDocument} from "../components/FullscreenDocument";
import Link from "next/link";
import { Brand } from "../components/Brand";

export default function HowToPlayPage() {
  return (
    <FullscreenDocument><main className="game-setup-shell">
      <nav className="birthday-nav">
        <Brand compact />
        <Link href="/">Back to title</Link>
      </nav>
      <section className="birthday-setup-card standard-setup-card">
        <p className="eyebrow">How to play</p>
        <h1>Choose your royal disaster.</h1>
        <h2>Bowl of Fools</h2>
        <ol className="menu-info-list">
          <li><b>1</b><span><strong>Fill the bowl</strong><small>Everyone writes one to five anonymous scrolls. Each answer is only one to five words, and authors are never revealed.</small></span></li>
          <li><b>2</b><span><strong>Guess the same scrolls three ways</strong><small>Describe them, draw or act them, then use exactly one clue word. Turns last one minute and include one pass.</small></span></li>
          <li><b>3</b><span><strong>Crown the fools</strong><small>Every correct answer scores for your team. A final tie is settled by one anonymous sudden-death scroll.</small></span></li>
        </ol>
        <h2>Royal Rumours</h2>
        <ol className="menu-info-list">
          <li>
            <b>1</b>
            <span>
              <strong>Start a whisper</strong>
              <small>
                Write one funny, visual royal rumour in 18 words or fewer. AI
                turns every secret rumour into a painting.
              </small>
            </span>
          </li>
          <li>
            <b>2</b>
            <span>
              <strong>Interpret a picture</strong>
              <small>
                You receive somebody else&apos;s anonymous painting without its
                original words. Guess what happened; AI paints your guess.
              </small>
            </span>
          </li>
          <li>
            <b>3</b>
            <span>
              <strong>Watch it mutate</strong>
              <small>
                Reveal each complete chain, then vote for the funniest
                transformation. You cannot vote for a chain you helped create.
              </small>
            </span>
          </li>
        </ol>
        <h2>The Royal Frame-Up</h2>
        <ol className="menu-info-list">
          <li>
            <b>1</b>
            <span>
              <strong>File an incident</strong>
              <small>
                Describe one ridiculous castle event in 18 words or fewer.
                Enchanted evidence frames reconstruct every report.
              </small>
            </span>
          </li>
          <li>
            <b>2</b>
            <span>
              <strong>Invent a cover story</strong>
              <small>
                For each painting, everyone except its original witness writes a
                believable false incident report.
              </small>
            </span>
          </li>
          <li>
            <b>3</b>
            <span>
              <strong>Investigate</strong>
              <small>
                Find the genuine report for 500 points, or fool someone for 500.
                Use your one Royal Seal to raise one cover story to 750 per
                person fooled.
              </small>
            </span>
          </li>
        </ol>
        <h2>Classic King Prompter</h2>
        <ol className="menu-info-list">
          <li>
            <b>1</b>
            <span>
              <strong>Write a visual prompt</strong>
              <small>
                Use fewer than 20 words. Specific, funny pictures beat
                complicated ones.
              </small>
            </span>
          </li>
          <li>
            <b>2</b>
            <span>
              <strong>Choose the paintings</strong>
              <small>
                Vote after every generated picture is confirmed and reaches the
                TV.
              </small>
            </span>
          </li>
          <li>
            <b>3</b>
            <span>
              <strong>Restore history</strong>
              <small>
                Finish by combining everyone&apos;s torn portrait sections into
                one gloriously ruined masterpiece.
              </small>
            </span>
          </li>
        </ol>
        <Link
          className="button button-primary"
          href="/host/new?game=bowl-of-fools"
        >
          Start Bowl of Fools
        </Link>
      </section>
    </main></FullscreenDocument>
  );
}
