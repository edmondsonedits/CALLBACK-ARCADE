import {FullscreenDocument} from "../../components/FullscreenDocument";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "../../components/Brand";
import { RoomSetupForm } from "../../components/RoomSetupForm";
import { ARCADE_GAMES, getArcadeLaunchHref } from "../../../lib/arcade/catalog";
import { ArcadeGameIdSchema } from "../../../lib/arcade/contracts";
import { isArchivedGamePack } from "../../../lib/game/archived-packs";

export default async function NewRoomPage({ searchParams }: { searchParams: Promise<{ game?: string; gameLength?: string; arcadeGameId?: string }> }) {
  const { game, gameLength: requestedLength, arcadeGameId: requestedArcadeGame } = await searchParams;
  const requestedPack = [game, requestedLength].find((value) => isArchivedGamePack(value ?? ""));
  if (requestedPack) redirect(`/archived-game?pack=${encodeURIComponent(requestedPack)}`);
  const arcadeGameId = ArcadeGameIdSchema.safeParse(requestedArcadeGame);
  const initialArcadeGame = arcadeGameId.success && ARCADE_GAMES.some((entry) => entry.id === arcadeGameId.data && entry.status === "playable") ? arcadeGameId.data : undefined;
  const initialGame = requestedLength === "arcade" ? "arcade" : game === "comic"
    ? "comic"
      : game === "bowl-of-fools"
        ? "bowl-of-fools"
        : game === "bowl"
          ? "bowl"
      : game === "king-mystery"
        ? "king-mystery"
        : game === "royal-rumours"
          ? "royal-rumours"
          : game === "royal-war-room"
            ? "royal-war-room"
            : "pictures";
  const selectedArcadeGame = ARCADE_GAMES.find((entry) => entry.id === initialArcadeGame) ?? ARCADE_GAMES.find((entry) => entry.status === "playable");
  const launchHref = selectedArcadeGame && getArcadeLaunchHref(selectedArcadeGame);
  if (initialGame === "arcade" && launchHref?.startsWith("/arcade/online/")) redirect(launchHref);
  return <FullscreenDocument><main className="game-setup-shell"><nav className="birthday-nav"><Brand compact /><Link href="/">Back home</Link></nav><section className="birthday-setup-card standard-setup-card"><p className="eyebrow">{initialGame === "arcade" ? "King Prompter Arcade" : "Room settings"}</p><h1>{initialGame === "arcade" ? selectedArcadeGame?.title ?? "Arcade" : "Set the room your way."}</h1><p>{initialGame === "arcade" ? initialArcadeGame === "sketch-relay" ? "Write and vote for three shared prompts. Draw on your phone, rank the funniest AI transformations, guess their artists, then reveal the original sketches and perform with your avatar. For 3–10 players." : "A separate Arcade game for the phones in your room." : "Start a normal phone-and-TV party, or switch on solo playtest mode to run the whole game from one phone."}</p><RoomSetupForm initialGame={initialGame} initialArcadeGame={initialArcadeGame} /></section></main></FullscreenDocument>;
}
