import type { Metadata } from "next";
import { GameStudio3D } from "@/components/studio3d/GameStudio3D";

export const metadata: Metadata = {
  title: "3D Studio",
  description: "Build, edit, run, and evolve PlayCanvas 3D scenes from one browser workspace.",
};

export default function Studio3DPage() {
  return <GameStudio3D />;
}
