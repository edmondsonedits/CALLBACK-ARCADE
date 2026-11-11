"use client";

import Link from "next/link";
import {ScrollPanel} from "./ScrollPanel";
import { type Dispatch, type FormEvent, type MouseEvent, type SetStateAction, useEffect, useRef, useState } from "react";
import { MenuSettingsDialog, type MenuPreferences } from "./MenuSettingsDialog";
import { Crown } from "./presentation/Crown";

type GrandHallMenuProps = {
  visible: boolean;
  preferences: MenuPreferences;
  reducedMotion: boolean;
  onPreferencesChange: Dispatch<SetStateAction<MenuPreferences>>;
  onReplayIntro: () => void;
  onSelectGame: (href: string) => void;
  onDialogChange?: (open: boolean) => void;
};

function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-HJ-KM-NP-Z2-9]/g, "").slice(0, 4);
}

export function GrandHallMenu({ visible, preferences, reducedMotion, onPreferencesChange, onReplayIntro, onSelectGame, onDialogChange }: GrandHallMenuProps) {
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    onDialogChange?.(settingsOpen);
    return () => onDialogChange?.(false);
  }, [settingsOpen, onDialogChange]);
  const [displayCode, setDisplayCode] = useState("");
  const [displayCodeError, setDisplayCodeError] = useState("");

  const closeSettings = () => {
    setSettingsOpen(false);
    window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
  };

  const joinHostDisplay = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeRoomCode(displayCode);
    if (normalized.length !== 4) {
      setDisplayCodeError("Enter the four-character code shown on the main host screen.");
      return;
    }
    window.location.assign(`/display/${normalized}`);
  };

  const selectGame = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelectGame(href);
  };

  return (
    <>
      <section className="grand-hall-menu" hidden={!visible} aria-labelledby="grand-hall-title">
        <ScrollPanel active={visible}><div className="grand-hall-stage">
          <div className="grand-hall-main-card">
            <header className="grand-hall-heading">
              <span className="grand-hall-kicker">LIVE FROM THE GRAND HALL</span>
              <h1 id="grand-hall-title"><Crown state="brand" title="King Prompter" /> King Prompter</h1>
              <p>A royal variety show where your room writes the chaos.</p>
            </header>

            <nav className="grand-hall-actions" aria-label="King Prompter main menu">
              <div className="grand-hall-action-group grand-hall-primary-actions">
                <Link data-menu-action="Start Game" className="grand-hall-action grand-hall-action-start" href="/host/new" aria-label="Start Game" onClick={(event) => selectGame(event, "/host/new")}><strong>Start Game</strong><small>Create the room</small></Link>
                <Link data-menu-action="Join Game" className="grand-hall-action grand-hall-action-join" href="/play" aria-label="Join Game" onClick={(event) => selectGame(event, "/play")}><strong>Join Game</strong><small>Enter a room code</small></Link>
              </div>
              <div className="grand-hall-action-group grand-hall-featured-actions" aria-label="Featured games">
                <Link data-menu-action="Bowl of Fools" className="grand-hall-action" href="/host/new?game=bowl-of-fools" aria-label="Bowl of Fools" onClick={(event) => selectGame(event, "/host/new?game=bowl-of-fools")}><strong>Bowl of Fools</strong><small>Describe · perform · recall</small></Link>
                <Link data-menu-action="Royal Rumours" className="grand-hall-action" href="/host/new?game=royal-rumours" aria-label="Royal Rumours" onClick={(event) => selectGame(event, "/host/new?game=royal-rumours")}><strong>Royal Rumours</strong><small>Whisper · picture · misread</small></Link>
                <Link data-menu-action="Royal Frame-Up" className="grand-hall-action" href="/host/new?game=king-mystery" aria-label="The Royal Frame-Up" onClick={(event) => selectGame(event, "/host/new?game=king-mystery")}><strong>Royal Frame-Up</strong><small>Forge reports · solve cases</small></Link>
                <Link data-menu-action="Comic" className="grand-hall-action" href="/host/new?game=comic" aria-label="Comic" onClick={(event) => selectGame(event, "/host/new?game=comic")}><strong>Comic</strong><small>Royal Scriptorium</small></Link>
                <Link data-menu-action="Arcade" className="grand-hall-action grand-hall-action-arcade" href="/arcade" aria-label="Arcade" onClick={(event) => selectGame(event, "/arcade")}><strong>Arcade</strong><small>Side games for your room</small></Link>
                <Link data-menu-action="Party Games" className="grand-hall-action grand-hall-action-party" href="/party-games" aria-label="Party Games" onClick={(event) => selectGame(event, "/party-games")}><strong>Party Games</strong><small>More games · phones as controllers</small></Link>
              </div>
              <div className="grand-hall-action-group grand-hall-secondary-actions">
                <Link data-menu-action="How to Play" className="grand-hall-action" href="/how-to-play" aria-label="How to Play"><strong>How to Play</strong></Link>
                <Link data-menu-action="Avatar Studio" className="grand-hall-action" href="/avatar-studio" aria-label="Avatar Studio"><strong>Avatar Studio</strong></Link>
                <Link data-menu-action="History Books" className="grand-hall-action" href="/history-books" aria-label="History Books"><strong>History Books</strong></Link>
                <button ref={settingsButtonRef} data-menu-action="Settings" className="grand-hall-action" type="button" aria-label="Settings" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}><strong>Settings</strong></button>
              </div>
            </nav>
          </div>

          <aside className="grand-hall-side-card">
            <div className="grand-hall-broadcast-seal" aria-hidden="true"><span>ROYAL</span><strong>ON AIR</strong></div>
            <div className="grand-hall-side-copy"><span>ONE CASTLE · MANY GAMES</span><p>Start a show, join from your phone, or mirror the host on another screen.</p></div>
            <form data-menu-action="Join Host Display" className="grand-hall-display-join" onSubmit={joinHostDisplay}>
              <div><span>ANOTHER COMPUTER OR TV?</span><strong>Join Host Display</strong></div>
              <label htmlFor="home-display-code">Four-character host code</label>
              <div className="grand-hall-display-controls">
                <input id="home-display-code" value={displayCode} onChange={(event) => { setDisplayCode(normalizeRoomCode(event.target.value)); setDisplayCodeError(""); }} maxLength={4} autoComplete="off" inputMode="text" placeholder="B4CK" aria-describedby={displayCodeError ? "home-display-code-error" : "home-display-code-help"} />
                <button type="submit">Watch <span aria-hidden="true">→</span></button>
              </div>
              {displayCodeError
                ? <small id="home-display-code-error" className="grand-hall-display-error" role="alert">{displayCodeError}</small>
                : <small id="home-display-code-help">Read-only mirror of the main host screen.</small>}
            </form>
          </aside>
        </div></ScrollPanel>
      </section>

      {visible&&<MenuSettingsDialog open={settingsOpen} preferences={preferences} replayDisabled={reducedMotion} onChange={onPreferencesChange} onClose={closeSettings} onReplayIntro={() => { closeSettings(); onReplayIntro(); }} />}
    </>
  );
}
