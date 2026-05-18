"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { maxUint256, parseUnits, type Address } from "viem";
import {
  USDC_ADDRESS,
  arcTestnet,
  TREASURY_ADDRESS,
  EXPLORER,
} from "@/lib/arc";
import { erc20Abi } from "@/lib/erc20";
import { shortAddress, cn, timeAgo } from "@/lib/utils";
import ConnectButton from "@/components/ConnectButton";
import NetworkGuard from "@/components/NetworkGuard";
import {
  INTENT_DOMAIN,
  INTENT_TYPES,
  SERVICE_NANOAI,
} from "@/lib/intent";
import {
  Cpu,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";

const QUERY_AMOUNT = parseUnits("0.001", 6); // 0.001 USDC in 6-decimal units
const QUERY_USD = 0.001;
const ETH_GAS_PER_TX = 2.5;

const QUICK_PROMPTS = [
  "What is Circle USDC and how is it backed?",
  "Explain Arc Network's Malachite consensus in simple terms",
  "Why are nanopayments impossible on Ethereum mainnet?",
  "Write a Python snippet that calls a paid API",
];

type Phase = "idle" | "signing" | "asking" | "done" | "error";

type HistoryEntry = {
  id: string;
  prompt: string;
  answer: string;
  at: number;
};

type QueueView = {
  pending: {
    id: string;
    payer: string;
    amount: string;
    queuedAt: number;
    prompt: string;
  }[];
  settled: {
    id: string;
    txHash: string;
    count: number;
    totalAmount: string;
    settledAt: number;
    status: string;
  }[];
  stats: { totalQueries: number; totalVolume: string };
};

export default function AskPage() {
  const { address, isConnected } = useAccount();
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [queue, setQueue] = useState<QueueView | null>(null);
  const [settling, setSettling] = useState(false);

  // --- Allowance check ---
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address as Address, TREASURY_ADDRESS],
    chainId: arcTestnet.id,
    query: { enabled: !!address && !!TREASURY_ADDRESS },
  });

  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as Address],
    chainId: arcTestnet.id,
    query: { enabled: !!address },
  });

  const approved =
    !!allowance && (allowance as bigint) >= parseUnits("10", 6);

  // --- Approval write ---
  const {
    writeContract: writeApprove,
    data: approveTx,
    isPending: approvePending,
    error: approveError,
  } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveTx });

  useEffect(() => {
    if (approveConfirmed) refetchAllowance();
  }, [approveConfirmed, refetchAllowance]);

  // --- Sign typed data ---
  const { signTypedDataAsync } = useSignTypedData();

  // --- Load history ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nanoai_gasless_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "nanoai_gasless_history",
        JSON.stringify(history.slice(0, 30))
      );
    } catch {}
  }, [history]);

  // --- Poll queue (scoped to connected wallet) ---
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const url = address
          ? `/api/queue?payer=${address}`
          : "/api/queue";
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (alive) setQueue(data);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [address]);

  // --- Submit query (x402 two-step flow) ---
  async function submitQuery() {
    if (!address || !prompt.trim() || !approved || !TREASURY_ADDRESS) return;
    setErrorMsg("");
    setAnswer("");
    setPhase("signing");

    try {
      // Step 1: Request resource → receive 402 Payment Required
      const step1 = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const paymentReq = await step1.json();

      if (step1.status !== 402) {
        throw new Error(paymentReq.error || `Unexpected status ${step1.status}`);
      }

      const requirement = paymentReq.accepts?.[0];
      if (!requirement) throw new Error("No payment option in 402 response");

      // Step 2: Sign EIP-712 intent (off-chain, zero gas)
      const intent = {
        payer: address as `0x${string}`,
        payee: TREASURY_ADDRESS as `0x${string}`,
        token: USDC_ADDRESS as `0x${string}`,
        amount: QUERY_AMOUNT,
        nonce: BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000)),
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        serviceId: SERVICE_NANOAI,
      };

      const signature = await signTypedDataAsync({
        domain: INTENT_DOMAIN,
        types: INTENT_TYPES,
        primaryType: "Intent",
        message: intent,
      });

      // Step 3: Retry with X-PAYMENT header → receive response
      setPhase("asking");

      const paymentPayload = btoa(JSON.stringify({
        scheme: "EIP712-Intent",
        intent: {
          ...intent,
          amount: intent.amount.toString(),
          nonce: intent.nonce.toString(),
          deadline: intent.deadline.toString(),
        },
        signature,
      }));

      const step2 = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": paymentPayload,
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await step2.json();
      if (!step2.ok) throw new Error(data.error || "Request failed");

      setAnswer(data.answer);
      setHistory((h) => [
        {
          id: data.intentId,
          prompt: prompt.trim(),
          answer: data.answer,
          at: Date.now(),
        },
        ...h,
      ]);
      setPhase("done");
    } catch (e: any) {
      setErrorMsg(e?.shortMessage ?? e?.message ?? "Unknown error");
      setPhase("error");
    }
  }

  async function triggerSettlement() {
    setSettling(true);
    try {
      await fetch("/api/settle", { method: "POST" });
    } catch {}
    setSettling(false);
  }

  const totalPaid = history.length * QUERY_USD;
  const ethEquiv = history.length * ETH_GAS_PER_TX;

  const phaseLabel: Record<Phase, string> = {
    idle: "Sign & Ask",
    signing: "Sign intent in wallet…",
    asking: "Querying AI…",
    done: "Ask again",
    error: "Try again",
  };

  const canSubmit =
    isConnected &&
    approved &&
    !!prompt.trim() &&
    phase !== "signing" &&
    phase !== "asking" &&
    !!TREASURY_ADDRESS;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 animate-fade-up">
        <div>
          <div className="text-xs uppercase tracking-wider text-primary font-medium">
            x402 · Pay-per-query
          </div>
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-semibold tracking-tight">
            Ask the agent
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Micropayments at agent-speed. $0.001 USDC per query, batched on Arc.
            <span className="ml-2 font-mono text-xs text-muted-foreground/70 tabular-nums">
              · {history.length} sent · ${totalPaid.toFixed(3)} spent
            </span>
          </p>
        </div>
        <ConnectButton />
      </div>

      <NetworkGuard />

      {!isConnected ? (
        <EmptyState
          icon={<Cpu className="h-8 w-8" />}
          title="Connect a wallet to begin"
          desc="Use MetaMask on Arc Testnet. You\u2019ll approve USDC once, then queries are gasless."
        />
      ) : !approved ? (
        <ApprovalCard
          onApprove={() =>
            writeApprove({
              address: USDC_ADDRESS,
              abi: erc20Abi,
              functionName: "approve",
              args: [TREASURY_ADDRESS, maxUint256],
            })
          }
          pending={approvePending || approveConfirming}
          error={approveError?.message}
        />
      ) : (
        <div className="grid lg:grid-cols-[1fr_360px] gap-6 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {/* Main panel */}
          <div className="space-y-6">
            {/* Prompt card */}
            <div className="rounded-2xl border border-white/[0.06] bg-surface p-5">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask anything — payments routing, on-chain analysis, contract reads…"
                rows={4}
                className="w-full bg-transparent border-0 p-0 text-base placeholder:text-muted-foreground/70 focus:outline-none resize-none"
              />

              <div className="flex gap-1.5 overflow-x-auto pb-1 mt-3 sm:flex-wrap sm:overflow-visible scrollbar-none">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setPrompt(q)}
                    className="text-[11px] rounded-full border border-white/10 hover:border-white/20 px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0 sm:shrink sm:whitespace-normal"
                  >
                    {q.slice(0, 40)}…
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
                <div className="text-xs text-muted-foreground">
                  Settlement <span className="font-mono text-foreground">x402</span> · Bal{" "}
                  <span className="font-mono text-foreground tabular-nums">
                    ${balance ? (Number(balance) / 1e6).toFixed(2) : "0.00"}
                  </span>
                </div>
                <button
                  onClick={submitQuery}
                  disabled={!canSubmit}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    canSubmit
                      ? "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_8px_24px_-8px_rgba(124,92,255,0.6)]"
                      : "bg-white/[0.04] text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {phase === "signing" || phase === "asking" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {phaseLabel[phase]}
                </button>
              </div>
            </div>

            {/* Phase indicator */}
            {(phase === "signing" || phase === "asking") && (
              <div className="rounded-2xl bg-surface border border-white/[0.06] p-4 flex gap-3 animate-fade-in">
                <Loader2 className="h-4 w-4 animate-spin text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {phase === "signing" && "Sign spend intent"}
                    {phase === "asking" && "Querying AI…"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {phase === "signing" && "Server returned 402. Confirm the off-chain intent. No gas."}
                    {phase === "asking" && "X-PAYMENT header attached. Verifying and serving."}
                  </p>
                </div>
              </div>
            )}

            {/* Answer */}
            {answer && phase === "done" && (
              <div className="rounded-2xl bg-surface border border-white/[0.06] p-5 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-xs text-success font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Answered · 0 gas
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {answer}
                </p>
              </div>
            )}

            {/* Error */}
            {phase === "error" && errorMsg && (
              <div className="rounded-2xl bg-destructive/5 border border-destructive/20 p-4 flex gap-3 animate-fade-in">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-all">
                    {errorMsg}
                  </p>
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
                  Recent
                </p>
                <div className="space-y-1.5">
                  {history.slice(0, 5).map((h) => (
                    <div
                      key={h.id}
                      className="py-2.5 border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <p className="text-[13px] text-[var(--text-secondary)] font-medium truncate">
                        {h.prompt}
                      </p>
                      <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
                        {h.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar — live settlement feed */}
          <div className="space-y-4">
            <SettlementSidebar
              queue={queue}
              onSettle={triggerSettlement}
              settling={settling}
            />
            <EconomicsCard count={history.length} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function ApprovalCard({
  onApprove,
  pending,
  error,
}: {
  onApprove: () => void;
  pending: boolean;
  error?: string;
}) {
  return (
    <div className="max-w-xl mx-auto space-y-6 py-8 animate-fade-up">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
          Step 01 · One-time
        </p>
        <h2 className="mt-1.5 font-medium text-[22px] tracking-[-0.02em]">Approve USDC allowance</h2>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-2 leading-relaxed">
          Authorize the batcher wallet once. After this,
          every query is signed off-chain. Zero gas, zero friction.
        </p>
      </div>
      <div className="flex gap-6 font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="text-brand-300">01 · Approve</span>
        <span className="text-[var(--text-faint)]">02 · Sign intents</span>
        <span className="text-[var(--text-faint)]">03 · Batch settle</span>
      </div>
      <button
        onClick={onApprove}
        disabled={pending}
        className={cn(
          "rounded-lg py-2.5 px-6 text-sm font-semibold transition-all ease-out-quart flex items-center gap-2",
          pending
            ? "bg-white/[0.04] text-white/40 cursor-wait"
            : "bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/15"
        )}
      >
        {pending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Confirming…
          </>
        ) : (
          "Approve USDC"
        )}
      </button>
      {error && (
        <p className="text-[12px] text-red-400/70 break-all">{error.slice(0, 200)}</p>
      )}
    </div>
  );
}

function SettlementSidebar({
  queue,
  onSettle,
  settling,
}: {
  queue: QueueView | null;
  onSettle: () => void;
  settling: boolean;
}) {
  const pendingCount = queue?.pending.length ?? 0;
  const totalQueries = queue?.stats.totalQueries ?? 0;
  const settledBatches = (queue?.settled ?? []).filter(
    (b) => b.txHash && b.txHash.length > 4,
  );
  return (
    <div className="space-y-4">
      {/* Queue card */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <div className="text-sm font-medium">Settlement queue</div>
            <div className="font-mono text-[11px] text-muted-foreground tabular-nums mt-0.5">
              {pendingCount} pending / {totalQueries} total
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warning ring-1 ring-inset ring-warning/20">
              <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse-glow" />
              live
            </span>
            <button
              onClick={onSettle}
              disabled={pendingCount === 0 || settling}
              className={cn(
                "text-xs rounded-full px-3 py-1 font-medium transition-all flex items-center gap-1.5",
                pendingCount > 0 && !settling
                  ? "bg-primary text-primary-foreground hover:brightness-110"
                  : "bg-white/[0.04] text-muted-foreground cursor-not-allowed",
              )}
            >
              {settling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Settle
            </button>
          </div>
        </div>

        {pendingCount === 0 ? (
          <p className="text-xs text-muted-foreground/70 px-4 py-6 text-center">
            Queue empty. Ask a question to begin.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto">
            {queue?.pending.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{p.prompt}</p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">
                    {shortAddress(p.payer)} · {timeAgo(p.queuedAt)}
                  </p>
                </div>
                <span className="font-mono text-xs text-primary font-medium shrink-0 tabular-nums">
                  ${(Number(p.amount) / 1e6).toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Batches card */}
      {settledBatches.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-surface">
          <div className="border-b border-white/[0.06] px-4 py-3 text-sm font-medium">
            Recent batches
          </div>
          <ul className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
            {settledBatches.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wider text-success ring-1 ring-inset ring-success/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      settled
                    </span>
                  </div>
                  <a
                    href={`${EXPLORER}/tx/${b.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    {b.txHash.slice(0, 8)}…{b.txHash.slice(-4)} ↗
                  </a>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-success font-medium tabular-nums">
                    ${(Number(b.totalAmount) / 1e6).toFixed(3)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {b.count} intent{b.count > 1 ? "s" : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EconomicsCard({ count }: { count: number }) {
  const paidUsd = (count * QUERY_USD).toFixed(3);
  const ethGas = (count * ETH_GAS_PER_TX).toFixed(2);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-surface p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">⚡</span>
        Cost comparison
      </div>
      <div className="space-y-2 text-xs">
        {[
          { k: "You paid", v: `$${paidUsd}`, accent: true },
          { k: "Gas on Arc", v: "~$0", accent: true },
          { k: "Ethereum equiv.", v: `~$${ethGas}`, strike: true },
        ].map((r) => (
          <div key={r.k} className="flex justify-between font-mono tabular-nums">
            <span className="text-muted-foreground">{r.k}</span>
            <span
              className={
                r.strike
                  ? "text-destructive/50 line-through"
                  : r.accent
                  ? "text-primary font-medium"
                  : "text-foreground"
              }
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/70 leading-relaxed border-t border-white/[0.04] pt-3">
        x402: 402 → sign → retry. Batcher settles in bulk.
      </p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="py-16 text-center space-y-4 animate-fade-up">
      <div className="inline-flex text-brand-400/70">
        {icon}
      </div>
      <h3 className="font-medium text-[18px] tracking-[-0.012em]">{title}</h3>
      <p className="text-[13px] text-[var(--text-tertiary)] max-w-sm mx-auto leading-relaxed">{desc}</p>
    </div>
  );
}
