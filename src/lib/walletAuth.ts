// Proves wallet ownership to the `wallet-write` Edge Function via a signed session
// message, instead of trusting a client-supplied wallet address (which anyone could
// spoof by calling the REST API directly with the public anon key).
import { supabase } from "./supabase";

export type SignMessage = ((message: Uint8Array) => Promise<Uint8Array>) | undefined;

const SESSION_MS = 12 * 60 * 60 * 1000; // re-prompt for a signature at most every ~12h
const sessions = new Map<string, { message: string; signature: string; expires: number }>();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function getSession(wallet: string, signMessage: NonNullable<SignMessage>) {
  const cached = sessions.get(wallet);
  if (cached && cached.expires > Date.now() + 60_000) return cached;

  const issued = Date.now();
  const expires = issued + SESSION_MS;
  const message = `GolMarket wants you to sign in.\nWallet: ${wallet}\nIssued: ${issued}\nExpires: ${expires}`;
  const signature = toBase64(await signMessage(new TextEncoder().encode(message)));
  const session = { message, signature, expires };
  sessions.set(wallet, session);
  return session;
}

/** Calls the wallet-write Edge Function, proving ownership of `wallet` via a signed message. */
export async function walletWrite<T = unknown>(
  wallet: string,
  signMessage: SignMessage,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!signMessage) throw new Error("This wallet doesn't support message signing.");
  const session = await getSession(wallet, signMessage);
  const { data, error } = await supabase.functions.invoke("wallet-write", {
    body: { wallet, message: session.message, signature: session.signature, action, payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}
