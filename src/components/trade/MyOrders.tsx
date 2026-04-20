"use client";
// User's orders inbox. Shows:
//   • Pending orders that need fulfillment (taker has paid, you owe them sellToken)
//   • Your open orders (with cancel button)
//   • Recently filled orders (history)

import { useEffect, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  ArrowRight,
  Loader2,
  ExternalLink,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  ERC20_ABI,
  findToken,
  formatTokenAmount,
} from "@/lib/tokens";
import {
  fetchOrders,
  fulfillOrderApi,
  cancelOrderApi,
} from "@/lib/ordersApi";
import type { Order } from "@/lib/orderTypes";
import { EXPLORER } from "@/lib/arc";
import { cn, shortAddress, timeAgo } from "@/lib/utils";

export default function MyOrders({ refreshKey }: { refreshKey?: number }) {
  const { address } = useAccount();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!address) return;
    try {
      const list = await fetchOrders({ maker: address });
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
  }, [address, refreshKey]);

  if (!address) return null;
  if (loading)
    return (
      <p className="py-6 text-center text-[12px] text-[var(--text-faint)]">
        Loading…
      </p>
    );

  const pending = orders.filter((o) => o.status === "pending");
  const open = orders.filter((o) => o.status === "open");
  const recent = orders
    .filter((o) => o.status === "filled" || o.status === "cancelled")
    .slice(0, 5);

  if (orders.length === 0)
    return (
      <p className="py-6 text-center text-[12px] text-[var(--text-faint)]">
        You haven&apos;t posted any orders yet.
      </p>
    );

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Section
          title="Action required"
          subtitle="Taker has paid. Send your side to complete the trade."
          orders={pending}
          renderActions={(o) => <FulfillButton order={o} onDone={load} />}
        />
      )}
      {open.length > 0 && (
        <Section
          title="Open orders"
          orders={open}
          renderActions={(o) => <CancelButton order={o} onDone={load} />}
        />
      )}
      {recent.length > 0 && (
        <Section
          title="Recent"
          orders={recent}
          renderActions={(o) => <StatusBadge status={o.status} />}
        />
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  orders,
  renderActions,
}: {
  title: string;
  subtitle?: string;
  orders: Order[];
  renderActions: (o: Order) => React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
          {title}
        </p>
        {subtitle && (
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      <div>
        {orders.map((o) => (
          <OrderRow key={o.id} order={o}>
            {renderActions(o)}
          </OrderRow>
        ))}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  children,
}: {
  order: Order;
  children: React.ReactNode;
}) {
  const sellTok = findToken(order.sellToken);
  const buyTok = findToken(order.buyToken);
  const sellAmt = sellTok
    ? formatTokenAmount(BigInt(order.sellAmount), sellTok.decimals)
    : order.sellAmount;
  const buyAmt = buyTok
    ? formatTokenAmount(BigInt(order.buyAmount), buyTok.decimals)
    : order.buyAmount;

  return (
    <div className="py-3 border-b border-[var(--border-subtle)] last:border-0 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-[13px] tabular-nums text-rose-300/80">
            {sellAmt} {sellTok?.symbol ?? "?"}
          </span>
          <ArrowRight className="h-3 w-3 text-[var(--text-faint)]" />
          <span className="font-medium text-[13px] tabular-nums text-emerald-300/80">
            {buyAmt} {buyTok?.symbol ?? "?"}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-[var(--text-faint)]">
          <span>{timeAgo(order.createdAt)}</span>
          {order.taker && <span>· taker {shortAddress(order.taker)}</span>}
          {order.takerTxHash && (
            <a
              href={`${EXPLORER}/tx/${order.takerTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-brand-300 transition-colors flex items-center gap-0.5"
            >
              · paid <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          {order.makerTxHash && (
            <a
              href={`${EXPLORER}/tx/${order.makerTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-brand-300 transition-colors flex items-center gap-0.5"
            >
              · fulfilled <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function FulfillButton({
  order,
  onDone,
}: {
  order: Order;
  onDone: () => void;
}) {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuccess || !hash || !address) return;
    setRecording(true);
    fulfillOrderApi(order.id, { caller: address, makerTxHash: hash })
      .then(() => {
        onDone();
        reset();
      })
      .catch((e) => setError(e.message ?? "Failed to record fulfillment."))
      .finally(() => setRecording(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash, address]);

  function fulfill() {
    if (!order.taker) return;
    setError(null);
    writeContract({
      address: order.sellToken,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [order.taker, BigInt(order.sellAmount)],
    });
  }

  const busy = isPending || confirming || recording;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={fulfill}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
          busy
            ? "bg-white/[0.04] text-white/40 cursor-wait"
            : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/20",
        )}
      >
        {busy ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {recording ? "Recording" : confirming ? "Confirming" : "Sign"}
          </>
        ) : (
          <>
            <AlertTriangle className="h-3 w-3" />
            Fulfill
          </>
        )}
      </button>
      {error && <span className="text-[10px] text-rose-400/80">{error}</span>}
    </div>
  );
}

function CancelButton({
  order,
  onDone,
}: {
  order: Order;
  onDone: () => void;
}) {
  const { address } = useAccount();
  const [cancelling, setCancelling] = useState(false);

  async function cancel() {
    if (!address) return;
    setCancelling(true);
    try {
      await cancelOrderApi(order.id, address);
      onDone();
    } catch {}
    setCancelling(false);
  }

  return (
    <button
      onClick={cancel}
      disabled={cancelling}
      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-[var(--text-faint)] hover:text-rose-300 hover:bg-rose-500/5 transition-colors disabled:opacity-40"
    >
      {cancelling ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Trash2 className="h-3 w-3" />
      )}
      Cancel
    </button>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  const map = {
    filled: { label: "Filled", color: "text-emerald-300/80 bg-emerald-500/10" },
    cancelled: { label: "Cancelled", color: "text-[var(--text-faint)] bg-white/[0.04]" },
    open: { label: "Open", color: "text-amber-300/80 bg-amber-500/10" },
    pending: { label: "Pending", color: "text-amber-300/80 bg-amber-500/10" },
  } as const;
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium",
        s.color,
      )}
    >
      {s.label}
    </span>
  );
}
