"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DisplaySnapshot, HostSnapshot } from "../../lib/contracts";
import { observeSketchAudio, sketchAudioEvents, sketchMusicContext, type SketchAudioObservation } from "../../lib/game/native-audio";
import { narrationForPhase } from "../../lib/game/audio-direction";
import { SOUNDTRACK_VOLUME } from "../../lib/game/soundtrack";
import { applyCanonicalMenuMusicPreferences } from "../../lib/game/hostAudioPreferences";
import { DEFAULT_MENU_PREFERENCES, MENU_PREFERENCES_STORAGE_KEY, loadMenuPreferences } from "./MenuSettingsDialog";
import { audioEventForPresentation, type AudioPresentationEvent } from "../../lib/presentation/audio-events";
import type { PresentationEvent } from "../../lib/presentation/types";
import type { ApprovedAudioClip } from "../../lib/game/audio-library";
import { additionalEffectRoles, approvedAudioForRole, countdownEffectRoleForSecond, effectRoleForPresentation, phaseMusicContext } from "../../lib/game/audio-policy";

export interface HostAudioSettings {
  muted: boolean;
  music: boolean;
  effects: boolean;
  narrator: boolean;
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  narratorVolume: number;
  voiceURI: string;
}

const DEFAULTS: HostAudioSettings = { muted: false, music: true, effects: true, narrator: true, masterVolume: .82, musicVolume: SOUNDTRACK_VOLUME, effectsVolume: .8, narratorVolume: .95, voiceURI: "" };
const STORAGE_KEY = "callback-host-audio-v3";

type AnimationCue = "dance" | "cheer" | "wave" | "bow" | "shrug" | "facepalm";
type Cue = AnimationCue | "join" | "winner" | "lock" | "rewind" | "move" | "tick" | "urgent" | "ready";

export class GameAudioEngine {
  private context: AudioContext;
  private master: GainNode;
  private effects: GainNode;
  private compressor: DynamicsCompressorNode;
  private approvedVoices: Array<{ audio: HTMLAudioElement; frame: number | null; clip: ApprovedAudioClip; lane: "effect" | "countdown"; stopping: boolean }> = [];
  private roleIndexes = new Map<string, number>();
  private effectGeneration = 0;
  private syntheticVoiceCount = 0;
  private settings = DEFAULTS;
  constructor() {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new Context();
    this.master = this.context.createGain(); this.effects = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -18; this.compressor.knee.value = 16; this.compressor.ratio.value = 5; this.compressor.attack.value = .004; this.compressor.release.value = .18;
    this.effects.connect(this.master); this.master.connect(this.compressor); this.compressor.connect(this.context.destination);
    this.apply(DEFAULTS);
  }

  async start() {
    if (this.context.state !== "running") await this.context.resume();
  }

  apply(settings: HostAudioSettings) {
    const now = this.context.currentTime;
    this.settings = settings;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.masterVolume, now, .035);
    this.effects.gain.setTargetAtTime(settings.effects && !settings.muted ? settings.effectsVolume : 0, now, .035);
    if (settings.muted || !settings.effects) this.effectGeneration += 1;
    for (const voice of [...this.approvedVoices]) {
      voice.audio.muted = settings.muted || !settings.effects;
      if (voice.audio.muted) this.stopApprovedVoice(voice);
    }
  }

  playApprovedEffect(role: string, fallback?: Cue, countdownLane = false) {
    const variants = approvedAudioForRole(role);
    if (!variants.length || this.settings.muted || !this.settings.effects) return false;
    if (countdownLane) this.stopCountdown(90);
    if (this.approvedVoices.length >= 5) {
      // Keep existing releases soft and discard excess burst cues until a slot is free.
      const oldest = this.approvedVoices.find(voice => !voice.stopping);
      if (oldest) this.stopApprovedVoice(oldest, 70);
      return true;
    }
    const next = this.roleIndexes.get(role) ?? 0;
    this.roleIndexes.set(role, next + 1);
    const clip = variants[next % variants.length]!;
    const generation = this.effectGeneration;
    const audio = new Audio(clip.src);
    audio.volume = 0;
    const voice = { audio, frame: null as number | null, clip, lane: countdownLane ? "countdown" as const : "effect" as const, stopping: false };
    this.approvedVoices.push(voice);
    let start = 0;
    let plannedEnd = 0;
    const tick = (now: number) => {
      if (!this.approvedVoices.includes(voice) || voice.stopping) return;
      const attack = Math.max(0, Math.min(1, (now - start) / 45));
      const release = Math.max(0, Math.min(1, (plannedEnd - now) / 140));
      const normalized = Math.max(0, Math.min(1, Number.isFinite(clip.gain) ? clip.gain : 0.25));
      audio.volume = this.settings.muted || !this.settings.effects ? 0 : Math.min(1, this.settings.masterVolume * this.settings.effectsVolume * normalized * 0.42 * attack * release);
      if (now >= plannedEnd || audio.paused) { this.stopApprovedVoice(voice); return; }
      voice.frame = requestAnimationFrame(tick);
    };
    audio.muted = false;
    audio.addEventListener("ended", () => this.stopApprovedVoice(voice), { once: true });
    void audio.play().then(() => {
      if (generation !== this.effectGeneration || !this.approvedVoices.includes(voice) || voice.stopping) { this.stopApprovedVoice(voice); return; }
      start = performance.now();
      plannedEnd = start + Math.max(0.15, Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : clip.durationSeconds) * 1000;
      voice.frame = requestAnimationFrame(tick);
    }).catch(() => {
      this.stopApprovedVoice(voice);
      if (fallback && generation === this.effectGeneration && !voice.stopping && !this.settings.muted && this.settings.effects) this.cue(fallback);
    });
    return true;
  }

  stopCountdown(fadeMs = 90) {
    for (const voice of [...this.approvedVoices]) if (voice.lane === "countdown") this.stopApprovedVoice(voice, fadeMs);
  }

  private stopApprovedVoice(voice: { audio: HTMLAudioElement; frame: number | null; clip: ApprovedAudioClip; lane: "effect" | "countdown"; stopping: boolean }, fadeMs = 0) {
    if (!this.approvedVoices.includes(voice)) return;
    if (fadeMs > 0 && !voice.stopping && !voice.audio.paused && voice.audio.volume > 0) {
      voice.stopping = true;
      if (voice.frame !== null) cancelAnimationFrame(voice.frame);
      const from = voice.audio.volume;
      const startedAt = performance.now();
      const fade = (now: number) => {
        const progress = Math.max(0, Math.min(1, (now - startedAt) / fadeMs));
        voice.audio.volume = from * (1 - progress);
        if (progress < 1) voice.frame = requestAnimationFrame(fade);
        else this.stopApprovedVoice(voice);
      };
      voice.frame = requestAnimationFrame(fade);
      return;
    }
    if (voice.frame !== null) cancelAnimationFrame(voice.frame);
    voice.frame = null;
    voice.audio.pause();
    voice.audio.currentTime = 0;
    this.approvedVoices = this.approvedVoices.filter((item) => item !== voice);
  }

  cue(kind: Cue) {
    if (this.settings.muted || !this.settings.effects) return;
    const now = this.context.currentTime + .01;
    if (["dance", "cheer", "wave", "bow", "shrug", "facepalm"].includes(kind)) {
      const notes: Record<AnimationCue, number[]> = { dance: [392, 523.25, 392], cheer: [392, 523.25, 659.25], wave: [392, 440], bow: [523.25, 392, 261.63], shrug: [329.63, 349.23], facepalm: [130.81] };
      notes[kind as AnimationCue].forEach((note, index) => this.tone(note, now + index * .085, .14, "triangle", .045));
      return;
    }
    if (kind === "lock") { this.kick(now, .9); this.tone(110, now, .16, "square", .13, -600); return; }
    if (kind === "tick") { this.tone(880, now, .055, "sine", .055); return; }
    if (kind === "urgent") { this.tone(1174.66, now, .09, "sine", .045); return; }
    if (kind === "rewind") { [520, 390, 292, 220].forEach((note, index) => this.tone(note, now + index * .065, .16, "triangle", .08, -80)); return; }
    const notes = kind === "winner" ? [261.63, 329.63, 392, 523.25, 659.25] : kind === "join" ? [392, 523.25] : kind === "ready" ? [261.63, 392, 523.25] : [329.63, 392];
    notes.forEach((note, index) => this.tone(note, now + index * (kind === "winner" ? .1 : .075), kind === "winner" ? .5 : .2, index % 2 ? "triangle" : "sine", kind === "winner" ? .1 : .07, kind === "winner" ? 18 : 0));
    if (kind === "winner") { this.kick(now, .8); this.kick(now + .4, .7); }
  }

  private tone(frequency: number, at: number, duration: number, type: OscillatorType, level: number, sweep = 0) {
    if (this.syntheticVoiceCount >= 10) return;
    this.syntheticVoiceCount += 1;
    const osc = this.context.createOscillator(); const gain = this.context.createGain(); const filter = this.context.createBiquadFilter();
    osc.type = type; osc.frequency.setValueAtTime(frequency, at); if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + sweep), at + duration);
    filter.type = "lowpass"; filter.frequency.value = 2600; gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(level, at + .012); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.onended = () => { this.syntheticVoiceCount = Math.max(0, this.syntheticVoiceCount - 1); };
    osc.connect(filter); filter.connect(gain); gain.connect(this.effects); osc.start(at); osc.stop(at + duration + .02);
  }

  private kick(at: number, level: number) {
    if (this.syntheticVoiceCount >= 10) return;
    this.syntheticVoiceCount += 1;
    const osc = this.context.createOscillator(); const gain = this.context.createGain(); osc.type = "sine"; osc.frequency.setValueAtTime(130, at); osc.frequency.exponentialRampToValueAtTime(42, at + .13);
    gain.gain.setValueAtTime(.11 * level, at); gain.gain.exponentialRampToValueAtTime(.0001, at + .16); osc.onended = () => { this.syntheticVoiceCount = Math.max(0, this.syntheticVoiceCount - 1); }; osc.connect(gain); gain.connect(this.effects); osc.start(at); osc.stop(at + .18);
  }

  destroy() { this.effectGeneration += 1; for (const voice of [...this.approvedVoices]) this.stopApprovedVoice(voice); void this.context.close(); }
}

function loadCanonicalMenuPreferences() {
  try { return loadMenuPreferences(localStorage); }
  catch { return DEFAULT_MENU_PREFERENCES; }
}

function loadSettings(): HostAudioSettings {
  let settings = DEFAULTS;
  try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<HostAudioSettings> }; }
  catch { /* Keep defaults when the legacy audio cache is unavailable. */ }
  return applyCanonicalMenuMusicPreferences(settings, loadCanonicalMenuPreferences());
}

const HOUSE_VOICE_PREFERENCES = [
  "microsoft ryan online (natural)",
  "microsoft guy online (natural)",
  "microsoft christopher online (natural)",
  "microsoft brian online (natural)",
  "microsoft daniel online (natural)",
  "google uk english male",
  "google us english male",
  "daniel",
  "alex",
];

function preferredVoice(voices: SpeechSynthesisVoice[], voiceURI: string) {
  const selected = voices.find((voice) => voice.voiceURI === voiceURI); if (selected) return selected;
  const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang));
  const score = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    const houseIndex = HOUSE_VOICE_PREFERENCES.findIndex((token) => name.includes(token));
    const houseScore = houseIndex === -1 ? 0 : 160 - houseIndex * 12;
    const qualityScore = ["natural", "neural", "premium", "enhanced", "microsoft", "google", "samantha", "daniel", "alex", "karen"]
      .reduce((total, token, index) => total + (name.includes(token) ? 20 - index : 0), 0);
    return houseScore + qualityScore + (voice.localService ? 2 : 0);
  };
  return [...english].sort((a, b) => score(b) - score(a))[0] ?? voices[0];
}

const cueForPresentation: Partial<Record<AudioPresentationEvent, Cue>> = {
  "stage.ready": "ready", "player.joined": "join", "round.sting": "move", "response.lock": "lock", "vote.lock": "lock",
  "gallery.open": "ready", "image.retry": "rewind", "image.fallback": "rewind", "reveal.anticipation": "rewind",
  "reveal.impact": "rewind", "score.tick": "tick", "winner.crown": "winner", "winner.tie": "winner",
  "finale.fanfare": "winner", "connection.lost": "rewind", "connection.restored": "ready",
};

function publishMusicDuck(active: boolean) {
  const detail = { type: "host-music-duck", active };
  window.dispatchEvent(new CustomEvent("king-prompter:host-music-duck", { detail }));
  if (window.parent !== window) window.parent.postMessage(detail, window.location.origin);
}

export function useHostAudio(snapshot: HostSnapshot | DisplaySnapshot | null, remaining: number | null, presentationEvents: PresentationEvent[] = [], gameOwnsVoice = false) {
  const [settings, setSettingsState] = useState<HostAudioSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [caption, setCaption] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const engine = useRef<GameAudioEngine | null>(null);
  const previousPaused = useRef<boolean | null>(null);
  const previousPhase = useRef<string | null>(null);
  const previousSketchAudio = useRef<SketchAudioObservation | null>(null);
  const consumedEvents = useRef(new Set<string>());
  const warned = useRef("");
  const settingsRef = useRef(settings);
  const narrationGeneration = useRef(0);
  const snapshotRef = useRef(snapshot);

  useEffect(() => { queueMicrotask(() => setSettingsState(loadSettings())); }, []);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => {
    const syncMusic = (soundEnabled: boolean, volume: number) => {
      const next = applyCanonicalMenuMusicPreferences(settingsRef.current, { soundEnabled, volume });
      settingsRef.current = next;
      setSettingsState(next);
      engine.current?.apply(next);
      if (next.muted || !next.narrator) { narrationGeneration.current += 1; window.speechSynthesis?.cancel(); setCaption(""); publishMusicDuck(false); }
    };
    const receiveCanonicalMusicSettings = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object") return;
      const message = event.data as { type?: unknown; muted?: unknown; music?: unknown; musicVolume?: unknown };
      if (message.type !== "host-music-settings" || typeof message.muted !== "boolean" || typeof message.music !== "boolean" || typeof message.musicVolume !== "number" || !Number.isFinite(message.musicVolume)) return;
      syncMusic(message.music && !message.muted, message.musicVolume);
    };
    const receiveStoredMenuPreferences = (event: StorageEvent) => {
      if (event.key !== MENU_PREFERENCES_STORAGE_KEY) return;
      const preferences = loadCanonicalMenuPreferences();
      syncMusic(preferences.soundEnabled, preferences.volume);
    };
    window.addEventListener("message", receiveCanonicalMusicSettings);
    window.addEventListener("storage", receiveStoredMenuPreferences);
    return () => {
      window.removeEventListener("message", receiveCanonicalMusicSettings);
      window.removeEventListener("storage", receiveStoredMenuPreferences);
    };
  }, []);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices()); refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);
  useEffect(() => () => { engine.current?.destroy(); narrationGeneration.current += 1; window.speechSynthesis?.cancel(); publishMusicDuck(false); }, []);

  useEffect(() => {
    if (!snapshot?.sketchRelay) { previousSketchAudio.current = null; return; }
    const next = observeSketchAudio(snapshot.sketchRelay, remaining);
    const previous = previousSketchAudio.current;
    previousSketchAudio.current = next;
    if (!previous || !ready || settings.muted || !settings.effects) return;
    const fallbackForRole: Partial<Record<string, Cue>> = {
      "response-lock": "lock", "vote-lock": "lock", "all-votes": "ready", card: "ready", round: "move",
      reveal: "rewind", score: "tick", winner: "winner", tie: "winner",
      "emote-dance": "dance", "emote-cheer": "cheer", "emote-wave": "wave", "emote-bow": "bow", "emote-shrug": "shrug", "emote-facepalm": "facepalm",
    };
    for (const event of sketchAudioEvents(previous, next, snapshot.paused)) {
      if (consumedEvents.current.has(event.key)) continue;
      consumedEvents.current.add(event.key);
      const fallback = fallbackForRole[event.role];
      if (!engine.current?.playApprovedEffect(event.role, fallback) && fallback) engine.current?.cue(fallback);
    }
    if (consumedEvents.current.size > 256) consumedEvents.current = new Set([...consumedEvents.current].slice(-128));
  }, [remaining, snapshot?.paused, snapshot?.sketchRelay, ready, settings.muted, settings.effects]);

  const speak = useCallback((text: string) => {
    const current = settingsRef.current;
    if (!ready || current.muted || !current.narrator || !("speechSynthesis" in window)) return;
    const generation = ++narrationGeneration.current;
    window.speechSynthesis.cancel(); publishMusicDuck(false); const utterance = new SpeechSynthesisUtterance(text); const voice = preferredVoice(window.speechSynthesis.getVoices(), current.voiceURI);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; } else utterance.lang = "en-CA";
    utterance.rate = .94; utterance.pitch = .86; utterance.volume = Math.min(1, current.masterVolume * current.narratorVolume);
    utterance.onstart = () => { if (narrationGeneration.current === generation) { setCaption(text); publishMusicDuck(true); } };
    utterance.onend = utterance.onerror = () => { if (narrationGeneration.current === generation) { setCaption(""); publishMusicDuck(false); } };
    window.speechSynthesis.speak(utterance);
  }, [ready]);

  const unlock = useCallback(async () => {
    try {
      if (!engine.current) engine.current = new GameAudioEngine();
      engine.current.apply(settingsRef.current); await engine.current.start(); setReady(true); engine.current.cue("ready");
    } catch { setReady(false); }
  }, []);

  const update = useCallback((patch: Partial<HostAudioSettings>) => {
    setSettingsState((current) => {
      const synchronized = applyCanonicalMenuMusicPreferences(current, loadCanonicalMenuPreferences());
      const next = { ...synchronized, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      settingsRef.current = next;
      engine.current?.apply(next);
      const musicChanged = ["muted", "music", "musicVolume"].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
      if (musicChanged) {
        const detail = { muted: next.muted, music: next.music, musicVolume: next.musicVolume };
        window.dispatchEvent(new CustomEvent("king-prompter:host-music-settings", { detail }));
        if (window.parent !== window) window.parent.postMessage({ type: "host-music-settings", ...detail }, window.location.origin);
      }
      if (next.muted || !next.narrator) { narrationGeneration.current += 1; window.speechSynthesis?.cancel(); setCaption(""); publishMusicDuck(false); }
      return next;
    });
  }, []);

  const activateOrToggle = useCallback(() => {
    if (!ready) { void unlock(); return; }
    const willUnmute = settingsRef.current.muted;
    update({ muted: !willUnmute });
    if (willUnmute) engine.current?.cue("ready");
  }, [ready, unlock, update]);

  const currentPhase = snapshot?.phase;
  const currentGameId = snapshot?.gameLength;
  const currentPaused = snapshot?.paused || snapshot?.sketchRelay?.finale?.paused;
  const currentSketchPhase = snapshot?.sketchRelay?.finale && snapshot.sketchRelay.finale.phase !== "closed" ? snapshot.sketchRelay.finale.phase : snapshot?.sketchRelay?.phase;
  useEffect(() => {
    if (currentPhase) {
      const context = currentSketchPhase
        ? sketchMusicContext(currentSketchPhase, currentPaused)
        : phaseMusicContext(currentPhase, currentPaused);
      const message = currentPhase === "LOBBY"
        ? { type: "host-music-phase", phase: "menu", context } as const
        : { type: "host-music-phase", phase: "game", gameId: currentGameId, context } as const;
      window.dispatchEvent(new CustomEvent("king-prompter:host-music-phase", { detail: message }));
      if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
    }
  }, [currentGameId, currentPaused, currentPhase, currentSketchPhase]);

  useEffect(() => {
    if (!snapshot || !ready) return;
      engine.current?.apply(settings);
    if (snapshot.paused || (previousPhase.current !== null && previousPhase.current !== snapshot.phase)) engine.current?.stopCountdown();
    if (!gameOwnsVoice && previousPaused.current !== null && snapshot.paused !== previousPaused.current) {
      speak(snapshot.paused ? "Game paused. Take a breath." : "And we are back.");
    }
    previousPaused.current = snapshot.paused;
    for (const event of presentationEvents) {
      if (snapshot.sketchRelay && event.type !== "player.joined") continue;
      if (consumedEvents.current.has(event.key)) continue;
      consumedEvents.current.add(event.key);
      const semantic = audioEventForPresentation[event.type];
      const cue = semantic ? cueForPresentation[semantic] : undefined;
      const role = effectRoleForPresentation(event.type);
      if (settings.effects && role) {
        if (!engine.current?.playApprovedEffect(role, cue)) { if (cue) engine.current?.cue(cue); }
      } else if (cue && settings.effects) engine.current?.cue(cue);
      if (settings.effects) for (const extraRole of additionalEffectRoles(event.type, snapshot.gameLength ?? "", snapshot.phase, previousPhase.current)) {
        if (!engine.current?.playApprovedEffect(extraRole, extraRole === "all-votes" ? "ready" : undefined) && extraRole === "all-votes") engine.current?.cue("ready");
      }
      if (event.type === "phase.entered" || event.type === "round.entered") {
        engine.current?.stopCountdown();
        const line = narrationForPhase(snapshot);
        if (line && !gameOwnsVoice) speak(line);
        warned.current = "";
      }
    }
    previousPhase.current = snapshot.phase;
    if (consumedEvents.current.size > 256) consumedEvents.current = new Set([...consumedEvents.current].slice(-128));
  }, [snapshot, presentationEvents, ready, settings, speak, gameOwnsVoice]);

  const seconds = remaining === null ? null : Math.ceil(remaining / 1000);
  useEffect(() => {
    if (!snapshot || !ready || seconds === null || !snapshot.deadlineAt || snapshot.paused) return;
    const warningKey = `${snapshot.roundId}:${snapshot.phase}:${seconds}`;
    if (seconds === 10 && warned.current !== warningKey) { warned.current = warningKey; if (!gameOwnsVoice) speak("Ten seconds."); }
    if (seconds > 0 && seconds <= 5 && settings.effects && warned.current !== warningKey) {
      warned.current = warningKey;
      const countdownRole = countdownEffectRoleForSecond(seconds);
      if (countdownRole) {
        const played = engine.current?.playApprovedEffect(countdownRole, "tick", true) ?? false;
        if (!played) engine.current?.cue("tick");
        if (seconds <= 2) engine.current?.cue("urgent");
      } else engine.current?.cue("tick");
    }
    if (seconds === 0 && settings.effects && settingsRef.current.effects && warned.current !== warningKey) {
      warned.current = warningKey;
      if (!engine.current?.playApprovedEffect("time-up")) {
        if (!engine.current?.playApprovedEffect("timer")) engine.current?.cue("winner");
      }
    }
  }, [seconds, snapshot, ready, settings.effects, speak, gameOwnsVoice]);

  const voiceOptions = useMemo(() => voices.filter((voice) => /^en[-_]/i.test(voice.lang)).map((voice) => ({ uri: voice.voiceURI, label: `${voice.name} · ${voice.lang}` })), [voices]);
  return { settings, ready, caption, voiceOptions, unlock, update, activateOrToggle, testVoice: () => speak("King Prompter audio check. Phones ready. Let the game begin.") };
}
