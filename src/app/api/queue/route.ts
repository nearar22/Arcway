// GET /api/queue?payer=0x...
// Returns pending intents for the given payer (or all if no payer).
// Settled batches and global stats stay public — they're already on-chain.

import { NextResponse, type NextRequest } from "next/server";
import { snapshot } from "@/lib/intentStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const payerParam = req.nextUrl.searchParams.get("payer");
  const payer = payerParam?.toLowerCase();

  const s = await snapshot();

  const pendingForUser = payer
    ? s.pending.filter((p) => p.intent.payer.toLowerCase() === payer)
    : s.pending;

  return NextResponse.json({
    pending: pendingForUser.map((p) => ({
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
