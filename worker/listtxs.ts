// List recent transactions for a wallet (find un-used subscribe txs).
//   npx tsx worker/listtxs.ts <walletAddress> [rpcUrl]
import { Connection, PublicKey } from "@solana/web3.js";
import { NETWORKS } from "../src/lib/txlineConfig.ts";

const wallet = process.argv[2];
const rpc = process.argv[3] || "https://api.mainnet-beta.solana.com";
if (!wallet) throw new Error("Usage: tsx worker/listtxs.ts <walletAddress>");

const programId = NETWORKS.mainnet.programId;
const c = new Connection(rpc, "confirmed");
const pubkey = new PublicKey(wallet);

const sigs = await c.getSignaturesForAddress(pubkey, { limit: 20 });
console.log(`Recent ${sigs.length} txs for ${wallet}:\n`);

for (const s of sigs) {
  const ok = s.err ? "❌ FAILED" : "✅ ok";
  // Pull the tx to check it touches the subscription program.
  let touchesProgram = false;
  try {
    const tx = await c.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    const keys = tx?.transaction.message.staticAccountKeys?.map((k) => k.toBase58()) ?? [];
    touchesProgram = keys.includes(programId);
  } catch {
    /* ignore */
  }
  const tag = touchesProgram ? "  ← SUBSCRIBE tx" : "";
  console.log(`${ok}  ${s.signature}${tag}`);
}

console.log("\nPick a ✅ SUBSCRIBE tx that you have NOT activated yet.");
