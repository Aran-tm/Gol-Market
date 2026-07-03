import { isLive, matchMinute } from "../lib/txline";
import { useNow } from "../lib/useNow";
import type { MatchRow } from "../lib/types";

/** Live-ticking match minute ("63'", "HT", "90+'"). Renders nothing when not live/HT. */
export default function MatchMinute({ match, className }: { match: MatchRow; className?: string }) {
  const ticking = isLive(match.game_state);
  const now = useNow(ticking);
  const label = matchMinute(match.kickoff, match.game_state, now);
  if (!label) return null;
  return <span className={className}>{label}</span>;
}
