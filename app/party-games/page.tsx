import {FullscreenDocument} from "../components/FullscreenDocument";
import Link from "next/link";
import { Brand } from "../components/Brand";

export const metadata = {
  title: "Party Games",
  description: "Find hosted party, drawing and phone-controller games for your next game night.",
};

export default function PartyGamesPage() {
  return (
    <FullscreenDocument><main className="party-games-page" aria-labelledby="party-games-title">
      <div className="party-games-shell">
        <nav className="party-games-nav" aria-label="Party Games navigation">
          <Brand compact />
          <Link className="party-games-back" href="/?menu=1">← Grand Hall</Link>
        </nav>

        <header className="party-games-header">
          <p className="party-games-kicker">YOUR NEXT GAME NIGHT</p>
          <h1 id="party-games-title">Party Games</h1>
          <p>Play on another site, using your phones. Try a party pack, drawing game or action collection.</p>
        </header>

        <ol className="party-games-steps" aria-label="How to play guest packs">
          <li><b>1</b><span>Open a game on its own site</span></li>
          <li><b>2</b><span>Follow its room or phone instructions</span></li>
          <li><b>3</b><span>Join the room and play</span></li>
        </ol>

        <section className="party-games-grid" aria-label="Guest game packs">
          <article className="party-pack party-pack-doot" aria-labelledby="party-doot-title">
            <div className="party-pack-art" aria-hidden="true">
              <span className="party-pack-badge">THE PARTY PACK</span>
              <svg viewBox="0 0 240 112" fill="none">
                <path d="M30 16h122a12 12 0 0 1 12 12v42a12 12 0 0 1-12 12H75L48 98V82H30a12 12 0 0 1-12-12V28a12 12 0 0 1 12-12Z" fill="var(--kp-cyan)" stroke="var(--kp-ink)" strokeWidth="4" />
                <circle cx="57" cy="49" r="7" fill="var(--kp-ink)" /><circle cx="91" cy="49" r="7" fill="var(--kp-ink)" /><circle cx="125" cy="49" r="7" fill="var(--kp-ink)" />
                <path d="M154 43h62a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10h-10v13l-22-13h-30a10 10 0 0 1-10-10V53a10 10 0 0 1 10-10Z" fill="var(--kp-purple)" stroke="var(--kp-ink)" strokeWidth="4" />
                <path d="m177 67 8 8 16-18" stroke="var(--kp-ink)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="party-pack-content">
              <h2 id="party-doot-title">Doot</h2>
              <p>Funny answers, drawing chains, bluffing and trivia. Choose a game, then let the room decide.</p>
              <ul className="party-pack-tags" aria-label="Doot game types"><li>Writing</li><li>Drawing</li><li>Trivia</li><li>Voting</li></ul>
              <div className="party-pack-actions">
                <a className="party-pack-launch" href="https://doot.games" target="_blank" rel="noopener noreferrer" aria-describedby="party-games-launch-help">Open Doot <span aria-hidden="true">↗</span></a>
                <a className="party-pack-source" href="https://github.com/virgilvox/doot-games" target="_blank" rel="noopener noreferrer" aria-label="Doot on GitHub (opens in a new tab)">GitHub source <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </article>

          <article className="party-pack party-pack-jammers" aria-labelledby="party-jammers-title">
            <div className="party-pack-art" aria-hidden="true">
              <span className="party-pack-badge">THE ACTION PACK</span>
              <svg viewBox="0 0 240 112" fill="none">
                <path d="M18 88 61 22h90l45 66" stroke="var(--kp-purple)" strokeWidth="13" strokeLinecap="round" />
                <path d="m34 88 36-54h72l36 54" stroke="var(--kp-parchment)" strokeWidth="3" strokeDasharray="9 9" />
                <path d="M78 57h62l14 20v14H64V77l14-20Z" fill="var(--kp-coral)" stroke="var(--kp-ink)" strokeWidth="4" strokeLinejoin="round" />
                <path d="m85 58-7-22h44l10 22" fill="var(--kp-cyan)" stroke="var(--kp-ink)" strokeWidth="4" strokeLinejoin="round" />
                <circle cx="79" cy="90" r="12" fill="var(--kp-ink)" /><circle cx="139" cy="90" r="12" fill="var(--kp-ink)" />
                <circle cx="79" cy="90" r="5" fill="var(--kp-parchment)" /><circle cx="139" cy="90" r="5" fill="var(--kp-parchment)" />
                <path d="M202 84V14m0 0h30v24h-30" stroke="var(--kp-parchment)" strokeWidth="4" />
                <path d="M204 16h12v10h-12Zm12 10h14v10h-14Z" fill="var(--kp-parchment)" />
              </svg>
            </div>
            <div className="party-pack-content">
              <h2 id="party-jammers-title">Joystick Jammers</h2>
              <p>Race for the finish or battle in demolition derby. Steer, boost and fire from your phone.</p>
              <ul className="party-pack-tags" aria-label="Joystick Jammers game types"><li>Racing</li><li>Demolition derby</li><li>3D action</li></ul>
              <div className="party-pack-actions">
                <a className="party-pack-launch" href="https://jammers.dilger.dev/host" target="_blank" rel="noopener noreferrer" aria-describedby="party-games-launch-help">Host Joystick Jammers <span aria-hidden="true">↗</span></a>
                <a className="party-pack-source" href="https://github.com/cdilga/multiplayer-racer" target="_blank" rel="noopener noreferrer" aria-label="Joystick Jammers on GitHub (opens in a new tab)">GitHub source <span aria-hidden="true">↗</span></a>
              </div>
            </div>
          </article>
        </section>

        <section className="party-games-alternatives" aria-labelledby="party-alternatives-title">
          <h2 id="party-alternatives-title">More hosted games</h2>
          <div className="party-games-grid">
            <article className="party-pack"><div className="party-pack-content">
              <h3>Gartic Phone</h3><p>Write, draw and describe a chain of changing ideas, then reveal the results together.</p>
              <a className="party-pack-launch" href="https://garticphone.com/" target="_blank" rel="noopener noreferrer" aria-describedby="party-games-launch-help">Open Gartic Phone ↗</a>
            </div></article>
            <article className="party-pack"><div className="party-pack-content">
              <h3>skribbl.io</h3><p>Classic drawing and guessing. Create a private room and share its link with your group.</p>
              <a className="party-pack-launch" href="https://skribbl.io/" target="_blank" rel="noopener noreferrer" aria-describedby="party-games-launch-help">Open skribbl.io ↗</a>
            </div></article>
            <article className="party-pack"><div className="party-pack-content">
              <h3>AirConsole</h3><p>A shared TV or computer screen with phones as controllers. Try its action collection; more games and players require a subscription.</p>
              <a className="party-pack-launch" href="https://www.airconsole.com/" target="_blank" rel="noopener noreferrer" aria-describedby="party-games-launch-help">Open AirConsole ↗</a>
            </div></article>
          </div>
        </section>

        <footer className="party-games-footer">
          <p>Each site has its own rooms and joining instructions. CALLBACK room codes stay here.</p>
          <p id="party-games-launch-help">Games and source links open in a new tab. This hub stays open so you can return.</p>
          <Link href="/arcade">Browse the King Prompter Arcade →</Link>
        </footer>
      </div>
    </main></FullscreenDocument>
  );
}
