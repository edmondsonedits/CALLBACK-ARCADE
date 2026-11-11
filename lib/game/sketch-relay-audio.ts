"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SKETCH_RELAY_REVEAL_MS, SKETCH_RELAY_TIMERS, type SketchRelayPhase } from "../arcade/sketch-relay";
import type { NarratorMood } from "../content/sketch-narrator-lines";

export const SKETCH_REVEAL_MS = SKETCH_RELAY_REVEAL_MS;
export const SKETCH_REVEAL_LEG_MS = SKETCH_REVEAL_MS / 2;

/** Presentation only: the room deadline and phase remain server-authoritative. */
export function sketchRevealFrame(remaining: number | null | undefined) {
  const elapsed = remaining == null ? 0 : Math.max(0, Math.min(SKETCH_REVEAL_MS, SKETCH_REVEAL_MS - remaining));
  const leg = elapsed < SKETCH_REVEAL_LEG_MS ? "drawing" as const : "redraw" as const;
  const legElapsed = leg === "drawing" ? elapsed : elapsed - SKETCH_REVEAL_LEG_MS;
  return { leg, elapsed, progress: Math.max(0, Math.min(1, (legElapsed - 1_000) / 4_000)) };
}

export const SKETCH_STAGE_COPY: Record<SketchRelayPhase, { eyebrow: string; title: string; instruction: string; cue: string; duration: number }> = {
  "prompt-writing": { eyebrow: "The prompt shop", title: "Write the trouble.", instruction: "Write one funny drawing prompt on your phone.", cue: "Write a funny drawing prompt. Examples are on your phone.", duration: SKETCH_RELAY_TIMERS["prompt-writing"] },
  "prompt-voting": { eyebrow: "The shortlist", title: "Pick the trouble.", instruction: "Rank your three favourite prompts.", cue: "Rank your three favourite prompts. The top two become our drawing challenges.", duration: SKETCH_RELAY_TIMERS["prompt-voting"] },
  showcase: { eyebrow: "The exhibition", title: "Meet the masterpieces.", instruction: "Remember the letters. Artists stay secret.", cue: "Meet the masterpieces. Artists stay secret for now.", duration: SKETCH_RELAY_TIMERS.showcase },
  "laughter-voting": { eyebrow: "Your favourites", title: "Pick the drawing you enjoyed the most.", instruction: "Rank up to three drawings on your phone.", cue: "Pick the drawing you enjoyed the most. Rank your favourites on your phone.", duration: SKETCH_RELAY_TIMERS["laughter-voting"] },
  "artist-guessing": { eyebrow: "Name the artist", title: "Who did this?", instruction: "Guess the artists behind the drawings you voted for.", cue: "Who did this? Identify the artists behind your favourites for bonus points.", duration: SKETCH_RELAY_TIMERS["artist-guessing"] },
  "curse-selection": { eyebrow: "A little sorcery", title: "Choose the curse.", instruction: "Last place picks a drawing restriction for everyone.", cue: "Last place chooses the curse. Round two is worth double.", duration: SKETCH_RELAY_TIMERS["curse-selection"] },
  "final-preparation": { eyebrow: "The final spell", title: "Make it yours.", instruction: "Choose a prompt twist and a starter on your phone.", cue: "Choose a prompt twist and a starter. The final is worth triple.", duration: SKETCH_RELAY_TIMERS["final-preparation"] },
  halfway: { eyebrow: "Halfway there", title: "One down. One to draw.", instruction: "Your second shared prompt is coming up.", cue: "We are halfway through. Get ready to draw the second prompt.", duration: SKETCH_RELAY_TIMERS.halfway },
  drawing: { eyebrow: "01 · A little ink", title: "Draw something\nunforgettable.", instruction: "Pick a secret prompt on your phone. Bring it to life with a sketch.", cue: "Artists, your secret prompts are on your phones. Pick one and draw it. Big ideas, questionable drawing skills. Perfect.", duration: SKETCH_RELAY_TIMERS.drawing },
  transforming: { eyebrow: "02 · A little magic", title: "The spell is\ntaking shape.", instruction: "Your sketches are being transformed. Keep your phone close for the next surprise.", cue: "Brushes down. A little sorcery is happening. Your next picture will arrive on your phone.", duration: SKETCH_RELAY_TIMERS.transforming },
  captioning: { eyebrow: "03 · A wild interpretation", title: "What on earth\nis that?", instruction: "Look at the picture on your phone. Describe what you think you see.", cue: "What on earth is that? Describe the picture on your phone. You are starting a whole new rumour.", duration: SKETCH_RELAY_TIMERS.captioning },
  redrawing: { eyebrow: "04 · Pass the imagination", title: "Now draw\nthe rumour.", instruction: "A caption has landed on your phone. Draw it without seeing the first sketch.", cue: "A caption has landed. Draw what it says, without seeing the first sketch. Let the imagination wander.", duration: SKETCH_RELAY_TIMERS.redrawing },
  "transforming-redraw": { eyebrow: "05 · One last enchantment", title: "A final flick\nof the wand.", instruction: "The redraws are being transformed. The grand reveal is almost here.", cue: "The last enchantments are underway. In a moment, we will see how far these ideas travelled.", duration: SKETCH_RELAY_TIMERS["transforming-redraw"] },
  revealing: { eyebrow: "The grand reveal", title: "Follow the\nbeautiful chaos.", instruction: "From a secret prompt to a very different picture. Watch the whole story unfold.", cue: "It is time for the grand reveal. Follow the beautiful chaos.", duration: SKETCH_REVEAL_MS },
  "round-results": { eyebrow: "A round of applause", title: "That took\na turn.", instruction: "Send a little applause from your phone. Every artist helped this story wander.", cue: "That took a turn. Give your favourite sketches a little applause from your phone.", duration: SKETCH_RELAY_TIMERS["round-results"] },
  complete: { eyebrow: "The exhibition is open", title: "Beautifully\nbewildering.", instruction: "Three rounds. A gallery of happy accidents. One very imaginative room.", cue: "Our exhibition is complete. Three rounds, a gallery of happy accidents, and one very imaginative room.", duration: 0 },
};

function publishNarrationDuck(active: boolean) {
  if (typeof window === "undefined") return;
  const detail = { type: "host-music-duck", active };
  window.dispatchEvent(new CustomEvent("king-prompter:host-music-duck", { detail }));
  if (window.parent !== window) window.parent.postMessage(detail, window.location.origin);
}

// The browser exposes voice names and locales, but no gender metadata.
const FEMALE_ENGLISH_VOICE = /\b(?:female|zira|aria|jenny|michelle|jessa|sonia|libby|maisie|hazel|samantha|ava|allison|susan|karen|moira|tessa|fiona|serena|kate|victoria|catherine|clara|natasha|emma|amy|joanna|salli|kendra|kimberly)\b/i;
const HIGH_QUALITY_VOICE = /\b(?:natural|neural|premium|enhanced)\b/i;

export function selectSketchNarratorVoice(voices: SpeechSynthesisVoice[]) {
  const english = voices.filter(voice => /^en(?:[-_]|$)/i.test(voice.lang));
  const female = english.filter(voice => FEMALE_ENGLISH_VOICE.test(voice.name));
  return female.find(voice => HIGH_QUALITY_VOICE.test(voice.name))
    ?? female[0]
    ?? english.find(voice => voice.default)
    ?? english[0];
}

const DELIVERY: Record<NarratorMood, { rate: number; pitch: number }> = {
  nice: { rate: 0.95, pitch: 1.03 },
  funny: { rate: 1.02, pitch: 1.05 },
  quirky: { rate: 0.98, pitch: 1.07 },
  silly: { rate: 1.04, pitch: 1.08 },
  sassy: { rate: 0.97, pitch: 1.02 },
  critical: { rate: 0.94, pitch: 1 },
  analytical: { rate: 0.93, pitch: 1 },
  mean: { rate: 0.95, pitch: 0.98 },
};

/** Narration starts with the current cue once the browser allows speech. */
export function useSketchRelayVoice({ allowed, paused, cueKey, caption, mood = "nice" }: { allowed: boolean; paused: boolean; cueKey: string; caption: string; mood?: NarratorMood }) {
  const [enabled, setEnabled] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const spoken = useRef("");
  const voiceGeneration = useRef(0);

  const cancel = useCallback(() => {
    voiceGeneration.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    publishNarrationDuck(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
    const generation = ++voiceGeneration.current;
    try {
      window.speechSynthesis.cancel();
      publishNarrationDuck(false);
      const line = new SpeechSynthesisUtterance(text);
      line.onstart = () => { if (voiceGeneration.current === generation) publishNarrationDuck(true); };
      line.onend = line.onerror = () => { if (voiceGeneration.current === generation) publishNarrationDuck(false); };
      const voice = selectSketchNarratorVoice(window.speechSynthesis.getVoices());
      if (voice) line.voice = voice;
      line.lang = voice?.lang ?? "en";
      line.rate = DELIVERY[mood].rate;
      line.pitch = DELIVERY[mood].pitch;
      line.volume = 0.85;
      window.speechSynthesis.speak(line);
      return true;
    } catch { publishNarrationDuck(false); return false; }
  }, [mood]);

  const toggle = useCallback(() => {
    if (!allowed) return;
    if (enabled) { setEnabled(false); cancel(); spoken.current = ""; return; }
    if (paused) { setEnabled(true); return; }
    if (speak(caption)) { setEnabled(true); spoken.current = cueKey; }
    else setUnavailable(true);
  }, [allowed, enabled, paused, speak, caption, cueKey, cancel]);

  useEffect(() => {
    if (!allowed || paused || !enabled) { cancel(); if (!paused) spoken.current = ""; return; }
    const speakCurrentCue = () => {
      if (spoken.current !== cueKey && speak(caption)) spoken.current = cueKey;
    };
    if (navigator.userActivation?.hasBeenActive === false) {
      const activate = (event: Event) => {
        if (event.isTrusted && navigator.userActivation?.hasBeenActive) speakCurrentCue();
      };
      window.addEventListener("click", activate);
      window.addEventListener("keyup", activate);
      return () => {
        window.removeEventListener("click", activate);
        window.removeEventListener("keyup", activate);
        cancel();
      };
    }
    speakCurrentCue();
    return cancel;
  }, [allowed, paused, enabled, cueKey, caption, speak, cancel]);

  useEffect(() => cancel, [cancel]);
  return { enabled: enabled && allowed, unavailable, toggle };
}
