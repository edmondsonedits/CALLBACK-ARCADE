"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerSnapshot } from "../../lib/contracts";

type Signal = { senderId: string; kind: "OFFER" | "ANSWER" | "ICE" | "HANGUP"; payload: unknown; createdAt: number };

export function FoolRemoteLive({ snapshot }: { snapshot: PlayerSnapshot }) {
  const bowl = snapshot.foolBowl;
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [layout, setLayout] = useState<"STAGE" | "GRID" | "HIDDEN">("STAGE");
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [error, setError] = useState("");
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const local = useRef<MediaStream | null>(null);
  const after = useRef(0);
  const performerVideo = Boolean(bowl && bowl.gameRound === 2 && bowl.performance === "CHARADES" && bowl.clueGiverId === snapshot.selfId && ["FOOL_TURN", "FOOL_SUDDEN_DEATH"].includes(snapshot.phase));
  const playerIds = snapshot.players.filter((player) => player.role === "player" && player.active && player.id !== snapshot.selfId).map((player) => player.id);

  const signal = useCallback(async (targetId: string, kind: Signal["kind"], payload: unknown) => {
    await fetch(`/api/rooms/${snapshot.code}/media-signals`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId, kind, payload }) });
  }, [snapshot.code]);

  const peerFor = useCallback((peerId: string) => {
    const current = peers.current.get(peerId); if (current) return current;
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] });
    for (const track of local.current?.getTracks() ?? []) peer.addTrack(track, local.current!);
    peer.onicecandidate = (event) => { if (event.candidate) void signal(peerId, "ICE", event.candidate.toJSON()); };
    peer.ontrack = (event) => setStreams((value) => ({ ...value, [peerId]: event.streams[0] ?? new MediaStream([event.track]) }));
    peer.onconnectionstatechange = () => { if (["failed", "closed", "disconnected"].includes(peer.connectionState)) setStreams((value) => { const copy = { ...value }; delete copy[peerId]; return copy; }); };
    peers.current.set(peerId, peer); return peer;
  }, [signal]);

  const offer = useCallback(async (peerId: string) => {
    const peer = peerFor(peerId); const description = await peer.createOffer(); await peer.setLocalDescription(description); await signal(peerId, "OFFER", description);
  }, [peerFor, signal]);

  const leave = useCallback(() => {
    for (const [id, peer] of peers.current) { void signal(id, "HANGUP", {}); peer.close(); }
    peers.current.clear(); for (const track of local.current?.getTracks() ?? []) track.stop(); local.current = null; setStreams({}); setJoined(false);
  }, [signal]);

  const join = async () => {
    try {
      const wantsAudio = Boolean(bowl?.voiceEnabled);
      if (wantsAudio || performerVideo) local.current = await navigator.mediaDevices.getUserMedia({ audio: wantsAudio, video: performerVideo ? { width: 960, height: 540 } : false });
      setJoined(true); setError("");
      for (const id of playerIds) if (snapshot.selfId.localeCompare(id) < 0) await offer(id);
    } catch { setError("Built-in media could not connect. The game still works—use your normal phone or group call."); leave(); }
  };

  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/rooms/${snapshot.code}/media-signals?after=${after.current}`, { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error();
        const body = await response.json() as { signals: Signal[]; serverTime: number };
        for (const item of body.signals) {
          after.current = Math.max(after.current, item.createdAt);
          const peer = peerFor(item.senderId);
          if (item.kind === "OFFER") { await peer.setRemoteDescription(item.payload as RTCSessionDescriptionInit); const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); await signal(item.senderId, "ANSWER", answer); }
          else if (item.kind === "ANSWER") await peer.setRemoteDescription(item.payload as RTCSessionDescriptionInit);
          else if (item.kind === "ICE") { try { await peer.addIceCandidate(item.payload as RTCIceCandidateInit); } catch { /* Candidate can race a fresh offer. */ } }
          else { peer.close(); peers.current.delete(item.senderId); setStreams((value) => { const copy = { ...value }; delete copy[item.senderId]; return copy; }); }
        }
        after.current = Math.max(after.current, body.serverTime - 1);
      } catch { setError("The built-in call lost its relay. Keep playing and switch to an outside call."); }
    }, 900);
    return () => window.clearInterval(timer);
  }, [joined, peerFor, signal, snapshot.code]);

  useEffect(() => () => { for (const peer of peers.current.values()) peer.close(); for (const track of local.current?.getTracks() ?? []) track.stop(); }, []);
  useEffect(() => { for (const track of local.current?.getAudioTracks() ?? []) track.enabled = !muted; }, [muted]);
  useEffect(() => {
    if (!joined) return;
    const refreshCamera = async () => {
      try {
        const existing = local.current?.getVideoTracks()[0];
        if (performerVideo && !existing) {
          const camera = await navigator.mediaDevices.getUserMedia({ video: { width: 960, height: 540 }, audio: false });
          const track = camera.getVideoTracks()[0];
          local.current ??= new MediaStream(); local.current.addTrack(track);
          for (const peer of peers.current.values()) peer.addTrack(track, local.current);
          for (const id of peers.current.keys()) await offer(id);
        } else if (!performerVideo && existing) {
          existing.stop(); local.current?.removeTrack(existing);
          for (const peer of peers.current.values()) for (const sender of peer.getSenders().filter((item) => item.track?.kind === "video")) await sender.replaceTrack(null);
          for (const id of peers.current.keys()) await offer(id);
        }
      } catch { setError("The performer camera could not start. Switch this round to an outside video call."); }
    };
    void refreshCamera();
  }, [joined, performerVideo, offer]);

  const remoteEntries = Object.entries(streams);
  return <section className="fool-live-panel"><div className="fool-live-toolbar">{joined ? <><button type="button" onClick={() => setMuted((value) => !value)}>{muted ? "Unmute" : "Mute"}</button><button type="button" onClick={() => setLayout((value) => value === "STAGE" ? "GRID" : value === "GRID" ? "HIDDEN" : "STAGE")}>{layout === "STAGE" ? "Stage view" : layout === "GRID" ? "Grid view" : "Video hidden"}</button><button type="button" onClick={leave}>Leave call</button></> : <button type="button" className="button button-secondary" onClick={() => void join()}>{bowl?.voiceEnabled ? "Join built-in voice" : "Join performer video"}</button>}</div>{joined && <small>Direct peer-to-peer · performer camera only · your view is private to this device</small>}{error && <p className="phone-error">{error}</p>}{joined && layout !== "HIDDEN" && <div className={`fool-live-videos layout-${layout.toLowerCase()}`}>{remoteEntries.map(([id, stream]) => <RemoteMedia key={id} stream={stream} label={snapshot.players.find((player) => player.id === id)?.nickname ?? "Player"} featured={id === bowl?.clueGiverId} />)}</div>}</section>;
}

function RemoteMedia({ stream, label, featured }: { stream: MediaStream; label: string; featured: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <figure className={featured ? "featured" : ""}><video ref={ref} autoPlay playsInline aria-label={`${label} live video and audio`}><track kind="captions" src="/captions/live-stream.vtt" srcLang="en" label="Live captions" /></video><figcaption>{label}</figcaption></figure>;
}
