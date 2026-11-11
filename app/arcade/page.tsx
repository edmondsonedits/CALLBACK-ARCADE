import Link from "next/link";
import { ARCADE_GAMES, ARCADE_PLACEHOLDER_NOTE, getArcadeLaunchHref } from "../../lib/arcade/catalog";
import { ACTIVE_FULL_ARCADE_GAMES } from "../../lib/arcade/full-games";

export const metadata = {
  title: "Arcade | King Prompter",
  description: "Browse multiplayer side games from King Prompter.",
};

export default function ArcadePage() {
  return (
    <main className="arcade-page" aria-labelledby="arcade-title">
      <header className="arcade-header">
        <Link className="arcade-back-link" href="/?menu=1">← Grand Hall</Link>
        <p className="arcade-kicker">A KING PROMPTER SIDE HALL</p>
        <h1 id="arcade-title">The Arcade</h1>
        <p>Open a phone-ready game on your TV, create a room, then join from each player’s phone. Up to 10 players can share a match.</p>
        <Link className="arcade-launch" href="/arcade-games/phone/controller.html">Join a featured game</Link>
        <Link className="arcade-launch" href="/arcade/online/join">Join another Arcade room</Link>
        <Link className="arcade-back-link" href="/arcade/practice">Browse the practice collection</Link>
      </header>
      <section aria-labelledby="full-games-title">
        <h2 id="full-games-title" className="arcade-section-title">Jump into a full game</h2>
        <ul className="arcade-grid" aria-label="Full arcade games">
          {ACTIVE_FULL_ARCADE_GAMES.map(game => <li className="arcade-card arcade-full-card" key={game.id}>
            <p className="arcade-kicker">{game.maps.length} arenas · up to {game.maxContestants} contestants</p>
            <h3>{game.title}</h3>
            <p>{game.maps[0].skill}</p>
            <p>{game.phoneRooms ? "TV + up to 10 phones · room codes" : "Local play · bots · touch controls"}</p>
            {!game.phoneRooms && <Link className="arcade-launch" href={`/arcade/online/new?game=${game.practiceId}`}>Host online · 10 phones</Link>}
            <Link className="arcade-launch" href={game.href}>Play {game.title}</Link>
          </li>)}
        </ul>
      </section>
      <h2 className="arcade-section-title">Party-room games</h2>
      <ul className="arcade-grid" aria-label="Party-room arcade games">
        {ARCADE_GAMES.map((game) => {
          const href = getArcadeLaunchHref(game);
          return (
            <li className="arcade-card" key={game.id} data-game-id={game.id}>
              <div className="arcade-card-heading">
                <h2>{game.title}</h2>
                <span className={`arcade-status${game.status === "playable" && !game.placeholder ? " arcade-status-playable" : ""}`}>
                  {game.placeholder ? "Placeholder" : game.status === "playable" ? "Ready to play" : "In development"}
                </span>
              </div>
              <p>{game.summary}</p>
              {game.placeholder && <p>{ARCADE_PLACEHOLDER_NOTE}</p>}
              {href
                ? <Link className="arcade-launch" href={href}>Play {game.title}</Link>
                : <button className="arcade-launch" type="button" disabled aria-label={`${game.title} is in development`}>Coming soon</button>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
