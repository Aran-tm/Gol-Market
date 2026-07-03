# GolMarket — Verifiable World Cup Prediction Markets

**Track:** Prediction Markets and Settlement (TxODDS World Cup Hackathon · Superteam Earn)

Prediction markets for all 104 World Cup matches that **create and resolve themselves** from the
TxLINE live feed — and every resolution ships with the raw TxLINE data receipt, so users can
verify exactly what data settled their market. No admin, no manual resolution, no trust required.

## How it works

```
TxLINE feed (Solana-anchored)
   │
   ├── worker/ingest.ts   → matches + goal events in Supabase (live scores)
   └── worker/resolve.ts  → THE SETTLEMENT ENGINE
         1. auto-creates 2 markets per fixture (winner 1X2 · total goals O/U 2.5)
         2. locks predictions at kickoff (enforced server-side)
         3. on full time: re-fetches the TxLINE score snapshot, stores it as the
            `proof` receipt, computes the outcome deterministically, settles points
   │
Supabase (Postgres + Realtime) ──→ React app (markets, picks, proof viewer, leaderboard)
   │
Solana wallet = identity (sign-in with Solana, ed25519-verified writes)
```

- **Play-money points** (winner = 100 pts, total goals = 50 pts) — deliberately not real-money
  wagering (see the hackathon's legal note). Fixed rewards; pari-mutuel split is the roadmap.
- **Verifiable Resolution UI**: every resolved market has a "Proof" button showing the TxLINE
  receipt (endpoint, seq, ts, full score payload) the engine used — the track's optional
  verification layer, done without trusting our own DB.

## Stack

React 19 + Vite + Tailwind · Supabase (Postgres, Realtime, Edge Functions) · Solana wallet-adapter
· TxLINE API (fixtures snapshot, scores snapshot/stream, on-chain subscription program).

Shares its TxLINE integration lineage with [GolPool](https://gol-pool.vercel.app) (our Consumer
track entry) — same team, separate product and repo.

## Setup

1. `npm install`
2. Create a Supabase project → run `supabase/schema.sql` in the SQL editor.
3. Deploy the edge function: `supabase functions deploy wallet-write`
4. Copy `.env.example` → `.env.local` and fill in Supabase URL/keys + TxLINE API token
   (token comes from the on-chain subscription: `npm run txline:subscribe` then activate).
5. `npm run txline:ingest -- --watch` — sync fixtures + live scores.
6. `npm run txline:resolve -- --watch` — create + auto-resolve markets.
7. `npm run dev`

## Demo (after the tournament ends)

```
npx tsx worker/replay.ts <fixture_id>   # synthetic live progression on a real fixture
npm run txline:resolve                  # markets resolve, proof receipts appear live
```

## TxLINE endpoints used

- `POST /auth/guest/start` — guest session JWT
- `GET /api/fixtures/snapshot?competitionId=72` — World Cup fixtures
- `GET /api/scores/snapshot/{fixtureId}` — score state + the resolution receipt
- `GET /api/scores/stream` — SSE live stream (client available in `src/lib/txline.ts`)
- On-chain subscription program (mainnet) for API token issuance
