// Shared TxLINE/Solana config — imported by both the browser app and the worker.
// Pure constants only (no browser/node-specific imports) so both sides can use it.
//
// ponytail: manual copy of src/lib/txlineConfig.ts for the Deno edge functions. Keep
// both in sync by hand if it changes.

export type Network = "devnet" | "mainnet";

export const NETWORKS = {
  devnet: {
    cluster: "https://api.devnet.solana.com",
    txlineBase: "https://txline-dev.txodds.com",
    programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
    txlMint: "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
  },
  mainnet: {
    // Public RPC that allows browser requests (the official api.mainnet-beta
    // endpoint returns 403 to browsers). Override with VITE_SOLANA_RPC if needed.
    cluster: "https://solana-rpc.publicnode.com",
    txlineBase: "https://txline.txodds.com",
    programId: "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
    txlMint: "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL",
  },
} as const;

// Free real-time World Cup tier (no TxL tokens needed). Use 1 for 60s-delay.
export const SERVICE_LEVEL_ID = 12;
export const DURATION_WEEKS = 4;
export const SELECTED_LEAGUES: number[] = []; // empty = standard bundle

// Anchor discriminator for `subscribe` = sha256("global:subscribe")[0..8]. Verified.
export const SUBSCRIBE_DISCRIMINATOR = Uint8Array.from([
  254, 28, 191, 138, 156, 179, 183, 53,
]);

// PDA seeds
export const SEED_PRICING_MATRIX = "pricing_matrix";
export const SEED_TOKEN_TREASURY = "token_treasury_v2";
