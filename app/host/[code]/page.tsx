"use client";

import QRCode from "qrcode";
import { ExpandableQr } from "../../components/ExpandableQr";
import Image from "next/image";
import Link from "next/link";
import {ScrollPanel} from "../../components/ScrollPanel";
import { useEffect, useRef, useState } from "react";
import type {
  DisplaySnapshot,
  HostAction,
  HostSnapshot,
} from "../../../lib/contracts";
import { ARCADE_GAMES, getArcadeMinimumPlayers } from "../../../lib/arcade/catalog";
import { ARCHIVED_GAME_PACK_TITLES, isArchivedGamePack } from "../../../lib/game/archived-packs";
import { Avatar } from "../../components/Avatar";
import { AvatarPoseProvider } from "../../components/AvatarPoseProvider";
import BotSwitch from "../../components/BotSwitch";
import { Brand, PhasePill } from "../../components/Brand";
import { BowlHostStage, BowlResults } from "../../components/BowlOfFools";
import { SchaetzoramaHost } from "../../components/SchaetzoramaHost";
import { ImposterHost } from "../../components/ImposterHost";
import { BuzzwortHost } from "../../components/BuzzwortHost";
import { PantomimeHost } from "../../components/PantomimeHost";
import { DrawGuessHost } from "../../components/DrawGuessHost";
import { ArenaSurvivorHost } from "../../components/ArenaSurvivorHost";
import { ChaosKommandoHost } from "../../components/ChaosKommandoHost";
import { MagicArenaHost } from "../../components/MagicArenaHost";
import { MagicDuellHost } from "../../components/MagicDuellViews";
import { MinionsTdHost } from "../../components/MinionsTdViews";
import { KartentischHost } from "../../components/KartentischViews";
import { DungeonPartyHost } from "../../components/DungeonPartyViews";
import { FlatterfluffHost } from "../../components/FlatterfluffViews";
import { DriftRacerHost } from "../../components/DriftRacerViews";
import { SketchRelayStage } from "../../components/sketch-relay/SketchRelayStage";
import { FishBonusHost } from "../../components/fish/FishFinalePanel";
import type { SnapshotSketchRelay } from "../../../lib/contracts";
import { WordTilesHost } from "../../components/WordTilesViews";
import { SchattenjagdHost } from "../../components/SchattenjagdViews";
import { ArcadeHost } from "../../components/ArcadeHost";
import { TapRaceHost } from "../../components/TapRaceViews";
import { LightTrailsHost } from "../../components/LightTrailsViews";
import { useArcadeRealtime } from "../../components/useArcadeRealtime";
import { RestorationPortrait } from "../../components/RestorationPortrait";
import { PresentationDirector } from "../../components/presentation/PresentationDirector";
import { BroadcastHeader } from "../../components/presentation/BroadcastHeader";
import { StageTimer } from "../../components/presentation/StageTimer";
import { StageResponseMeter } from "../../components/presentation/ResponseMeter";
import { Crown } from "../../components/presentation/Crown";
import { ScoreReveal } from "../../components/presentation/ScoreReveal";
import { usePresentationEvents } from "../../components/presentation/usePresentationEvents";
import { useHostAudio } from "../../components/useHostAudio";
import {
  useCountdown,
  useRoomSync,
  useSecondaryDisplayCount,
} from "../../components/useRoomSync";
import { randomUuid } from "../../../lib/game/random";
import { ImageGeneratorOptions } from "../../components/ImageGeneratorOptions";
import { FullscreenDialog } from "../../components/FullscreenDialog";

export default function HostRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [code, setCode] = useState("");
  useEffect(() => {
    void params.then((value) => setCode(value.code.toUpperCase()));
  }, [params]);
  if (!code)
    return (
      <main className="centered-screen">
        <Brand />
        <div className="loader-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  return <HostRoomSurface code={code} />;
}

export function HostRoomSurface({
  code,
  display = false,
}: {
  code: string;
  display?: boolean;
}) {
  const {
    snapshot: rawSnapshot,
    error,
    reconnecting,
    send,
  } = useRoomSync(code, display ? "display" : "host");
  const snapshot = display
    ? rawSnapshot?.role === "display"
      ? (rawSnapshot as DisplaySnapshot)
      : null
    : rawSnapshot?.role === "host"
      ? (rawSnapshot as HostSnapshot)
      : null;
  const arcadeRealtime = useArcadeRealtime(code, !display && snapshot?.role === "host" ? snapshot : null, !display);
  const remaining = useCountdown(snapshot);
  const presentationEvents = usePresentationEvents(snapshot);
  const secondaryDisplayCount = useSecondaryDisplayCount(code, !display);
  const [controlsOpen, setControlsOpen] = useState(false);
  const audio = useHostAudio(snapshot, remaining, presentationEvents, Boolean(snapshot?.sketchRelay || snapshot?.fishGame));
  useDisplayWakeLock(display);
  const displayStatus =
    reconnecting || (error && (error.status === 0 || error.status >= 500))
      ? "reconnecting"
      : snapshot
        ? "live"
        : "connecting";

  const act = async (
    type: HostAction["type"],
    payload: Record<string, unknown> = {},
    propagateError = false,
  ) => {
    if (!snapshot || display) return;
    try {
      await send({
        type,
        actionId: randomUuid(),
        roundId: snapshot.roundId,
        expectedPhase: snapshot.phase,
        payload,
      } as HostAction);
    } catch (cause) {
      // useRoomSync renders the rejected action so the host can correct it.
      // Stateful stages also need the rejection to show their own retry state.
      if (propagateError) throw cause;
    }
  };
  if (error?.status === 401)
    return (
      <main className="centered-screen">
        <Brand />
        <div className="error-card">
          <h1>{display ? "Screen code expired" : "Host key missing"}</h1>
          <p>
            {display
              ? `This secondary screen can no longer open room ${code}.`
              : `This browser does not hold the host seat for room ${code}.`}
          </p>
          <Link
            className="button button-primary"
            href={display ? "/display" : "/host/new"}
          >
            {display ? "Enter another code" : "Start a new room"}
          </Link>
        </div>
      </main>
    );
  if (!snapshot)
    return (
      <main className="centered-screen">
        <Brand />
        <div className="loader-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>{reconnecting ? "Reconnecting…" : "Opening the room…"}</p>
      </main>
    );

  if (snapshot.gameLength === "arcade" && ((snapshot.phase === "LOBBY" && snapshot.arcadeGameId !== "sketch-relay") || snapshot.arcadeGameId === "air-hockey" || snapshot.arcadeGameId === "tap-race" || snapshot.arcadeGameId === "light-trails")) {
    if (display) return <main className="arcade-host"><header className="arcade-topbar"><Link href="/">KING PROMPTER</Link><span>ARCADE · {snapshot.arcadeGameId === "tap-race" ? "Tap Race" : snapshot.arcadeGameId === "light-trails" ? "Light Trails" : "Air Hockey"}</span><span>ROOM {snapshot.code}</span></header><section className="arcade-host-card"><p className="arcade-kicker">SECOND SCREEN</p><h1>Game on the host display</h1><p>Live controls and the game table are available on the main King Prompter host screen.</p></section></main>;
    if (snapshot.arcadeGameId === "air-hockey") return <ArcadeHost snapshot={snapshot as HostSnapshot} game={arcadeRealtime.game} connection={arcadeRealtime.connection} act={act} />;
    if (snapshot.phase !== "ARCADE_ACTIVE") return <ArcadeHost snapshot={snapshot as HostSnapshot} game={null} connection={arcadeRealtime.connection} act={act} />;
    if (snapshot.arcadeGameId === "light-trails") return <main className="arcade-host" aria-label="Light Trails host screen"><header className="arcade-topbar"><Link href="/">KING PROMPTER</Link><span>ARCADE · Light Trails</span><span>ROOM {snapshot.code}</span></header><LightTrailsHost game={arcadeRealtime.game} names={new Map(snapshot.players.map((player) => [player.id, player.nickname]))} connection={arcadeRealtime.connection} paused={snapshot.paused} onPauseToggle={() => void act(snapshot.paused ? "RESUME" : "PAUSE")} /></main>;
    return <main className="arcade-host" aria-label="Tap Race host screen"><header className="arcade-topbar"><Link href="/">KING PROMPTER</Link><span>ARCADE · Tap Race</span><span>ROOM {snapshot.code}</span></header><TapRaceHost game={arcadeRealtime.game} names={new Map(snapshot.players.map((player) => [player.id, player.nickname]))} connection={arcadeRealtime.connection} paused={snapshot.paused} onPauseToggle={() => void act(snapshot.paused ? "RESUME" : "PAUSE")} /></main>;
  }

  if (snapshot.arcadeGameId === "fish-tank" && snapshot.fishGame?.phase === "closed") return <main className={`host-shell ${display ? "secondary-display" : ""}`}>
    <BroadcastHeader roomCode={snapshot.code} display={display} displayStatus={displayStatus} secondaryDisplayCount={secondaryDisplayCount} audioReady={audio.ready} muted={audio.settings.muted} onAudio={audio.activateOrToggle} onControls={() => setControlsOpen(true)} />
    <section className="results-stage" aria-label="Fish game results"><p className="eyebrow">THE AQUARIUM IS RESTING</p><h1>The Last Fish Swimming</h1><p>{snapshot.fishGame.closedReason === "finished" ? "The fish have finished their swim. Everyone is welcome back for another match." : "This fish match has ended. The room is ready to play again."}</p>
      {!display && <div className="results-actions"><button className="button button-primary" onClick={() => void act("PLAY_AGAIN", {}, true)}>Play again</button></div>}
    </section>
    {!display && <HostControls open={controlsOpen} snapshot={snapshot as HostSnapshot} close={() => setControlsOpen(false)} act={act} audio={audio} />}
  </main>;

  if (snapshot.sketchRelay && (snapshot.phase !== "LOBBY" || snapshot.sketchRelay.fishTest)) return <main className={`host-shell ${display ? "secondary-display" : ""} ${!display && snapshot.soloMode && snapshot.sketchRelay.fishTest ? "solo-fish-test" : ""}`} style={{ display: "flex", flexDirection: "column" }}>
    <BroadcastHeader roomCode={snapshot.code} display={display} displayStatus={displayStatus} secondaryDisplayCount={secondaryDisplayCount} audioReady={audio.ready} muted={audio.settings.muted} onAudio={audio.activateOrToggle} onControls={() => setControlsOpen(true)} />
    {reconnecting && <div className="connection-banner" role="status">Reconnecting…</div>}
    {error && error.status !== 401 && <div className="toast-error" role="alert">{error.message}</div>}
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}><SketchRelayStage snapshot={snapshot.sketchRelay} roomCode={snapshot.code} players={snapshot.players} remaining={remaining} paused={snapshot.paused} allowAudio={!display && !audio.settings.muted} allowNarration={audio.settings.narrator} fishAudioSettings={audio.settings} onPlayAgain={display ? undefined : () => act("PLAY_AGAIN", {}, true)} onAction={display ? undefined : (type, payload) => act(type, payload, true)} /></div>
    {!display && <HostControls open={controlsOpen} snapshot={snapshot as HostSnapshot} close={() => setControlsOpen(false)} act={act} audio={audio} />}
  </main>;
  if (snapshot.fishGame && snapshot.fishGame.phase !== "closed" && snapshot.arcadeGameId === "fish-tank") {
    const fishView = { matchId: snapshot.fishGame.matchId, finale: snapshot.fishGame, fishTest: false } as SnapshotSketchRelay;
    return <main className={display ? "host-shell secondary-display" : "host-shell"} style={{ display: "flex", flexDirection: "column" }}>
      <BroadcastHeader roomCode={snapshot.code} display={display} displayStatus={displayStatus} secondaryDisplayCount={secondaryDisplayCount} audioReady={audio.ready} muted={audio.settings.muted} onAudio={audio.activateOrToggle} onControls={() => setControlsOpen(true)} />
      {reconnecting && <div className="connection-banner" role="status">Reconnecting…</div>}
      {error && error.status !== 401 && <div className="toast-error" role="alert">{error.message}</div>}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}><FishBonusHost game={fishView} code={snapshot.code} host={!display} allowAudio={!display && !audio.settings.muted} audioSettings={audio.settings} players={snapshot.players.map(({ id, nickname }) => ({ id, nickname }))} standalone onPlayAgain={display ? undefined : () => void act("PLAY_AGAIN", {}, true)}>{null}</FishBonusHost></div>
      {!display && <HostControls open={controlsOpen} snapshot={snapshot as HostSnapshot} close={() => setControlsOpen(false)} act={act} audio={audio} />}
    </main>;
  }
  return (
    <AvatarPoseProvider endpoint={`/api/rooms/${code}/avatar-poses`} mode={display ? "display" : "host"}>
    <main
      data-arcade-touch={snapshot.gameLength==="arcade"?"":undefined}
      className={`host-shell ${display ? "secondary-display" : ""} ${!display && snapshot.soloMode && snapshot.gameLength === "arcade" && snapshot.arcadeGameId === "sketch-relay" ? "solo-fish-test" : ""} phase-${snapshot.phase.toLowerCase().replaceAll("_", "-")}`}
    >
      <BroadcastHeader roomCode={snapshot.code} display={display} displayStatus={displayStatus} secondaryDisplayCount={secondaryDisplayCount} audioReady={audio.ready} muted={audio.settings.muted} onAudio={audio.activateOrToggle} onControls={() => setControlsOpen(true)} />
      {reconnecting && (
        <div className="connection-banner" role="status">
          Reconnecting…
        </div>
      )}
      {error && error.status !== 401 && (
        <div className="toast-error" role="alert">
          {error.message}
        </div>
      )}
      {snapshot.imageGenerationNotice && (
        <ImageGenerationNotice notice={snapshot.imageGenerationNotice} />
      )}

      <PresentationDirector snapshot={snapshot} events={presentationEvents}>
      {snapshot.phase === "LOBBY" ? (
        <HostLobby
          snapshot={snapshot}
          act={act}
          display={display}
          startGame={() => {
            void audio.unlock();
            void act("START_GAME");
          }}
        />
      ) : snapshot.imposter ? (
        <ImposterHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.buzzwort ? (
        <BuzzwortHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.pantomime ? (
        <PantomimeHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.drawGuess ? (
        <DrawGuessHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.chaosKommando ? (
        <ChaosKommandoHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.magicArena ? (
        <MagicArenaHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.magicDuell ? (
        <MagicDuellHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.minionsTd ? (
        <MinionsTdHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.kartentisch ? (
        <KartentischHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.dungeonParty ? (
        <DungeonPartyHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.flatterfluff ? (
        <FlatterfluffHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.driftRacer ? (
        <DriftRacerHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.wordTiles ? (
        <WordTilesHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.schattenjagd ? (
        <SchattenjagdHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.arenaSurvivor ? (
        <ArenaSurvivorHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.gameLength === "arcade" && snapshot.arcadeGameId === "schaetzorama" ? (
        <SchaetzoramaHost snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} readOnly={display} />
      ) : snapshot.gameLength === "bowl-of-fools" && ["FINAL_RESULTS", "POST_GAME"].includes(snapshot.phase) ? (
        <HostResults snapshot={snapshot} act={act} readOnly={display} />
      ) : snapshot.gameLength === "bowl-of-fools" ? (
        <FoolHostStage snapshot={snapshot} remaining={remaining} act={act} readOnly={display} />
      ) : snapshot.gameLength === "bowl" && ["FINAL_RESULTS", "POST_GAME"].includes(snapshot.phase) ? (
        <BowlResults snapshot={snapshot} />
      ) : snapshot.gameLength === "bowl" ? (
        <BowlHostStage snapshot={snapshot} remaining={remaining} />
      ) : ["FINAL_RESULTS", "POST_GAME"].includes(snapshot.phase) ? (
        <HostResults snapshot={snapshot} act={act} readOnly={display} />
      ) : (
        <HostStage snapshot={snapshot} remaining={remaining} act={act} readOnly={display} />
      )}
      </PresentationDirector>

      {audio.caption && (
        <div className="narrator-caption" role="status">
          <span>NARRATOR</span>
          {audio.caption}
        </div>
      )}
      {!display && (
        <HostControls
          open={controlsOpen}
          snapshot={snapshot as HostSnapshot}
          close={() => setControlsOpen(false)}
          act={act}
          audio={audio}
        />
      )}
    </main>
    </AvatarPoseProvider>
  );
}

function useDisplayWakeLock(enabled: boolean) {
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let stopped = false;
    const request = async () => {
      if (stopped || document.visibilityState !== "visible" || wakeLock.current)
        return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (stopped) {
          void lock.release();
          return;
        }
        wakeLock.current = lock;
        lock.addEventListener("release", () => {
          if (wakeLock.current === lock) wakeLock.current = null;
        });
      } catch {
        /* Wake Lock is optional and browser-dependent. */
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void request();
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const lock = wakeLock.current;
      wakeLock.current = null;
      if (lock) void lock.release();
    };
  }, [enabled]);
}

type HostScreenSnapshot = HostSnapshot | DisplaySnapshot;

export function HostLobby({
  snapshot,
  act,
  display,
  startGame,
}: {
  snapshot: HostScreenSnapshot;
  act: (
    type: HostAction["type"],
    payload?: Record<string, unknown>,
  ) => Promise<void>;
  display: boolean;
  startGame: () => void;
}) {
  const [qr, setQr] = useState("");
  const [fishDrawingSeconds, setFishDrawingSeconds] = useState(240);
  const [fishTestMode, setFishTestMode] = useState<"shark" | "peaceful">("shark");
  const [practiceOpen, setPracticeOpen] = useState(false);

  const [publicCode,setPublicCode]=useState(snapshot.code);
  useEffect(() => {
    const session=new URLSearchParams(window.location.search).get('session');
    const publicCode=session??snapshot.code;queueMicrotask(()=>setPublicCode(publicCode));
    void QRCode.toDataURL(`${window.location.origin}${session?`/session/${session}/play`:`/play/${snapshot.code}`}`, {
      width: 900,
      margin: 1,
      color: { dark: "#101A3B", light: "#FFF4D6" },
    }).then(setQr);
  }, [snapshot.code]);
  const players = snapshot.players.filter((player) => player.role === "player");
  const bowl = snapshot.gameLength === "bowl-of-fools" ? snapshot.foolBowl : snapshot.gameLength === "bowl" ? snapshot.bowl : null;
  const bowlTeams = snapshot.gameLength === "bowl-of-fools"
    ? Object.fromEntries(players.map((player, index) => [player.id, (snapshot.foolBowl?.teams[player.id] ?? (index % 2 === 0 ? "BELLS" : "MOTLEY")).toLowerCase()]))
    : snapshot.bowl?.teams ?? {};
  const isBowlGame = snapshot.gameLength === "bowl" || snapshot.gameLength === "bowl-of-fools";
  const isClassicBowl = snapshot.gameLength === "bowl";
  const classicHasBots = isClassicBowl && players.some((player) => player.bot);
  const bowlPlayers = isClassicBowl ? players.filter((player) => player.active && !player.bot) : players.filter((player) => player.active);
  const bowlReady = !isBowlGame || (
    !classicHasBots && bowlPlayers.length >= 4 && (!isClassicBowl || bowlPlayers.length <= 10) &&
    (["bells", "motley"] as const).every((team) => bowlPlayers.filter((player) => bowlTeams[player.id] === team).length >= 2)
  );
  const minimumPlayers = snapshot.gameLength === "arcade" && snapshot.arcadeGameId
    ? getArcadeMinimumPlayers(snapshot.arcadeGameId)
    : ["king-mystery", "royal-rumours", "royal-war-room"].includes(snapshot.gameLength) ? 3 : isBowlGame ? 4 : 2;
  const activePlayerCount = players.filter((player) => player.active).length;
  const activeHumanCount = players.filter((player) => player.active && !player.pendingActivation && !player.bot).length;
  const fishTestSeatCount = players.filter((player) => player.role === "player" && player.active && !player.pendingActivation).length;
  const botSeatControls = (snapshot.gameLength === "bowl-of-fools" || ["standard", "pictures", "comic", "king-mystery", "royal-rumours"].includes(snapshot.gameLength) || (snapshot.gameLength === "arcade" && ["arena-survivor", "buzzwort", "chaos-kommando", "drift-racer", "flatterfluff", "kartentisch", "magic-arena", "magic-duell", "minions-td", "zeichnen-und-erraten", "imposter", "pantomime", "schaetzorama", "schattenjagd", "dungeon-party", "word-tiles", "sketch-relay"].includes(snapshot.arcadeGameId ?? "")));
  const occupiedSeats = new Set(players.map((player) => player.lobbySlot).filter((seat): seat is number => Number.isInteger(seat)));
  const humanLobbySlots = new Set(players.filter((player) => player.active && !player.bot).map((player) => player.lobbySlot).filter((seat): seat is number => Number.isInteger(seat)));
  return (
    <section className={`host-lobby${botSeatControls ? " host-lobby-with-bots" : ""}${snapshot.arcadeGameId === "sketch-relay" ? " sorcery-lobby" : ""}`}>
      <div className="lobby-invite">
        <p className="eyebrow">Phones out</p>
        <h1>
          Join with code <span>{publicCode}</span>
        </h1>
        <div className="qr-frame">
          {qr ? (
            <ExpandableQr src={qr} code={publicCode} size={360}/>
          ) : (
            <div className="qr-placeholder" />
          )}
        </div>
        <p>Scan or visit this screen&apos;s join address. No account needed.</p>
      </div>
      <div className="lobby-roster">
        <div className="lobby-heading">
          <div>
            <p className="eyebrow">The room</p>
            <h2>{players.length}/10 players</h2>
          </div>
          <span className="audience-count">Everyone plays</span>
        </div>
        {bowl ? (
          <>
          <div className="bowl-lobby-teams">
            {(["bells", "motley"] as const).map((team) => (
              <section className={`bowl-lobby-team team-${team}`} key={team}>
                <header><span aria-hidden="true">{team === "bells" ? "🔔" : "◈"}</span><h3>Team {team === "bells" ? "Bells" : "Motley"}</h3></header>
                {players.filter((player) => bowlTeams[player.id] === team).map((player) => (
                  <div key={player.id}>
                    <Avatar playerId={player.id} index={player.avatar} color={player.color} config={player.avatarConfig} size="small" />
                    <strong>{player.nickname}</strong>
                    {!display && !player.bot && <button type="button" className="lobby-kick-button" aria-label={`Remove ${player.nickname}`} title={`Remove ${player.nickname}`} onClick={() => void act("REMOVE_PLAYER", { playerId: player.id })}>×</button>}
                    {!display && <button type="button" onClick={() => void act(snapshot.gameLength === "bowl-of-fools" ? "SET_FOOL_TEAM" : "SET_BOWL_TEAM", { playerId: player.id, team: snapshot.gameLength === "bowl-of-fools" ? (team === "bells" ? "MOTLEY" : "BELLS") : (team === "bells" ? "motley" : "bells") })}>Move →</button>}
                  </div>
                ))}
              </section>
            ))}
          </div>
          {!display && botSeatControls && <div aria-label="Local bot seats" className="lobby-bot-seat-list">{Array.from({ length: 10 }, (_, index) => index + 1).filter((seat) => !humanLobbySlots.has(seat)).map((seat) => { const enabled = (snapshot.botSeats ?? []).includes(seat); return <BotSwitch key={seat} number={seat} enabled={enabled} disabled={!enabled && activePlayerCount >= 10} onChange={(next) => void act("SET_BOT_SEAT", { seat, enabled: next })} />; })}</div>}
          </>
        ) : (
        <div className="roster-grid" data-crowded={players.length > 5 ? 'true' : undefined}>
          {players.map((player, playerIndex) => (
            <div
              className={`roster-player ${player.birthdayVip ? "birthday-vip" : ""}`}
              key={player.id}
            >
              <div className="roster-avatar-stage"><Avatar
                playerId={player.id} index={player.avatar}
                color={player.color}
                config={player.avatarConfig}
                size="large"
                label={`${player.nickname}'s avatar`}
              />
              </div><div className="roster-player-footer"><strong title={player.nickname}>{player.nickname}</strong>
              {player.bot && <small className="bot-badge">LOCAL BOT</small>}
              {!display && botSeatControls && player.bot && player.lobbySlot && <BotSwitch number={player.lobbySlot} enabled onChange={(enabled) => void act("SET_BOT_SEAT", { seat: player.lobbySlot, enabled })} />}
              {!display &&
                snapshot.gameLength === "birthday" &&
                !player.bot && (
                  <button
                    type="button"
                    className="vip-picker"
                    onClick={() =>
                      void act("SET_BIRTHDAY_PERSON", { playerId: player.id })
                    }
                  >
                    {player.birthdayVip
                      ? "★ Birthday VIP"
                      : `Make ${snapshot.birthdayName ?? "him"} the VIP`}
                  </button>
                )}
              {player.pendingActivation && <small>next round</small>}</div>
              {!display && !player.bot && <button type="button" className="lobby-kick-button" aria-label={`Remove ${player.nickname}`} title={`Remove ${player.nickname}`} onClick={() => void act("REMOVE_PLAYER", { playerId: player.id })}>×</button>}
              {!display && snapshot.gameLength === "bowl-of-fools" && <label className="fool-team-picker">Team<select value={snapshot.foolBowl?.teams[player.id] ?? (playerIndex % 2 === 0 ? "BELLS" : "MOTLEY")} onChange={(event) => void act("SET_FOOL_TEAM", { playerId: player.id, team: event.target.value })}><option value="BELLS">Bells</option><option value="MOTLEY">Motley</option></select></label>}
            </div>
          ))}
          {Array.from({ length: 10 }, (_, index) => index + 1).filter((seat) => !occupiedSeats.has(seat)).map((seat) => (
              <div
                className="roster-player roster-empty"
                key={`empty-${seat}`}
              >
                <span>+</span>
                <strong>Seat {seat} · Waiting…</strong>
                {!display && botSeatControls && <BotSwitch number={seat} enabled={(snapshot.botSeats ?? []).includes(seat)} disabled={!(snapshot.botSeats ?? []).includes(seat) && activePlayerCount >= 10} onChange={(enabled) => void act("SET_BOT_SEAT", { seat, enabled })} />}
              </div>
          ))}
        </div>
        )}
        {!display && (
          <div className="lobby-settings">
            {snapshot.gameLength === "arcade" ? (
              <><div className="arcade-lobby-selection" role="status">
                <span>Arcade game</span>
                <strong>{ARCADE_GAMES.find((game) => game.id === snapshot.arcadeGameId)?.title ?? "Selected Arcade game"}</strong>
              </div>
{snapshot.arcadeGameId === "sketch-relay" && <label>Image generator<select aria-label="Image generator" value={snapshot.imageModel} onChange={(event) => void act("SET_CONFIG", { imageModel: event.target.value })}><ImageGeneratorOptions /></select></label>}</>
            ) : (
              <>
            <label>
              Game pack
              <select
                value={snapshot.gameLength}
                onChange={(event) =>
                  void act("SET_CONFIG", { gameLength: event.target.value })
                }
              >
                {isArchivedGamePack(snapshot.gameLength) && <option value={snapshot.gameLength} disabled>{ARCHIVED_GAME_PACK_TITLES[snapshot.gameLength]} · archived existing room</option>}
                <option value="bowl-of-fools">
                  Bowl of Fools · describe, perform, recall
                </option>
                <option value="royal-rumours">
                  Royal Rumours · AI picture telephone
                </option>
                <option value="king-mystery">
                  The Royal Frame-Up · bluff and investigate
                </option>
                <option value="pictures">
                  King Prompter · 2 canvases + final
                </option>
                <option value="comic">
                  Let&apos;s Make a Comic · 3 panels
                </option>
                <option value="standard">Legacy Standard · 7 rounds</option>
              </select>
            </label>
            {isArchivedGamePack(snapshot.gameLength) && <p className="start-hint">This archived room can continue its current game. New games from archived packs are unavailable.</p>}
            {!["pictures", "comic", "king-mystery", "royal-rumours"].includes(
              snapshot.gameLength,
            ) && (
              <label>
                Content
                <select
                  value={snapshot.contentMode}
                  onChange={(event) =>
                    void act("SET_CONFIG", { contentMode: event.target.value })
                  }
                >
                  <option value="party">Party</option>
                  <option value="family">Family</option>
                </select>
              </label>
            )}
            {!isBowlGame && <label>
              Image generator
              <select
                value={snapshot.imageModel}
                onChange={(event) =>
                  void act("SET_CONFIG", { imageModel: event.target.value })
                }
              >
                <ImageGeneratorOptions />
              </select>
              <small>
                ChatGPT Images uses low quality and OpenAI credits. Comics use
                earlier winning artwork with FLUX.2 or ChatGPT Images.
              </small>
            </label>}
            {snapshot.arcadeGameId === "sketch-relay" && <label>Game length<select aria-label="Sorcery game length" value={snapshot.sorceryLength??"long"} onChange={e=>void act("SET_CONFIG",{sorceryLength:e.target.value as "quick"|"long"})}><option value="quick">Quick Spell · 2 rounds</option><option value="long">Long Sorcery · 3 rounds</option></select></label>}
            <label className="toggle-setting">
              <input
                type="checkbox"
                checked={snapshot.timerAccessibility}
                onChange={(event) =>
                  void act("SET_CONFIG", {
                    timerAccessibility: event.target.checked,
                  })
                }
              />
              <span>Extended timers</span>
            </label>
              </>
            )}
          </div>
        )}
        {display && (
          <p className="secondary-display-note">
            This screen mirrors the main host. Keep the host desk on the other
            TV or computer for game controls.
          </p>
        )}
        {snapshot.gameLength === "birthday" &&
          !snapshot.birthdayPersonId &&
          players.length >= 2 && (
            <p className="vip-hint">
              Choose which phone belongs to{" "}
              {snapshot.birthdayName ?? "the birthday VIP"} before starting.
            </p>
          )}
        {!display && (
          <>
            {snapshot.gameLength === "arcade" && snapshot.arcadeGameId === "sketch-relay" && <><button type="button" className="sorcery-practice-link" onClick={() => setPracticeOpen(true)}>Fish practice &amp; settings</button><FullscreenDialog open={practiceOpen} onClose={() => setPracticeOpen(false)} title="The practice aquarium"><div className="sorcery-practice-screen">
              <h3>A little splash before the sorcery.</h3><p>Try drawing a fish, then watch it swim. Choose a peaceful aquarium or a cartoon shark showdown. This practice skips the main match and creates no scores.</p>
              <label>Drawing time<select aria-label="Fish drawing time" value={fishDrawingSeconds} onChange={event => setFishDrawingSeconds(Number(event.target.value))}>{[90,120,180,240,300,360].map(value => <option key={value} value={value}>{value === 90 ? "90 seconds" : `${value / 60} minutes${value === 240 ? " (default)" : ""}`}</option>)}</select></label><label>Fish test mode<select aria-label="Fish test mode" value={fishTestMode} onChange={(event) => setFishTestMode(event.target.value as "shark" | "peaceful")}><option value="shark">Shark showdown</option><option value="peaceful">Peaceful tank</option></select></label>
              <button className="button" type="button" disabled={fishTestSeatCount < 3 || activeHumanCount < 1} onClick={() => void act("START_FISH_TEST", { mode: fishTestMode, drawingSeconds: fishDrawingSeconds })}>
                Test fish drawing (temporary)
              </button>
              {(fishTestSeatCount < 3 || activeHumanCount < 1) && <small>At least three active seats, including one human, are required. Free practice bots count.</small>}
            </div></FullscreenDialog></>}
            <button
              className="button button-primary start-button"
              disabled={
                isArchivedGamePack(snapshot.gameLength) || (snapshot.soloMode && snapshot.gameLength === "arcade") || !bowlReady || activePlayerCount < minimumPlayers
              }
              onClick={startGame}
            >
              {isArchivedGamePack(snapshot.gameLength) ? "Archived game unavailable" : snapshot.soloMode && snapshot.gameLength === "arcade" ? "Fish test only" : <>Start the game <span aria-hidden="true">→</span></>}
            </button>
            {snapshot.soloMode && snapshot.gameLength === "arcade" ? <p className="start-hint">This solo Sketch &amp; Sorcery room is limited to the temporary fish drawing test.</p> : isArchivedGamePack(snapshot.gameLength) ? (
              <p className="start-hint">This archived room can finish its current game, but cannot start another one.</p>
            ) : classicHasBots ? (
              <p className="start-hint">Classic needs human players only. Remove the local bots in host controls before starting.</p>
            ) : isBowlGame && !bowlReady ? (
              <p className="start-hint">{isClassicBowl ? "Classic Bowl needs four human players and at least two on each team." : bowlPlayers.length < 4 ? "Bowl of Fools needs four players total. Local bots count; turn on bot seats or invite more players." : "Bowl of Fools needs at least two active players on each team."}</p>
            ) : activePlayerCount < minimumPlayers && (
              <p className="start-hint">
                {snapshot.gameLength === "arcade"
                  ? `${ARCADE_GAMES.find((game) => game.id === snapshot.arcadeGameId)?.title ?? "This Arcade game"} needs ${minimumPlayers} players. Invite ${minimumPlayers - activePlayerCount} more.`
                  : snapshot.gameLength === "royal-rumours"
                    ? "Royal Rumours needs three players so every whisper can be passed."
                    : snapshot.gameLength === "king-mystery"
                      ? "This mystery needs three players. Invite friends or add bots."
                      : "Invite one more player or add a bot to start."}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function FoolHostStage({ snapshot, remaining, act, readOnly }: { snapshot: HostScreenSnapshot; remaining: number | null; act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>; readOnly: boolean }) {
  const bowl = snapshot.foolBowl;
  const guessKey = `${snapshot.roundId}:${bowl?.gameRound}:${bowl?.poolRemaining}:${bowl?.passUsed}`;
  const [guessInput, setGuessInput] = useState({ key: guessKey, value: "" });
  const botGuess = guessInput.key === guessKey ? guessInput.value : "";
  if (!bowl) return null;
  const playerName = (id: string | null) => snapshot.players.find((player) => player.id === id)?.nickname ?? "The next fool";
  const roundNames = ["", "Speak, Fool!", bowl.performance === "DRAWING" ? "Draw, Fool!" : "Perform, Fool!", "One Word, Fool!"];
  if (snapshot.phase === "INTRO") return <section className="host-stage fool-stage fool-tutorial"><div className="stage-meta"><span>THE ROYAL PIGEON PRESENTS</span><PhasePill phase={snapshot.phase} /></div><div className="round-intro-card"><span className="rewind-seal" aria-hidden="true">♜</span><p>The King&apos;s ceremonial bowl is full of nonsense.</p><h1>Bowl of Fools</h1><small>Write anonymous scrolls, then help your team guess the very same bowl three different ways. Authors are never revealed.</small><div className="mystery-rule-row"><span><b>1</b> describe it</span><span><b>2</b> {bowl.performance === "DRAWING" ? "draw it" : "act it"}</span><span><b>3</b> say one word</span></div><div className="phone-task-callout">Each turn lasts one minute. The clue giver taps Correct, may Pass once, and the host can undo an honor-system mistake. If the Crown is tied, one scroll decides everything.</div></div></section>;
  if (snapshot.phase === "FOOL_TEAM_SETUP") return <section className="host-stage fool-stage"><div className="round-intro-card"><p>Teams have been shuffled</p><h1>Find your side and ready up</h1><div className="mystery-rule-row">{(["BELLS", "MOTLEY"] as const).map((team) => <span key={team}><b>{team === "BELLS" ? "♢" : "✦"}</b> Team {team === "BELLS" ? "Bells" : "Motley"}<small>{bowl.turnOrder[team].map((id) => snapshot.players.find((player) => player.id === id)?.nickname).filter(Boolean).join(" · ")}</small></span>)}</div><div className="phone-task-callout">{bowl.readyPlayerIds.length}/{snapshot.players.filter((player) => player.role === "player").length} ready. The game begins automatically when every phone is ready.</div></div></section>;
  if (snapshot.phase === "ROUND_INTRO") return <section className="host-stage fool-stage"><div className="round-intro-card"><p>First, feed the bowl.</p><h1>Write {bowl.scrollsPerPlayer} secret scrolls</h1><small>One to five words each. Memorable people, places, things, titles, and ridiculous phrases work best.</small></div></section>;
  if (snapshot.phase === "FOOL_WRITING") return <section className="host-stage fool-stage"><div className="stage-meta"><span>FILL THE BOWL</span><strong>{bowl.submittedPlayerIds.length}/{snapshot.players.filter((player) => player.role === "player" && player.active).length}</strong></div><div className="round-intro-card"><span className="rewind-seal" aria-hidden="true">⌄</span><h1>Fold them. Hide them. Regret them.</h1><small>Completed scrolls disappear into the bowl. Not even the King sees who wrote what.</small></div></section>;
  if (snapshot.phase === "FOOL_ROUND_REVEAL") return <section className="host-stage fool-stage"><div className="round-intro-card"><p>Round {bowl.gameRound} begins</p><h1>{roundNames[bowl.gameRound]}</h1><small>The same {bowl.totalScrolls} scrolls return. {playerName(bowl.clueGiverId)} will lead Team {bowl.activeTeam === "BELLS" ? "Bells" : "Motley"}.</small></div></section>;
  const active = ["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(snapshot.phase);
  const botClueGiver = snapshot.players.some((player) => player.id === bowl.clueGiverId && player.bot);
  return <section className="host-stage fool-stage"><div className="stage-meta"><span>{bowl.suddenDeath ? "ONE-SCROLL SUDDEN DEATH" : `ROUND ${bowl.gameRound} · ${roundNames[bowl.gameRound]}`}</span><PhasePill phase={snapshot.phase} /></div><div className="fool-scoreboard"><div className={bowl.activeTeam === "BELLS" ? "active" : ""}><span>TEAM BELLS</span><strong>{bowl.teamScores.BELLS}</strong></div><div className="fool-bowl-icon" aria-label={`${bowl.poolRemaining} scrolls remain`}>♨<small>{bowl.poolRemaining}</small></div><div className={bowl.activeTeam === "MOTLEY" ? "active" : ""}><span>TEAM MOTLEY</span><strong>{bowl.teamScores.MOTLEY}</strong></div></div>{active && <div className="fool-turn-card"><p>{playerName(bowl.clueGiverId)} is the fool</p><h1>{bowl.gameRound === 1 ? "Describe the secret scroll" : bowl.gameRound === 2 ? bowl.performance === "DRAWING" ? "Draw it. No letters or numbers." : "Act it out. No words or sounds." : bowl.oneWord ? `“${bowl.oneWord}”` : "Waiting for one clue word…"}</h1>{bowl.spokenClue && <p className="fool-public-clue"><strong>Bot clue:</strong> {bowl.spokenClue}</p>}{bowl.performanceCue && <p className="fool-public-clue"><strong>Bot practice cue:</strong> {bowl.performanceCue}</p>}{bowl.gameRound === 2 && bowl.performance === "DRAWING" && <svg className="fool-canvas" viewBox="0 0 1000 560" role="img" aria-label="The current clue drawing">{bowl.strokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x * 1000},${point.y * 560}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />)}</svg>}{botClueGiver && <div className="phone-task-callout"><strong>Bot turn:</strong> Enter your team&apos;s spoken guess. Correct answers must match the scroll.</div>}<div className="fool-turn-meta"><strong>{remaining === null ? "—" : Math.max(0, Math.ceil(remaining / 1000))}</strong><span>{bowl.passUsed ? "Pass used" : "One pass available"}</span></div>{botClueGiver && !readOnly && <div className="fool-answer-buttons"><form className="fool-bot-judge-form" onSubmit={(event) => { event.preventDefault(); void act("JUDGE_BOT_FOOL", { decision: "correct", guess: botGuess }); }}><label>Team&apos;s guess<input aria-label="Team's guess" maxLength={100} value={botGuess} onChange={(event) => setGuessInput({ key: guessKey, value: event.target.value })} /></label><button className="button button-primary fool-correct" disabled={!botGuess.trim()}>Judge correct</button></form><button className="button button-secondary" disabled={bowl.passUsed || bowl.poolRemaining < 2 || snapshot.phase === "FOOL_SUDDEN_DEATH"} onClick={() => void act("JUDGE_BOT_FOOL", { decision: "pass" })}>Judge pass</button></div>}</div>}</section>;
}

function HostStage({
  snapshot,
  remaining,
  act,
  readOnly,
}: {
  snapshot: HostScreenSnapshot;
  remaining: number | null;
  act: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void>;
  readOnly: boolean;
}) {
  const players = snapshot.players.filter(
    (player) => player.role === "player" && player.active,
  );
  const answered = snapshot.submittedPlayerIds.length;
  const voted = snapshot.respondedVoterIds.filter((id) =>
    players.some((player) => player.id === id),
  ).length;
  const timerSeconds = remaining === null ? null : Math.ceil(remaining / 1000);
  const intro = ["INTRO", "ROUND_INTRO"].includes(snapshot.phase);
  const reveal = ["REVEAL", "ROUND_RESULTS"].includes(snapshot.phase);
  const answerCards = snapshot.answers;
  const imageUrl =
    snapshot.image?.status === "READY" && snapshot.image.assetId
      ? `/api/rooms/${snapshot.code}/media/${snapshot.image.assetId}`
      : null;
  const roundResults = snapshot.results as {
    monsterMvpIds?: string[];
    rememberedMemoryIds?: string[];
    memoryKind?: string;
    kind?: string;
    correctChoiceId?: string;
    correctPlayerIds?: string[];
    options?: Array<{ id: string; label: string }>;
    birthdayName?: string;
    featuredAnswerId?: string;
    correctVoterIds?: string[];
    selectedAnswerId?: string;
    selectedFinalistAnswerId?: string;
  } | null;
  const remembering =
    reveal && Boolean(roundResults?.rememberedMemoryIds?.length);
  const callbackIntro =
    intro && ["CALLBACK", "THE_REMIX"].includes(snapshot.roundKind ?? "");
  const makeItRealReveal =
    snapshot.roundKind === "MAKE_IT_REAL" && snapshot.phase === "IMAGE_REVEAL";
  const birthdayMode = snapshot.gameLength === "birthday";
  if (snapshot.gameLength === "bowl-of-fools") return <FoolHostStage snapshot={snapshot} remaining={remaining} act={act} readOnly={readOnly} />;
  if (snapshot.phase === "INTRO" && snapshot.gameLength === "royal-war-room") {
    const defending = snapshot.warRoom?.campaign === "DEFEND";
    return (
      <section className="host-stage war-room-stage war-tutorial">
        <div className="stage-meta">
          <span>ROYAL WAR ROOM TUTORIAL</span>
          <PhasePill phase={snapshot.phase} />
        </div>
        <div className="round-intro-card">
          <span className="rewind-seal" aria-hidden="true">
            {defending ? "♜" : "⚔"}
          </span>
          <p>
            {defending
              ? "The enemy is at the gate"
              : "The neighboring castle looks conquerable"}
          </p>
          <h1>{defending ? "Defend the Castle" : "Plan the Invasion"}</h1>
          <small>
            Everyone secretly ranks six possible orders. The room&apos;s
            combined ranking becomes the battle plan. Two rival councils take
            turns rebuilding it, one position at a time.
          </small>
          <div className="mystery-rule-row">
            <span>
              <b>1</b> rank all six orders
            </span>
            <span>
              <b>2</b> commanders place them
            </span>
            <span>
              <b>3</b> earlier/later clues guide you
            </span>
          </div>
          <div className="phone-task-callout">
            Each council has one Spyglass to learn whether an order belongs in
            the top or bottom half. Correct placements win banners for the whole
            team. Play Again always switches Attack ↔ Defend.
          </div>
        </div>
      </section>
    );
  }
  if (
    snapshot.phase === "ROUND_INTRO" &&
    snapshot.gameLength === "royal-war-room"
  )
    return (
      <section
        className={`host-stage war-room-stage war-${snapshot.warRoom?.campaign.toLowerCase() ?? "attack"}`}
      >
        <div className="stage-meta">
          <span>
            {snapshot.warRoom?.campaign === "ATTACK" ? "INVASION" : "DEFENCE"} ·
            CHAPTER {snapshot.roundNumber} / {snapshot.roundTotal}
          </span>
          <PhasePill phase={snapshot.phase} />
        </div>
        <div className="round-intro-card">
          <span className="rewind-seal" aria-hidden="true">
            {snapshot.roundNumber}
          </span>
          <p>
            {snapshot.roundNumber === 1
              ? "Opening orders"
              : snapshot.roundNumber === 2
                ? "The main campaign"
                : "Battle for the Crown"}
          </p>
          <h1>{snapshot.prompt}</h1>
          <small>{snapshot.instruction}</small>
        </div>
      </section>
    );
  if (snapshot.phase === "INTRO" && snapshot.gameLength === "royal-rumours")
    return (
      <section className="host-stage picture-stage king-prompter-stage rumour-stage rumour-tutorial">
        <div className="stage-meta">
          <span>ROYAL RUMOURS TUTORIAL</span>
          <PhasePill phase={snapshot.phase} />
        </div>
        <div className="round-intro-card">
          <span className="rewind-seal" aria-hidden="true">
            ☞
          </span>
          <p>One whisper. Two AI paintings. Zero reliable witnesses.</p>
          <h1>Royal Rumours</h1>
          <small>
            Write a ridiculous rumour. AI turns it into a picture and secretly
            passes that picture to another player. They guess what it
            means—without seeing your words—then AI paints their guess. Finally,
            the whole room watches every story mutate.
          </small>
          <div className="mystery-rule-row">
            <span>
              <b>1</b> write a rumour
            </span>
            <span>
              <b>2</b> interpret a picture
            </span>
            <span>
              <b>3</b> reveal and vote
            </span>
          </div>
          <div className="phone-task-callout">
            Vote for the funniest transformation. The interpreter earns 500 per
            vote; the player who started that rumour earns 250.
          </div>
        </div>
      </section>
    );
  if (snapshot.phase === "INTRO" && snapshot.gameLength === "king-mystery")
    return (
      <section className="host-stage picture-stage king-prompter-stage mystery-stage mystery-tutorial">
        <div className="stage-meta">
          <span>ROYAL EVIDENCE TUTORIAL</span>
          <PhasePill phase={snapshot.phase} />
        </div>
        <div className="round-intro-card">
          <span className="rewind-seal" aria-hidden="true">
            ⚖
          </span>
          <p>The pigeon dropped every case file</p>
          <h1>The Royal Frame-Up</h1>
          <small>
            Secretly file one ridiculous castle incident. The enchanted evidence
            frames reconstruct every report as a painting. For each case, the
            original witness sits out while everyone else invents a believable
            cover story—then the investigators choose the genuine report.
          </small>
          <div className="mystery-rule-row">
            <span>
              <b>+500</b> find the true report
            </span>
            <span>
              <b>+500</b> fool someone · 750 when sealed
            </span>
            <span>
              <b>+250</b> per correct read of your evidence, up to 750
            </span>
          </div>
          <div className="phone-task-callout">
            Each player has one secret Royal Seal for the entire match. Stamp
            your strongest cover story for a 250-point bonus per person fooled.
            Your own cover story never appears on your ballot.
          </div>
        </div>
      </section>
    );
  if (snapshot.phase === "INTRO" && snapshot.gameLength === "pictures")
    return (
      <section className="host-stage picture-stage king-prompter-stage">
        <div className="stage-meta">
          <span>ROYAL SQUIRE TUTORIAL</span>
          <PhasePill phase={snapshot.phase} />
        </div>
        <div className="round-intro-card">
          <span className="rewind-seal" aria-hidden="true">
            ♛
          </span>
          <p>Hear ye, artists</p>
          <h1>Impress the King. Blame the Squire.</h1>
          <small>
            The King requests a painting. On your phone, describe a funny
            picture in fewer than 20 words. Your highly trained, completely
            human Royal Squire paints exactly what you asked for. Then everyone
            chooses one favorite image—never their own. Canvas Two is chosen by
            early finishers. The final round restores one gloriously ruined
            royal portrait together.
          </small>
          <div className="phone-task-callout">
            The pigeon only presents, reacts, and questions the quality of this
            entirely organic human artwork. The host may skip this tutorial.
          </div>
        </div>
      </section>
    );
  if (
    (snapshot.phase === "IMAGE_REVEAL" ||
      snapshot.phase === "RUMOUR_IMAGE_REVEAL") &&
    snapshot.imageJobsPending
  )
    return (
      <section className="host-stage picture-stage king-prompter-stage image-confirmation-stage">
        <div className="stage-meta">
          <span>
            {snapshot.gameLength === "king-mystery"
              ? "ROYAL EVIDENCE VAULT"
              : snapshot.gameLength === "royal-rumours"
                ? "ROYAL RUMOUR PRESS"
                : "ROYAL WORKSHOP"}
          </span>
          <PhasePill phase={snapshot.phase} />
        </div>
        <div className="image-confirmation-card">
          <div className="loader-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>
            {snapshot.gameLength === "king-mystery"
              ? "The enchanted frames are reconstructing every incident"
              : snapshot.gameLength === "royal-rumours"
                ? snapshot.phase === "RUMOUR_IMAGE_REVEAL"
                  ? "AI is painting what everyone thought they saw"
                  : "AI is illustrating every secret whisper"
                : "The Squires are checking every canvas"}
          </p>
          <h1>No painting is revealed until it is ready.</h1>
          <small>
            If a model fails, the game automatically tries the next one.
          </small>
        </div>
      </section>
    );
  if (snapshot.roundKind === "KING_REQUEST_MYSTERY" && snapshot.mystery)
    return <HostMysteryStage snapshot={snapshot} remaining={remaining} />;
  if (
    snapshot.roundKind === "ROYAL_RUMOURS" &&
    [
      "RUMOUR_GUESSING",
      "RUMOUR_IMAGE_REVEAL",
      "RUMOUR_REVEAL",
      "RUMOUR_VOTING",
      "VOTE_LOCK",
    ].includes(snapshot.phase)
  )
    return <HostRoyalRumoursStage snapshot={snapshot} remaining={remaining} />;
  if (
    snapshot.roundKind === "ROYAL_WAR_ROOM" &&
    [
      "WAR_RANKING",
      "WAR_COUNCIL",
      "WAR_TURN_REVEAL",
      "WAR_ROUND_REVEAL",
    ].includes(snapshot.phase)
  )
    return <HostWarRoomStage snapshot={snapshot} remaining={remaining} />;
  return (
    <section
      className={`host-stage ${["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL", "COMIC_FRAME", "KING_REQUEST_MYSTERY", "ROYAL_RUMOURS"].includes(snapshot.roundKind ?? "") ? "picture-stage king-prompter-stage" : ""} ${snapshot.roundKind === "COMIC_FRAME" ? "comic-stage" : ""}`}
    >
      <div className="stage-meta">
        <span>
          ROUND {snapshot.roundNumber} / {snapshot.roundTotal}
        </span>
        <PhasePill phase={snapshot.phase} />
      </div>
      {intro ? (
        <div className="round-intro-card">
          <span className="rewind-seal" aria-hidden="true">
            {snapshot.roundKind === "KING_PROMPTER_FINAL"
              ? <Crown state="brand" />
              : snapshot.roundKind === "COMIC_FRAME"
                ? "▣"
                : "↶"}
          </span>
          <p>
            {["THE_REMIX", "KING_PROMPTER_FINAL"].includes(
              snapshot.roundKind ?? "",
            ) ||
            (snapshot.roundKind === "COMIC_FRAME" && snapshot.roundNumber === 3)
              ? "Final round"
              : "Coming up"}
          </p>
          <h1>{roundTitle(snapshot.roundKind, birthdayMode)}</h1>
          <small>{roundTagline(snapshot.roundKind, birthdayMode)}</small>
          {snapshot.roundKind === "COMIC_FRAME" && (
            <ComicStrip snapshot={snapshot} compact />
          )}
          {callbackIntro && (
            <div className="callback-rewind" aria-label="Earlier room memories">
              {snapshot.memoryTrail
                .slice(0, snapshot.roundKind === "THE_REMIX" ? 4 : 3)
                .map((memory) => (
                  <blockquote key={memory.id}>
                    <span>{memory.kind}</span>“{memory.text}”
                  </blockquote>
                ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {makeItRealReveal && (
            <div className="earlier-tonight">
              <span>Earlier tonight…</span>
              <h2>
                {snapshot.image?.conceptTitle ?? "The room invented something"}
              </h2>
              <strong>You made this.</strong>
            </div>
          )}
          {!makeItRealReveal && (
            <div className="prompt-block">
              <p>{roundTitle(snapshot.roundKind, birthdayMode)}</p>
              <h1>{snapshot.prompt ?? "Get ready…"}</h1>
              {snapshot.instruction && (
                <div className="catch-stamp">
                  <span>
                    {snapshot.roundKind === "COMIC_FRAME"
                      ? "PANEL GUIDE"
                      : "THE CATCH"}
                  </span>
                  {snapshot.instruction}
                </div>
              )}
            </div>
          )}
          {snapshot.roundKind === "COMIC_FRAME" && (
            <ComicStrip snapshot={snapshot} compact />
          )}
          {snapshot.roundKind === "KING_PROMPTER_FINAL" &&
            snapshot.restoration && (
              <RestorationPortrait
                code={snapshot.code}
                restoration={snapshot.restoration}
              />
            )}
          {timerSeconds !== null && <StageTimer seconds={timerSeconds} />}
          {imageUrl ? (
            <div className="game-image">
              <Image
                src={imageUrl}
                width={2048}
                height={1152}
                unoptimized
                alt={snapshot.image?.conceptTitle ?? "Generated room artwork"}
              />
              <div>
                <strong>{snapshot.image?.conceptTitle}</strong>
                <span>{snapshot.image?.conceptCaption}</span>
              </div>
            </div>
          ) : snapshot.image &&
            [
              "IMAGE_REVEAL",
              "VOTING",
              "VOTE_LOCK",
              "REVEAL",
              "ROUND_RESULTS",
            ].includes(snapshot.phase) ? (
            <div className="concept-card">
              <span>ART DEPARTMENT CONCEPT CARD</span>
              <strong>{snapshot.image.conceptTitle}</strong>
              <p>{snapshot.image.conceptCaption}</p>
              <div className="concept-doodle" aria-hidden="true">
                ✦ ↶ ✦
              </div>
            </div>
          ) : null}
          {answerCards.length > 0 && (
            <div
              className={`host-answer-grid ${reveal ? "answers-revealed" : ""} ${answerCards.some((answer) => answer.image) ? "king-gallery-grid" : ""}`}
            >
              {answerCards.map((answer, index) => {
                const author = snapshot.players.find(
                  (player) => player.id === answer.authorId,
                );
                const galleryUrl =
                  answer.image?.status === "READY" && answer.image.assetId
                    ? `/api/rooms/${snapshot.code}/media/${answer.image.assetId}`
                    : null;
                const kingWinnerIds = new Set(
                  roundResults?.kind === "king_final"
                    ? ((roundResults as { finalWinningAnswerIds?: string[] })
                        .finalWinningAnswerIds ?? [])
                    : ((
                        roundResults as {
                          imageWinningAnswerIds?: string[];
                        } | null
                      )?.imageWinningAnswerIds ?? []),
                );
                const kingWinner = reveal && kingWinnerIds.has(answer.id);
                const selectedComicPanel =
                  snapshot.roundKind === "COMIC_FRAME" &&
                  roundResults?.selectedAnswerId === answer.id;
                const selectedKingFinalist =
                  snapshot.roundKind === "PROMPT_AND_CIRCUMSTANCE" &&
                  roundResults?.selectedFinalistAnswerId === answer.id;
                return (
                  <article
                    className={`host-answer answer-color-${index % 6} ${kingWinner ? "picture-correct" : ""} ${answer.image ? "king-gallery-card" : ""}`}
                    key={answer.id}
                  >
                    {kingWinner && (
                      <span className="correct-ribbon">
                        {snapshot.roundKind === "KING_PROMPTER_FINAL"
                          ? "CROWNED"
                          : selectedComicPanel
                            ? "FRAME LOCKED"
                            : snapshot.roundKind === "COMIC_FRAME"
                              ? "TIED WINNER"
                              : selectedKingFinalist
                                ? "ADVANCES"
                                : "TIED WINNER"}
                      </span>
                    )}
                    {galleryUrl ? (
                      <Image
                        src={galleryUrl}
                        width={1024}
                        height={1024}
                        unoptimized
                        alt={`Generated entry ${index + 1}`}
                      />
                    ) : answer.image ? (
                      <div className="concept-card king-concept">
                        <span>
                          {answer.image.status === "QUEUED" ||
                          answer.image.status === "GENERATING"
                            ? "FINISHING CANVAS"
                            : "CONCEPT CARD"}
                        </span>
                        <strong>{answer.image.conceptTitle}</strong>
                        <div className="concept-doodle" aria-hidden="true">
                          {snapshot.roundKind === "COMIC_FRAME"
                            ? "▣ ✦ ▣"
                            : <><Crown state="candidate" /> ✦ <Crown state="candidate" /></>}
                        </div>
                      </div>
                    ) : (
                      <blockquote>{answer.text}</blockquote>
                    )}
                    {answer.image && (
                      <p className="gallery-prompt-caption">{answer.text}</p>
                    )}
                    {reveal && (
                      <footer>
                        {author && (
                          <>
                            <Avatar
                              index={author.avatar}
                              color={author.color}
                              config={author.avatarConfig}
                              size="small"
                            />
                            <strong>{author.nickname}</strong>
                          </>
                        )}
                        <span>
                          {answer.image
                            ? answer.text
                            : `${answer.applause} applause${answer.audienceFavorites > 0 ? ` · ♥ ${answer.audienceFavorites}` : ""}`}
                        </span>
                      </footer>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          {reveal && roundResults?.kind === "birthday_bets" && (
            <div className="birthday-answer-reveal">
              <p>{roundResults.birthdayName} chose…</p>
              <h2>
                {roundResults.options?.find(
                  (choice) => choice.id === roundResults.correctChoiceId,
                )?.label ?? "A mystery option"}
              </h2>
              <div>
                {roundResults.correctPlayerIds?.length ? (
                  <>
                    <strong>Mind readers:</strong>{" "}
                    {roundResults.correctPlayerIds
                      .map(
                        (id) =>
                          snapshot.players.find((player) => player.id === id)
                            ?.nickname,
                      )
                      .filter(Boolean)
                      .join(", ")}
                  </>
                ) : (
                  <strong>Nobody saw that coming.</strong>
                )}
              </div>
            </div>
          )}
          {reveal &&
            snapshot.roundKind === "MONSTER_FACTORY" &&
            roundResults?.monsterMvpIds && (
              <div className="monster-mvp">
                MONSTER MVP ·{" "}
                {roundResults.monsterMvpIds
                  .map(
                    (id) =>
                      snapshot.players.find((player) => player.id === id)
                        ?.nickname,
                  )
                  .filter(Boolean)
                  .join(" & ")}
              </div>
            )}
          {remembering && (
            <div className="memory-clue">
              <span aria-hidden="true">↶</span>
              <strong>Hmm… I&apos;ll remember that.</strong>
            </div>
          )}
          {!reveal &&
            [
              "ANSWERING",
              "ANSWER_LOCK",
              "FINAL_ANSWERING",
              "ENCORE_CONTRIBUTING",
              "ENCORE_FOLLOWUP",
            ].includes(snapshot.phase) && (
              <ResponseMeter
                count={answered}
                total={players.length}
                label="answers locked"
                players={players}
                responded={new Set(snapshot.submittedPlayerIds)}
              />
            )}
          {!reveal &&
            ["VOTING", "VOTE_LOCK", "FINAL_VOTING"].includes(
              snapshot.phase,
            ) && (
              <ResponseMeter
                count={voted}
                total={players.length}
                label={
                  snapshot.phase === "FINAL_VOTING" &&
                  snapshot.roundKind === "KING_PROMPTER_FINAL"
                    ? "crown ballots locked"
                    : snapshot.phase === "FINAL_VOTING"
                      ? "image rankings locked"
                      : "prompt rankings locked"
                }
                players={players}
                responded={new Set(snapshot.respondedVoterIds)}
              />
            )}
          {snapshot.phase === "PERSONAL_CHOICE" &&
          snapshot.roundKind === "BIRTHDAY_BETS" ? (
            <ResponseMeter
              count={answered}
              total={players.length}
              label="choices locked"
              players={players}
              responded={new Set(snapshot.submittedPlayerIds)}
            />
          ) : snapshot.phase === "AUTHOR_GUESSING" &&
            ["PROMPT_AND_CIRCUMSTANCE", "COMIC_FRAME"].includes(
              snapshot.roundKind ?? "",
            ) ? (
            <>
              <p className="phone-task-callout">
                Who wrote what? Match every prompt on your phone while the
                images develop.
              </p>
              <ResponseMeter
                count={answered}
                total={players.length}
                label="matches locked"
                players={players}
                responded={new Set(snapshot.submittedPlayerIds)}
              />
            </>
          ) : (
            [
              "PERSONAL_CHOICE",
              "ROOM_PREDICTION",
              "AUTHOR_GUESSING",
              "FINAL_WAGER",
            ].includes(snapshot.phase) && (
              <p className="phone-task-callout">Check your phones.</p>
            )
          )}
          {reveal && <ScoreStrip snapshot={snapshot} />}
        </>
      )}
    </section>
  );
}

function HostWarRoomStage({
  snapshot,
  remaining,
}: {
  snapshot: HostScreenSnapshot;
  remaining: number | null;
}) {
  const war = snapshot.warRoom;
  if (!war) return null;
  const timerSeconds = remaining === null ? null : Math.ceil(remaining / 1000);
  const choiceById = new Map(
    war.choices.map((choice) => [choice.id, choice.label]),
  );
  const placedByRank = new Map(
    Object.entries(war.placements).map(([choiceId, rank]) => [rank, choiceId]),
  );
  const players = snapshot.players.filter(
    (player) => player.role === "player" && player.active,
  );
  const teamPlayers = (team: "LION" | "RAVEN") =>
    players.filter((player) => war.teams[player.id] === team);
  const lastChoice = war.lastMove?.choiceId
    ? choiceById.get(war.lastMove.choiceId)
    : null;
  return (
    <section
      className={`host-stage war-room-stage war-${war.campaign.toLowerCase()}`}
    >
      <div className="stage-meta">
        <span>
          {war.campaign === "ATTACK" ? "INVASION" : "DEFENCE"} · CHAPTER{" "}
          {snapshot.roundNumber} / {snapshot.roundTotal}
        </span>
        <PhasePill phase={snapshot.phase} />
      </div>
      <header className="war-heading">
        <div>
          <p>Royal War Room</p>
          <h1>{snapshot.prompt}</h1>
          <small>{snapshot.instruction}</small>
        </div>
        {timerSeconds !== null && (
          <div
            className={`war-timer ${timerSeconds <= 8 ? "timer-urgent" : ""}`}
          >
            {timerSeconds}
          </div>
        )}
      </header>
      <div className="war-team-strip">
        {(["LION", "RAVEN"] as const).map((team) => (
          <article
            className={`${war.activeTeam === team ? "active" : ""} team-${team.toLowerCase()}`}
            key={team}
          >
            <div>
              <span>{team === "LION" ? "♜" : "◆"}</span>
              <strong>{team} COUNCIL</strong>
              <b>{war.teamScores[team]} banners</b>
            </div>
            <div className="war-roster">
              {teamPlayers(team).map((player) => (
                <span title={player.nickname} key={player.id}>
                  <Avatar
                    playerId={player.id} index={player.avatar}
                    color={player.color}
                    config={player.avatarConfig}
                    size="small"
                  />
                  {player.id === war.commanderId && <i>COMMANDER</i>}
                </span>
              ))}
            </div>
            <small>
              {war.scoutUsed[team] ? "Spyglass spent" : "Spyglass ready"}
            </small>
          </article>
        ))}
      </div>
      {snapshot.phase === "WAR_RANKING" ? (
        <div className="war-ranking-host">
          <h2>Every general is writing the battle plan.</h2>
          <p>
            Rank all six orders from first to last. The combined room opinion
            stays classified.
          </p>
          <ResponseMeter
            count={snapshot.submittedPlayerIds.length}
            total={players.length}
            label="plans sealed"
            players={players}
            responded={new Set(snapshot.submittedPlayerIds)}
          />
          <div className="war-order-cloud">
            {war.choices.map((choice) => (
              <span key={choice.id}>{choice.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="war-board-layout">
          <div className="war-order-bank">
            <h2>
              {snapshot.phase === "WAR_ROUND_REVEAL"
                ? "Declassified orders"
                : "Unplaced orders"}
            </h2>
            {war.choices
              .filter((choice) => !war.placements[choice.id])
              .map((choice) => (
                <div key={choice.id}>{choice.label}</div>
              ))}
            {war.choices.every((choice) =>
              Boolean(war.placements[choice.id]),
            ) && <p>Every target position is secure.</p>}
            <div className="war-clue-log">
              {war.clues.slice(-4).map((clue, index) => (
                <span key={`${clue.choiceId}:${index}`}>
                  {clue.scout ? "Spyglass" : `${clue.guessedRank}`} ·{" "}
                  {choiceById.get(clue.choiceId)} goes{" "}
                  {clue.direction.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
          <div className="war-rank-board">
            {[1, 2, 3, 4, 5, 6].map((rank) => {
              const choiceId =
                war.trueOrder?.[rank - 1] ?? placedByRank.get(rank);
              const target = war.targetRanks.includes(rank);
              return (
                <article
                  className={`${target ? "target" : "sealed"} ${choiceId ? "filled" : ""}`}
                  key={rank}
                >
                  <b>{rank}</b>
                  <div>
                    <small>
                      {rank === 1
                        ? "FIRST"
                        : rank === 6
                          ? "LAST"
                          : `POSITION ${rank}`}
                    </small>
                    <strong>
                      {choiceId
                        ? choiceById.get(choiceId)
                        : target
                          ? "OPEN POSITION"
                          : "CLASSIFIED"}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="war-turn-card">
            {snapshot.phase === "WAR_COUNCIL" ? (
              <>
                <p>{war.activeTeam} COUNCIL TURN</p>
                <h2>
                  {snapshot.players.find(
                    (player) => player.id === war.commanderId,
                  )?.nickname ?? "The commander"}
                </h2>
                <strong>Choose an order and its exact position.</strong>
                <small>
                  Turn {war.turnNumber + 1} of {war.maxTurns}
                </small>
              </>
            ) : snapshot.phase === "WAR_TURN_REVEAL" ? (
              <>
                <p>{war.lastMove?.team ?? "COUNCIL"} REPORT</p>
                <h2>
                  {war.lastMove?.skipped
                    ? "The council ran out of time."
                    : war.lastMove?.correct
                      ? "Order secured!"
                      : "The map says no."}
                </h2>
                <strong>
                  {lastChoice}
                  {war.lastMove?.guessedRank
                    ? ` at position ${war.lastMove.guessedRank}`
                    : ""}
                </strong>
                {!war.lastMove?.correct && !war.lastMove?.skipped && (
                  <small>
                    Move it {war.clues.at(-1)?.direction.toLowerCase()} in the
                    plan.
                  </small>
                )}
              </>
            ) : (
              <>
                <p>CHAPTER DECLASSIFIED</p>
                <h2>
                  {snapshot.roundNumber === snapshot.roundTotal
                    ? "The campaign is decided."
                    : "Study the true plan."}
                </h2>
                <strong>
                  {war.teamScores.LION === war.teamScores.RAVEN
                    ? "The councils are tied."
                    : `${war.teamScores.LION > war.teamScores.RAVEN ? "LION" : "RAVEN"} leads the campaign.`}
                </strong>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function HostRumourImage({
  snapshot,
  image,
  alt,
}: {
  snapshot: HostScreenSnapshot;
  image: {
    status: string;
    assetId?: string;
    conceptTitle?: string;
    conceptCaption?: string;
  };
  alt: string;
}) {
  const url =
    image.status === "READY" && image.assetId
      ? `/api/rooms/${snapshot.code}/media/${image.assetId}`
      : null;
  return url ? (
    <Image src={url} width={900} height={900} unoptimized alt={alt} />
  ) : (
    <div className="concept-card king-concept">
      <span>AI CONCEPT CARD</span>
      <strong>{image.conceptTitle ?? "Rumour painting"}</strong>
      <p>{image.conceptCaption}</p>
    </div>
  );
}

function HostRoyalRumoursStage({
  snapshot,
  remaining,
}: {
  snapshot: HostScreenSnapshot;
  remaining: number | null;
}) {
  const timerSeconds = remaining === null ? null : Math.ceil(remaining / 1000);
  const chains = snapshot.rumours?.chains ?? [];
  if (snapshot.phase === "RUMOUR_GUESSING")
    return (
      <section className="host-stage picture-stage king-prompter-stage rumour-stage">
        <div className="stage-meta">
          <span>THE WHISPER CHANGES HANDS</span>
          <PhasePill phase={snapshot.phase} />
        </div>
        <div className="round-intro-card">
          <span className="rewind-seal" aria-hidden="true">
            ☞
          </span>
          <p>Every phone received somebody else&apos;s AI painting</p>
          <h1>Describe what you think you see.</h1>
          <small>
            The original words and authors stay hidden. No explaining,
            correcting, or asking what that object was supposed to be.
          </small>
          <div className="phone-task-callout">
            {snapshot.submittedPlayerIds.length}/
            {
              snapshot.players.filter(
                (player) => player.role === "player" && player.active,
              ).length
            }{" "}
            interpretations passed on
          </div>
        </div>
        {timerSeconds !== null && <StageTimer seconds={timerSeconds} />}
      </section>
    );
  if (snapshot.phase === "RUMOUR_IMAGE_REVEAL")
    return (
      <section className="host-stage picture-stage king-prompter-stage image-confirmation-stage">
        <div className="stage-meta">
          <span>ROYAL RUMOUR PRESS</span>
          <PhasePill phase={snapshot.phase} />
        </div>
        <div className="image-confirmation-card">
          <div className="loader-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>AI is illustrating every interpretation</p>
          <h1>The second telling is becoming a picture.</h1>
        </div>
      </section>
    );
  if (snapshot.phase === "RUMOUR_REVEAL") {
    const chain = chains[0];
    const starter = chain
      ? snapshot.players.find((player) => player.id === chain.originalAuthorId)
      : null;
    const interpreter = chain
      ? snapshot.players.find((player) => player.id === chain.guessAuthorId)
      : null;
    return (
      <section className="host-stage picture-stage king-prompter-stage rumour-stage rumour-chain-stage">
        <div className="stage-meta">
          <span>
            RUMOUR {(snapshot.rumours?.revealIndex ?? 0) + 1} /{" "}
            {snapshot.rumours?.totalChains ?? 0}
          </span>
          <PhasePill phase={snapshot.phase} />
        </div>
        {chain && (
          <div className="host-rumour-chain">
            <article>
              <span>ORIGINAL WHISPER · {starter?.nickname ?? "?"}</span>
              <blockquote>“{chain.originalText}”</blockquote>
            </article>
            <article>
              <span>AI PICTURED IT</span>
              <HostRumourImage
                snapshot={snapshot}
                image={chain.firstImage}
                alt="The first AI rumour painting"
              />
            </article>
            <article>
              <span>{interpreter?.nickname ?? "Someone"} THOUGHT IT MEANT</span>
              <blockquote>“{chain.guessText}”</blockquote>
            </article>
            <article>
              <span>AI PICTURED THAT</span>
              <HostRumourImage
                snapshot={snapshot}
                image={chain.secondImage}
                alt="The retold AI rumour painting"
              />
            </article>
          </div>
        )}
      </section>
    );
  }
  return (
    <section className="host-stage picture-stage king-prompter-stage rumour-stage rumour-voting-stage">
      <div className="stage-meta">
        <span>THE COMPLETE RUMOUR MILL</span>
        <PhasePill phase={snapshot.phase} />
      </div>
      <div className="rumour-chain-grid">
        {chains.map((chain, index) => (
          <article
            className={chain.winner ? "rumour-chain-winner" : ""}
            key={chain.sourceAnswerId}
          >
            <span>
              CHAIN {index + 1}
              {chain.winner ? " · CROWNED" : ""}
            </span>
            <blockquote>“{chain.originalText}”</blockquote>
            <b>became</b>
            <p>“{chain.guessText}”</p>
            {chain.winner && (
              <strong>
                {chain.votes} vote{chain.votes === 1 ? "" : "s"}
              </strong>
            )}
          </article>
        ))}
      </div>
      <div className="phone-task-callout">
        Choose the funniest transformation on your phone. You cannot vote for a
        chain you helped create.
      </div>
      {timerSeconds !== null && snapshot.phase === "RUMOUR_VOTING" && <StageTimer seconds={timerSeconds} />}
    </section>
  );
}

function HostMysteryStage({
  snapshot,
  remaining,
}: {
  snapshot: HostScreenSnapshot;
  remaining: number | null;
}) {
  const mystery = snapshot.mystery;
  if (!mystery) return null;
  const players = snapshot.players.filter(
    (player) => player.role === "player" && player.active,
  );
  const eligible = Math.max(0, players.length - 1);
  const timerSeconds = remaining === null ? null : Math.ceil(remaining / 1000);
  const imageUrl =
    mystery.featuredImage.status === "READY" && mystery.featuredImage.assetId
      ? `/api/rooms/${snapshot.code}/media/${mystery.featuredImage.assetId}`
      : null;
  const reveal = snapshot.phase === "MYSTERY_REVEAL" ? mystery.result : null;
  const originalAuthor = reveal
    ? snapshot.players.find((player) => player.id === reveal.originalAuthorId)
    : null;
  const voteCounts = Object.values(reveal?.votes ?? {}).reduce<
    Record<string, number>
  >((totals, choiceId) => {
    totals[choiceId] = (totals[choiceId] ?? 0) + 1;
    return totals;
  }, {});
  const phaseCopy =
    snapshot.phase === "MYSTERY_DECOYS"
      ? {
          label: "COVER STORY DESK",
          title: "What else could have caused this evidence?",
          note: "The original witness sits this one out. Everyone else files one believable false incident report.",
        }
      : snapshot.phase === "MYSTERY_VOTING"
        ? {
            label: "ROYAL INQUEST",
            title: "Which incident report is genuine?",
            note: "Every report is anonymous—and every Royal Seal remains secret until the reveal.",
          }
        : {
            label: "CASE CLOSED",
            title: "What really happened…",
            note: reveal?.originalRequest ?? "The evidence remains suspicious.",
          };
  return (
    <section
      className={`host-stage picture-stage king-prompter-stage mystery-stage phase-${snapshot.phase.toLowerCase().replaceAll("_", "-")}`}
    >
      <div className="stage-meta">
        <span>
          PAINTING {mystery.turnNumber} / {mystery.totalTurns}
        </span>
        <PhasePill phase={snapshot.phase} />
      </div>
      <div className="mystery-board">
        <div className="mystery-art-frame">
          {imageUrl ? (
            <Image
              src={imageUrl}
              width={1024}
              height={1024}
              unoptimized
              alt={`Evidence painting ${mystery.turnNumber}`}
            />
          ) : (
            <div className="concept-card king-concept">
              <span>ENCHANTED EVIDENCE FRAME</span>
              <strong>{mystery.featuredImage.conceptTitle}</strong>
              <p>{mystery.featuredImage.conceptCaption}</p>
              <div className="concept-doodle" aria-hidden="true">
                ⚖ ♛ ?
              </div>
            </div>
          )}
          <span className="frame-plate">
            EVIDENCE PAINTING · CASE #{mystery.turnNumber}
          </span>
        </div>
        <div className="mystery-evidence">
          <p className="eyebrow">{phaseCopy.label}</p>
          <h1>{phaseCopy.title}</h1>
          <p>{phaseCopy.note}</p>
          {snapshot.phase === "MYSTERY_DECOYS" && (
            <MysteryResponseMeter
              count={snapshot.submittedPlayerIds.length}
              total={eligible}
              label="cover stories filed"
            />
          )}
          {snapshot.phase === "MYSTERY_VOTING" && (
            <>
              <div className="mystery-request-grid">
                {mystery.options.map((option, index) => (
                  <article key={option.id}>
                    <span>EXHIBIT {String.fromCharCode(65 + index)}</span>
                    <blockquote>“{option.text}”</blockquote>
                  </article>
                ))}
              </div>
              <MysteryResponseMeter
                count={snapshot.respondedVoterIds.length}
                total={eligible}
                label="verdicts locked"
              />
            </>
          )}
          {reveal && (
            <>
              <div className="mystery-real-request">
                <span>THE GENUINE INCIDENT REPORT</span>
                <blockquote>“{reveal.originalRequest}”</blockquote>
                {originalAuthor && (
                  <div>
                    <Avatar
                      index={originalAuthor.avatar}
                      color={originalAuthor.color}
                      config={originalAuthor.avatarConfig}
                      size="small"
                    />
                    <strong>{originalAuthor.nickname}</strong>
                    <small>
                      original witness · {reveal.correctPlayerIds.length}{" "}
                      correct investigator
                      {reveal.correctPlayerIds.length === 1 ? "" : "s"}
                    </small>
                  </div>
                )}
              </div>
              <div className="mystery-request-grid mystery-results-grid">
                {mystery.options.map((option) => {
                  const authorId = reveal.choiceAuthors[option.id];
                  const author = authorId
                    ? snapshot.players.find((player) => player.id === authorId)
                    : originalAuthor;
                  const real = option.id === reveal.realChoiceId;
                  const fooled = reveal.fooledByChoice[option.id]?.length ?? 0;
                  const sealed = reveal.sealedChoiceIds.includes(option.id);
                  return (
                    <article
                      className={`${real ? "mystery-real-choice" : ""} ${sealed ? "mystery-sealed-choice" : ""}`}
                      key={option.id}
                    >
                      <span>
                        {real
                          ? "✓ TRUE REPORT"
                          : sealed
                            ? `♛ ROYAL SEAL · ${fooled} FOOLED`
                            : `COVER STORY · ${fooled} FOOLED`}
                      </span>
                      <blockquote>“{option.text}”</blockquote>
                      <footer>
                        {author && (
                          <>
                            <Avatar
                              index={author.avatar}
                              color={author.color}
                              config={author.avatarConfig}
                              size="small"
                            />
                            <strong>{author.nickname}</strong>
                          </>
                        )}
                        <b>
                          {voteCounts[option.id] ?? 0} vote
                          {(voteCounts[option.id] ?? 0) === 1 ? "" : "s"}
                        </b>
                      </footer>
                    </article>
                  );
                })}
              </div>
              <ScoreStrip snapshot={snapshot} />
            </>
          )}
        </div>
      </div>
      {timerSeconds !== null && snapshot.phase !== "MYSTERY_REVEAL" && <StageTimer seconds={timerSeconds} className="mystery-timer" />}
    </section>
  );
}

function MysteryResponseMeter({
  count,
  total,
  label,
}: {
  count: number;
  total: number;
  label: string;
}) {
  return <StageResponseMeter count={count} total={total} label={label} note="One original witness sits out this case." />;
}

function ImageGenerationNotice({
  notice,
}: {
  notice: HostScreenSnapshot["imageGenerationNotice"];
}) {
  if (!notice) return null;
  const labels = {
    "openai-low": "ChatGPT Images · Low",
    "flux-2-quality": "FLUX.2 Quality",
    "flux-2-fast": "FLUX.2 Fast",
    "flux-1-schnell": "FLUX.1 Schnell",
  };
  return (
    <div
      className={`image-generation-notice notice-${notice.kind.toLowerCase()}`}
      role="status"
    >
      <strong>
        {notice.reason === "ALLOWANCE_STOP"
          ? "Image generation stopped to protect the allowance."
          : notice.kind === "RETRYING"
          ? `${labels[notice.failedModel]} did not finish.`
          : "The Royal workshop hit a problem."}
      </strong>
      <span>
        {notice.reason === "ALLOWANCE_STOP"
          ? "No further OpenAI requests will be sent for this image. The game will keep moving."
          : notice.kind === "RETRYING" && notice.nextModel
          ? `Trying again with ${labels[notice.nextModel]}…`
          : "Image generation could not finish. A concept card will keep the game moving."}
      </span>
    </div>
  );
}

function ComicStrip({
  snapshot,
  compact = false,
}: {
  snapshot: HostScreenSnapshot;
  compact?: boolean;
}) {
  return (
    <div
      className={`comic-strip ${compact ? "comic-strip-compact" : ""}`}
      aria-label="The room's three-panel comic"
    >
      {[1, 2, 3].map((frameNumber) => {
        const frame = snapshot.comicFrames.find(
          (item) => item.frameNumber === frameNumber,
        );
        const imageUrl =
          frame?.image.status === "READY" && frame.image.assetId
            ? `/api/rooms/${snapshot.code}/media/${frame.image.assetId}`
            : null;
        const author = frame
          ? snapshot.players.find((player) => player.id === frame.authorId)
          : null;
        return (
          <article
            className={
              frame
                ? "comic-panel comic-panel-filled"
                : "comic-panel comic-panel-empty"
            }
            key={frameNumber}
          >
            <span className="comic-panel-number">{frameNumber}</span>
            {imageUrl ? (
              <Image
                src={imageUrl}
                width={1024}
                height={1024}
                unoptimized
                alt={`Winning comic panel ${frameNumber}`}
              />
            ) : frame ? (
              <div className="concept-card">
                <strong>Panel {frameNumber}</strong>
                <p>{frame.image.conceptCaption}</p>
              </div>
            ) : (
              <div className="comic-panel-placeholder">
                <b>
                  {frameNumber === 1
                    ? "SETUP"
                    : frameNumber === 2
                      ? "ESCALATION"
                      : "PUNCHLINE"}
                </b>
                <span>
                  {frameNumber < snapshot.roundNumber
                    ? "Choosing…"
                    : "Not drawn yet"}
                </span>
              </div>
            )}
            {frame && (
              <footer>
                <strong>{author?.nickname ?? "The room"}</strong>
                <span>{frame.prompt}</span>
              </footer>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ResponseMeter({
  count,
  total,
  label,
  players,
  responded,
}: {
  count: number;
  total: number;
  label: string;
  players: HostScreenSnapshot["players"];
  responded: Set<string>;
}) {
  return <StageResponseMeter count={count} total={total} label={label} players={players} responded={responded} />;
}

function ScoreStrip({ snapshot }: { snapshot: HostScreenSnapshot }) {
  return (
    <div className="score-strip">
      {[...snapshot.players]
        .filter((player) => player.role === "player")
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .map((player, index) => (
          <div key={player.id}>
            <span>{index + 1}</span>
            <Avatar
              playerId={player.id} index={player.avatar}
              color={player.color}
              config={player.avatarConfig}
              size="small"
            />
            <strong>
              {player.nickname}
              {player.bot ? " · BOT" : ""}
            </strong>
            <ScoreReveal value={player.score ?? 0} />
          </div>
        ))}
    </div>
  );
}

function HostResults({
  snapshot,
  act,
  readOnly = false,
}: {
  snapshot: HostScreenSnapshot;
  act: (
    type: HostAction["type"],
    payload?: Record<string, unknown>,
  ) => Promise<void>;
  readOnly?: boolean;
}) {
  const players = snapshot.players
    .filter((player) => player.role === "player")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const high = players[0]?.score ?? 0;
  const champions = players.filter((player) => player.score === high);
  const results = (snapshot.results ?? {}) as {
    awards?: Array<{ title: string; playerIds: string[]; caption: string }>;
    loreGallery?: {
      nodes: Array<{ id: string; kind: string; text: string }>;
      edges: Array<{
        id: string;
        fromLoreId: string;
        relation: string;
        toLoreId: string;
      }>;
    };
  };
  const gallery = results.loreGallery ?? { nodes: [], edges: [] };
  const imageUrl =
    snapshot.image?.status === "READY" && snapshot.image.assetId
      ? `/api/rooms/${snapshot.code}/media/${snapshot.image.assetId}`
      : null;
  const nodeKind = (id: string) =>
    gallery.nodes.find((node) => node.id === id)?.kind ?? "MEMORY";
  const birthday = snapshot.gameLength === "birthday";
  void readOnly;
  if (snapshot.gameLength === "bowl-of-fools" && snapshot.foolBowl) {
    const bowl = snapshot.foolBowl;
    const winner = bowl.winner ?? (bowl.teamScores.BELLS >= bowl.teamScores.MOTLEY ? "BELLS" : "MOTLEY");
    return <section className="results-stage fool-results"><div className="winner-burst" aria-hidden="true" /><p className="eyebrow">The bowl is empty</p><h1>Team {winner === "BELLS" ? "Bells" : "Motley"} wears the Crown of Fools!</h1><p className="winning-score">{bowl.teamScores.BELLS} Bells · {bowl.teamScores.MOTLEY} Motley</p><div className="champion-row">{players.filter((player) => bowl.teams[player.id] === winner).map((player) => <div key={player.id}><Avatar playerId={player.id} index={player.avatar} color={player.color} config={player.avatarConfig} size="large" /><strong>{player.nickname}</strong></div>)}</div><p>{bowl.suddenDeath ? "One final anonymous scroll broke the tie." : "Three rounds. One bowl. Far too much retained nonsense."}</p>{!readOnly && <div className="results-actions"><button className="button button-primary" onClick={() => void act("PLAY_AGAIN")}>Refill the bowl</button><Link className="button button-quiet" href="/host/new">New room</Link></div>}</section>;
  }
  if (snapshot.gameLength === "royal-war-room" && snapshot.warRoom) {
    const war = snapshot.warRoom;
    const winningScore = Math.max(war.teamScores.LION, war.teamScores.RAVEN);
    const winnerTeams = (["LION", "RAVEN"] as const).filter(
      (team) => war.teamScores[team] === winningScore,
    );
    const winningPlayers = players.filter((player) =>
      winnerTeams.includes(war.teams[player.id]),
    );
    return (
      <section
        className={`results-stage war-results war-${war.campaign.toLowerCase()}`}
      >
        <div className="winner-burst" aria-hidden="true" />
        <p className="eyebrow">
          {war.campaign === "ATTACK"
            ? "The campaign is complete"
            : "The siege is over"}
        </p>
        <h1>
          {war.campaign === "ATTACK" ? "Castle conquered" : "Castle held"}
        </h1>
        <p className="winning-score">
          {winnerTeams.join(" & ")} Council{winnerTeams.length > 1 ? "s" : ""} ·{" "}
          {winningScore} banners
        </p>
        <div className="war-final-score">
          {(["LION", "RAVEN"] as const).map((team) => (
            <article
              className={winnerTeams.includes(team) ? "champion" : ""}
              key={team}
            >
              <span>{team === "LION" ? "♜" : "◆"}</span>
              <h2>{team} COUNCIL</h2>
              <b>{war.teamScores[team]}</b>
              <p>
                {players
                  .filter((player) => war.teams[player.id] === team)
                  .map((player) => player.nickname)
                  .join(" · ")}
              </p>
            </article>
          ))}
        </div>
        <div className="podium-row">
          {winningPlayers.map((player) => (
            <div className="champion" key={player.id}>
              <Avatar
                playerId={player.id} index={player.avatar}
                color={player.color}
                config={player.avatarConfig}
                size="large"
              />
              <strong>{player.nickname}</strong>
              <span>CO-CHAMPION</span>
            </div>
          ))}
        </div>
        <div className="picture-finale-card">
          <span aria-hidden="true">
            {war.campaign === "ATTACK" ? "⚔" : "♜"}
          </span>
          <h2>The room wrote the plan. The councils rebuilt it.</h2>
          <p>
            Every correct placement rewarded the whole council. The next match
            automatically reverses the castle&apos;s role.
          </p>
        </div>
        <div className="result-actions">
          <p>This archived pack cannot be replayed. Start a room with one of the active games.</p>
          <Link className="button button-quiet" href="/host/new">
            New room
          </Link>
        </div>
      </section>
    );
  }
  if (snapshot.gameLength === "royal-rumours")
    return (
      <section className="results-stage picture-results rumour-results">
        <div className="winner-burst" aria-hidden="true" />
        <p className="eyebrow">
          Royal rumour champion{champions.length > 1 ? "s" : ""}
        </p>
        <h1>
          {champions.map((player) => player.nickname).join(" & ") || "The room"}
        </h1>
        <p className="winning-score">{high.toLocaleString()} points</p>
        <div className="rumour-chain-grid">
          {snapshot.rumours?.chains
            .filter((chain) => chain.winner)
            .map((chain) => (
              <article
                className="rumour-chain-winner"
                key={chain.sourceAnswerId}
              >
                <span>♛ FUNNIEST MUTATION</span>
                <blockquote>“{chain.originalText}”</blockquote>
                <b>became</b>
                <p>“{chain.guessText}”</p>
                <strong>
                  {chain.votes} vote{chain.votes === 1 ? "" : "s"}
                </strong>
              </article>
            ))}
        </div>
        <div className="podium-row">
          {players.slice(0, 5).map((player, index) => (
            <div className={index === 0 ? "champion" : ""} key={player.id}>
              <Avatar
                playerId={player.id} index={player.avatar}
                color={player.color}
                config={player.avatarConfig}
                size="large"
              />
              <strong>{player.nickname}</strong>
              <span>{(player.score ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="result-columns">
          <div>
            <h2>Rumour honors</h2>
            <div className="award-list">
              {results.awards?.slice(0, 4).map((award) => (
                <article key={award.title}>
                  <span>☞</span>
                  <div>
                    <strong>{award.title}</strong>
                    <p>
                      {award.playerIds
                        .map(
                          (id) =>
                            snapshot.players.find((player) => player.id === id)
                              ?.nickname,
                        )
                        .filter(Boolean)
                        .join(" & ")}{" "}
                      · {award.caption}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="picture-finale-card">
            <span aria-hidden="true">☞</span>
            <h2>It started as a whisper.</h2>
            <p>
              Each vote paid 500 points to the player who interpreted the first
              AI painting and 250 to the player who started that chain.
            </p>
          </div>
        </div>
        <div className="result-actions">
          <button
            className="button button-primary"
            onClick={() => void act("PLAY_AGAIN")}
          >
            Start another rumour
          </button>
          <Link className="button button-quiet" href="/host/new">
            New room
          </Link>
        </div>
      </section>
    );
  if (snapshot.gameLength === "king-mystery")
    return (
      <section className="results-stage picture-results mystery-results">
        <div className="winner-burst" aria-hidden="true" />
        <p className="eyebrow">
          Chief investigator{champions.length > 1 ? "s" : ""}
        </p>
        <h1>
          {champions.map((player) => player.nickname).join(" & ") || "The room"}
        </h1>
        <p className="winning-score">{high.toLocaleString()} points</p>
        <div className="podium-row">
          {players.slice(0, 5).map((player, index) => (
            <div className={index === 0 ? "champion" : ""} key={player.id}>
              <Avatar
                playerId={player.id} index={player.avatar}
                color={player.color}
                config={player.avatarConfig}
                size="large"
              />
              <strong>{player.nickname}</strong>
              <span>{(player.score ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="result-columns">
          <div>
            <h2>Case-file honors</h2>
            <div className="award-list">
              {results.awards?.slice(0, 4).map((award) => (
                <article key={award.title}>
                  <span>⚖</span>
                  <div>
                    <strong>{award.title}</strong>
                    <p>
                      {award.playerIds
                        .map(
                          (id) =>
                            snapshot.players.find((player) => player.id === id)
                              ?.nickname,
                        )
                        .filter(Boolean)
                        .join(" & ")}{" "}
                      · {award.caption}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="picture-finale-card">
            <span aria-hidden="true">⚖</span>
            <h2>The evidence was framed. So were several innocent turnips.</h2>
            <p>
              Investigators earned 500 for finding true reports. Cover stories
              earned 500 per person fooled—or 750 when backed by a player&apos;s
              one-use Royal Seal. Clear evidence paid its original witness up to
              750.
            </p>
          </div>
        </div>
        <div className="result-actions">
          <button
            className="button button-primary"
            onClick={() => void act("PLAY_AGAIN")}
          >
            Open another case file
          </button>
          <Link className="button button-quiet" href="/host/new">
            New room
          </Link>
        </div>
      </section>
    );
  if (snapshot.gameLength === "comic")
    return (
      <section className="results-stage picture-results comic-results">
        <div className="winner-burst" aria-hidden="true" />
        <p className="eyebrow">
          Comic champion{champions.length > 1 ? "s" : ""}
        </p>
        <h1>
          {champions.map((player) => player.nickname).join(" & ") || "The room"}
        </h1>
        <p className="winning-score">{high.toLocaleString()} points</p>
        <p className="comic-theme-line">{snapshot.comicTheme}</p>
        <ComicStrip snapshot={snapshot} />
        <div className="podium-row">
          {players.slice(0, 5).map((player, index) => (
            <div className={index === 0 ? "champion" : ""} key={player.id}>
              <Avatar
                playerId={player.id} index={player.avatar}
                color={player.color}
                config={player.avatarConfig}
                size="large"
              />
              <strong>{player.nickname}</strong>
              <span>{(player.score ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="picture-finale-card">
          <span aria-hidden="true">▣</span>
          <h2>Setup. Escalation. Punchline.</h2>
          <p>
            The final panel carried the biggest ballot and completed the
            room&apos;s one-of-a-kind comic.
          </p>
        </div>
        <div className="result-actions">
          <button
            className="button button-primary"
            onClick={() => void act("PLAY_AGAIN")}
          >
            Make another comic
          </button>
          <Link className="button button-quiet" href="/host/new">
            New room
          </Link>
        </div>
      </section>
    );
  if (snapshot.gameLength === "pictures") {
    const kingResults = (snapshot.results ?? {}) as {
      finalWinningAnswerIds?: string[];
    };
    const winningIds = new Set(kingResults.finalWinningAnswerIds ?? []);
    const crowned = snapshot.answers.filter((answer) =>
      winningIds.has(answer.id),
    );
    if (snapshot.restoration)
      return (
        <section className="results-stage picture-results king-results">
          <div className="winner-burst" aria-hidden="true" />
          <p className="eyebrow">
            King Prompter champion{champions.length > 1 ? "s" : ""}
          </p>
          <h1>
            {champions.map((player) => player.nickname).join(" & ") ||
              "The room"}
          </h1>
          <p className="winning-score">{high.toLocaleString()} points</p>
          <RestorationPortrait
            code={snapshot.code}
            restoration={snapshot.restoration}
          />
          <div className="podium-row">
            {players.slice(0, 5).map((player, index) => (
              <div className={index === 0 ? "champion" : ""} key={player.id}>
                <Avatar
                  playerId={player.id} index={player.avatar}
                  color={player.color}
                  config={player.avatarConfig}
                  size="large"
                />
                <strong>{player.nickname}</strong>
                <span>{(player.score ?? 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="picture-finale-card">
            <span aria-hidden="true">♛</span>
            <h2>The King is intact. History is not.</h2>
            <p>
              Canvas One paid 100 points per vote, Canvas Two paid 150, and
              every Royal Seal on a restored section paid 300. The complete
              collage remains the room&apos;s main masterpiece.
            </p>
          </div>
          <div className="result-actions">
            <button
              className="button button-primary"
              onClick={() => void act("PLAY_AGAIN")}
            >
              Restore another legacy
            </button>
            <Link className="button button-quiet" href="/host/new">
              New room
            </Link>
          </div>
        </section>
      );
    return (
      <section className="results-stage picture-results king-results">
        <div className="winner-burst" aria-hidden="true" />
        <p className="eyebrow">
          King Prompter champion{champions.length > 1 ? "s" : ""}
        </p>
        <h1>
          {champions.map((player) => player.nickname).join(" & ") || "The room"}
        </h1>
        <p className="winning-score">{high.toLocaleString()} points</p>
        {crowned.length > 0 && (
          <div className="crowned-gallery">
            {crowned.map((answer) => {
              const author = snapshot.players.find(
                (player) => player.id === answer.authorId,
              );
              const crownedUrl =
                answer.image?.status === "READY" && answer.image.assetId
                  ? `/api/rooms/${snapshot.code}/media/${answer.image.assetId}`
                  : null;
              return (
                <article key={answer.id}>
                  {crownedUrl ? (
                    <Image
                      src={crownedUrl}
                      width={1024}
                      height={1024}
                      unoptimized
                      alt="Crowned King Prompter image"
                    />
                  ) : (
                    <div className="concept-card">
                      <strong>
                        {answer.image?.conceptTitle ?? "Crowned canvas"}
                      </strong>
                      <p>{answer.image?.conceptCaption}</p>
                    </div>
                  )}
                  <div>
                    <span>♛ CROWNED IMAGE</span>
                    <strong>{author?.nickname ?? "The room"}</strong>
                    <p>{answer.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="podium-row">
          {players.slice(0, 5).map((player, index) => (
            <div className={index === 0 ? "champion" : ""} key={player.id}>
              <Avatar
                playerId={player.id} index={player.avatar}
                color={player.color}
                config={player.avatarConfig}
                size="large"
              />
              <strong>{player.nickname}</strong>
              <span>{(player.score ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="picture-finale-card">
          <span aria-hidden="true">♛</span>
          <h2>Two canvases. One Crown Gallery.</h2>
          <p>
            Prompt points, double image points, and the final 4× crown ballot
            are all included.
          </p>
        </div>
        <div className="result-actions">
          <button
            className="button button-primary"
            onClick={() => void act("PLAY_AGAIN")}
          >
            Play again
          </button>
          <Link className="button button-quiet" href="/host/new">
            New room
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className={`results-stage ${birthday ? "birthday-results" : ""}`}>
      <div className="winner-burst" aria-hidden="true" />
      <p className="eyebrow">
        {birthday
          ? `${snapshot.birthdayName}'s 30th birthday champion${champions.length > 1 ? "s" : ""}`
          : `Tonight's champion${champions.length > 1 ? "s" : ""}`}
      </p>
      <h1>
        {champions.map((player) => player.nickname).join(" & ") || "The room"}
      </h1>
      <p className="winning-score">{high.toLocaleString()} points</p>
      <div className="podium-row">
        {players.slice(0, 5).map((player, index) => (
          <div className={index === 0 ? "champion" : ""} key={player.id}>
            <Avatar
              playerId={player.id} index={player.avatar}
              color={player.color}
              config={player.avatarConfig}
              size="large"
            />
            <strong>{player.nickname}</strong>
            <span>{(player.score ?? 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <div
        className={`result-columns ${birthday ? "birthday-result-columns" : ""}`}
      >
        <div>
          <h2>{birthday ? "Party awards" : "Room awards"}</h2>
          <div className="award-list">
            {results.awards?.slice(0, 4).map((award) => (
              <article key={award.title}>
                <span>✦</span>
                <div>
                  <strong>{award.title}</strong>
                  <p>
                    {award.playerIds
                      .map(
                        (id) =>
                          snapshot.players.find((player) => player.id === id)
                            ?.nickname,
                      )
                      .filter(Boolean)
                      .join(" & ")}{" "}
                    · {award.caption}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
        {birthday ? (
          <div className="birthday-finale-card">
            <span>30</span>
            <h2>Cheers, {snapshot.birthdayName}!</h2>
            <p>Thirty years down. The group chat evidence is now permanent.</p>
          </div>
        ) : (
          <div className="tonights-lore">
            <h2>Tonight&apos;s Lore</h2>
            <div className="lore-story">
              {gallery.nodes.map((node, index) => (
                <div key={node.id}>
                  {index > 0 && (
                    <span className="lore-arrow" aria-hidden="true">
                      ↓
                    </span>
                  )}
                  <article>
                    <small>{node.kind}</small>
                    <blockquote>“{node.text}”</blockquote>
                  </article>
                </div>
              ))}
            </div>
            {gallery.edges.length > 0 && (
              <div className="lore-relations" aria-label="Memory relationships">
                {gallery.edges.map((edge) => (
                  <span key={edge.id}>
                    {nodeKind(edge.fromLoreId)}{" "}
                    <strong>{edge.relation.replaceAll("_", " ")}</strong>{" "}
                    {nodeKind(edge.toLoreId)}
                  </span>
                ))}
              </div>
            )}
            {imageUrl ? (
              <div className="masterpiece">
                <p>Tonight&apos;s Masterpiece</p>
                <Image
                  src={imageUrl}
                  width={2048}
                  height={1152}
                  unoptimized
                  alt="Tonight's generated CALLBACK masterpiece"
                />
              </div>
            ) : (
              <div className="concept-card final-concept">
                <span>ART DEPARTMENT CONCEPT CARD</span>
                <strong>
                  {snapshot.image?.conceptTitle ?? "Tonight's Masterpiece"}
                </strong>
                <p>
                  {snapshot.image?.conceptCaption ??
                    "The room's connected story, commemorated without relying on generated text."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="result-actions">
        {birthday ? <p>This archived pack cannot be replayed. Start a room with one of the active games.</p> : <button
          className="button button-primary"
          onClick={() => void act("PLAY_AGAIN")}
        >
          Play again
        </button>}
        {!birthday && (
          <button
            className="button button-secondary"
            onClick={() => void act("START_ENCORE")}
          >
            Monster Factory encore
          </button>
        )}
        <Link
          className="button button-quiet"
          href="/host/new"
        >
          New room
        </Link>
      </div>
    </section>
  );
}

function HostControls({
  open,
  snapshot,
  close,
  act,
  audio,
}: {
  open: boolean;
  snapshot: HostSnapshot;
  close: () => void;
  act: (
    type: HostAction["type"],
    payload?: Record<string, unknown>,
  ) => Promise<void>;
  audio: ReturnType<typeof useHostAudio>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Native modality contains keyboard focus, makes the host stage inert,
    // and restores the opening control's focus when the drawer closes.
    if (open && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  const percent = (value: number) => Math.round(value * 100);
  return (
    <dialog
      ref={dialogRef}
      className={`drawer-backdrop ${open ? "drawer-open" : ""}`}
      aria-label="Host controls"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={(event) => { if (!event.currentTarget.open) close(); }}
    >
      <aside className="host-drawer" aria-label="Host controls">
        <header>
          <div>
            <p className="eyebrow">Secondary controls</p>
            <h2>Host desk</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            onClick={close}
            aria-label="Close controls"
          >
            ×
          </button>
        </header>
        <ScrollPanel active={open}><section className="audio-console" aria-label="TV audio controls">
          <div className="audio-console-heading">
            <div>
              <p className="eyebrow">TV audio director</p>
              <h3>
                {audio.ready
                  ? audio.settings.muted
                    ? "Muted"
                    : "Live mix"
                  : "Ready to start"}
              </h3>
            </div>
            <button type="button" onClick={audio.activateOrToggle}>
              {!audio.ready
                ? "Start audio"
                : audio.settings.muted
                  ? "Unmute"
                  : "Mute all"}
            </button>
          </div>
          <label className="audio-slider">
            <span>
              Master <b>{percent(audio.settings.masterVolume)}%</b>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={audio.settings.masterVolume}
              onChange={(event) =>
                audio.update({ masterVolume: Number(event.target.value) })
              }
            />
          </label>
          <div className="audio-channel-grid">
            <label>
              <input
                type="checkbox"
                checked={audio.settings.music}
                onChange={(event) =>
                  audio.update({ music: event.target.checked })
                }
              />
              <span>
                <strong>Adaptive music</strong>
                <small>{percent(audio.settings.musicVolume)}%</small>
              </span>
              <input
                aria-label="Music volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audio.settings.musicVolume}
                onChange={(event) =>
                  audio.update({ musicVolume: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={audio.settings.effects}
                onChange={(event) =>
                  audio.update({ effects: event.target.checked })
                }
              />
              <span>
                <strong>Sound effects</strong>
                <small>{percent(audio.settings.effectsVolume)}%</small>
              </span>
              <input
                aria-label="Sound effects volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audio.settings.effectsVolume}
                onChange={(event) =>
                  audio.update({ effectsVolume: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={audio.settings.narrator}
                onChange={(event) =>
                  audio.update({ narrator: event.target.checked })
                }
              />
              <span>
                <strong>Narrator</strong>
                <small>{percent(audio.settings.narratorVolume)}%</small>
              </span>
              <input
                aria-label="Narrator volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={audio.settings.narratorVolume}
                onChange={(event) =>
                  audio.update({ narratorVolume: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="audio-voice">
            <span>Narrator voice</span>
            <select
              value={audio.settings.voiceURI}
              onChange={(event) =>
                audio.update({ voiceURI: event.target.value })
              }
            >
              <option value="">
                King Prompter house narrator (recommended)
              </option>
              {audio.voiceOptions.map((voice) => (
                <option key={voice.uri} value={voice.uri}>
                  {voice.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="audio-test"
            type="button"
            disabled={
              !audio.ready || audio.settings.muted || !audio.settings.narrator
            }
            onClick={audio.testVoice}
          >
            Test narrator
          </button>
          <small className="audio-free-note">
            Runs only on this host screen. No paid audio service or player-phone
            playback.
          </small>
        </section>
        <div className="control-grid">
          {snapshot.gameLength === "bowl-of-fools" && <button onClick={() => void act("UNDO_FOOL_POINT")}>↶ Undo last Correct</button>}
          {snapshot.arcadeGameId !== "fish-tank" && <button
            disabled={!snapshot.deadlineAt && !snapshot.paused}
            onClick={() => void act(snapshot.paused ? "RESUME" : "PAUSE")}
          >
            {snapshot.paused ? "▶ Resume" : "Ⅱ Pause"}
          </button>}
          {snapshot.arcadeGameId !== "sketch-relay" && snapshot.arcadeGameId !== "fish-tank" && <button
            disabled={!snapshot.deadlineAt && !snapshot.paused}
            onClick={() => void act("ADD_TIME", { seconds: 15 })}
          >
            +15 seconds
          </button>}
          {snapshot.arcadeGameId !== "sketch-relay" && snapshot.arcadeGameId !== "fish-tank" && <button
            disabled={["LOBBY", "POST_GAME"].includes(snapshot.phase)}
            onClick={() => void act("SKIP")}
          >
            Skip phase
          </button>}
          <button
            onClick={() =>
              void act("LOCK_JOINING", { locked: !snapshot.joiningLocked })
            }
          >
            {snapshot.joiningLocked ? "Unlock joining" : "Lock joining"}
          </button>
          {snapshot.bowl && (
            <button
              className="undo-correct"
              disabled={!snapshot.bowl.lastCorrectUndoAvailable}
              onClick={() => void act("UNDO_BOWL_CORRECT")}
            >
              Undo last Correct
            </button>
          )}
        </div>
        <label className="drawer-toggle">
          <input
            type="checkbox"
            checked={snapshot.timerAccessibility}
            disabled={snapshot.phase !== "LOBBY"}
            onChange={(event) =>
              void act("SET_CONFIG", {
                timerAccessibility: event.target.checked,
              })
            }
          />
          <span>Timer accessibility mode (1.5×)</span>
        </label>
        {snapshot.answers.length > 0 && (
          <div className="remove-list">
            <h3>Visible answers</h3>
            {snapshot.answers.map((answer) => (
              <div key={answer.id}>
                <span className="drawer-answer">“{answer.text}”</span>
                <button
                  onClick={() => {
                    if (confirm("Hide this answer from voting and recaps?"))
                      void act("HIDE_ANSWER", { answerId: answer.id });
                  }}
                >
                  Hide
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="remove-list">
          <h3>Players</h3>
          {snapshot.players
            .filter((player) => player.role === "player")
            .map((player) => (
              <div key={player.id}>
                <span>
                  <Avatar
                    playerId={player.id} index={player.avatar}
                    color={player.color}
                    config={player.avatarConfig}
                    size="small"
                  />
                  {player.nickname}
                </span>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${player.nickname}?`))
                      void act("REMOVE_PLAYER", { playerId: player.id });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
        </div>
        {snapshot.gameLength === "arcade" && snapshot.arcadeGameId === "sketch-relay" ? <p>
          Finish the exhibition, then choose <strong>One more exhibition</strong> on the TV to replay.
          In a shared lobby, use <strong>New Game</strong> to switch games.
        </p> : <button
          className="danger-button"
          onClick={() => {
            if (confirm("End this game for everyone?")) void act("END_GAME");
          }}
        >
          End game
        </button>}
        </ScrollPanel>
      </aside>
    </dialog>
  );
}

function roundTitle(kind: HostSnapshot["roundKind"], birthday = false) {
  const regular = {
    THE_SEED: "The Seed",
    READ_THE_ROOM: "Read the Room",
    MAKE_IT_REAL: "Make It Real",
    THE_CATCH: "The Catch",
    CROWD_CONTROL: "Crowd Control",
    CALLBACK: "Callback",
    THE_REMIX: "The Remix",
    FIRST_IMPRESSIONS: "First Impressions",
    WHO_SAID_THAT: "Who Said That?",
    FINAL_READ: "Final Read",
    MONSTER_FACTORY: "Monster Factory",
    PROMPT_AND_CIRCUMSTANCE: "King Prompter",
    KING_PROMPTER_FINAL: "Royal Restoration",
    COMIC_FRAME: "Let’s Make a Comic",
    KING_REQUEST_MYSTERY: "The Royal Frame-Up",
    ROYAL_RUMOURS: "Royal Rumours",
    ROYAL_WAR_ROOM: "Royal War Room",
    BOWL_OF_FOOLS: "Bowl of Fools",
  } as Record<string, string>;
  const party: Record<string, string> = {
    ...regular,
    THE_CATCH: "Thirty Words or Less",
    CROWD_CONTROL: "Most Likely To",
    FIRST_IMPRESSIONS: "The Biopic",
    WHO_SAID_THAT: "Who Wrote It?",
    FINAL_READ: "Future Message",
    BIRTHDAY_BETS: "Birthday Bets",
  };
  return (birthday ? party : regular)[kind ?? ""] ?? "Get Ready";
}
function roundTagline(kind: HostSnapshot["roundKind"], birthday = false) {
  const regular = {
    THE_SEED: "Invent the thing this room may never escape.",
    READ_THE_ROOM: "How well do you know these people?",
    MAKE_IT_REAL: "Earlier tonight, you made this.",
    THE_CATCH: "Build the world—with one tiny restriction.",
    CROWD_CONTROL: "Point at a friend. Then predict everybody.",
    CALLBACK: "The room remembers everything.",
    THE_REMIX: "Your connected history becomes the final challenge.",
    FIRST_IMPRESSIONS: "Make the room remember you.",
    WHO_SAID_THAT: "Every answer has a voice.",
    FINAL_READ: "Read a friend. Risk your points.",
    MONSTER_FACTORY: "One creature. Ten questionable decisions.",
    PROMPT_AND_CIRCUMSTANCE:
      "Under twenty words. Every Royal Squire paints your exact idea.",
    KING_PROMPTER_FINAL:
      "One torn portrait. One ridiculous restored section per player.",
    COMIC_FRAME:
      "Write a visual panel, generate every idea, then lock the room favorite into the strip.",
    KING_REQUEST_MYSTERY:
      "Evidence paintings hide true incidents among convincing cover stories.",
    ROYAL_RUMOURS:
      "Write it, let AI picture it, then trust someone else to misunderstand it.",
  } as Record<string, string>;
  const party: Record<string, string> = {
    ...regular,
    THE_CATCH: "One birthday prompt. One ridiculous restriction.",
    FIRST_IMPRESSIONS: "Write the title. Defend it in the group chat later.",
    WHO_SAID_THAT: "Match the answer to the suspicious friend.",
    BIRTHDAY_BETS: "Everybody predicts. The birthday VIP tells the truth.",
  };
  return (birthday ? party : regular)[kind ?? ""] ?? "Phones ready.";
}
