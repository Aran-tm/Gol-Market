import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Trophy } from "lucide-react";
import { cn } from "../lib/cn";
import { loadLeaderboard, type LeaderboardRow } from "../lib/api";
import { Spinner } from "../components/ui";

const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

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
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold">
        <Trophy className="h-5 w-5 text-gold" /> Leaderboard
      </h1>
      {rows.length === 0 && (
        <p className="text-sm text-white/50">No settled predictions yet — make your picks in Markets.</p>
      )}
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={r.wallet_address}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-white/5 bg-ink-800 px-4 py-2.5 text-sm",
              r.wallet_address === me && "border-gold/40",
            )}
          >
            <span className="w-6 text-right font-bold text-white/40">{i + 1}</span>
            <span className="font-semibold">
              {r.display_name || short(r.wallet_address)}
              {r.wallet_address === me && <span className="ml-2 text-xs text-gold">you</span>}
            </span>
            <span className="ml-auto text-xs text-white/40">
              {r.correct_predictions}/{r.total_predictions} correct
            </span>
            <span className="w-16 text-right font-bold tabular-nums text-grass">{r.total_points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
