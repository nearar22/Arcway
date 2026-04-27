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
      {/* Header — clean, no badge pile-up */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-up">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            NanoAI · Protocol x402
          </p>
          <h1 className="mt-1.5 font-medium text-[28px] leading-[1.1] tracking-[-0.025em]">
            Pay-per-query AI, gasless.
          </h1>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)] mt-2 tabular-nums">
            $0.001 / query · {history.length} sent · ${totalPaid.toFixed(3)} spent
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
        <div className="grid lg:grid-cols-[1fr_340px] gap-8 animate-fade-up" style={{ animationDelay: "80ms" }}>
          {/* Main panel */}
          <div className="space-y-5">
            <div className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask anything…"
                rows={3}
                className="w-full rounded-lg bg-[var(--surface-1)] border border-[var(--border)] focus:border-brand-500/30 focus:outline-none p-4 text-sm sm:text-sm text-base placeholder:text-white/20 resize-none transition-colors min-h-[88px]"
              />

              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible scrollbar-none">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setPrompt(q)}
                    className="text-[11px] rounded-md border border-[var(--border)] hover:border-[var(--border-subtle)] px-2.5 py-1.5 sm:py-1 text-[var(--text-secondary)] hover:text-white/60 transition-colors ease-out-quart whitespace-nowrap shrink-0 sm:shrink sm:whitespace-normal"
                  >
                    {q.slice(0, 40)}…
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--text-tertiary)]">
                  Bal ${balance ? (Number(balance) / 1e6).toFixed(2) : "0.00"}
                </span>
                <button
                  onClick={submitQuery}
                  disabled={!canSubmit}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ease-out-quart",
                    canSubmit
                      ? "bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/15"
                      : "bg-[var(--surface-2)] text-[var(--text-tertiary)] cursor-not-allowed"
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
              <div className="rounded-lg bg-[var(--surface-1)] border border-[var(--border)] p-4 flex gap-3 animate-fade-in">
                <Loader2 className="h-4 w-4 animate-spin text-brand-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    {phase === "signing" && "Sign spend intent"}
                    {phase === "asking" && "Querying AI…"}
                  </p>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                    {phase === "signing" && "Server returned 402. Confirm the off-chain intent. No gas."}
                    {phase === "asking" && "X-PAYMENT header attached. Verifying and serving."}
                  </p>
                </div>
              </div>
            )}

            {/* Answer */}
            {answer && phase === "done" && (
              <div className="rounded-lg bg-[var(--surface-1)] border border-[var(--border)] p-5 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 text-[11px] text-emerald-400/70 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Answered · 0 gas
                </div>
                <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                  {answer}
                </p>
              </div>
            )}

            {/* Error */}
            {phase === "error" && errorMsg && (
              <div className="rounded-lg bg-red-500/[0.04] border border-red-500/10 p-4 flex gap-3 animate-fade-in">
                <AlertCircle className="h-4 w-4 text-red-400/70 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-300/80">Failed</p>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 break-all">
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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Settlement queue
          </p>
          <p className="font-mono text-[11px] text-[var(--text-tertiary)] mt-1 tabular-nums">
            {pendingCount} pending / {totalQueries} total
          </p>
        </div>
        <button
          onClick={onSettle}
          disabled={pendingCount === 0 || settling}
          className={cn(
            "text-[12px] rounded-md px-3 py-1.5 font-medium transition-all ease-out-quart flex items-center gap-1.5",
            pendingCount > 0 && !settling
              ? "bg-brand-500 hover:bg-brand-400 text-white"
              : "bg-[var(--surface-2)] text-[var(--text-tertiary)] cursor-not-allowed"
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

      {/* Pending */}
      <div className="max-h-44 overflow-y-auto">
        {pendingCount === 0 ? (
          <p className="text-[12px] text-[var(--text-faint)] py-6">
            Queue empty. Ask a question below.
          </p>
        ) : (
          queue?.pending.map((p) => (
            <div
              key={p.id}
              className="py-2 border-b border-[var(--border-subtle)] text-[12px] flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[var(--text-secondary)] truncate">{p.prompt}</p>
                <p className="text-[10px] text-[var(--text-faint)]">
                  {shortAddress(p.payer)} · {timeAgo(p.queuedAt)}
                </p>
              </div>
              <span className="text-brand-300 font-medium shrink-0">
                ${(Number(p.amount) / 1e6).toFixed(3)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Settled batches */}
      {queue && queue.settled.length > 0 && (
        <div className="pt-3 border-t border-[var(--border-subtle)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-2">
            Batches
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {queue.settled
              .filter((b) => b.txHash && b.txHash.length > 4)
              .map((b) => (
              <a
                key={b.id}
                href={`${EXPLORER}/tx/${b.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 py-1.5 text-[12px] hover:text-white/60 transition-colors"
              >
                <span className="text-[var(--text-secondary)] truncate">
                  {b.count} intent{b.count > 1 ? "s" : ""} · {b.txHash.slice(0, 14)}…
                </span>
                <span className="text-emerald-400/60 font-medium shrink-0">
                  ${(Number(b.totalAmount) / 1e6).toFixed(3)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EconomicsCard({ count }: { count: number }) {
  const paidUsd = (count * QUERY_USD).toFixed(3);
  const ethGas = (count * ETH_GAS_PER_TX).toFixed(2);
  return (
    <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
        Cost comparison
      </p>
      <div className="space-y-2 text-[12px]">
        {[
          { k: "You paid", v: `$${paidUsd}`, accent: true },
          { k: "Gas on Arc", v: "~$0", accent: true },
          { k: "Ethereum equiv.", v: `~$${ethGas}`, strike: true },
        ].map((r) => (
          <div key={r.k} className="flex justify-between">
            <span className="text-[var(--text-tertiary)]">{r.k}</span>
            <span
              className={
                r.strike
                  ? "text-red-400/40 line-through"
                  : r.accent
                  ? "text-brand-300 font-medium"
                  : "text-[var(--text-secondary)]"
              }
            >
              {r.v}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
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
