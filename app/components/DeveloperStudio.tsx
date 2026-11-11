"use client";

import { useEffect, useState } from "react";
import type { DeveloperChangeArea, DeveloperChange, DeveloperChangeValue } from "../../lib/developer/handoff";
import { buildDeveloperHandoff, sourceHintFor } from "../../lib/developer/handoff";
import type { HostAction, PlayerSnapshot } from "../../lib/contracts";
import { randomUuid } from "../../lib/game/random";

const STORAGE_KEY = "callback-developer-changes-v1";
type DirtyFields = Partial<Record<"prompt" | "instruction" | "choiceLabels" | "scoreCap" | "phaseSeconds", boolean>>;

function storedChanges(): DeveloperChange[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as DeveloperChange[]; }
  catch { return []; }
}

export function DeveloperStudio({ code, snapshot, reset }: { code: string; snapshot: PlayerSnapshot; reset: () => void }) {
  const context = snapshot.developerContext;
  const [open, setOpen] = useState(false);
  const [changes, setChanges] = useState<DeveloperChange[]>(storedChanges);
  const [prompt, setPrompt] = useState(snapshot.prompt ?? "");
  const [instruction, setInstruction] = useState(snapshot.instruction ?? "");
  const [choiceLabels, setChoiceLabels] = useState(context?.choiceOptions.map((choice) => choice.label).join("\n") ?? "");
  const [scoreCap, setScoreCap] = useState(context?.scoreCap === null || context?.scoreCap === undefined ? "" : String(context.scoreCap));
  const [phaseSeconds, setPhaseSeconds] = useState(context?.phaseSeconds === null || context?.phaseSeconds === undefined ? "" : String(context.phaseSeconds));
  const [dirty, setDirty] = useState<DirtyFields>({});
  const [noteArea, setNoteArea] = useState<DeveloperChangeArea>("copy");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(changes)); }, [changes]);

  const changeContext = (field: string, area: DeveloperChangeArea) => ({
    gameLength: snapshot.gameLength, contentMode: snapshot.contentMode, roundNumber: snapshot.roundNumber, roundTotal: snapshot.roundTotal,
    roundKind: snapshot.roundKind, roundLabel: context?.roundLabel ?? null, phase: snapshot.phase, promptId: context?.promptId ?? null,
    sourceHint: sourceHintFor(field, snapshot.roundKind, context?.promptId ?? null, area),
  });
  const makeChange = (kind: DeveloperChange["kind"], field: string, area: DeveloperChangeArea, before: DeveloperChangeValue, after: DeveloperChangeValue, changeNote: string): DeveloperChange => ({
    id: randomUuid(), createdAt: new Date().toISOString(), kind, field, area, before, after, note: changeNote.trim(), context: changeContext(field, area),
  });
  const developerAction = async (payload: Extract<HostAction, { type: "SET_DEVELOPER_ROUND" }>["payload"]) => {
    const action: HostAction = { type: "SET_DEVELOPER_ROUND", actionId: randomUuid(), roundId: snapshot.roundId, expectedPhase: snapshot.phase, payload };
    const response = await fetch(`/api/rooms/${code}/host-actions`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    if (!response.ok) throw new Error(body?.error?.message ?? "The developer edit did not go through.");
    reset();
  };
  const markDirty = (field: keyof DirtyFields) => setDirty((current) => ({ ...current, [field]: true }));

  const applyLiveChanges = async () => {
    if (!context) { setStatus("Start a round before applying live changes."); return; }
    const payload: Extract<HostAction, { type: "SET_DEVELOPER_ROUND" }>["payload"] = {};
    const pending: DeveloperChange[] = [];
    if (dirty.prompt) { payload.prompt = prompt.trim(); pending.push(makeChange("edit", "prompt", "copy", snapshot.prompt, prompt.trim(), note)); }
    if (dirty.instruction) { payload.instruction = instruction.trim() || null; pending.push(makeChange("edit", "instruction", "copy", snapshot.instruction, instruction.trim() || null, note)); }
    if (dirty.choiceLabels) {
      const labels = choiceLabels.split("\n").map((label) => label.trim()).filter(Boolean);
      if (labels.length !== context.choiceOptions.length) { setStatus(`Keep exactly ${context.choiceOptions.length} choices.`); return; }
      payload.choiceLabels = labels;
      pending.push(makeChange("edit", "choiceLabels", "rules", context.choiceOptions.map((choice) => choice.label).join("\n"), labels.join("\n"), note));
    }
    if (dirty.scoreCap) {
      const value = Number(scoreCap);
      if (!Number.isInteger(value) || value < 0 || value > 10_000) { setStatus("Score cap must be a whole number from 0 to 10,000."); return; }
      payload.scoreCap = value;
      pending.push(makeChange("edit", "scoreCap", "scoring", context.scoreCap, value, note));
    }
    if (dirty.phaseSeconds) {
      const value = Number(phaseSeconds);
      if (!Number.isInteger(value) || value < 1 || value > 600) { setStatus("Phase time must be a whole number from 1 to 600 seconds."); return; }
      payload.phaseSeconds = value;
      pending.push(makeChange("edit", "phaseSeconds", "pacing", context.phaseSeconds, value, note));
    }
    if (!pending.length) { setStatus("Change a field first, or add an observation below."); return; }
    setBusy(true); setStatus("");
    try { await developerAction(payload); setChanges((current) => [...current, ...pending]); setDirty({}); setNote(""); setStatus(`${pending.length} live change${pending.length === 1 ? "" : "s"} applied and captured.`); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : "The developer edit did not go through."); }
    finally { setBusy(false); }
  };

  const addObservation = () => {
    if (!note.trim()) { setStatus("Write the observation first."); return; }
    setChanges((current) => [...current, makeChange("note", noteArea, noteArea, null, note.trim(), "")]);
    setNote(""); setStatus("Observation added to the change package.");
  };
  const copyPackage = async () => {
    if (!changes.length) { setStatus("Capture at least one change or observation first."); return; }
    const handoff = buildDeveloperHandoff(changes);
    try { await navigator.clipboard.writeText(handoff); setStatus("Change package copied. Paste it into chat."); }
    catch { window.prompt("Copy this King Prompter change package:", handoff); }
  };
  const downloadPackage = () => {
    if (!changes.length) { setStatus("Capture at least one change or observation first."); return; }
    const url = URL.createObjectURL(new Blob([buildDeveloperHandoff(changes)], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `callback-changes-${new Date().toISOString().slice(0, 10)}.md`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500); setStatus("Change package downloaded.");
  };
  const restoreLiveFields = () => {
    setPrompt(snapshot.prompt ?? ""); setInstruction(snapshot.instruction ?? ""); setChoiceLabels(context?.choiceOptions.map((choice) => choice.label).join("\n") ?? "");
    setScoreCap(context?.scoreCap === null || context?.scoreCap === undefined ? "" : String(context.scoreCap)); setPhaseSeconds(context?.phaseSeconds === null || context?.phaseSeconds === undefined ? "" : String(context.phaseSeconds)); setDirty({}); setStatus("Draft fields restored to the running game.");
  };

  return <>
    <button type="button" className="developer-fab" onClick={() => setOpen(true)}><b>DEV</b><span suppressHydrationWarning>{changes.length ? `${changes.length} captured` : "Open studio"}</span></button>
    {open && <div className="developer-studio-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="developer-studio" role="dialog" aria-modal="true" aria-labelledby="developer-studio-title">
        <header><div><p className="eyebrow">Live playtest editor</p><h2 id="developer-studio-title">Developer studio</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Close developer studio">×</button></header>
        <div className="developer-context"><span>{snapshot.phase.replaceAll("_", " ")}</span><strong>{context ? `Round ${snapshot.roundNumber} · ${context.roundLabel}` : "Lobby"}</strong><small>{context?.promptId ?? "Start the game to inspect a round."}</small></div>
        {context && <fieldset className="developer-live-fields"><legend>Try it in this room</legend>
          <label><span>Prompt</span><textarea rows={4} maxLength={500} value={prompt} onChange={(event) => { setPrompt(event.target.value); markDirty("prompt"); }} /></label>
          <label><span>Instruction</span><textarea rows={2} maxLength={240} value={instruction} placeholder="No extra instruction" onChange={(event) => { setInstruction(event.target.value); markDirty("instruction"); }} />{snapshot.roundKind === "THE_CATCH" && <small>Editing this label does not change the mechanical Catch validator.</small>}</label>
          {context.choiceOptions.length > 0 && <label><span>Choice labels · one per line</span><textarea rows={context.choiceOptions.length} value={choiceLabels} onChange={(event) => { setChoiceLabels(event.target.value); markDirty("choiceLabels"); }} /></label>}
          <div className="developer-number-grid"><label><span>Score cap</span><input type="number" min={0} max={10000} step={50} value={scoreCap} onChange={(event) => { setScoreCap(event.target.value); markDirty("scoreCap"); }} /></label>{context.phaseSeconds !== null && <label><span>Phase seconds</span><input type="number" min={1} max={600} value={phaseSeconds} onChange={(event) => { setPhaseSeconds(event.target.value); markDirty("phaseSeconds"); }} /></label>}</div>
          <div className="developer-field-actions"><button type="button" className="developer-apply" disabled={busy} onClick={() => void applyLiveChanges()}>{busy ? "Applying…" : "Apply live + capture"}</button><button type="button" onClick={restoreLiveFields}>Reset fields</button></div>
        </fieldset>}
        <fieldset className="developer-observation"><legend>Capture what you noticed</legend><label><span>Area</span><select value={noteArea} onChange={(event) => setNoteArea(event.target.value as DeveloperChangeArea)}><option value="copy">Copy</option><option value="pacing">Pacing</option><option value="scoring">Scoring</option><option value="rules">Rules</option><option value="layout">Layout</option><option value="bug">Bug</option></select></label><label><span>Change note</span><textarea rows={3} value={note} maxLength={1000} placeholder="What felt wrong, and what should happen instead?" onChange={(event) => setNote(event.target.value)} /></label><button type="button" onClick={addObservation}>Add observation</button></fieldset>
        <section className="developer-package"><div><strong>Change package</strong><span>{changes.length} item{changes.length === 1 ? "" : "s"} saved on this device</span></div><div><button type="button" className="developer-copy" onClick={() => void copyPackage()}>Copy for Chat</button><button type="button" onClick={downloadPackage}>Download</button></div>{changes.length > 0 && <button type="button" className="developer-clear" onClick={() => { if (confirm("Clear every captured developer change on this device?")) { setChanges([]); setStatus("Change package cleared."); } }}>Clear package</button>}</section>
        {status && <p className="developer-status" role="status">{status}</p>}
      </section>
    </div>}
  </>;
}
