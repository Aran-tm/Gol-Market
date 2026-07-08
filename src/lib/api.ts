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
  avatar_url: string | null;
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

export interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
}

export async function loadProfile(wallet: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("wallet_address", wallet)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function updateDisplayName(wallet: string, signMessage: SignMessage, name: string): Promise<void> {
  await walletWrite(wallet, signMessage, "update_display_name", { display_name: name });
}

export async function updateAvatar(wallet: string, signMessage: SignMessage, url: string | null): Promise<void> {
  await walletWrite(wallet, signMessage, "update_avatar", { avatar_url: url });
}

/** Uploads `file` to the wallet's avatar slot via a signed URL, returns the public URL. */
export async function uploadAvatarImage(wallet: string, signMessage: SignMessage, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const { path, token } = await walletWrite<{ path: string; token: string }>(
    wallet,
    signMessage,
    "get_avatar_upload_url",
    { ext },
  );
  const { error } = await supabase.storage.from("avatars").uploadToSignedUrl(path, token, file);
  if (error) throw error;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export interface ResolutionRow extends MarketRow {
  matches: { home_team: string; away_team: string };
}

/** Recently-settled markets across all fixtures, newest first — the "verifiable feed". */
export async function loadResolutions(limit = 20): Promise<ResolutionRow[]> {
  const { data, error } = await supabase
    .from("markets")
    .select("*, matches(home_team, away_team)")
    .eq("status", "resolved")
    .order("resolved_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ResolutionRow[];
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
