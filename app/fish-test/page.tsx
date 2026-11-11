import Link from "next/link";
import { Brand } from "../components/Brand";
import { RoomSetupForm } from "../components/RoomSetupForm";

export default function FishTestPage(){
 return <main className="game-setup-shell"><nav className="birthday-nav"><Brand compact/><Link href="/">Back to King Prompter</Link></nav><section className="birthday-setup-card standard-setup-card"><p className="eyebrow">TEMPORARY PLAYTEST</p><h1>Fish drawing test</h1><p>Create a test room, draw your fish, and watch it swim. Free practice fish fill the other seats. You can test the shark showdown or a peaceful aquarium without playing the main rounds.</p><RoomSetupForm initialGame="arcade" initialArcadeGame="sketch-relay" initialFishTestOnly/></section></main>;
}
