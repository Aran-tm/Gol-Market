import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { loadResolutions, type ResolutionRow } from "../lib/api";
import { TOTAL_GOALS_LINE } from "../lib/types";
import Flag from "../components/Flag";
import ProofModal from "../components/ProofModal";
import Skeleton from "../components/Skeleton";

const KIND_LABEL: Record<string, string> = {
  winner: "Match winner",
  total_goals: `Total goals · O/U ${TOTAL_GOALS_LINE}`,
};

/** Turn a raw outcome code into a human-readable result. */
function outcomeLabel(m: ResolutionRow): string {
  if (m.kind === "winner") {
    if (m.outcome === "home") return m.matches.home_team;
    if (m.outcome === "away") return m.matches.away_team;
    return "Draw";
  }
  if (m.kind === "total_goals") {
    return m.outcome === "over" ? `Over ${TOTAL_GOALS_LINE}` : `Under ${TOTAL_GOALS_LINE}`;
  }
  return m.outcome ?? "—";
}

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
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-grass/30 bg-grass/10">
          <ShieldCheck className="h-5 w-5 text-grass" />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Resolutions</h1>
          <p className="text-xs leading-snug text-white/45">
            Settled automatically from TxLINE — tap Proof for the raw data receipt.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>
      )}

      {!rows ? (
        <Skeleton rows={5} />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-white/5 bg-ink-800/60 p-6 text-center text-sm text-white/40">
          No markets have resolved yet — check back once a match finishes.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <div
              key={m.id}
              className="space-y-2.5 rounded-2xl border border-white/10 bg-ink-800/70 p-3.5 shadow-card backdrop-blur-sm"
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Flag name={m.matches.home_team} className="shrink-0 text-base" />
                <span className="truncate">{m.matches.home_team}</span>
                <span className="shrink-0 px-0.5 text-white/30">v</span>
                <span className="truncate">{m.matches.away_team}</span>
                <Flag name={m.matches.away_team} className="shrink-0 text-base" />
              </div>
              <div className="flex items-center gap-2">
                <span className="mr-auto text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  {KIND_LABEL[m.kind] ?? m.kind}
                </span>
                <span className="rounded-lg border border-grass/40 bg-grass/10 px-2.5 py-1 text-xs font-bold text-grass">
                  {outcomeLabel(m)}
                </span>
                <button
                  onClick={() => setProof(m)}
                  className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs font-semibold text-grass transition hover:bg-grass/10"
                  title="View the TxLINE resolution receipt"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Proof
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {proof && <ProofModal market={proof} onClose={() => setProof(null)} />}
    </div>
  );
}
