"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { invoiceStore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Loader2, Plus } from "lucide-react";

interface Props {
  onCreated?: () => void;
}

export default function InvoiceForm({ onCreated }: Props) {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!address) { setError("Connect your wallet first."); return; }
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) { setError("Enter a valid USDC amount."); return; }
    if (!description.trim()) { setError("Description is required."); return; }
    setLoading(true);
    try {
      invoiceStore.create({
        merchant: address,
        amount: parsed.toFixed(6),
        description: description.trim(),
      });
      setAmount("");
      setDescription("");
      onCreated?.();
    } catch {
      setError("Failed to create invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
        New invoice
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Amount (USDC)</label>
          <div className="relative">
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-2.5 pr-16 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-500/30 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-brand-300/60 font-medium">
              USDC
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Description</label>
          <input
            type="text"
            placeholder="e.g. Logo design – Project A"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={120}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-500/30 transition-colors"
          />
        </div>
      </div>
      {error && <p className="text-[12px] text-red-400/70">{error}</p>}
      <button
        type="submit"
        disabled={loading || !address}
        className={cn(
          "lift flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-medium",
          "bg-brand-500 hover:bg-brand-400 text-white shadow-[0_10px_30px_-10px_rgba(139,92,246,0.6)]",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        )}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Create invoice
      </button>
      {!address && (
        <p className="text-[12px] text-[var(--text-tertiary)]">Connect your wallet to create invoices.</p>
      )}
    </form>
  );
}
