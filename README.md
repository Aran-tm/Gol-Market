# GolMarket — Verifiable World Cup Prediction Markets

**Track:** Prediction Markets and Settlement (TxODDS World Cup Hackathon · Superteam Earn)
**Live app:** https://gol-market.vercel.app · **Repo:** https://github.com/Aran-tm/Gol-Market

Prediction markets for all 104 World Cup matches that **create and resolve themselves** from the
TxLINE live feed — and every resolution ships with the raw TxLINE data receipt, so users can
verify exactly what data settled their market. No admin, no manual resolution, no trust required.

## Status — what's live right now

- ✅ Deployed frontend at gol-market.vercel.app (Vite/React, wired to the live Supabase project).
- ✅ Supabase project `qumtgugdrmlquhcpyukv`: full schema applied (matches, markets, predictions,
  profiles, leaderboard view).
- ✅ `wallet-write`, `txline-ingest`, `txline-resolve` Edge Functions deployed and running —
  `txline-ingest`/`txline-resolve` are triggered every minute by `pg_cron` + `pg_net` directly
  inside Supabase, so the feed sync and settlement engine run 24/7 with **no local process and no
  separate server**.
- ✅ Markets auto-created (winner + total goals) for every synced fixture; settlement engine armed
  and waiting for the first match to finish.
- ✅ Wallet auth (sign-in with Solana), picks, proof-receipt viewer, leaderboard, live-match
  filter tabs + bottom nav.

## What's left before submitting

- [ ] Record the demo video (≤5 min: problem → live walkthrough → how TxLINE powers the backend).
  Best done once a couple of real matches have resolved (first one lands ~Jul 9), so the video can
  show a real proof receipt instead of only open markets.
- [ ] Write the brief technical write-up (core idea + business/technical highlights — the TxLINE
  endpoint list below already covers the "which endpoints" part).
- [ ] Write the TxLINE API feedback paragraph (what worked, where we hit friction) for the
  submission form.
- [ ] Fill out and submit the Superteam Earn form with the above + this repo + the live link.

## How it works

```
TxLINE feed (Solana-anchored)
   │
   │   triggered every minute by pg_cron + pg_net, inside Supabase — no external server
   ├── Edge Function txline-ingest   → matches + goal events in Supabase (live scores)
   └── Edge Function txline-resolve  → THE SETTLEMENT ENGINE
         1. auto-creates 2 markets per fixture (winner 1X2 · total goals O/U 2.5)
         2. locks predictions at kickoff (enforced server-side)
         3. on full time: re-fetches the TxLINE score snapshot, stores it as the
            `proof` receipt, computes the outcome deterministically, settles points
   │
Supabase (Postgres + Realtime) ──→ React app (markets, picks, proof viewer, leaderboard)
   │
Solana wallet = identity (sign-in with Solana, ed25519-verified writes via Edge Function wallet-write)
```

`worker/ingest.ts` and `worker/resolve.ts` are the same logic as Node/tsx scripts, kept for local
testing and for the pre-recording `replay.ts` demo — see [Local development](#local-development).
The code that actually runs in production lives in `supabase/functions/txline-ingest` and
`supabase/functions/txline-resolve` (sharing `supabase/functions/_shared/`).

- **Play-money points** (winner = 100 pts, total goals = 50 pts) — deliberately not real-money
  wagering (see the hackathon's legal note). Fixed rewards; pari-mutuel split is the roadmap.
- **Verifiable Resolution UI**: every resolved market has a "Proof" button showing the TxLINE
  receipt (endpoint, seq, ts, full score payload) the engine used — the track's optional
  verification layer, done without trusting our own DB.

## Stack

React 19 + Vite + Tailwind · Supabase (Postgres, Realtime, Edge Functions, pg_cron/pg_net) ·
Solana wallet-adapter · TxLINE API (fixtures snapshot, scores snapshot/stream, on-chain
subscription program).

Shares its TxLINE integration lineage with [GolPool](https://gol-pool.vercel.app) (our Consumer
track entry) — same team, separate product and repo.

## Deploying the backend (Supabase)

1. Create a Supabase project → run `supabase/schema.sql` in the SQL editor.
2. `supabase functions deploy wallet-write --project-ref <ref>`
3. `supabase functions deploy txline-ingest --project-ref <ref>`
4. `supabase functions deploy txline-resolve --project-ref <ref>`
5. `supabase secrets set TXLINE_API_TOKEN=... TXLINE_NETWORK=mainnet --project-ref <ref>`
6. Schedule the two ingest/resolve functions every minute via `pg_cron` + `pg_net`
   (Database → Cron in the dashboard, or `cron.schedule(...)` calling `net.http_post(...)` with
   an `Authorization: Bearer <service_role_key>` header).

## Local development

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in the Supabase URL/keys + TxLINE API token
   (token comes from the on-chain subscription: `npm run txline:subscribe` then activate).
3. `npm run txline:ingest -- --watch` / `npm run txline:resolve -- --watch` — optional, only
   needed for local testing; the live deployment runs these via the Edge Functions + cron above.
4. `npm run dev`

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
