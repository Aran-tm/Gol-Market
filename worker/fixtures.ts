// Fetch + summarize TxLINE fixtures (discovers World Cup competitionId + matches).
//   npm run txline:fixtures
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { NETWORKS, type Network } from "../src/lib/txlineConfig.ts";
import { startGuestSession, getFixtures, type Fixture } from "../src/lib/txline.ts";

const network = (process.env.TXLINE_NETWORK as Network) || "mainnet";
const apiToken = process.env.TXLINE_API_TOKEN;

async function main() {
  if (!apiToken) {
    throw new Error("Missing TXLINE_API_TOKEN in .env.local (run the in-app Setup first).");
  }
  const base = NETWORKS[network].txlineBase;
  console.log(`\n=== TxLINE fixtures (${network}) ===`);

  const jwt = await startGuestSession(base);
  const fixtures = await getFixtures({ jwt, apiToken }, {}, base);
  console.log(`Total fixtures: ${fixtures.length}\n`);

  // Group by competition to find the World Cup id.
  const byComp = new Map<number, { name: string; count: number }>();
  for (const f of fixtures) {
    const e = byComp.get(f.CompetitionId) ?? { name: f.Competition, count: 0 };
    e.count++;
    byComp.set(f.CompetitionId, e);
  }
  console.log("Competitions:");
  for (const [id, e] of byComp) {
    console.log(`  [${id}] ${e.name} — ${e.count} fixtures`);
  }

  // Show the next handful of matches.
  const upcoming = [...fixtures].sort((a, b) => a.StartTime - b.StartTime).slice(0, 10);
  console.log("\nNext 10 matches:");
  for (const f of upcoming) {
    const when = new Date(f.StartTime).toISOString().replace("T", " ").slice(0, 16);
    console.log(`  ${when}  ${f.Participant1} vs ${f.Participant2}  (fixtureId=${f.FixtureId})`);
  }

  // Hint which competition is likely the World Cup.
  const wc = [...byComp.entries()].find(([, e]) => /world cup|mundial/i.test(e.name));
  if (wc) console.log(`\n→ World Cup competitionId = ${wc[0]} (${wc[1].name})`);
}

main().catch((e: unknown) => {
  console.error("\n❌ ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});

export type { Fixture };
