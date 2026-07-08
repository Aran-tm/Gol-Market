// Edge Function twin of worker/resolve.ts, run on a schedule via Supabase Cron
// (pg_cron + pg_net) instead of a local `--watch` loop. One cycle per invocation:
// ensures every match has its two markets, then settles any that finished.
//
// Deploy:  supabase functions deploy txline-resolve
// Secrets: supabase secrets set TXLINE_API_TOKEN=... TXLINE_NETWORK=mainnet
//
// deno-lint-ignore-file
// @ts-nocheck — this file runs on Deno (Supabase Edge), not in the app's Node/TS build.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { NETWORKS } from "../_shared/txlineConfig.ts";
import { foldSnapshot, isFinished } from "../_shared/txline.ts";
import { WINNER_POINTS, TOTAL_GOALS_POINTS, TOTAL_GOALS_LINE } from "../_shared/types.ts";
import { fetchRetry, isServiceRoleRequest } from "../_shared/http.ts";

const KINDS = ["winner", "total_goals"];
const REWARD: Record<string, number> = { winner: WINNER_POINTS, total_goals: TOTAL_GOALS_POINTS };

const h = (jwt: string, apiToken: string) => ({ Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken });
const guest = async (base: string) =>
  (await (await fetchRetry(`${base}/auth/guest/start`, { method: "POST" })).json()).token as string;

async function createMarkets(supabase: ReturnType<typeof createClient>) {
  const { data: matches, error } = await supabase.from("matches").select("fixture_id");
  if (error) throw new Error(`select matches: ${error.message}`);
  const rows = (matches ?? []).flatMap((m: { fixture_id: number }) => KINDS.map((kind) => ({ fixture_id: m.fixture_id, kind })));
  if (!rows.length) return;
  const { error: e2 } = await supabase.from("markets").upsert(rows, { onConflict: "fixture_id,kind", ignoreDuplicates: true });
  if (e2) throw new Error(`upsert markets: ${e2.message}`);
}

function computeOutcome(kind: string, score: Record<string, any>): string {
  const p1 = score.Participant1?.Total?.Goals ?? 0;
  const p2 = score.Participant2?.Total?.Goals ?? 0;
  if (kind === "total_goals") return p1 + p2 > TOTAL_GOALS_LINE ? "over" : "under";
  if (p1 !== p2) return p1 > p2 ? "home" : "away";
  const pe1 = score.Participant1?.PE?.Goals ?? 0;
  const pe2 = score.Participant2?.PE?.Goals ?? 0;
  if (pe1 !== pe2) return pe1 > pe2 ? "home" : "away";
  return "draw";
}

async function resolveMarkets(supabase: ReturnType<typeof createClient>, base: string, jwt: string, apiToken: string) {
  const { data: open, error } = await supabase
    .from("markets")
    .select("id, fixture_id, kind, matches!inner(game_state, home_team, away_team)")
    .eq("status", "open");
  if (error) throw new Error(`select open markets: ${error.message}`);

  const byFixture = new Map<number, typeof open>();
  for (const mk of open ?? []) {
    const match = mk.matches as { game_state: number };
    if (!isFinished(match.game_state)) continue;
    const list = byFixture.get(mk.fixture_id) ?? [];
    list.push(mk);
    byFixture.set(mk.fixture_id, list);
  }

  let resolved = 0;
  for (const [fixtureId, mks] of byFixture) {
    const endpoint = `${base}/api/scores/snapshot/${fixtureId}`;
    let snaps;
    try {
      const res = await fetchRetry(endpoint, { headers: h(jwt, apiToken) });
      if (!res.ok) continue;
      snaps = await res.json();
    } catch {
      continue;
    }
    const { gs, score, ts } = foldSnapshot(snaps, 1);
    if (!isFinished(gs) || !score) continue;

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
      const outcome = computeOutcome(mk.kind, score);
      const { error: e1 } = await supabase
        .from("markets")
        .update({ status: "resolved", outcome, proof, resolved_at: new Date().toISOString() })
        .eq("id", mk.id)
        .eq("status", "open");
      if (e1) continue;
      await supabase.from("predictions").update({ points_won: REWARD[mk.kind] }).eq("market_id", mk.id).eq("pick", outcome);
      await supabase.from("predictions").update({ points_won: 0 }).eq("market_id", mk.id).neq("pick", outcome);
      resolved++;
    }
  }
  return resolved;
}

Deno.serve(async (req) => {
  if (!isServiceRoleRequest(req)) return Response.json({ error: "forbidden" }, { status: 403 });

  const network = Deno.env.get("TXLINE_NETWORK") || "mainnet";
  const apiToken = Deno.env.get("TXLINE_API_TOKEN");
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiToken || !supaUrl || !supaKey) return Response.json({ error: "missing env" }, { status: 500 });

  const base = NETWORKS[network as "mainnet" | "devnet"].txlineBase;
  const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

  try {
    const jwt = await guest(base);
    await createMarkets(supabase);
    const resolved = await resolveMarkets(supabase, base, jwt, apiToken);
    return Response.json({ ok: true, resolved });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
