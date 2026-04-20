"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { invoiceStore, type Invoice } from "@/lib/storage";
import { EXPLORER } from "@/lib/arc";
import { formatUSDC, shortAddress } from "@/lib/utils";
import ConnectButton from "@/components/ConnectButton";
import PayButton from "@/components/PayButton";
import QrCode from "@/components/QrCode";
import NetworkGuard from "@/components/NetworkGuard";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
    setInvoice(invoiceStore.get(id) ?? null);
  }, [id]);

  useEffect(() => {
    return invoiceStore.subscribe(() => setInvoice(invoiceStore.get(id) ?? null));
  }, [id]);

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (invoice === undefined)
    return <div className="min-h-[60vh] grid place-items-center text-[var(--text-tertiary)]">Loading…</div>;

  if (invoice === null)
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center space-y-3">
          <h1 className="font-medium text-[18px] tracking-[-0.012em]">Invoice not found</h1>
          <p className="text-[13px] text-[var(--text-tertiary)]">ID: <code className="bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[12px]">{id}</code></p>
          <Link href="/dashboard" className="text-brand-300/70 hover:text-brand-300 text-[13px] transition-colors">← Merchant</Link>
        </div>
      </div>
    );

  const isPaid = invoice.status === "paid";

  return (
    <div className="max-w-md mx-auto py-8 animate-fade-up">
      {/* Amount + status */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
            Invoice
          </p>
          <h1 className="font-medium text-[44px] leading-none tracking-[-0.04em] tabular-nums">
            <span className="text-[var(--text-tertiary)] font-mono text-[24px] mr-1">$</span>{formatUSDC(invoice.amount)}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mt-2">
            USDC · Arc Testnet
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-[12px] font-medium mt-2 ${
          isPaid ? "text-emerald-400/70" : "text-amber-400/60"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? "bg-emerald-400" : "bg-amber-400/60"}`} />
          {isPaid ? "Paid" : "Pending"}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-3 mb-8">
        <div className="flex justify-between items-baseline text-[13px] border-b border-[var(--border-subtle)] pb-3">
          <span className="text-[var(--text-tertiary)]">Description</span>
          <span className="text-[var(--text-secondary)] text-right max-w-[60%] truncate">{invoice.description}</span>
        </div>
        <div className="flex justify-between items-baseline text-[13px] border-b border-[var(--border-subtle)] pb-3">
          <span className="text-[var(--text-tertiary)]">Merchant</span>
          <span className="text-[var(--text-secondary)] font-mono text-[12px]">{shortAddress(invoice.merchant)}</span>
        </div>
        {isPaid && invoice.txHash && (
          <div className="flex justify-between items-baseline text-[13px] border-b border-[var(--border-subtle)] pb-3">
            <span className="text-[var(--text-tertiary)]">Transaction</span>
            <a href={`${EXPLORER}/tx/${invoice.txHash}`} target="_blank" rel="noreferrer"
              className="text-brand-300/70 hover:text-brand-300 inline-flex items-center gap-1 font-mono text-[12px] transition-colors">
              {shortAddress(invoice.txHash)} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )}
      </div>

      {/* QR */}
      {!isPaid && url && (
        <div className="flex flex-col items-center gap-3 mb-8">
          <QrCode value={url} size={140} />
          <p className="text-[11px] text-[var(--text-faint)]">Scan to open on mobile</p>
        </div>
      )}

      {/* Actions */}
      {!isPaid && (
        <div className="space-y-4 mb-8">
          <div className="flex justify-center"><ConnectButton /></div>
          <NetworkGuard />
          <PayButton invoice={invoice} onSuccess={() => setInvoice(invoiceStore.get(id) ?? null)} />
        </div>
      )}

      {isPaid && (
        <div className="text-center py-6 mb-8">
          <CheckCircle2 className="h-6 w-6 text-emerald-400/70 mx-auto mb-2" />
          <p className="font-medium text-[15px] tracking-tight text-emerald-300/80">Payment complete</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mt-2">
            Settled on Arc
          </p>
        </div>
      )}

      {/* Share link */}
      {!isPaid && url && (
        <div className="flex gap-3 items-center border-t border-[var(--border-subtle)] pt-5 mb-6">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[var(--text-faint)] mb-0.5">Checkout link</p>
            <p className="text-[12px] text-[var(--text-secondary)] truncate">{url}</p>
          </div>
          <button onClick={copyUrl}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] hover:border-[var(--border-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-white/70 transition-colors ease-out-quart shrink-0">
            <Copy className="h-3 w-3" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      <p className="text-center text-[11px] text-[var(--text-faint)] pt-4">
        <Link href="/" className="hover:text-white/40 transition-colors">Arc Pay</Link>
        {" · "}
        <a href="https://docs.arc.network" target="_blank" rel="noreferrer" className="hover:text-white/40 transition-colors">Docs</a>
      </p>
    </div>
  );
}
