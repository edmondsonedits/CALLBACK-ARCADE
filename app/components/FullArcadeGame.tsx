import Link from "next/link";
import type { FullArcadeGame as Game } from "../../lib/arcade/full-games";

export default function FullArcadeGame({ game }: { readonly game: Game }) {
  return <main className="full-arcade-game" aria-label={game.title}>
    <nav className="full-arcade-nav" aria-label="Arcade navigation">
      <Link className="full-arcade-exit" href="/arcade/practice" aria-label={`Exit ${game.title} to the Arcade`}>← Arcade</Link>
      <span>{game.title}</span>
      <Link className="full-arcade-exit" href={`/arcade/online/new?game=${game.practiceId}`}>Online · 10 phones</Link>
    </nav>
    <iframe className="full-arcade-frame" title={`${game.title} full game`} src={game.href}
      allow="fullscreen; gamepad" allowFullScreen />
  </main>;
}
