import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaced early in dev so a missing .env.local is obvious.
  console.warn("[GolMarket] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local");
}

export const supabase = createClient(url ?? "", anonKey ?? "");
