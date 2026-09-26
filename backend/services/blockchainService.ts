import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed",
);

const getWallet = (): Keypair => {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("SOLANA_PRIVATE_KEY is not configured");
  }

  const secretKey = Uint8Array.from(JSON.parse(privateKey));

  return Keypair.fromSecretKey(secretKey);
};

export const anchorTransactionHash = async (transactionHash: string) => {
  try {
    const wallet = getWallet();

    const memoProgramId = new PublicKey(
      "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
    );

    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: memoProgramId,
      data: Buffer.from(transactionHash, "utf8"),
    });

    // Get a fresh recent blockhash
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction({
      feePayer: wallet.publicKey,
      recentBlockhash: blockhash,
    });

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 1,
      }),
    );

    transaction.add(memoInstruction);

    transaction.sign(wallet);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      },
    );

    console.log("Solana transaction sent:");
    console.log(signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed",
    );

    if (confirmation.value.err) {
      throw new Error(
        `Solana transaction failed: ${JSON.stringify(confirmation.value.err)}`,
      );
    }

    console.log("Solana transaction confirmed!");

    return {
      signature,
      network: "solana-devnet",
    };
  } catch (error) {
    console.error("Blockchain anchoring error:", error);

    throw error;
  }
};

export const verifyBlockchainTransaction = async (signature: string) => {
  try {
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });

    if (!status.value) {
      return {
        found: false,
        confirmed: false,
        finalized: false,
        error: null,
      };
    }

    return {
      found: true,
      confirmed:
        status.value.confirmationStatus === "confirmed" ||
        status.value.confirmationStatus === "finalized",
      finalized: status.value.confirmationStatus === "finalized",
      error: status.value.err,
      slot: status.value.slot,
    };
  } catch (error) {
    console.error("Blockchain verification error:", error);

    throw error;
  }
};
