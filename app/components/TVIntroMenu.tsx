"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GrandHallMenu } from "./GrandHallMenu";
import { HomeMenu } from './HomeMenu';
import { InstallAppAffordance } from "./InstallAppAffordance";
import { useHostMusicUnlock } from "./HostMusicProvider";
import {
  DEFAULT_MENU_PREFERENCES,
  MENU_PREFERENCES_STORAGE_KEY,
  loadMenuPreferences,
  updateMenuAudioPreferences,
  type MenuPreferences,
} from "./MenuSettingsDialog";

type EntryStage = "gate" | "intro" | "menu";

type TVIntroMenuProps = {
  introSrc?: string;
  menuLoopSrc?: string | null;
};

export default function TVIntroMenu({ introSrc = "/intro.mp4", menuLoopSrc = "/media/grand-hall/grand-hall-menu-loop.mp4" }: TVIntroMenuProps) {
  const introRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const unlockHostMusic = useHostMusicUnlock();
  const posterRef = useRef<HTMLImageElement>(null);
  const transitioningRef = useRef(false);
  const router = useRouter();
  const [legacyMenu,setLegacyMenu]=useState(false);
  useEffect(()=>{queueMicrotask(()=>setLegacyMenu(new URLSearchParams(location.search).get('legacy')==='1'));},[]);
  const [stage, setStage] = useState<EntryStage>("gate");
  const [showSkip, setShowSkip] = useState(false);
  const [introFailed, setIntroFailed] = useState(false);
  const [loopFailed, setLoopFailed] = useState(menuLoopSrc === null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const [preferences, setPreferences] = useState<MenuPreferences>(DEFAULT_MENU_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [motionReady, setMotionReady] = useState(false);

  const reducedMotion = preferences.motion === "reduced" || (preferences.motion === "system" && systemReducedMotion);

  const rememberMenuEntry = useCallback(() => {
    if (window.location.pathname !== "/") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("menu") === "1") return;
    params.set("menu", "1");
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => {
      setPreferences(loadMenuPreferences(window.localStorage));
      setPreferencesReady(true);
    });

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setSystemReducedMotion(mediaQuery.matches);
    window.queueMicrotask(() => {
      updateMotion();
      setMotionReady(true);
    });
    mediaQuery.addEventListener("change", updateMotion);
    return () => mediaQuery.removeEventListener("change", updateMotion);
  }, []);

  useEffect(() => {
    const synchronizeMusic = (event: Event) => {
      const detail = (event as CustomEvent<{ soundEnabled?: unknown; volume?: unknown }>).detail;
      if (typeof detail?.soundEnabled !== "boolean" || typeof detail.volume !== "number" || !Number.isFinite(detail.volume)) return;
      setPreferences((current) => updateMenuAudioPreferences(current, { soundEnabled: detail.soundEnabled as boolean, volume: detail.volume as number }));
    };
    window.addEventListener("king-prompter:host-music-settings", synchronizeMusic);
    return () => window.removeEventListener("king-prompter:host-music-settings", synchronizeMusic);
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    window.localStorage.setItem(MENU_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new CustomEvent("king-prompter:host-music-settings", { detail: { soundEnabled: preferences.soundEnabled, volume: preferences.volume } }));
  }, [preferences, preferencesReady]);

  useEffect(() => {
    for (const media of [introRef.current, loopRef.current]) if (media) media.muted = true;
  }, []);

  useEffect(() => {
    const poster = posterRef.current;
    if (!poster) return;
    const resolvePoster = () => {
      const loaded = poster.naturalWidth > 0;
      setPosterReady(loaded);
      setPosterFailed(!loaded);
    };
    if (poster.complete) window.queueMicrotask(resolvePoster);
    poster.addEventListener("load", resolvePoster);
    poster.addEventListener("error", resolvePoster);
    return () => {
      poster.removeEventListener("load", resolvePoster);
      poster.removeEventListener("error", resolvePoster);
    };
  }, []);

  const beginMenuTransition = useCallback(() => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    rememberMenuEntry();
    setShowSkip(false);
    setStage("menu");

    const intro = introRef.current;
    const loop = loopRef.current;
    intro?.pause();
    if (reducedMotion) { loop?.pause(); return; }

    if (menuLoopSrc && loop) {
      loop.currentTime = 0;
      loop.muted = true;
      void loop.play().then(() => {
        setLoopFailed(false);
      }).catch(() => setLoopFailed(true));
    } else {
      setLoopFailed(true);
    }
  }, [menuLoopSrc, reducedMotion, rememberMenuEntry]);

  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return;
    const startCrossfadeNearEnd = () => {
      if (Number.isFinite(intro.duration) && intro.duration - intro.currentTime <= 1.2) beginMenuTransition();
    };
    intro.addEventListener("timeupdate", startCrossfadeNearEnd);
    intro.addEventListener("ended", beginMenuTransition);
    return () => {
      intro.removeEventListener("timeupdate", startCrossfadeNearEnd);
      intro.removeEventListener("ended", beginMenuTransition);
    };
  }, [beginMenuTransition]);

  useEffect(() => {
    if (stage !== "intro") return;
    const timer = window.setTimeout(() => setShowSkip(true), 3500);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (!preferencesReady || !motionReady || new URLSearchParams(window.location.search).get("menu") !== "1") return;
    introRef.current?.pause();
    transitioningRef.current = true;
    window.queueMicrotask(() => setStage("menu"));
    if (!menuLoopSrc || reducedMotion) return;
    const loop = loopRef.current;
    if (!loop) return;
    loop.currentTime = 0;
    loop.muted = true;
    void loop.play().then(() => {
      setLoopFailed(false);
    }).catch(() => {
      setLoopFailed(true);
    });
  }, [menuLoopSrc, motionReady, preferencesReady, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion) return;
    introRef.current?.pause();
    loopRef.current?.pause();
  }, [reducedMotion]);

  const playIntro = useCallback(() => {
    unlockHostMusic();
    const intro = introRef.current;
    setShowSkip(false);
    transitioningRef.current = false;

    if (reducedMotion || !intro) {
      rememberMenuEntry();
      setStage("menu");
      transitioningRef.current = true;
      return;
    }

    loopRef.current?.pause();
    intro.currentTime = 0;
    intro.muted = true;
    setStage("intro");
    void intro.play().catch(() => {
      setIntroFailed(true);
      rememberMenuEntry();
      setStage("menu");
      transitioningRef.current = true;
    });
  }, [reducedMotion, unlockHostMusic, rememberMenuEntry]);

  const leaveMenuForGame = useCallback((href: string) => router.push(href), [router]);

  const replayIntro = () => {
    if (reducedMotion) return;
    setIntroFailed(false);
    playIntro();
  };

  const handleIntroError = () => {
    setIntroFailed(true);
    setShowSkip(false);
    if (stage === "intro") {
      rememberMenuEntry();
      setStage("menu");
    }
    transitioningRef.current = true;
  };

  return (
    <main
      className={`tv-entry tv-entry-${stage}`}
      data-entry-stage={stage}
      data-motion={preferences.motion}
      data-effective-motion={reducedMotion ? "reduced" : "default"}
      data-intro-failed={introFailed ? "true" : "false"}
      data-loop-failed={loopFailed ? "true" : "false"}
      data-poster-failed={posterFailed ? "true" : "false"}
      data-poster-ready={posterReady ? "true" : "false"}
    >
      <InstallAppAffordance />
      <div className="tv-media" aria-hidden="true">
        <picture className="grand-hall-poster">
          <source media="(max-width: 480px) and (max-height: 600px)" type="image/avif" srcSet="/media/grand-hall/poster-phone-short-750x900.avif" />
          <source media="(max-width: 480px) and (max-height: 600px)" type="image/webp" srcSet="/media/grand-hall/poster-phone-short-750x900.webp" />
          <source media="(max-width: 480px)" type="image/avif" srcSet="/media/grand-hall/poster-phone-tall-780x1688.avif" />
          <source media="(max-width: 480px)" type="image/webp" srcSet="/media/grand-hall/poster-phone-tall-780x1688.webp" />
          <source type="image/avif" srcSet="/media/grand-hall/poster-1280x720.avif 1280w, /media/grand-hall/poster-1920x1080.avif 1920w, /media/grand-hall/poster-2560x1440.avif 2560w" sizes="100vw" />
          <source type="image/webp" srcSet="/media/grand-hall/poster-1280x720.webp 1280w, /media/grand-hall/poster-1920x1080.webp 1920w, /media/grand-hall/poster-2560x1440.webp 2560w" sizes="100vw" />
          <img ref={posterRef} src="/media/grand-hall/poster-1280x720.webp" alt="" width="1280" height="720" fetchPriority="high" decoding="async" onLoad={() => { setPosterReady(true); setPosterFailed(false); }} onError={() => { setPosterReady(false); setPosterFailed(true); }} />
        </picture>
        <video ref={introRef} className="tv-video tv-intro-video" muted playsInline preload="metadata" src={introSrc} onError={handleIntroError} />
        {menuLoopSrc && <>
          <video ref={loopRef} className="tv-video tv-loop-video" muted loop playsInline preload="none" src={menuLoopSrc} onError={() => setLoopFailed(true)} />
        </>}
      </div>

      {stage === "gate" && <button className="tv-start-gate" type="button" onClick={playIntro} disabled={!preferencesReady || !motionReady} aria-busy={!preferencesReady || !motionReady} aria-label="Start Callback"><span className="callback-title">CALLBACK</span><strong className="callback-press">Press anywhere to begin</strong></button>}
      {stage === "intro" && showSkip && !introFailed && <button className="tv-skip-intro" type="button" onClick={beginMenuTransition}>Skip Intro <span aria-hidden="true">→</span></button>}

      {stage === "menu" && !legacyMenu && <HomeMenu reducedMotion={reducedMotion} preferences={preferences} onPreferencesChange={setPreferences} onReplayIntro={replayIntro}/>}
      <div className={stage === "menu" && legacyMenu ? "tv-legacy-menu-layout" : undefined}><GrandHallMenu visible={stage === "menu" && legacyMenu} preferences={preferences} reducedMotion={reducedMotion} onPreferencesChange={setPreferences} onReplayIntro={replayIntro} onSelectGame={leaveMenuForGame} />
      </div>
    </main>
  );
}
