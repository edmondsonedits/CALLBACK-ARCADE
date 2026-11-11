"use client";

import Image from "next/image";
import Link from "next/link";
import { ScrollPanel } from "./ScrollPanel";
import { useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import type { HistoryMatch } from "../../server/history";

type MatchCard = {
  id: string;
  room_code: string;
  match_number: number;
  game_length: string;
  title: string;
  player_count: number;
  winner_names: string;
  played_at: number;
};
const modes = [
  { id: "", label: "All games" },
  { id: "bowl-of-fools", label: "Bowl of Fools" },
  { id: "royal-war-room", label: "War Room" },
  { id: "royal-rumours", label: "Royal Rumours" },
  { id: "pictures", label: "King Prompter" },
  { id: "comic", label: "Comics" },
  { id: "birthday", label: "Big 30" },
  { id: "standard", label: "Legacy" },
];

export function HistoryBooks() {
  const [matches, setMatches] = useState<MatchCard[]>([]);
  const [selected, setSelected] = useState<HistoryMatch | null>(null);
  const [mode, setMode] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(
        `/api/history?mode=${encodeURIComponent(mode)}&q=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      )
        .then(
          (response) => response.json() as Promise<{ matches?: MatchCard[] }>,
        )
        .then((data) => setMatches(data.matches ?? []))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [mode, query]);
  const openMatch = async (id: string) => {
    const response = await fetch(`/api/history/${id}`);
    if (response.ok)
      setSelected(((await response.json()) as { match: HistoryMatch }).match);
  };
  return (
    <main className="history-books-shell">
      <header className="history-books-hero">
        <div>
          <p className="eyebrow">THE CASTLE ARCHIVE</p>
          <h1>History Books</h1>
          <p>
            Your finished games, favourite moments, and winning artwork.
          </p>
        </div>
        <Link className="button button-quiet" href="/?menu=1">
          Back to Grand Hall
        </Link>
      </header>
      <section className="history-toolbar" aria-label="Filter match history">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search players, winners, prompts…"
          aria-label="Search History Books"
        />
        <select aria-label="Filter by game" value={mode} onChange={event=>setMode(event.target.value)}>
          {modes.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </section>
      {loading ? (
        <div className="history-empty">Opening the archive…</div>
      ) : matches.length === 0 ? (
        <div className="history-empty">
          <span>📖</span>
          <h2>No finished matches yet</h2>
          <p>
            The first completed game after this update will become the opening
            chapter.
          </p>
        </div>
      ) : (
        <section className="history-grid" aria-label="Archived matches">
          {matches.map((match) => (
            <button
              key={match.id}
              className="history-card"
              onClick={() => void openMatch(match.id)}
            >
              <span
                className={`history-mode history-mode-${match.game_length}`}
              >
                {match.title}
              </span>
              <h2>{match.winner_names || "The room"}</h2>
              <p>{match.winner_names ? "Crowned champion" : "Match archive"}</p>
              <footer>
                <span>
                  {new Date(match.played_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span>{match.player_count} players</span>
                <span>Chapter {match.match_number}</span>
              </footer>
            </button>
          ))}
        </section>
      )}
      {selected && (
        <div
          className="history-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section
            className="history-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-match-title"
          >
            <button
              className="history-close"
              onClick={() => setSelected(null)}
              aria-label="Close match history"
            >
              ×
            </button>
            <ScrollPanel><p className="eyebrow">
              {new Date(selected.playedAt).toLocaleString()}
            </p>
            <h1 id="history-match-title">{selected.title}</h1>
            <p>
              Room {selected.code} · Chapter {selected.matchNumber}
            </p>
            <h2>Royal roster</h2>
            <div className="history-roster">
              {selected.players.map((player) => (
                <article
                  className={player.winner ? "winner" : ""}
                  key={player.id}
                >
                  <Avatar
                    index={player.avatar}
                    color={player.color}
                    config={player.avatarConfig as never}
                    size="small"
                  />
                  <div>
                    <strong>
                      {player.nickname}
                      {player.bot ? " · BOT" : ""}
                    </strong>
                    <span>{player.score.toLocaleString()} points</span>
                  </div>
                  {player.winner && <b>♛</b>}
                </article>
              ))}
            </div>
            {selected.images.length > 0 && (
              <>
                <h2>Picture gallery</h2>
                <div className="history-image-grid">
                  {selected.images.map((item) => (
                    <figure key={item.assetId}>
                      <Image
                        src={`/api/history/${selected.id}/media/${item.assetId}`}
                        width={1024}
                        height={1024}
                        unoptimized
                        alt={
                          item.prompt
                            ? `Generated image for ${item.prompt}`
                            : "Archived generated game image"
                        }
                      />
                      <figcaption>
                        {item.prompt || item.kind.replaceAll("_", " ")}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </>
            )}
            {selected.rounds.length > 0 && (
              <>
                <h2>Round ledger</h2>
                <div className="history-rounds">
                  {selected.rounds.map((round) => (
                    <details key={String(round.id)}>
                      <summary>
                        <span>
                          {String(round.label ?? round.kind ?? "Round")}
                        </span>
                        <strong>
                          {Array.isArray(round.answers)
                            ? round.answers.length
                            : 0}{" "}
                          entries
                        </strong>
                      </summary>
                      <p className="history-prompt">
                        {String(round.prompt ?? "")}
                      </p>
                      <div>
                        {Array.isArray(round.answers) &&
                          round.answers.map((answer) => {
                            const entry = answer as {
                              id: string;
                              player_id: string;
                              text: string;
                            };
                            const author = selected.players.find(
                              (player) => player.id === entry.player_id,
                            );
                            return (
                              <blockquote key={entry.id}>
                                “{entry.text}”{" "}
                                <cite>
                                  — {author?.nickname ?? "Unknown player"}
                                </cite>
                              </blockquote>
                            );
                          })}
                      </div>
                    </details>
                  ))}
                </div>
              </>
            )}
            </ScrollPanel>
          </section>
        </div>
      )}
    </main>
  );
}
