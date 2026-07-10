// Reset a replayed fixture back to "upcoming" (Not Started, 0-0, no events),
// leaving the demo state clean and repeatable.
//
//   npx tsx worker/reset.ts 18218149     (fixture_id required)
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import { createClient } from "@supabase/supabase-js";

const supaUrl = process.env.SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supaUrl || !supaKey) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
}
const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

const fixtureId = Number(process.argv[2]);
if (!fixtureId) {
  console.error("Usage: npx tsx worker/reset.ts <fixture_id>   e.g. 18218149 (Spain v Belgium)");
  process.exit(1);
}

async function main() {
  const { data: match } = await supabase
    .from("matches").select("home_team, away_team").eq("fixture_id", fixtureId).maybeSingle();
  if (!match) throw new Error(`Fixture ${fixtureId} not found`);

  await supabase.from("match_events").delete().eq("fixture_id", fixtureId);
  const { error } = await supabase.from("matches").update({
    game_state: 1, home_goals: 0, away_goals: 0,
    home_corners: 0, away_corners: 0, home_yellows: 0, away_yellows: 0, home_reds: 0, away_reds: 0,
    updated_at: new Date().toISOString(),
  }).eq("fixture_id", fixtureId);
  if (error) throw new Error(error.message);

  console.log(`✅ ${match.home_team} v ${match.away_team} reset to upcoming (0-0, Not Started).`);
}

main().catch((e: unknown) => {
  console.error("RESET ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
