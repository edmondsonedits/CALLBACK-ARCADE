import type { Metadata } from "next";
import { DrawingStudio } from "../components/drawing/DrawingStudio";

export const metadata: Metadata = { title: "Drawing Studio", description: "A simple, touch-friendly sketchbook. Draw, colour, undo, and save your idea." };
export default function DrawingStudioPage() { return <DrawingStudio />; }
