import { flagCode } from "../lib/flags";

interface Props {
  /** Team name as it comes from TxLINE (e.g. "Argentina", "England"). */
  name: string;
  /** Tailwind text-size class controls the flag size (flag width scales with font-size). */
  className?: string;
}

/** Real SVG country flag via flag-icons. Falls back to ⚽ for unknown teams. */
export default function Flag({ name, className = "" }: Props) {
  const code = flagCode(name);
  if (!code) return <span className={className}>⚽</span>;
  return (
    <span
      className={`fi fi-${code} rounded-[3px] shadow-sm ${className}`}
      role="img"
      aria-label={name}
    />
  );
}
