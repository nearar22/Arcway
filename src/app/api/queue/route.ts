// GET /api/queue
// Lightweight poll endpoint: returns current pending intents + recent settlements.

import { NextResponse } from "next/server";
import { snapshot } from "@/lib/intentStore";

export async function GET() {
  const s = await snapshot();
  return NextResponse.json({
    pending: s.pending.map((p) => ({
      id: p.id,
      payer: p.intent.payer,
      amount: p.intent.amount.toString(),
      queuedAt: p.queuedAt,
      prompt: p.prompt.slice(0, 60),
    })),
    settled: s.settled
      .filter((b) => b.status !== "failed")
      .map((b) => ({
        id: b.id,
        txHash: b.txHash,
        count: b.intentIds.length,
        totalAmount: b.totalAmount.toString(),
        settledAt: b.settledAt,
        status: b.status,
      })),
    stats: {
      totalQueries: s.totalQueries,
      totalVolume: s.totalVolume,
    },
  });
}
