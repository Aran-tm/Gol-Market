import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Clock, Gamepad2, ShieldCheck, Timer, Zap } from "lucide-react";
import { cn } from "../lib/cn";
import { isFinished, isLive, isStale } from "../lib/txline";
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
const KIND_TITLE: Record<string, string> = {
  winner: "Match winner",
  total_goals: "Total goals",
};
const KIND_POINTS: Record<string, number> = {
  winner: WINNER_POINTS,
  total_goals: TOTAL_GOALS_POINTS,
};

type Filter = "all" | "live" | "upcoming" | "finished";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

const kickoffTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "TBD";

/** Hero shown to signed-out visitors — sets the pitch for the whole app. */
function Hero() {
  const chips = [
    { icon: ShieldCheck, label: "TxLINE-verified" },
    { icon: Gamepad2, label: "Play-money" },
    { icon: Timer, label: "Instant settle" },
  ];
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-spotlight p-6 text-center sm:p-8">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-grass/50 to-transparent" />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-grass/30 bg-grass/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-grass">
        <Zap className="h-3 w-3" /> Auto-settled markets
      </span>
      <h1 className="mx-auto mt-4 max-w-xl text-[26px] font-extrabold leading-[1.15] tracking-tight sm:text-[34px]">
        Predict every World Cup match. <span className="text-gradient">Verifiably settled.</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60">
        Markets create and resolve themselves from the TxLINE live feed — every result ships with the
        raw data receipt. Connect your Solana wallet to play.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {chips.map((c) => (
          <span
            key={c.label}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/65"
          >
            <c.icon className="h-3 w-3 text-grass" /> {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** One market (winner / total goals) with its label row and full-width pick buttons. */
function MarketBlock({
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
  const picks = PICKS[market.kind];
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/40">
          {KIND_TITLE[market.kind]}
        </span>
        {resolved ? (
          <button
            onClick={() => onProof(market)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-grass transition hover:bg-grass/10"
            title="View the TxLINE resolution receipt"
          >
            <ShieldCheck className="h-3.5 w-3.5" /> Proof
          </button>
        ) : (
          <span className="text-[10.5px] font-bold tracking-wide text-gold/80">
            {KIND_POINTS[market.kind]} PTS
          </span>
        )}
      </div>
      <div className={cn("grid gap-1.5", picks.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {picks.map(({ value, label }) => {
          const picked = mine?.pick === value;
          const winner = resolved && market.outcome === value;
          return (
            <button
              key={value}
              disabled={locked || resolved}
              onClick={() => onPick(market, value)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border py-2.5 text-sm font-bold transition",
                winner
                  ? "border-grass bg-grass/15 text-grass shadow-[0_0_22px_-8px_rgba(34,197,94,0.7)]"
                  : picked
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-white/10 bg-white/[0.03] text-white/70",
                !locked && !resolved && "hover:border-white/25 hover:bg-white/[0.07] hover:text-white active:scale-[0.97]",
                (locked || resolved) && !picked && !winner && "opacity-40",
              )}
            >
              {label}
              {picked && resolved && (
                <span className="text-[11px] font-semibold opacity-80">
                  {mine!.points_won ? `+${mine!.points_won}` : "0"}
                </span>
              )}
              {picked && !resolved && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_8px_rgba(255,209,102,0.9)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A single match: status strip, symmetric teams row, and its markets. */
function MatchCard({
  m,
  now,
  mine,
  onPick,
  onProof,
}: {
  m: MatchWithMarkets;
  now: number;
  mine: Record<string, PredictionRow>;
  onPick: (market: MarketRow, pick: string) => void;
  onProof: (market: MarketRow) => void;
}) {
  const live = isLive(m.game_state);
  const done = isFinished(m.game_state);
  const locked = live || done || (!!m.kickoff && new Date(m.kickoff).getTime() <= now);
  const markets = [...m.markets].sort((a, b) => a.kind.localeCompare(b.kind) * -1); // winner first

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-ink-800/70 shadow-card backdrop-blur-sm",
        live ? "border-red-500/25 animate-live-border" : "border-white/10",
      )}
    >
      {/* Status strip */}
      <div className="flex items-center justify-between px-4 pt-3">
        {live ? (
          <span className="flex items-center gap-2">
            <LiveBadge />
            <MatchMinute match={m} className="text-xs font-bold tabular-nums text-red-300" />
          </span>
        ) : done ? (
          <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" /> Full time
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-white/55">
            <Clock className="h-3 w-3" /> {kickoffTime(m.kickoff)}
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/25">World Cup</span>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pb-4 pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Flag name={m.home_team} className="shrink-0 text-[26px]" />
          <span className="truncate text-[15px] font-semibold">{m.home_team}</span>
        </div>
        <div className="px-1 text-center">
          {locked ? (
            <div className="flex items-baseline gap-1.5 text-2xl font-extrabold leading-none tabular-nums">
              <span>{m.home_goals}</span>
              <span className="text-white/25">–</span>
              <span>{m.away_goals}</span>
            </div>
          ) : (
            <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold tracking-[0.15em] text-white/40">
              VS
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2.5">
          <span className="truncate text-right text-[15px] font-semibold">{m.away_team}</span>
          <Flag name={m.away_team} className="shrink-0 text-[26px]" />
        </div>
      </div>

      {/* Markets */}
      <div className="space-y-3.5 border-t border-white/5 bg-black/25 px-4 py-3.5">
        {markets.length > 0 ? (
          markets.map((mk) => (
            <MarketBlock
              key={mk.id}
              market={mk}
              locked={locked}
              mine={mine[mk.id]}
              onPick={onPick}
              onProof={onProof}
            />
          ))
        ) : (
          <p className="py-1 text-center text-xs text-white/40">
            Markets open soon — created automatically by the settlement engine.
          </p>
        )}
      </div>
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
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
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
    <div className="space-y-5">
      {!wallet && <Hero />}

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const badge = f.key === "live" ? counts.live : f.key === "finished" ? counts.finished : 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition active:scale-95",
                active
                  ? "border-grass/50 bg-grass/15 text-grass shadow-[0_0_20px_-10px_rgba(34,197,94,0.8)]"
                  : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white/85",
              )}
            >
              {f.label}
              {badge > 0 && (
                <span
                  className={cn(
                    "min-w-[18px] rounded-full px-1 py-0 text-center text-[10px] font-bold tabular-nums",
                    active ? "bg-grass/30 text-grass" : "bg-white/10 text-white/60",
                    f.key === "live" && "bg-red-500/20 text-red-300",
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-2xl border border-white/5 bg-ink-800/60 p-6 text-center text-sm text-white/40">
          No {filter === "all" ? "" : filter} matches right now.
        </p>
      )}

      {grouped.map(([date, list]) => (
        <div key={date} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">{date}</h2>
            <span className="h-px flex-1 bg-white/[0.06]" />
          </div>
          {list.map((m) => (
            <MatchCard key={m.fixture_id} m={m} now={now} mine={mine} onPick={onPick} onProof={setProof} />
          ))}
        </div>
      ))}
      {proof && <ProofModal market={proof} onClose={() => setProof(null)} />}
    </div>
  );
}
