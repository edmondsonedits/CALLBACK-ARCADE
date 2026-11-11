import Link from "next/link";
import { Brand } from "../components/Brand";
import { ARCHIVED_GAME_PACK_TITLES, isArchivedGamePack } from "../../lib/game/archived-packs";

export default async function ArchivedGamePage({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  const title = pack && isArchivedGamePack(pack)
    ? ARCHIVED_GAME_PACK_TITLES[pack]
    : "This game pack";
  return <main className="game-setup-shell"><nav className="birthday-nav"><Brand compact /><Link href="/?menu=1">Back to the active menu</Link></nav><section className="birthday-setup-card standard-setup-card"><p className="eyebrow">Archived game pack</p><h1>{title} is unavailable.</h1><p>This pack has been removed from active play. Choose one of the current games from the menu.</p><Link className="button button-primary" href="/?menu=1">Return to the active menu</Link></section></main>;
}
