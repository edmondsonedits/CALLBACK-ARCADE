"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  canPlayHostMusic,
  isHostMusicPhaseMessage,
  musicFadeProgress,
  SOUNDTRACK_VOLUME,
  isCurrentMusicPlayAttempt,
  type HostMusicPhaseMessage,
} from "../../lib/game/soundtrack";
import { approvedMusicGain, buildMusicPlaylist, latestMusicTarget, sequentialMusicFadeLevels, type HostMusicContext } from "../../lib/game/audio-policy";
import { MENU_PREFERENCES_STORAGE_KEY, loadMenuPreferences, parseMenuPreferences, persistMenuAudioPreferencesFromHost } from "./MenuSettingsDialog";
import { APPROVED_AUDIO } from "../../lib/game/audio-library";

const PHASE_EVENT = "king-prompter:host-music-phase";
const SETTINGS_EVENT = "king-prompter:host-music-settings";

type MusicTarget = { key: string; src: string; rotationIndex: number; context: HostMusicContext; gain: number };
type HostMusicSettings = { muted: boolean; music: boolean; musicVolume: number };
type MusicContextValue = { setPhase: (message: HostMusicPhaseMessage) => void; unlock: () => void };

const MusicContext = createContext<MusicContextValue | null>(null);

function readMenuSettings() {
  try {
    const preferences = loadMenuPreferences(window.localStorage);
    return { soundEnabled: preferences.soundEnabled, volume: preferences.volume };
  } catch {
    return { soundEnabled: true, volume: SOUNDTRACK_VOLUME };
  }
}

function notifyEmbeddedMusicSettings(soundEnabled: boolean, volume: number) {
  const frame = document.querySelector<HTMLIFrameElement>("iframe.session-game-frame");
  frame?.contentWindow?.postMessage({ type: "host-music-settings", muted: !soundEnabled, music: true, musicVolume: volume }, window.location.origin);
}

export function HostMusicProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const firstAudio = useRef<HTMLAudioElement>(null);
  const secondAudio = useRef<HTMLAudioElement>(null);
  const ambienceAudio = useRef<HTMLAudioElement>(null);
  const ambienceFrame = useRef<number | null>(null);
  const activeSlot = useRef<0 | 1>(0);
  const activeTarget = useRef<MusicTarget | null>(null);
  const menuIndex = useRef(0);
  const transitioning = useRef(false);
  const frame = useRef<number | null>(null);
  const playGeneration = useRef(0);
  const unlockAttemptPending = useRef(false);
  const environmentReady = useRef(false);
  const gestureRetried = useRef(false);
  const pendingTarget = useRef<MusicTarget | null>(null);
  const transitionToRef = useRef<((target: MusicTarget, retry?: boolean, authorizedGesture?: boolean) => void) | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(SOUNDTRACK_VOLUME);
  const [phoneDevice, setPhoneDevice] = useState(false);
  const [embedded, setEmbedded] = useState(true);
  const soundEnabledRef = useRef(soundEnabled);
  const volumeRef = useRef(volume);
  const ducked = useRef(false);
  const envelopes = useRef<[number, number]>([0, 0]);
  const [phase, setPhaseState] = useState<HostMusicPhaseMessage>({ type: "host-music-phase", phase: "menu" });
  const [ready, setReady] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const phaseRef = useRef<HostMusicPhaseMessage>({ type: "host-music-phase", phase: "menu" });
  const [controlTarget, setControlTarget] = useState<HTMLElement | null>(null);
  const hostSettingsRoute = /^\/session\/[^/]+\/(host|mirror)$/.test(pathname)
    || (pathname !== "/host/new" && /^\/host\/[^/]+$/.test(pathname))
    || /^\/display\/[^/]+$/.test(pathname)
    || /^\/arcade\/online\/host\/[^/]+$/.test(pathname);

  useEffect(() => {
    const findControlTarget = () => {
      const target = document.querySelector<HTMLElement>("[data-host-music-control]");
      setControlTarget((current) => current === target ? current : target);
    };
    findControlTarget();
    const observer = new MutationObserver(findControlTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  const playbackAllowed = canPlayHostMusic(pathname, embedded, phoneDevice);
  const effectivePhase = useMemo(
    () => playbackAllowed && !hostSettingsRoute ? { type: "host-music-phase", phase: "menu" as const } : phase,
    [hostSettingsRoute, phase, playbackAllowed],
  );

  const setPhase = useCallback((message: HostMusicPhaseMessage) => {
    const validMessage: HostMusicPhaseMessage = isHostMusicPhaseMessage(message) ? message : { type: "host-music-phase", phase: "menu" };
    phaseRef.current = validMessage;
    setPhaseState(validMessage);
  }, []);

  const audioFor = useCallback((slot: 0 | 1) => slot === 0 ? firstAudio.current : secondAudio.current, []);
  const setDucked = useCallback((active: boolean) => {
    ducked.current = active;
    const audio = audioFor(activeSlot.current);
    if (audio) audio.volume = (soundEnabledRef.current ? volumeRef.current * 0.55 * (activeTarget.current?.gain ?? 1) * (active ? 0.22 : 1) : 0) * envelopes.current[activeSlot.current];
  }, [audioFor]);

  const transitionTo = useCallback((target: MusicTarget, retry = false, authorizedGesture = false) => {
    if (transitioning.current && !retry) { pendingTarget.current = target; return; }
    const outgoingSlot = activeSlot.current;
    const outgoing = activeTarget.current ? audioFor(outgoingSlot) : null;
    if ((!playbackAllowed && !authorizedGesture) || (activeTarget.current?.key === target.key && !retry)) return;
    if (activeTarget.current?.src === target.src && !retry) {
      activeTarget.current = target;
      menuIndex.current = target.rotationIndex;
      return;
    }
    const attempt = ++playGeneration.current;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    pendingTarget.current = null;
    transitioning.current = true;
    const incomingSlot: 0 | 1 = outgoing || retry ? (outgoingSlot === 0 ? 1 : 0) : outgoingSlot;
    const incoming = audioFor(incomingSlot);
    if (!incoming) { transitioning.current = false; return; }
    const finish = () => {
      if (!isCurrentMusicPlayAttempt(attempt, playGeneration.current)) return;
      transitioning.current = false;
      frame.current = null;
      const queued = pendingTarget.current;
      pendingTarget.current = null;
      if (queued) queueMicrotask(() => transitionToRef.current?.(queued));
    };
    const fadeIn = () => {
      if (!isCurrentMusicPlayAttempt(attempt, playGeneration.current)) return;
      const incomingTarget = latestMusicTarget(target, pendingTarget.current);
      pendingTarget.current = null;
      incoming.pause();
      incoming.src = incomingTarget.src;
      incoming.loop = false;
      incoming.currentTime = 0;
      incoming.volume = 0;
      incoming.muted = !soundEnabledRef.current;
      void incoming.play().then(() => {
        if (!isCurrentMusicPlayAttempt(attempt, playGeneration.current)) { incoming.pause(); return; }
        if (pendingTarget.current && pendingTarget.current.key !== incomingTarget.key) {
          incoming.pause(); incoming.volume = 0; envelopes.current[incomingSlot] = 0; finish(); return;
        }
        unlockAttemptPending.current = false;
        gestureRetried.current = true;
        setPlaybackBlocked(false);
        const startedAt = performance.now();
        const duration = 900;
        const fade = (now: number) => {
          if (!isCurrentMusicPlayAttempt(attempt, playGeneration.current)) { incoming.pause(); return; }
          if (pendingTarget.current && pendingTarget.current.key !== incomingTarget.key) {
            incoming.pause(); incoming.volume = 0; envelopes.current[incomingSlot] = 0; finish(); return;
          }
          const progress = musicFadeProgress(now, startedAt, duration);
          const level = sequentialMusicFadeLevels("fade-in", progress, soundEnabledRef.current ? volumeRef.current * 0.55 * incomingTarget.gain * (ducked.current ? 0.22 : 1) : 0).incoming;
          envelopes.current[incomingSlot] = progress;
          incoming.volume = level;
          if (progress < 1) { frame.current = requestAnimationFrame(fade); return; }
          activeSlot.current = incomingSlot;
          activeTarget.current = incomingTarget;
          menuIndex.current = incomingTarget.rotationIndex;
          finish();
        };
        frame.current = requestAnimationFrame(fade);
      }).catch(() => {
        if (!isCurrentMusicPlayAttempt(attempt, playGeneration.current)) { incoming.pause(); return; }
        unlockAttemptPending.current = false;
        gestureRetried.current = false;
        incoming.pause();
        incoming.volume = 0;
        envelopes.current[incomingSlot] = 0;
        activeTarget.current = null;
        finish();
        setPlaybackBlocked(true);
      });
    };
    if (!outgoing || outgoing.paused) {
      if (outgoing) { outgoing.pause(); outgoing.volume = 0; envelopes.current[outgoingSlot] = 0; }
      fadeIn();
      return;
    }
    const startedAt = performance.now();
    const duration = 650;
    const fadeOut = (now: number) => {
      if (!isCurrentMusicPlayAttempt(attempt, playGeneration.current)) return;
      const progress = musicFadeProgress(now, startedAt, duration);
      const levels = sequentialMusicFadeLevels("fade-out", progress, soundEnabledRef.current ? volumeRef.current * 0.55 * (activeTarget.current?.gain ?? 1) * (ducked.current ? 0.22 : 1) : 0);
      envelopes.current[outgoingSlot] = 1 - progress;
      outgoing.volume = levels.outgoing;
      if (progress < 1) { frame.current = requestAnimationFrame(fadeOut); return; }
      outgoing.pause();
      outgoing.currentTime = 0;
      outgoing.volume = 0;
      envelopes.current[outgoingSlot] = 0;
      activeTarget.current = null;
      fadeIn();
    };
    frame.current = requestAnimationFrame(fadeOut);
  }, [audioFor, playbackAllowed]);
  useEffect(() => {
    transitionToRef.current = transitionTo;
  }, [transitionTo]);

  const musicTarget = useCallback((context: HostMusicContext, gameId: string, index = 0): MusicTarget => {
    const playlist = buildMusicPlaylist(context, gameId);
    const rotationIndex = ((index % playlist.length) + playlist.length) % playlist.length;
    const src = playlist[rotationIndex]!;
    return { key: `${context}:${gameId}:${rotationIndex}`, src, rotationIndex, context, gain: approvedMusicGain(src) };
  }, []);

  const unlockMusic = useCallback(() => {
    const phoneDeviceNow = window.matchMedia("(max-width: 700px) and (pointer: coarse)").matches;
    if (window.parent !== window || !canPlayHostMusic(pathname, false, phoneDeviceNow)) return;
    if (unlockAttemptPending.current) return;
    const currentAudio = audioFor(activeSlot.current);
    if (gestureRetried.current && currentAudio && !currentAudio.paused) return;

    const menuSettings = readMenuSettings();
    const enabled = menuSettings.soundEnabled;
    const nextVolume = menuSettings.volume;
    soundEnabledRef.current = enabled;
    volumeRef.current = nextVolume;
    setSoundEnabled(enabled);
    setVolume(nextVolume);
    if (!enabled) return;

    const message = phaseRef.current;
    const target = message.phase === "game" && message.gameId
      ? musicTarget(message.context ?? "game", message.gameId, menuIndex.current)
      : musicTarget("menu", "standard", menuIndex.current);
    unlockAttemptPending.current = true;
    transitionTo(target, true, true);
  }, [audioFor, musicTarget, pathname, transitionTo]);

  useEffect(() => {
    const phoneQuery = window.matchMedia("(max-width: 700px) and (pointer: coarse)");
    const updatePhone = () => setPhoneDevice(phoneQuery.matches);
    phoneQuery.addEventListener("change", updatePhone);
    window.queueMicrotask(() => {
      updatePhone();
      environmentReady.current = true;
      setEmbedded(window.parent !== window);
      const menuSettings = readMenuSettings();
      const enabled = menuSettings.soundEnabled;
      const nextVolume = menuSettings.volume;
      soundEnabledRef.current = enabled;
      volumeRef.current = nextVolume;
      setSoundEnabled(enabled);
      setVolume(nextVolume);
      setReady(true);
    });
    return () => phoneQuery.removeEventListener("change", updatePhone);
  }, [hostSettingsRoute]);

  useEffect(() => {
    if (!environmentReady.current) return;
    if (!ready || !playbackAllowed) {
      playGeneration.current += 1;
      unlockAttemptPending.current = false;
      activeTarget.current = null;
      pendingTarget.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      transitioning.current = false;
      for (const audio of [firstAudio.current, secondAudio.current]) {
        audio?.pause();
        if (audio) audio.volume = 0;
      }
      envelopes.current = [0, 0];
      return;
    }
    const current = effectivePhase.phase === "game" && effectivePhase.gameId
      ? musicTarget(effectivePhase.context ?? "game", effectivePhase.gameId, menuIndex.current)
      : musicTarget("menu", "standard", menuIndex.current);
    transitionTo(current);
  }, [effectivePhase, musicTarget, playbackAllowed, ready, transitionTo]);

  useEffect(() => {
    const first = firstAudio.current;
    const second = secondAudio.current;
    if (!first || !second) return;
    const onTimeUpdate = (event: Event) => {
      const audio = event.currentTarget as HTMLAudioElement;
      if (!playbackAllowed || transitioning.current || !activeTarget.current || audio !== audioFor(activeSlot.current) || !Number.isFinite(audio.duration)) return;
      if (audio.duration - audio.currentTime <= 1.1) {
        const context = activeTarget.current.context;
        const gameId = phaseRef.current.gameId ?? "standard";
        const playlist = buildMusicPlaylist(context, gameId);
        transitionTo(musicTarget(context, gameId, (menuIndex.current + 1) % playlist.length));
      }
    };
    const onEnded = (event: Event) => {
      if (transitioning.current || event.currentTarget !== audioFor(activeSlot.current) || !activeTarget.current) return;
      const context = activeTarget.current.context;
      const gameId = phaseRef.current.gameId ?? "standard";
      const playlist = buildMusicPlaylist(context, gameId);
      transitionTo(musicTarget(context, gameId, (menuIndex.current + 1) % playlist.length));
    };
    for (const audio of [first, second]) {
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("ended", onEnded);
    }
    return () => {
      for (const audio of [first, second]) {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("ended", onEnded);
      }
    };
  }, [audioFor, musicTarget, playbackAllowed, transitionTo]);

  useEffect(() => {
    const audio = ambienceAudio.current;
    const clip = APPROVED_AUDIO.find((item) => item.category === "ambience" && item.role === "tavern");
    if (!audio) return;
    if (ambienceFrame.current !== null) cancelAnimationFrame(ambienceFrame.current);
    ambienceFrame.current = null;
    const shouldPlay = Boolean(clip && ready && playbackAllowed && hostSettingsRoute && phase.phase === "menu" && soundEnabled);
    if (shouldPlay && clip) {
      if (!audio.src.endsWith(clip.src)) { audio.pause(); audio.src = clip.src; audio.currentTime = 0; audio.volume = 0; }
      audio.loop = true;
      audio.muted = false;
      const from = audio.volume;
      const startedAt = performance.now();
      void audio.play().then(() => {
        const fadeIn = (now: number) => {
          const progress = musicFadeProgress(now, startedAt, 600);
          audio.volume = Math.min(0.04, volume * 0.55 * Math.max(0, Math.min(1, clip.gain))) * progress + from * (1 - progress);
          if (progress < 1) ambienceFrame.current = requestAnimationFrame(fadeIn);
          else ambienceFrame.current = null;
        };
        ambienceFrame.current = requestAnimationFrame(fadeIn);
      }).catch(() => { audio.pause(); audio.volume = 0; });
    } else if (!audio.paused) {
      const from = audio.volume;
      const startedAt = performance.now();
      const fadeOut = (now: number) => {
        const progress = musicFadeProgress(now, startedAt, 350);
        audio.volume = from * (1 - progress);
        if (progress < 1) ambienceFrame.current = requestAnimationFrame(fadeOut);
        else { audio.pause(); audio.currentTime = 0; audio.volume = 0; ambienceFrame.current = null; }
      };
      ambienceFrame.current = requestAnimationFrame(fadeOut);
    }
    return () => { if (ambienceFrame.current !== null) cancelAnimationFrame(ambienceFrame.current); ambienceFrame.current = null; };
  }, [hostSettingsRoute, phase, playbackAllowed, ready, soundEnabled, volume]);

  useEffect(() => {
    const retryOnGesture = (event: Event) => {
      if ((event.target as Element | null)?.closest?.(".host-music-toggle")) return;
      unlockMusic();
    };
    window.addEventListener("pointerdown", retryOnGesture, { capture: true });
    window.addEventListener("keydown", retryOnGesture, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", retryOnGesture, true);
      window.removeEventListener("keydown", retryOnGesture, true);
    };
  }, [unlockMusic]);

  useEffect(() => {
    const onPhase = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isHostMusicPhaseMessage(detail)) setPhase(detail);
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      const frameElement = document.querySelector<HTMLIFrameElement>("iframe.session-game-frame");
      if (!frameElement?.contentWindow || event.source !== frameElement.contentWindow || event.origin !== window.location.origin) return;
      if (event.data && typeof event.data === "object" && (event.data as { type?: unknown }).type === "host-music-duck") {
        const message = event.data as { active?: unknown };
        if (typeof message.active === "boolean") setDucked(message.active);
      }
      if (isHostMusicPhaseMessage(event.data)) setPhase(event.data);
      if (event.data && typeof event.data === "object" && (event.data as { type?: unknown }).type === "host-music-settings") {
        const settings = event.data as HostMusicSettings;
        if (typeof settings.muted === "boolean" && typeof settings.music === "boolean" && typeof settings.musicVolume === "number" && Number.isFinite(settings.musicVolume)) {
          const enabled = settings.music && !settings.muted;
          const nextVolume = Math.max(0, Math.min(1, settings.musicVolume));
          try { persistMenuAudioPreferencesFromHost(window.localStorage, { ...settings, musicVolume: nextVolume }); } catch { /* Keep the live control responsive when storage is unavailable. */ }
          soundEnabledRef.current = enabled;
          volumeRef.current = nextVolume;
          setSoundEnabled(enabled);
          setVolume(nextVolume);
        }
      }
    };
    const onDuck = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: unknown; active?: unknown }>).detail;
      if (detail?.type === "host-music-duck" && typeof detail.active === "boolean") setDucked(detail.active);
    };
    const onSettings = (event: Event) => {
      const settings = (event as CustomEvent<unknown>).detail;
      if (settings && typeof settings === "object" && typeof (settings as HostMusicSettings).muted === "boolean" && typeof (settings as HostMusicSettings).music === "boolean" && typeof (settings as HostMusicSettings).musicVolume === "number" && Number.isFinite((settings as HostMusicSettings).musicVolume)) {
        const host = settings as HostMusicSettings;
        const enabled = host.music && !host.muted;
        const nextVolume = Math.max(0, Math.min(1, host.musicVolume));
        try { persistMenuAudioPreferencesFromHost(window.localStorage, { ...host, musicVolume: nextVolume }); } catch { /* Keep the live control responsive when storage is unavailable. */ }
        soundEnabledRef.current = enabled;
        volumeRef.current = nextVolume;
        setSoundEnabled(enabled);
        setVolume(nextVolume);
      } else if (settings && typeof settings === "object" && typeof (settings as { soundEnabled?: unknown }).soundEnabled === "boolean") {
        const menu = settings as { soundEnabled: boolean; volume: number };
        const nextVolume = Math.max(0, Math.min(1, menu.volume));
        soundEnabledRef.current = menu.soundEnabled;
        volumeRef.current = nextVolume;
        setSoundEnabled(menu.soundEnabled);
        setVolume(nextVolume);
      }
    };
    window.addEventListener(PHASE_EVENT, onPhase);
    window.addEventListener(SETTINGS_EVENT, onSettings);
    window.addEventListener("king-prompter:host-music-duck", onDuck);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener(PHASE_EVENT, onPhase);
      window.removeEventListener(SETTINGS_EVENT, onSettings);
      window.removeEventListener("king-prompter:host-music-duck", onDuck);
      window.removeEventListener("message", onMessage);
    };
  }, [setDucked, setPhase]);

  useEffect(() => {
    for (const audio of [firstAudio.current, secondAudio.current]) {
      if (audio) {
        audio.muted = !soundEnabled;
        audio.volume = (soundEnabled ? volume * 0.55 * (activeTarget.current?.gain ?? 1) * (ducked.current ? 0.22 : 1) : 0) * envelopes.current[audio === firstAudio.current ? 0 : 1];
      }
    }
  }, [soundEnabled, volume]);

  useEffect(() => () => {
    playGeneration.current += 1;
    unlockAttemptPending.current = false;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    firstAudio.current?.pause();
    secondAudio.current?.pause();
    if (ambienceFrame.current !== null) cancelAnimationFrame(ambienceFrame.current);
    ambienceAudio.current?.pause();
  }, []);

  const toggleMusic = () => {
    if (playbackBlocked || !gestureRetried.current) {
      soundEnabledRef.current = true;
      setSoundEnabled(true);
      setPlaybackBlocked(false);
      window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { soundEnabled: true, volume } }));
      try {
        const preferences = parseMenuPreferences(window.localStorage.getItem(MENU_PREFERENCES_STORAGE_KEY));
        window.localStorage.setItem(MENU_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...preferences, soundEnabled: true, volume }));
      } catch {
        // Storage can be unavailable; this click still retries playback immediately.
      }
      notifyEmbeddedMusicSettings(true, volume);
      const current = effectivePhase.phase === "game" && effectivePhase.gameId
        ? musicTarget(effectivePhase.context ?? "game", effectivePhase.gameId, menuIndex.current)
        : musicTarget("menu", "standard", menuIndex.current);
      unlockAttemptPending.current = true;
      transitionTo(current, true, true);
      return;
    }
    const enabled = !soundEnabled;
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { soundEnabled: enabled, volume } }));
    try {
      const preferences = parseMenuPreferences(window.localStorage.getItem(MENU_PREFERENCES_STORAGE_KEY));
      window.localStorage.setItem(MENU_PREFERENCES_STORAGE_KEY, JSON.stringify({ ...preferences, soundEnabled: enabled, volume }));
    } catch {
      // Storage can be unavailable in private or embedded contexts; playback still responds.
    }
    notifyEmbeddedMusicSettings(enabled, volume);
  };

  const contextValue = useMemo(() => ({ setPhase, unlock: unlockMusic }), [setPhase, unlockMusic]);
  return (
    <MusicContext.Provider value={contextValue}>
      {children}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Instrumental background music has no dialogue. */}
        <audio ref={firstAudio} className="host-music-deck" data-host-music-deck preload="auto" aria-hidden="true" />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Instrumental background music has no dialogue. */}
        <audio ref={secondAudio} className="host-music-deck" data-host-music-deck preload="auto" aria-hidden="true" />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Quiet wordless lobby ambience. */}
        <audio ref={ambienceAudio} className="host-ambience-deck" preload="none" aria-hidden="true" />
      {ready && playbackAllowed && (() => {
        const button = <button
        type="button"
        className={`host-music-toggle${controlTarget ? " session-music-control" : " floating-host-music-control"}`}
        aria-label={playbackBlocked ? "Enable host music" : soundEnabled ? "Mute host music" : "Unmute host music"}
        aria-pressed={soundEnabled && !playbackBlocked}
        onClick={toggleMusic}
        style={controlTarget
          ? { position: "static", minHeight: 48, padding: "0.55rem 0.9rem", borderRadius: 999, border: "1px solid #d6bc77", background: "#14264a", color: "#fff4d6", font: "600 0.85rem system-ui", cursor: "pointer" }
          : { position: "fixed", top: "1rem", right: "1rem", zIndex: 10000, minHeight: 48, padding: "0.55rem 0.9rem", borderRadius: 999, border: "1px solid #d6bc77", background: "#14264a", color: "#fff4d6", font: "600 0.85rem system-ui", cursor: "pointer" }}
      >{playbackBlocked ? "♫ Enable music" : soundEnabled ? "♫ Music on" : "♫ Music off"}</button>;
        return controlTarget ? createPortal(button, controlTarget) : button;
      })()}
    </MusicContext.Provider>
  );
}

export function useHostMusicPhase(inGame: boolean, gameId: string, musicContext: HostMusicContext = "game") {
  const musicOwner = useContext(MusicContext);
  useEffect(() => {
    if (!musicOwner) return;
    const message: HostMusicPhaseMessage = inGame && gameId
      ? { type: "host-music-phase", phase: "game", gameId, context: musicContext }
      : { type: "host-music-phase", phase: "menu", context: "menu" };
    musicOwner.setPhase(message);
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
  }, [musicOwner, gameId, inGame, musicContext]);
}

export function useHostMusicUnlock() {
  const context = useContext(MusicContext);
  return context?.unlock ?? (() => undefined);
}
