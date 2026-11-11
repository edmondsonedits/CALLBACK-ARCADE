"use client";
/* eslint-disable jsx-a11y/media-has-caption -- Live peer media is intentionally neither recorded nor transcribed, so no caption track exists. */

import { useEffect, useRef, useState } from "react";
import type { PlayerSnapshot } from "../../lib/contracts";

type ViewMode = "stage" | "grid" | "hidden";
interface RemoteStream { id: string; stream: MediaStream }
interface Signal { senderId: string; kind: "offer" | "answer" | "ice"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }

export function BowlRemoteMedia({ code, snapshot }: { code: string; snapshot: PlayerSnapshot }) {
  const bowl = snapshot.bowl!; const [enabled, setEnabled] = useState(false); const [status, setStatus] = useState<"off" | "connecting" | "live" | "failed">("off");
  const [view, setView] = useState<ViewMode>("stage"); const [hidePerformer, setHidePerformer] = useState(false); const [size, setSize] = useState(42); const [muted, setMuted] = useState(false); const [hidePreview, setHidePreview] = useState(true);
  const [streams, setStreams] = useState<RemoteStream[]>([]); const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peers = useRef(new Map<string, RTCPeerConnection>()); const media = useRef<MediaStream | null>(null); const stopped = useRef(false);
  const performerId = bowl.roundTwo === "charades" && ["BOWL_TURN", "BOWL_SUDDEN_DEATH"].includes(snapshot.phase) ? bowl.clueGiverId : null;
  const isPerformer = performerId === snapshot.selfId;

  useEffect(() => { const timer = window.setTimeout(() => { try { const raw = localStorage.getItem("bowl-media-layout"); if (raw) { const saved = JSON.parse(raw) as { view?: ViewMode; hidePerformer?: boolean; size?: number; muted?: boolean; hidePreview?: boolean }; if (saved.view) setView(saved.view); setHidePerformer(Boolean(saved.hidePerformer)); if (saved.size) setSize(saved.size); setMuted(Boolean(saved.muted)); setHidePreview(saved.hidePreview !== false); } } catch { /* Device preferences are optional. */ } }, 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { try { localStorage.setItem("bowl-media-layout", JSON.stringify({ view, hidePerformer, size, muted, hidePreview })); } catch { /* Device preferences are optional. */ } }, [view, hidePerformer, size, muted, hidePreview]);

  useEffect(() => {
    if (!enabled || !bowl.builtInVoice) return;
    stopped.current = false; let timer: number | undefined;
    const sendSignal = async (recipientId: string, kind: Signal["kind"], payload: Signal["payload"]) => { await fetch(`/api/rooms/${code}/media-signals`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientId, kind, payload }) }); };
    const ensurePeer = (peerId: string) => {
      const existing = peers.current.get(peerId); if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }); peers.current.set(peerId, pc);
      media.current?.getTracks().forEach((track) => pc.addTrack(track, media.current!));
      pc.onicecandidate = (event) => { if (event.candidate) void sendSignal(peerId, "ice", event.candidate.toJSON()).catch(() => setStatus("failed")); };
      pc.ontrack = (event) => { const stream = event.streams[0] ?? new MediaStream([event.track]); setStreams((current) => [...current.filter((item) => item.id !== peerId), { id: peerId, stream }]); };
      pc.onconnectionstatechange = () => { if (["connected", "completed"].includes(pc.connectionState)) setStatus("live"); if (["failed", "disconnected"].includes(pc.connectionState)) setStatus("failed"); };
      return pc;
    };
    const poll = async () => {
      try {
        const response = await fetch(`/api/rooms/${code}/media-signals`, { credentials: "include", cache: "no-store" }); if (!response.ok) throw new Error("signal");
        const data = await response.json() as { selfId: string; peers: Array<{ id: string }>; signals: Signal[] };
        for (const peer of data.peers.filter((item) => item.id !== data.selfId)) {
          const pc = ensurePeer(peer.id);
          if (data.selfId < peer.id && pc.signalingState === "stable" && !pc.localDescription) { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await sendSignal(peer.id, "offer", offer); }
        }
        for (const signal of data.signals) {
          const pc = ensurePeer(signal.senderId);
          if (signal.kind === "offer") { await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); await sendSignal(signal.senderId, "answer", answer); }
          else if (signal.kind === "answer" && pc.signalingState === "have-local-offer") await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
          else if (signal.kind === "ice") await pc.addIceCandidate(signal.payload as RTCIceCandidateInit).catch(() => undefined);
        }
        if (!stopped.current) timer = window.setTimeout(() => void poll(), 900);
      } catch { setStatus("failed"); if (!stopped.current) timer = window.setTimeout(() => void poll(), 2500); }
    };
    const start = async () => {
      setStatus("connecting");
      try { const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); media.current = stream; setLocalStream(stream); void poll(); }
      catch { setStatus("failed"); }
    };
    void start();
    const currentPeers = peers.current;
    return () => { stopped.current = true; if (timer) window.clearTimeout(timer); for (const pc of currentPeers.values()) pc.close(); currentPeers.clear(); media.current?.getTracks().forEach((track) => track.stop()); media.current = null; setStreams([]); setLocalStream(null); };
  }, [enabled, bowl.builtInVoice, code]);

  useEffect(() => {
    if (!enabled || !media.current) return;
    let cancelled = false;
    const updateCamera = async () => {
      const existing = media.current!.getVideoTracks()[0];
      if (!isPerformer) { if (existing) { existing.stop(); media.current!.removeTrack(existing); } for (const pc of peers.current.values()) for (const sender of pc.getSenders().filter((item) => item.track?.kind === "video")) await sender.replaceTrack(null); return; }
      if (existing) return;
      try { const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } }, audio: false }); if (cancelled) { camera.getTracks().forEach((track) => track.stop()); return; } const track = camera.getVideoTracks()[0]; media.current!.addTrack(track); setLocalStream(new MediaStream(media.current!.getTracks())); for (const pc of peers.current.values()) { const sender = pc.getSenders().find((item) => item.track?.kind === "video"); if (sender) await sender.replaceTrack(track); else pc.addTrack(track, media.current!); } }
      catch { setStatus("failed"); }
    };
    void updateCamera(); return () => { cancelled = true; };
  }, [enabled, isPerformer, performerId]);

  if (!bowl.builtInVoice) return <aside className="remote-call-note"><strong>Outside call mode</strong><span>Use your usual phone or group call. Gameplay stays here.</span></aside>;
  const visible = view !== "hidden" ? streams.filter((item) => !hidePerformer || item.id !== performerId) : [];
  return <aside className={`bowl-media-panel view-${view}`} style={{ "--media-size": `${size}vh` } as React.CSSProperties}><header><div><strong>Remote Live</strong><span className={`media-status status-${status}`}>{status === "live" ? "Connected" : status === "connecting" ? "Connecting…" : status === "failed" ? "Direct connection unavailable" : "Media off"}</span></div>{!enabled ? <button type="button" onClick={() => setEnabled(true)}>Enable voice</button> : <button type="button" onClick={() => setEnabled(false)}>Leave call</button>}</header>{status === "failed" && <p role="status">A restrictive network or denied permission blocked the direct connection. Keep playing and use an outside phone or group call.</p>}{enabled && <>{streams.map((item) => <RemoteAudio key={`audio-${item.id}`} stream={item.stream} muted={muted} />)}<div className="media-layout-controls"><button className={view === "stage" ? "selected" : ""} onClick={() => setView("stage")}>Stage</button><button className={view === "grid" ? "selected" : ""} onClick={() => setView("grid")}>Grid</button><button className={view === "hidden" ? "selected" : ""} onClick={() => setView("hidden")}>Hide video</button><button onClick={() => setHidePerformer((value) => !value)}>{hidePerformer ? "Show performer" : "Hide performer"}</button><button onClick={() => setMuted((value) => !value)}>{muted ? "Unmute locally" : "Mute locally"}</button><button onClick={() => setHidePreview((value) => !value)}>{hidePreview ? "Show my preview" : "Hide my preview"}</button><label>Video size<input type="range" min={22} max={70} value={size} onChange={(event) => setSize(Number(event.target.value))} /></label></div><div className="remote-video-area">{visible.filter((item) => view === "grid" || item.id === performerId).map((item) => <RemoteVideo key={item.id} stream={item.stream} muted label={item.id === performerId ? "Current performer" : snapshot.players.find((p) => p.id === item.id)?.nickname ?? "Player"} />)}{isPerformer && localStream && !hidePreview && <RemoteVideo stream={localStream} muted label="Your preview" />}{view !== "hidden" && visible.length === 0 && !isPerformer && <div className="video-placeholder">{performerId ? "Waiting for performer video…" : "Voice is live. Camera appears only for Remote Charades."}</div>}</div></>}</aside>;
}

function RemoteVideo({ stream, muted, label }: { stream: MediaStream; muted: boolean; label: string }) { const ref = useRef<HTMLVideoElement>(null); useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]); return <figure><video ref={ref} autoPlay playsInline muted={muted} /><figcaption>{label}</figcaption></figure>; }
function RemoteAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) { const ref = useRef<HTMLAudioElement>(null); useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]); return <audio ref={ref} autoPlay muted={muted} />; }
