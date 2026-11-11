import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../components/Brand";
import { DeveloperLauncher } from "../components/DeveloperLauncher";

export const metadata: Metadata = { title: "Testing mode — King Prompter", description: "Test host and phone views together, control pacing, tune rounds, and export changes." };

export default function DeveloperPage() {
  return <main className="developer-shell">
    <nav className="birthday-nav"><Brand compact /><Link href="/">Back to King Prompter</Link></nav>
    <section className="developer-hero">
      <div className="developer-intro"><p className="eyebrow">King Prompter workshop</p><h1>See both sides. Test every beat.</h1><p>Testing mode opens the real host screen beside the real phone controller. Control timers and phases from one workbench, inspect responsive behavior, and keep every server rule intact.</p><ol><li><b>1</b><span><strong>Watch host and phone together</strong><small>Switch between split, host-only, and phone-only previews at any time.</small></span></li><li><b>2</b><span><strong>Control the test safely</strong><small>Pause, add time, skip, add bots, refresh panes, or replay through authoritative actions.</small></span></li><li><b>3</b><span><strong>Tune isolated rounds</strong><small>Developer studio changes remain limited to the current private room.</small></span></li></ol></div>
      <div className="developer-launch-card"><span className="developer-stamp">TEST MODE</span><h2>Start a fresh run</h2><p>Choose any pack. Most use local bots; Bowl keeps its human-team rules.</p><DeveloperLauncher /></div>
    </section>
  </main>;
}
