// POST /api/ask — x402 Protocol Endpoint
//
// Implements the x402 open payment standard (x402.org):
//   Step 1: Client sends prompt without payment → receives HTTP 402
//   Step 2: Client signs EIP-712 intent (off-chain, zero gas)
//   Step 3: Client retries with X-PAYMENT header → receives AI response
//
// This is the Circle Nanopayments flow: gasless per-request authorization
// with batched on-chain settlement.

import { NextRequest, NextResponse } from "next/server";
import { verifyTypedData, keccak256, toBytes, parseUnits } from "viem";
import { USDC_ADDRESS } from "@/lib/arc";
import { INTENT_DOMAIN, INTENT_TYPES, SERVICE_NANOAI, type Intent } from "@/lib/intent";
import { addIntent } from "@/lib/intentStore";
import { askLLM } from "@/lib/llm";
import {
  buildPaymentRequired,
  decodePaymentHeader,
  encodePaymentResponse,
  type PaymentPayload,
} from "@/lib/x402";

const TREASURY = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? "") as `0x${string}`;
const MIN_AMOUNT = parseUnits("0.001", 6);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { prompt } = body as { prompt?: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!TREASURY) {
    return NextResponse.json(
      { error: "Server misconfigured: TREASURY address missing" },
      { status: 500 }
    );
  }

  // ─── Check for X-PAYMENT header ────────────────────────────────────────
  const paymentHeader = req.headers.get("X-PAYMENT");

  // ── Step 1: No payment → return 402 Payment Required ───────────────────
  if (!paymentHeader) {
    const requirement = buildPaymentRequired(prompt.trim().length);
    return NextResponse.json(
      {
        type: "x402",
        version: "1",
        error: "Payment Required",
        accepts: [requirement],
      },
      {
        status: 402,
        headers: {
          "X-PAYMENT-REQUIRED": "true",
          "X-PAYMENT-SCHEME": "EIP712-Intent",
        },
      }
    );
  }

  // ── Step 2: Payment present → verify and serve ─────────────────────────
  const payment = decodePaymentHeader(paymentHeader);
  if (!payment) {
    return NextResponse.json(
      { error: "Malformed X-PAYMENT header" },
      { status: 400 }
    );
  }

  const rawIntent = payment.intent;
  const intent: Intent = {
    payer: rawIntent.payer,
    payee: rawIntent.payee,
    token: rawIntent.token,
    amount: BigInt(rawIntent.amount),
    nonce: BigInt(rawIntent.nonce),
    deadline: BigInt(rawIntent.deadline),
    serviceId: rawIntent.serviceId,
  };

  // Validate intent fields
  if (intent.token.toLowerCase() !== USDC_ADDRESS.toLowerCase()) {
    return NextResponse.json({ error: "Wrong token" }, { status: 400 });
  }
  if (intent.payee.toLowerCase() !== TREASURY.toLowerCase()) {
    return NextResponse.json({ error: "Wrong payee" }, { status: 400 });
  }
  if (intent.serviceId.toLowerCase() !== SERVICE_NANOAI.toLowerCase()) {
    return NextResponse.json({ error: "Wrong serviceId" }, { status: 400 });
  }
  if (intent.amount < MIN_AMOUNT) {
    return NextResponse.json({ error: "Amount too small" }, { status: 400 });
  }
  if (intent.deadline < BigInt(Math.floor(Date.now() / 1000))) {
    return NextResponse.json({ error: "Intent expired" }, { status: 400 });
  }

  // Verify EIP-712 signature
  const valid = await verifyTypedData({
    address: intent.payer,
    domain: INTENT_DOMAIN,
    types: INTENT_TYPES,
    primaryType: "Intent",
    message: intent,
    signature: payment.signature,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Call LLM
  let answer: string;
  try {
    answer = await askLLM(prompt.trim());
  } catch (e: any) {
    return NextResponse.json(
      { error: `LLM error: ${e?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  // Queue intent for batch settlement
  const promptHash = keccak256(toBytes(prompt.trim())) as `0x${string}`;
  const queued = await addIntent({
    intent,
    signature: payment.signature,
    promptHash,
    prompt: prompt.trim(),
    answer,
  });

  // Build x402 payment response
  const paymentResponse = encodePaymentResponse({
    status: "accepted",
    intentId: queued.id,
    settlementStatus: "queued",
  });

  return NextResponse.json(
    {
      answer,
      intentId: queued.id,
      cost: "0.001",
      gasPaidByUser: "0",
      timestamp: Date.now(),
    },
    {
      headers: {
        "X-PAYMENT-RESPONSE": paymentResponse,
      },
    }
  );
}
