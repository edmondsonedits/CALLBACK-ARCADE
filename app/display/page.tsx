"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Brand } from "../components/Brand";

export default function DisplayEntryPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const suggested = new URLSearchParams(window.location.search).get("code") ?? "";
    const timer = window.setTimeout(() => setCode(suggested.toUpperCase().replace(/[^A-HJ-KM-NP-Z2-9]/g, "").slice(0, 4)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = code.toUpperCase().replace(/[^A-HJ-KM-NP-Z2-9]/g, "").slice(0, 4);
    if (normalized.length !== 4) { setError("Enter the four-character code from the main host screen."); return; }
    setBusy(true); setError(""); window.location.href = `/display/${normalized}`;
  };

  return <main className="phone-shell phone-entry display-entry"><Brand /><section className="phone-card"><p className="eyebrow">Second screen</p><h1>Follow the host screen.</h1><p>Enter the four-character code shown on the main host TV or computer.</p><form onSubmit={submit}><label htmlFor="display-code">Screen code</label><input id="display-code" className="code-input" autoComplete="off" inputMode="text" value={code} onChange={(event) => { setCode(event.target.value.toUpperCase().replace(/[^A-HJ-KM-NP-Z2-9]/g, "").slice(0, 4)); setError(""); }} maxLength={4} placeholder="B4CK" aria-describedby={error ? "display-code-error" : undefined} />{error && <p className="form-error" id="display-code-error" role="alert">{error}</p>}<button className="button button-primary phone-button" type="submit" disabled={busy}>{busy ? "Opening screen…" : "Open host display"} <span aria-hidden="true">→</span></button></form></section><p className="phone-footnote">Read-only copy · Game controls stay on the main host.</p></main>;
}
