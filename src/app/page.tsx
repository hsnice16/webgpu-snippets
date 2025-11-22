import {
  GrayScottReactionDiffusionCanvas,
  VercelLogoArcBallCanvas,
  VercelLogoCanvas,
} from "@/components";

export default function Home() {
  return (
    <main className="overflow-hidden">
      <VercelLogoCanvas />
      <GrayScottReactionDiffusionCanvas />
      <VercelLogoArcBallCanvas />
    </main>
  );
}
