import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Trophy } from "lucide-react";
import { cn } from "../lib/cn";
import { loadLeaderboard, type LeaderboardRow } from "../lib/api";
import Avatar from "../components/Avatar";
import { Spinner } from "../components/ui";

const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

// Medal tint for the top three ranks; plain for the rest.
const MEDAL: Record<number, string> = {
  1: "text-gold",
  2: "text-white/70",
  3: "text-[#cd7f32]",
};

export default function Leaderboard() {
  const { publicKey } = useWallet();
  const me = publicKey?.toBase58();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    loadLeaderboard().then(setRows).catch(() => setRows([]));
  }, []);

  if (!rows)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-white/40" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-gold/30 bg-gold/10">
          <Trophy className="h-5 w-5 text-gold" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Leaderboard</h1>
          <p className="text-xs text-white/45">Ranked by points from settled predictions</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-ink-800/60 p-6 text-center text-sm text-white/40">
          No settled predictions yet — make your picks in Markets.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => {
            const rank = i + 1;
            const isMe = r.wallet_address === me;
            return (
              <div
                key={r.wallet_address}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-ink-800/70 px-3.5 py-3 text-sm shadow-card backdrop-blur-sm transition",
                  isMe ? "border-gold/50 bg-gold/[0.06]" : "border-white/10",
                )}
              >
                <span className={cn("w-6 shrink-0 text-center text-base font-black tabular-nums", MEDAL[rank] ?? "text-white/35")}>
                  {rank}
                </span>
                <Avatar wallet={r.wallet_address} name={r.display_name} src={r.avatar_url} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{r.display_name || short(r.wallet_address)}</span>
                    {isMe && (
                      <span className="shrink-0 rounded-md bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gold">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/40">
                    {r.correct_predictions}/{r.total_predictions} correct
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-black tabular-nums text-grass">{r.total_points}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-white/35">pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
