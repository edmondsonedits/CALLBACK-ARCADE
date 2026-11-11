"use client";
import {SorceryReveal} from "./SorceryReveal";
/* eslint-disable @next/next/no-img-element -- Room images require authenticated cookies. */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SKETCH_CURSE_LABELS, type ShowdownEntry } from "../../../lib/arcade/sketch-relay";
import { showdownCopy, showdownProgress } from "../../../lib/game/sketch-showdown-script";
import { NARRATOR_MOODS } from "../../../lib/content/sketch-narrator-lines";
import { NARRATOR_PERSONALITIES, type NarratorSelection } from "../../../lib/game/sketch-narrator";
import { useSketchNarrator } from "./useSketchNarrator";
import { useSketchRelayVoice } from "../../../lib/game/sketch-relay-audio";
import { poseSequenceAt } from "../../../lib/avatar-motion";
import { NEUTRAL_POSE, type AvatarPose } from "../../../lib/avatar-pose";
import { Avatar } from "../Avatar";
import { PracticeDoodle } from "./PracticeDoodle";
import type { SketchRelayStageProps } from "./SketchRelayStage";
import styles from "./SketchShowdown.module.css";

export const showdownMedia = (code: string, id: string) => `/api/rooms/${encodeURIComponent(code)}/media/${encodeURIComponent(id)}`;
export function ShowdownArt({ entry, code, original = false }: { entry: ShowdownEntry; code: string; original?: boolean }) {
  const [failed, setFailed] = useState(false);
  const asset = original ? entry.originalAssetId : entry.image.assetId;
  if (entry.practice) return <PracticeDoodle seed={entry.entryId} restriction={entry.practiceStyle?.restriction} starter={entry.practiceStyle?.starter} />;
  if (!asset || failed) return <div className={styles.missingArt}><span aria-hidden="true">✦</span><p>This masterpiece is taking the scenic route.</p><small>The game keeps going.</small></div>;
  return <img src={showdownMedia(code, asset)} alt={original ? `Original sketch for drawing ${entry.letter}` : `Drawing ${entry.letter}`} onError={() => setFailed(true)} draggable={false} />;
}

export function Performer({ player, index, emote, serverNow }: { player: NonNullable<SketchRelayStageProps["players"]>[number]; index: number; emote?: NonNullable<NonNullable<SketchRelayStageProps["snapshot"]["showdown"]>["emote"]>; serverNow: number }) {
  const [motion, setMotion] = useState<{ pose: AvatarPose; active: boolean }>({ pose: NEUTRAL_POSE, active: false });
  const playback = useRef<{ key: string; startedAt: number | null; stale: boolean } | null>(null);
  useEffect(() => {
    const idle = () => setMotion(current => current.active ? { pose: NEUTRAL_POSE, active: false } : current);
    let frame = 0, endTimer = 0;
    if (!emote) { frame = requestAnimationFrame(idle); return () => cancelAnimationFrame(frame); }
    const key = `${emote.playerId}:${emote.sequence}:${emote.expiresAt}`;
    // Transport latency must not consume the performance. A bounded grace period
    // avoids reviving old moves when a TV reconnects much later in the same reveal.
    if (playback.current?.key !== key) playback.current = { key, startedAt: null, stale: serverNow > emote.expiresAt + 8000 };
    const current = playback.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      // A busy or backgrounded TV must paint its first frame before time is consumed.
      current.startedAt ??= performance.now();
      const elapsed = performance.now() - current.startedAt;
      if (current.stale || elapsed >= 2600) { idle(); return; }
      const poseTime = reduced ? 500 : elapsed;
      const wave = Math.sin(Math.min(1, Math.max(0, poseTime / 2200)) * Math.PI);
      const pose = emote.name === "bow" ? { ...NEUTRAL_POSE, body: wave * 28, head: wave * 25, leftArm: wave * 15, rightArm: -wave * 15 } : emote.name === "shrug" ? { ...NEUTRAL_POSE, leftArm: wave * 65, rightArm: -wave * 65, head: -wave * 14 } : poseSequenceAt(emote.name, poseTime);
      setMotion({ pose, active: true });
      if (reduced) { endTimer = window.setTimeout(idle, 2600 - elapsed); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => { cancelAnimationFrame(frame); window.clearTimeout(endTimer); };
  }, [emote, serverNow]);
  const moveLabels = { dance: "Dancing", cheer: "Cheering", wave: "Waving", bow: "Taking a bow", shrug: "Who, me?", facepalm: "Facepalm" };
  return <div className={styles.performer} data-testid="revealed-artist-avatar" data-player-id={player.id} data-emote={emote?.name ?? "idle"} data-performing={motion.active}><div className={styles.halo} /><Avatar index={player.avatar ?? index} color={player.color ?? "#46DBDC"} config={player.avatarConfig} playerId={player.id} size="large" pose={motion.pose} label={`${player.nickname}'s avatar`} /><div className={styles.performerName}><span aria-live="polite">{motion.active && emote ? moveLabels[emote.name] : "THE ARTIST"}</span><strong>{player.nickname}</strong></div></div>;
}

export function SketchShowdownStage({ snapshot: game, roomCode, players = [], remaining = null, paused = false, allowAudio = true, allowNarration = true, onAction, onPlayAgain }: SketchRelayStageProps) {
  const d = game.showdown!; const copy = showdownCopy(game);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const cue = useSketchNarrator(game, remaining, players, paused);
  const voice = useSketchRelayVoice({ allowed: allowAudio && allowNarration, paused: paused || !cue.voiceReady, cueKey: cue.key, caption: cue.text, mood: cue.mood });
  const seconds = Math.max(0, Math.ceil((remaining ?? d.phaseDuration) / 1000));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const elapsed = Math.max(0, d.phaseDuration - (remaining ?? d.phaseDuration));
  // Persisted duration keeps exhibitions already in progress aligned after an update.
  const focus = game.phase === "showcase" ? d.entries[Math.min(d.entries.length - 1, Math.floor(elapsed / Math.max(1, d.phaseDuration / Math.max(1, d.entries.length))))] : undefined;
  const reveal = d.revealEntry;
  const name = (id?: string) => players.find(p => p.id === id)?.nickname ?? "Mystery artist";
  const revealPlayer = players.find(p => p.id === reveal?.playerId);
  const ranked = [...game.players].sort((a, b) => (game.scores[b] ?? 0) - (game.scores[a] ?? 0));
  const progress = Math.max(0, Math.min(1, (remaining ?? d.phaseDuration) / Math.max(1, d.phaseDuration)));
  const serverNow = game.deadline - (remaining ?? d.phaseDuration);
  async function next(replay = false) { if (!onAction || busy || paused) return; setBusy(true); setError(""); try { await onAction("ADVANCE_SKETCH_RELAY", { matchId: game.matchId, round: game.round, phase: game.phase, transition: replay ? "replay" : "next" }); } catch { setError("The stage could not advance. Please try again."); } finally { setBusy(false); } }
  async function playAgain() { if (!onPlayAgain || busy || paused) return; setBusy(true); setError(""); try { await onPlayAgain(); } catch { setError("The next exhibition could not start. Your results are safe. Try One more exhibition again."); } finally { setBusy(false); } }
  const scoreboard = game.phase === "complete" || game.phase === "round-results";
  const hallEntries=(d.workshop?.hallWinners??[]).map(id=>d.revealedEntries.find(e=>e.entryId===id)).filter((entry):entry is ShowdownEntry=>Boolean(entry));
  const hallHonour=hallEntries.length?<p className={styles.hallHonour} data-testid="sorcery-hall-honours"><strong>Edmondson Hall honour</strong><span>{hallEntries.map(e=>`Drawing ${e.letter} · ${name(e.playerId)}`).join(' / ')}</span></p>:null;
  return <section className={`${styles.stage} ${paused ? styles.paused : ""}`} aria-label="Sketch and Sorcery shared screen" data-phase={game.phase}>
    <div className={styles.ambient} aria-hidden="true" /><div className={styles.inkRing} aria-hidden="true" /><div className={styles.spellMotes} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ "--mote": i } as CSSProperties}>✧</i>)}</div>
    <header className={styles.broadcast}><div className={styles.brand}><span className={styles.brandIcon}>✦</span><div><small>CALLBACK PRESENTS</small><h1>Sketch <em>&</em> Sorcery</h1></div></div><div className={styles.chapter}><span>{game.phase === "halfway" ? "NEXT ROUND" : "THE ENCHANTED DRAWING ROOM"}</span><strong>ROUND <b>{game.round}</b> <i>/</i> {game.totalRounds} · {d.multiplier ?? 1}×</strong></div><div className={styles.room}><small>ROOM</small><strong>{roomCode}</strong></div></header>
    <div className={styles.phaseRail} aria-label="Round progress">{showdownProgress(game.phase).map((step, i) => <span key={i} aria-current={step.active ? "step" : undefined} className={step.active ? styles.activeStep : ""}><b>{String(i + 1).padStart(2, "0")}</b>{step.label}</span>)}</div>
    <main className={styles.stageMain} key={`${game.round}:${game.phase}`}>
      {reveal ? <div className={styles.revealScene} key={reveal.entryId}><div className={styles.revealTitle}><span className={styles.eyebrow}>THE ARTIST UNMASKED · DRAWING {reveal.letter}</span><h2>{name(reveal.playerId)} <em>did this.</em></h2><p>{reveal.prompt ?? d.prompt}</p></div><div className={styles.comparison}><SorceryReveal elapsed={elapsed} fallback={d.fallback} original={<ShowdownArt key={`${reveal.entryId}:original`} entry={reveal} code={roomCode} original />} enchanted={<ShowdownArt key={reveal.entryId} entry={reveal} code={roomCode} />} />{revealPlayer && <Performer key={`${reveal.entryId}:${d.emote?.sequence ?? 0}`} player={revealPlayer} index={players.indexOf(revealPlayer)} emote={paused ? undefined : d.emote} serverNow={serverNow} />}</div><div className={styles.revealScore}><span className={styles.place}>{reveal.place === 1 ? "♛" : `#${reveal.place}`}</span><div><strong>{reveal.laughterPoints ?? 0}</strong><span>LAUGHTER POINTS · {reveal.votes ?? 0} BALLOTS</span></div><p>{reveal.place === 1 && (reveal.laughterPoints ?? 0) > 0 ? "The room has excellent taste. Allegedly." : "A bold addition to the artistic record."}<small>{name(reveal.playerId)}, your phone is now your stage remote.</small></p></div></div>
      : focus ? <div className={styles.showcase} key={focus.entryId}><div className={styles.showcaseCaption}><span className={styles.eyebrow}>THE ANONYMOUS EXHIBITION</span><h2>Exhibit <em>{focus.letter}</em></h2><p>{d.prompt}</p></div><div className={styles.showcaseArt}><ShowdownArt entry={focus} code={roomCode} /><span className={styles.letterSeal}>{focus.letter}</span></div><span className={styles.secretBadge}>ARTIST: CLASSIFIED</span></div>
      : ["laughter-voting", "artist-guessing"].includes(game.phase) ? <div className={styles.galleryScene}><div className={styles.galleryTitle}><div><p className={styles.eyebrow}>{copy.eyebrow}</p><h2>{copy.title}</h2></div><p>{d.prompt}<small>{copy.instruction}</small></p></div><div className={styles.gallery} data-testid="showdown-gallery" style={{ "--columns": d.entries.length > 6 ? 5 : d.entries.length > 4 ? 3 : d.entries.length } as CSSProperties}>{d.entries.map((e, i) => <figure key={e.entryId} style={{ "--order": i } as CSSProperties}><div className={styles.galleryArt}><ShowdownArt entry={e} code={roomCode} /><b>{e.letter}</b></div><figcaption>DRAWING {e.letter}</figcaption></figure>)}</div>{!d.entries.length && <p className={styles.empty}>No drawings arrived this time. We’ll keep the exhibition moving.</p>}</div>
      : scoreboard ? <div className={styles.resultsScene}><div className={styles.resultsIntro}><span className={styles.eyebrow}>{copy.eyebrow}</span><h2>{copy.title}</h2><p>{game.phase === "complete" ? d.champions.length > 1 ? `${d.champions.map(name).join(" & ")} share the crown.` : `${name(d.champions[0])} takes the crown.` : d.workshop?.intermission ? copy.instruction : "Laughter earned. Artists identified. All points accounted for."}</p><span className={styles.resultCrown} aria-hidden="true">♛</span><p className={styles.royalFootnote}>The crown is imaginary. The bragging rights are legally quite loud.</p>{hallHonour}{game.phase === "complete" && onPlayAgain && <button className={styles.primary} disabled={busy || paused} onClick={() => void playAgain()}>{busy ? "Opening the next exhibition…" : "One more exhibition ↗"}</button>}</div><ol className={styles.standings} aria-label="Scores">{ranked.map((id, i) => { const p = players.find(p => p.id === id); const place = 1 + ranked.filter(other => (game.scores[other] ?? 0) > (game.scores[id] ?? 0)).length; return <li key={id} className={place === 1 ? styles.leader : ""}><b>{place === 1 ? "♛" : place}</b>{p && <Avatar index={p.avatar ?? i} color={p.color ?? "#46DBDC"} config={p.avatarConfig} size="small" playerId={p.id} />}<span>{name(id)}</span><strong>{game.scores[id] ?? 0}</strong></li>; })}</ol></div>
      : <div className={`${styles.interlude} ${game.phase === "halfway" ? styles.halfway : ""}`}><div className={styles.interludeCopy}><p className={styles.eyebrow}>{copy.eyebrow}</p><h2>{copy.title}</h2><p className={styles.instruction}>{game.phase === "drawing" && d.phaseDuration > 240_000 ? copy.instruction.replace("Four minutes", "Six minutes") : copy.instruction}</p>{hallHonour}{["drawing", "final-preparation"].includes(game.phase) && <blockquote>{game.round === 3 ? <>Shared base: {d.prompt}<small>Your complete private assignment is on your phone.</small></> : d.prompt}</blockquote>}{game.phase === "curse-selection" && d.curse && <div className={styles.curseBanner}><strong>{name(d.curse.chooserId)} chooses</strong><p>{d.curse.options.map(c => SKETCH_CURSE_LABELS[c]).join(" · ")}</p></div>}{game.round === 2 && d.curse?.selected && <p className={styles.curseBanner}>Curse: {SKETCH_CURSE_LABELS[d.curse.selected]} · 2× all points</p>}{game.phase === "prompt-voting" && <div className={styles.pointsRibbon}><span>1st <b>3</b></span><span>2nd <b>2</b></span><span>3rd <b>1</b></span><small>ORIGINAL PROMPTS WIN TIES</small></div>}{game.phase === "transforming" && <p className={styles.processing}>✦ Preserving your artistic decisions. Even those ones.</p>}<div className={styles.readyDots} aria-label={`${game.submittedCount} of ${game.totalPlayers} ready`}>{game.players.map((id, i) => <i key={id} className={["drawing", "prompt-writing"].includes(game.phase) ? d.pendingPlayers.includes(id) ? "" : styles.readyDot : i < game.submittedCount ? styles.readyDot : ""} />)}<span>{game.submittedCount} / {game.totalPlayers} {game.phase === "transforming" ? "enchanted" : "ready"}</span></div></div><div className={styles.interludeArt} aria-hidden="true"><div className={styles.magicDisc}><span>{game.phase === "halfway" ? `${game.round}/${game.totalRounds}` : game.phase === "drawing" ? "✎" : game.phase === "prompt-voting" ? game.totalRounds === 3 ? "Ⅲ" : "Ⅱ" : "✦"}</span></div><i className={styles.floatingNote}>ARTISTIC LICENCE<br /><b>GRANTED</b></i><i className={styles.floatingStamp}>HOUSE EDMONDSON<br />INK APPROVED</i></div></div>}
    {d.workshop?.reaction&&["drawing","transforming","round-results"].includes(game.phase)&&<div className={styles.workshopReaction} key={d.workshop.reaction.at} aria-live="polite">{d.workshop.reaction.kind==="sparkles"?"✦ ✧ ✦":d.workshop.reaction.kind==="applause"?"👏 A little applause from the workshop":"✒ The ink department is getting carried away"}</div>}
    {d.workshop?.closeUntil&&game.phase==="drawing"&&<p className={styles.workshopFinish}>Workshop artists: ten seconds to finish. Your draft will be saved.</p>}
    {d.workshop?.intermission&&<p className={styles.workshopFinish}>Edmondson Hall of Questionable Art · nominate your funniest on your phone. Optional workshop points settle before the next round.</p>}
    </main>
    <footer className={styles.footer}><div className={styles.narrator}><span className={styles.narratorSeal} aria-hidden="true">✦</span><div><small>THE HOUSE CRITIC · {NARRATOR_PERSONALITIES[cue.mood].label.toUpperCase()}</small><p aria-live="polite" data-testid="narrator-caption" data-cue-key={cue.key}>{cue.text}</p></div></div><div className={styles.controls}><label className={styles.moodControl}><span>Narrator mood</span><select aria-label="Narrator mood" title={NARRATOR_PERSONALITIES[cue.mood].description} value={cue.selection} onChange={e => cue.setSelection(e.target.value as NarratorSelection)}><option value="auto">Auto · {NARRATOR_PERSONALITIES[cue.mood].label}</option>{NARRATOR_MOODS.map(mood => <option key={mood} value={mood}>{NARRATOR_PERSONALITIES[mood].label}</option>)}</select></label><button onClick={voice.toggle} disabled={!allowAudio || !allowNarration} aria-pressed={voice.enabled}>{voice.enabled ? "Voice on" : "Turn narrator on"}</button>{voice.unavailable && <small>Voice unavailable · captions remain on</small>}{onAction && ["showcase", "revealing", "round-results", "halfway"].includes(game.phase) && <button disabled={busy || paused} onClick={() => void next()}>Next →</button>}{onAction && game.phase === "revealing" && <button disabled={busy || paused} onClick={() => void next(true)}>Replay</button>}{game.phase !== "complete" && <div className={`${styles.clock} ${seconds <= 10 ? styles.urgent : ""}`} role="timer"><strong>{paused ? "Ⅱ" : clock}</strong><span>{paused ? "PAUSED" : "REMAINING"}</span><i style={{ transform: `scaleX(${progress})` }} /></div>}</div></footer>
    {error && <p className={styles.stageError} role="alert">{error}</p>}
  </section>;
}
