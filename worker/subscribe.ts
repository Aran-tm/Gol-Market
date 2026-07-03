// One-time TxLINE subscription + API-token activation (server-side).
//   Devnet:  npm run txline:subscribe            (auto-generates keypair + airdrops SOL)
//   Mainnet: TXLINE_NETWORK=mainnet npm run txline:subscribe   (fund the printed wallet first)
//
// Saves the keypair to worker/<network>-keypair.json (gitignored) and prints the API token.

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import fs from "node:fs";
import path from "node:path";
import {
  NETWORKS,
  SERVICE_LEVEL_ID,
  DURATION_WEEKS,
  SELECTED_LEAGUES,
  type Network,
} from "./config.ts";

const NETWORK = (process.env.TXLINE_NETWORK as Network) || "devnet";
const cfg = NETWORKS[NETWORK];
const KEYPAIR_PATH = path.resolve("worker", `${NETWORK}-keypair.json`);

function loadOrCreateKeypair(): Keypair {
  if (fs.existsSync(KEYPAIR_PATH)) {
    const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)));
  console.log("Generated new keypair →", KEYPAIR_PATH);
  return kp;
}

async function ensureSol(connection: Connection, kp: Keypair) {
  let bal = await connection.getBalance(kp.publicKey);
  console.log("Balance:", (bal / LAMPORTS_PER_SOL).toFixed(4), "SOL");
  if (bal >= 0.05 * LAMPORTS_PER_SOL) return;

  if (NETWORK === "devnet") {
    console.log("Requesting devnet airdrop (1 SOL)...");
    try {
      const sig = await connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      bal = await connection.getBalance(kp.publicKey);
      console.log("Balance now:", (bal / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    } catch {
      console.warn("Airdrop failed (rate limit). Use https://faucet.solana.com for:");
      console.warn("  ", kp.publicKey.toBase58());
    }
  }
  if ((await connection.getBalance(kp.publicKey)) === 0) {
    throw new Error(`Fund this wallet with SOL and re-run:\n  ${kp.publicKey.toBase58()}`);
  }
}

async function main() {
  console.log(`\n=== TxLINE subscribe (${NETWORK}) ===`);
  const connection = new Connection(cfg.cluster, "confirmed");
  const keypair = loadOrCreateKeypair();
  console.log("Wallet:", keypair.publicKey.toBase58());

  await ensureSol(connection, keypair);

  // Anchor program (IDL fetched from chain).
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const programId = new PublicKey(cfg.programId);
  const idl = await anchor.Program.fetchIdl(programId, provider);
  if (!idl) throw new Error(`Could not fetch IDL from chain for ${cfg.programId}`);
  console.log("IDL fetched:", (idl as anchor.Idl).metadata?.name ?? "ok");
  const program = new anchor.Program(idl as anchor.Idl, provider);

  // PDAs + token accounts.
  const [pricingMatrix] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    programId,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    programId,
  );
  const tokenMint = new PublicKey(cfg.txlMint);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    tokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
  );
  const userAta = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    tokenMint,
    keypair.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
  console.log("User token account:", userAta.address.toBase58());

  // Subscribe on-chain (free tier → no TxL transferred).
  console.log(`Subscribing: serviceLevel=${SERVICE_LEVEL_ID}, weeks=${DURATION_WEEKS}...`);
  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accountsPartial({
      user: keypair.publicKey,
      pricingMatrix,
      tokenMint,
      userTokenAccount: userAta.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("✅ Subscribed. txSig:", txSig);

  // Activate API token.
  const base = cfg.txlineBase;
  const authRes = await fetch(`${base}/auth/guest/start`, { method: "POST" });
  if (!authRes.ok) throw new Error(`guest/start ${authRes.status}: ${await authRes.text()}`);
  const jwt = (await authRes.json()).token as string;

  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const signature = nacl.sign.detached(
    new TextEncoder().encode(messageString),
    keypair.secretKey,
  );
  const walletSignature = Buffer.from(signature).toString("base64");

  const actRes = await fetch(`${base}/api/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues: SELECTED_LEAGUES }),
  });
  if (!actRes.ok) throw new Error(`activate ${actRes.status}: ${await actRes.text()}`);
  const actJson = await actRes.json();
  const apiToken = actJson.token ?? actJson;

  console.log("\n✅ API TOKEN ACTIVATED\n");
  console.log("Add to golpool/.env.local:");
  console.log(`  TXLINE_NETWORK=${NETWORK}`);
  console.log(`  TXLINE_API_TOKEN=${apiToken}\n`);
}

main().catch((e) => {
  console.error("\n❌ ERROR:", e?.message ?? e);
  if (e?.logs) console.error("Program logs:\n", e.logs.join("\n"));
  process.exit(1);
});
