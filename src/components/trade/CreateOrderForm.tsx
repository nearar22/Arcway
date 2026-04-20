"use client";
// Create order form. Maker specifies what they're selling and what they want.

import { useState } from "react";
import { useAccount } from "wagmi";
import { Loader2, Plus } from "lucide-react";
import { TOKENS, parseTokenAmount, tokenBySymbol } from "@/lib/tokens";
import { createOrderApi } from "@/lib/ordersApi";
import { cn } from "@/lib/utils";

export default function CreateOrderForm({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const { address } = useAccount();
  const [sellSymbol, setSellSymbol] = useState("USDC");
  const [sellAmount, setSellAmount] = useState("");
  const [buySymbol, setBuySymbol] = useState("tARC");
  const [buyAmount, setBuyAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }

    const sellTok = tokenBySymbol(sellSymbol);
    const buyTok = tokenBySymbol(buySymbol);
    if (!sellTok || !buyTok) {
      setError("Invalid token pair.");
      return;
    }
    if (sellTok.address.toLowerCase() === buyTok.address.toLowerCase()) {
      setError("Sell and buy tokens must differ.");
      return;
    }

    let sellRaw: bigint;
    let buyRaw: bigint;
    try {
      sellRaw = parseTokenAmount(sellAmount, sellTok.decimals);
      buyRaw = parseTokenAmount(buyAmount, buyTok.decimals);
    } catch {
      setError("Invalid amount.");
      return;
    }
    if (sellRaw <= 0n || buyRaw <= 0n) {
      setError("Amounts must be greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      await createOrderApi({
        maker: address,
        sellToken: sellTok.address,
        sellAmount: sellRaw.toString(),
        buyToken: buyTok.address,
        buyAmount: buyRaw.toString(),
        memo: memo.trim() || undefined,
      });
      setSellAmount("");
      setBuyAmount("");
      setMemo("");
      onCreated?.();
    } catch (e: any) {
      setError(e.message ?? "Failed to create order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
        Post a trade order
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <TokenAmountField
          label="You sell"
          amount={sellAmount}
          onAmountChange={setSellAmount}
          symbol={sellSymbol}
          onSymbolChange={setSellSymbol}
        />
        <TokenAmountField
          label="You receive"
          amount={buyAmount}
          onAmountChange={setBuyAmount}
          symbol={buySymbol}
          onSymbolChange={setBuySymbol}
        />
      </div>

      <div className="space-y-1.5">
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
          Memo (optional)
        </label>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={200}
          placeholder="e.g. OTC trade, hourly limit, etc."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-500/30 transition-colors"
        />
      </div>

      {error && (
        <p className="text-[12px] text-rose-400/80">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !address}
        className={cn(
          "lift inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-medium",
          "bg-brand-500 hover:bg-brand-400 text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.6)]",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none",
        )}
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        Post order
      </button>
    </form>
  );
}

function TokenAmountField({
  label,
  amount,
  onAmountChange,
  symbol,
  onSymbolChange,
}: {
  label: string;
  amount: string;
  onAmountChange: (v: string) => void;
  symbol: string;
  onSymbolChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          step="any"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-2.5 pr-24 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-500/30 transition-colors tabular-nums"
        />
        <select
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1 text-[12px] font-medium text-white focus:outline-none cursor-pointer hover:border-brand-500/30 transition-colors"
        >
          {TOKENS.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
