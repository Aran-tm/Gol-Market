import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Sparkles, Star, Target, Trophy, Upload, Trash2, X } from "lucide-react";
import {
  loadProfile,
  updateDisplayName,
  updateAvatar,
  uploadAvatarImage,
  loadLeaderboard,
  loadMatches,
  loadMyPredictions,
  type MatchWithMarkets,
} from "../lib/api";
import type { PredictionRow } from "../lib/types";
import { fetchNfts, hasNftRpc, CURATED_NFTS, type NftItem } from "../lib/nft";
import { cn } from "../lib/cn";
import Avatar from "../components/Avatar";
import Skeleton, { Shimmer, ShimmerImg } from "../components/Skeleton";
import { Spinner } from "../components/ui";

const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

export default function Profile() {
  const { publicKey, disconnect, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const wallet = publicKey?.toBase58() ?? null;

  const [displayName, setDisplayName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [pageError, setPageError] = useState("");

  // Avatar picker
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [myNfts, setMyNfts] = useState<NftItem[] | null>(null);
  const [nftsLoading, setNftsLoading] = useState(false);

  const [stats, setStats] = useState({ points: 0, total: 0, correct: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [recent, setRecent] = useState<{ match: MatchWithMarkets; pick: PredictionRow }[]>([]);

  useEffect(() => {
    if (!wallet) {
      setProfileLoaded(true);
      return;
    }
    loadProfile(wallet)
      .then((p) => {
        setDisplayName(p?.display_name ?? "");
        setAvatarUrl(p?.avatar_url ?? null);
      })
      .catch((e) => setPageError(e instanceof Error ? e.message : String(e)))
      .finally(() => setProfileLoaded(true));
  }, [wallet]);

  const loadStats = useCallback(async () => {
    if (!wallet) return;
    try {
      const [board, matches, mine] = await Promise.all([
        loadLeaderboard(),
        loadMatches(),
        loadMyPredictions(wallet),
      ]);
      const row = board.find((r) => r.wallet_address === wallet);
      setStats({
        points: row?.total_points ?? 0,
        total: row?.total_predictions ?? 0,
        correct: row?.correct_predictions ?? 0,
      });
      const list = Object.values(mine)
        .map((pick) => {
          const match = matches.find((m) => m.markets.some((mk) => mk.id === pick.market_id));
          return match ? { match, pick } : null;
        })
        .filter((x): x is { match: MatchWithMarkets; pick: PredictionRow } => !!x)
        .sort((a, b) => new Date(b.match.kickoff ?? 0).getTime() - new Date(a.match.kickoff ?? 0).getTime());
      setRecent(list);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatsLoaded(true);
    }
  }, [wallet]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  function openPicker() {
    setPicking(true);
    if (wallet && hasNftRpc() && myNfts === null) {
      setNftsLoading(true);
      fetchNfts(wallet)
        .then(setMyNfts)
        .catch(() => setMyNfts([]))
        .finally(() => setNftsLoading(false));
    }
  }

  async function chooseAvatar(url: string | null) {
    if (!wallet) return;
    const previous = avatarUrl;
    setAvatarUrl(url);
    setPicking(false);
    try {
      await updateAvatar(wallet, signMessage, url);
    } catch (e) {
      setAvatarUrl(previous);
      setPageError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file || !wallet) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image must be under 5MB.");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const url = await uploadAvatarImage(wallet, signMessage, file);
      await chooseAvatar(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveName() {
    if (!wallet) return;
    setSaving(true);
    try {
      await updateDisplayName(wallet, signMessage, displayName.trim());
      setEditing(false);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!wallet) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="text-sm text-white/60">Connect your wallet to see your profile.</p>
          <button onClick={() => setVisible(true)} className="btn-primary mt-4">
            Connect wallet
          </button>
        </div>
      </div>
    );
  }

  const nftGrid = [...(myNfts ?? []), ...CURATED_NFTS];

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-2xl font-bold">Profile</h1>

      {pageError && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{pageError}</p>
      )}

      {/* Identity */}
      <section className="glass rounded-3xl p-5">
        <div className="flex items-center gap-4">
          {!profileLoaded ? (
            <>
              <Shimmer className="h-14 w-14 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Shimmer className="h-5 w-32 rounded" />
                <Shimmer className="h-3 w-24 rounded" />
              </div>
            </>
          ) : (
            <>
              <button onClick={openPicker} className="relative shrink-0 transition hover:brightness-110" title="Choose an avatar">
                {/* key on avatarUrl → a freshly uploaded photo re-shimmers until it loads */}
                <Avatar key={avatarUrl ?? "gen"} wallet={wallet} name={displayName} src={avatarUrl} size={56} className="!rounded-2xl" />
                <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-ink-900 bg-grass text-ink-950">
                  <Sparkles className="h-3 w-3" />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display name"
                      aria-label="Display name"
                      className="field flex-1 !py-2"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setEditing(false);
                      }}
                    />
                    <button onClick={handleSaveName} disabled={saving} className="btn-ghost flex items-center !px-3 !py-2 text-xs">
                      {saving ? <Spinner className="h-3.5 w-3.5" /> : "Save"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="font-bold">{displayName || "Anonymous Predictor"}</div>
                    <button onClick={() => setEditing(true)} className="mt-0.5 text-xs text-white/40 transition hover:text-grass">
                      Set display name
                    </button>
                  </>
                )}
                <div className="mt-1 font-mono text-[10px] text-white/40">{short(wallet)}</div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Stats */}
      {!statsLoaded ? (
        <Skeleton rows={1} className="[&>div]:h-[88px]" />
      ) : (
        <section className="grid grid-cols-3 gap-3">
          {[
            { icon: Star, label: "Points", value: stats.points },
            { icon: Target, label: "Predictions", value: stats.total },
            { icon: Trophy, label: "Correct", value: stats.correct },
          ].map((s) => (
            <div key={s.label} className="glass flex flex-col items-center gap-1 rounded-2xl px-2 py-4">
              <s.icon className="h-4 w-4 text-grass" />
              <span className="text-xl font-black text-gold">{s.value}</span>
              <span className="text-[10px] uppercase tracking-wide text-white/50">{s.label}</span>
            </div>
          ))}
        </section>
      )}

      {/* Recent predictions */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/35">Your predictions</h2>
        {!statsLoaded ? (
          <Skeleton rows={3} />
        ) : recent.length === 0 ? (
          <p className="glass rounded-2xl p-4 text-center text-sm text-white/40">
            No predictions yet — make your picks in Markets.
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map(({ match, pick }) => {
              const market = match.markets.find((mk) => mk.id === pick.market_id);
              const resolved = market?.status === "resolved";
              return (
                <div key={pick.market_id} className="glass flex items-center gap-3 rounded-2xl p-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {match.home_team} vs {match.away_team}
                  </span>
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold text-white/70">{pick.pick}</span>
                  {resolved && (
                    <span className={cn("text-xs font-bold", pick.points_won ? "text-grass" : "text-white/40")}>
                      {pick.points_won ? `+${pick.points_won}` : "0"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <button
        onClick={() => disconnect()}
        className="flex w-full items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4 text-left transition hover:border-red-500/50"
      >
        <LogOut className="h-5 w-5 text-red-400" />
        <span className="text-sm font-semibold text-red-300">Disconnect wallet</span>
      </button>

      {/* Avatar picker */}
      <AnimatePresence>
        {picking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPicking(false)}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-950/80 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold">Choose your avatar</h3>
                <button onClick={() => setPicking(false)} className="text-white/50 hover:text-white" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 flex gap-2">
                <label className="btn-ghost flex flex-1 items-center justify-center gap-2 !py-2 text-xs">
                  {uploading ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : "Upload photo"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
                </label>
                {avatarUrl && (
                  <button onClick={() => chooseAvatar(null)} className="btn-ghost flex items-center justify-center gap-2 !py-2 text-xs text-red-300">
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>
              {uploadError && (
                <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3 text-xs text-red-300">{uploadError}</p>
              )}

              <p className="mb-3 mt-2 text-xs font-semibold text-white/40">
                {nftsLoading ? "Loading your NFTs…" : myNfts && myNfts.length > 0 ? "Your NFTs" : "Pick a collectible"}
              </p>
              <div className="grid grid-cols-3 gap-3">
                {nftGrid.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => chooseAvatar(n.image)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-2xl border-2 transition hover:brightness-110",
                      avatarUrl === n.image ? "border-grass" : "border-white/10",
                    )}
                    title={n.name}
                  >
                    <ShimmerImg src={n.image} alt={n.name} className="h-full w-full" />
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
