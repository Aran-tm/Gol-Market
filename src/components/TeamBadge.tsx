import Flag from "./Flag";

interface Props {
  teamName: string;
  size?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1 rounded-md",
  md: "text-xs px-2 py-0.5 gap-1.5 rounded-lg",
  lg: "text-sm px-2.5 py-1 gap-1.5 rounded-lg",
};

const FLAG = { sm: "text-[11px]", md: "text-sm", lg: "text-base" };

export default function TeamBadge({ teamName, size = "md" }: Props) {
  return (
    <span className={`inline-flex items-center bg-white/[0.06] text-white/70 ${SIZE[size]}`}>
      <Flag name={teamName} className={FLAG[size]} /> {teamName}
    </span>
  );
}
