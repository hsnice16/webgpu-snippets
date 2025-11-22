import clsx from "clsx";

type SectionInfoParaProps = {
  text: string;
  order?: number;
  light?: boolean;
  showDot?: boolean;
  className?: string;
  direction?: "left" | "right";
};

export function SectionInfoPara({
  text,
  showDot,
  className,
  order = 1,
  light = false,
  direction = "left",
}: SectionInfoParaProps) {
  return (
    <p
      className={clsx(
        "absolute text-sm px-2 py-1 rounded font-geist-mono flex items-center justify-center gap-2",
        {
          "top-4": order === 1,
          "top-12": order === 2,
          "bg-white text-black": light,
          "bg-black text-white": !light,
          "left-[4vw]": direction === "left",
          "left-[4vw] bottom-[18vw] top-auto right-auto sm:left-auto sm:bottom-auto sm:top-4 sm:right-[4vw]":
            direction === "right",
        },
        className
      )}
    >
      {showDot ? (
        <span className="w-[8px] h-[8px] bg-green-500 rounded-full" />
      ) : null}
      {text}
    </p>
  );
}
