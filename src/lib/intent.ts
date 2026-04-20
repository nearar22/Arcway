// EIP-712 signed spend intents for gasless NanoAI queries.
//
// Flow:
//   1. User approves USDC allowance to the batcher wallet (one-time, on-chain).
//   2. For each query, user signs an Intent off-chain (gasless).
//   3. Backend verifies signature, serves AI response instantly, queues intent.
//   4. Periodically, backend settles batch by calling transferFrom for each intent.
//
// Intent signatures are the cryptographic proof that the user authorized
// a specific amount for a specific service at a specific time.

import { arcTestnet, USDC_ADDRESS } from "./arc";

export const INTENT_DOMAIN = {
  name: "NanoAI",
  version: "1",
  chainId: arcTestnet.id,
  verifyingContract: USDC_ADDRESS,
} as const;

export const INTENT_TYPES = {
  Intent: [
    { name: "payer", type: "address" },
    { name: "payee", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "serviceId", type: "bytes32" },
  ],
} as const;

export type Intent = {
  payer: `0x${string}`;
  payee: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
  serviceId: `0x${string}`;
};

export type SignedIntent = {
  intent: Intent;
  signature: `0x${string}`;
  promptHash: `0x${string}`;
};

// Service IDs (bytes32) — use keccak256("service-name") in production.
// For demo, we use fixed-length identifiers padded to 32 bytes.
export const SERVICE_NANOAI = ("0x" +
  "6e616e6f6169" + // "nanoai"
  "0".repeat(64 - 12)) as `0x${string}`;
