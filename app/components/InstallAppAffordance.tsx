"use client";

import { useEffect, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> };

const DISMISSED_KEY = "callback-install-dismissed";

export function InstallAppAffordance() {
  const [ready, setReady] = useState(false);
  const [ios, setIos] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const isStandalone = displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const initialize = window.setTimeout(() => {
    setStandalone(isStandalone);
    try { setDismissed(window.sessionStorage.getItem(DISMISSED_KEY) === "1"); } catch { /* Storage can be disabled by the browser. */ }
    const userAgent = navigator.userAgent;
    setIos(/iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setReady(true);
    }, 0);

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setPromptEvent(null);
      setDismissed(true);
      try { window.sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* Installed state still hides the affordance. */ }
    };
    const handleDisplayMode = (event: MediaQueryListEvent) => setStandalone(event.matches);
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayMode.addEventListener("change", handleDisplayMode);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener("change", handleDisplayMode);
    };
  }, []);

  if (!ready || standalone || dismissed) return null;

  const hideForSession = () => {
    setOpen(false);
    setDismissed(true);
    try { window.sessionStorage.setItem(DISMISSED_KEY, "1"); } catch { /* The in-memory dismissal still applies. */ }
  };

  const install = async () => {
    if (!promptEvent) {
      setOpen((current) => !current);
      return;
    }
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      hideForSession();
    } catch {
      setPromptEvent(null);
      setOpen(true);
    }
  };

  return (
    <aside className="install-app-affordance" aria-label="Install Callback">
      <button type="button" className="install-app-button" onClick={install} aria-expanded={open} aria-controls="install-app-help">
        <span aria-hidden="true">↧</span> Install Callback
      </button>
      {open && <div className="install-app-help" id="install-app-help" role="status">
        <p>{ios
          ? <>In Safari, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.</>
          : <>Open your browser menu and choose <strong>Install Callback</strong> or <strong>Add to Home Screen</strong>.</>}</p>
        <button type="button" className="install-app-dismiss" onClick={hideForSession}>Dismiss</button>
      </div>}
    </aside>
  );
}
