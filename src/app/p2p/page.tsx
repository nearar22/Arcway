"use client";
// P2P page — Send USDC, Request payment, view Activity.

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { type Address } from "viem";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  ExternalLink,
  Send,
  Inbox,
  History,
  Plus,
  Trash2,
  Repeat2,
} from "lucide-react";
import ConnectButton from "@/components/ConnectButton";
import NetworkGuard from "@/components/NetworkGuard";
import TransferButton from "@/components/TransferButton";
import QrCode from "@/components/QrCode";
import CreateOrderForm from "@/components/trade/CreateOrderForm";
import OrderBook from "@/components/trade/OrderBook";
import MyOrders from "@/components/trade/MyOrders";
import { USDC_ADDRESS, EXPLORER, arcTestnet } from "@/lib/arc";
import { erc20Abi } from "@/lib/erc20";
import { cn, formatUSDC, shortAddress, timeAgo } from "@/lib/utils";
import {
  sendsStore,
  requestsStore,
  type P2PSend,
  type P2PRequest,
} from "@/lib/p2pStore";

type Tab = "trade" | "send" | "request" | "activity";

export default function P2PPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("trade");
  const [tradeRefresh, setTradeRefresh] = useState(0);

  // Prefill from query string: /p2p?to=0x..&amount=5&memo=lunch
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const to = sp.get("to");
    const amt = sp.get("amount");
    const memo = sp.get("memo");
    if (to) setSendTo(to);
    if (amt) setSendAmount(amt);
    if (memo) setSendMemo(memo);
    if (to || amt) setTab("send");
  }, []);

  // ─── Send state ───────────────────────────────────────────────────────
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendMemo, setSendMemo] = useState("");

  // ─── Request state ────────────────────────────────────────────────────
  const [reqAmount, setReqAmount] = useState("");
  const [reqMemo, setReqMemo] = useState("");
  const [createdReq, setCreatedReq] = useState<P2PRequest | null>(null);

  // ─── Stores ───────────────────────────────────────────────────────────
  const [sends, setSends] = useState<P2PSend[]>([]);
  const [requests, setRequests] = useState<P2PRequest[]>([]);

  useEffect(() => {
    const refresh = () => {
      setSends(sendsStore.listFor(address as `0x${string}` | undefined));
      setRequests(requestsStore.listFor(address as `0x${string}` | undefined));
    };
    refresh();
    const off1 = sendsStore.subscribe(refresh);
    const off2 = requestsStore.subscribe(refresh);
    return () => {
      off1();
      off2();
    };
  }, [address]);

  // ─── Balance ──────────────────────────────────────────────────────────
  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as Address],
    chainId: arcTestnet.id,
    query: { enabled: !!address },
  });

  const balanceUsd = balance ? Number(balance) / 1e6 : 0;

  function handleSendSuccess(txHash: `0x${string}`, from: `0x${string}`) {
    if (!sendTo || !/^0x[0-9a-fA-F]{40}$/.test(sendTo)) return;
    sendsStore.add({
      from,
      to: sendTo as `0x${string}`,
      amount: sendAmount,
      memo: sendMemo,
      txHash,
    });
    // clear after a moment so user can see confirmation
    setTimeout(() => {
      setSendAmount("");
      setSendMemo("");
    }, 100);
  }

  function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    if (!/^\d+(\.\d{1,6})?$/.test(reqAmount) || Number(reqAmount) <= 0) return;
    const r = requestsStore.create({
      recipient: address,
      amount: reqAmount,
      memo: reqMemo,
    });
    setCreatedReq(r);
    setReqAmount("");
    setReqMemo("");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Peer-to-peer · USDC
          </p>
          <h1 className="mt-1.5 font-medium text-[28px] leading-[1.1] tracking-[-0.025em]">
            Send. Request. Settle.
          </h1>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-2">
            Send to any address or share a payment-request link.
          </p>
        </div>
        <ConnectButton />
      </div>

      <NetworkGuard />

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {/* ─── Main column ─────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-[var(--border)]">
              {([
                { id: "trade", label: "Trade", icon: Repeat2 },
                { id: "send", label: "Send", icon: ArrowUpRight },
                { id: "request", label: "Request", icon: Inbox },
                { id: "activity", label: "Activity", icon: History },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b -mb-px transition-colors duration-200",
                    tab === t.id
                      ? "border-brand-400 text-white"
                      : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─── Trade ──────────────────────────────────────────── */}
            {tab === "trade" && (
              <div className="space-y-8 animate-fade-in">
                {isConnected ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-5">
                    <CreateOrderForm
                      onCreated={() => setTradeRefresh((r) => r + 1)}
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-1)] p-5 flex items-center justify-between gap-3">
                    <p className="text-[12px] text-[var(--text-tertiary)]">
                      Connect a wallet to post your own order.
                    </p>
                    <ConnectButton />
                  </div>
                )}

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
                    Public order book
                  </p>
                  <OrderBook refreshKey={tradeRefresh} />
                </div>

                {isConnected && (
                  <div className="border-t border-[var(--border)] pt-6">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-3">
                      Your orders
                    </p>
                    <MyOrders refreshKey={tradeRefresh} />
                  </div>
                )}
              </div>
            )}

            {/* ─── Send ───────────────────────────────────────────── */}
            {tab === "send" && !isConnected && <ConnectPrompt />}
            {tab === "send" && isConnected && (
              <div className="space-y-4 animate-fade-in">
                <Field label="Recipient address">
                  <input
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value.trim())}
                    placeholder="0x…"
                    className="w-full rounded-lg bg-[var(--surface-1)] border border-[var(--border)] focus:border-brand-500/30 focus:outline-none px-3.5 py-2.5 text-sm font-mono placeholder:text-white/20 transition-colors"
                  />
                </Field>
                <Field label="Amount (USDC)">
                  <input
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full rounded-lg bg-[var(--surface-1)] border border-[var(--border)] focus:border-brand-500/30 focus:outline-none px-3.5 py-2.5 text-sm placeholder:text-white/20 transition-colors"
                  />
                </Field>
                <Field label="Memo (local only)">
                  <input
                    value={sendMemo}
                    onChange={(e) => setSendMemo(e.target.value)}
                    placeholder="Lunch, rent, …"
                    maxLength={80}
                    className="w-full rounded-lg bg-[var(--surface-1)] border border-[var(--border)] focus:border-brand-500/30 focus:outline-none px-3.5 py-2.5 text-sm placeholder:text-white/20 transition-colors"
                  />
                </Field>

                {/* Quick recipients (recent) */}
                {sends.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] text-[var(--text-faint)] self-center mr-1">
                      Recent:
                    </span>
                    {Array.from(
                      new Map(
                        sends
                          .filter((s) => s.from.toLowerCase() === address!.toLowerCase())
                          .map((s) => [s.to.toLowerCase(), s.to])
                      ).values()
                    )
                      .slice(0, 4)
                      .map((to) => (
                        <button
                          key={to}
                          onClick={() => setSendTo(to)}
                          className="text-[11px] font-mono rounded-md border border-[var(--border)] hover:border-[var(--border-subtle)] px-2 py-1 text-[var(--text-secondary)] hover:text-white/70 transition-colors ease-out-quart"
                        >
                          {shortAddress(to)}
                        </button>
                      ))}
                  </div>
                )}

                <div className="pt-2">
                  <TransferButton
                    to={sendTo as `0x${string}`}
                    amount={sendAmount}
                    onSuccess={handleSendSuccess}
                  />
                </div>
              </div>
            )}

            {/* ─── Request ────────────────────────────────────────── */}
            {tab === "request" && !isConnected && <ConnectPrompt />}
            {tab === "request" && isConnected && (
              <div className="space-y-5 animate-fade-in">
                {!createdReq ? (
                  <form onSubmit={handleCreateRequest} className="space-y-4">
                    <Field label="Amount (USDC)">
                      <input
                        value={reqAmount}
                        onChange={(e) => setReqAmount(e.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        required
                        className="w-full rounded-lg bg-[var(--surface-1)] border border-[var(--border)] focus:border-brand-500/30 focus:outline-none px-3.5 py-2.5 text-sm placeholder:text-white/20 transition-colors"
                      />
                    </Field>
                    <Field label="What's it for?">
                      <input
                        value={reqMemo}
                        onChange={(e) => setReqMemo(e.target.value)}
                        placeholder="Coffee split, freelance work, …"
                        maxLength={120}
                        className="w-full rounded-lg bg-[var(--surface-1)] border border-[var(--border)] focus:border-brand-500/30 focus:outline-none px-3.5 py-2.5 text-sm placeholder:text-white/20 transition-colors"
                      />
                    </Field>
                    <button
                      type="submit"
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ease-out-quart",
                        "bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/15",
                        "disabled:opacity-30 disabled:cursor-not-allowed"
                      )}
                      disabled={
                        !reqAmount ||
                        !/^\d+(\.\d{1,6})?$/.test(reqAmount) ||
                        Number(reqAmount) <= 0
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Create request link
                    </button>
                  </form>
                ) : (
                  <CreatedRequestView
                    req={createdReq}
                    onNew={() => setCreatedReq(null)}
                  />
                )}

                {/* Existing requests */}
                {requests.length > 0 && (
                  <div className="pt-4 border-t border-[var(--border-subtle)]">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-3">
                      Your requests
                    </p>
                    <div className="space-y-1">
                      {requests.slice(0, 8).map((r) => (
                        <RequestRow key={r.id} req={r} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Activity ───────────────────────────────────────── */}
            {tab === "activity" && !isConnected && <ConnectPrompt />}
            {tab === "activity" && isConnected && (
              <div className="animate-fade-in">
                {sends.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-faint)] py-10 text-center">
                    No P2P activity yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {sends.map((s) => (
                      <ActivityRow key={s.id} send={s} self={address!} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Sidebar ─────────────────────────────────────────── */}
          <div className="space-y-5">
            {!isConnected ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-1)] p-5 text-center space-y-3">
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  Connect a wallet to send, request, or take orders.
                </p>
                <ConnectButton />
              </div>
            ) : (
              <>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
                    Balance
                  </p>
                  <p className="font-medium text-[28px] tracking-[-0.025em] tabular-nums">
                    <span className="text-[var(--text-tertiary)] font-mono text-[18px] mr-1">$</span>
                    {balanceUsd.toFixed(2)}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] mt-1">
                    USDC · Arc Testnet
                  </p>
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
                    Your address
                  </p>
                  <AddressBlock address={address!} />
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)] text-[12px] space-y-2 text-[var(--text-tertiary)] leading-relaxed">
                  <p>
                    <span className="text-white/60 font-medium">Send</span> uses{" "}
                    <code className="text-[11px] bg-[var(--surface-2)] px-1 py-0.5 rounded">
                      USDC.transfer
                    </code>
                    . Finalizes in &lt;1s.
                  </p>
                  <p>
                    <span className="text-white/60 font-medium">Request</span> generates a
                    link anyone can pay from any wallet.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function ConnectPrompt() {
  return (
    <div className="py-12 text-center space-y-3 animate-fade-in">
      <h3 className="text-[14px] font-medium text-[var(--text-secondary)]">Connect a wallet</h3>
      <p className="text-[12px] text-[var(--text-tertiary)] max-w-sm mx-auto">
        This action requires signing a transaction.
      </p>
      <div className="inline-block pt-1">
        <ConnectButton />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function CreatedRequestView({
  req,
  onNew,
}: {
  req: P2PRequest;
  onNew: () => void;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/p2p/req/${req.id}`);
  }, [req.id]);

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
          Request created
        </p>
        <h2 className="mt-2 font-medium text-[34px] tracking-[-0.03em] tabular-nums">
          <span className="text-[var(--text-tertiary)] font-mono text-[20px] mr-1">$</span>{formatUSDC(req.amount)}
        </h2>
        {req.memo && (
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">{req.memo}</p>
        )}
      </div>

      {url && (
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          <QrCode value={url} size={140} />
          <div className="flex-1 min-w-0 space-y-3 w-full">
            <p className="text-[11px] text-[var(--text-faint)]">Share link</p>
            <p className="text-[12px] text-[var(--text-secondary)] break-all font-mono leading-relaxed">
              {url}
            </p>
            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-md border border-[var(--border)] hover:border-[var(--border-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-white/70 transition-colors"
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied" : "Copy"}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-[var(--border)] hover:border-[var(--border-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-white/70 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onNew}
        className="text-[12px] text-[var(--text-tertiary)] hover:text-white/60 transition-colors"
      >
        ← Create another
      </button>
    </div>
  );
}

function RequestRow({ req }: { req: P2PRequest }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setUrl(`${window.location.origin}/p2p/req/${req.id}`);
  }, [req.id]);

  return (
    <div className="py-2.5 border-b border-[var(--border-subtle)] last:border-0 flex items-center gap-3">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          req.status === "paid" ? "bg-emerald-400" : "bg-amber-400/60"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-[var(--text-secondary)]">
            ${formatUSDC(req.amount)}
          </span>
          <span className="text-[11px] text-[var(--text-faint)]">
            {timeAgo(req.createdAt)}
          </span>
        </div>
        {req.memo && (
          <p className="text-[12px] text-[var(--text-tertiary)] truncate">
            {req.memo}
          </p>
        )}
      </div>
      {req.status === "paid" && req.txHash ? (
        <a
          href={`${EXPLORER}/tx/${req.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-emerald-400/70 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
        >
          Paid <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ) : (
        <button
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-[11px] text-[var(--text-tertiary)] hover:text-white/60 inline-flex items-center gap-1 transition-colors"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied" : "Copy link"}
        </button>
      )}
      <button
        onClick={() => requestsStore.remove(req.id)}
        className="text-[var(--text-faint)] hover:text-red-400/70 transition-colors"
        aria-label="Delete request"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function ActivityRow({ send, self }: { send: P2PSend; self: `0x${string}` }) {
  const outgoing = send.from.toLowerCase() === self.toLowerCase();
  const counterparty = outgoing ? send.to : send.from;
  return (
    <a
      href={`${EXPLORER}/tx/${send.txHash}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 py-2.5 border-b border-[var(--border-subtle)] last:border-0 hover:bg-white/[0.01] transition-colors -mx-2 px-2 rounded"
    >
      <div
        className={cn(
          "h-7 w-7 rounded-full grid place-items-center shrink-0",
          outgoing ? "bg-red-500/[0.08] text-red-300/70" : "bg-emerald-500/[0.08] text-emerald-300/70"
        )}
      >
        {outgoing ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
            {outgoing ? "Sent to" : "Received from"} {shortAddress(counterparty)}
          </span>
        </div>
        <p className="text-[11px] text-[var(--text-faint)]">
          {timeAgo(send.at)}
          {send.memo ? ` · ${send.memo}` : ""}
        </p>
      </div>
      <span
        className={cn(
          "text-[13px] font-semibold shrink-0 tabular-nums",
          outgoing ? "text-red-300/70" : "text-emerald-300/70"
        )}
      >
        {outgoing ? "−" : "+"}${formatUSDC(send.amount)}
      </span>
    </a>
  );
}

function AddressBlock({ address }: { address: `0x${string}` }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex gap-3 items-start">
        <div className="shrink-0">
          <QrCode value={address} size={72} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-mono text-[var(--text-secondary)] break-all leading-relaxed">
            {address}
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-white/60 transition-colors"
          >
            <Copy className="h-3 w-3" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
