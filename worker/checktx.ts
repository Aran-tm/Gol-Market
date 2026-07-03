// Check a transaction signature on-chain.
//   npx tsx worker/checktx.ts <signature> [rpcUrl]
import { Connection } from "@solana/web3.js";

const sig = process.argv[2];
const rpc = process.argv[3] || "https://solana-rpc.publicnode.com";
if (!sig) throw new Error("Usage: tsx worker/checktx.ts <signature> [rpcUrl]");

const c = new Connection(rpc, "confirmed");

const st = await c.getSignatureStatuses([sig], { searchTransactionHistory: true });
console.log("status:", JSON.stringify(st.value[0], null, 2));

const tx = await c.getTransaction(sig, { maxSupportedTransactionVersion: 0 });
if (!tx) {
  console.log("→ Transaction NOT found on-chain (may have failed to land or RPC lag).");
} else {
  console.log("→ Found on-chain.");
  console.log("  slot:", tx.slot);
  console.log("  err:", JSON.stringify(tx.meta?.err));
  console.log("  fee (lamports):", tx.meta?.fee);
  console.log(tx.meta?.err ? "  ❌ Transaction FAILED on-chain." : "  ✅ Transaction SUCCEEDED on-chain.");
}
