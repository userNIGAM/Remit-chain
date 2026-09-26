import { Connection, Keypair } from "@solana/web3.js";

import fs from "fs";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const secretKey = Uint8Array.from(
  JSON.parse(fs.readFileSync("solana-devnet-wallet.json", "utf-8")),
);

const wallet = Keypair.fromSecretKey(secretKey);

const balance = await connection.getBalance(wallet.publicKey);

console.log("Wallet Address:");
console.log(wallet.publicKey.toBase58());

console.log("\nDevnet Balance:");
console.log(balance / 1_000_000_000, "SOL");
