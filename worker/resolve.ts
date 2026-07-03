// Settlement engine: auto-creates and auto-resolves prediction markets.
//   npm run txline:resolve            (one cycle)
//   npm run txline:resolve -- --watch (poll continuously)
//
// 1. Ensures every match has its two markets (winner, total_goals) — the
//    "Full-Tournament Auto-Market" across all 104 fixtures.
// 2. For finished matches with open markets: re-fetches the TxLINE score
//    snapshot, folds it, stores the folded receipt as `proof` (fixture, seq,
//    ts, score, endpoint) and settles predictions deterministically.
//
// Run alongside `npm run txline:ingest -- --watch` (ingest keeps matches live;
// resolve settles from the same feed with its own verifiable receipt).
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { NETWORKS, type Network } from "../src/lib/txlineConfig.ts";
import { foldSnapshot, isFinished, type ScoresEvent, type SoccerScore } from "../src/lib/txline.ts";
import { WINNER_POINTS, TOTAL_GOALS_POINTS, TOTAL_GOALS_LINE, type MarketKind } from "../src/lib/types.ts";

const network = (process.env.TXLINE_NETWORK as Network) || "mainnet";
const apiToken = process.env.TXLINE_API_TOKEN;
const supaUrl = process.env.SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = NETWORKS[network].txlineBase;
const POLL_MS = 30000;
const WATCH = process.argv.includes("--watch");

if (!apiToken || !supaUrl || !supaKey) {
  throw new Error("Missing TXLINE_API_TOKEN / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
}
const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

async function fetchRetry(url: string, init: RequestInit, tries = 4): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}
const h = (jwt: string) => ({ Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken! });
const guest = async () =>
  (await (await fetchRetry(`${base}/auth/guest/start`, { method: "POST" })).json()).token as string;

const KINDS: MarketKind[] = ["winner", "total_goals"];

/** Create missing markets for every known fixture (idempotent via unique(fixture_id, kind)). */
async function createMarkets() {
  const { data: matches, error } = await supabase.from("matches").select("fixture_id");
  if (error) throw new Error(`select matches: ${error.message}`);
  const rows = (matches ?? []).flatMap((m) => KINDS.map((kind) => ({ fixture_id: m.fixture_id, kind })));
  if (!rows.length) return;
  const { error: e2 } = await supabase
    .from("markets")
    .upsert(rows, { onConflict: "fixture_id,kind", ignoreDuplicates: true });
  if (e2) throw new Error(`upsert markets: ${e2.message}`);
}

/** Deterministic outcome per market kind from the folded TxLINE score. */
function computeOutcome(kind: MarketKind, score: SoccerScore): string {
  const p1 = score.Participant1?.Total?.Goals ?? 0;
  const p2 = score.Participant2?.Total?.Goals ?? 0;
  if (kind === "total_goals") return p1 + p2 > TOTAL_GOALS_LINE ? "over" : "under";
  // winner — Total goals include extra time; a knockout decided on penalties
  // still reads as a tie in Total, so break it with the PE (shootout) period.
  if (p1 !== p2) return p1 > p2 ? "home" : "away";
  const pe1 = score.Participant1?.PE?.Goals ?? 0;
  const pe2 = score.Participant2?.PE?.Goals ?? 0;
  if (pe1 !== pe2) return pe1 > pe2 ? "home" : "away";
  return "draw";
}

const REWARD: Record<MarketKind, number> = {
  winner: WINNER_POINTS,
  total_goals: TOTAL_GOALS_POINTS,
};
// ponytail: fixed rewards — pari-mutuel split (100 pts shared among correct pickers)
// is the upgrade path if we want market-like payouts.

async function resolveMarkets(jwt: string) {
  const { data: open, error } = await supabase
    .from("markets")
    .select("id, fixture_id, kind, matches!inner(game_state, home_team, away_team)")
    .eq("status", "open");
  if (error) throw new Error(`select open markets: ${error.message}`);

  // Group by fixture so one snapshot fetch serves both markets.
  const byFixture = new Map<number, typeof open>();
  for (const mk of open ?? []) {
    const match = mk.matches as unknown as { game_state: number };
    if (!isFinished(match.game_state)) continue;
    const list = byFixture.get(mk.fixture_id) ?? [];
    list.push(mk);
    byFixture.set(mk.fixture_id, list);
  }

  let resolved = 0;
  for (const [fixtureId, mks] of byFixture) {
    const endpoint = `${base}/api/scores/snapshot/${fixtureId}`;
    let snaps: ScoresEvent[];
    try {
      const res = await fetchRetry(endpoint, { headers: h(jwt) });
      if (!res.ok) {
        console.warn(`  ⚠️  fixture ${fixtureId}: HTTP ${res.status}`);
        continue;
      }
      snaps = await res.json();
    } catch (e) {
      console.warn(`  ⚠️  fixture ${fixtureId}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const { gs, score, ts } = foldSnapshot(snaps, 1);
    if (!isFinished(gs) || !score) continue; // snapshot must independently confirm

    // The verifiable receipt: exactly what TxLINE returned and how we read it.
    const proof = {
      source: "txline",
      endpoint,
      fixture_id: fixtureId,
      game_state: gs,
      score_ts: ts,
      score,
      fetched_at: new Date().toISOString(),
    };

    for (const mk of mks!) {
      const outcome = computeOutcome(mk.kind as MarketKind, score);
      const { error: e1 } = await supabase
        .from("markets")
        .update({ status: "resolved", outcome, proof, resolved_at: new Date().toISOString() })
        .eq("id", mk.id)
        .eq("status", "open"); // idempotent: never re-resolve
      if (e1) {
        console.warn(`  ⚠️  market ${mk.id}: ${e1.message}`);
        continue;
      }
      // Settle predictions: winners get the reward, losers get 0.
      await supabase.from("predictions").update({ points_won: REWARD[mk.kind as MarketKind] })
        .eq("market_id", mk.id).eq("pick", outcome);
      await supabase.from("predictions").update({ points_won: 0 })
        .eq("market_id", mk.id).neq("pick", outcome);
      resolved++;
      const match = mk.matches as unknown as { home_team: string; away_team: string };
      console.log(`  ✅ ${match.home_team} v ${match.away_team} · ${mk.kind} → ${outcome}`);
    }
  }
  console.log(`Open markets checked · ${resolved} resolved.`);
}

async function cycle() {
  const jwt = await guest();
  await createMarkets();
  await resolveMarkets(jwt);
}

async function main() {
  console.log(`\n=== GolMarket resolve (${network}) ===`);
  await cycle();
  if (WATCH) {
    console.log(`\nWatching every ${POLL_MS / 1000}s (Ctrl+C to stop)…`);
    while (true) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      try {
        await cycle();
      } catch (e) {
        console.error("cycle error:", e instanceof Error ? e.message : e);
      }
    }
  }
}

main().catch((e: unknown) => {
  console.error("FATAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
