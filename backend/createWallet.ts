import { Keypair } from "@solana/web3.js";
import fs from "fs";

const wallet = Keypair.generate();

fs.writeFileSync(
  "solana-devnet-wallet.json",
  JSON.stringify(Array.from(wallet.secretKey))
);

console.log("=================================");
console.log("Solana Devnet Wallet Created");
console.log("=================================");
console.log("Wallet Address:");
console.log(wallet.publicKey.toBase58());

console.log("\nPrivate key saved to:");
console.log("solana-devnet-wallet.json");

console.log("\nDO NOT SHARE THE PRIVATE KEY.");