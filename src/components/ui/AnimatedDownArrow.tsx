import clsx from "clsx";
import { MoveDown } from "lucide-react";

type AnimatedDownArrowProps = {
  href: string;
  light?: boolean;
};

export function AnimatedDownArrow({
  href,
  light = false,
}: AnimatedDownArrowProps) {
  return (
    <a
      href={href}
      className={clsx(
        "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full p-2 sm:p-4 border animate-bounce cursor-pointer",
        {
          "border-black": light,
          "border-white": !light,
        }
      )}
    >
      <MoveDown
        className={clsx("size-4 sm:size-full", {
          "text-black": light,
          "text-white": !light,
        })}
      />
    </a>
  );
}
