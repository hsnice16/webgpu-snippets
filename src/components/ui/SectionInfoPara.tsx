type SectionInfoParaProps = {
  text: string;
  order?: number;
  light?: boolean;
};

export function SectionInfoPara({
  text,
  order = 1,
  light = false,
}: SectionInfoParaProps) {
  return (
    <p
      className={`absolute text-sm left-[4vw] px-2 py-1 rounded font-geist-mono ${
        order === 1 ? "top-4" : "top-12"
      } ${light ? "bg-white text-black" : "bg-black text-white"}`}
    >
      {text}
    </p>
  );
}
