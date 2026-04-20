"use client";
import { useState } from "react";
import ConnectButton from "@/components/ConnectButton";
import InvoiceForm from "@/components/InvoiceForm";
import InvoiceList from "@/components/InvoiceList";
import NetworkGuard from "@/components/NetworkGuard";

export default function DashboardPage() {
  const [refresh, setRefresh] = useState(0);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-up">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Merchant
          </p>
          <h1 className="mt-1.5 font-medium text-[28px] leading-[1.1] tracking-[-0.025em]">
            Invoices
          </h1>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-2">
            Create checkout links and track USDC payments.
          </p>
        </div>
        <ConnectButton />
      </div>

      <NetworkGuard />

      <div className="mb-10 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <InvoiceForm onCreated={() => setRefresh((r) => r + 1)} />
      </div>

      <div className="border-t border-[var(--border)] pt-8 animate-fade-up" style={{ animationDelay: "160ms" }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-4">
          Your invoices
        </p>
        <InvoiceList refresh={refresh} />
      </div>
    </div>
  );
}
