import crypto from "crypto";

export const generateTransactionHash = (data: object): string => {
  // Convert transaction data into a predictable JSON string
  const canonicalData = JSON.stringify(data);

  // SHA-256 hash
  return crypto.createHash("sha256").update(canonicalData).digest("hex");
};
