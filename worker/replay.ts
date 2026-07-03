// Replay worker: drive a REAL TxLINE fixture through a synthetic live progression
// (kickoff → goals → finished) written to Supabase, so the app looks live on demand.
//
// Why synthetic: TxLINE's World Cup feed currently exposes only upcoming fixtures
// (all "Not Started" 0-0) with no historical live data to replay via `asOf`. This
// simulates the progression using the real fixture + teams so the demo/video shows
// the live minute, floating +2, activity feed, leaderboard movement and champion.
//
// Usage — for flags use `npx tsx` directly (npm run swallows -- flags on Windows):
//   npm run txline:replay                (default: first upcoming fixture)
//   npx tsx worker/replay.ts 123456      (a specific fixture_id)
//   npx tsx worker/replay.ts 123456 --fast (compress to ~11s)
//
// GolMarket demo flow: replay a fixture with open markets, then run
// `npm run txline:resolve` — markets resolve and the proof receipt appears.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supaUrl = process.env.SUPABASE_URL;
const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supaUrl || !supaKey) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
}
const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

const argv = process.argv.slice(2);
const FAST = argv.includes("--fast");
const positional = argv.filter((a) => !a.startsWith("--"));
const fixtureArg = positional[0] ? Number(positional[0]) : null;
const STEP_MS = FAST ? 250 : 650; // real ms per 2 simulated minutes (~30s / ~11s total)
const MIN = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** kickoff timestamp (ISO) that makes the frontend's matchMinute() show `sm`. */
function kickoffFor(sm: number, state: number, now: number): string {
  // state 2 (1st half): elapsed = sm ; state 4 (2nd half): elapsed = sm + 15 (break)
  const elapsedMin = state === 4 ? sm + 15 : sm;
  return new Date(now - elapsedMin * MIN).toISOString();
}

function stateFor(sm: number): number {
  if (sm >= 90) return 5; // Finished
  if (sm >= 46) return 4; // Second Half
  if (sm === 45) return 3; // Halftime
  return 2; // First Half
}

// Randomised but sensible goal script.
function buildGoals(): { minute: number; side: "home" | "away" }[] {
  const count = 2 + Math.floor(Math.random() * 3); // 2..4 goals
  const goals: { minute: number; side: "home" | "away" }[] = [];
  for (let i = 0; i < count; i++) {
    goals.push({
      minute: 6 + Math.floor(Math.random() * 82), // 6'..87'
      side: Math.random() < 0.58 ? "home" : "away",
    });
  }
  return goals.sort((a, b) => a.minute - b.minute);
}

async function main() {
  // Pick the fixture to replay: explicit id > first upcoming.
  const targetId = fixtureArg;
  let query = supabase.from("matches").select("*");
  query = targetId
    ? query.eq("fixture_id", targetId)
    : query.order("kickoff", { ascending: true }).limit(1);
  const { data, error } = await query;
  if (error) throw new Error(`select match: ${error.message}`);
  const match = data?.[0];
  if (!match) throw new Error(targetId ? `Fixture ${targetId} not found` : "No matches in DB — run txline:ingest first");

  const goals = buildGoals();
  let hg = 0, ag = 0;
  goals.forEach((g) => (g.side === "home" ? hg++ : ag++));

  console.log(`\n=== Replay: ${match.home_team} v ${match.away_team} (fixture ${match.fixture_id}) ===`);
  console.log(`Final: ${hg}-${ag} · goals at ${goals.map((g) => `${g.minute}'${g.side[0]}`).join(", ")}\n`);

  // Reset the fixture and clear its prior goal events so the replay is clean/repeatable.
  await supabase.from("match_events").delete().eq("fixture_id", match.fixture_id);
  await supabase.from("matches").update({
    game_state: 1, home_goals: 0, away_goals: 0,
    home_corners: 0, away_corners: 0, home_yellows: 0, away_yellows: 0, home_reds: 0, away_reds: 0,
  }).eq("fixture_id", match.fixture_id);
  await sleep(800);

  let scored = 0, curHome = 0, curAway = 0, corners = 0, yellows = 0;
  const goalSeq = { home: 0, away: 0 };

  for (let sm = 1; sm <= 90; sm += 2) {
    const now = Date.now();
    const state = stateFor(sm);

    // Apply any goals reached by this minute.
    while (scored < goals.length && goals[scored].minute <= sm) {
      const g = goals[scored];
      if (g.side === "home") curHome++; else curAway++;
      const teamId = g.side === "home" ? match.home_team_id : match.away_team_id;
      const teamName = g.side === "home" ? match.home_team : match.away_team;
      goalSeq[g.side]++;
      await supabase.from("match_events").upsert(
        [{ fixture_id: match.fixture_id, team_id: teamId, type: "goal", seq: goalSeq[g.side], minute: g.minute, payload: { team: teamName } }],
        { onConflict: "fixture_id,seq,type,team_id", ignoreDuplicates: true },
      );
      console.log(`  ${g.minute}'  ⚽ ${teamName}  (${curHome}-${curAway})`);
      scored++;
    }

    // Drift stats up over the match (sm is always odd, so use probability).
    if (Math.random() < 0.32) corners++;
    if (Math.random() < 0.05) yellows++;

    await supabase.from("matches").update({
      game_state: state,
      home_goals: curHome,
      away_goals: curAway,
      home_corners: Math.ceil(corners * 0.6),
      away_corners: Math.floor(corners * 0.4),
      home_yellows: Math.ceil(yellows / 2),
      away_yellows: Math.floor(yellows / 2),
      kickoff: kickoffFor(sm, state, now),
      updated_at: new Date(now).toISOString(),
    }).eq("fixture_id", match.fixture_id);

    await sleep(STEP_MS);
  }

  // Full time.
  await supabase.from("matches").update({
    game_state: 5, home_goals: curHome, away_goals: curAway, updated_at: new Date().toISOString(),
  }).eq("fixture_id", match.fixture_id);
  console.log(`\n✅ Full time: ${match.home_team} ${curHome}-${curAway} ${match.away_team}\n`);
}

main().catch((e: unknown) => {
  console.error("REPLAY ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
