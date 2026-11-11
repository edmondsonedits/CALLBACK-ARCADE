import Link from "next/link";
import { Brand } from "../components/Brand";
import { LandingAvatarStudio } from "../components/LandingAvatarStudio";
import { FullscreenDocument } from "../components/FullscreenDocument";

export default function AvatarStudioPage() {
  return <FullscreenDocument><main className="game-setup-shell character-menu"><h1 className="sr-only">Character Studio</h1><nav className="birthday-nav"><Brand compact platform /><Link href="/?menu=1">Home</Link></nav><section className="avatar-studio-page"><LandingAvatarStudio /></section></main></FullscreenDocument>;
}
