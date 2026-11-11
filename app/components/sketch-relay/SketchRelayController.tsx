"use client";
import { ScrollPanel } from "../ScrollPanel";
import { FishBonusPhone } from "../fish/FishFinalePanel";
import { SketchShowcasePreference } from "../SketchShowcasePreference";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AudienceSnapshot, PlayerAction, PlayerSnapshot } from "../../../lib/contracts";
import type { SnapshotSketchRelay, SketchRelayImage, SketchRelaySnapshotLeg } from "../../../lib/arcade/sketch-relay";
import { randomUuid } from "../../../lib/game/random";
import { DrawingStudio } from "../drawing/DrawingStudio";
import { PracticeDoodle } from "./PracticeDoodle";
import styles from "./SketchRelayController.module.css";
import { SketchShowdownController } from "./SketchShowdownController";

type PhoneSnapshot = (PlayerSnapshot | AudienceSnapshot) & { sketchRelay?: SnapshotSketchRelay | null };
type Act = (type: PlayerAction["type"], payload: Record<string, unknown>) => Promise<unknown>;
export interface SketchRelayControllerProps {
  snapshot: PhoneSnapshot;
  remaining: number | null;
  reconnecting?: boolean;
  apiError?: string | null;
  act: Act;
  refresh: () => void;
}

export function SketchRelayController(props: SketchRelayControllerProps) {
  const game = props.snapshot.sketchRelay;
  if (game?.finale && game.finale.phase !== "closed") return <FishBonusPhone key={game.finale.finaleId} game={game} code={props.snapshot.code} selfId={props.snapshot.role === "player" ? props.snapshot.selfId : ""} soloHost={Boolean(game.fishTest && props.snapshot.role === "player" && props.snapshot.soloMode)} />;
  const drawing = props.snapshot.role === "player" && game?.players.includes(props.snapshot.selfId) && game.self && !game.self.submitted && ["drawing", "redrawing"].includes(game.phase);
  if (drawing) return <SketchRelayControllerInner {...props} />;
  return <div className="sketch-phone-viewport"><ScrollPanel resetKey={`${game?.matchId}:${game?.round}:${game?.phase}`}><SketchRelayControllerInner {...props} />{game?.phase === "complete" && props.snapshot.role === "player" && <SketchShowcasePreference code={props.snapshot.code} matchId={game.matchId} />}</ScrollPanel></div>;
}
function SketchRelayControllerInner({ snapshot, remaining, reconnecting = false, apiError, act, refresh }: SketchRelayControllerProps) {
  const game = snapshot.sketchRelay;
  if (!game) return <section className={styles.card} role="status">Getting your sketch ready…</section>;
  const self = game.self;
  const player = snapshot.role === "player" && game.players.includes(snapshot.selfId);
  const assignmentKey = `callback:sketch-relay:${snapshot.code}:${game.matchId}:${game.round}:${game.phase}:${self?.chainId ?? "watch"}`;
  const draw = player && self && !self.submitted && (game.phase === "drawing" || game.phase === "redrawing");
  if (draw) return <SketchAssignment key={assignmentKey} snapshot={snapshot} game={game} draftKey={assignmentKey} reconnecting={reconnecting} apiError={apiError} refresh={refresh} />;
  if (game.showdown) return <SketchShowdownController key={`${game.matchId}:${game.round}:${game.phase}`} snapshot={snapshot} remaining={remaining} reconnecting={reconnecting} apiError={apiError} act={act} refresh={refresh} />;
  const names = new Map(snapshot.players.map((entry) => [entry.id, entry.nickname]));
  const reveal = game.phase === "revealing" || game.phase === "round-results" || game.phase === "complete";
  return <section className={styles.card}>
    <header className={styles.heading}><p>Sketch &amp; Sorcery · round {game.round}/{game.totalRounds}</p><span role="timer">{snapshot.paused ? "Paused" : remaining === null ? "" : `${Math.max(0, Math.ceil(remaining / 1000))}s`}</span></header>
    <ConnectionNotice reconnecting={reconnecting} error={apiError} refresh={refresh} />
    {snapshot.paused && <p className={styles.notice} role="status">Game paused. Your work is saved.</p>}
    {player && self && game.phase === "captioning" && !self.submitted
      ? <CaptionAssignment key={assignmentKey} game={game} code={snapshot.code} draftKey={assignmentKey} paused={snapshot.paused} act={act} />
      : reveal ? <>
        <h1>{game.phase === "complete" ? "What a transformation!" : "The spell is revealed"}</h1>
        {game.reveal && <div className={styles.reveal}>
          <p className={styles.prompt}>{game.reveal.prompt}</p>
          <RevealSketch code={snapshot.code} leg={game.reveal.drawing} label={`Original by ${names.get(game.reveal.originalPlayerId) ?? "Player"}`} seed={game.reveal.chainId} />
          <p className={styles.caption}><small>{names.get(game.reveal.captionPlayerId) ?? "Player"} described it as</small><strong>{game.reveal.caption ?? "No caption this time"}</strong></p>
          <RevealSketch code={snapshot.code} leg={game.reveal.redraw} label={`Redraw by ${names.get(game.reveal.redrawPlayerId) ?? "Player"}`} seed={game.reveal.chainId} />
        </div>}
        {player && game.phase !== "complete" && <Applause key={`${game.matchId}:${game.round}`} game={game} names={names} paused={snapshot.paused} act={act} />}
      </> : <>
        <h1>{self?.submitted ? "Your part is saved!" : game.phase === "transforming" || game.phase === "transforming-redraw" ? "A little sorcery is happening…" : "Sketch & Sorcery is live"}</h1>
        <p role="status">{self?.submitted ? "Watch the big screen while everyone finishes." : game.phase.startsWith("transforming") ? "The next part will arrive automatically." : "Watch the big screen for the next part."}</p>
      </>}
    <div className={styles.progress} role="status">{game.submittedCount}/{game.totalPlayers} ready</div>
    {(reveal || self?.submitted) && <div className={styles.scores} aria-label="Scores">{game.players.map((id) => <p key={id}><span>{names.get(id) ?? "Player"}{id === snapshot.selfId ? " (you)" : ""}</span><strong>{game.scores[id] ?? 0}</strong></p>)}</div>}
  </section>;
}

function SketchAssignment({ snapshot, game, draftKey, reconnecting, apiError, refresh }: { snapshot: PhoneSnapshot; game: SnapshotSketchRelay; draftKey: string; reconnecting: boolean; apiError?: string | null; refresh: () => void }) {
  const choicesJSON = JSON.stringify(game.self?.promptChoices ?? []);
  // Polling replaces snapshot arrays; prompt identity must stay stable for this assignment.
  const prompts = useMemo<string[]>(() => JSON.parse(choicesJSON), [choicesJSON]);
  const uploadActionId = useRef<string | null>(null);
  const chainId = game.self!.chainId;
  const leg = game.phase === "redrawing" ? "redraw" : "drawing";
  const submit = useCallback(async (blob: Blob, prompt: string) => {
    const promptIndex = game.showdown ? 0 : leg === "drawing" ? prompts.indexOf(prompt) : -1;
    if (leg === "drawing" && !game.showdown && promptIndex < 0) throw new Error("Choose one of your three ideas before sending.");
    // Web Crypto digest is unavailable on HTTP preview origins. A persisted UUID
    // keeps retries idempotent; the server verifies the actual uploaded bytes.
    if (!uploadActionId.current) {
      let saved: string | null = null;
      try { saved = localStorage.getItem(`${draftKey}:upload-action`); } catch { /* An in-memory ID still protects retries when storage is blocked. */ }
      uploadActionId.current = saved && /^[a-zA-Z0-9_-]{1,100}$/u.test(saved) ? saved : randomUuid();
      try { localStorage.setItem(`${draftKey}:upload-action`, uploadActionId.current); } catch { /* Keep the stable ID in this mounted assignment. */ }
    }
    const actionId = uploadActionId.current;
    const headers: Record<string, string> = { "Content-Type": "image/png", "X-Sketch-Match": game.matchId, "X-Sketch-Round": String(game.round), "X-Sketch-Chain": chainId, "X-Sketch-Leg": leg, "X-Sketch-Action-Id": actionId };
    if (leg === "drawing") headers["X-Sketch-Prompt-Index"] = String(promptIndex);
    const response = await fetch(`/api/rooms/${encodeURIComponent(snapshot.code)}/sketch`, { method: "POST", headers, body: blob });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message ?? "Your sketch could not be sent. Your draft is saved; please try again.");
    }
    refresh();
  }, [chainId, draftKey, game.matchId, game.round, game.showdown, leg, prompts, refresh, snapshot.code]);
  return <>
    <DrawingStudio theme="sorcery" restriction={game.self?.restriction} starter={game.self?.starter} draftKey={draftKey} prompts={prompts} fixedPromptLabel={game.showdown ? "DRAW THIS" : undefined} fixedPrompt={game.showdown ? game.self?.prompt : leg === "redraw" ? game.self?.caption : undefined} deadline={game.deadline} serverTime={snapshot.serverTime} paused={snapshot.paused} onSubmit={submit} />
    {(reconnecting || apiError) && <div className={styles.canvasNotice}><ConnectionNotice reconnecting={reconnecting} error={apiError} refresh={refresh} /></div>}
  </>;
}

function CaptionAssignment({ game, code, draftKey, paused, act }: { game: SnapshotSketchRelay; code: string; draftKey: string; paused: boolean; act: Act }) {
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const ready = useRef(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { const saved = localStorage.getItem(draftKey); if (saved) setCaption(saved.slice(0, 140)); } catch { /* A blocked draft store never prevents play. */ }
      ready.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [draftKey]);
  useEffect(() => {
    if (!ready.current) return;
    try { localStorage.setItem(draftKey, caption); } catch { /* Keep the live text usable when storage is unavailable. */ }
  }, [caption, draftKey]);
  const submit = async () => {
    if (paused || busy || sent || !caption.trim() || caption.trim().length > 140) return;
    setBusy(true); setError("");
    try { await act("SUBMIT_SKETCH_CAPTION" as PlayerAction["type"], { matchId: game.matchId, round: game.round, chainId: game.self!.chainId, caption: caption.trim() }); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your caption could not be sent. Please try again."); }
    finally { setBusy(false); }
  };
  return <>
    <h1>What do you see?</h1><p>Describe this picture in one short sentence. The next artist will draw your words.</p>
    {game.self?.practice ? <PracticeDoodle seed={game.self.chainId} /> : <SketchImage code={code} image={game.self?.sourceImage} label="Your assigned picture" />}
    {sent ? <p className={styles.notice} role="status">Caption saved! Waiting for everyone.</p> : <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label htmlFor="sketch-caption">Your caption</label>
      <textarea id="sketch-caption" rows={3} autoComplete="off" maxLength={140} value={caption} disabled={busy || paused} onChange={(event) => setCaption(event.target.value)} aria-describedby="sketch-caption-count" />
      <span id="sketch-caption-count" className={styles.count}>{caption.length}/140</span>
      <button type="submit" disabled={busy || paused || !caption.trim()}>{busy ? "Sending…" : "Send caption"}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>}
  </>;
}

function Applause({ game, names, paused, act }: { game: SnapshotSketchRelay; names: Map<string, string>; paused: boolean; act: Act }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const applaud = async (option: SnapshotSketchRelay["applauseOptions"][number]) => {
    if (paused || busy || sent || game.applauded) return;
    setBusy(true); setError("");
    try { await act("SUBMIT_SKETCH_APPLAUSE" as PlayerAction["type"], { matchId: game.matchId, round: game.round, chainId: option.chainId, leg: option.leg }); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Your applause could not be sent. Please try again."); }
    finally { setBusy(false); }
  };
  if (game.applauded || sent) return <p className={styles.notice} role="status">Applause sent! One cheer per round.</p>;
  if (!game.applauseOptions.length) return null;
  return <div className={styles.applause}><h2>Give one sketch a cheer</h2>{game.applauseOptions.map((option) => <button type="button" disabled={paused || busy} key={`${option.chainId}:${option.leg}`} onClick={() => void applaud(option)}>👏 {names.get(option.playerId) ?? "Player"} · {option.leg === "drawing" ? "original" : "redraw"}</button>)}{error && <p className={styles.error} role="alert">{error}</p>}</div>;
}

function SketchImage({ code, image, label }: { code: string; image?: SketchRelayImage; label: string }) {
  const [failed, setFailed] = useState(false);
  if (!image?.assetId || failed) return <div className={styles.missing} role="status">{image?.status === "QUEUED" ? "The picture is being prepared…" : "This picture is unavailable. Describe the little mystery however you like."}</div>;
  return <Image className={styles.image} src={`/api/rooms/${encodeURIComponent(code)}/media/${encodeURIComponent(image.assetId)}`} width={480} height={480} unoptimized alt={label} onError={() => setFailed(true)} />;
}
function RevealSketch({ code, leg, label, seed }: { code: string; leg?: SketchRelaySnapshotLeg; label: string; seed: string }) {
  return <figure className={styles.art}>{leg?.practice ? <PracticeDoodle seed={seed} /> : <SketchImage key={leg?.image.assetId ?? leg?.assetId ?? seed} code={code} image={leg?.image.assetId ? leg.image : leg?.assetId ? { status: "READY", assetId: leg.assetId } : leg?.image} label={label} />}<figcaption>{label}</figcaption></figure>;
}
function ConnectionNotice({ reconnecting, error, refresh }: { reconnecting: boolean; error?: string | null; refresh: () => void }) {
  if (!reconnecting && !error) return null;
  return <p className={styles.notice} role={error ? "alert" : "status"}>{error ?? "Reconnecting… Your draft stays on this device."}<button type="button" onClick={refresh}>Retry connection</button></p>;
}
