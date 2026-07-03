import { useState } from "react";

/** A single shimmering placeholder block. Shape it entirely with `className`
 *  (height, width, rounding) so it sits exactly over whatever it stands in for. */
export function Shimmer({ className }: { className?: string }) {
  return <div className={`shimmer ${className ?? ""}`} />;
}

/** An <img> that shows a shimmer until it finishes loading. The parent controls
 *  aspect/rounding; the wrapper `className` sizes it (e.g. "h-full w-full"). */
export function ShimmerImg({
  src,
  alt,
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`}>
      {!loaded && <Shimmer className="absolute inset-0" />}
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        // onLoad misses already-cached images, so also flip on mount if complete.
        ref={(el) => { if (el?.complete) setLoaded(true); }}
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}

/** Shimmering placeholder rows — shown while a first data load is in flight to
 *  avoid flashing an empty state. */
export default function Skeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Shimmer key={i} className="h-16 rounded-2xl border border-white/10" />
      ))}
    </div>
  );
}
