"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HostRoomSurface } from "../../host/[code]/page";
import { Brand } from "../../components/Brand";

export default function SecondaryDisplayPage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void params.then(async (value) => {
      const normalized = value.code.toUpperCase();
      setCode(normalized);
      // Shared-lobby mirrors already received a display cookie from their authenticated parent snapshot.
      if (window.parent !== window && new URLSearchParams(window.location.search).get("session")) { setReady(true); return; }
      try {
        const response = await fetch(`/api/rooms/${normalized}/display-session`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
        if (!response.ok) { const body = await response.json().catch(() => null) as { error?: { message?: string } } | null; setError(body?.error?.message ?? "That room could not be found."); return; }
        setReady(true);
      } catch { setError("Could not reach the game. Check the connection and try again."); }
    });
  }, [params]);

  if (error) return <main className="centered-screen"><Brand /><div className="error-card"><h1>Screen unavailable</h1><p>{error}</p><Link className="button button-primary" href="/display">Enter another code</Link></div></main>;
  if (!ready || !code) return <main className="centered-screen"><Brand /><div className="loader-orbit" aria-hidden="true"><span /><span /><span /></div><p>Opening the host display…</p></main>;
  return <HostRoomSurface code={code} display />;
}
