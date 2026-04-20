// /api/orders
//   GET  → list orders (optional ?status=&maker=&taker= filters)
//   POST → create a new order

import { NextResponse, type NextRequest } from "next/server";
import { isAddress } from "viem";
import { listOrders, createOrder } from "@/lib/orderStoreServer";
import type { CreateOrderInput, OrderStatus } from "@/lib/orderTypes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") as OrderStatus | null;
  const maker = searchParams.get("maker");
  const taker = searchParams.get("taker");

  const orders = await listOrders({
    status: status ?? undefined,
    maker: maker ?? undefined,
    taker: taker ?? undefined,
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  let body: CreateOrderInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validation
  const requiredAddrs: Array<[keyof CreateOrderInput, string | undefined]> = [
    ["maker", body.maker],
    ["sellToken", body.sellToken],
    ["buyToken", body.buyToken],
  ];
  for (const [field, value] of requiredAddrs) {
    if (!value || !isAddress(value)) {
      return NextResponse.json(
        { error: `Invalid ${field} address` },
        { status: 400 },
      );
    }
  }

  const sellAmt = body.sellAmount?.trim();
  const buyAmt = body.buyAmount?.trim();
  if (!sellAmt || !/^\d+$/.test(sellAmt) || sellAmt === "0") {
    return NextResponse.json({ error: "Invalid sellAmount" }, { status: 400 });
  }
  if (!buyAmt || !/^\d+$/.test(buyAmt) || buyAmt === "0") {
    return NextResponse.json({ error: "Invalid buyAmount" }, { status: 400 });
  }

  if (body.sellToken.toLowerCase() === body.buyToken.toLowerCase()) {
    return NextResponse.json(
      { error: "sellToken and buyToken must differ" },
      { status: 400 },
    );
  }

  const memo = body.memo?.slice(0, 200);

  const order = await createOrder({
    maker: body.maker,
    sellToken: body.sellToken,
    sellAmount: sellAmt,
    buyToken: body.buyToken,
    buyAmount: buyAmt,
    memo,
  });

  return NextResponse.json({ order }, { status: 201 });
}
