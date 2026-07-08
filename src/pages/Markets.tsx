import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ShieldCheck } from "lucide-react";
import { cn } from "../lib/cn";
import { GAME_STATE, isFinished, isLive, isStale } from "../lib/txline";
import { loadMatches, loadMyPredictions, onLiveChanges, predict, type MatchWithMarkets } from "../lib/api";
import type { MarketRow, PredictionRow } from "../lib/types";
import { TOTAL_GOALS_LINE, TOTAL_GOALS_POINTS, WINNER_POINTS } from "../lib/types";
import Flag from "../components/Flag";
import MatchMinute from "../components/MatchMinute";
import { LiveBadge, Spinner } from "../components/ui";
import ProofModal from "../components/ProofModal";

const PICKS: Record<string, { value: string; label: string }[]> = {
  winner: [
    { value: "home", label: "1" },
    { value: "draw", label: "X" },
    { value: "away", label: "2" },
  ],
  total_goals: [
    { value: "over", label: `Over ${TOTAL_GOALS_LINE}` },
    { value: "under", label: `Under ${TOTAL_GOALS_LINE}` },
  ],
};
const KIND_LABEL: Record<string, string> = {
  winner: `Match winner · ${WINNER_POINTS} pts`,
  total_goals: `Total goals · ${TOTAL_GOALS_POINTS} pts`,
};

type Filter = "all" | "live" | "upcoming" | "finished";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

function MarketRowView({
  market,
  locked,
  mine,
  onPick,
  onProof,
}: {
  market: MarketRow;
  locked: boolean;
  mine?: PredictionRow;
  onPick: (market: MarketRow, pick: string) => void;
  onProof: (market: MarketRow) => void;
}) {
  const resolved = market.status === "resolved";
  return (
    <div className="flex items-center gap-2 border-t border-white/5 py-2">
      <span className="w-40 shrink-0 text-xs text-white/50">{KIND_LABEL[market.kind]}</span>
      <div className="flex flex-1 gap-1.5">
        {PICKS[market.kind].map(({ value, label }) => {
          const picked = mine?.pick === value;
          const winner = resolved && market.outcome === value;
          return (
            <button
              key={value}
              disabled={locked || resolved}
              onClick={() => onPick(market, value)}
              className={cn(
                "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition",
                winner
                  ? "border-grass bg-grass/15 text-grass"
                  : picked
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-white/10 bg-white/5 text-white/70",
                !locked && !resolved && "hover:border-white/30 hover:text-white",
                (locked || resolved) && !picked && !winner && "opacity-40",
              )}
            >
              {label}
              {picked && (resolved ? (mine!.points_won ? ` · +${mine!.points_won}` : " · 0") : " · you")}
            </button>
          );
        })}
      </div>
      {resolved && (
        <button
          onClick={() => onProof(market)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-grass hover:bg-grass/10"
          title="View the TxLINE resolution receipt"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Proof
        </button>
      )}
    </div>
  );
}

export default function Markets() {
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const wallet = publicKey?.toBase58() ?? null;

  const [matches, setMatches] = useState<MatchWithMarkets[] | null>(null);
  const [mine, setMine] = useState<Record<string, PredictionRow>>({});
  const [proof, setProof] = useState<MarketRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(() => {
    loadMatches().then(setMatches).catch((e) => setError(e.message));
    if (wallet) loadMyPredictions(wallet).then(setMine).catch(() => {});
  }, [wallet]);

  useEffect(() => {
    refresh();
    return onLiveChanges(refresh);
  }, [refresh]);

  const onPick = async (market: MarketRow, pick: string) => {
    if (!wallet) return setVisible(true);
    // Optimistic: show the pick immediately, roll back on error.
    const prev = mine[market.id];
    setMine((m) => ({ ...m, [market.id]: { market_id: market.id, wallet_address: wallet, pick, points_won: null } }));
    try {
      await predict(wallet, signMessage, market.id, pick);
    } catch (e) {
      setMine((m) => {
        const next = { ...m };
        if (prev) next[market.id] = prev;
        else delete next[market.id];
        return next;
      });
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}{" "}
        <button className="underline" onClick={() => { setError(null); refresh(); }}>
          Retry
        </button>
      </div>
    );
  if (!matches)
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-white/40" />
      </div>
    );

  const now = Date.now();
  const visible = matches.filter((m) => !isStale(m.kickoff, m.game_state, now));
  // Live first, then upcoming, then finished (newest first) — used for "all" and as the
  // stable order within each date group.
  const rank = (m: MatchWithMarkets) => (isLive(m.game_state) ? 0 : isFinished(m.game_state) ? 2 : 1);
  const sorted = [...visible].sort((a, b) =>
    rank(a) - rank(b) ||
    (rank(a) === 2
      ? new Date(b.kickoff ?? 0).getTime() - new Date(a.kickoff ?? 0).getTime()
      : new Date(a.kickoff ?? 0).getTime() - new Date(b.kickoff ?? 0).getTime()),
  );

  const counts = {
    live: visible.filter((m) => isLive(m.game_state)).length,
    finished: visible.filter((m) => isFinished(m.game_state)).length,
  };

  const filtered = sorted.filter((m) => {
    if (filter === "live") return isLive(m.game_state);
    if (filter === "upcoming") return m.game_state === 1;
    if (filter === "finished") return isFinished(m.game_state);
    return true;
  });

  // Group by matchday, keeping each group in the pre-sorted (live-first) order.
  const grouped = (() => {
    const map = new Map<string, MatchWithMarkets[]>();
    for (const m of filtered) {
      const key = m.kickoff
        ? new Date(m.kickoff).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
        : "TBD";
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return [...map.entries()];
  })();

  return (
    <div className="space-y-4">
      {!wallet && (
        <div className="rounded-2xl border border-white/10 bg-spotlight p-6 text-center">
          <h1 className="text-2xl font-bold">
            Predict every World Cup match. <span className="text-grass">Verifiably settled.</span>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/60">
            Markets create and resolve themselves from the TxLINE live feed — every result comes
            with the raw data receipt. Connect your Solana wallet to play.
          </p>
        </div>
      )}

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const badge = f.key === "live" ? counts.live : f.key === "finished" ? counts.finished : 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                active
                  ? "border-grass/60 bg-grass/15 text-grass"
                  : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80",
              )}
            >
              {f.label}
              {badge > 0 && (
                <span className={cn("rounded-full px-1.5 py-0 text-[10px] font-bold", active ? "bg-grass/30" : "bg-white/10")}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-2xl border border-white/5 bg-ink-800 p-4 text-center text-sm text-white/40">
          No {filter === "all" ? "" : filter} matches right now.
        </p>
      )}

      {grouped.map(([date, list]) => (
        <div key={date} className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50">{date}</h2>
          {list.map((m) => {
        const live = isLive(m.game_state);
        const done = isFinished(m.game_state);
        const locked = live || done || (!!m.kickoff && new Date(m.kickoff).getTime() <= now);
        return (
          <div
            key={m.fixture_id}
            className={cn("rounded-2xl border border-white/10 bg-ink-800 p-4", live && "animate-live-border")}
          >
            <div className="flex items-center gap-2 text-sm">
              <Flag name={m.home_team} className="text-lg" />
              <span className="font-semibold">{m.home_team}</span>
              <span className="mx-1 rounded-md bg-ink-950 px-2 py-0.5 font-bold tabular-nums">
                {locked ? `${m.home_goals} – ${m.away_goals}` : "vs"}
              </span>
              <span className="font-semibold">{m.away_team}</span>
              <Flag name={m.away_team} className="text-lg" />
              <span className="ml-auto flex items-center gap-2 text-xs text-white/50">
                {live && <LiveBadge />}
                <MatchMinute match={m} />
                {done
                  ? GAME_STATE[m.game_state] ?? "Finished"
                  : !live && m.kickoff
                    ? new Date(m.kickoff).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })
                    : null}
              </span>
            </div>
            <div className="mt-3">
              {[...m.markets]
                .sort((a, b) => a.kind.localeCompare(b.kind) * -1) // winner first
                .map((mk) => (
                  <MarketRowView
                    key={mk.id}
                    market={mk}
                    locked={locked}
                    mine={mine[mk.id]}
                    onPick={onPick}
                    onProof={setProof}
                  />
                ))}
              {m.markets.length === 0 && (
                <p className="border-t border-white/5 pt-2 text-xs text-white/40">
                  Markets open soon (created automatically by the settlement engine).
                </p>
              )}
            </div>
          </div>
            );
          })}
        </div>
      ))}
      {proof && <ProofModal market={proof} onClose={() => setProof(null)} />}
    </div>
  );
}
