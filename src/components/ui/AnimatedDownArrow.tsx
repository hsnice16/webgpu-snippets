import { MoveDown } from "lucide-react";

export function AnimatedDownArrow() {
  return (
    <a
      href="#gray-scott-diffusion"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full p-4 border border-white animate-bounce cursor-pointer"
    >
      <MoveDown className="text-white" />
    </a>
  );
}
