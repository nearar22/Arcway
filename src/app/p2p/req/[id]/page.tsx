"use client";
// Public payment page for a P2P request.
// Anyone with the link can connect a wallet and pay the requester.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import ConnectButton from "@/components/ConnectButton";
import NetworkGuard from "@/components/NetworkGuard";
import TransferButton from "@/components/TransferButton";
import QrCode from "@/components/QrCode";
import { EXPLORER } from "@/lib/arc";
import { formatUSDC, shortAddress, timeAgo } from "@/lib/utils";
import { requestsStore, sendsStore, type P2PRequest } from "@/lib/p2pStore";

export default function RequestPayPage() {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<P2PRequest | null | undefined>(undefined);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
    setReq(requestsStore.get(id) ?? null);
  }, [id]);

  useEffect(() => {
    return requestsStore.subscribe(() =>
      setReq(requestsStore.get(id) ?? null)
    );
  }, [id]);

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePaid(txHash: `0x${string}`, from: `0x${string}`) {
    if (!req) return;
    requestsStore.update(req.id, {
      status: "paid",
      paidAt: Date.now(),
      txHash,
      payer: from,
    });
    // record on sender's history too
    sendsStore.add({
      from,
      to: req.recipient,
      amount: req.amount,
      memo: req.memo || "P2P request",
      txHash,
    });
  }

  if (req === undefined)
    return (
      <div className="min-h-[60vh] grid place-items-center text-[var(--text-tertiary)]">
        Loading…
      </div>
    );

  if (req === null)
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center space-y-3">
          <h1 className="font-medium text-[18px] tracking-[-0.012em]">Request not found</h1>
          <p className="text-[13px] text-[var(--text-tertiary)]">
            ID:{" "}
            <code className="bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[12px]">
              {id}
            </code>
          </p>
          <p className="text-[12px] text-[var(--text-faint)] max-w-xs mx-auto leading-relaxed">
            Requests are stored locally in the creator&apos;s browser. The link
            only works on the device that created it (demo limitation).
          </p>
          <Link
            href="/p2p"
            className="text-brand-300/70 hover:text-brand-300 text-[13px] transition-colors inline-block"
          >
            ← P2P
          </Link>
        </div>
      </div>
    );

  const isPaid = req.status === "paid";

  return (
    <div className="max-w-md mx-auto py-8 animate-fade-up">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
            Payment request
          </p>
          <h1 className="font-medium text-[44px] leading-none tracking-[-0.04em] tabular-nums">
            <span className="text-[var(--text-tertiary)] font-mono text-[24px] mr-1">$</span>{formatUSDC(req.amount)}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mt-2">
            USDC · Arc Testnet
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 text-[12px] font-medium mt-2 ${
            isPaid ? "text-emerald-400/70" : "text-amber-400/60"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isPaid ? "bg-emerald-400" : "bg-amber-400/60"
            }`}
          />
          {isPaid ? "Paid" : "Pending"}
        </span>
      </div>

      <div className="space-y-3 mb-8">
        {req.memo && (
          <div className="flex justify-between items-baseline text-[13px] border-b border-[var(--border-subtle)] pb-3 gap-3">
            <span className="text-[var(--text-tertiary)] shrink-0">For</span>
            <span className="text-[var(--text-secondary)] text-right break-words">
              {req.memo}
            </span>
          </div>
        )}
        <div className="flex justify-between items-baseline text-[13px] border-b border-[var(--border-subtle)] pb-3">
          <span className="text-[var(--text-tertiary)]">Requested by</span>
          <span className="text-[var(--text-secondary)] font-mono text-[12px]">
            {shortAddress(req.recipient)}
          </span>
        </div>
        <div className="flex justify-between items-baseline text-[13px] border-b border-[var(--border-subtle)] pb-3">
          <span className="text-[var(--text-tertiary)]">Created</span>
          <span className="text-[var(--text-secondary)] text-[12px]">
            {timeAgo(req.createdAt)}
          </span>
        </div>
        {isPaid && req.txHash && (
          <div className="flex justify-between items-baseline text-[13px] border-b border-[var(--border-subtle)] pb-3">
            <span className="text-[var(--text-tertiary)]">Transaction</span>
            <a
              href={`${EXPLORER}/tx/${req.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-brand-300/70 hover:text-brand-300 inline-flex items-center gap-1 font-mono text-[12px] transition-colors"
            >
              {shortAddress(req.txHash)} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )}
      </div>

      {!isPaid && url && (
        <div className="flex flex-col items-center gap-3 mb-8">
          <QrCode value={url} size={140} />
          <p className="text-[11px] text-[var(--text-faint)]">
            Scan to open on mobile
          </p>
        </div>
      )}

      {!isPaid && (
        <div className="space-y-4 mb-8">
          <div className="flex justify-center">
            <ConnectButton />
          </div>
          <NetworkGuard />
          <TransferButton
            to={req.recipient}
            amount={req.amount}
            label={`Pay $${formatUSDC(req.amount)} USDC`}
            onSuccess={handlePaid}
          />
        </div>
      )}

      {isPaid && (
        <div className="text-center py-6 mb-8">
          <CheckCircle2 className="h-6 w-6 text-emerald-400/70 mx-auto mb-2" />
          <p className="font-medium text-[15px] tracking-tight text-emerald-300/80">
            Payment complete
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mt-2">
            Settled on Arc {req.payer ? `· from ${shortAddress(req.payer)}` : ""}
          </p>
        </div>
      )}

      {!isPaid && url && (
        <div className="flex gap-3 items-center border-t border-[var(--border-subtle)] pt-5 mb-6">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[var(--text-faint)] mb-0.5">
              Request link
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] truncate">
              {url}
            </p>
          </div>
          <button
            onClick={copyUrl}
            className="flex items-center gap-1.5 rounded-md border border-[var(--border)] hover:border-[var(--border-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-white/70 transition-colors ease-out-quart shrink-0"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      <p className="text-center text-[11px] text-[var(--text-faint)] pt-4">
        <Link href="/p2p" className="hover:text-white/40 transition-colors">
          P2P
        </Link>
        {" · "}
        <Link href="/" className="hover:text-white/40 transition-colors">
          Arc Pay
        </Link>
      </p>
    </div>
  );
}
