import Link from "next/link";
import { Brand } from "../../components/Brand";

export default function BirthdaySetupPage() {
  return <main className="game-setup-shell"><nav className="birthday-nav"><Brand compact /><Link href="/?menu=1">Back to the active menu</Link></nav><section className="birthday-setup-card standard-setup-card"><p className="eyebrow">Archived game pack</p><h1>30th Birthday is unavailable.</h1><p>This pack has been removed from active play. Choose one of the current games from the menu.</p><Link className="button button-primary" href="/?menu=1">Return to the active menu</Link></section></main>;
}
