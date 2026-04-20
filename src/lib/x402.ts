// x402 protocol helpers
//
// x402 is an open HTTP-native payment protocol (x402.org) championed by
// Circle and Coinbase. A server signals that a resource requires payment
// by returning HTTP 402 Payment Required with structured payment details.
// The client signs a payment authorization, then retries the request with
// the signed payload in the X-PAYMENT header.
//
// We implement x402 with our own EIP-712 intent scheme on Arc. In production
// this would use EIP-3009 TransferWithAuthorization via Circle Gateway.

import { USDC_ADDRESS, USDC_DECIMALS, TREASURY_ADDRESS, arcTestnet, EXPLORER } from "./arc";

// ─── Payment Required (402 response body) ────────────────────────────────

export interface PaymentRequirement {
  scheme: string;
  network: string;
  token: `0x${string}`;
  recipient: `0x${string}`;
  amount: string;          // raw units (e.g. "1000" for 0.001 USDC)
  decimals: number;
  description: string;
  extra: Record<string, unknown>;
}

export function buildPaymentRequired(promptLength: number): PaymentRequirement {
  return {
    scheme: "EIP712-Intent",
    network: `eip155:${arcTestnet.id}`,
    token: USDC_ADDRESS,
    recipient: TREASURY_ADDRESS,
    amount: "1000",         // 0.001 USDC in 6-decimal units
    decimals: USDC_DECIMALS,
    description: `NanoAI query (${promptLength} chars) · $0.001 USDC`,
    extra: {
      explorer: EXPLORER,
      chainId: arcTestnet.id,
      model: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",
    },
  };
}

// ─── Payment header (X-PAYMENT) ─────────────────────────────────────────

export interface PaymentPayload {
  scheme: string;
  intent: {
    payer: `0x${string}`;
    payee: `0x${string}`;
    token: `0x${string}`;
    amount: string;
    nonce: string;
    deadline: string;
    serviceId: `0x${string}`;
  };
  signature: `0x${string}`;
}

export function encodePaymentHeader(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const raw = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(raw) as PaymentPayload;
  } catch {
    return null;
  }
}

// ─── Response header (X-PAYMENT-RESPONSE) ───────────────────────────────

export interface PaymentResponse {
  status: "accepted" | "rejected";
  intentId?: string;
  settlementStatus: "queued" | "settled";
  txHash?: string;
}

export function encodePaymentResponse(pr: PaymentResponse): string {
  return Buffer.from(JSON.stringify(pr)).toString("base64");
}
