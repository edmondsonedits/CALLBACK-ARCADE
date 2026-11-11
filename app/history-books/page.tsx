import type { Metadata } from "next";
import { HistoryBooks } from "../components/HistoryBooks";
import { FullscreenDocument } from "../components/FullscreenDocument";

export const metadata: Metadata = { title: "History Books · King Prompter", description: "Browse the public archive of King Prompter matches, players, prompts, scores, and generated artwork." };
export default function HistoryBooksPage() { return <FullscreenDocument><HistoryBooks /></FullscreenDocument>; }
