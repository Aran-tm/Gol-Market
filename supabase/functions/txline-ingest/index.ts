// Edge Function twin of worker/ingest.ts, run on a schedule via Supabase Cron
// (pg_cron + pg_net) instead of a local `--watch` loop. One cycle per invocation.
//
// Deploy:  supabase functions deploy txline-ingest
// Secrets: supabase secrets set TXLINE_API_TOKEN=... TXLINE_NETWORK=mainnet
//
// deno-lint-ignore-file
// @ts-nocheck — this file runs on Deno (Supabase Edge), not in the app's Node/TS build.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { NETWORKS } from "../_shared/txlineConfig.ts";
import { foldSnapshot, isFinished } from "../_shared/txline.ts";
import { fetchRetry, isServiceRoleRequest } from "../_shared/http.ts";

const COMP = 72; // World Cup
const HORIZON_MS = 3 * 60 * 60 * 1000; // don't poll fixtures kicking off >3h from now

const h = (jwt: string, apiToken: string) => ({ Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken });
const guest = async (base: string) =>
  (await (await fetchRetry(`${base}/auth/guest/start`, { method: "POST" })).json()).token as string;

async function syncFixtures(supabase: ReturnType<typeof createClient>, base: string, jwt: string, apiToken: string) {
  const fixtures = await (
    await fetchRetry(`${base}/api/fixtures/snapshot?competitionId=${COMP}`, { headers: h(jwt, apiToken) })
  ).json();
  const rows = fixtures.map((f: Record<string, unknown>) => ({
    fixture_id: f.FixtureId,
    competition_id: f.CompetitionId,
    competition: f.Competition,
    home_team_id: f.Participant1Id,
    home_team: f.Participant1,
    away_team_id: f.Participant2Id,
    away_team: f.Participant2,
    kickoff: new Date(f.StartTime as number).toISOString(),
  }));
  if (!rows.length) return 0;
  const { error } = await supabase.from("matches").upsert(rows, { onConflict: "fixture_id" });
  if (error) throw new Error(`upsert matches: ${error.message}`);
  return rows.length;
}

async function pollScores(supabase: ReturnType<typeof createClient>, base: string, jwt: string, apiToken: string) {
  const { data: matches, error } = await supabase.from("matches").select("*");
  if (error) throw new Error(`select matches: ${error.message}`);

  let live = 0, updated = 0, failed = 0, skipped = 0;
  const now = Date.now();
  for (const m of matches ?? []) {
    if (isFinished(m.game_state)) continue;
    if (m.game_state === 1 && m.kickoff && new Date(m.kickoff).getTime() - now > HORIZON_MS) {
      skipped++;
      continue;
    }
    let snaps;
    try {
      const res = await fetchRetry(`${base}/api/scores/snapshot/${m.fixture_id}`, { headers: h(jwt, apiToken) });
      if (!res.ok) { failed++; continue; }
      snaps = await res.json();
    } catch {
      failed++;
      continue;
    }
    if (!snaps?.length) { skipped++; continue; }

    const { gs, score, ts } = foldSnapshot(snaps, m.game_state);
    const p1 = score?.Participant1?.Total;
    const p2 = score?.Participant2?.Total;
    const hg = score ? p1?.Goals ?? 0 : m.home_goals ?? 0;
    const ag = score ? p2?.Goals ?? 0 : m.away_goals ?? 0;
    if (gs === 2 || gs === 4) live++;

    const events: Record<string, unknown>[] = [];
    for (let n = (m.home_goals ?? 0) + 1; n <= hg; n++)
      events.push({ fixture_id: m.fixture_id, team_id: m.home_team_id, type: "goal", seq: n, minute: ts, payload: { team: m.home_team } });
    for (let n = (m.away_goals ?? 0) + 1; n <= ag; n++)
      events.push({ fixture_id: m.fixture_id, team_id: m.away_team_id, type: "goal", seq: n, minute: ts, payload: { team: m.away_team } });
    if (events.length)
      await supabase.from("match_events").upsert(events, { onConflict: "fixture_id,seq,type,team_id", ignoreDuplicates: true });

    const hc = score ? p1?.Corners ?? 0 : m.home_corners ?? 0;
    const ac = score ? p2?.Corners ?? 0 : m.away_corners ?? 0;
    const hy = score ? p1?.YellowCards ?? 0 : m.home_yellows ?? 0;
    const ay = score ? p2?.YellowCards ?? 0 : m.away_yellows ?? 0;
    const hr = score ? p1?.RedCards ?? 0 : m.home_reds ?? 0;
    const ar = score ? p2?.RedCards ?? 0 : m.away_reds ?? 0;

    const statsChanged = hc !== m.home_corners || ac !== m.away_corners || hy !== m.home_yellows || ay !== m.away_yellows || hr !== m.home_reds || ar !== m.away_reds;

    if (gs !== m.game_state || hg !== m.home_goals || ag !== m.away_goals || statsChanged) {
      await supabase.from("matches").update({
        game_state: gs, home_goals: hg, away_goals: ag,
        home_corners: hc, away_corners: ac,
        home_yellows: hy, away_yellows: ay,
        home_reds: hr, away_reds: ar,
        updated_at: new Date().toISOString(),
      }).eq("fixture_id", m.fixture_id);
      updated++;
    }
  }
  return { total: matches?.length ?? 0, live, updated, skipped, failed };
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
    const synced = await syncFixtures(supabase, base, jwt, apiToken);
    const polled = await pollScores(supabase, base, jwt, apiToken);
    return Response.json({ ok: true, synced, polled });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
