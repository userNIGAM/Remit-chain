import { Connection } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const signature =
  "3XXw4RrexNma2pn2iyvHeLTY52Ts2jd48ZVwUTWDHTDHUJFyAfqRciCbxSYFno3q6RadB1HjpxuzMKF3AWA9C7W7";

const status = await connection.getSignatureStatus(signature, {
  searchTransactionHistory: true,
});

console.log("Signature:");
console.log(signature);

console.log("\nStatus:");
console.dir(status, { depth: null });

process.exit(0);
