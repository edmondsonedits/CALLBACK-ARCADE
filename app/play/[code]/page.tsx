"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import ArcadeTouchTools from "../../components/ArcadeTouchTools";
import Image from "next/image";
import type {
  AudienceSnapshot,
  HostAction,
  PlayerAction,
  PlayerSnapshot,
  RoleSnapshot,
  SnapshotSketchRelay,
} from "../../../lib/contracts";
import type { AvatarConfig } from "../../../lib/avatar-runtime";
import { DEFAULT_AVATAR, clone } from "../../../lib/avatar-runtime";
import {
  loadAvatarPreference,
  saveAvatarPreference,
} from "../../../lib/avatar-preference";
import { graphemeCount } from "../../../lib/game/validators";
import { randomUuid } from "../../../lib/game/random";
import { foolHintsFor } from "../../../lib/content/fool-hints";
import { Avatar } from "../../components/Avatar";
import { AvatarPoseProvider } from "../../components/AvatarPoseProvider";
import BotSwitch from "../../components/BotSwitch";
import { PhoneSections, usePhoneNavigation } from "../../components/PhoneSections";
import { CharacterProfileEditor } from "../../components/CharacterProfileEditor";
import { Brand, PhasePill } from "../../components/Brand";
import { BowlPhone } from "../../components/BowlOfFools";
import { isSchaetzoramaPhoneSnapshot, SchaetzoramaController } from "../../components/SchaetzoramaController";
import { isImposterPhoneSnapshot, ImposterController } from "../../components/ImposterController";
import { BuzzwortController, isBuzzwortPhoneSnapshot } from "../../components/BuzzwortController";
import { PantomimeController, isPantomimePhoneSnapshot } from "../../components/PantomimeController";
import { DrawGuessController, isDrawGuessPhoneSnapshot } from "../../components/DrawGuessController";
import { ArenaSurvivorController, isArenaSurvivorPhoneSnapshot } from "../../components/ArenaSurvivorController";
import { ChaosKommandoController } from "../../components/ChaosKommandoController";
import { MagicArenaController } from "../../components/MagicArenaController";
import { MagicDuellController } from "../../components/MagicDuellViews";
import { MinionsTdController } from "../../components/MinionsTdViews";
import { KartentischController } from "../../components/KartentischViews";
import { DungeonPartyController } from "../../components/DungeonPartyViews";
import { FlatterfluffController } from "../../components/FlatterfluffViews";
import { DriftRacerController } from "../../components/DriftRacerViews";
import { SketchRelayController } from "../../components/sketch-relay/SketchRelayController";
import { FishBonusPhone } from "../../components/fish/FishFinalePanel";
import { WordTilesController } from "../../components/WordTilesViews";
import { SchattenjagdController } from "../../components/SchattenjagdViews";
import { ArcadeController } from "../../components/ArcadeController";
import { TapRacePhone } from "../../components/TapRaceViews";
import { LightTrailsPhone } from "../../components/LightTrailsViews";
import { useArcadeRealtime } from "../../components/useArcadeRealtime";
import { BowlRemoteMedia } from "../../components/BowlRemoteMedia";
import { DeveloperStudio } from "../../components/DeveloperStudio";
import { FoolRemoteLive } from "../../components/FoolRemoteLive";
import { RestorationPortrait } from "../../components/RestorationPortrait";
import { Crown } from "../../components/presentation/Crown";
import { useCountdown, useRoomSync } from "../../components/useRoomSync";

const subscribeBrowserFrame = () => () => undefined;

export default function PlayRoomPage({
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
      <main className="phone-shell">
        <Brand />
        <div className="loader-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </main>
    );
  return <PlayerRoom code={code} />;
}

function PlayerRoom({ code }: { code: string }) {
  const { snapshot, error, reconnecting, send, reset } = useRoomSync(
    code,
    "player",
  );
  const remaining = useCountdown(snapshot);
  const [joining, setJoining] = useState(false);
  if (!snapshot && error?.status === 404)
    return (
      <main className="phone-shell phone-entry">
        <Brand />
        <section className="phone-card">
          <p className="eyebrow">Room {code}</p>
          <h1>That room is gone.</h1>
          <p>
            Check the code on the big screen or ask the host to start a new
            room.
          </p>
          <Link className="button button-primary phone-button" href="/play">
            Try another code
          </Link>
        </section>
      </main>
    );
  if (!snapshot && (error?.status === 401 || joining))
    return (
      <JoinForm
        code={code}
        onJoined={() => {
          setJoining(false);
          reset();
        }}
        apiError={error?.status === 401 ? null : error?.message}
      />
    );
  if (!snapshot)
    return (
      <main className="phone-shell">
        <Brand />
        <div className="loader-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>{reconnecting ? "Reconnecting…" : "Finding room…"}</p>
        {error && error.status !== 401 && (
          <button className="text-button" onClick={() => setJoining(true)}>
            Join this room
          </button>
        )}
      </main>
    );
  return (
    <AvatarPoseProvider endpoint={`/api/rooms/${code}/avatar-poses`} mode="player" enabled={snapshot.role === "player"}><PlayerController
      code={code}
      snapshot={snapshot as PlayerSnapshot | AudienceSnapshot}
      remaining={remaining}
      reconnecting={reconnecting}
      apiError={error?.message ?? null}
      send={send}
      reset={reset}
    /></AvatarPoseProvider>
  );
}

function JoinForm({
  code,
  onJoined,
  apiError,
}: {
  code: string;
  onJoined: () => void;
  apiError?: string | null;
}) {
  const [nickname, setNickname] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [error, setError] = useState(apiError ?? "");
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialPreference] = useState(() => loadAvatarPreference());
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(
    () => initialPreference?.avatarConfig ?? clone(DEFAULT_AVATAR),
  );
  const [avatarPreset, setAvatarPreset] = useState<string | null>(
    () => initialPreference?.avatarPreset ?? null,
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuggestion("");
    try {
      const response = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          audience: false,
          avatarConfig,
          avatarPreset,
        }),
      });
      const body = (await response.json()) as {
        error?: { message?: string; detail?: { suggestion?: string } };
      };
      if (!response.ok) {
        setError(body.error?.message ?? "Could not join.");
        setSuggestion(body.error?.detail?.suggestion ?? "");
        return;
      }
      onJoined();
    } catch {
      setError("Could not reach the room. Check your connection.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <main className="phone-shell phone-entry avatar-join-shell">
        <Brand />
        <section className="phone-card nickname-card avatar-join-card">
          <div className="room-code-mini">
            ROOM <strong>{code}</strong>
          </div>
          <p className="eyebrow">Make your player</p>
          <h1>Who are you tonight?</h1>
          <form onSubmit={submit}>
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              autoComplete="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={40}
              placeholder="Your name"
            />
            <div className="input-count">
              {graphemeCount(nickname.trim())}/20
            </div>
            <div className="join-avatar-summary">
              <span className="join-avatar-preview">
                <Avatar
                  index={0}
                  color="#46DBDC"
                  config={avatarConfig}
                  size="large"
                  label="Your selected avatar"
                />
              </span>
              <span>
                <small>
                  {avatarPreset ? `${avatarPreset} look-alike` : "YOUR AVATAR"}
                </small>
                <strong>
                  {avatarPreset
                    ? "Fine-tune this look"
                    : "Choose a look-alike or create yours"}
                </strong>
                <em>Edit avatar →</em>
              </span>
            </div>
            {error && (
              <div className="form-error" role="alert">
                {error}
                {suggestion && (
                  <button
                    type="button"
                    onClick={() => {
                      setNickname(suggestion);
                      setError("");
                      setSuggestion("");
                    }}
                  >
                    Use {suggestion}
                  </button>
                )}
              </div>
            )}
            <button
              className="button button-primary phone-button"
              type="submit"
              disabled={
                busy ||
                !profileReady ||
                profileDirty ||
                graphemeCount(nickname.trim()) < 1 ||
                graphemeCount(nickname.trim()) > 20
              }
            >
              {busy ? "Joining…" : !profileReady ? "Loading character…" : profileDirty ? "Save character to continue" : "Join as this player"}
            </button>
          </form>
        </section>
        <CharacterProfileEditor
          nickname={nickname || "Your player"}
          onProfileLoaded={(config, preset) => { setAvatarConfig(config); setAvatarPreset(preset); }}
          onProfileReady={() => setProfileReady(true)}
          onDirtyChange={setProfileDirty}
          onDraftChange={(config, preset) => { setAvatarConfig(config); setAvatarPreset(preset); }}
          onSaved={(config, preset) => { setAvatarConfig(config); setAvatarPreset(preset); saveAvatarPreference(config, preset); }}
        />
      </main>
    </>
  );
}

function PlayerController({
  code,
  snapshot,
  remaining,
  reconnecting,
  apiError,
  send,
  reset,
}: {
  code: string;
  snapshot: PlayerSnapshot | AudienceSnapshot;
  remaining: number | null;
  reconnecting: boolean;
  apiError: string | null;
  send: (action: PlayerAction) => Promise<unknown>;
  reset: () => void;
}) {
  const arcadeRealtime = useArcadeRealtime(code, snapshot.role === "player" ? snapshot : null);
  const self = snapshot.players.find((player) => player.id === snapshot.selfId);
  const [localError, setLocalError] = useState("");
  const testerEmbedded = useSyncExternalStore(
    subscribeBrowserFrame,
    () => window.self !== window.top && new URLSearchParams(window.location.search).get("tester") === "1",
    () => false,
  );
  const timer = remaining === null ? null : Math.ceil(remaining / 1000);
  usePhoneWakeLock(snapshot.role === "player" && snapshot.gameLength === "bowl-of-fools" && snapshot.phase !== "ENDED");
  const act = async (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => {
    setLocalError("");
    try {
      await send({
        type,
        actionId: randomUuid(),
        roundId: snapshot.roundId,
        expectedPhase: snapshot.phase,
        payload,
      } as PlayerAction);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "That did not go through.",
      );
    }
  };
  const hostAct = async (
    type: HostAction["type"],
    payload: Record<string, unknown> = {},
  ) => {
    setLocalError("");
    try {
      const action = {
        type,
        actionId: randomUuid(),
        roundId: snapshot.roundId,
        expectedPhase: snapshot.phase,
        payload,
      } as HostAction;
      const response = await fetch(`/api/rooms/${code}/host-actions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok)
        throw new Error(
          body?.error?.message ?? "That solo control did not go through.",
        );
      reset();
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "That solo control did not go through.",
      );
    }
  };
  if (snapshot.fishGame && "arcadeGameId" in snapshot && snapshot.arcadeGameId === "fish-tank" && snapshot.fishGame.phase === "closed") return <section className="phone-content results-stage" aria-label="Fish game results"><p className="eyebrow">THE AQUARIUM IS RESTING</p><h1>The Last Fish Swimming</h1><p>The host can start another fish match from the room lobby.</p>{"isHostPlayer" in snapshot && snapshot.isHostPlayer && <button className="button button-primary phone-button" onClick={() => void hostAct("PLAY_AGAIN")}>Play again</button>}</section>;
  if (snapshot.fishGame && snapshot.fishGame.phase !== "closed" && "arcadeGameId" in snapshot && snapshot.arcadeGameId === "fish-tank") return <FishBonusPhone game={{ matchId: snapshot.fishGame.matchId, finale: snapshot.fishGame, fishTest: false } as unknown as SnapshotSketchRelay} code={snapshot.code} selfId={"selfId" in snapshot ? snapshot.selfId : ""} standalone />;
  if (snapshot.sketchRelay && (snapshot.phase !== "LOBBY" || snapshot.sketchRelay.fishTest)) return <SketchRelayController snapshot={snapshot} remaining={remaining} reconnecting={reconnecting} apiError={apiError} refresh={reset} act={(type, payload) => send({ type, actionId: randomUuid(), roundId: snapshot.roundId, expectedPhase: snapshot.phase, payload } as PlayerAction)} />;
  return (
    <main
      data-arcade-touch={"gameLength" in snapshot&&snapshot.gameLength==="arcade"?"":undefined}
      className={`phone-shell controller phase-${snapshot.phase.toLowerCase().replaceAll("_", "-")} ${snapshot.role === "player" && snapshot.gameLength === "bowl-of-fools" ? "fool-phone-shell" : ""}`}
    >
      <header className="phone-header">
        <Brand compact />
        <div className="phone-self">
          {self && (
            <Avatar
              playerId={self.id} index={self.avatar}
              color={self.color}
              config={self.avatarConfig}
              size="small"
            />
          )}
          <strong>
            {self?.nickname ??
              (snapshot.role === "audience" ? "Audience" : "Player")}
          </strong>
        </div>
      </header>
      <div className="phone-phase-row">
        {"gameLength" in snapshot&&snapshot.gameLength==="arcade"&&<ArcadeTouchTools/>}
        <PhasePill phase={snapshot.phase} />
        {timer !== null && (
          <span className={`phone-timer ${timer <= 10 ? "timer-urgent" : ""}`}>
            {timer}
          </span>
        )}
      </div>
      {snapshot.role === "player" && snapshot.gameLength === "bowl-of-fools" && snapshot.foolBowl && <FoolMiniHud snapshot={snapshot} timer={timer} />}
      {reconnecting && (
        <div className="connection-banner" role="status">
          Reconnecting… Your locked answer is safe.
        </div>
      )}
      {(localError || apiError) && (
        <div className="phone-error" role="alert">
          {localError || apiError}
        </div>
      )}
      <PhoneSections taskKey={`${snapshot.roundId}:${snapshot.phase}`} character={snapshot.role === 'player' && self ? {playerId:self.id,index:self.avatar,color:self.color,config:self.avatarConfig,label:self.nickname} : undefined} style={snapshot.role==='player'&&self&&snapshot.phase==='LOBBY'?<RoomCharacterStyle nickname={self.nickname} act={act}/>:undefined}>
      {snapshot.imageGenerationNotice && (
        <div
          className={`phone-image-generation-notice notice-${snapshot.imageGenerationNotice.kind.toLowerCase()}`}
          role="status"
        >
          <strong>
            {snapshot.imageGenerationNotice.reason === "ALLOWANCE_STOP"
              ? "Image generation stopped to protect the allowance."
              : snapshot.imageGenerationNotice.kind === "RETRYING"
              ? "gameLength" in snapshot &&
                snapshot.gameLength === "king-mystery"
                ? "One enchanted frame failed to reconstruct the evidence."
                : "gameLength" in snapshot &&
                    snapshot.gameLength === "royal-rumours"
                  ? "One rumour jammed the Royal Press."
                  : "One Squire dropped a paintbrush."
              : "gameLength" in snapshot &&
                  snapshot.gameLength === "king-mystery"
                ? "The Royal Evidence Vault hit a problem."
                : "gameLength" in snapshot &&
                    snapshot.gameLength === "royal-rumours"
                  ? "The Royal Rumour Press hit a problem."
                  : "The Royal workshop hit a problem."}
          </strong>
          <span>
            {snapshot.imageGenerationNotice.reason === "ALLOWANCE_STOP"
              ? "The game will keep moving. No further OpenAI requests will be sent for this image."
              : snapshot.imageGenerationNotice.kind === "RETRYING"
              ? "The game is trying the next image model automatically."
              : "All models were tried. That entry will use a private-safe concept card."}
          </span>
        </div>
      )}
      {snapshot.developerMode && snapshot.role === "player" && (
        <DeveloperStudio
          key={snapshot.roundId}
          code={code}
          snapshot={snapshot}
          reset={reset}
        />
      )}
      {snapshot.role === "player" &&
        (snapshot.soloMode || (snapshot.gameLength === "bowl-of-fools" && snapshot.isHostPlayer)) &&
        !testerEmbedded &&
        snapshot.phase !== "LOBBY" && (
          <SoloHostControls snapshot={snapshot} act={hostAct} />
        )}
      {snapshot.role === "player" && snapshot.bowl?.environment === "remote_live" && <BowlRemoteMedia code={code} snapshot={snapshot} />}
      {snapshot.role === "player" && snapshot.gameLength === "bowl-of-fools" && snapshot.foolBowl?.playMode === "REMOTE_LIVE" && <FoolRemoteLive snapshot={snapshot} />}
      {snapshot.role === "player" && snapshot.gameLength === "arcade" && snapshot.arcadeGameId === "air-hockey" && snapshot.phase === "ARCADE_ACTIVE" ? (
        <ArcadeController game={arcadeRealtime.game} connection={arcadeRealtime.connection} role={arcadeRealtime.role} paused={arcadeRealtime.paused} onInput={arcadeRealtime.sendPosition} />
      ) : snapshot.role === "player" && snapshot.gameLength === "arcade" && snapshot.arcadeGameId === "tap-race" && snapshot.phase === "ARCADE_ACTIVE" ? (
        <TapRacePhone game={arcadeRealtime.game} connection={arcadeRealtime.connection} role={arcadeRealtime.role} paused={arcadeRealtime.paused} onTap={arcadeRealtime.sendTap} />
      ) : snapshot.role === "player" && snapshot.gameLength === "arcade" && snapshot.arcadeGameId === "light-trails" && snapshot.phase === "ARCADE_ACTIVE" ? (
        <LightTrailsPhone game={arcadeRealtime.game} connection={arcadeRealtime.connection} role={arcadeRealtime.role} paused={arcadeRealtime.paused} onInput={arcadeRealtime.sendPosition} />
      ) : snapshot.role === "player" && snapshot.gameLength === "arcade" && (snapshot.arcadeGameId === "air-hockey" || snapshot.arcadeGameId === "tap-race" || snapshot.arcadeGameId === "light-trails") && snapshot.phase === "ARCADE_RESULTS" ? (
        <ArcadePhoneResults snapshot={snapshot} />
      ) : snapshot.magicArena ? (
        <MagicArenaController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : snapshot.magicDuell ? (
        <MagicDuellController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : snapshot.minionsTd ? (
        <MinionsTdController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : snapshot.kartentisch ? (
        <KartentischController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : snapshot.dungeonParty ? (
        <DungeonPartyController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : snapshot.flatterfluff ? (
        <FlatterfluffController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : snapshot.driftRacer ? (
        <DriftRacerController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : snapshot.wordTiles ? (
        <WordTilesController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : snapshot.schattenjagd ? (
        <SchattenjagdController snapshot={snapshot} remaining={remaining} act={(type, payload) => act(type, payload)} />
      ) : <PhonePhase snapshot={snapshot} remaining={remaining} act={act} hostAct={hostAct} />}
      </PhoneSections>
    </main>
  );
}

function ArcadePhoneResults({ snapshot }: { snapshot: PlayerSnapshot }) {
  const result = snapshot.arcade?.result && typeof snapshot.arcade.result === "object" ? snapshot.arcade.result as { winners?: unknown; tied?: unknown; score?: unknown; progress?: unknown; distance?: unknown } : {};
  const winners = Array.isArray(result.winners) ? result.winners.filter((id): id is string => typeof id === "string") : [];
  const winnerNames = winners.map((id) => snapshot.players.find((player) => player.id === id)?.nickname ?? "Player");
  const values = result.score && typeof result.score === "object" ? result.score as Record<string, unknown> : result.progress && typeof result.progress === "object" ? result.progress as Record<string, unknown> : result.distance && typeof result.distance === "object" ? result.distance as Record<string, unknown> : {};
  return <section className="arcade-phone-card arcade-results" aria-label="Arcade final results"><p className="arcade-kicker">ARCADE RESULTS</p><h1>Final results</h1><p>{result.tied === true ? "It’s a tie!" : winnerNames.length ? `${winnerNames.join(" & ")} ${winnerNames.length > 1 ? "win" : "wins"}!` : "Match complete"}</p><div className="arcade-phone-score">{Object.entries(values).map(([id, value]) => <span key={id}>{snapshot.players.find((player) => player.id === id)?.nickname ?? "Player"}: {Number.isFinite(value) ? Number(value) : 0}</span>)}</div><p>Stay in the room for the next match.</p></section>;
}

function RoomCharacterStyle({nickname,act}:{nickname:string;act:(type:PlayerAction['type'],payload:Record<string,unknown>)=>Promise<void>}){
 const openSection=usePhoneNavigation();
 return <CharacterProfileEditor nickname={nickname} onClose={()=>openSection('game')} onSaved={(avatarConfig,avatarPreset)=>{saveAvatarPreference(avatarConfig,avatarPreset);void act('UPDATE_AVATAR',{avatarConfig,avatarPreset}).then(()=>openSection('game'));}}/>;
}

function usePhoneWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let active = true;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      if (!active || document.visibilityState !== "visible" || lock) return;
      try { lock = await navigator.wakeLock.request("screen"); } catch { /* Optional on unsupported mobile browsers. */ }
    };
    const visible = () => { if (document.visibilityState === "visible") void request(); };
    document.addEventListener("visibilitychange", visible);
    void request();
    return () => { active = false; document.removeEventListener("visibilitychange", visible); if (lock) void lock.release(); };
  }, [enabled]);
}

function FoolMiniHud({ snapshot, timer }: { snapshot: PlayerSnapshot; timer: number | null }) {
  const bowl = snapshot.foolBowl!;
  const roundLabel = snapshot.phase === "LOBBY" ? "ROOM OPEN" : snapshot.phase === "FOOL_TEAM_SETUP" ? "TEAMS" : bowl.suddenDeath ? "SUDDEN DEATH" : snapshot.phase === "FOOL_WRITING" ? "WRITE SCROLLS" : `ROUND ${bowl.gameRound} · ${bowl.gameRound === 1 ? "DESCRIBE" : bowl.gameRound === 2 ? bowl.performance === "DRAWING" ? "DRAW" : "ACT" : "ONE WORD"}`;
  return <aside className="fool-mobile-hud" aria-label="Bowl of Fools score and round"><span className="team-bells"><small>BELLS</small><b>{bowl.teamScores.BELLS}</b></span><strong>{roundLabel}{timer !== null && <em>{timer}</em>}</strong><span className="team-motley"><small>MOTLEY</small><b>{bowl.teamScores.MOTLEY}</b></span></aside>;
}

function PhonePhase({
  snapshot,
  remaining,
  act,
  hostAct,
}: {
  snapshot: PlayerSnapshot | AudienceSnapshot;
  remaining: number | null;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
  hostAct: (
    type: HostAction["type"],
    payload?: Record<string, unknown>,
  ) => Promise<void>;
}) {
  if (snapshot.dungeonParty) return <DungeonPartyController snapshot={snapshot} remaining={remaining} act={act} />;
  if (snapshot.flatterfluff) return <FlatterfluffController snapshot={snapshot} remaining={remaining} act={act} />;
  if (snapshot.magicDuell) return <MagicDuellController snapshot={snapshot} remaining={remaining} act={act} />;
  if (snapshot.minionsTd) return <MinionsTdController snapshot={snapshot} remaining={remaining} act={act} />;
  if (snapshot.wordTiles) return <WordTilesController snapshot={snapshot} remaining={remaining} act={act} />;
  if (snapshot.schattenjagd) return <SchattenjagdController snapshot={snapshot} remaining={remaining} act={act} />;
  if (snapshot.chaosKommando) return <ChaosKommandoController snapshot={snapshot} remaining={remaining} act={act} />;
  if (isImposterPhoneSnapshot(snapshot))
    return <ImposterController snapshot={snapshot} remaining={remaining} act={act} />;
  if (isBuzzwortPhoneSnapshot(snapshot))
    return <BuzzwortController snapshot={snapshot} remaining={remaining} act={act} />;
  if (isPantomimePhoneSnapshot(snapshot))
    return <PantomimeController snapshot={snapshot} remaining={remaining} act={act} />;
  if (isDrawGuessPhoneSnapshot(snapshot))
    return <DrawGuessController snapshot={snapshot} remaining={remaining} act={act} />;
  if (isArenaSurvivorPhoneSnapshot(snapshot))
    return <ArenaSurvivorController snapshot={snapshot} remaining={remaining} act={act} />;
  if (isSchaetzoramaPhoneSnapshot(snapshot))
    return <SchaetzoramaController snapshot={snapshot} remaining={remaining} act={act} />;
  if (snapshot.role === "player" && snapshot.bowl) return <BowlPhone snapshot={snapshot} act={act} />;
  const birthdayMode = snapshot.players.some((player) => player.birthdayVip);
  if (snapshot.phase === "LOBBY")
    return <LobbyWait snapshot={snapshot} hostAct={hostAct} />;
  if ("gameLength" in snapshot && snapshot.gameLength === "bowl-of-fools") return <FoolPhonePhase snapshot={snapshot as PlayerSnapshot} act={act} hostAct={hostAct} />;
  if (
    ["INTRO", "ROUND_INTRO"].includes(snapshot.phase) &&
    "gameLength" in snapshot &&
    snapshot.gameLength === "royal-war-room"
  )
    return (
      <WaitCard
        kicker={`${snapshot.warRoom?.campaign === "ATTACK" ? "Invasion" : "Defence"} · Chapter ${snapshot.roundNumber} of ${snapshot.roundTotal}`}
        title={
          snapshot.phase === "INTRO"
            ? "Royal War Room"
            : (snapshot.prompt ?? "The next campaign chapter")
        }
        copy={
          snapshot.phase === "INTRO"
            ? "Rank the room’s orders, then help your rival council rebuild the secret plan. Play Again always swaps Attack and Defend."
            : (snapshot.instruction ?? "The big screen has your orders.")
        }
      />
    );
  if (["INTRO", "ROUND_INTRO"].includes(snapshot.phase))
    return (
      <WaitCard
        kicker={`Round ${snapshot.roundNumber} of ${snapshot.roundTotal}`}
        title={roundTitle(snapshot.roundKind, birthdayMode)}
        copy={
          snapshot.soloMode
            ? "Everything you need appears on this phone. Open Solo controls if you want to skip the intro."
            : "The big screen has the setup."
        }
      />
    );
  if (
    snapshot.role === "audience" &&
    ![
      "VOTING",
      "FINAL_VOTING",
      "REVEAL",
      "ROUND_RESULTS",
      "FINAL_RESULTS",
      "POST_GAME",
    ].includes(snapshot.phase)
  )
    return (
      <WaitCard
        kicker="Audience mode"
        title="Watch the big screen"
        copy="Your vote opens during public voting rounds."
      />
    );
  if (
    [
      "ANSWERING",
      "FINAL_ANSWERING",
      "ENCORE_CONTRIBUTING",
      "ENCORE_FOLLOWUP",
    ].includes(snapshot.phase)
  )
    return (
      <AnswerTask
        key={`${snapshot.roundId}:${snapshot.phase}`}
        snapshot={snapshot as PlayerSnapshot}
        act={act}
      />
    );
  if (snapshot.phase === "PERSONAL_CHOICE")
    return (
      <ChoiceTask
        key={`${snapshot.roundId}:choice`}
        snapshot={snapshot as PlayerSnapshot}
        act={act}
      />
    );
  if (snapshot.phase === "ROOM_PREDICTION")
    return (
      <PredictionTask
        key={`${snapshot.roundId}:prediction`}
        snapshot={snapshot as PlayerSnapshot}
        act={act}
      />
    );
  if (snapshot.phase === "AUTHOR_GUESSING")
    return (
      <AuthorTask
        key={`${snapshot.roundId}:authors`}
        snapshot={snapshot as PlayerSnapshot}
        act={act}
      />
    );
  if (snapshot.phase === "FINAL_WAGER")
    return (
      <WagerTask
        key={`${snapshot.roundId}:wager`}
        snapshot={snapshot as PlayerSnapshot}
        act={act}
      />
    );
  if (snapshot.phase === "MYSTERY_DECOYS")
    return (
      <MysteryDecoyTask
        key={`${snapshot.roundId}:${snapshot.mystery?.turnId}:decoy`}
        snapshot={snapshot as PlayerSnapshot}
        act={act}
      />
    );
  if (snapshot.phase === "MYSTERY_VOTING")
    return (
      <MysteryVoteTask
        key={`${snapshot.roundId}:${snapshot.mystery?.turnId}:vote`}
        snapshot={snapshot as PlayerSnapshot}
        act={act}
      />
    );
  if (snapshot.phase === "MYSTERY_REVEAL")
    return <MysteryRevealTask snapshot={snapshot as PlayerSnapshot} />;
  if (snapshot.phase === "RUMOUR_GUESSING")
    return snapshot.role === "player" ? (
      <RoyalRumourGuessTask
        key={`${snapshot.roundId}:rumour-guess`}
        snapshot={snapshot}
        act={act}
      />
    ) : (
      <WaitCard
        kicker="Royal Rumours"
        title="The whispers are changing."
        copy="Players are interpreting the AI paintings."
      />
    );
  if (snapshot.phase === "RUMOUR_IMAGE_REVEAL")
    return (
      <WaitCard
        kicker="Royal Rumour Press"
        title="AI is illustrating every interpretation…"
        copy="The reveal waits until every new painting is confirmed or safely replaced."
      />
    );
  if (snapshot.phase === "RUMOUR_REVEAL")
    return <RoyalRumourRevealTask snapshot={snapshot as PlayerSnapshot} />;
  if (snapshot.phase === "RUMOUR_VOTING")
    return (
      <RoyalRumourVoteTask snapshot={snapshot as PlayerSnapshot} act={act} />
    );
  if (snapshot.phase === "WAR_RANKING")
    return snapshot.role === "player" ? (
      <WarRankingTask
        key={`${snapshot.roundId}:war-ranking`}
        snapshot={snapshot}
        act={act}
      />
    ) : (
      <WaitCard
        kicker="Royal War Room"
        title="The generals are ranking orders."
        copy="The combined battle plan remains classified."
      />
    );
  if (snapshot.phase === "WAR_COUNCIL")
    return snapshot.role === "player" ? (
      <WarCouncilTask
        key={`${snapshot.roundId}:${snapshot.warRoom?.turnNumber}:war-council`}
        snapshot={snapshot}
        act={act}
      />
    ) : (
      <WaitCard
        kicker="Royal War Room"
        title={`${snapshot.warRoom?.activeTeam ?? "A"} Council is plotting.`}
        copy="Watch the war board for its command."
      />
    );
  if (["WAR_TURN_REVEAL", "WAR_ROUND_REVEAL"].includes(snapshot.phase))
    return <WarRevealTask snapshot={snapshot} />;
  if (["VOTING", "FINAL_VOTING"].includes(snapshot.phase))
    return (
      <VoteTask
        key={`${snapshot.roundId}:${snapshot.phase}`}
        snapshot={snapshot}
        act={act}
      />
    );
  if (snapshot.phase === "IMAGE_REVEAL" && snapshot.imageJobsPending)
    return (
      <WaitCard
        kicker={
          "gameLength" in snapshot && snapshot.gameLength === "king-mystery"
            ? "Royal Evidence Vault"
            : "gameLength" in snapshot &&
                snapshot.gameLength === "royal-rumours"
              ? "Royal Rumour Press"
              : "Royal workshop"
        }
        title={
          "gameLength" in snapshot && snapshot.gameLength === "king-mystery"
            ? "Reconstructing every incident…"
            : "gameLength" in snapshot &&
                snapshot.gameLength === "royal-rumours"
              ? "AI is illustrating every secret rumour…"
              : "Checking every painting…"
        }
        copy="Nothing will be revealed until every image is confirmed. Failed images automatically move to the next model."
      />
    );
  if (["ANSWER_LOCK", "VOTE_LOCK", "IMAGE_REVEAL"].includes(snapshot.phase))
    return <LockedTask snapshot={snapshot} act={act} />;
  if (["REVEAL", "ROUND_RESULTS"].includes(snapshot.phase))
    return <RevealTask snapshot={snapshot} />;
  if (["FINAL_RESULTS", "POST_GAME"].includes(snapshot.phase))
    return <FinalPhoneResults snapshot={snapshot} hostAct={hostAct} />;
  if (snapshot.phase === "ENDED")
    return (
      <WaitCard
        kicker="Game ended"
        title="Thanks for playing"
        copy="The host ended this room."
      />
    );
  return (
    <WaitCard
      kicker="Stand by"
      title="Watch the big screen"
      copy="The next task will appear here."
    />
  );
}

function FoolPhonePhase({ snapshot, act, hostAct }: { snapshot: PlayerSnapshot; act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void>; hostAct: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void> }) {
  const bowl = snapshot.foolBowl;
  const [scrolls, setScrolls] = useState(() => Array.from({ length: bowl?.scrollsPerPlayer ?? 3 }, () => ""));
  const [oneWord, setOneWord] = useState("");
  const guessKey = `${snapshot.roundId}:${bowl?.gameRound}:${bowl?.poolRemaining}:${bowl?.passUsed}`;
  const [guessInput, setGuessInput] = useState({ key: guessKey, value: "" });
  const botGuess = guessInput.key === guessKey ? guessInput.value : "";
  const [busy, setBusy] = useState(false);
  const [hintPage, setHintPage] = useState(0);
  if (!bowl) return <WaitCard kicker="Bowl of Fools" title="Preparing the royal bowl…" copy="The pigeon is looking for the lid." />;
  const isClueGiver = bowl.clueGiverId === snapshot.selfId;
  const myTeam = bowl.teams[snapshot.selfId] ?? null;
  const clueName = snapshot.players.find((player) => player.id === bowl.clueGiverId)?.nickname ?? "The next fool";
  const rule = bowl.gameRound === 1 ? "Describe it. Do not say any word on the scroll." : bowl.gameRound === 2 ? bowl.performance === "DRAWING" ? "Draw it. No letters, numbers, or talking." : "Act it out. No words or sounds." : "Give exactly one clue word.";

  if (snapshot.phase === "FOOL_TEAM_SETUP") {
    const playerById = new Map(snapshot.players.map((player) => [player.id, player]));
    const ready = new Set(bowl.readyPlayerIds);
    const balanced = bowl.turnOrder.BELLS.length >= 2 && bowl.turnOrder.MOTLEY.length >= 2;
    const meReady = ready.has(snapshot.selfId);
    return <section className="phone-content fool-team-setup">
      <p className="eyebrow">The teams are shuffled</p><h1>Find your side.</h1><p>Turn order is random and alternates between teams. The host can move anyone before all players ready up.</p>
      <div className="fool-team-grid">{(["BELLS", "MOTLEY"] as const).map((team) => <article className={`fool-team-card team-${team.toLowerCase()}`} key={team}><header><span>{team === "BELLS" ? "♢" : "✦"}</span><div><small>TEAM</small><h2>{team === "BELLS" ? "Bells" : "Motley"}</h2></div><b>{bowl.turnOrder[team].length}</b></header><ol>{bowl.turnOrder[team].map((id, index) => { const player = playerById.get(id); if (!player) return null; return <li key={id} className={ready.has(id) ? "ready" : ""}><span>{index + 1}</span><Avatar playerId={player.id} index={player.avatar} color={player.color} config={player.avatarConfig} size="small" /><strong>{player.nickname}{id === snapshot.selfId ? " · You" : ""}</strong>{snapshot.isHostPlayer ? <select aria-label={`Move ${player.nickname} to a team`} value={team} onChange={(event) => void hostAct("SET_FOOL_TEAM", { playerId: id, team: event.target.value })}><option value="BELLS">Bells</option><option value="MOTLEY">Motley</option></select> : <i>{ready.has(id) ? "READY" : "…"}</i>}</li>; })}</ol></article>)}</div>
      {!balanced && <div className="phone-error">Each team needs at least two players. The host must rebalance the teams.</div>}
      {snapshot.isHostPlayer && <button type="button" className="button button-secondary phone-button fool-reshuffle" onClick={() => void hostAct("SHUFFLE_FOOL_TEAMS")}>↻ Shuffle again</button>}
      <button type="button" className={`button phone-button fool-ready-button ${meReady ? "button-secondary" : "button-primary"}`} disabled={!balanced} onClick={() => void act("SET_FOOL_READY", { ready: !meReady })}>{meReady ? "✓ Ready — tap to undo" : "Ready up"}</button>
      <small className="fool-ready-count">{ready.size}/{snapshot.players.filter((player) => player.role === "player").length} ready · the game begins automatically</small>
    </section>;
  }

  if (["INTRO", "ROUND_INTRO"].includes(snapshot.phase)) return <section className="phone-content fool-intro-card"><div className="fool-bowl-mark" aria-hidden="true">♨</div><p className="eyebrow">The royal pigeon presents</p><h1>{snapshot.phase === "INTRO" ? "Bowl of Fools" : `Write ${bowl.scrollsPerPlayer} secret scrolls`}</h1><p>{snapshot.phase === "INTRO" ? "One bowl. Three rounds. The same nonsense gets easier—and funnier—every time." : "People, places, things, titles, actions, or a family inside joke all work."}</p><div className="fool-three-rules"><span><b>1</b> Describe</span><span><b>2</b> {bowl.performance === "DRAWING" ? "Draw" : "Act"}</span><span><b>3</b> One word</span></div></section>;

  if (snapshot.phase === "FOOL_WRITING") {
    const hints = foolHintsFor(`${snapshot.selfId}:${snapshot.roundId}:${hintPage}`, 5);
    const completeCount = bowl.submittedPlayerIds.length;
    const playerCount = snapshot.players.filter((player) => player.role === "player").length;
    return <section className="phone-content fool-phone-card fool-writing-card"><p className="eyebrow">Anonymous · Team {myTeam === "BELLS" ? "Bells" : "Motley"}</p><h1>Feed the bowl.</h1><p>Write {bowl.scrollsPerPlayer} different answers, one to five words each. Make them familiar enough to guess and visual enough to act or draw.</p>{snapshot.submitted ? <div className="fool-folded"><span aria-hidden="true">✓</span><strong>Your scrolls are folded.</strong><p>{completeCount}/{playerCount} players finished. Their authors stay secret forever.</p><div className="fool-folded-scrolls">{scrolls.map((scroll) => <i key={scroll}>SEALED</i>)}</div></div> : <form onSubmit={async (event) => { event.preventDefault(); setBusy(true); try { await act("SUBMIT_FOOL_SCROLLS", { scrolls }); navigator.vibrate?.(35); } finally { setBusy(false); } }}>{scrolls.map((value, index) => { const words = value.trim() ? value.trim().split(/\s+/u).length : 0; return <label className="fool-scroll-input" key={index}><span>SCROLL {index + 1}<small className={words > 5 ? "over" : ""}>{words}/5 words</small></span><input value={value} maxLength={80} placeholder={index === 0 ? "A memorable person" : index === 1 ? "A ridiculous object" : "A family inside joke"} onChange={(event) => setScrolls((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /></label>; })}<button className="button button-primary phone-button fool-fold-button" disabled={busy || scrolls.some((value) => !value.trim() || value.trim().split(/\s+/u).length > 5)}>{busy ? "Folding…" : "Fold all scrolls"}</button></form>}
      {!snapshot.submitted && <aside className="fool-hints"><header><div><small>NEED A SPARK?</small><strong>Try one of these directions</strong></div><button type="button" onClick={() => setHintPage((page) => page + 1)}>New hints ↻</button></header><ul>{hints.map((hint) => <li key={hint}>{hint}</li>)}</ul><small>These are idea starters, not answers. Use something your group will know.</small></aside>}
    </section>;
  }

  if (snapshot.phase === "FOOL_ROUND_REVEAL") return <section className="phone-content fool-round-reveal"><p className="eyebrow">Round {bowl.gameRound} of 3</p><div className="fool-round-number">{bowl.gameRound}</div><h1>{bowl.gameRound === 1 ? "Speak, Fool!" : bowl.gameRound === 2 ? bowl.performance === "DRAWING" ? "Draw, Fool!" : "Perform, Fool!" : "One Word, Fool!"}</h1><p>{rule}</p><strong>Team {bowl.activeTeam === "BELLS" ? "Bells" : "Motley"} starts · {clueName} goes first</strong><small>The same {bowl.totalScrolls} scrolls are back in the bowl.</small></section>;

  if (["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(snapshot.phase)) {
    const correct = async () => { navigator.vibrate?.([35, 25, 55]); await act("FOOL_CORRECT", {}); };
    const botClueGiver = snapshot.players.some((player) => player.id === bowl.clueGiverId && player.bot);
    return <section className={`phone-content fool-phone-card fool-turn-phone ${isClueGiver ? "is-clue-giver" : "is-watching"}`}>
      <div className="fool-turn-context"><span>{bowl.poolRemaining} {bowl.poolRemaining === 1 ? "scroll" : "scrolls"} left</span><b>{rule}</b></div>
      {isClueGiver ? <><p className="eyebrow">Your turn · Team {myTeam === "BELLS" ? "Bells" : "Motley"}</p><div className="fool-secret-wrap"><small>YOUR SECRET SCROLL</small><h1 className="fool-secret">{bowl.secretScroll ?? "Opening scroll…"}</h1></div>{bowl.gameRound === 3 && !bowl.oneWord && <form className="fool-one-word-form" onSubmit={async (event) => { event.preventDefault(); await act("SUBMIT_FOOL_ONE_WORD", { word: oneWord }); }}><label>Choose the only clue you may say<input value={oneWord} onChange={(event) => setOneWord(event.target.value)} placeholder="One word" autoCapitalize="none" /></label><button className="button button-primary phone-button" disabled={!/^\S+$/u.test(oneWord.trim())}>Lock clue</button></form>}{bowl.gameRound === 3 && bowl.oneWord && <div className="fool-locked-clue"><small>YOUR ONE WORD</small><strong>{bowl.oneWord}</strong></div>}{bowl.gameRound === 2 && bowl.performance === "DRAWING" && <FoolDrawingPad act={act} />}<div className="fool-answer-buttons"><button className="button button-primary fool-correct" onClick={() => void correct()}><span>✓</span> Correct</button><button className="button button-secondary" disabled={bowl.passUsed || bowl.poolRemaining < 2} onClick={() => void act("FOOL_PASS", {})}>{bowl.passUsed ? "Pass used" : "Pass once"}</button></div></> : <><p className="eyebrow">{myTeam === bowl.activeTeam ? "Your team is guessing" : "Rival team is playing"}</p><div className="fool-performer-card"><div className="fool-performer-avatar">{(() => { const player = snapshot.players.find((item) => item.id === bowl.clueGiverId); return player ? <Avatar playerId={player.id} index={player.avatar} color={player.color} config={player.avatarConfig} size="large" /> : null; })()}</div><h1>{clueName}</h1><p>{botClueGiver ? "Call your guess out loud. The host listens and checks the spoken answer; a correct guess must match the scroll." : myTeam === bowl.activeTeam ? "Call guesses out loud. Your clue giver will tap Correct." : "Watch closely—the same scrolls return next round."}</p></div>{bowl.gameRound === 3 && bowl.oneWord && <div className="fool-public-clue"><small>THE ONE-WORD CLUE</small><strong>{bowl.oneWord}</strong></div>}{bowl.spokenClue && <div className="fool-public-clue"><small>BOT CLUE</small><strong>{bowl.spokenClue}</strong></div>}{bowl.performanceCue && <div className="fool-public-clue"><small>BOT PRACTICE CUE</small><strong>{bowl.performanceCue}</strong></div>}{bowl.gameRound === 2 && bowl.performance === "DRAWING" && <svg className="fool-canvas" viewBox="0 0 1000 560" role="img" aria-label={`${clueName}'s drawing`}>{bowl.strokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x * 1000},${point.y * 560}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />)}</svg>}{botClueGiver && snapshot.isHostPlayer && <form className="fool-bot-judge-form" onSubmit={(event) => { event.preventDefault(); void hostAct("JUDGE_BOT_FOOL", { decision: "correct", guess: botGuess }); }}><label>Team&apos;s guess<input aria-label="Team's guess" maxLength={100} value={botGuess} onChange={(event) => setGuessInput({ key: guessKey, value: event.target.value })} /></label><button type="submit" className="button button-primary phone-button" disabled={!botGuess.trim()}>Judge correct</button><button type="button" className="button button-secondary phone-button" disabled={bowl.passUsed || bowl.poolRemaining < 2 || snapshot.phase === "FOOL_SUDDEN_DEATH"} onClick={() => void hostAct("JUDGE_BOT_FOOL", { decision: "pass" })}>Judge pass</button></form>}</>}
    </section>;
  }
  if (["FINAL_RESULTS", "POST_GAME"].includes(snapshot.phase)) return <FinalPhoneResults snapshot={snapshot} hostAct={hostAct} />;
  return <WaitCard kicker="Bowl of Fools" title="Stand by, fool." copy="The next scroll is almost ready." />;
}

function FoolDrawingPad({ act }: { act: (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<void> }) {
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const point = (event: React.PointerEvent<SVGSVGElement>) => { const box = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) }; };
  return <svg className="fool-canvas fool-drawing-pad" viewBox="0 0 1000 560" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setPoints([point(event)]); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setPoints((current) => [...current, point(event)]); }} onPointerUp={async (event) => { event.currentTarget.releasePointerCapture(event.pointerId); const completed = [...points, point(event)]; setPoints([]); if (completed.length >= 2) await act("SUBMIT_FOOL_STROKE", { points: completed }); }}><polyline points={points.map((item) => `${item.x * 1000},${item.y * 560}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" /></svg>;
}

type WarTaskData = {
  royalWarRoom: {
    team: "LION" | "RAVEN" | null;
    commander: boolean;
    choices: Array<{ id: string; label: string }>;
    ownRanking: string[] | null;
    scoutAvailable: boolean;
  };
};

function WarRankingTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const data = snapshot.taskData as WarTaskData;
  const choices = data.royalWarRoom.choices;
  const [ordered, setOrdered] = useState<string[]>(
    () => data.royalWarRoom.ownRanking ?? choices.map((choice) => choice.id),
  );
  const move = (index: number, direction: -1 | 1) =>
    setOrdered((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  if (snapshot.submitted)
    return (
      <section className="phone-content locked-task war-phone">
        <div className="lock-mark" aria-hidden="true">
          ⚔
        </div>
        <p className="eyebrow">Battle plan sealed</p>
        <h1>Your ranking is classified.</h1>
        <p>
          The King&apos;s clerks are combining everybody&apos;s priorities. No
          council can see the result yet.
        </p>
      </section>
    );
  return (
    <section className="phone-content war-phone war-ranking-task">
      <p className="round-label">
        {snapshot.warRoom?.campaign === "ATTACK"
          ? "Plan the invasion"
          : "Plan the defence"}{" "}
        · {data.royalWarRoom.team} Council
      </p>
      <h1>Put the orders in the best sequence.</h1>
      <p>
        First is most urgent. Last can wait. Your ranking joins every
        player&apos;s to create one secret plan.
      </p>
      <ol>
        {ordered.map((id, index) => (
          <li key={id}>
            <b>{index + 1}</b>
            <span>{choices.find((choice) => choice.id === id)?.label}</span>
            <div>
              <button
                type="button"
                aria-label={`Move position ${index + 1} earlier`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move position ${index + 1} later`}
                disabled={index === ordered.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          onClick={() =>
            void act("SUBMIT_WAR_RANKING", { orderedChoiceIds: ordered })
          }
        >
          Seal battle plan
        </button>
        <small>You cannot change it after sealing.</small>
      </div>
    </section>
  );
}

function WarCouncilTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const data = snapshot.taskData as WarTaskData;
  const war = snapshot.warRoom!;
  const availableChoices = data.royalWarRoom.choices.filter(
    (choice) => !war.placements[choice.id],
  );
  const openRanks = war.targetRanks.filter(
    (rank) => !Object.values(war.placements).includes(rank),
  );
  const [choiceId, setChoiceId] = useState(availableChoices[0]?.id ?? "");
  const [rank, setRank] = useState(openRanks[0] ?? 1);
  if (!data.royalWarRoom.commander)
    return (
      <section className="phone-content war-phone war-council-wait">
        <p className="round-label">{data.royalWarRoom.team} Council</p>
        <div className="lock-mark" aria-hidden="true">
          ♜
        </div>
        <h1>
          {snapshot.players.find((player) => player.id === war.commanderId)
            ?.nickname ?? "Your commander"}{" "}
          has the map.
        </h1>
        <p>
          Talk it out. Remind them how you ranked the orders—but the final
          placement is theirs.
        </p>
        <div className="war-phone-score">
          <span>
            LION <b>{war.teamScores.LION}</b>
          </span>
          <span>
            RAVEN <b>{war.teamScores.RAVEN}</b>
          </span>
        </div>
        {war.clues.slice(-3).map((clue, index) => (
          <small key={index}>
            {
              data.royalWarRoom.choices.find(
                (choice) => choice.id === clue.choiceId,
              )?.label
            }{" "}
            goes {clue.direction.toLowerCase()}.
          </small>
        ))}
      </section>
    );
  return (
    <section className="phone-content war-phone war-command-task">
      <p className="round-label">
        YOU COMMAND THE {data.royalWarRoom.team} COUNCIL
      </p>
      <h1>Place one order.</h1>
      <p>
        Your council may advise you. Choose an unplaced order and the exact open
        position.
      </p>
      <fieldset>
        <legend>Order</legend>
        {availableChoices.map((choice) => (
          <button
            type="button"
            className={choiceId === choice.id ? "selected" : ""}
            key={choice.id}
            onClick={() => setChoiceId(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </fieldset>
      <fieldset className="war-rank-choice">
        <legend>Position</legend>
        {openRanks.map((value) => (
          <button
            type="button"
            className={rank === value ? "selected" : ""}
            key={value}
            onClick={() => setRank(value)}
          >
            {value}
          </button>
        ))}
      </fieldset>
      {data.royalWarRoom.scoutAvailable && (
        <button
          type="button"
          className="button button-secondary phone-button war-scout"
          disabled={!choiceId}
          onClick={() => void act("SUBMIT_WAR_SCOUT", { choiceId })}
        >
          Use Spyglass on this order
        </button>
      )}
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={!choiceId || !openRanks.includes(rank)}
          onClick={() => void act("SUBMIT_WAR_GUESS", { choiceId, rank })}
        >
          Issue the command
        </button>
        <small>
          Correct locks the position. Wrong reveals earlier or later.
        </small>
      </div>
    </section>
  );
}

function WarRevealTask({
  snapshot,
}: {
  snapshot: PlayerSnapshot | AudienceSnapshot;
}) {
  const war = snapshot.warRoom!;
  const label = (id: string | null | undefined) =>
    war.choices.find((choice) => choice.id === id)?.label;
  if (snapshot.phase === "WAR_TURN_REVEAL")
    return (
      <section className="phone-content war-phone war-move-reveal">
        <p className="round-label">{war.lastMove?.team ?? "Council"} report</p>
        <div className="lock-mark" aria-hidden="true">
          {war.lastMove?.correct ? "✓" : "↔"}
        </div>
        <h1>
          {war.lastMove?.skipped
            ? "Time expired."
            : war.lastMove?.correct
              ? "Order secured!"
              : "Wrong position."}
        </h1>
        <p>
          {war.lastMove?.choiceId
            ? `${label(war.lastMove.choiceId)} at position ${war.lastMove.guessedRank}.`
            : "No order was issued."}
        </p>
        {!war.lastMove?.correct && !war.lastMove?.skipped && (
          <strong>
            It belongs {war.clues.at(-1)?.direction.toLowerCase()}.
          </strong>
        )}
      </section>
    );
  return (
    <section className="phone-content war-phone war-round-reveal">
      <p className="round-label">Chapter {snapshot.roundNumber} declassified</p>
      <h1>The room&apos;s true plan</h1>
      <ol>
        {war.trueOrder?.map((id, index) => (
          <li key={id}>
            <b>{index + 1}</b>
            <span>{label(id)}</span>
          </li>
        ))}
      </ol>
      <div className="war-phone-score">
        <span>
          LION <b>{war.teamScores.LION}</b>
        </span>
        <span>
          RAVEN <b>{war.teamScores.RAVEN}</b>
        </span>
      </div>
    </section>
  );
}

function LobbyWait({
  snapshot,
  hostAct,
}: {
  snapshot: PlayerSnapshot | AudienceSnapshot;
  hostAct: (
    type: HostAction["type"],
    payload?: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const self = snapshot.players.find((player) => player.id === snapshot.selfId);
  const playerSnapshot = snapshot.role === "player" ? snapshot : null;
  const [fishDrawingSeconds, setFishDrawingSeconds] = useState(240);
  const [fishTestMode, setFishTestMode] = useState<"shark" | "peaceful">("shark");
  const openSection = usePhoneNavigation();
  const avatarButton = snapshot.role === "player" && self && (
    <button className="lobby-edit-avatar" type="button" onClick={() => openSection('style')}>
      <span>Edit avatar</span>
      <b>✦</b>
    </button>
  );

  if (playerSnapshot?.gameLength === "bowl-of-fools") return <><FoolLobbyPhone snapshot={playerSnapshot} avatarButton={avatarButton} hostAct={hostAct} /></>;

  if (snapshot.soloMode && playerSnapshot?.gameLength === "arcade" && playerSnapshot.arcadeGameId === "sketch-relay") return <section className="phone-content lobby-phone" aria-label="Fish test lobby">
    <div className="joined-stamp">TEMPORARY FISH TEST</div>
    <h1>Ready to make a splash?</h1>
    <p>Draw your own fish. {snapshot.players.filter(player => player.bot).length} free practice fish fill the tank and vote automatically. Main rounds and scores are skipped.</p>
    <fieldset className="solo-lobby-settings"><legend>Aquarium mode</legend><label>Drawing time<select aria-label="Fish drawing time" value={fishDrawingSeconds} onChange={event => setFishDrawingSeconds(Number(event.target.value))}>{[90,120,180,240,300,360].map(value => <option key={value} value={value}>{value === 90 ? "90 seconds" : `${value / 60} minutes${value === 240 ? " (default)" : ""}`}</option>)}</select></label><label>Fish test mode<select aria-label="Fish test mode" value={fishTestMode} onChange={event => setFishTestMode(event.target.value as "shark" | "peaceful")}><option value="shark">Shark showdown</option><option value="peaceful">Peaceful tank</option></select></label></fieldset>
    <button className="button button-primary phone-button" type="button" onClick={() => void hostAct("START_FISH_TEST", { mode: fishTestMode, drawingSeconds: fishDrawingSeconds })}>Test fish drawing (temporary)</button>
    <a href={`/host/${snapshot.code}`} target="_blank" rel="noopener noreferrer">Open aquarium screen ↗</a>
    <small>Keep this controller open for drawing and voting. Open the aquarium on this phone or another screen.</small>
  </section>;

  if (snapshot.soloMode && playerSnapshot)
    return (
      <>
        <section className="phone-content lobby-phone solo-lobby">
          <div className="joined-stamp">
            {snapshot.developerMode
              ? "◆ DEVELOPER MODE"
              : self?.birthdayVip
                ? "★ BIRTHDAY VIP"
                : "ONE-PHONE MODE"}
          </div>
          <div className="lobby-avatar-hero">
            {self && (
              <Avatar
                playerId={self.id} index={self.avatar}
                color={self.color}
                config={self.avatarConfig}
                size="large"
                label={`${self.nickname}'s avatar`}
              />
            )}
            {avatarButton}
          </div>
          <h1>Ready, {self?.nickname}?</h1>
          <p>
            {snapshot.developerMode
              ? "Play the real game with local bots. Open the Developer studio on any screen to try changes and build a package for chat."
              : "You are the player and the host. In visual modes, your deterministic bots rank your entry first so you can test a winning image."}
          </p>
          <div className="solo-roster" aria-label="Players">
            {snapshot.players
              .filter((player) => player.role === "player")
              .map((player) => (
                <div key={player.id}>
                  <Avatar
                    playerId={player.id} index={player.avatar}
                    color={player.color}
                    config={player.avatarConfig}
                    size="small"
                  />
                  <strong>{player.nickname}</strong>
                  <span>{player.bot ? "BOT" : "YOU"}</span>
                </div>
              ))}
          </div>
          {playerSnapshot.gameLength === "arcade" && playerSnapshot.arcadeGameId === "sketch-relay" && <div className="start-hint"><p>Temporary fish drawing test · choose Shark showdown for bite effects or Peaceful tank for a calm swim. This skips the main match and creates no results.</p><label>Drawing time<select aria-label="Fish drawing time" value={fishDrawingSeconds} onChange={event => setFishDrawingSeconds(Number(event.target.value))}>{[90,120,180,240,300,360].map(value => <option key={value} value={value}>{value === 90 ? "90 seconds" : `${value / 60} minutes${value === 240 ? " (default)" : ""}`}</option>)}</select></label><label>Fish test mode<select aria-label="Fish test mode" value={fishTestMode} onChange={(event) => setFishTestMode(event.target.value as "shark" | "peaceful")}><option value="shark">Shark showdown</option><option value="peaceful">Peaceful tank</option></select></label><button className="button" type="button" onClick={() => void hostAct("START_FISH_TEST", { mode: fishTestMode, drawingSeconds: fishDrawingSeconds })}>Test fish drawing (temporary)</button></div>}          <fieldset className="solo-lobby-settings">
            <legend>Game settings</legend>
            {playerSnapshot.gameLength !== "birthday" && (
              <label>
                Game pack
                <select
                  value={playerSnapshot.gameLength}
                  onChange={(event) =>
                    void hostAct("SET_CONFIG", {
                      gameLength: event.target.value,
                    })
                  }
                >
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
            )}
            {["pictures", "comic", "king-mystery", "royal-rumours"].includes(
              playerSnapshot.gameLength,
            ) && (
              <label className="solo-lobby-toggle">
                <input
                  type="checkbox"
                  checked={playerSnapshot.soloLiveImages}
                  onChange={(event) =>
                    void hostAct("SET_CONFIG", {
                      soloLiveImages: event.target.checked,
                    })
                  }
                />
                <span>Generate live solo images</span>
              </label>
            )}
            {!["pictures", "comic", "king-mystery", "royal-rumours"].includes(
              playerSnapshot.gameLength,
            ) && (
              <label>
                Content
                <select
                  value={playerSnapshot.contentMode}
                  onChange={(event) =>
                    void hostAct("SET_CONFIG", {
                      contentMode: event.target.value,
                    })
                  }
                >
                  <option value="party">Party</option>
                  <option value="family">Family</option>
                </select>
              </label>
            )}
            <label className="solo-lobby-toggle">
              <input
                type="checkbox"
                checked={playerSnapshot.timerAccessibility}
                onChange={(event) =>
                  void hostAct("SET_CONFIG", {
                    timerAccessibility: event.target.checked,
                  })
                }
              />
              <span>More thinking time</span>
            </label>
          </fieldset>
          <button
            className="button button-primary phone-button solo-start-button"
            disabled={playerSnapshot.gameLength === "arcade"}
            onClick={() => void hostAct("START_GAME")}
          >
            {playerSnapshot.gameLength === "arcade" ? "Fish test only" : <>Start game <span aria-hidden="true">→</span></>}
          </button>
          <small>
            {["pictures", "comic", "king-mystery", "royal-rumours"].includes(
              playerSnapshot.gameLength,
            ) && playerSnapshot.soloLiveImages
              ? "Live images will use the configured Cloudflare allocation for you and every bot."
              : "Quota-free solo play uses deterministic concept cards."}
          </small>
        </section>

      </>
    );

  return (
    <>
      <section className="phone-content lobby-phone">
        <div className="joined-stamp">
          {self?.birthdayVip ? "★ BIRTHDAY VIP" : "YOU'RE IN"}
        </div>
        <div className="lobby-avatar-hero">
          {self && (
            <Avatar
              playerId={self.id} index={self.avatar}
              color={self.color}
              config={self.avatarConfig}
              size="large"
              label={`${self.nickname}'s avatar`}
            />
          )}
          {avatarButton}
        </div>
        <h1>{self?.nickname}</h1>
        <p>
          {snapshot.role === "audience"
            ? "You joined the audience. You'll get one favorite vote in public creative rounds."
            : self?.birthdayVip
              ? "You are the birthday answer key. In Birthday Bets, answer honestly while everyone tries to read your mind."
              : self?.pendingActivation
                ? "You'll enter the scoring game at the next round boundary."
                : "Your phone is now a controller. Keep this tab open."}
        </p>
        <div className="mini-roster">
          {snapshot.players
            .filter((player) => player.role === "player")
            .map((player) => (
              <span
                key={player.id}
                title={`${player.nickname}${player.bot ? " (bot)" : ""}`}
              >
                <Avatar
                  playerId={player.id} index={player.avatar}
                  color={player.color}
                  config={player.avatarConfig}
                  size="small"
                />
              </span>
            ))}
        </div>
        <small>Waiting for the host…</small>
      </section>

    </>
  );
}

function FoolLobbyPhone({ snapshot, avatarButton, hostAct }: { snapshot: PlayerSnapshot; avatarButton: React.ReactNode; hostAct: (type: HostAction["type"], payload?: Record<string, unknown>) => Promise<void> }) {
  const self = snapshot.players.find((player) => player.id === snapshot.selfId);
  const players = snapshot.players.filter((player) => player.role === "player");
  const humanLobbySlots = new Set(players.filter((player) => player.active && !player.bot).map((player) => player.lobbySlot).filter((slot): slot is number => Number.isInteger(slot)));
  const openBotSeats = Array.from({ length: 10 }, (_, index) => index + 1).filter((seat) => !humanLobbySlots.has(seat));
  const [shared, setShared] = useState(false);
  const shareRoom = async () => {
    const url = `${window.location.origin}/play/${snapshot.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "Join Bowl of Fools", text: `Join my Bowl of Fools room with code ${snapshot.code}`, url });
      else await navigator.clipboard.writeText(`${snapshot.code} · ${url}`);
      setShared(true);
      window.setTimeout(() => setShared(false), 1800);
    } catch { /* Closing the share sheet is not an error. */ }
  };
  return <section className="phone-content fool-lobby-phone">
    <div className="fool-host-badge">{snapshot.isHostPlayer ? "♛ YOU ARE HOST + PLAYER" : "✓ YOU'RE IN"}</div>
    <div className="fool-room-code"><small>ROOM CODE</small><strong>{snapshot.code}</strong><button type="button" onClick={() => void shareRoom()}>{shared ? "Copied!" : "Share"}</button></div>
    <div className="lobby-avatar-hero">{self && <Avatar playerId={self.id} index={self.avatar} color={self.color} config={self.avatarConfig} size="large" label={`${self.nickname}'s avatar`} />}{avatarButton}</div>
    <h1>{snapshot.isHostPlayer ? `Your court is gathering, ${self?.nickname}.` : `${self?.nickname}, you're in the bowl.`}</h1>
    <p>{snapshot.isHostPlayer ? "Share the code, or add local practice players below. Your phone stays in the game." : "Keep this phone open. The host will shuffle everyone into two teams."}</p>
    <div className="fool-lobby-roster" aria-label={`${players.length} joined players`}>{players.map((player) => <div key={player.id}><Avatar playerId={player.id} index={player.avatar} color={player.color} config={player.avatarConfig} size="small" /><strong>{player.nickname}</strong><small>{player.id === snapshot.selfId ? "YOU" : "JOINED"}</small></div>)}</div>
    {snapshot.isHostPlayer && <section className="fool-lobby-bots" aria-label="Local bot seats"><h2>Practice players</h2><p>Bots count toward the four-player minimum. Turn any bot seat off to make room for a phone.</p><div>{openBotSeats.map((seat) => { const enabled = (snapshot.botSeats ?? []).includes(seat); return <BotSwitch key={seat} number={seat} enabled={enabled} disabled={!enabled && players.length >= 10} onChange={(next) => void hostAct("SET_BOT_SEAT", { seat, enabled: next })} />; })}</div></section>}
    <p className="fool-player-count"><b>{players.length}</b>/10 players joined</p>
    {snapshot.isHostPlayer ? <button className="button button-primary phone-button fool-form-teams" disabled={players.length < 4} onClick={() => void hostAct("START_GAME")}>{players.length < 4 ? `Waiting for ${4 - players.length} more` : "Shuffle teams"}<span aria-hidden="true">→</span></button> : <div className="fool-waiting-host"><span /><span /><span /> Waiting for the host</div>}
    <small>Four players minimum · bots count · no desktop or shared TV needed</small>
  </section>;
}

function SoloHostControls({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: HostAction["type"],
    payload?: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const finished = ["FINAL_RESULTS", "POST_GAME"].includes(snapshot.phase);
  const canTime = Boolean(snapshot.deadlineAt || snapshot.paused);
  const bowlHost = snapshot.gameLength === "bowl-of-fools" && snapshot.isHostPlayer;
  return (
    <details className={`solo-host-dock ${bowlHost ? "fool-host-dock" : ""}`}>
      <summary>
        <span>
          <b>{snapshot.developerMode ? "DEV" : bowlHost ? "♛" : "SOLO"}</b> Host controls
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div>
        {bowlHost && snapshot.foolBowl && !["FOOL_TEAM_SETUP", "INTRO", "ROUND_INTRO", "FOOL_WRITING"].includes(snapshot.phase) && <div className="fool-score-editor"><strong>Correct score</strong>{(["BELLS", "MOTLEY"] as const).map((team) => <span key={team}><small>{team === "BELLS" ? "Bells" : "Motley"}</small><button type="button" aria-label={`Remove a point from ${team}`} onClick={() => void act("ADJUST_FOOL_SCORE", { team, delta: -1 })}>−</button><b>{snapshot.foolBowl!.teamScores[team]}</b><button type="button" aria-label={`Add a point to ${team}`} onClick={() => void act("ADJUST_FOOL_SCORE", { team, delta: 1 })}>+</button></span>)}</div>}
        {finished && snapshot.gameLength !== "bowl" && snapshot.gameLength !== "royal-war-room" && snapshot.gameLength !== "birthday" ? (
          <button type="button" onClick={() => void act("PLAY_AGAIN")}>
            ↶ Play again
          </button>
        ) : finished ? (
          <p>This archived pack cannot be replayed. Start a room with one of the active games.</p>
        ) : (
          <>
            {bowlHost && <button type="button" disabled={!snapshot.foolBowl?.lastResult} onClick={() => void act("UNDO_FOOL_POINT")}>↶ Undo last Correct</button>}
            <button
              type="button"
              disabled={!canTime}
              onClick={() => void act(snapshot.paused ? "RESUME" : "PAUSE")}
            >
              {snapshot.paused ? "▶ Resume" : "Ⅱ Pause"}
            </button>
            <button
              type="button"
              disabled={!canTime}
              onClick={() => void act("ADD_TIME", { seconds: 15 })}
            >
              +15 sec
            </button>
            <button
              type="button"
              disabled={["FOOL_TEAM_SETUP", "POST_GAME", "ENDED"].includes(snapshot.phase)}
              onClick={() => void act("SKIP")}
            >
              Skip phase →
            </button>
          </>
        )}
      </div>
    </details>
  );
}

function AnswerTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const count = graphemeCount(answer.trim());
  const comicMode = snapshot.roundKind === "COMIC_FRAME";
  const mysteryMode = snapshot.roundKind === "KING_REQUEST_MYSTERY";
  const rumourMode = snapshot.roundKind === "ROYAL_RUMOURS";
  const pictureMode =
    [
      "PROMPT_AND_CIRCUMSTANCE",
      "KING_PROMPTER_FINAL",
      "KING_REQUEST_MYSTERY",
      "ROYAL_RUMOURS",
    ].includes(snapshot.roundKind ?? "") || comicMode;
  const wordCount = answer.trim() ? answer.trim().split(/\s+/u).length : 0;
  const wordLimit = mysteryMode || rumourMode ? 18 : 19;
  const taskData = snapshot.taskData as {
    memoryTrail?: Array<{ id: string; kind: string; text: string }>;
    restorationSlotId?: string | null;
    kingRequestPoll?: {
      choices: Array<{ id: string; label: string }>;
      selectedChoiceId: string | null;
    };
  } | null;
  const storyLabels: Record<string, string> = {
    ANCHOR: "HERO",
    VOICE: "MOTTO",
    WORLD: "RULE",
    CONSEQUENCE: "DISASTER",
  };
  if (snapshot.submitted && taskData?.kingRequestPoll)
    return <KingRequestPoll data={taskData.kingRequestPoll} act={act} />;
  if (snapshot.submitted) return <LockedTask snapshot={snapshot} act={act} />;
  const recipe = comicMode
    ? snapshot.roundNumber === 1
      ? ["Character", "Problem", "Place"]
      : snapshot.roundNumber === 2
        ? ["Same cast", "Escalate", "Complicate"]
        : ["Punchline", "Visual twist", "Commit"]
    : mysteryMode || rumourMode
      ? ["Subject", "Strange action", "One vivid detail"]
      : ["Subject", "Action", "Style or place"];
  const placeholder = comicMode
    ? snapshot.roundNumber === 3
      ? "The punchline panel…"
      : "Show what happens next…"
    : mysteryMode
      ? "The King arm-wrestled his aunt during a thunderstorm"
      : rumourMode
        ? "The Queen secretly races geese after midnight"
        : pictureMode
          ? "A royal corgi DJ on the moon, neon storybook style"
          : snapshot.roundKind === "THE_REMIX"
            ? "LOCAL HERO SAVES CITY, IMMEDIATELY BANNED FROM CITY"
            : "Type something the room will remember…";
  return (
    <section
      className={`phone-content answer-task ${pictureMode ? "picture-answer-task" : ""} ${comicMode ? "comic-answer-task" : ""} ${mysteryMode ? "mystery-answer-task" : ""}`}
    >
      <p className="round-label">
        {roundTitle(
          snapshot.roundKind,
          snapshot.players.some((player) => player.birthdayVip),
        )}
        {comicMode ? ` · Panel ${snapshot.roundNumber}` : ""}
      </p>
      {comicMode && <PhoneComicStrip snapshot={snapshot} />}
      {snapshot.roundKind === "KING_PROMPTER_FINAL" && snapshot.restoration && (
        <RestorationPortrait
          code={snapshot.code}
          restoration={snapshot.restoration}
          compact
        />
      )}
      <h1>{snapshot.prompt}</h1>
      {mysteryMode && (
        <p className="phone-task-callout">
          Keep the incident secret. Your friends will see only the reconstructed
          evidence painting, then identify your genuine report among their cover
          stories.
        </p>
      )}
      {rumourMode && (
        <p className="phone-task-callout">
          Keep it secret. AI illustrates your words, then another player
          describes the picture without seeing what you wrote.
        </p>
      )}
      {taskData?.restorationSlotId && (
        <p className="phone-task-callout">
          Your torn section:{" "}
          <strong>
            {taskData.restorationSlotId
              .replace(/([A-Z])/g, " $1")
              .toLowerCase()}
          </strong>
        </p>
      )}
      {snapshot.instruction && (
        <div className="phone-catch">
          <strong>
            {comicMode
              ? "PANEL GUIDE"
              : pictureMode
                ? "THE ROYAL RULE"
                : snapshot.roundKind === "THE_REMIX"
                  ? "STORY RECIPE"
                  : "The Catch"}
          </strong>
          {snapshot.instruction}
        </div>
      )}
      {pictureMode && (
        <div className="prompt-recipe" aria-label="Strong prompt recipe">
          {recipe.map((label, index) => (
            <span key={label}>
              <b>{index + 1}</b> {label}
            </span>
          ))}
        </div>
      )}
      {taskData?.memoryTrail?.length ? (
        <div
          className="memory-trail-phone"
          aria-label="Tonight's story ingredients"
        >
          {taskData.memoryTrail.map((item) => (
            <span key={item.id}>
              <small>{storyLabels[item.kind] ?? item.kind}</small>“{item.text}”
            </span>
          ))}
        </div>
      ) : null}
      <label className="sr-only" htmlFor="creative-answer">
        {rumourMode
          ? "Your royal rumour"
          : mysteryMode
            ? "Your incident report"
            : "Your answer"}
      </label>
      <textarea
        id="creative-answer"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder={placeholder}
        rows={5}
        maxLength={pictureMode ? 180 : 400}
      />
      <div
        className={`input-count ${(pictureMode ? wordCount > wordLimit : count > 90) ? "count-over" : ""}`}
      >
        {pictureMode
          ? `${wordCount} words · ${Math.max(0, wordLimit - wordCount)} left`
          : `${count}/90`}
      </div>
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={
            count < 1 || (pictureMode ? wordCount > wordLimit : count > 90)
          }
          onClick={() => void act("SUBMIT_ANSWER", { answer })}
        >
          Lock{" "}
          {comicMode
            ? "panel"
            : mysteryMode
              ? "incident report"
              : rumourMode
                ? "rumour"
                : pictureMode
                  ? "prompt"
                  : snapshot.roundKind === "THE_REMIX"
                    ? "headline"
                    : "answer"}
        </button>
        <small>
          {comicMode && snapshot.roundNumber === 3
            ? "The punchline ballot is worth the most."
            : mysteryMode
              ? "18 words maximum. Specific enough to reconstruct; flexible enough to frame."
              : rumourMode
                ? "18 words maximum. Make it clear enough to picture—and easy to misunderstand."
                : pictureMode
                  ? "Under 20 words. Specific beats complicated."
                  : "Final means final. Make it count."}
        </small>
      </div>
    </section>
  );
}

function KingRequestPoll({
  data,
  act,
}: {
  data: {
    choices: Array<{ id: string; label: string }>;
    selectedChoiceId: string | null;
  };
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  return (
    <section className="phone-content locked-task">
      <div className="lock-mark" aria-hidden="true">
        ✓
      </div>
      <p className="eyebrow">Prompt locked</p>
      <h1>Your Squire is painting.</h1>
      <p>
        Optional: help choose what the King requests next. You may change your
        vote until the round closes.
      </p>
      <div className="king-request-poll">
        <h2>Next royal commission</h2>
        <p>No bonus points—just creative influence.</p>
        {data.choices.map((choice) => (
          <button
            type="button"
            className={data.selectedChoiceId === choice.id ? "selected" : ""}
            key={choice.id}
            onClick={() =>
              void act("SUBMIT_KING_REQUEST_VOTE", { choiceId: choice.id })
            }
          >
            {choice.label}
          </button>
        ))}
      </div>
      <small>
        When every player locks a prompt, a three-second countdown begins.
      </small>
    </section>
  );
}

type RoyalRumourTaskData = {
  royalRumours?: {
    assignedSourceAnswerId?: string | null;
    assignedImage?: {
      status: string;
      assetId?: string;
      conceptTitle?: string;
      conceptCaption?: string;
    } | null;
    submitted?: boolean;
    voteOptions?: string[];
    voted?: boolean;
  };
} | null;

function RoyalRumourImage({
  code,
  image,
  alt,
}: {
  code: string;
  image?: {
    status: string;
    assetId?: string;
    conceptTitle?: string;
    conceptCaption?: string;
  } | null;
  alt: string;
}) {
  const url =
    image?.status === "READY" && image.assetId
      ? `/api/rooms/${code}/media/${image.assetId}`
      : null;
  return (
    <div className="rumour-image">
      {url ? (
        <Image src={url} width={800} height={800} unoptimized alt={alt} />
      ) : (
        <div className="phone-concept-tile">
          <b>{image?.conceptTitle ?? "Rumour painting"}</b>
          <small>
            {image?.conceptCaption ??
              "The image department left a suspiciously vague sketch."}
          </small>
        </div>
      )}
    </div>
  );
}

function RoyalRumourGuessTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [guess, setGuess] = useState("");
  const data = snapshot.taskData as RoyalRumourTaskData;
  const words = guess.trim() ? guess.trim().split(/\s+/u).length : 0;
  if (snapshot.submitted || data?.royalRumours?.submitted)
    return (
      <section className="phone-content locked-task">
        <div className="lock-mark" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Interpretation passed on</p>
        <h1>That is officially the next rumour.</h1>
        <p>AI is waiting to illustrate what you thought you saw.</p>
      </section>
    );
  if (!data?.royalRumours?.assignedImage)
    return (
      <WaitCard
        kicker="Royal Rumours"
        title="No painting reached you."
        copy="The game will continue with the completed chains."
      />
    );
  return (
    <section className="phone-content answer-task rumour-guess-task">
      <p className="round-label">The rumour reached you</p>
      <RoyalRumourImage
        code={snapshot.code}
        image={data.royalRumours.assignedImage}
        alt="An anonymous AI painting to interpret"
      />
      <h1>What do you think this picture means?</h1>
      <p>
        You cannot see the original words. Describe only what you believe
        happened.
      </p>
      <label className="sr-only" htmlFor="rumour-guess">
        Your interpretation
      </label>
      <textarea
        id="rumour-guess"
        value={guess}
        onChange={(event) => setGuess(event.target.value)}
        rows={4}
        maxLength={180}
        placeholder="The King lost a dance contest to three angry geese"
      />
      <div className={`input-count ${words > 18 ? "count-over" : ""}`}>
        {words} words · {Math.max(0, 18 - words)} left
      </div>
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={!guess.trim() || words > 18}
          onClick={() => void act("SUBMIT_ROYAL_RUMOUR_GUESS", { guess })}
        >
          Pass on this interpretation
        </button>
        <small>
          No peeking, explaining, or correcting. The misunderstanding is the
          game.
        </small>
      </div>
    </section>
  );
}

function RoyalRumourChain({
  snapshot,
  compact = false,
}: {
  snapshot: PlayerSnapshot;
  compact?: boolean;
}) {
  const chain = snapshot.rumours?.chains[0];
  if (!chain) return null;
  const starter = snapshot.players.find(
    (player) => player.id === chain.originalAuthorId,
  );
  const interpreter = snapshot.players.find(
    (player) => player.id === chain.guessAuthorId,
  );
  return (
    <div
      className={`royal-rumour-chain ${compact ? "royal-rumour-chain-compact" : ""}`}
    >
      <article>
        <span>1 · ORIGINAL WHISPER</span>
        <blockquote>“{chain.originalText}”</blockquote>
        <small>{starter?.nickname ?? "Unknown starter"}</small>
      </article>
      <article>
        <span>2 · AI PICTURED IT</span>
        <RoyalRumourImage
          code={snapshot.code}
          image={chain.firstImage}
          alt="First AI interpretation of the rumour"
        />
      </article>
      <article>
        <span>3 · SOMEONE GUESSED</span>
        <blockquote>“{chain.guessText}”</blockquote>
        <small>{interpreter?.nickname ?? "Unknown interpreter"}</small>
      </article>
      <article>
        <span>4 · AI PICTURED THAT</span>
        <RoyalRumourImage
          code={snapshot.code}
          image={chain.secondImage}
          alt="Second AI interpretation of the rumour"
        />
      </article>
    </div>
  );
}

function RoyalRumourRevealTask({ snapshot }: { snapshot: PlayerSnapshot }) {
  return (
    <section className="phone-content rumour-reveal-phone">
      <p className="round-label">
        Rumour{" "}
        {Math.min(
          (snapshot.rumours?.revealIndex ?? 0) + 1,
          snapshot.rumours?.totalChains ?? 0,
        )}{" "}
        of {snapshot.rumours?.totalChains ?? 0}
      </p>
      <h1>Here is how the story changed.</h1>
      <RoyalRumourChain snapshot={snapshot} compact />
    </section>
  );
}

function RoyalRumourVoteTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const data = snapshot.taskData as RoyalRumourTaskData;
  const eligible = new Set(data?.royalRumours?.voteOptions ?? []);
  if (snapshot.submitted || data?.royalRumours?.voted)
    return (
      <section className="phone-content locked-task">
        <div className="lock-mark" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Favourite mutation locked</p>
        <h1>The rumour mill has spoken.</h1>
      </section>
    );
  if (!eligible.size)
    return (
      <WaitCard
        kicker="Royal abstention"
        title="You helped make every eligible chain."
        copy="You cannot vote for a rumour you started or interpreted."
      />
    );
  return (
    <section className="phone-content rumour-vote-phone">
      <p className="round-label">Final vote</p>
      <h1>Which rumour changed in the funniest way?</h1>
      <p>You cannot vote for a chain you started or interpreted.</p>
      <div className="rumour-vote-list">
        {snapshot.rumours?.chains
          .filter((chain) => eligible.has(chain.sourceAnswerId))
          .map((chain, index) => (
            <button
              type="button"
              className={selected === chain.sourceAnswerId ? "selected" : ""}
              key={chain.sourceAnswerId}
              onClick={() => setSelected(chain.sourceAnswerId)}
            >
              <span>CHAIN {index + 1}</span>
              <strong>“{chain.originalText}”</strong>
              <b>became</b>
              <em>“{chain.guessText}”</em>
            </button>
          ))}
      </div>
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={!selected}
          onClick={() => void act("SUBMIT_VOTE", { answerIds: [selected] })}
        >
          Crown this mutation
        </button>
        <small>Interpreter +500 per vote · original starter +250.</small>
      </div>
    </section>
  );
}

type MysteryTaskData = {
  kingMystery?: {
    originalAuthor: boolean;
    submittedDecoy: boolean;
    submittedDecoySealed: boolean;
    royalSealAvailable: boolean;
    voted: boolean;
    options: Array<{ id: string; text: string }>;
  };
} | null;

function MysteryPainting({ snapshot }: { snapshot: PlayerSnapshot }) {
  const image = snapshot.mystery?.featuredImage;
  const imageUrl =
    image?.status === "READY" && image.assetId
      ? `/api/rooms/${snapshot.code}/media/${image.assetId}`
      : null;
  return (
    <div className="phone-mystery-painting">
      {imageUrl ? (
        <Image
          src={imageUrl}
          width={700}
          height={700}
          unoptimized
          alt={`Evidence painting ${snapshot.mystery?.turnNumber ?? ""}`}
        />
      ) : (
        <div className="phone-concept-tile">
          <b>{image?.conceptTitle ?? "Evidence painting"}</b>
          <small>
            {image?.conceptCaption ??
              "The enchanted frame insists this reconstruction is admissible."}
          </small>
        </div>
      )}
      <span>
        CASE {snapshot.mystery?.turnNumber ?? 0} /{" "}
        {snapshot.mystery?.totalTurns ?? 0}
      </span>
    </div>
  );
}

function MysteryDecoyTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [decoy, setDecoy] = useState("");
  const [useRoyalSeal, setUseRoyalSeal] = useState(false);
  const data = snapshot.taskData as MysteryTaskData;
  const words = decoy.trim() ? decoy.trim().split(/\s+/u).length : 0;
  if (data?.kingMystery?.originalAuthor)
    return (
      <section className="phone-content mystery-phone mystery-sitout">
        <p className="round-label">Your evidence is under investigation</p>
        <MysteryPainting snapshot={snapshot} />
        <h1>Look innocent.</h1>
        <p>
          You filed the genuine incident report, so you sit out while everyone
          else invents a cover story.
        </p>
        <small>
          {data.kingMystery.royalSealAvailable
            ? "Your Royal Seal remains available for a later case."
            : "Your Royal Seal has already been used."}
        </small>
        <div className="waiting-dots" aria-label="Waiting">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  if (snapshot.submitted || data?.kingMystery?.submittedDecoy)
    return (
      <section className="phone-content mystery-phone locked-task">
        <div className="lock-mark" aria-hidden="true">
          {data?.kingMystery?.submittedDecoySealed ? <Crown state="advancing" /> : "✓"}
        </div>
        <p className="eyebrow">Cover story filed</p>
        <MysteryPainting snapshot={snapshot} />
        <h1>
          {data?.kingMystery?.submittedDecoySealed
            ? "The Royal Seal is committed."
            : "Keep a straight face."}
        </h1>
        <p>
          Your false report is mixed with the genuine one. Next, identify the
          truth without seeing your own cover story.
        </p>
      </section>
    );
  return (
    <section className="phone-content mystery-phone answer-task">
      <p className="round-label">File a cover story</p>
      <MysteryPainting snapshot={snapshot} />
      <h1>What else could have caused this evidence?</h1>
      <p>
        Invent a believable incident report that fits the painting but differs
        from the truth.
      </p>
      <label className="sr-only" htmlFor="mystery-decoy">
        False incident report
      </label>
      <textarea
        id="mystery-decoy"
        rows={4}
        maxLength={180}
        value={decoy}
        onChange={(event) => setDecoy(event.target.value)}
        placeholder="The royal tax collector discovered a haunted turnip"
      />
      <div className={`input-count ${words > 18 ? "count-over" : ""}`}>
        {words} words · {Math.max(0, 18 - words)} left
      </div>
      {data?.kingMystery?.royalSealAvailable ? (
        <label
          className={`royal-seal-toggle ${useRoyalSeal ? "selected" : ""}`}
        >
          <input
            type="checkbox"
            checked={useRoyalSeal}
            onChange={(event) => setUseRoyalSeal(event.target.checked)}
          />
          <span aria-hidden="true">♛</span>
          <strong>Use your Royal Seal</strong>
          <small>
            One use this match. Your cover story earns 750 instead of 500 per
            investigator fooled.
          </small>
        </label>
      ) : (
        <div className="royal-seal-spent">
          <span aria-hidden="true">♛</span>
          <p>
            <strong>Royal Seal already used</strong>
            <small>
              This cover story still earns 500 per investigator fooled.
            </small>
          </p>
        </div>
      )}
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={!decoy.trim() || words > 18}
          onClick={() => void act("SUBMIT_KING_DECOY", { decoy, useRoyalSeal })}
        >
          {useRoyalSeal ? "Seal and file cover story" : "File cover story"}
        </button>
        <small>
          {useRoyalSeal
            ? "+750 for every investigator fooled."
            : "+500 for every investigator fooled."}
        </small>
      </div>
    </section>
  );
}

function MysteryVoteTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const data = snapshot.taskData as MysteryTaskData;
  if (data?.kingMystery?.originalAuthor)
    return (
      <section className="phone-content mystery-phone mystery-sitout">
        <p className="round-label">Your evidence · your report</p>
        <MysteryPainting snapshot={snapshot} />
        <h1>You already know what happened.</h1>
        <p>
          Watch the room investigate your suspiciously precise incident report.
        </p>
        <div className="waiting-dots" aria-label="Waiting">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  if (snapshot.submitted || data?.kingMystery?.voted)
    return (
      <section className="phone-content mystery-phone locked-task">
        <div className="lock-mark" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Verdict locked</p>
        <MysteryPainting snapshot={snapshot} />
        <h1>No changing your testimony.</h1>
        <p>
          The genuine report, every cover story, and every Royal Seal will be
          exposed.
        </p>
      </section>
    );
  const options = data?.kingMystery?.options ?? [];
  return (
    <section className="phone-content mystery-phone mystery-vote-phone">
      <p className="round-label">Royal inquest</p>
      <MysteryPainting snapshot={snapshot} />
      <h1>Which incident report is genuine?</h1>
      <p>
        Your cover story is hidden. Royal Seals are also concealed until the
        case closes.
      </p>
      <div className="mystery-phone-options">
        {options.map((option, index) => (
          <button
            type="button"
            className={selected === option.id ? "selected" : ""}
            key={option.id}
            onClick={() => setSelected(option.id)}
          >
            <span>{String.fromCharCode(65 + index)}</span>
            <blockquote>“{option.text}”</blockquote>
          </button>
        ))}
      </div>
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={!selected}
          onClick={() =>
            void act("SUBMIT_KING_MYSTERY_VOTE", { choiceId: selected })
          }
        >
          Lock verdict
        </button>
        <small>+500 points if you identify the true report.</small>
      </div>
    </section>
  );
}

function MysteryRevealTask({ snapshot }: { snapshot: PlayerSnapshot }) {
  const mystery = snapshot.mystery;
  const result = mystery?.result;
  if (!mystery || !result)
    return (
      <WaitCard
        kicker="Opening the royal file"
        title="Case pending…"
        copy="The reveal is arriving on the big screen."
      />
    );
  const isAuthor = result.originalAuthorId === snapshot.selfId;
  const correct = result.correctPlayerIds.includes(snapshot.selfId);
  const ownDecoyId = Object.entries(result.choiceAuthors).find(
    ([, authorId]) => authorId === snapshot.selfId,
  )?.[0];
  const fooled = ownDecoyId
    ? (result.fooledByChoice[ownDecoyId]?.length ?? 0)
    : 0;
  const author = snapshot.players.find(
    (player) => player.id === result.originalAuthorId,
  );
  const ownDecoySealed = Boolean(
    ownDecoyId && result.sealedChoiceIds.includes(ownDecoyId),
  );
  const personalResult = isAuthor
    ? `${result.correctPlayerIds.length} investigator${result.correctPlayerIds.length === 1 ? "" : "s"} read your evidence correctly. You earned ${Math.min(750, result.correctPlayerIds.length * 250)} clarity points.`
    : correct
      ? "You found the genuine incident report. +500 points."
      : fooled > 0
        ? `Your ${ownDecoySealed ? "sealed " : ""}cover story fooled ${fooled} investigator${fooled === 1 ? "" : "s"}. +${fooled * (ownDecoySealed ? 750 : 500)} points.`
        : "The cover stories framed you this time.";
  return (
    <section className="phone-content mystery-phone mystery-reveal-phone">
      <p className="round-label">
        Case closed · Evidence {mystery.turnNumber}/{mystery.totalTurns}
      </p>
      <MysteryPainting snapshot={snapshot} />
      <div className="mystery-genuine-phone">
        <span>THE GENUINE INCIDENT REPORT</span>
        <blockquote>“{result.originalRequest}”</blockquote>
        {author && (
          <div>
            <Avatar
              index={author.avatar}
              color={author.color}
              config={author.avatarConfig}
              size="small"
            />
            <strong>{author.nickname}</strong>
          </div>
        )}
      </div>
      <p
        className={
          correct || fooled > 0 || isAuthor ? "mystery-personal-win" : ""
        }
      >
        {personalResult}
      </p>
      <div className="mystery-phone-results">
        {mystery.options.map((option) => {
          const real = option.id === result.realChoiceId;
          const sealed = result.sealedChoiceIds.includes(option.id);
          const choiceAuthorId = result.choiceAuthors[option.id];
          const choiceAuthor = choiceAuthorId
            ? snapshot.players.find((player) => player.id === choiceAuthorId)
            : author;
          const votes = Object.values(result.votes).filter(
            (choiceId) => choiceId === option.id,
          ).length;
          return (
            <article
              className={`${real ? "real" : ""} ${sealed ? "sealed" : ""}`}
              key={option.id}
            >
              <span>
                {real
                  ? "✓ TRUE REPORT"
                  : sealed
                    ? `♛ SEALED · ${result.fooledByChoice[option.id]?.length ?? 0} FOOLED`
                    : `${result.fooledByChoice[option.id]?.length ?? 0} FOOLED`}
              </span>
              <blockquote>“{option.text}”</blockquote>
              <footer>
                <strong>{choiceAuthor?.nickname ?? "Unknown"}</strong>
                <b>
                  {votes} vote{votes === 1 ? "" : "s"}
                </b>
              </footer>
            </article>
          );
        })}
      </div>
      <p>Next evidence painting begins automatically.</p>
    </section>
  );
}

function ChoiceTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  if (snapshot.submitted) return <LockedTask snapshot={snapshot} act={act} />;
  const crowd = snapshot.roundKind === "CROWD_CONTROL";
  const birthday = snapshot.roundKind === "BIRTHDAY_BETS";
  const data = snapshot.taskData as {
    birthdayName?: string;
    isBirthdayPerson?: boolean;
  } | null;
  return (
    <section
      className={`phone-content choice-task ${birthday ? "birthday-choice-task" : ""}`}
    >
      <p className="round-label">
        {birthday ? "Birthday Bets" : crowd ? "Crowd Control" : "Read the Room"}{" "}
        ·{" "}
        {birthday && !data?.isBirthdayPerson
          ? "Make your prediction"
          : "Your answer"}
      </p>
      <h1>{snapshot.prompt}</h1>
      <p>
        {birthday
          ? data?.isBirthdayPerson
            ? "Pick your real answer. Everyone else is trying to read your mind."
            : `What will ${data?.birthdayName ?? "the birthday VIP"} choose?`
          : crowd
            ? "Choose the player who fits best."
            : "Pick the chip that represents your personal answer."}
      </p>
      <div className="chip-grid">
        {snapshot.choices.map((choice) => (
          <button
            type="button"
            key={choice.id}
            onClick={() =>
              void act("SUBMIT_PERSONAL_CHOICE", { choiceId: choice.id })
            }
          >
            {choice.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function evenPrediction(count: number): number[] {
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function PredictionTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const data = snapshot.taskData as { predictionLabels?: string[] } | null;
  const labels = data?.predictionLabels?.length
    ? data.predictionLabels
    : Array.from({ length: 10 }, (_, index) => `${index * 10}%`);
  const [values, setValues] = useState(() => evenPrediction(labels.length));
  if (snapshot.submitted) return <LockedTask snapshot={snapshot} act={act} />;
  const total = values.reduce((sum, value) => sum + value, 0);
  const crowd = snapshot.roundKind === "CROWD_CONTROL";
  return (
    <section className="phone-content prediction-task">
      <p className="round-label">
        {crowd ? "Crowd Control" : "Read the Room"} · Predict everyone
      </p>
      <h1>Where will the room land?</h1>
      <p>
        Distribute exactly 100% across {crowd ? "the players" : "the ten chips"}
        .
      </p>
      <div className="prediction-list">
        {values.map((value, index) => (
          <label key={labels[index]}>
            <span>{labels[index]}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={5}
              value={value}
              onChange={(event) =>
                setValues((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? Math.max(0, Math.min(100, Number(event.target.value)))
                      : item,
                  ),
                )
              }
            />
          </label>
        ))}
      </div>
      <div className={`prediction-total ${total === 100 ? "total-good" : ""}`}>
        Total <strong>{total}%</strong>
      </div>
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={total !== 100}
          onClick={() => void act("SUBMIT_PREDICTION", { values })}
        >
          Lock prediction
        </button>
      </div>
    </section>
  );
}

function AuthorTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const data = snapshot.taskData as {
    answers: Array<{ id: string; text: string }>;
    authors: Array<{ id: string; label: string }>;
  };
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const promptMatch = ["PROMPT_AND_CIRCUMSTANCE", "COMIC_FRAME"].includes(
    snapshot.roundKind ?? "",
  );
  const usedAuthors = new Set(Object.values(guesses));
  const complete =
    Object.keys(guesses).length === data.answers.length &&
    (!promptMatch || usedAuthors.size === data.answers.length);
  if (snapshot.submitted) return <LockedTask snapshot={snapshot} act={act} />;
  return (
    <section
      className={`phone-content author-task ${promptMatch ? "prompt-author-task" : ""}`}
    >
      <p className="round-label">
        {promptMatch ? "Who Prompted That?" : "Who Said That?"}
      </p>
      <h1>
        {promptMatch
          ? "Match every prompt to its writer."
          : "Match each answer to a friend."}
      </h1>
      {promptMatch && (
        <p>Use each player once. The images are developing while you guess.</p>
      )}
      {data.answers.length ? (
        data.answers.map((answer, index) => (
          <label className="guess-card" key={answer.id}>
            <span>
              {promptMatch ? "Prompt" : "Answer"} {index + 1}
            </span>
            <blockquote>“{answer.text}”</blockquote>
            <select
              value={guesses[answer.id] ?? ""}
              onChange={(event) =>
                setGuesses((current) => ({
                  ...current,
                  [answer.id]: event.target.value,
                }))
              }
            >
              <option value="">Choose a player…</option>
              {data.authors.map((author) => (
                <option
                  value={author.id}
                  key={author.id}
                  disabled={
                    promptMatch &&
                    usedAuthors.has(author.id) &&
                    guesses[answer.id] !== author.id
                  }
                >
                  {author.label}
                </option>
              ))}
            </select>
          </label>
        ))
      ) : (
        <p>No eligible mystery prompts this time.</p>
      )}
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={!complete}
          onClick={() => void act("SUBMIT_AUTHOR_GUESSES", { guesses })}
        >
          Lock matches
        </button>
        <small>
          {promptMatch
            ? "100 points for every correct match."
            : "One guess for every mystery answer."}
        </small>
      </div>
    </section>
  );
}

function WagerTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const data = snapshot.taskData as {
    targets: Array<{ id: string; label: string }>;
  };
  const [target, setTarget] = useState("");
  const [wager, setWager] = useState<100 | 250 | 500>(250);
  if (snapshot.submitted) return <LockedTask snapshot={snapshot} act={act} />;
  return (
    <section className="phone-content wager-task">
      <p className="round-label">Final Read</p>
      <h1>Who will write the room&apos;s favorite answer?</h1>
      <p>Predict another player, then put points behind it.</p>
      <div className="target-grid">
        {data.targets.map((item) => (
          <button
            className={target === item.id ? "selected" : ""}
            key={item.id}
            onClick={() => setTarget(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <fieldset className="wager-options">
        <legend>Your wager</legend>
        {([100, 250, 500] as const).map((amount) => (
          <button
            className={wager === amount ? "selected" : ""}
            key={amount}
            onClick={() => setWager(amount)}
          >
            {amount}
          </button>
        ))}
      </fieldset>
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={!target}
          onClick={() =>
            void act("SUBMIT_WAGER", { targetPlayerId: target, wager })
          }
        >
          Lock prediction
        </button>
      </div>
    </section>
  );
}

function VoteTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot | AudienceSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  if (snapshot.submitted) return <LockedTask snapshot={snapshot} act={act} />;
  const activePlayers = snapshot.players.filter(
    (player) => player.role === "player" && player.active,
  ).length;
  const comicVote = snapshot.roundKind === "COMIC_FRAME";
  const kingVote = [
    "PROMPT_AND_CIRCUMSTANCE",
    "KING_PROMPTER_FINAL",
    "COMIC_FRAME",
  ].includes(snapshot.roundKind ?? "");
  const crownFavoriteVote = snapshot.roundKind === "KING_PROMPTER_FINAL";
  const imageVote =
    kingVote && snapshot.answerOrder.some((answer) => answer.image);
  const ranked =
    !kingVote &&
    snapshot.role === "player" &&
    activePlayers >= 4 &&
    snapshot.answerOrder.length >= 2;
  const eligibleAnswers = snapshot.answerOrder.filter(
    (answer) => answer.voteEligible !== false,
  );
  const required =
    snapshot.role === "audience"
      ? 1
      : ["PROMPT_AND_CIRCUMSTANCE", "KING_PROMPTER_FINAL"].includes(
            snapshot.roundKind ?? "",
          )
        ? Math.min(1, eligibleAnswers.length)
        : kingVote
          ? Math.min(3, eligibleAnswers.length)
          : ranked
            ? 2
            : 1;
  const toggle = (id: string) => {
    if (!eligibleAnswers.some((answer) => answer.id === id)) return;
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < required
          ? [...current, id]
          : [...current.slice(1), id],
    );
  };
  if (required === 0)
    return (
      <WaitCard
        kicker="Royal abstention"
        title="All of these are yours."
        copy="You cannot vote for yourself. The rest of the room will decide."
      />
    );
  const placeCopy = crownFavoriteVote
    ? "Pick the funniest restored section. The full collage stays on the castle wall."
    : "Choose your favorite.";
  const voteLabel = comicVote
    ? `Panel ${snapshot.roundNumber} image vote · ${snapshot.roundNumber === 3 ? "PUNCHLINE BONUS" : snapshot.roundNumber === 2 ? "BIGGER POINTS" : "BUILD THE STRIP"}`
    : imageVote
      ? snapshot.roundKind === "KING_PROMPTER_FINAL"
        ? "Royal Restoration · 300 points per vote"
        : `Canvas ${snapshot.roundNumber} · ${snapshot.roundNumber === 2 ? 150 : 100} points per vote`
      : kingVote
        ? "Image vote"
        : snapshot.role === "audience"
          ? "Audience favorite"
          : ranked
            ? "Rank two answers"
            : "Pick a favorite";
  return (
    <section
      className={`phone-content vote-task ${kingVote ? "picture-vote-task" : ""} ${imageVote ? "king-image-vote" : ""} ${comicVote ? "comic-vote-task" : ""}`}
    >
      {comicVote && <PhoneComicStrip snapshot={snapshot} />}
      <p className="round-label">{voteLabel}</p>
      <h1>
        {kingVote
          ? placeCopy
          : ranked
            ? "First pick gets 2. Second gets 1."
            : "Which answer wins your applause?"}
      </h1>
      {comicVote && (
        <p>
          Rank the pictures by how well they continue the comic. The winner
          fills this panel.
        </p>
      )}
      <div className="phone-answer-list">
        {snapshot.answerOrder.map((answer) => {
          const rank = selected.indexOf(answer.id);
          const ownImage = answer.voteEligible === false;
          const imageUrl =
            answer.image?.status === "READY" && answer.image.assetId
              ? `/api/rooms/${snapshot.code}/media/${answer.image.assetId}`
              : null;
          return (
            <button
              className={`${rank >= 0 ? "selected" : ""} ${ownImage ? "own-image" : ""}`}
              key={answer.id}
              onClick={() => toggle(answer.id)}
              disabled={ownImage}
            >
              <span>{ownImage ? "YOU" : rank >= 0 ? rank + 1 : ""}</span>
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  width={600}
                  height={600}
                  unoptimized
                  alt={
                    ownImage
                      ? "Your generated image; visible but not eligible for your vote"
                      : comicVote
                        ? `Candidate comic panel ${snapshot.roundNumber}`
                        : "Generated prompt entry"
                  }
                />
              ) : answer.image ? (
                <div className="phone-concept-tile">
                  <b>{answer.image.conceptTitle}</b>
                  <small>
                    {answer.image.status === "QUEUED" ||
                    answer.image.status === "GENERATING"
                      ? "Finishing…"
                      : answer.image.conceptCaption}
                  </small>
                </div>
              ) : (
                <blockquote>{answer.text}</blockquote>
              )}
              {answer.image && (
                <small className="vote-prompt-caption">{answer.text}</small>
              )}
              {ownImage && (
                <small className="own-image-label">
                  Your image · visible, voting disabled
                </small>
              )}
            </button>
          );
        })}
      </div>
      <div className="sticky-submit">
        <button
          className="button button-primary phone-button"
          disabled={selected.length !== required}
          onClick={() => void act("SUBMIT_VOTE", { answerIds: selected })}
        >
          Lock{" "}
          {snapshot.role === "audience"
            ? "favorite"
            : crownFavoriteVote
              ? "favorite"
              : kingVote || ranked
                ? "ranking"
                : "vote"}
        </button>
      </div>
    </section>
  );
}

function LockedTask({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot | AudienceSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const ownAnswer = snapshot.role === "player" ? snapshot.ownAnswer : null;
  if (
    snapshot.roundKind === "KING_REQUEST_MYSTERY" &&
    snapshot.phase === "IMAGE_REVEAL"
  )
    return (
      <section className="phone-content solo-concept-reveal mystery-workshop-phone">
        <p className="eyebrow">Royal Evidence Vault</p>
        <div className="solo-concept-mark" aria-hidden="true">
          ⚖
        </div>
        <h1>
          {snapshot.imageJobsPending
            ? "Reconstructing every secret incident…"
            : "The case files are ready."}
        </h1>
        <p>
          No evidence painting enters the inquest until its image is confirmed.
          Then each case receives cover stories and one genuine report.
        </p>
        <small>
          {snapshot.soloMode && !snapshot.soloLiveImages
            ? "Quota-free solo play uses deterministic private-safe concept cards."
            : "Failed generations automatically retry on the next configured model."}
        </small>
      </section>
    );
  if (
    snapshot.roundKind === "KING_PROMPTER_FINAL" &&
    snapshot.phase === "IMAGE_REVEAL" &&
    snapshot.restoration
  )
    return (
      <section className="phone-content solo-concept-reveal">
        <p className="eyebrow">Royal Restoration</p>
        <h1>
          {snapshot.imageJobsPending
            ? "The Squires are patching history…"
            : "The portrait is whole. Mostly."}
        </h1>
        <RestorationPortrait
          code={snapshot.code}
          restoration={snapshot.restoration}
          compact
        />
        <p>
          Every square is generated normally, cropped beneath a reusable torn
          mask, and layered around the unchanged King.
        </p>
      </section>
    );
  if (
    snapshot.roundKind === "PROMPT_AND_CIRCUMSTANCE" &&
    snapshot.phase === "IMAGE_REVEAL"
  )
    return (
      <section className="phone-content solo-concept-reveal">
        <p className="eyebrow">The gallery is opening</p>
        <div className="solo-concept-mark" aria-hidden="true">
          ♛
        </div>
        <h1>
          {snapshot.imageJobsPending
            ? "Finishing every image…"
            : "Every canvas is ready."}
        </h1>
        <p>
          The next vote is worth double. Judge the picture, not just the words
          behind it.
        </p>
        <small>
          {snapshot.soloMode
            ? snapshot.soloLiveImages
              ? "Your prompt and every bot prompt are being generated live."
              : "Quota-free solo play uses deterministic concept cards."
            : "Keep this phone open while the gallery loads."}
        </small>
        {snapshot.role === "player" && (
          <FeedbackDuel snapshot={snapshot} act={act} />
        )}
      </section>
    );
  if (snapshot.roundKind === "COMIC_FRAME" && snapshot.phase === "IMAGE_REVEAL")
    return (
      <section className="phone-content solo-concept-reveal comic-concept-reveal">
        <p className="eyebrow">Panel {snapshot.roundNumber} is developing</p>
        <PhoneComicStrip snapshot={snapshot} />
        <div className="solo-concept-mark" aria-hidden="true">
          ▣
        </div>
        <h1>
          {snapshot.imageJobsPending
            ? "Drawing every idea…"
            : "The panel gallery is ready."}
        </h1>
        <p>
          Next, rank the images. The favorite becomes panel{" "}
          {snapshot.roundNumber} of the comic.
        </p>
        <small>
          {snapshot.soloMode
            ? snapshot.soloLiveImages
              ? "Your panel and every bot panel are being generated live."
              : "Quota-free solo play uses deterministic concept cards."
            : "Keep this phone open while the art finishes."}
        </small>
        {snapshot.role === "player" && (
          <FeedbackDuel snapshot={snapshot} act={act} />
        )}
      </section>
    );
  return (
    <section className="phone-content locked-task">
      <div className="lock-mark" aria-hidden="true">
        ✓
      </div>
      <p className="eyebrow">✓ Locked in</p>
      <h1>
        {snapshot.role === "audience"
          ? "Favorite saved."
          : ownAnswer
            ? `“${ownAnswer}”`
            : "You're all set."}
      </h1>
      <p>
        {snapshot.soloMode
          ? "Your response is safe if you refresh. The reveal will appear right here."
          : "Look at the big screen. Your response is safe if you refresh."}
      </p>
      {snapshot.role === "player" && (
        <FeedbackDuel snapshot={snapshot} act={act} />
      )}
    </section>
  );
}

function FeedbackDuel({
  snapshot,
  act,
}: {
  snapshot: PlayerSnapshot;
  act: (
    type: PlayerAction["type"],
    payload: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (
    ["pictures", "king-mystery", "royal-rumours", "royal-war-room"].includes(
      snapshot.gameLength,
    )
  )
    return null;
  const feedback = snapshot.feedback;
  const cooldown = Math.max(
    0,
    Math.ceil((feedback.nextAvailableAt - now) / 1000),
  );
  const vote = async (choiceId: "a" | "b") => {
    if (!feedback.pair || cooldown > 0 || busy) return;
    setBusy(true);
    try {
      await act("SUBMIT_FEEDBACK_VOTE", { pairId: feedback.pair.id, choiceId });
    } finally {
      setBusy(false);
    }
  };
  if (!feedback.pair)
    return (
      <div className="feedback-duel feedback-complete">
        <span aria-hidden="true"><Crown state="advancing" /></span>
        <strong>You steered every upcoming round.</strong>
        <small>
          {feedback.completedCount}/{feedback.totalCount} direction votes
          completed.
        </small>
      </div>
    );
  return (
    <section className="feedback-duel" aria-label="Steer upcoming game rounds">
      <header>
        <div>
          <small>STEER WHAT COMES NEXT</small>
          <strong>Pick a direction · +{feedback.rewardPoints} points</strong>
        </div>
        <span>
          {feedback.completedCount}/{feedback.totalCount}
        </span>
      </header>
      <h2>{feedback.pair.question}</h2>
      <div className="feedback-options">
        {feedback.pair.options.map((option) => (
          <button
            type="button"
            key={option.id}
            disabled={cooldown > 0 || busy}
            onClick={() => void vote(option.id)}
          >
            <small>OPTION {option.id.toUpperCase()}</small>
            <strong>{option.text}</strong>
          </button>
        ))}
      </div>
      <footer>
        {cooldown > 0 ? (
          <>
            <span className="feedback-cooldown" aria-hidden="true" />
            <strong>Next vote in {cooldown}s</strong>
            <small>Read both options while the timer cools down.</small>
          </>
        ) : (
          <>
            <strong>Your room is writing the next round.</strong>
            <small>
              Winning directions influence this game mode&apos;s upcoming
              prompts.
            </small>
          </>
        )}
      </footer>
    </section>
  );
}

function RevealTask({
  snapshot,
}: {
  snapshot: PlayerSnapshot | AudienceSnapshot;
}) {
  const results = (snapshot.results ?? {}) as {
    answerAuthors?: Record<string, string>;
    official?: Record<string, number>;
    audience?: Record<string, number>;
    totals?: Record<string, number>;
    kind?: string;
    correctChoiceId?: string;
    options?: Array<{ id: string; label: string }>;
    correctPlayerIds?: string[];
    birthdayName?: string;
    authorGuessCorrectByPlayer?: Record<string, number>;
  };
  const ranking = snapshot.players
    .filter((player) => player.role === "player")
    .sort(
      (a, b) =>
        (results.totals?.[b.id] ?? b.score ?? 0) -
        (results.totals?.[a.id] ?? a.score ?? 0),
    );
  const birthdayResult = results.kind === "birthday_bets";
  const correct = results.correctPlayerIds?.includes(snapshot.selfId) ?? false;
  const revealAnswers =
    snapshot.role === "player" ? snapshot.revealAnswers : [];
  return (
    <section
      className={`phone-content reveal-task ${birthdayResult ? "birthday-phone-reveal" : ""} ${snapshot.soloMode ? "solo-phone-reveal" : ""}`}
    >
      <p className="round-label">Round reveal</p>
      <h1>
        {birthdayResult
          ? `${results.birthdayName} chose ${results.options?.find((choice) => choice.id === results.correctChoiceId)?.label ?? "the surprise option"}.`
          : snapshot.roundKind === "COMIC_FRAME"
            ? `Panel ${snapshot.roundNumber} is locked!`
            : snapshot.soloMode
              ? "The room has spoken."
              : "Look up!"}
      </h1>
      {snapshot.roundKind === "COMIC_FRAME" && (
        <PhoneComicStrip snapshot={snapshot} />
      )}
      <p>
        {birthdayResult
          ? snapshot.players.find((player) => player.id === snapshot.selfId)
              ?.birthdayVip
            ? "Your answer separated the mind readers from the wild guessers."
            : correct
              ? "You called it. +900 points."
              : "That birthday brain remains a mystery."
          : snapshot.roundKind === "COMIC_FRAME"
            ? snapshot.roundNumber === 3
              ? "The punchline completes the strip. Final scores are next."
              : "The winning panel becomes the setup for the next round."
            : snapshot.soloMode
              ? "Here are every answer, author, and applause point."
              : "The answers, authors, and applause are on the big screen."}
      </p>
      {snapshot.soloMode &&
        revealAnswers.length > 0 &&
        snapshot.roundKind !== "COMIC_FRAME" && (
          <div className="solo-reveal-answers">
            {[...revealAnswers]
              .sort((a, b) => b.applause - a.applause)
              .map((answer) => {
                const author = snapshot.players.find(
                  (player) => player.id === answer.authorId,
                );
                return (
                  <article key={answer.id}>
                    <blockquote>“{answer.text}”</blockquote>
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
                          {author.bot && <span>BOT</span>}
                        </>
                      )}
                      <b>{answer.applause} applause</b>
                    </footer>
                  </article>
                );
              })}
          </div>
        )}
      <div className="phone-score-list">
        {ranking.slice(0, snapshot.soloMode ? 10 : 5).map((player, index) => (
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
            <b>
              {(
                results.totals?.[player.id] ??
                player.score ??
                0
              ).toLocaleString()}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhoneComicStrip({
  snapshot,
}: {
  snapshot: PlayerSnapshot | AudienceSnapshot;
}) {
  return (
    <div className="phone-comic-strip" aria-label="Comic progress">
      {[1, 2, 3].map((frameNumber) => {
        const frame = snapshot.comicFrames.find(
          (item) => item.frameNumber === frameNumber,
        );
        const imageUrl =
          frame?.image.status === "READY" && frame.image.assetId
            ? `/api/rooms/${snapshot.code}/media/${frame.image.assetId}`
            : null;
        return (
          <article className={frame ? "filled" : ""} key={frameNumber}>
            <span>{frameNumber}</span>
            {imageUrl ? (
              <Image
                src={imageUrl}
                width={320}
                height={320}
                unoptimized
                alt={`Winning comic panel ${frameNumber}`}
              />
            ) : (
              <div>
                <b>
                  {frameNumber === 1
                    ? "SETUP"
                    : frameNumber === 2
                      ? "NEXT"
                      : "PUNCHLINE"}
                </b>
              </div>
            )}
            {frame && <small>{frame.prompt}</small>}
          </article>
        );
      })}
    </div>
  );
}

export function FinalPhoneResults({
  snapshot,
  hostAct,
}: {
  snapshot: PlayerSnapshot | AudienceSnapshot;
  hostAct: (
    type: HostAction["type"],
    payload?: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const players = snapshot.players
    .filter((player) => player.role === "player")
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const high = players[0]?.score ?? 0;
  const winners = players.filter((player) => player.score === high);
  const selfWins = winners.some((player) => player.id === snapshot.selfId);
  const birthday = "gameLength" in snapshot && snapshot.gameLength === "birthday";
  const classicBowl = "gameLength" in snapshot && snapshot.gameLength === "bowl";
  const archived = birthday || classicBowl || ("gameLength" in snapshot && snapshot.gameLength === "royal-war-room");
  const comic = snapshot.comicFrames.length > 0;
  const mystery =
    "gameLength" in snapshot && snapshot.gameLength === "king-mystery";
  const rumours =
    "gameLength" in snapshot && snapshot.gameLength === "royal-rumours";
  const results = (snapshot.results ?? {}) as {
    awards?: Array<{ title: string; playerIds: string[]; caption: string }>;
    loreGallery?: { nodes: Array<{ id: string; kind: string; text: string }> };
  };
  if ("gameLength" in snapshot && snapshot.gameLength === "bowl-of-fools" && snapshot.foolBowl) {
    const bowl = snapshot.foolBowl;
    const winner = bowl.winner ?? (bowl.teamScores.BELLS === bowl.teamScores.MOTLEY ? null : bowl.teamScores.BELLS > bowl.teamScores.MOTLEY ? "BELLS" : "MOTLEY");
    const ownTeam = bowl.teams[snapshot.selfId] ?? null;
    return <section className="phone-content final-phone fool-phone-final"><div className="lock-mark" aria-hidden="true">♛</div><p className="eyebrow">The bowl is empty</p><h1>{winner === null ? "The score is tied" : ownTeam === winner ? "Your team wears the crown!" : `Team ${winner === "BELLS" ? "Bells" : "Motley"} wins`}</h1><div className="fool-final-score"><span><small>BELLS</small><b>{bowl.teamScores.BELLS}</b></span><i>FINAL</i><span><small>MOTLEY</small><b>{bowl.teamScores.MOTLEY}</b></span></div>{winner && <div className="fool-winner-roster">{snapshot.players.filter((player) => bowl.teams[player.id] === winner).map((player) => <span key={player.id}><Avatar playerId={player.id} index={player.avatar} color={player.color} config={player.avatarConfig} size="small" /><strong>{player.nickname}</strong></span>)}</div>}<p>{winner === null ? "The host can correct the score from Host controls." : bowl.suddenDeath ? "One final anonymous scroll broke the tie." : "Three passes through the same bowl. Far too much nonsense remembered."}</p>{snapshot.isHostPlayer && <button className="button button-primary phone-button" onClick={() => void hostAct("PLAY_AGAIN")}>Refill the bowl</button>}</section>;
  }
  if (
    "gameLength" in snapshot &&
    snapshot.gameLength === "royal-war-room" &&
    snapshot.warRoom
  ) {
    const war = snapshot.warRoom;
    const ownTeam = war.teams[snapshot.selfId] ?? null;
    const highBanners = Math.max(war.teamScores.LION, war.teamScores.RAVEN);
    const winningTeams = (["LION", "RAVEN"] as const).filter(
      (team) => war.teamScores[team] === highBanners,
    );
    const ownWin = ownTeam ? winningTeams.includes(ownTeam) : false;
    return (
      <section className="phone-content final-phone war-phone war-phone-final">
        <div className="lock-mark" aria-hidden="true">
          {war.campaign === "ATTACK" ? "⚔" : "♜"}
        </div>
        <p className="eyebrow">
          {war.campaign === "ATTACK" ? "Castle conquered" : "Castle held"}
        </p>
        <h1>
          {ownWin
            ? "Your council won!"
            : `${winningTeams.join(" & ")} Council wins`}
        </h1>
        <div className="war-phone-score">
          <span>
            LION <b>{war.teamScores.LION}</b>
          </span>
          <span>
            RAVEN <b>{war.teamScores.RAVEN}</b>
          </span>
        </div>
        <p>This archived pack cannot be replayed. Start a room with one of the active games.</p>
      </section>
    );
  }
  return (
    <section
      className={`phone-content final-phone ${snapshot.soloMode ? "solo-final-phone" : ""}`}
    >
      <div className="lock-mark" aria-hidden="true">
        {rumours
          ? "☞"
          : mystery
            ? "?"
            : comic
              ? "▣"
              : selfWins
                ? <Crown state="overall-champion" />
                : birthday
                  ? "30"
                  : "↶"}
      </div>
      <p className="eyebrow">Final results</p>
      <h1>
        {selfWins
          ? "You won!"
          : `${winners.map((player) => player.nickname).join(" & ")} won`}
      </h1>
      <p>
        {snapshot.soloMode
          ? `${high.toLocaleString()} points. Your complete playtest results are below.`
          : `${high.toLocaleString()} points. The big screen has ${rumours ? "the crowned mutation and rumour honors" : mystery ? "the final case-file honors" : comic ? "the finished comic" : birthday ? "the party awards" : "Tonight's Lore"}.`}
      </p>
      {comic && (
        <>
          <p className="comic-theme-line">{snapshot.comicTheme}</p>
          <PhoneComicStrip snapshot={snapshot} />
        </>
      )}
      {snapshot.soloMode && (
        <>
          <div className="phone-score-list solo-final-scores">
            {players.map((player, index) => (
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
                <b>{(player.score ?? 0).toLocaleString()}</b>
              </div>
            ))}
          </div>
          {results.awards?.length ? (
            <div className="solo-awards">
              <h2>Room awards</h2>
              {results.awards.slice(0, 4).map((award) => (
                <article key={award.title}>
                  <strong>{award.title}</strong>
                  <p>
                    {award.playerIds
                      .map(
                        (id) =>
                          players.find((player) => player.id === id)?.nickname,
                      )
                      .filter(Boolean)
                      .join(" & ")}{" "}
                    · {award.caption}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
          {!birthday &&
          !comic &&
          !mystery &&
          !rumours &&
          results.loreGallery?.nodes?.length ? (
            <div className="solo-lore">
              <h2>Tonight&apos;s Lore</h2>
              {results.loreGallery.nodes.map((node) => (
                <blockquote key={node.id}>
                  <small>{node.kind}</small>“{node.text}”
                </blockquote>
              ))}
            </div>
          ) : null}
          {!archived && <button
            className="button button-primary phone-button"
            onClick={() => void hostAct("PLAY_AGAIN")}
          >
            Play again
          </button>}
        </>
      )}
      {!snapshot.soloMode && snapshot.phase === "POST_GAME" && (
        <small>
          Waiting for Play Again
          {birthday || comic || mystery || rumours
            ? "…"
            : " or Monster Factory…"}
        </small>
      )}
    </section>
  );
}

function WaitCard({
  kicker,
  title,
  copy,
}: {
  kicker: string;
  title: string;
  copy: string;
}) {
  return (
    <section className="phone-content wait-card">
      <p className="round-label">{kicker}</p>
      <div className="rewind-phone" aria-hidden="true">
        ↶
      </div>
      <h1>{title}</h1>
      <p>{copy}</p>
      <div className="waiting-dots" aria-label="Waiting">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
function roundTitle(kind: RoleSnapshot["roundKind"], birthday = false) {
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
  return (birthday ? party : regular)[kind ?? ""] ?? "Get ready";
}
