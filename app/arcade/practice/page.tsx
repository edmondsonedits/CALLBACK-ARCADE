import Link from "next/link";
import { PRACTICE_GAMES } from "../../../lib/arcade/practice/catalog";
import { ARCADE_PLACEHOLDER_NOTE } from "../../../lib/arcade/catalog";
import { getFullArcadeGame } from "../../../lib/arcade/full-games";

export const metadata = { title: "Arcade Collection | King Prompter", description: "Full bot matches, custom arenas, and arcade prototypes." };

export default function ArcadePracticePage() {
  return <main className="arcade-practice-catalog" aria-labelledby="practice-catalog-title">
    <header className="arcade-practice-header">
      <div><Link className="arcade-back-link" href="/arcade">← Arcade</Link><p className="arcade-practice-kicker">PLAY LOCAL OR ONLINE</p><h1 id="practice-catalog-title">Arcade Collection</h1><p>Full games include a live bot demo, custom matches, and arenas with different skills to master. The remaining prototypes are being upgraded one at a time.</p></div>
    </header>
    <ul className="arcade-practice-grid">{[...PRACTICE_GAMES].sort((a,b)=>Number(a.placeholder)-Number(b.placeholder)).map((game) => {
      const full = getFullArcadeGame(game.id);
      return <li key={game.id} data-game-id={game.id} className={full ? "arcade-upgraded-card" : undefined}>
        <p className="arcade-practice-kicker">{full ? `${full.maps.length} arenas · up to ${full.maxContestants} contestants` : "Prototype · up to 10 phones"}</p>
        <h2>{game.title}</h2><p>{game.instructions}</p>
        {full && <p className="arcade-card-features">Watch bots · customize · learn the maps</p>}
        {game.placeholder && <p>{ARCADE_PLACEHOLDER_NOTE}</p>}
        <Link href={`/arcade/online/new?game=${game.id}`}>Host online · up to 10 phones</Link>
        <Link href={`/arcade/practice/${game.id}`}>{full ? "Play" : "Practice"} {game.title}</Link>
      </li>;
    })}</ul>
  </main>;
}
