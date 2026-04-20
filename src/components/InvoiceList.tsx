"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { invoiceStore, type Invoice } from "@/lib/storage";
import { EXPLORER } from "@/lib/arc";
import { formatUSDC, shortAddress, timeAgo, cn } from "@/lib/utils";
import { Copy, ExternalLink, Trash2 } from "lucide-react";

function StatusDot({ status }: { status: Invoice["status"] }) {
  const color =
    status === "paid" ? "bg-emerald-400" :
    status === "expired" ? "bg-red-400/60" :
    "bg-amber-400/60";
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/40">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {status === "paid" ? "Paid" : status === "expired" ? "Expired" : "Pending"}
    </span>
  );
}

interface Props {
  refresh?: number;
}

export default function InvoiceList({ refresh }: Props) {
  const { address } = useAccount();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  function load() {
    if (!address) { setInvoices([]); return; }
    setInvoices(invoiceStore.list().filter((i) => i.merchant.toLowerCase() === address.toLowerCase()));
  }

  useEffect(() => { load(); }, [address, refresh]);

  useEffect(() => {
    return invoiceStore.subscribe(load);
  }, [address]);

  function copyLink(id: string) {
    const url = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function remove(id: string) {
    if (confirm("Delete this invoice?")) invoiceStore.remove(id);
  }

  if (!address)
    return (
      <p className="py-10 text-center text-[13px] text-[var(--text-faint)]">
        Connect your wallet to view invoices.
      </p>
    );

  if (invoices.length === 0)
    return (
      <p className="py-10 text-center text-[13px] text-[var(--text-faint)]">
        No invoices yet. Create one above.
      </p>
    );

  return (
    <div>
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="py-4 border-b border-[var(--border-subtle)] last:border-0 flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-medium text-[15px] tracking-tight text-white tabular-nums">
                ${formatUSDC(inv.amount)}
              </span>
              <StatusDot status={inv.status} />
            </div>
            <p className="text-[13px] text-[var(--text-secondary)] truncate mt-0.5">{inv.description}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--text-faint)]">
              <span>{timeAgo(inv.createdAt)}</span>
              {inv.payer && <span>· {shortAddress(inv.payer)}</span>}
              {inv.txHash && (
                <a
                  href={`${EXPLORER}/tx/${inv.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-300/60 hover:text-brand-300 inline-flex items-center gap-0.5 transition-colors"
                >
                  Tx <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href={`/pay/${inv.id}`}
              target="_blank"
              className="rounded-md border border-[var(--border)] hover:border-[var(--border-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-white/70 transition-colors ease-out-quart"
            >
              View
            </Link>
            <button
              onClick={() => copyLink(inv.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-[12px] transition-colors ease-out-quart flex items-center gap-1",
                copied === inv.id
                  ? "border-emerald-500/30 text-emerald-400/80"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:text-white/70 hover:border-[var(--border-subtle)]"
              )}
            >
              <Copy className="h-3 w-3" />
              {copied === inv.id ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => remove(inv.id)}
              className="rounded-md border border-[var(--border)] p-1.5 text-[var(--text-faint)] hover:text-red-400/70 hover:border-red-500/20 transition-colors ease-out-quart"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
