// Show current state + score for all World Cup fixtures (proves live data).
//   npm run txline:scores
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { NETWORKS, type Network } from "../src/lib/txlineConfig.ts";
import { GAME_STATE, isLive, isFinished, type Fixture, type ScoresEvent } from "../src/lib/txline.ts";

const network = (process.env.TXLINE_NETWORK as Network) || "mainnet";
const apiToken = process.env.TXLINE_API_TOKEN;
const base = NETWORKS[network].txlineBase;
const COMP = 72; // World Cup

if (!apiToken) throw new Error("Missing TXLINE_API_TOKEN in .env.local");

// txline (Cloudflare) is intermittently flaky from some networks — retry.
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

async function main() {
  const jwt = (await (await fetchRetry(`${base}/auth/guest/start`, { method: "POST" })).json()).token;
  const fixtures: Fixture[] = await (
    await fetchRetry(`${base}/api/fixtures/snapshot?competitionId=${COMP}`, { headers: h(jwt) })
  ).json();
  fixtures.sort((a, b) => a.StartTime - b.StartTime);

  console.log(`\n=== World Cup — ${fixtures.length} fixtures ===\n`);
  for (const f of fixtures) {
    let line = `${f.Participant1} vs ${f.Participant2}`;
    try {
      const snaps: ScoresEvent[] = await (
        await fetchRetry(`${base}/api/scores/snapshot/${f.FixtureId}`, { headers: h(jwt) })
      ).json();
      const last = snaps?.[snaps.length - 1];
      const gs = Number(last?.gameState ?? 1);
      const hg = last?.scoreSoccer?.Participant1?.Total?.Goals ?? 0;
      const ag = last?.scoreSoccer?.Participant2?.Total?.Goals ?? 0;
      const flag = isLive(gs) ? "🔴 LIVE" : isFinished(gs) ? "✅ FT" : "⏳";
      line = `${flag}  ${f.Participant1} ${hg}-${ag} ${f.Participant2}  [${GAME_STATE[gs] ?? gs}]`;
    } catch {
      line = `⚠️  ${line} (no score snapshot)`;
    }
    console.log(line);
  }
}

main().catch((e: unknown) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
