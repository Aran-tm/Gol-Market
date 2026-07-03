// Shared row types (mirror of supabase/schema.sql).

export interface MatchRow {
  fixture_id: number;
  home_team_id: number;
  home_team: string;
  away_team_id: number;
  away_team: string;
  game_state: number;
  home_goals: number;
  away_goals: number;
  kickoff: string | null;
}

export type MarketKind = "winner" | "total_goals";
export type MarketStatus = "open" | "resolved" | "void";

// winner picks: "home" | "draw" | "away" · total_goals picks: "over" | "under" (2.5 line)
export interface MarketRow {
  id: string;
  fixture_id: number;
  kind: MarketKind;
  status: MarketStatus;
  outcome: string | null;
  proof: Record<string, unknown> | null;
  resolved_at: string | null;
}

export interface PredictionRow {
  market_id: string;
  wallet_address: string;
  pick: string;
  points_won: number | null;
}

export const WINNER_POINTS = 100;
export const TOTAL_GOALS_POINTS = 50;
export const TOTAL_GOALS_LINE = 2.5;
