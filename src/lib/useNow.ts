import { useEffect, useState } from "react";

/** Re-renders on an interval so time-derived UI (live match minute) stays current.
 *  Only ticks while `active` to avoid needless renders. */
export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
