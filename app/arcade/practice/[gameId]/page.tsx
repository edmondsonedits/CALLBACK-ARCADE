import { notFound } from "next/navigation";
import ArcadePracticeLab from "../../../components/ArcadePracticeLab";
import { getPracticeGame } from "../../../../lib/arcade/practice/catalog";

export default async function ArcadePracticeGamePage({ params }: { readonly params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const game = getPracticeGame(gameId);
  if (!game) notFound();
  return <ArcadePracticeLab gameId={game.id} />;
}
