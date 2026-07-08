// Avatar: shows a chosen image (upload or NFT) when `src` is set, else a deterministic
// gradient (same wallet → same colors forever). Falls back to the gradient if the image fails.

import { useState } from "react";
import { Shimmer } from "./Skeleton";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Curated hues — skips the pink/magenta band (~280-345) that looked bad by chance.
const HUES = [6, 26, 46, 92, 130, 165, 188, 205, 225, 260];

/** First + last initial of a full name ("Armando Roberto Travieso" -> "AT"). */
function initials(name: string | undefined, wallet: string): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (wallet[0] ?? "?").toUpperCase();
}

interface Props {
  wallet: string;
  name?: string | null;
  size?: number;
  className?: string;
  /** Optional image (upload or NFT). Falls back to the gradient on load error. */
  src?: string | null;
}

export default function Avatar({ wallet, name, size = 36, className, src }: Props) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (src && !broken) {
    return (
      <span
        className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        {!loaded && <Shimmer className="absolute inset-0 rounded-full" />}
        <img
          src={src}
          alt={name ?? "avatar"}
          // onLoad misses already-cached images, so also flip on mount if complete.
          ref={(el) => { if (el?.complete) setLoaded(true); }}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          className="h-full w-full rounded-full object-cover"
        />
      </span>
    );
  }

  const h = hash(wallet);
  const hue1 = HUES[h % HUES.length];
  const hue2 = (hue1 + 40) % 360;
  const label = initials(name ?? undefined, wallet);
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full font-black text-ink-950 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * (label.length > 1 ? 0.34 : 0.42),
        backgroundImage: `linear-gradient(135deg, hsl(${hue1} 70% 58%), hsl(${hue2} 75% 48%))`,
      }}
    >
      {label}
    </span>
  );
}
