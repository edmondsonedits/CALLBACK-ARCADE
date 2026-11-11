"use client";
import { FishBonusHost, type FishHostAudioSettings } from "../fish/FishFinalePanel";
/* eslint-disable @next/next/no-img-element -- Authenticated room media retains room-session cookies. */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { SnapshotSketchRelay, SketchRelaySnapshotChain, SketchRelaySnapshotLeg } from "../../../lib/arcade/sketch-relay";
import { SKETCH_STAGE_COPY, sketchRevealFrame, useSketchRelayVoice } from "../../../lib/game/sketch-relay-audio";
import { PracticeDoodle } from "./PracticeDoodle";
import styles from "./SketchRelayStage.module.css";
import { SketchShowdownStage } from "./SketchShowdownStage";
import type { PublicPlayer } from "../../../lib/contracts";

export type SketchRelaySnapshot = SnapshotSketchRelay;
type Advance = (type: "ADVANCE_SKETCH_RELAY", payload: { matchId: string; round: number; phase: SnapshotSketchRelay["phase"]; transition: "next" | "replay" }) => Promise<unknown>;
export interface SketchRelayStageProps {
  snapshot: SnapshotSketchRelay;
  roomCode: string;
  players?: Array<Pick<PublicPlayer, "id" | "nickname"> & Partial<PublicPlayer>>;
  remaining?: number | null;
  paused?: boolean;
  allowAudio?: boolean;
  allowNarration?: boolean;
  fishAudioSettings?: FishHostAudioSettings;
  onAction?: Advance;
  onPlayAgain?: () => Promise<unknown>;
}

function Mark({ kind = "spark", className = "" }: { kind?: "spark" | "pen" | "eye" | "wand" | "crown"; className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">{kind === "pen" ? <><path d="m16 44-4 9 10-3L51 21 42 12 16 39Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><path d="m37 17 10 10M16 39l7 8" stroke="currentColor" strokeWidth="3" /><path d="M28 53h23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></> : kind === "eye" ? <><path d="M6 32S16 15 32 15s26 17 26 17-10 17-26 17S6 32 6 32Z" stroke="currentColor" strokeWidth="3" /><circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="3" /><path d="M32 5v5M12 11l4 5M52 11l-4 5" stroke="currentColor" strokeWidth="2" /></> : kind === "crown" ? <><path d="m9 21 12 11L32 13l11 19 12-11-6 28H15L9 21Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><path d="M17 55h30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="32" cy="38" r="3" fill="currentColor" /></> : kind === "wand" ? <><path d="m12 53 31-31m-6-6 12 12M43 7v7M57 20h-7M53 9l-5 5M16 12l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7ZM47 38l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></> : <><path d="m32 5 6 20 21 7-21 6-6 21-7-21L5 32l20-7L32 5Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /><path d="m52 6 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" fill="currentColor" /></>}</svg>;
}

const mediaUrl = (room: string, assetId: string) => `/api/rooms/${encodeURIComponent(room)}/media/${encodeURIComponent(assetId)}`;
const clamp = (number: number, min: number, max: number) => Math.max(min, Math.min(max, number));

export function SketchRelayStage(props: SketchRelayStageProps) {
  const stage = props.snapshot.showdown ? <SketchShowdownStage {...props} /> : <LegacySketchRelayStage {...props} />;
  const fishTest = props.snapshot.fishTest && props.snapshot.finale?.phase !== "closed";
  return fishTest || props.snapshot.phase === "complete" && props.snapshot.showdown?.multiplier === 3 ? <FishBonusHost game={props.snapshot} code={props.roomCode} host={Boolean(props.onAction)} allowAudio={props.allowAudio} audioSettings={props.fishAudioSettings} players={props.players}>{stage}</FishBonusHost> : stage;
}
function LegacySketchRelayStage({ snapshot, roomCode, players = [], remaining = null, paused = false, allowAudio = true, allowNarration = true, onAction, onPlayAgain }: SketchRelayStageProps) {
  const [tutorial, setTutorial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = new Map(players.map((player) => [player.id, player.nickname]));
  const name = (id: string) => names.get(id) ?? "An artist";
  const copy = SKETCH_STAGE_COPY[snapshot.phase];
  const frame = sketchRevealFrame(remaining);
  const reveal = snapshot.phase === "revealing" ? snapshot.reveal : undefined;
  const leg = frame.leg === "drawing" ? reveal?.drawing : reveal?.redraw;
  const caption = reveal ? frame.leg === "drawing" ? `It started with “${reveal.prompt}”. Here is ${name(reveal.originalPlayerId)}’s first sketch.` : `${name(reveal.captionPlayerId)} described it as “${reveal.caption || "a mysterious picture"}”. Here is ${name(reveal.redrawPlayerId)}’s redraw.` : copy.cue;
  const voice = useSketchRelayVoice({ allowed: allowAudio && allowNarration, paused, cueKey: `${snapshot.matchId}:${snapshot.round}:${snapshot.phase}:${snapshot.revealIndex}:${reveal ? frame.leg : ""}`, caption });
  const isResults = snapshot.phase === "complete" || snapshot.phase === "round-results";
  const seconds = remaining == null ? null : Math.max(0, Math.ceil(remaining / 1000));
  const progress = copy.duration ? clamp((remaining ?? copy.duration) / copy.duration, 0, 1) : 1;
  const ready = clamp(snapshot.submittedCount, 0, snapshot.totalPlayers);

  async function advance(transition: "next" | "replay") {
    if (!onAction || busy || paused) return;
    setBusy(true); setError("");
    try { await onAction("ADVANCE_SKETCH_RELAY", { matchId: snapshot.matchId, round: snapshot.round, phase: snapshot.phase, transition }); }
    catch { setError("The room could not be updated. Please try again."); }
    finally { setBusy(false); }
  }

  return <section className={`${styles.stage} ${paused ? styles.paused : ""}`} aria-label="Sketch and Sorcery shared screen">
    <div className={styles.arch} aria-hidden="true" /><div className={styles.orbit} aria-hidden="true" />
    <div className={styles.motes} aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--i": index } as CSSProperties} />)}</div>
    <header className={styles.header}>
      <div className={styles.brand}><div className={styles.brandSeal}><Mark kind="pen" /></div><div><span className={styles.wordmark}>CALLBACK</span><h1>Sketch <em>&</em> Sorcery</h1></div></div>
      <div className={styles.rounds} aria-label={`Round ${snapshot.round} of ${snapshot.totalRounds}`}><span>THE ENCHANTED DRAWING ROOM</span><div>{Array.from({ length: snapshot.totalRounds }, (_, index) => <i key={index} className={index + 1 === snapshot.round ? styles.currentRound : index + 1 < snapshot.round ? styles.finishedRound : ""}>{index + 1 < snapshot.round ? "✓" : `0${index + 1}`}</i>)}<b>ROUND {snapshot.round} / {snapshot.totalRounds}</b></div></div>
      <div className={styles.room}><span>YOUR ROOM</span><strong>{roomCode}</strong></div>
    </header>

    <main className={styles.main}>
      {reveal ? <div className={styles.revealLayout}>
        <div className={styles.revealHeading}><div><p className={styles.eyebrow}>THE GRAND REVEAL <span>· CHAIN {snapshot.revealIndex + 1} / {snapshot.revealTotal}</span></p><h2>It started with <em>“{reveal.prompt}”</em></h2></div><div className={styles.revealSteps}><span className={frame.leg === "drawing" ? styles.liveStep : styles.doneStep}>01 <b>The first sketch</b></span><span className={frame.leg === "redraw" ? styles.liveStep : ""}>02 <b>The redraw</b></span></div></div>
        <div className={styles.revealBody}><div className={styles.artDais}><Artwork key={`${reveal.chainId}:${frame.leg}`} leg={leg} seed={`${reveal.chainId}:${frame.leg}`} roomCode={roomCode} progress={frame.progress} artist={name(frame.leg === "drawing" ? reveal.originalPlayerId : reveal.redrawPlayerId)} redraw={frame.leg === "redraw"} /><div className={styles.daisLine} aria-hidden="true" /></div><aside className={styles.story}>
          <p className={styles.eyebrow}>THE IMAGINATION RELAY</p><div className={styles.storyEntry}><span className={styles.storyNumber}>1</span><div><small>{name(reveal.originalPlayerId)} DREW</small><p>“{reveal.prompt}”</p></div></div>
          <div className={`${styles.storyEntry} ${frame.leg === "redraw" ? styles.highlightStory : ""}`}><span className={styles.storyNumber}>2</span><div><small>{name(reveal.captionPlayerId)} SAW</small><p>“{reveal.caption || "No caption arrived"}”</p></div></div>
          <div className={styles.storyEntry}><span className={styles.storyNumber}>3</span><div><small>{name(reveal.redrawPlayerId)} REDREW</small><p>The rumour takes shape.</p></div></div><div className={styles.revealNote}><Mark kind="spark" /><span>Same idea.<br />A wonderfully different journey.</span></div>
        </aside></div>
      </div> : isResults ? <Results snapshot={snapshot} roomCode={roomCode} name={name} /> : <div className={styles.activityLayout}>
        <div className={styles.instructions}><p className={styles.eyebrow}>{copy.eyebrow}</p><h2>{copy.title.split("\n").map((line, index) => <span key={line} className={index ? styles.accentLine : ""}>{line}</span>)}</h2><p className={styles.instructionText}>{copy.instruction}</p><div className={styles.phoneHint}><span className={styles.phoneIcon} aria-hidden="true"><i /></span><span>{snapshot.phase.startsWith("transforming") ? "The next task will appear on your phone." : "Your phone is your canvas. Look there to play."}</span></div>
          <div className={styles.readyPanel}><div><span>{snapshot.phase.startsWith("transforming") ? "THE STUDIO IS WORKING" : "ARTISTS FINISHED"}</span><strong>{ready}<i> / {snapshot.totalPlayers}</i></strong></div><div className={styles.readyTrack} aria-label={`${ready} of ${snapshot.totalPlayers} finished`}>{Array.from({ length: Math.min(10, snapshot.totalPlayers) }, (_, index) => <i key={index} className={index < ready ? styles.readyTick : ""} />)}</div><small>{snapshot.phase.startsWith("transforming") ? "A spell can fizzle. Original sketches always stay in the game." : "Prompts and pictures stay secret until the big reveal."}</small></div>
        </div><StudioScene phase={snapshot.phase} />
      </div>}
    </main>

    <footer className={styles.footer}>
      <div className={styles.roster} aria-label="Artists in this game">{snapshot.players.slice(0, 10).map((id, index) => <div className={styles.player} key={id} style={{ "--player-hue": `${35 + index * 37}deg` } as CSSProperties}><span>{name(id).slice(0, 1).toUpperCase()}</span><div><b>{name(id)}</b><small>{snapshot.scores[id] ?? 0} <i>points</i></small></div></div>)}</div>
      {snapshot.phase !== "complete" && <div className={`${styles.timer} ${seconds != null && seconds <= 10 && !paused ? styles.timerUrgent : ""}`} style={{ "--clock": `${progress * 100}%` } as CSSProperties} role="timer" aria-label={paused ? "Game paused" : seconds == null ? "Synchronizing clock" : `${seconds} seconds remaining`}><span>{paused ? "Ⅱ" : seconds == null ? "–" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</span><small>{paused ? "PAUSED" : "REMAINING"}</small></div>}
    </footer>

    <div className={styles.controlBar}><div className={styles.captionLine}><Mark kind="spark" /><p>{voice.unavailable ? "Voice is unavailable in this browser. All instructions stay on screen." : paused ? "The studio is paused. Your work is safe." : caption}</p></div><div className={styles.controls}><button type="button" onClick={() => setTutorial(true)}>How to play</button>{allowAudio && <button type="button" aria-pressed={voice.enabled} disabled={!allowNarration} onClick={voice.toggle}>{voice.enabled ? "Voice on" : "Enable voice"}<span aria-hidden="true"> {voice.enabled ? "◖))" : "◖)"}</span></button>}{onAction && snapshot.phase === "revealing" && <button type="button" disabled={busy || paused} onClick={() => void advance("replay")} aria-label="Replay this reveal from the beginning">↺ Replay</button>}{onAction && (snapshot.phase === "revealing" || snapshot.phase === "round-results") && <button className={styles.nextButton} type="button" disabled={busy || paused} onClick={() => void advance("next")}>{busy ? "One moment…" : snapshot.phase === "round-results" ? snapshot.round < snapshot.totalRounds ? "Next round →" : "Open exhibition →" : "Next →"}</button>}{snapshot.phase === "complete" && onPlayAgain && <button type="button" className={styles.nextButton} disabled={busy} onClick={async () => { setBusy(true); try { await onPlayAgain(); } catch { setError("Could not start a new game. Please try again."); } finally { setBusy(false); } }}>Play again ↗</button>}</div></div>
    {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
    {paused && <div className={styles.pauseRibbon}>Ⅱ STUDIO PAUSED</div>}
    {tutorial && <Tutorial paused={paused} onClose={() => setTutorial(false)} />}
  </section>;
}

function StudioScene({ phase }: { phase: SnapshotSketchRelay["phase"] }) {
  const magic = phase === "transforming" || phase === "transforming-redraw";
  const guessing = phase === "captioning";
  return <div className={`${styles.studioScene} ${magic ? styles.magicScene : ""}`} aria-hidden="true"><div className={styles.runeRing}><i /><i /><i /><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div><div className={styles.floatingPaper}><div className={styles.paperTop}><i /><span>THE {guessing ? "WILD GUESS" : magic ? "MAGIC" : "IMAGINATION"} DEPARTMENT</span><i /></div><svg viewBox="0 0 400 300" className={styles.studioDrawing} fill="none"><path d="M103 235c-23-34-33-78-10-118 20-34 58-52 99-45 24-33 80-27 95 8 43 3 70 37 62 73-5 23-16 33-33 42l-6 40" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><path d="m120 237 10-44 18 14 19-29 20 25 21-40 27 37 21-16 16 52H120Z" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" /><circle cx="143" cy="124" r="9" stroke="currentColor" strokeWidth="4" /><circle cx="241" cy="114" r="9" stroke="currentColor" strokeWidth="4" /><path d="M179 144c7 10 18 11 26-2M86 77l-18-9M92 54l-5-22M291 45l9-20M330 65l21-9M65 153l-17 5M345 203l20 7" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><path d="m172 45 6-17 6 17 17 6-17 6-6 17-6-17-17-6 17-6Z" stroke="currentColor" strokeWidth="3" /><path d="M121 263c68 7 121 4 166-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg><span className={styles.paperStamp}>{guessing ? "WHAT DO YOU SEE?" : magic ? "ENCHANTMENT IN PROGRESS" : "NO ART SKILLS REQUIRED"}</span>{magic && <div className={styles.lightSweep} />}</div><div className={styles.floatingBadge}><Mark kind={guessing ? "eye" : magic ? "wand" : "pen"} /></div><div className={styles.sceneCaption}><span>✦</span> {guessing ? "A picture is worth a thousand wrong guesses." : magic ? "A little ink. A little magic. A lot of possibility." : "Great ideas. Gloriously questionable sketches."} <span>✦</span></div></div>;
}

function SourceArt({ leg, roomCode, seed, className = "" }: { leg?: SketchRelaySnapshotLeg; roomCode: string; seed: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (leg?.practice) return <PracticeDoodle seed={seed} className={className} label="Free practice sketch" />;
  if (!leg?.assetId || failed) return <div className={`${styles.missingArt} ${className}`}><Mark kind="pen" /><strong>{failed ? "Sketch could not load" : "No sketch arrived"}</strong><span>{failed ? "The story continues below." : "Even blank pages have a story."}</span></div>;
  // Room media is authenticated and cannot be replaced with a public image optimizer.
  return <img className={className} src={mediaUrl(roomCode, leg.assetId)} alt="The player's original sketch" onError={() => setFailed(true)} />;
}

function Artwork({ leg, roomCode, progress, artist, redraw, seed }: { leg?: SketchRelaySnapshotLeg; roomCode: string; progress: number; artist: string; redraw: boolean; seed: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [comparison, setComparison] = useState<"auto" | "before" | "after">("auto");
  const target = !leg?.practice && leg?.image.status === "READY" && leg.image.assetId ? leg.image.assetId : undefined;
  const available = Boolean(target && loaded && !failed);
  const opacity = available ? comparison === "before" ? 0 : comparison === "after" ? 1 : progress : 0;
  const status = leg?.practice ? "Free practice · coded sketch" : failed || leg?.image.status === "FALLBACK" || leg?.image.status === "MISSING" ? "Spell unavailable · original sketch preserved" : target && !loaded ? "Loading enchantment · original stays visible" : !target ? "Original sketch · no transformation available" : opacity >= 0.95 ? "The enchanted version" : opacity > 0 ? "A little sorcery is happening…" : "The original sketch";
  return <div className={styles.artwork}><div className={styles.artMeta}><span>{redraw ? "02 · THE REDRAW" : "01 · THE FIRST SKETCH"}</span><b>by {artist}</b></div><div className={styles.artFrame}><div className={styles.artPlane}><SourceArt leg={leg} roomCode={roomCode} seed={seed} className={styles.sourceImage} />{target && !failed && <>
      <img className={styles.transformedImage} src={mediaUrl(roomCode, target)} alt="AI transformation of this sketch" style={{ opacity }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      {available && opacity > 0 && opacity < 1 && <div className={styles.revealSweep} aria-hidden="true" style={{ left: `${opacity * 100}%` }} />}
    </>}</div><div className={styles.reducedComparison}><div><span>Original sketch</span><SourceArt leg={leg} roomCode={roomCode} seed={seed} /></div>{available && <div><span>AI transformation</span><img src={mediaUrl(roomCode, target!)} alt="AI transformation beside the original sketch" /></div>}</div><i className={styles.frameCorner} /><i className={styles.frameCorner} /><i className={styles.frameCorner} /><i className={styles.frameCorner} /></div><div className={styles.artBottom}><span className={styles.artStatus} aria-live="polite"><i />{status}</span><div className={styles.compareControls} aria-label="Image comparison"><button type="button" aria-pressed={comparison === "before"} onClick={() => setComparison("before")}>Before</button><button type="button" aria-pressed={comparison === "auto"} onClick={() => setComparison("auto")}>Magic</button><button type="button" disabled={!available} aria-pressed={comparison === "after"} onClick={() => setComparison("after")}>After</button></div></div></div>;
}

function GalleryArt({ leg, roomCode, seed }: { leg?: SketchRelaySnapshotLeg; roomCode: string; seed: string }) {
  const [failed, setFailed] = useState(false);
  if (!leg?.practice && leg?.image.status === "READY" && leg.image.assetId && !failed) return <><img src={mediaUrl(roomCode, leg.image.assetId)} alt="Transformed player sketch" onError={() => setFailed(true)} /><span className={styles.thumbnailTag}>AI transformation</span></>;
  return <><SourceArt leg={leg} roomCode={roomCode} seed={seed} /><span className={styles.thumbnailTag}>{leg?.practice ? "Free practice" : "Original sketch"}</span></>;
}

function Results({ snapshot, roomCode, name }: { snapshot: SnapshotSketchRelay; roomCode: string; name: (id: string) => string }) {
  const [page, setPage] = useState(0);
  const complete = snapshot.phase === "complete";
  const chains = (snapshot.chains ?? []).filter((chain) => complete || chain.round === snapshot.round).slice(0, 30);
  const pageSize = 3;
  const pages = Math.max(1, Math.ceil(chains.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const ranked = [...snapshot.players].sort((a, b) => (snapshot.scores[b] ?? 0) - (snapshot.scores[a] ?? 0));
  const highest = ranked.length ? snapshot.scores[ranked[0]] ?? 0 : 0;
  const winners = ranked.filter((id) => (snapshot.scores[id] ?? 0) === highest);
  return <div className={styles.results}><div className={styles.resultsHeading}><div><p className={styles.eyebrow}>{complete ? "THREE ROUNDS. ENDLESS IMAGINATION." : `ROUND ${snapshot.round} · A ROUND OF APPLAUSE`}</p><h2>{complete ? "Beautifully bewildering." : "That took a turn."}</h2></div><p>{complete ? highest > 0 ? winners.length === 1 ? `${name(winners[0])} takes the top score.` : `${winners.length} artists share the top score.` : "Every artist deserves a bow." : "Pick a favourite sketch on your phone. Give its artist some applause."}</p></div><div className={styles.resultsBody}><aside className={styles.standings}><div className={styles.standingsTitle}><Mark kind="crown" /><h3>{complete ? "The final tally" : "Scores so far"}</h3></div><ol>{ranked.map((id, index) => <li key={id} className={highest > 0 && (snapshot.scores[id] ?? 0) === highest ? styles.leader : ""}><span>{index > 0 && (snapshot.scores[ranked[index - 1]] ?? 0) === (snapshot.scores[id] ?? 0) ? "=" : index + 1}</span><b>{name(id)}</b><strong>{snapshot.scores[id] ?? 0}</strong></li>)}</ol><p>For the art. For the laughs.<br />For the wonderfully wrong turns.</p></aside><section className={styles.gallery} aria-label="Sketch relay gallery"><div className={styles.galleryHeader}><div><span className={styles.eyebrow}>{complete ? "THE COMPLETE EXHIBITION" : "THIS ROUND’S EXHIBITION"}</span><h3>A gallery of happy accidents <small>{chains.length} chains</small></h3></div><div className={styles.pagination}><button type="button" aria-label="Previous gallery page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>←</button><span>{currentPage + 1} / {pages}</span><button type="button" aria-label="Next gallery page" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>→</button></div></div><div className={styles.galleryCards}>{chains.length ? chains.slice(currentPage * pageSize, currentPage * pageSize + pageSize).map((chain) => <ChainCard key={chain.chainId} chain={chain} name={name} roomCode={roomCode} />) : <div className={styles.emptyGallery}><Mark kind="spark" /><p>The room’s exhibition is being prepared.</p></div>}</div></section></div></div>;
}

function ChainCard({ chain, roomCode, name }: { chain: SketchRelaySnapshotChain; roomCode: string; name: (id: string) => string }) {
  return <article className={styles.chainCard}><div className={styles.chainHeader}><span>ROUND {chain.round}</span><Mark kind="spark" /></div><h4>“{chain.prompt}”</h4><div className={styles.chainImages}><div><GalleryArt key={`${chain.chainId}:drawing`} leg={chain.drawing} roomCode={roomCode} seed={`${chain.chainId}:drawing`} /></div><span aria-hidden="true">→</span><div><GalleryArt key={`${chain.chainId}:redraw`} leg={chain.redraw} roomCode={roomCode} seed={`${chain.chainId}:redraw`} /></div></div><div className={styles.chainArtists}><span>{name(chain.originalPlayerId)}</span><span>{name(chain.redrawPlayerId)}</span></div><blockquote>“{chain.caption || "No caption arrived"}”<cite>— {name(chain.captionPlayerId)}</cite></blockquote></article>;
}

function Tutorial({ paused, onClose }: { paused: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const steps = [
    { icon: "pen" as const, title: "A secret. A sketch.", text: "Choose one of three prompts on your phone. Draw it. Your art skills are entirely optional.", label: "DRAW" },
    { icon: "eye" as const, title: "A spell. A wild guess.", text: "Your sketch gets an enchanted transformation. Someone else describes what they see, then another artist draws that caption.", label: "PASS IT ON" },
    { icon: "spark" as const, title: "The beautiful chaos.", text: "Watch each chain unfold on the big screen. Applaud your favourite sketches on your phone. After three rounds, explore the whole exhibition.", label: "REVEAL & APPLAUD" },
  ];
  return <dialog className={styles.tutorial} ref={dialog} aria-labelledby="sketch-tutorial-title" onCancel={onClose}><div className={styles.tutorialTop}><span>HOW TO PLAY · {step + 1} / 3</span><button type="button" onClick={onClose} aria-label="Close how to play">×</button></div><div className={styles.tutorialSymbol}><Mark kind={steps[step].icon} /></div><p className={styles.eyebrow}>{steps[step].label}</p><h2 id="sketch-tutorial-title">{steps[step].title}</h2><p>{steps[step].text}</p><div className={styles.tutorialClock}>{paused ? "Ⅱ The game is paused." : "◷ The live round clock keeps running during this guide."}</div><div className={styles.tutorialBottom}><button type="button" onClick={step ? () => setStep(step - 1) : onClose}>{step ? "← Back" : "Skip guide"}</button><div aria-label={`Step ${step + 1} of 3`}>{steps.map((_, index) => <i key={index} className={step === index ? styles.tutorialActive : ""} />)}</div><button type="button" onClick={step < 2 ? () => setStep(step + 1) : onClose}>{step < 2 ? "Next →" : "Let’s play ↗"}</button></div></dialog>;
}
