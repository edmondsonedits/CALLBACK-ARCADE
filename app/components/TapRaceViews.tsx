"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import type { ArcadeWireSnapshot } from "../../lib/arcade/presentation";

type Racer = { playerId: string; progress: number; tapCount?: number };
type TapRaceState = { status?: string; courseLength?: number; racers?: Racer[]; viewer?: { role?: string; playerId?: string | null } };

const COLORS = ["#46dbdc", "#ffd84b", "#ffad72", "#c9a7ff", "#81e6a5", "#ff8fab"];

export function TapRaceHost({ game, names, connection, paused, onPauseToggle, busy = false }: {
  game: ArcadeWireSnapshot | null;
  names: Record<string, string> | ReadonlyMap<string, string>;
  connection: string;
  paused: boolean;
  onPauseToggle: () => void;
  busy?: boolean;
}) {
  const state = (game?.state ?? {}) as TapRaceState;
  const racers = Array.isArray(state.racers) ? state.racers.filter(isRacer) : [];
  const finish = Number.isFinite(state.courseLength) && state.courseLength! > 0 ? state.courseLength! : 100;
  const done = state.status === "complete";
  const nameFor = (id: string) => {
    const map = names as ReadonlyMap<string, string>;
    return typeof map.get === "function" ? map.get(id) ?? "Player" : (names as Record<string, string>)[id] ?? "Player";
  };
  const leaders = racers.filter((racer) => racer.progress >= finish).map((racer) => nameFor(racer.playerId));

  return <section className="arcade-live tap-race-live" aria-label="Tap Race host screen">
    <style>{`
      .tap-race-lanes{display:grid;align-content:center;gap:clamp(9px,1.8vh,18px);width:min(92vw,1180px);min-height:0;overflow:auto;padding:clamp(10px,2vh,24px);border:1px solid rgba(255,255,255,.15);border-radius:24px;background:rgba(5,12,31,.58)}
      .tap-race-lane{display:grid;grid-template-columns:minmax(110px,18%) minmax(0,1fr);align-items:center;gap:14px;min-height:clamp(48px,7vh,72px)}
      .tap-race-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800;font-size:clamp(.78rem,1.3vw,1.1rem)}
      .tap-race-track{position:relative;height:clamp(34px,5.4vh,54px);overflow:hidden;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 2px,transparent 2px 10%)}
      .tap-race-progress{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:linear-gradient(90deg,rgba(70,219,220,.17),rgba(70,219,220,.04));transition:width .16s linear}
      .tap-race-runner{position:absolute;top:50%;left:var(--progress-percent);display:grid;place-items:center;width:34px;height:34px;border-radius:50%;transform:translate(-50%,-50%);background:var(--runner-color);box-shadow:0 0 20px color-mix(in srgb,var(--runner-color) 45%,transparent);transition:left .16s linear}
      .tap-race-runner:after{content:"";width:11px;height:11px;border-radius:50%;background:#111a3a;box-shadow:0 -8px 0 -2px #111a3a,0 8px 0 -2px #111a3a}
      .tap-race-finish{position:absolute;inset:0 5px 0 auto;width:8px;border-inline:2px dashed rgba(255,248,223,.9);background:repeating-linear-gradient(135deg,rgba(255,216,75,.7) 0 4px,transparent 4px 8px)}
      .tap-race-host-status{display:flex;align-items:center;justify-content:center;gap:clamp(12px,3vw,32px);flex-wrap:wrap}
      .tap-race-host-status strong{color:#ffd84b;font:700 clamp(1rem,2vw,1.5rem) "Fredoka Variable",sans-serif}
      .tap-race-lane:focus-within .tap-race-track{outline:2px solid #fff}
      @media(prefers-reduced-motion:reduce){.tap-race-runner,.tap-race-progress{transition:none}}
      @media(max-width:600px){.tap-race-lane{grid-template-columns:minmax(76px,25%) minmax(0,1fr);gap:8px}}
    `}</style>
    <div className="arcade-scoreboard tap-race-scoreboard" aria-label="Race progress">
      <div className="tap-race-lanes">
        {racers.map((racer, index) => {
          const ratio = Math.max(0, Math.min(1, racer.progress / finish));
          const color = COLORS[index % COLORS.length]!;
          return <div className="tap-race-lane" key={racer.playerId}>
            <span className="tap-race-name">{nameFor(racer.playerId)}</span>
            <div className="tap-race-track" role="progressbar" aria-label={`${nameFor(racer.playerId)} race progress`} aria-valuemin={0} aria-valuemax={finish} aria-valuenow={Math.min(finish, racer.progress)}>
              <span className="tap-race-progress" style={{ width: `${ratio * 100}%`, background: `linear-gradient(90deg, ${color}33, ${color}11)` }} />
              <span className="tap-race-runner" aria-hidden="true" style={{ "--progress-percent": `${ratio * 100}%`, "--runner-color": color } as CSSProperties} />
              <span className="tap-race-finish" aria-hidden="true" />
            </div>
          </div>;
        })}
      </div>
    </div>
    <div className="tap-race-host-status">
      <span role="status" className="arcade-connection">{connection === "live" ? "LIVE" : connection === "unavailable" ? "RECONNECTING" : "CONNECTING"}</span>
      {done && <strong role="status">{leaders.length > 1 ? `Tie: ${leaders.join(" & ")}` : `${leaders[0] ?? "Race"} wins!`}</strong>}
      <button type="button" onClick={onPauseToggle} disabled={busy || done}>{paused ? "Resume" : "Pause"}</button>
    </div>
  </section>;
}

export function TapRacePhone({ game, connection, role, paused = false, onTap }: {
  game: ArcadeWireSnapshot | null;
  connection: string;
  role: "player" | "spectator" | "host" | undefined;
  paused?: boolean;
  onTap: () => void;
}) {
  const state = (game?.state ?? {}) as TapRaceState;
  const viewerId = state.viewer?.playerId;
  const me = state.racers?.find((racer) => isRacer(racer) && racer.playerId === viewerId);
  const finish = Number.isFinite(state.courseLength) && state.courseLength! > 0 ? state.courseLength! : 100;
  const progress = me && isRacer(me) ? Math.min(finish, me.progress) : 0;
  const canTap = role === "player" && connection === "live" && !paused && state.status === "active" && Boolean(me);
  const holdRepeat = (event: KeyboardEvent<HTMLButtonElement>) => { if (event.repeat) event.preventDefault(); };

  return <section className="arcade-phone-card tap-race-phone" aria-label="Tap Race controller">
    <p className="arcade-kicker">TAP RACE</p>
    <h1>Race to the finish</h1>
    <p>Tap as fast as you can. Your progress updates live on the big screen.</p>
    <div className="tap-race-phone-progress" role="progressbar" aria-label="Your race progress" aria-valuemin={0} aria-valuemax={finish} aria-valuenow={progress}>
      <span style={{ width: `${(progress / finish) * 100}%` }} />
    </div>
    <p className="tap-race-phone-count">{progress} / {finish}</p>
    <button type="button" className="tap-race-tap-button" disabled={!canTap} onKeyDown={holdRepeat} onClick={onTap} aria-label="Tap to move your racer">
      {state.status === "complete" ? "Race complete" : paused ? "Race paused" : role !== "player" ? "Watch the race" : connection === "live" ? "TAP TO SPRINT" : "Reconnecting…"}
    </button>
    <p role="status" className="arcade-connection">{connection === "live" ? "Connected to your room" : connection === "unavailable" ? "Reconnecting to the race…" : "Connecting to the race…"}</p>
    <style>{`
      .tap-race-phone{justify-content:flex-start;padding-top:calc(28px + env(safe-area-inset-top));text-align:center}
      .tap-race-phone h1{font-size:clamp(1.9rem,8vw,2.6rem)}
      .tap-race-phone-progress{width:100%;height:16px;overflow:hidden;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(5,12,31,.7)}
      .tap-race-phone-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#46dbdc,#ffd84b);transition:width .16s linear}
      .tap-race-phone-count{margin:0!important;color:#ffd84b!important;font-weight:800;font-variant-numeric:tabular-nums}
      .tap-race-tap-button{flex:1;width:100%;min-height:200px;max-height:45dvh;border:2px solid rgba(255,248,223,.7);border-radius:30px;background:radial-gradient(ellipse at 50% 28%,#ffed92,#ffd84b 48%,#e58b35 100%);color:#171b39;font:900 clamp(1.8rem,8vw,3rem)/1 "Space Grotesk Variable",Arial,sans-serif;letter-spacing:.04em;box-shadow:0 14px 0 #9c582d,0 22px 36px #02091c88;touch-action:manipulation;user-select:none;-webkit-tap-highlight-color:transparent;transition:transform .08s,box-shadow .08s}
      .tap-race-tap-button:active:not(:disabled){transform:translateY(7px);box-shadow:0 7px 0 #9c582d,0 13px 28px #02091c88}
      .tap-race-tap-button:disabled{opacity:.62;cursor:not-allowed}
      .tap-race-tap-button:focus-visible{outline:3px solid white;outline-offset:5px}
      @media(prefers-reduced-motion:reduce){.tap-race-phone-progress span,.tap-race-tap-button{transition:none}}
    `}</style>
  </section>;
}

function isRacer(value: unknown): value is Racer {
  if (!value || typeof value !== "object") return false;
  const racer = value as Partial<Racer>;
  return typeof racer.playerId === "string" && Number.isFinite(racer.progress) && racer.progress! >= 0;
}
