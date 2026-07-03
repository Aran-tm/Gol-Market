// Print (and create if missing) the worker keypair address for a given network.
//   npx tsx worker/genkey.ts mainnet
import { Keypair } from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";

const network = process.argv[2] || "mainnet";
const p = path.resolve("worker", `${network}-keypair.json`);
let kp: Keypair;
if (fs.existsSync(p)) {
  kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
} else {
  kp = Keypair.generate();
  fs.writeFileSync(p, JSON.stringify(Array.from(kp.secretKey)));
  console.log("created", p);
}
console.log(`${network} wallet: ${kp.publicKey.toBase58()}`);
