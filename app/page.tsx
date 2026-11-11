import type { Metadata } from "next";
import TVIntroMenu from "./components/TVIntroMenu";

export const metadata: Metadata = {
  title: "Callback — One lobby. Every game.",
  description: "A live royal variety show where every player writes the chaos and the room crowns a winner.",
};

export default function Home() {
  return <TVIntroMenu />;
}
