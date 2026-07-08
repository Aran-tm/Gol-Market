import { ShieldCheck, X } from "lucide-react";
import type { MarketRow } from "../lib/types";

export default function ProofModal({ market, onClose }: { market: MarketRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-white/10 bg-ink-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-grass" />
          <h3 className="font-bold">TxLINE resolution receipt</h3>
          <button onClick={onClose} className="ml-auto text-white/50 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-white/60">
          This market was resolved automatically from the TxLINE feed (data anchored on Solana).
          The raw receipt below is exactly what the settlement engine read — outcome{" "}
          <span className="font-semibold text-grass">{market.outcome}</span>.
        </p>
        <pre className="overflow-x-auto rounded-xl bg-ink-950 p-3 text-xs text-white/70">
          {JSON.stringify(market.proof, null, 2)}
        </pre>
      </div>
    </div>
  );
}
