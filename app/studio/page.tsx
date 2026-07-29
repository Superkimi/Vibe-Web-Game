import type { Metadata } from "next";
import { GameStudio } from "@/components/studio/GameStudio";

export const metadata: Metadata = {
  title: "Studio | Vibe Web Game",
  description: "Build, edit, run, and evolve Phaser games from one browser workspace.",
};

export default function StudioPage() {
  return <GameStudio />;
}

