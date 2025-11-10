import {
  GrayScottReactionDiffusionCanvas,
  VercelLogoCanvas,
} from "@/components";

export default function Home() {
  return (
    <main className="overflow-hidden">
      <VercelLogoCanvas />
      <GrayScottReactionDiffusionCanvas />
    </main>
  );
}
