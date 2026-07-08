import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { loadResolutions, type ResolutionRow } from "../lib/api";
import { TOTAL_GOALS_LINE, TOTAL_GOALS_POINTS, WINNER_POINTS } from "../lib/types";
import ProofModal from "../components/ProofModal";
import Skeleton from "../components/Skeleton";

const KIND_LABEL: Record<string, string> = {
  winner: `Match winner · ${WINNER_POINTS} pts`,
  total_goals: `Total goals (O/U ${TOTAL_GOALS_LINE}) · ${TOTAL_GOALS_POINTS} pts`,
};

export default function Resolutions() {
  const [rows, setRows] = useState<ResolutionRow[] | null>(null);
  const [proof, setProof] = useState<ResolutionRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadResolutions()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Resolutions</h1>
        <p className="mt-1 text-sm text-white/50">
          Every market settled automatically from the TxLINE feed — tap "Proof" to see the exact
          data receipt the settlement engine read.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
      )}

      {!rows ? (
        <Skeleton rows={5} />
      ) : rows.length === 0 ? (
        <p className="glass rounded-2xl p-4 text-center text-sm text-white/40">
          No markets have resolved yet — check back once a match finishes.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <div key={m.id} className="glass flex items-center gap-3 rounded-2xl p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {m.matches.home_team} vs {m.matches.away_team}
                </div>
                <div className="mt-0.5 text-xs text-white/50">{KIND_LABEL[m.kind] ?? m.kind}</div>
              </div>
              <span className="rounded-lg border border-grass/40 bg-grass/10 px-2.5 py-1 text-xs font-bold text-grass">
                {m.outcome}
              </span>
              <button
                onClick={() => setProof(m)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-grass hover:bg-grass/10"
                title="View the TxLINE resolution receipt"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Proof
              </button>
            </div>
          ))}
        </div>
      )}

      {proof && <ProofModal market={proof} onClose={() => setProof(null)} />}
    </div>
  );
}
