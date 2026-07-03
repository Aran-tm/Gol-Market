// Data layer: reads via supabase-js (anon, RLS public-read), writes via the
// wallet-write edge function (signature-verified).
import { supabase } from "./supabase";
import { walletWrite, type SignMessage } from "./walletAuth";
import type { MarketRow, MatchRow, PredictionRow } from "./types";

export interface MatchWithMarkets extends MatchRow {
  kickoff: string | null;
  markets: MarketRow[];
}

export async function loadMatches(): Promise<MatchWithMarkets[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*, markets(*)")
    .order("kickoff", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MatchWithMarkets[];
}

/** My picks keyed by market_id. */
export async function loadMyPredictions(wallet: string): Promise<Record<string, PredictionRow>> {
  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .eq("wallet_address", wallet);
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as PredictionRow[]).map((p) => [p.market_id, p]));
}

export async function predict(
  wallet: string,
  signMessage: SignMessage,
  marketId: string,
  pick: string,
): Promise<void> {
  await walletWrite(wallet, signMessage, "predict", { market_id: marketId, pick });
}

export interface LeaderboardRow {
  wallet_address: string;
  display_name: string | null;
  total_points: number;
  total_predictions: number;
  correct_predictions: number;
}

export async function loadLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total_points", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

/** Subscribe to live changes (scores + resolutions); returns unsubscribe. */
export function onLiveChanges(cb: () => void): () => void {
  const channel = supabase
    .channel("golmarket-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, cb)
    .on("postgres_changes", { event: "*", schema: "public", table: "markets" }, cb)
    .subscribe();
  return () => void supabase.removeChannel(channel);
}
