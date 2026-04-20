// /api/orders/[id]
//   GET    → fetch one order
//   PATCH  → update status / taker / tx hashes (state transitions)
//   DELETE → cancel order (only by maker, only if open)
//
// State transitions enforced server-side:
//   open      → pending      (taker claim)
//   pending   → filled       (maker fulfilled, both tx hashes set)
//   open      → cancelled    (maker cancels)
//
// Authorization: simplistic — relies on ?caller= address in query string.
// In production, replace with proper auth (sign-in with Ethereum / SIWE).

import { NextResponse, type NextRequest } from "next/server";
import { isAddress, isHash } from "viem";
import {
  getOrder,
  updateOrder,
  deleteOrder,
} from "@/lib/orderStoreServer";
import type { OrderStatus } from "@/lib/orderTypes";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const order = await getOrder(params.id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const order = await getOrder(params.id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    status?: OrderStatus;
    taker?: `0x${string}`;
    takerTxHash?: `0x${string}`;
    makerTxHash?: `0x${string}`;
    caller?: `0x${string}`;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const caller = body.caller?.toLowerCase();
  if (!caller || !isAddress(caller)) {
    return NextResponse.json({ error: "Missing caller" }, { status: 400 });
  }

  // ─── Transition: open → pending (taker claims) ─────────────────────────
  if (body.status === "pending" && order.status === "open") {
    if (!body.taker || !isAddress(body.taker)) {
      return NextResponse.json({ error: "taker required" }, { status: 400 });
    }
    if (body.taker.toLowerCase() === order.maker.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot take your own order" },
        { status: 400 },
      );
    }
    if (caller !== body.taker.toLowerCase()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!body.takerTxHash || !isHash(body.takerTxHash)) {
      return NextResponse.json(
        { error: "takerTxHash required" },
        { status: 400 },
      );
    }
    const updated = await updateOrder(params.id, {
      status: "pending",
      taker: body.taker,
      takerTxHash: body.takerTxHash,
    });
    return NextResponse.json({ order: updated });
  }

  // ─── Transition: pending → filled (maker fulfills) ─────────────────────
  if (body.status === "filled" && order.status === "pending") {
    if (caller !== order.maker.toLowerCase()) {
      return NextResponse.json(
        { error: "Only maker can fulfill" },
        { status: 403 },
      );
    }
    if (!body.makerTxHash || !isHash(body.makerTxHash)) {
      return NextResponse.json(
        { error: "makerTxHash required" },
        { status: 400 },
      );
    }
    const updated = await updateOrder(params.id, {
      status: "filled",
      makerTxHash: body.makerTxHash,
    });
    return NextResponse.json({ order: updated });
  }

  // ─── Transition: open → cancelled (maker cancels) ──────────────────────
  if (body.status === "cancelled" && order.status === "open") {
    if (caller !== order.maker.toLowerCase()) {
      return NextResponse.json(
        { error: "Only maker can cancel" },
        { status: 403 },
      );
    }
    const updated = await updateOrder(params.id, { status: "cancelled" });
    return NextResponse.json({ order: updated });
  }

  return NextResponse.json(
    { error: `Invalid transition from ${order.status} to ${body.status}` },
    { status: 400 },
  );
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const caller = req.nextUrl.searchParams.get("caller")?.toLowerCase();
  if (!caller) return NextResponse.json({ error: "Missing caller" }, { status: 400 });

  const order = await getOrder(params.id);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (caller !== order.maker.toLowerCase()) {
    return NextResponse.json({ error: "Only maker can delete" }, { status: 403 });
  }
  if (order.status !== "open") {
    return NextResponse.json(
      { error: "Only open orders can be deleted" },
      { status: 400 },
    );
  }

  await deleteOrder(params.id);
  return NextResponse.json({ ok: true });
}
