-- GolMarket — Supabase schema
-- Full-Tournament Auto-Market: prediction markets auto-created and auto-resolved
-- from the TxLINE feed, with the raw TxLINE data receipt stored as proof.
-- Identity = Solana wallet address (text), same wallet-auth model as GolPool.

-- ─────────────────────────────────────────────────────────────
-- PROFILES — one row per wallet
-- ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  wallet_address text primary key,
  display_name   text,
  created_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- MATCHES — mirror of TxLINE fixtures + live state (fed by worker/ingest.ts)
-- ─────────────────────────────────────────────────────────────
create table if not exists matches (
  fixture_id      bigint primary key,                -- TxLINE FixtureId
  competition_id  integer,
  competition     text,
  home_team_id    integer not null,
  home_team       text not null,
  away_team_id    integer not null,
  away_team       text not null,
  kickoff         timestamptz,
  game_state      integer not null default 1,        -- TxLINE gameState 1-19
  home_goals      integer not null default 0,
  away_goals      integer not null default 0,
  home_corners    integer not null default 0,
  away_corners    integer not null default 0,
  home_yellows    integer not null default 0,
  away_yellows    integer not null default 0,
  home_reds       integer not null default 0,
  away_reds       integer not null default 0,
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- MATCH EVENTS — append-only goal feed (drives live ticker, fed by ingest)
-- ─────────────────────────────────────────────────────────────
create table if not exists match_events (
  id          bigint generated always as identity primary key,
  fixture_id  bigint not null references matches(fixture_id) on delete cascade,
  team_id     integer,
  type        text not null,
  minute      integer,
  seq         bigint,
  payload     jsonb,
  created_at  timestamptz not null default now(),
  unique (fixture_id, seq, type, team_id)
);

-- ─────────────────────────────────────────────────────────────
-- MARKETS — auto-created per fixture by worker/resolve.ts
-- kind: 'winner' (home|draw|away) · 'total_goals' (over|under, line 2.5)
-- proof: the raw TxLINE score-snapshot receipt used to resolve (seq, ts,
--        score payload, endpoint) — the Verifiable Resolution record.
-- ─────────────────────────────────────────────────────────────
create table if not exists markets (
  id           uuid primary key default gen_random_uuid(),
  fixture_id   bigint not null references matches(fixture_id) on delete cascade,
  kind         text not null,                        -- winner | total_goals
  status       text not null default 'open',         -- open | resolved | void
  outcome      text,                                 -- home|draw|away / over|under
  proof        jsonb,                                -- TxLINE receipt
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (fixture_id, kind)
);

-- ─────────────────────────────────────────────────────────────
-- PREDICTIONS — one pick per wallet per market (changeable until kickoff)
-- points_won: null until resolved, then 0 or the market's reward
-- ─────────────────────────────────────────────────────────────
create table if not exists predictions (
  market_id      uuid not null references markets(id) on delete cascade,
  wallet_address text not null references profiles(wallet_address),
  pick           text not null,
  points_won     integer,
  created_at     timestamptz not null default now(),
  primary key (market_id, wallet_address)
);

-- Leaderboard: total points + prediction counts per wallet.
create or replace view leaderboard as
select
  p.wallet_address,
  pr.display_name,
  coalesce(sum(p.points_won), 0)::int as total_points,
  count(*)::int                       as total_predictions,
  count(*) filter (where p.points_won > 0)::int as correct_predictions
from predictions p
join profiles pr on pr.wallet_address = p.wallet_address
group by p.wallet_address, pr.display_name;

-- Helpful indexes
create index if not exists idx_markets_fixture     on markets(fixture_id);
create index if not exists idx_predictions_wallet  on predictions(wallet_address);
create index if not exists idx_events_fixture      on match_events(fixture_id);

-- Realtime: browser subscribes to live score + resolution changes.
alter publication supabase_realtime add table matches, markets, predictions;

-- RLS: reads public (anon). Writes only via service-role (ingest/resolve workers)
-- and the wallet-write edge function (signature-verified).
alter table profiles    enable row level security;
alter table matches     enable row level security;
alter table match_events enable row level security;
alter table markets     enable row level security;
alter table predictions enable row level security;
create policy "public read profiles"    on profiles    for select using (true);
create policy "public read matches"     on matches     for select using (true);
create policy "public read events"      on match_events for select using (true);
create policy "public read markets"     on markets     for select using (true);
create policy "public read predictions" on predictions for select using (true);
