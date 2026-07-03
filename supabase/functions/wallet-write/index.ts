// Supabase Edge Function (Deno): the ONLY path allowed to write profiles / predictions.
// Verifies an ed25519 signature proving the caller controls `wallet` before touching
// any row, then writes with the service-role key. Same model as GolPool's wallet-write.
//
// Deploy: supabase functions deploy wallet-write
//
// deno-lint-ignore-file
// @ts-nocheck  — this file runs on Deno (Supabase Edge), not in the app's Node/TS build.
import { createClient } from "jsr:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import bs58 from "npm:bs58@6.0.0";

const SESSION_MAX_MS = 12 * 60 * 60 * 1000; // must match src/lib/walletAuth.ts
const CLOCK_SKEW_MS = 60_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: CORS });

const MESSAGE_RE = /^GolMarket wants you to sign in\.\nWallet: (.+)\nIssued: (\d+)\nExpires: (\d+)$/;

function verifySession(wallet: string, message: string, signatureB64: string): boolean {
  const m = MESSAGE_RE.exec(message);
  if (!m || m[1] !== wallet) return false;
  const issued = Number(m[2]);
  const expires = Number(m[3]);
  const now = Date.now();
  if (expires - issued > SESSION_MAX_MS + CLOCK_SKEW_MS) return false;
  if (now < issued - CLOCK_SKEW_MS || now > expires) return false;
  try {
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const pub = bs58.decode(wallet);
    return nacl.sign.detached.verify(new TextEncoder().encode(message), sig, pub);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "missing env" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const { wallet, message, signature, action, payload } = body ?? {};
  if (typeof wallet !== "string" || typeof message !== "string" || typeof signature !== "string" || typeof action !== "string") {
    return json({ error: "missing wallet/message/signature/action" }, 400);
  }
  if (!verifySession(wallet, message, signature)) return json({ error: "invalid or expired signature" }, 401);

  const db = createClient(url, key, { auth: { persistSession: false } });
  const p = (payload ?? {}) as Record<string, unknown>;

  try {
    switch (action) {
      case "ensure_profile": {
        const { data } = await db.from("profiles").select("wallet_address").eq("wallet_address", wallet).maybeSingle();
        if (!data) await db.from("profiles").insert({ wallet_address: wallet });
        return json({ ok: true });
      }
      case "update_display_name": {
        if (typeof p.display_name !== "string") return json({ error: "display_name required" }, 400);
        await db.from("profiles").upsert({ wallet_address: wallet, display_name: p.display_name }, { onConflict: "wallet_address" });
        return json({ ok: true });
      }
      case "predict": {
        // payload: { market_id, pick } — pick changeable until kickoff.
        if (typeof p.market_id !== "string" || typeof p.pick !== "string") {
          return json({ error: "market_id/pick required" }, 400);
        }
        const VALID: Record<string, string[]> = {
          winner: ["home", "draw", "away"],
          total_goals: ["over", "under"],
        };
        const { data: market } = await db
          .from("markets")
          .select("id, kind, status, fixture_id, matches(kickoff, game_state)")
          .eq("id", p.market_id)
          .maybeSingle();
        if (!market) return json({ error: "market not found" }, 404);
        if (market.status !== "open") return json({ error: "market already resolved" }, 409);
        if (!VALID[market.kind]?.includes(p.pick)) return json({ error: "invalid pick" }, 400);
        const match = market.matches;
        const kicked = match?.kickoff && new Date(match.kickoff).getTime() <= Date.now();
        if (kicked || (match?.game_state ?? 1) !== 1) {
          return json({ error: "predictions are locked at kickoff" }, 409);
        }
        const { data: existing } = await db.from("profiles").select("wallet_address").eq("wallet_address", wallet).maybeSingle();
        if (!existing) await db.from("profiles").insert({ wallet_address: wallet });
        const { error } = await db
          .from("predictions")
          .upsert({ market_id: p.market_id, wallet_address: wallet, pick: p.pick }, { onConflict: "market_id,wallet_address" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
