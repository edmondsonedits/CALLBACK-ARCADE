"use client";

import type { DisplaySnapshot, HostAction, HostSnapshot } from "../../lib/contracts";

type BuzzwortPhase = "clue" | "guess" | "revealed";
type BuzzwortTeam = "ember" | "cobalt";
type BuzzwortSnapshot = {
  matchId: string; round: number; phase: BuzzwortPhase; attempt: number; players: string[];
  activeTeam: BuzzwortTeam; watcherTeam: BuzzwortTeam; clueGiverId: string; guesserId: string;
  deadline: number; version: number; clueCount: number; submitted: boolean; currentClue?: string;
  clues: Array<{ playerId: string; attempt: number; text: string }>;
  result?: {
    outcome: "guessed" | "taboo" | "timeout"; winnerTeam: BuzzwortTeam; activeTeam: BuzzwortTeam;
    watcherTeam: BuzzwortTeam; card: { word: string; tabooWords: string[] };
    scores: Record<BuzzwortTeam, number>; teams: Record<string, BuzzwortTeam>; roles: Record<string, string>;
    clues: Array<{ playerId: string; attempt: number; text: string }>;
    guesses: Array<{ playerId: string; attempt: number; text: string; correct: boolean }>;
  };
};
type HostView = HostSnapshot | DisplaySnapshot;

export function BuzzwortHost({ snapshot, remaining, act, readOnly = false }: { snapshot: HostView; remaining: number | null; act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>; readOnly?: boolean }) {
  const match = (snapshot as HostView & { buzzwort?: BuzzwortSnapshot | null }).buzzwort;
  if (!match) return <section className="arcade-host buzzwort-stage" role="status"><p>Loading the match…</p></section>;
  const players = snapshot.players.filter((player) => player.role === "player");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const result = match.result;
  if (match.phase === "revealed" && result) return <section className="arcade-host buzzwort-stage" aria-label="Buzzwort results">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>BUZZWORT · REVEAL</span><span>ROOM {snapshot.code}</span></header>
    <section className="buzzwort-board buzzwort-reveal" aria-live="polite">
      <div className="buzzwort-result-head"><p className="arcade-kicker">{result.outcome === "guessed" ? "Word guessed" : result.outcome === "taboo" ? "Taboo word said" : "Time ran out"}</p><h1 className={`buzzwort-team buzzwort-team-${result.winnerTeam}`}>{teamName(result.winnerTeam)} wins</h1></div>
      <p className="buzzwort-card-reveal">The word was <strong>{result.card.word}</strong><span>Taboo: {result.card.tabooWords.join(" · ")}</span></p>
      <div className="buzzwort-reveal-columns">
        <section><h2>Clue trail</h2>{result.clues.slice(-3).map((clue, index) => <p className="buzzwort-log-row" key={`${clue.attempt}:${index}`}><b>{clue.attempt}.</b><span>{names.get(clue.playerId) ?? "Player"}</span><strong>“{clue.text}”</strong></p>)}</section>
        <section><h2>Guesses</h2>{result.guesses.slice(-3).map((guess, index) => <p className="buzzwort-log-row" key={`${guess.attempt}:${index}`}><b>{guess.correct ? "✓" : "×"}</b><span>{names.get(guess.playerId) ?? "Player"}</span><strong>“{guess.text}”</strong></p>)}{!result.guesses.length && <p>No guesses were made.</p>}</section>
      </div>
      <TeamScores scores={result.scores} />
      {!readOnly && <button className="arcade-action buzzwort-replay" onClick={() => void act("PLAY_AGAIN")}>Play again</button>}
      {readOnly && <p className="arcade-connection" role="status">The host controls the next match.</p>}
    </section>
  </section>;

  const isGuess = match.phase === "guess";
  const clues = match.clues;
  return <section className="arcade-host buzzwort-stage" aria-label="Buzzwort host screen">
    <header className="arcade-topbar"><span>KING PROMPTER</span><span>BUZZWORT · ATTEMPT {match.attempt}</span><span>ROOM {snapshot.code}</span></header>
    <section className="buzzwort-board" aria-live="polite">
      <div className="buzzwort-matchup">
        <TeamPill team={match.activeTeam} label="ACTIVE TEAM" />
        <p>{isGuess ? "Talk it out before time is up" : "Watch the clue giver"}</p>
        <TeamPill team={match.watcherTeam} label="WATCHERS" />
      </div>
      <h1>{isGuess ? "Can the team guess the word?" : "Describe it without saying it"}</h1>
      <div className="buzzwort-stage-content">
        <div className="buzzwort-current-clue">
          <span>CLUE {isGuess ? `· ATTEMPT ${match.attempt}` : "· WAITING"}</span>
          <strong>{match.currentClue ? `“${match.currentClue}”` : "The clue giver is thinking…"}</strong>
        </div>
        <aside className="buzzwort-crew"><p><span>CLUE GIVER</span><strong>{names.get(match.clueGiverId) ?? "Player"}</strong></p><p><span>GUESSER</span><strong>{names.get(match.guesserId) ?? "Player"}</strong></p><p><span>ATTEMPTS</span><strong>{match.clueCount}</strong></p></aside>
      </div>
      {clues.length > 1 && <div className="buzzwort-recent-clues" aria-label="Previous clues">{clues.slice(-3, -1).map((clue, index) => <span key={`${clue.attempt}:${index}`}>#{clue.attempt} “{clue.text}”</span>)}</div>}
      <div className="buzzwort-host-timer" role="timer" aria-label={`${remaining === null ? "Unknown" : Math.max(0, Math.ceil(remaining / 1000))} seconds remaining`}>{remaining === null ? "—" : `${Math.max(0, Math.ceil(remaining / 1000))}s`}</div>
    </section>
  </section>;
}

function TeamPill({ team, label }: { team: BuzzwortTeam; label: string }) {
  return <div className={`buzzwort-team-pill buzzwort-team-${team}`}><span>{label}</span><strong>{teamName(team)}</strong></div>;
}

function TeamScores({ scores }: { scores: Record<BuzzwortTeam, number> }) {
  return <div className="buzzwort-scores" aria-label="Team scores"><span className="buzzwort-team-ember">EMBER <strong>{scores.ember}</strong></span><span className="buzzwort-team-cobalt">COBALT <strong>{scores.cobalt}</strong></span></div>;
}

function teamName(team: BuzzwortTeam) { return team === "ember" ? "Ember" : "Cobalt"; }
