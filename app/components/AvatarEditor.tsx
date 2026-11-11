"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AvatarConfig } from "../../lib/avatar-runtime";
import { COLORS, DEFAULT_AVATAR, FAMILY_PRESETS, OPTIONS, clone, title } from "../../lib/avatar-runtime";
import { Avatar } from "./Avatar";
import { AvatarPieceCanvas, AvatarPieceControls } from "./AvatarPieceEditor";
import type { AvatarPieceId } from "../../lib/avatar-pieces";
import { AVATAR_PIECES, availableAvatarPieces, getPieceTransform } from "../../lib/avatar-pieces";
import type { PieceTransform } from "../../lib/avatar-pieces";
import type { CharacterState } from "../../lib/character-profile";

type EditorSection = "face" | "hair" | "eyes" | "features" | "outfit" | "extras";

const SECTIONS: Array<{ id: EditorSection; label: string; icon: string }> = [
  { id: "face", label: "Face", icon: "◯" },
  { id: "hair", label: "Hair", icon: "✦" },
  { id: "eyes", label: "Eyes", icon: "◉" },
  { id: "features", label: "Features", icon: "⌣" },
  { id: "outfit", label: "Style", icon: "▥" },
  { id: "extras", label: "Extras", icon: "+" },
];

function optionValues(key: string): string[] { return OPTIONS[key] ?? []; }

function randomItem(values: string[]): string { return values[Math.floor(Math.random() * values.length)] ?? "none"; }

function randomAvatar(): AvatarConfig {
  return {
    ...clone(DEFAULT_AVATAR),
    faceShape: randomItem(optionValues("faceShape")),
    skin: randomItem(optionValues("skin")),
    hairStyle: randomItem(optionValues("hairStyle")),
    hairColor: randomItem(optionValues("hairColor")),
    browStyle: randomItem(optionValues("browStyle")),
    browColor: randomItem(optionValues("hairColor")),
    eyeStyle: randomItem(optionValues("eyeStyle")),
    eyeColor: randomItem(optionValues("eyeColor")),
    noseStyle: randomItem(optionValues("noseStyle")),
    mouthStyle: randomItem(optionValues("mouthStyle")),
    glasses: Math.random() < .35 ? randomItem(optionValues("glasses")) : "none",
    facialHair: Math.random() < .3 ? randomItem(optionValues("facialHair")) : "none",
    facialHairColor: randomItem(optionValues("hairColor")),
    outfit: randomItem(optionValues("outfit")),
    outfitColor: randomItem(optionValues("outfitColor")),
    outfitAccent: randomItem(Object.keys(COLORS.accent)),
    hat: Math.random() < .28 ? randomItem(optionValues("hat")) : "none",
    extras: optionValues("extras").filter(() => Math.random() < .16).slice(0, 2),
    bodyBuild: randomItem(optionValues("bodyBuild")),
    faceWidth: .9 + Math.random() * .2,
    faceHeight: .92 + Math.random() * .16,
    eyeSize: .9 + Math.random() * .2,
    mouthWidth: .9 + Math.random() * .2,
  };
}

export function AvatarEditor({
  value,
  preset,
  playerName,
  onChange,
  onCharacterChange,
  onPresetChange,
  onDone,
  onCancel,
  history,
  onHistoryChange,
  baseline,
  defaultCharacter,
  onRestoreBaseline,
  onRestoreDefault,
}: {
  value: AvatarConfig;
  preset: string | null;
  playerName: string;
  onChange: (avatar: AvatarConfig) => void;
  onCharacterChange?: (avatar: AvatarConfig, preset: string | null) => void;
  onPresetChange: (preset: string | null) => void;
  onDone: () => void;
  onCancel: () => void;
  history?: { past: CharacterState[]; future: CharacterState[] };
  onHistoryChange?: (history: { past: CharacterState[]; future: CharacterState[] }) => void;
  baseline?: CharacterState;
  defaultCharacter?: CharacterState;
  onRestoreBaseline?: () => void;
  onRestoreDefault?: () => void;
}) {
  const [mode, setMode] = useState<"family" | "customize" | "pieces">("pieces");
  const [section, setSection] = useState<EditorSection>("face");
  const [mobileField, setMobileField] = useState<keyof AvatarConfig>('outfit');
  const [mobileAxis, setMobileAxis] = useState<'x'|'y'|'scale'|'scaleX'|'scaleY'|'rotation'>('rotation');
  const presetEntries = useMemo(() => Object.entries(FAMILY_PRESETS), []);

  const [selectedPiece, setSelectedPiece] = useState<AvatarPieceId>("face");
  const [initial] = useState(() => ({ avatar: clone(value), preset }));
  const [past, setPast] = useState<CharacterState[]>([]);
  const [future, setFuture] = useState<typeof past>([]);
  const shownPast = history?.past ?? past;
  const shownFuture = history?.future ?? future;
  const writeHistory = (nextPast: CharacterState[], nextFuture: CharacterState[]) => {
    if (onHistoryChange) onHistoryChange({ past: nextPast, future: nextFuture });
    else { setPast(nextPast); setFuture(nextFuture); }
  };
  const modal = useRef<HTMLElement>(null);
  const cancel = () => { onChange(initial.avatar); onPresetChange(initial.preset); onCancel(); };
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = oldOverflow; before?.focus(); };
  }, []);
  const begin = () => writeHistory([...shownPast.slice(-79), { avatarConfig: clone(value), avatarPreset: preset }], []);
  const change = (next: AvatarConfig, record = true, nextPreset: string | null = null) => {
    if (nextPreset === preset && JSON.stringify(next) === JSON.stringify(value)) return;
    if (record) begin();
    if (onCharacterChange) onCharacterChange(next, nextPreset);
    else { onChange(next); onPresetChange(nextPreset); }
  };
  const undo = () => {
    const previous = shownPast.at(-1); if (!previous) return;
    writeHistory(shownPast.slice(0, -1), [...shownFuture, { avatarConfig: clone(value), avatarPreset: preset }]);
    if (onCharacterChange) onCharacterChange(previous.avatarConfig, previous.avatarPreset);
    else { onChange(previous.avatarConfig); onPresetChange(previous.avatarPreset); }
  };
  const redo = () => {
    const next = shownFuture.at(-1); if (!next) return;
    writeHistory([...shownPast, { avatarConfig: clone(value), avatarPreset: preset }].slice(-80), shownFuture.slice(0, -1));
    if (onCharacterChange) onCharacterChange(next.avatarConfig, next.avatarPreset);
    else { onChange(next.avatarConfig); onPresetChange(next.avatarPreset); }
  };
  const restoreBaseline = () => {
    if (onRestoreBaseline) onRestoreBaseline();
    else if (baseline) change(clone(baseline.avatarConfig), true, baseline.avatarPreset);
  };
  const restoreDefault = () => {
    if (onRestoreDefault) onRestoreDefault();
    else if (defaultCharacter) change(clone(defaultCharacter.avatarConfig), true, defaultCharacter.avatarPreset);
  };

  const update = <K extends keyof AvatarConfig>(key: K, next: AvatarConfig[K]) => {
    change({ ...value, [key]: next });
  };

  const choosePreset = (name: string) => {
    change(clone(FAMILY_PRESETS[name].avatar), true, name);
  };

  const toggleExtra = (extra: string) => {
    const extras = new Set(value.extras);
    if (extras.has(extra)) extras.delete(extra);
    else extras.add(extra);
    update("extras", [...extras]);
  };

  return (
    <div className="avatar-editor-backdrop" role="presentation" onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); cancel(); }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
        if (event.key === "Tab") {
          const controls = Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, summary, [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <section ref={modal} className={`avatar-editor-modal${mode === "pieces" ? " editing-pieces" : ""}`} role="dialog" aria-modal="true" aria-labelledby="avatar-editor-title">
        <header className="avatar-editor-header">
          <div>
            <span className="avatar-editor-kicker">CALLBACK CHARACTER CREATOR</span>
            <h1 id="avatar-editor-title">Make it look like you.</h1>
            {value.photoFaceId && <p className="avatar-photo-note">Photo head active. Use Pieces to position it; facial feature controls affect only the drawn face.</p>}
          </div>
          <button className="avatar-editor-close" type="button" onClick={cancel} aria-label="Close avatar editor">×</button>
        </header>

        <div className="avatar-editor-layout">
          <aside className="avatar-live-panel">
            <div className="avatar-live-burst" aria-hidden="true">✦</div>
            {mode === "pieces" ? <>
              <div className="avatar-piece-canvas-mobile"><AvatarPieceCanvas value={value} selected={selectedPiece} onSelect={setSelectedPiece} onChange={change} onBegin={begin} label={`${playerName || "Player"}'s avatar`} /></div>
              <div className="avatar-piece-canvas-desktop"><div className="avatar-live-stage"><Avatar index={0} color="#46DBDC" config={value} size="large" label={`${playerName || "Player"}'s avatar`} animation="still" /></div></div>
            </> : <div className="avatar-live-stage">
              <Avatar index={0} color="#46DBDC" config={value} size="large" label={`${playerName || "Player"}'s avatar`} animation="still" />
            </div>}
            <strong>{playerName || preset || "Your player"}</strong>
            <span>{preset ? `${preset} look-alike` : "One-of-a-kind look"}</span>
            <button type="button" className="avatar-surprise-button" onClick={() => { change(randomAvatar()); setMode("customize"); }}>
              🎲 Surprise me
            </button>
          </aside>

          <div className="avatar-editor-controls">
            <div className="avatar-mobile-controls">
              <div className="avatar-mobile-modes" role="group" aria-label="Avatar editor sections">{(['family','customize','pieces'] as const).map(item=><button type="button" aria-pressed={mode===item} key={item} onClick={()=>setMode(item)}>{item==='family'?'Looks':item==='customize'?'Style':'Pieces'}</button>)}</div>
              {mode==='family'?<label>Choose a look<select value={preset??''} onChange={e=>choosePreset(e.target.value)}><option value="" disabled>Choose a character</option>{presetEntries.map(([name])=><option key={name} value={name}>{name}</option>)}</select></label>:mode==='customize'?<>
                <label>Change a feature<select value={mobileField} onChange={e=>setMobileField(e.target.value as keyof AvatarConfig)}>{MOBILE_FEATURES.map(key=><option key={key} value={key}>{title(key.replace(/([A-Z])/g,' $1'))}</option>)}</select></label>
                {mobileField==='extras'?<div className="avatar-mobile-extras">{optionValues('extras').map(extra=><label key={extra}><input type="checkbox" checked={value.extras.includes(extra)} onChange={()=>toggleExtra(extra)}/>{title(extra)}</label>)}</div>:typeof value[mobileField]==='boolean'?<button type="button" aria-pressed={Boolean(value[mobileField])} onClick={()=>change({...value,[mobileField]:!value[mobileField]})}>{value[mobileField]?'On':'Off'}</button>:typeof value[mobileField]==='number'?<label>{title(mobileField)} <output>{Number(value[mobileField]).toFixed(2)}</output><input type="range" min={MOBILE_RANGES[mobileField]?.[0]??.8} max={MOBILE_RANGES[mobileField]?.[1]??1.25} step={MOBILE_RANGES[mobileField]?.[2]??.01} value={Number(value[mobileField])} onPointerDown={begin} onKeyDown={e=>{if(!e.repeat)begin();}} onChange={e=>change({...value,[mobileField]:Number(e.target.value)},false)}/></label>:<label>{title(mobileField)}<select value={String(value[mobileField])} onChange={e=>change({...value,[mobileField]:e.target.value})}>{mobileOptions(mobileField).map(option=><option key={option} value={option}>{title(option)}</option>)}</select></label>}
              </>:<>
                <label>Character piece<select value={selectedPiece} onChange={e=>setSelectedPiece(e.target.value as AvatarPieceId)}>{AVATAR_PIECES.map(piece=><option key={piece.id} value={piece.id}>{piece.label}{!availableAvatarPieces(value).some(p=>p.id===piece.id)?' · not added':''}</option>)}</select></label>
                <label>Adjustment<select value={mobileAxis} onChange={e=>setMobileAxis(e.target.value as typeof mobileAxis)}>{(['x','y','scale','scaleX','scaleY','rotation'] as const).map(key=><option key={key} value={key}>{({x:'Horizontal',y:'Vertical',scale:'Size',scaleX:'Width',scaleY:'Height',rotation:'Rotation'})[key]}</option>)}</select></label>
                <label className="avatar-mobile-piece-range">{getPieceTransform(value,selectedPiece)[mobileAxis].toFixed(1)}<input aria-label="Selected piece adjustment" type="range" min={mobileAxis.startsWith('scale')?.1:mobileAxis==='rotation'?-180:-390} max={mobileAxis.startsWith('scale')?4:mobileAxis==='rotation'?180:390} step={mobileAxis.startsWith('scale')?.01:1} value={getPieceTransform(value,selectedPiece)[mobileAxis]} onPointerDown={begin} onKeyDown={e=>{if(!e.repeat)begin();}} onChange={e=>change({...value,pieceTransforms:{...value.pieceTransforms,[selectedPiece]:{...getPieceTransform(value,selectedPiece),[mobileAxis]:Number(e.target.value)}}},false)}/></label>
                <div className="avatar-mobile-piece-actions">{(['hidden','flipX','flipY'] as const).map(key=><button key={key} type="button" aria-pressed={getPieceTransform(value,selectedPiece)[key]} onClick={()=>change({...value,pieceTransforms:{...value.pieceTransforms,[selectedPiece]:{...getPieceTransform(value,selectedPiece),[key]:!getPieceTransform(value,selectedPiece)[key]} as PieceTransform}})}>{key==='hidden'?'Hide':key==='flipX'?'Flip ↔':'Flip ↕'}</button>)}</div>
              </>}
            </div>
            <div className="avatar-desktop-controls">
            <div className="avatar-mode-tabs" role="group" aria-label="Avatar creation method">
              <button type="button" aria-pressed={mode === "family"} className={mode === "family" ? "active" : ""} onClick={() => setMode("family")}>Choose a look-alike</button>
              <button type="button" aria-pressed={mode === "customize"} className={mode === "customize" ? "active" : ""} onClick={() => setMode("customize")}>Fine-tune</button>
              <button type="button" aria-pressed={mode === "pieces"} className={mode === "pieces" ? "active" : ""} onClick={() => setMode("pieces")}>Move pieces</button>
            </div>

            {mode === "pieces" ? <AvatarPieceControls value={value} selected={selectedPiece} onSelect={setSelectedPiece} onChange={change} onBegin={begin} onChooseStyle={() => { setMode("customize"); setSection(['hat', 'hatDecoration', 'freckles', 'leftEarring', 'rightEarring', 'necklace', 'choker', 'crossbody', 'tattoos', 'fringe', 'outfitDecoration'].includes(selectedPiece) ? 'extras' : selectedPiece === 'hair' ? 'hair' : selectedPiece === 'faceDetail' ? 'face' : 'features'); }} /> : mode === "family" ? (
              <div className="avatar-preset-panel">
                <div className="avatar-section-copy"><strong>Premade family</strong><span>Pick the closest match, then change anything.</span></div>
                <div className="avatar-preset-grid">
                  {presetEntries.map(([name, item]) => (
                    <button type="button" className={preset === name ? "avatar-preset active" : "avatar-preset"} onClick={() => choosePreset(name)} key={name} aria-pressed={preset === name}>
                      <span><Avatar index={0} color="#46DBDC" config={item.avatar} size="large" label={`${name} preset`} /></span>
                      <strong>{name}</strong>
                      <small>{item.note.split(" · ").slice(0, 2).join(" · ")}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="avatar-custom-panel">
                <nav className="avatar-feature-tabs" aria-label="Avatar features">
                  {SECTIONS.map((item) => <button type="button" className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)} key={item.id}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
                </nav>
                <div className="avatar-feature-workspace">
                  {section === "face" && <>
                    <EditorHeading title="Face" copy="Shape, tone and proportions" />
                    <ChoiceGrid label="Face shape" value={value.faceShape} options={optionValues("faceShape")} onSelect={(next) => update("faceShape", next)} />
                    <ColorGrid label="Skin tone" value={value.skin} colors={COLORS.skin} onSelect={(next) => update("skin", next)} />
                    <ChoiceGrid label="Face detail" value={value.ageDetail} options={optionValues("ageDetail")} onSelect={(next) => update("ageDetail", next)} compact />
                    <Range label="Face width" value={value.faceWidth} min={.86} max={1.14} step={.01} onChange={(next) => update("faceWidth", next)} percent />
                    <Range label="Face length" value={value.faceHeight} min={.9} max={1.12} step={.01} onChange={(next) => update("faceHeight", next)} percent />
                  </>}
                  {section === "hair" && <>
                    <EditorHeading title="Hair" copy="Style, colour and hairline" />
                    <ChoiceGrid label="Hairstyle" value={value.hairStyle} options={optionValues("hairStyle")} onSelect={(next) => update("hairStyle", next)} />
                    <ColorGrid label="Hair colour" value={value.hairColor} colors={COLORS.hair} onSelect={(next) => { change({ ...value, hairColor: next, browColor: next }); }} />
                    <Range label="Hairline" value={value.hairline} min={-6} max={8} step={1} onChange={(next) => update("hairline", next)} />
                    <button type="button" className={value.hairFlip ? "avatar-toggle active" : "avatar-toggle"} onClick={() => update("hairFlip", !value.hairFlip)}>Flip hairstyle</button>
                  </>}
                  {section === "eyes" && <>
                    <EditorHeading title="Eyes & brows" copy="The strongest likeness details" />
                    <ChoiceGrid label="Eye shape" value={value.eyeStyle} options={optionValues("eyeStyle")} onSelect={(next) => update("eyeStyle", next)} />
                    <ColorGrid label="Eye colour" value={value.eyeColor} colors={COLORS.eyes} onSelect={(next) => update("eyeColor", next)} />
                    <ChoiceGrid label="Brows" value={value.browStyle} options={optionValues("browStyle")} onSelect={(next) => update("browStyle", next)} compact />
                    <Range label="Eye size" value={value.eyeSize} min={.78} max={1.24} step={.01} onChange={(next) => update("eyeSize", next)} percent />
                    <Range label="Eye spacing" value={value.eyeSpacing} min={-7} max={10} step={1} onChange={(next) => update("eyeSpacing", next)} />
                    <Range label="Brow height" value={value.browHeight} min={-8} max={8} step={1} onChange={(next) => update("browHeight", next)} />
                    <Range label="Brow angle" value={value.browAngle} min={-18} max={18} step={1} onChange={(next) => update("browAngle", next)} />
                  </>}
                  {section === "features" && <>
                    <EditorHeading title="Features" copy="Smile, nose, glasses and facial hair" />
                    <ChoiceGrid label="Nose" value={value.noseStyle} options={optionValues("noseStyle")} onSelect={(next) => update("noseStyle", next)} compact />
                    <ChoiceGrid label="Smile" value={value.mouthStyle} options={optionValues("mouthStyle")} onSelect={(next) => update("mouthStyle", next)} />
                    <ChoiceGrid label="Glasses" value={value.glasses} options={optionValues("glasses")} onSelect={(next) => update("glasses", next)} compact />
                    <ChoiceGrid label="Facial hair" value={value.facialHair} options={optionValues("facialHair")} onSelect={(next) => update("facialHair", next)} compact />
                    <Range label="Smile width" value={value.mouthWidth} min={.8} max={1.24} step={.01} onChange={(next) => update("mouthWidth", next)} percent />
                  </>}
                  {section === "outfit" && <>
                    <EditorHeading title="Outfit" copy="Give your player a recognizable silhouette" />
                    <ChoiceGrid label="Clothing" value={value.outfit} options={optionValues("outfit")} onSelect={(next) => update("outfit", next)} />
                    <ColorGrid label="Outfit colour" value={value.outfitColor} colors={COLORS.outfit} onSelect={(next) => update("outfitColor", next)} />
                    <ChoiceGrid label="Body build" value={value.bodyBuild} options={optionValues("bodyBuild")} onSelect={(next) => update("bodyBuild", next)} compact />
                    <Range label="Height" value={value.bodyHeight} min={.88} max={1.12} step={.01} onChange={(next) => update("bodyHeight", next)} percent />
                    <Range label="Width" value={value.bodyWidth} min={.86} max={1.14} step={.01} onChange={(next) => update("bodyWidth", next)} percent />
                  </>}
                  {section === "extras" && <>
                    <EditorHeading title="Extras" copy="Stack as many details as you want" />
                    <ChoiceGrid label="Hat" value={value.hat} options={optionValues("hat")} onSelect={(next) => update("hat", next)} compact />
                    <ChoiceGrid label="Signature detail" value={value.signatureDetail ?? "none"} options={optionValues("signatureDetail")} onSelect={(next) => update("signatureDetail", next)} compact />
                    <div className="avatar-control-group"><span>Details</span><div className="avatar-toggle-grid">{optionValues("extras").map((extra) => <button type="button" className={value.extras.includes(extra) ? "avatar-toggle active" : "avatar-toggle"} onClick={() => toggleExtra(extra)} key={extra}>{title(extra)}</button>)}</div></div>
                  </>}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

        <footer className="avatar-editor-footer">
          <select className="avatar-mobile-history" aria-label="Character history and resets" value="" onChange={e=>{const action=e.target.value;if(action==='undo')undo();if(action==='redo')redo();if(action==='baseline')restoreBaseline();if(action==='default')restoreDefault();if(action==='piece'){const transforms={...value.pieceTransforms};delete transforms[selectedPiece];change({...value,pieceTransforms:transforms});}if(action==='all')change({...value,pieceTransforms:{}});}}><option value="" disabled>History & resets</option><option value="undo" disabled={!shownPast.length}>Undo</option><option value="redo" disabled={!shownFuture.length}>Redo</option><option value="baseline">Restore starting character</option><option value="default">Restore default character</option><option value="piece">Reset selected piece</option><option value="all">Reset all piece adjustments</option></select>
          <div className="avatar-history-controls"><button type="button" disabled={!shownPast.length} onClick={undo}>Undo</button><button type="button" disabled={!shownFuture.length} onClick={redo}>Redo</button>{(onRestoreBaseline || baseline) && <button type="button" onClick={restoreBaseline}>Restore starting character</button>}{(onRestoreDefault || defaultCharacter) && <button type="button" onClick={restoreDefault}>Restore default character</button>}</div>
          <button type="button" className="button button-primary" onClick={onDone}>Use this avatar <span aria-hidden="true">→</span></button>
        </footer>
      </section>
    </div>
  );
}

const MOBILE_FEATURES: Array<keyof AvatarConfig> = ['faceShape','skin','ageDetail','faceWidth','faceHeight','hairStyle','hairColor','hairFlip','hairline','browStyle','browColor','browAngle','browHeight','browSpacing','eyeStyle','eyeColor','eyeSize','eyeSpacing','eyeHeight','eyeTilt','noseStyle','noseSize','noseHeight','mouthStyle','mouthWidth','mouthHeight','glasses','glassesColor','glassesSize','glassesHeight','facialHair','facialHairColor','facialHairSize','outfit','outfitColor','outfitAccent','hat','extras','bodyBuild','bodyHeight','bodyWidth','personality','signatureDetail'];
const COLOR_FIELD_GROUP: Partial<Record<keyof AvatarConfig,string>>={skin:'skin',hairColor:'hair',browColor:'hair',facialHairColor:'hair',eyeColor:'eyes',outfitColor:'outfit',glassesColor:'frames',outfitAccent:'accent'};
const MOBILE_RANGES: Partial<Record<keyof AvatarConfig,number[]>>={faceWidth:[.86,1.14,.01],faceHeight:[.9,1.12,.01],hairline:[-6,8,1],browAngle:[-18,18,1],browHeight:[-8,8,1],browSpacing:[-8,10,1],eyeSize:[.78,1.24,.01],eyeSpacing:[-7,10,1],eyeHeight:[-7,7,1],eyeTilt:[-10,10,1],noseSize:[.8,1.22,.01],noseHeight:[-7,8,1],mouthWidth:[.8,1.24,.01],mouthHeight:[-7,9,1],glassesSize:[.86,1.16,.01],glassesHeight:[-6,7,1],facialHairSize:[.8,1.15,.01],bodyHeight:[.88,1.12,.01],bodyWidth:[.86,1.14,.01]};

function EditorHeading({ title: heading, copy }: { title: string; copy: string }) {
  return <div className="avatar-section-copy avatar-editor-section-heading"><strong>{heading}</strong><span>{copy}</span></div>;
}

function ChoiceGrid({ label, value, options, onSelect, compact = false }: { label: string; value: string; options: string[]; onSelect: (value: string) => void; compact?: boolean }) {
  return <div className="avatar-control-group"><span>{label}</span><div className={compact ? "avatar-choice-grid compact" : "avatar-choice-grid"}>{options.map((option) => <button type="button" className={value === option ? "active" : ""} onClick={() => onSelect(option)} aria-pressed={value === option} key={option}>{title(option)}</button>)}</div></div>;
}

function ColorGrid({ label, value, colors, onSelect }: { label: string; value: string; colors: Record<string, string>; onSelect: (value: string) => void }) {
  return <div className="avatar-control-group"><span>{label}</span><div className="avatar-color-grid">{Object.entries(colors).map(([name, hex]) => <button type="button" className={value === name ? "active" : ""} onClick={() => onSelect(name)} aria-label={title(name)} aria-pressed={value === name} key={name}><i style={{ background: hex }} /></button>)}</div></div>;
}

function Range({ label, value, min, max, step, onChange, percent = false }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; percent?: boolean }) {
  return <label className="avatar-range"><span>{label}</span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><b>{percent ? `${Math.round(value * 100)}%` : value > 0 ? `+${value}` : value}</b></label>;
}

function mobileOptions(field: keyof AvatarConfig): string[]{if(field==="glassesColor")return ["black","brown"];if(field==="personality")return ["none","glasses","beard","hat","curls"];return optionValues(field).length?optionValues(field):Object.keys(COLORS[COLOR_FIELD_GROUP[field]??"accent"]??{});}
