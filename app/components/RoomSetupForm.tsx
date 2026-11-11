"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import type { GameLength, ImageModel } from "../../lib/contracts";
import { ARCADE_GAMES, ARCADE_PLACEHOLDER_NOTE } from "../../lib/arcade/catalog";
import type { ArcadeGameId } from "../../lib/arcade/contracts";
import { ImageGeneratorOptions } from "./ImageGeneratorOptions";

const subscribeHydration = () => () => undefined;

export function RoomSetupForm({ birthday = false, initialGame = "pictures", initialArcadeGame, initialFishTestOnly = false }: { birthday?: boolean; initialGame?: GameLength; initialArcadeGame?: ArcadeGameId; initialFishTestOnly?: boolean }) {
  useEffect(()=>{void fetch('/api/profile',{cache:'no-store'}).catch(()=>{});},[]);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [gameLength, setGameLength] = useState<GameLength>(birthday ? "birthday" : initialGame);
  const playableArcadeGames = ARCADE_GAMES.filter((game) => game.status === "playable");
  const [arcadeGameId, setArcadeGameId] = useState<ArcadeGameId | "">(initialArcadeGame && playableArcadeGames.some((game) => game.id === initialArcadeGame) ? initialArcadeGame : playableArcadeGames[0]?.id ?? "");
  const [birthdayName, setBirthdayName] = useState(birthday ? "Brandon" : "");
  const [familyFriendly, setFamilyFriendly] = useState(false);
  const [sorceryLength, setSorceryLength] = useState<"quick" | "long">("long");
  const [extendedTimers, setExtendedTimers] = useState(false);
  const fishTestOnly = initialFishTestOnly && initialGame === "arcade" && initialArcadeGame === "sketch-relay";
  const [soloMode, setSoloMode] = useState(fishTestOnly);
  const [soloLiveImages, setSoloLiveImages] = useState(false);
  const [imageModel, setImageModel] = useState<ImageModel>("flux-1-schnell");
  const [soloPlayerName, setSoloPlayerName] = useState(birthday ? "" : "Tester");
  const [botCount, setBotCount] = useState(3);
  const [foolPlayMode, setFoolPlayMode] = useState<"SAME_TABLE" | "REMOTE_LIVE">("SAME_TABLE");
  const [foolPerformance, setFoolPerformance] = useState<"DRAWING" | "CHARADES">("DRAWING");
  const [foolScrollsPerPlayer, setFoolScrollsPerPlayer] = useState(3);
  const [foolVoiceEnabled, setFoolVoiceEnabled] = useState(true);
  const [foolHostName, setFoolHostName] = useState("");
  const [playEnvironment, setPlayEnvironment] = useState<"same_table" | "remote_live">("same_table");
  const [bowlRoundTwo, setBowlRoundTwo] = useState<"drawing" | "charades">("drawing");
  const [scrollsPerPlayer, setScrollsPerPlayer] = useState(3);
  const [builtInVoice, setBuiltInVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const effectiveSoloMode = gameLength === "bowl-of-fools" ? false : soloMode;
  const effectivePlayerName = soloPlayerName.trim() || (birthday ? birthdayName.trim() : "Tester");
  const canSubmit = (!birthday || birthdayName.trim().length > 0)
    && (!effectiveSoloMode || effectivePlayerName.length > 0)
    && (gameLength !== "arcade" || Boolean(arcadeGameId))
    && (gameLength !== "bowl-of-fools" || foolHostName.trim().length > 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameLength: birthday ? "birthday" : gameLength,
          ...(gameLength === "arcade" && arcadeGameId ? { arcadeGameId } : {}),
          contentMode: familyFriendly ? "family" : "party",
          timerAccessibility: extendedTimers, sorceryLength,
          ...(birthday ? { birthdayName } : {}),
          soloMode: effectiveSoloMode,
          fishTestOnly: effectiveSoloMode && gameLength === "arcade" && arcadeGameId === "sketch-relay",
          playEnvironment, bowlRoundTwo, scrollsPerPlayer,
          builtInVoice: playEnvironment === "remote_live" && builtInVoice,
          soloLiveImages: soloMode && ["pictures", "comic", "king-mystery", "royal-rumours"].includes(gameLength) ? soloLiveImages : false,
          imageModel,
          foolPlayMode, foolPerformance, foolScrollsPerPlayer, foolVoiceEnabled,
          ...(gameLength === "bowl-of-fools" ? { foolHostName } : {}),
          ...(effectiveSoloMode ? { soloPlayerName: effectivePlayerName, botCount } : {}),
        }),
      });
      const body = await response.json() as { hostUrl?: string; playUrl?: string; soloUrl?: string | null; error?: { message?: string } };
      const destination = gameLength === "bowl-of-fools" ? body.playUrl : effectiveSoloMode ? body.soloUrl : body.hostUrl;
      if (!response.ok || !destination) throw new Error(body.error?.message ?? "Could not start the room.");
      window.location.assign(destination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not start the room."); setBusy(false); }
  };

  return <form className="room-setup-form" data-hydrated={hydrated} onSubmit={submit}>
    {birthday ? <label className="setup-field" htmlFor="birthday-name"><span>Birthday legend&apos;s first name</span><input id="birthday-name" type="text" autoComplete="off" value={birthdayName} onChange={(event) => setBirthdayName(event.target.value)} maxLength={40} placeholder="Brandon" /></label>
      : gameLength === "arcade" ? <div className="setup-field arcade-setup-title"><span>Arcade game</span><strong>{playableArcadeGames.find((game) => game.id === arcadeGameId)?.title ?? "Choose an Arcade game"}</strong></div>
      : <label className="setup-field" htmlFor="game-pack"><span>Game</span><select id="game-pack" value={gameLength} onChange={(event) => { const next = event.target.value as GameLength; setGameLength(next); if (next === "bowl-of-fools") setSoloMode(false); }}><option value="bowl-of-fools">Bowl of Fools · describe, perform, one word</option><option value="royal-rumours">Royal Rumours · AI picture telephone</option><option value="king-mystery">The Royal Frame-Up · bluff and investigate</option><option value="pictures">King Prompter · 2 canvases + Royal Restoration</option><option value="comic">Let&apos;s Make a Comic · 3 panels</option><option value="standard">Legacy Standard · 7 rounds</option></select>{gameLength === "bowl-of-fools" && <small>Fill one anonymous bowl, then guess the same scrolls by description, drawing or charades, and finally one word.</small>}{gameLength === "royal-rumours" && <small>Start a rumour, let AI illustrate it, then misinterpret somebody else&apos;s picture and watch the story mutate.</small>}{gameLength === "king-mystery" && <small>File a secret castle incident, inspect each evidence painting, then fool your friends with believable cover stories.</small>}{gameLength === "pictures" && <small>Write two funny royal commissions, choose one favorite image each time, then repair one gloriously torn portrait together.</small>}{gameLength === "comic" && <small>Build a connected three-panel comic: setup, escalation, then a high-stakes punchline.</small>}</label>}
    {gameLength === "arcade" && arcadeGameId === "sketch-relay" && <label className="setup-field">Game length<select aria-label="Sorcery game length" value={sorceryLength} onChange={event => setSorceryLength(event.target.value as "quick" | "long")}><option value="quick">Quick Spell · 2 rounds · 2-minute drawings</option><option value="long">Long Sorcery · 3 rounds · 4-minute drawings</option></select></label>}
    {gameLength === "arcade" && !fishTestOnly && <label className="setup-field" htmlFor="arcade-game"><span>Arcade game</span><select id="arcade-game" value={arcadeGameId} onChange={(event) => setArcadeGameId(event.target.value as ArcadeGameId | "")}><option value="">Choose a playable game</option>{playableArcadeGames.map((game) => <option key={game.id} value={game.id}>{game.title}</option>)}</select>{playableArcadeGames.length === 0 && <small>No Arcade games are ready yet.</small>}</label>}
    {gameLength === "arcade" && arcadeGameId === "sketch-relay" && !fishTestOnly && <div className="free-bot-note"><span aria-hidden="true">✦</span><p><strong>A little ink. A lot of imagination.</strong> For multiplayer rooms, play the full game with friends. Free practice bots never generate paid images. Solo rooms can use the temporary fish drawing test.</p></div>}
    {gameLength === "arcade" && playableArcadeGames.find((game) => game.id === arcadeGameId)?.placeholder && <p>{ARCADE_PLACEHOLDER_NOTE}</p>}
    {gameLength === "bowl-of-fools" && <fieldset className="solo-setup solo-enabled"><legend>Bowl rules</legend><div className="solo-settings"><label className="setup-field"><span>Your player name</span><input value={foolHostName} onChange={(event) => setFoolHostName(event.target.value)} autoComplete="nickname" maxLength={20} placeholder="Your name" /><small>You will host from this phone and still play every round. Local bots publish deterministic clues, prompt-relevant drawings, and mime practice cues; enter your team&apos;s spoken guess to score a bot turn.</small></label><label className="setup-field"><span>Play environment</span><select value={foolPlayMode} onChange={(event) => setFoolPlayMode(event.target.value as "SAME_TABLE" | "REMOTE_LIVE")}><option value="SAME_TABLE">Same Table · phones only</option><option value="REMOTE_LIVE">Remote Live · every screen</option></select></label><label className="setup-field"><span>Round Two</span><select value={foolPerformance} onChange={(event) => setFoolPerformance(event.target.value as "DRAWING" | "CHARADES")}><option value="DRAWING">Drawing</option><option value="CHARADES">Charades</option></select></label><div className="bot-count"><label htmlFor="fool-scroll-count"><strong>Scrolls per player</strong> <b>{foolScrollsPerPlayer}</b></label><input id="fool-scroll-count" type="range" min={1} max={5} value={foolScrollsPerPlayer} onChange={(event) => setFoolScrollsPerPlayer(Number(event.target.value))} /></div>{foolPlayMode === "REMOTE_LIVE" && <div className="solo-master-toggle"><input id="fool-voice-enabled" type="checkbox" checked={foolVoiceEnabled} onChange={(event) => setFoolVoiceEnabled(event.target.checked)} /><label htmlFor="fool-voice-enabled"><strong>Built-in voice</strong><small>Optional direct peer-to-peer audio. An outside group call always works too.</small></label></div>}</div></fieldset>}
    {gameLength === "bowl" && <fieldset className="solo-setup solo-enabled"><legend>Classic Bowl rules</legend><div className="solo-settings"><label className="setup-field"><span>Play environment</span><select value={playEnvironment} onChange={(event) => setPlayEnvironment(event.target.value as "same_table" | "remote_live")}><option value="same_table">Same Table · phones only</option><option value="remote_live">Remote Live · every screen</option></select></label><label className="setup-field"><span>Round Two</span><select value={bowlRoundTwo} onChange={(event) => setBowlRoundTwo(event.target.value as "drawing" | "charades")}><option value="drawing">Drawing</option><option value="charades">Charades</option></select></label><div className="bot-count"><label htmlFor="classic-bowl-scroll-count"><strong>Scrolls per player</strong> <b>{scrollsPerPlayer}</b></label><input id="classic-bowl-scroll-count" type="range" min={1} max={5} value={scrollsPerPlayer} onChange={(event) => setScrollsPerPlayer(Number(event.target.value))} /></div>{playEnvironment === "remote_live" && <div className="solo-master-toggle"><input id="classic-bowl-voice" type="checkbox" checked={builtInVoice} onChange={(event) => setBuiltInVoice(event.target.checked)} /><label htmlFor="classic-bowl-voice"><strong>Built-in voice</strong><small>Optional direct peer-to-peer audio. An outside group call always works too.</small></label></div>}</div></fieldset>}
    <div className="setup-choice-grid">
      {!['pictures', 'comic', 'bowl', 'king-mystery', 'royal-rumours', 'arcade'].includes(gameLength) && <label className="birthday-check" htmlFor="family-friendly" aria-label="Family-friendly prompts"><input id="family-friendly" type="checkbox" checked={familyFriendly} onChange={(event) => setFamilyFriendly(event.target.checked)} /><span><strong>Family-friendly prompts</strong><small>Keep every writing prompt safe for all ages.</small></span></label>}
      {!fishTestOnly && (gameLength !== "arcade" || arcadeGameId === "sketch-relay") && <label className="birthday-check" htmlFor="extended-timers" aria-label="More thinking time"><input id="extended-timers" type="checkbox" checked={extendedTimers} onChange={(event) => setExtendedTimers(event.target.checked)} /><span><strong>More thinking time</strong><small>Add 50% to interactive round timers.</small></span></label>}
    </div>
    {gameLength !== "bowl-of-fools" && gameLength !== "bowl" && (gameLength !== "arcade" || arcadeGameId === "sketch-relay") && !(effectiveSoloMode && gameLength === "arcade" && arcadeGameId === "sketch-relay") && <label className="setup-field" htmlFor="image-model"><span>Image generator</span><select id="image-model" value={imageModel} onChange={(event) => setImageModel(event.target.value as ImageModel)}><ImageGeneratorOptions /></select><small>ChatGPT Images uses low quality within the configured image allowance limits. Generation stops at the safety limit. Sketches and comics use the original artwork as a reference.</small></label>}
    {gameLength !== "bowl-of-fools" && gameLength !== "bowl" && (gameLength !== "arcade" || arcadeGameId === "sketch-relay") && <fieldset className={`solo-setup ${soloMode ? "solo-enabled" : ""}`}>
      <legend>Playtest options</legend>
      <label className="solo-master-toggle" htmlFor="solo-mode" aria-label="Play solo with local bots"><input id="solo-mode" type="checkbox" checked={soloMode} onChange={(event) => setSoloMode(event.target.checked)} /><span><strong>Play solo with local bots</strong><small>Use one phone as both host and player. Sketch &amp; Sorcery solo is limited to the temporary fish drawing test. No paid AI or API key.</small></span></label>
      {soloMode && <div className="solo-settings">
        <label className="setup-field" htmlFor="solo-name"><span>Your player name</span><input id="solo-name" type="text" autoComplete="nickname" maxLength={20} value={soloPlayerName} onChange={(event) => setSoloPlayerName(event.target.value)} placeholder={birthdayName.trim() || "Tester"} /></label>
        <label className="bot-count" htmlFor="bot-count"><span><strong>Bot opponents</strong><b>{botCount}</b></span><input id="bot-count" type="range" min={2} max={5} step={1} value={botCount} onChange={(event) => setBotCount(Number(event.target.value))} /><small>{botCount + 1} players total · bots create practice entries and vote automatically</small></label>
        {["pictures", "comic", "king-mystery", "royal-rumours"].includes(gameLength) && <label className="solo-master-toggle" htmlFor="solo-live-images" aria-label="Generate live solo images"><input id="solo-live-images" type="checkbox" checked={soloLiveImages} onChange={(event) => setSoloLiveImages(event.target.checked)} /><span><strong>Generate live solo images</strong><small>Create an image for your prompt and every bot prompt using the selected generator. ChatGPT Images uses OpenAI credits.</small></span></label>}
        <div className="free-bot-note"><span aria-hidden="true">✓</span><p>{soloLiveImages && ["pictures", "comic", "king-mystery", "royal-rumours"].includes(gameLength) ? <><strong>Live image test enabled.</strong> Bot writing and voting remain deterministic; image generation uses the selected provider’s allocation or credits.</> : <><strong>Quota-free by default.</strong> Deterministic bots and concept cards never queue image API work.</>}</p></div>
      </div>}
    </fieldset>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="button button-primary" disabled={!hydrated || busy || !canSubmit} type="submit">{busy ? "Preparing the room…" : fishTestOnly ? "Create fish test room" : gameLength === "arcade" ? "Create Arcade room" : gameLength === "bowl-of-fools" ? "Create phone room" : effectiveSoloMode ? "Start solo playtest" : birthday ? "Create birthday room" : "Create multiplayer room"}</button>
  </form>;
}
