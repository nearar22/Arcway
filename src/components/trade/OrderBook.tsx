"use client";
// Public order book — every "open" order from every user.
// Polls /api/orders every 5s for live updates.
// Includes inline "Take" action for orders not made by current user.

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Loader2, ArrowRight, Inbox } from "lucide-react";
import {
  ERC20_ABI,
  findToken,
  formatTokenAmount,
} from "@/lib/tokens";
import { fetchOrders, takeOrderApi } from "@/lib/ordersApi";
import type { Order } from "@/lib/orderTypes";
import { cn, shortAddress, timeAgo } from "@/lib/utils";

export default function OrderBook({ refreshKey }: { refreshKey?: number }) {
  const { address } = useAccount();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const list = await fetchOrders({ status: "open" });
      setOrders(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (loading)
    return (
      <p className="py-10 text-center text-[13px] text-[var(--text-faint)]">
        Loading order book…
      </p>
    );

  if (orders.length === 0)
    return (
      <div className="py-10 text-center">
        <Inbox className="h-5 w-5 mx-auto text-[var(--text-faint)] mb-2" />
        <p className="text-[13px] text-[var(--text-faint)]">
          No open orders. Post one above to get started.
        </p>
      </div>
    );

  return (
    <div>
      {orders.map((o) => (
        <OrderRow
          key={o.id}
          order={o}
          isMine={!!address && o.maker.toLowerCase() === address.toLowerCase()}
          onChange={load}
        />
      ))}
    </div>
  );
}

function OrderRow({
  order,
  isMine,
  onChange,
}: {
  order: Order;
  isMine: boolean;
  onChange: () => void;
}) {
  const sellTok = findToken(order.sellToken);
  const buyTok = findToken(order.buyToken);
  const sellLabel = sellTok?.symbol ?? shortAddress(order.sellToken);
  const buyLabel = buyTok?.symbol ?? shortAddress(order.buyToken);
  const sellAmt = sellTok
    ? formatTokenAmount(BigInt(order.sellAmount), sellTok.decimals)
    : order.sellAmount;
  const buyAmt = buyTok
    ? formatTokenAmount(BigInt(order.buyAmount), buyTok.decimals)
    : order.buyAmount;

  return (
    <div className="py-4 border-b border-[var(--border-subtle)] last:border-0 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-[14px] tabular-nums text-rose-300/80">
            {sellAmt} {sellLabel}
          </span>
          <ArrowRight className="h-3 w-3 text-[var(--text-faint)]" />
          <span className="font-medium text-[14px] tabular-nums text-emerald-300/80">
            {buyAmt} {buyLabel}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-faint)]">
          <span>by {shortAddress(order.maker)}</span>
          <span>· {timeAgo(order.createdAt)}</span>
          {order.memo && <span className="truncate">· {order.memo}</span>}
        </div>
      </div>
      <div className="shrink-0">
        {isMine ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
            Your order
          </span>
        ) : (
          <TakeButton order={order} onTaken={onChange} />
        )}
      </div>
    </div>
  );
}

function TakeButton({
  order,
  onTaken,
}: {
  order: Order;
  onTaken: () => void;
}) {
  const { address } = useAccount();
  const buyTok = findToken(order.buyToken);

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When taker tx confirms, claim the order on the backend.
  useEffect(() => {
    if (!isSuccess || !hash || !address) return;
    setRecording(true);
    takeOrderApi(order.id, { taker: address, takerTxHash: hash })
      .then(() => {
        onTaken();
        reset();
      })
      .catch((e) => setError(e.message ?? "Failed to claim order."))
      .finally(() => setRecording(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash, address]);

  function take() {
    if (!address || !buyTok) return;
    setError(null);
    writeContract({
      address: order.buyToken,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [order.maker, BigInt(order.buyAmount)],
    });
  }

  const busy = isPending || confirming || recording;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={take}
        disabled={!address || busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
          busy
            ? "bg-white/[0.04] text-white/40 cursor-wait"
            : "bg-brand-500/15 hover:bg-brand-500/25 text-brand-200 border border-brand-500/20",
        )}
      >
        {busy ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {recording ? "Claiming" : confirming ? "Confirming" : "Sign"}
          </>
        ) : (
          "Take"
        )}
      </button>
      {error && <span className="text-[10px] text-rose-400/80">{error}</span>}
    </div>
  );
}
