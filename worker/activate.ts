// Plan B: activate a TxLINE API token from a browser-produced signature.
// Run server-side (reliable) — captures the token even if the dev proxy is flaky.
//   npx tsx worker/activate.ts '{"txSig":"...","jwt":"...","walletSignature":"..."}'
import { NETWORKS, SELECTED_LEAGUES, type Network } from "../src/lib/txlineConfig.ts";

const network = (process.env.TXLINE_NETWORK as Network) || "mainnet";
const input = process.argv[2];
if (!input) throw new Error("Usage: tsx worker/activate.ts '<json {txSig,jwt,walletSignature}>'");

const { txSig, jwt, walletSignature } = JSON.parse(input);
const base = NETWORKS[network].txlineBase;
console.log(`Activating on ${network} (${base}) for tx ${txSig.slice(0, 12)}…`);

const res = await fetch(`${base}/api/token/activate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
});
const text = await res.text();
console.log("HTTP", res.status);

if (!res.ok) {
  console.log("body:", text);
  process.exit(1);
}

let token = text.trim();
try {
  const j = JSON.parse(text);
  token = j.token ?? j;
} catch {
  /* plain-text token */
}
console.log("\n✅ API TOKEN:\n" + token);
