// TxLINE API client + types.
// NOTE: calls that use the API token must run SERVER-SIDE (the ingestion worker),
// never in the browser — the token is long-lived and must stay secret. The browser
// talks to Supabase Realtime instead. Types are shared by both sides.
//
// ponytail: manual copy of src/lib/txline.ts for the Deno edge functions (Vite and
// Deno don't share a module path cleanly). Keep both in sync by hand if it changes.

export const TXLINE_BASE = {
  mainnet: "https://txline.txodds.com",
  devnet: "https://txline-dev.txodds.com",
} as const;

// ── Soccer score schema (scoreSoccer) ───────────────────────────────
export interface PeriodStat {
  Goals: number;
  YellowCards: number;
  RedCards: number;
  Corners: number;
}

export interface ParticipantScore {
  H1: PeriodStat;
  HT: PeriodStat;
  H2: PeriodStat;
  ET1: PeriodStat;
  ET2: PeriodStat;
  PE: PeriodStat;
  ETTotal: PeriodStat;
  Total: PeriodStat;
}

export interface SoccerScore {
  Participant1: ParticipantScore;
  Participant2: ParticipantScore;
}

// ── Fixtures snapshot ────────────────────────────────────────────────
export interface Fixture {
  Ts: number;
  StartTime: number; // epoch milliseconds
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
}

// ── Scores stream / snapshot event ───────────────────────────────────
export interface ScoresEvent {
  fixtureId: number;
  gameState: string | number; // see GAME_STATE
  startTime: number;
  scoreSoccer?: SoccerScore;
  dataSoccer?: unknown;
  ts: number;
  seq: number;
  connectionId?: string;
  action?: string;
  confirmed?: boolean;
}

export const GAME_STATE: Record<number, string> = {
  1: "Not Started",
  2: "First Half",
  3: "Halftime",
  4: "Second Half",
  5: "Finished",
  6: "Extra Time",
  7: "Extra Time",
  8: "Extra Time",
  9: "Extra Time",
  10: "Ended (ET)",
  11: "Penalties",
  12: "Penalties",
  13: "Ended (Pens)",
  15: "Abandoned",
  16: "Cancelled",
  19: "Postponed",
};

// 6–9 = extra-time phases, 11–12 = penalty shootout (seen in live knockout feeds).
export const isLive = (state: number) =>
  state === 2 || state === 4 || (state >= 6 && state <= 12 && state !== 10);
export const isFinished = (state: number) =>
  state === 5 || state === 10 || state === 13;

/** Stale = still "Not Started" but its kickoff is already in the past. These are old
 *  TxLINE fixtures that never got results (dropped from the feed) — hide them everywhere. */
export const isStale = (kickoff: string | null, state: number, now = Date.now()) =>
  state === 1 && !!kickoff && new Date(kickoff).getTime() <= now;

/** One event of a scores snapshot, in either feed schema:
 *  live PascalCase (Seq/StatusId/Score/Ts) or replay camelCase (seq/gameState/scoreSoccer/ts). */
export interface SnapshotEvent {
  Seq?: number;
  seq?: number;
  StatusId?: number;
  gameState?: string | number;
  Score?: SoccerScore;
  scoreSoccer?: SoccerScore;
  Ts?: number;
  ts?: number;
}

/**
 * Fold an UNORDERED scores snapshot into the newest game state + newest score.
 * Events are sparse: the final-whistle event (StatusId 5) carries no Score, and
 * the newest score-bearing event may not carry the newest status — so track each
 * independently while walking events in Seq order.
 */
export function foldSnapshot(
  snaps: SnapshotEvent[] | null | undefined,
  fallbackState: number,
): { gs: number; score: SoccerScore | null; ts: number | null } {
  let gs = fallbackState;
  let score: SoccerScore | null = null;
  let ts: number | null = null;
  const sorted = [...(snaps ?? [])].sort((a, b) => (a.Seq ?? a.seq ?? 0) - (b.Seq ?? b.seq ?? 0));
  for (const e of sorted) {
    const st = e.StatusId ?? Number(e.gameState);
    if (st != null && !Number.isNaN(st)) gs = st;
    const sc = e.Score ?? e.scoreSoccer;
    if (sc && (Object.keys(sc.Participant1 ?? {}).length || Object.keys(sc.Participant2 ?? {}).length)) {
      score = sc;
      ts = e.Ts ?? e.ts ?? ts;
    }
  }
  return { gs, score, ts };
}

/**
 * Approximate live match minute for display, derived from kickoff + game state.
 * The feed has no real clock, so this is an estimate (good enough for the live feel
 * and the demo/replay). Returns "63'", "45+", "HT", "90+", or null when not applicable.
 * ponytail: estimate — swap for a real feed minute if TxLINE ever exposes one.
 */
export function matchMinute(
  kickoff: string | null,
  gameState: number,
  now = Date.now(),
): string | null {
  if (gameState === 3) return "HT";
  if ((gameState !== 2 && gameState !== 4) || !kickoff) return null;
  const elapsed = Math.floor((now - new Date(kickoff).getTime()) / 60000);
  if (elapsed < 0) return null;
  if (gameState === 2) return elapsed >= 45 ? "45+'" : `${Math.max(1, elapsed)}'`;
  // Second half: subtract the ~15' half-time break from elapsed.
  const m = elapsed - 15;
  if (m <= 45) return "45'";
  return m >= 90 ? "90+'" : `${m}'`;
}

// ── Auth + data helpers ──────────────────────────────────────────────
export interface TxlineAuth {
  jwt: string; // guest session JWT
  apiToken: string; // long-lived API token from activation
}

function headers(auth: TxlineAuth, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${auth.jwt}`,
    "X-Api-Token": auth.apiToken,
    ...extra,
  };
}

/** Step 1 of auth: get a guest session JWT. */
export async function startGuestSession(base = TXLINE_BASE.mainnet): Promise<string> {
  const res = await fetch(`${base}/auth/guest/start`, { method: "POST" });
  if (!res.ok) throw new Error(`guest/start failed: ${res.status}`);
  const json = await res.json();
  return json.token;
}

/** Latest snapshot of fixtures (the World Cup matches). */
export async function getFixtures(
  auth: TxlineAuth,
  opts: { startEpochDay?: number; competitionId?: number } = {},
  base = TXLINE_BASE.mainnet,
): Promise<Fixture[]> {
  const qs = new URLSearchParams();
  if (opts.startEpochDay != null) qs.set("startEpochDay", String(opts.startEpochDay));
  if (opts.competitionId != null) qs.set("competitionId", String(opts.competitionId));
  const res = await fetch(`${base}/api/fixtures/snapshot?${qs}`, {
    headers: headers(auth),
  });
  if (!res.ok) throw new Error(`fixtures/snapshot failed: ${res.status}`);
  return res.json();
}

/** Current score snapshot for a fixture (asOf ms for historical replay). */
export async function getScoreSnapshot(
  auth: TxlineAuth,
  fixtureId: number,
  asOf?: number,
  base = TXLINE_BASE.mainnet,
): Promise<ScoresEvent[]> {
  const qs = asOf != null ? `?asOf=${asOf}` : "";
  const res = await fetch(`${base}/api/scores/snapshot/${fixtureId}${qs}`, {
    headers: headers(auth),
  });
  if (!res.ok) throw new Error(`scores/snapshot failed: ${res.status}`);
  return res.json();
}

/**
 * Connect to the real-time SSE scores stream and invoke onEvent per parsed event.
 * Server-side only. Returns when the stream ends or the AbortSignal fires.
 */
export async function streamScores(
  auth: TxlineAuth,
  onEvent: (e: ScoresEvent) => void,
  opts: { fixtureId?: number; lastEventId?: string; signal?: AbortSignal } = {},
  base = TXLINE_BASE.mainnet,
): Promise<void> {
  const qs = opts.fixtureId != null ? `?fixtureId=${opts.fixtureId}` : "";
  const extra: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };
  if (opts.lastEventId) extra["Last-Event-ID"] = opts.lastEventId;

  const res = await fetch(`${base}/api/scores/stream${qs}`, {
    headers: headers(auth, extra),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`scores/stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by a blank line.
      const messages = buffer.split("\n\n");
      buffer = messages.pop() ?? "";

      for (const msg of messages) {
        const lines = msg.split("\n");
        if (lines.some((l) => l.startsWith("event: heartbeat"))) continue;
        const dataLine = lines.find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        try {
          onEvent(JSON.parse(dataLine.slice(5).trim()) as ScoresEvent);
        } catch {
          // ignore malformed chunk
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
