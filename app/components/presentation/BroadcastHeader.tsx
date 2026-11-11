import Link from "next/link";
import { Brand } from "../Brand";

export function BroadcastHeader({ roomCode, display, displayStatus, secondaryDisplayCount, audioReady, muted, onAudio, onControls }: {
  roomCode: string;
  display: boolean;
  displayStatus: "connecting" | "live" | "reconnecting";
  secondaryDisplayCount: number;
  audioReady: boolean;
  muted: boolean;
  onAudio: () => void;
  onControls: () => void;
}) {
  return (
    <header className="host-header broadcast-header">
      <Brand compact />
      <div className="host-room-chip broadcast-room-code">
        <span>{display ? "SCREEN" : "JOIN"}</span>
        <strong>{roomCode}</strong>
        <small>{display ? "READ-ONLY COPY" : "SCAN THE PROCLAMATION"}</small>
      </div>
      <div className="host-header-actions broadcast-controls">
        <span data-host-music-control className="session-music-slot" />
        {display ? (
          <>
            <span className={`secondary-display-status status-${displayStatus}`} role="status"><span aria-hidden="true" />{displayStatus.toUpperCase()}</span>
            <button type="button" className={`secondary-display-audio ${!audioReady ? "audio-needs-start" : ""}`} onClick={onAudio}>
              {!audioReady ? "Enable sound" : muted ? "Unmute" : "Mute"}
            </button>
          </>
        ) : (
          <>
            {secondaryDisplayCount > 0 && <span className="secondary-display-count" role="status">{secondaryDisplayCount} other TV{secondaryDisplayCount === 1 ? "" : "s"} live</span>}
            <Link className="secondary-screen-link" href={`/display?code=${roomCode}`}>Another TV</Link>
            <button className={`icon-button host-audio-button ${!audioReady ? "audio-needs-start" : ""}`} onClick={onAudio} aria-label={!audioReady ? "Start host audio" : muted ? "Turn host audio on" : "Mute host audio"}>
              {!audioReady ? "▶♪" : muted ? "♪̸" : "♪"}
            </button>
            <button className="icon-button" onClick={onControls} aria-label="Open host controls">•••</button>
          </>
        )}
      </div>
    </header>
  );
}
