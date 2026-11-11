import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./components/AvatarPuppetPad.css";
import "./session.css";
import "./phone-sections.css";
import {HostMusicProvider} from './components/HostMusicProvider';
import {SessionFrameBridge} from "./components/SessionFrameBridge";
import "./presentation.css";
import "./testing.css";
import "./fullscreen.css";
import "./character-fullscreen.css";
import "./sorcery-theme.css";
import "./edmondson-menus.css";
import "./interface-layout.css";
import {ViewportHeight} from "./components/ViewportHeight";
import "../public/arcade-games/shared/arcade-touch.css";
import {ArcadeTouchPolicy} from "./components/ArcadeTouchTools";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Callback — One lobby. Every game.";
  const description = "Write tiny image prompts, rank the room's creations, and crown the best generated picture in a live multiplayer party game.";
  return {
    metadataBase: new URL(origin), title: { default: title, template: "%s · Callback" }, description,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Callback", statusBarStyle: "black-translucent" },
    icons: {
      icon: "/favicon.svg", shortcut: "/favicon.svg",
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: { title, description, type: "website", siteName: "Callback", images: [{ url: new URL("/og.png", origin).toString(), width: 1672, height: 941, alt: "King Prompter party game" }] },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/og.png", origin).toString()] },
  };
}

export const viewport = { themeColor: "#101a3b", colorScheme: "dark light", width: "device-width", initialScale: 1, viewportFit: "cover" };

const stylesheetRecoveryScript = `(()=>{const recover=()=>{try{if(getComputedStyle(document.documentElement).getPropertyValue("--kp-night").trim())return;const links=[...document.querySelectorAll('link[rel="stylesheet"]')];const link=links.find(item=>/(?:globals|layout)(?:[.-]|$)/i.test(item.dataset.rscCssHref||item.href))||links.find(item=>(item.getAttribute("data-precedence")||"").endsWith("/importer-resources"));if(!link||link.dataset.callbackCssRecoveryAttempted)return;link.dataset.callbackCssRecoveryAttempted="1";const url=new URL(link.href,document.baseURI);url.searchParams.set("__callback_css_retry","1");const retry=document.createElement("link");retry.rel="stylesheet";retry.href=url.href;if(link.media)retry.media=link.media;retry.dataset.callbackCssRecovery="1";link.after(retry)}catch{}};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(recover,0),{once:true});else setTimeout(recover,0)})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><script dangerouslySetInnerHTML={{ __html: stylesheetRecoveryScript }} /><ViewportHeight/><HostMusicProvider><ArcadeTouchPolicy/><SessionFrameBridge/>{children}</HostMusicProvider></body>
    </html>
  );
}
