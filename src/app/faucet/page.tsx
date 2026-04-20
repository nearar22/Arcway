"use client";
// /faucet — claim test tokens (USDC via Circle, tARC + tUSDT via on-chain mint).

import Link from "next/link";
import { useAccount } from "wagmi";
import { ExternalLink } from "lucide-react";
import ConnectButton from "@/components/ConnectButton";
import NetworkGuard from "@/components/NetworkGuard";
import TokenFaucet from "@/components/TokenFaucet";
import { USDC_ADDRESS, EXPLORER } from "@/lib/arc";
import { TOKENS } from "@/lib/tokens";
import { shortAddress } from "@/lib/utils";

export default function FaucetPage() {
  const { isConnected } = useAccount();

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Arc Testnet · Faucet
          </p>
          <h1 className="mt-1.5 font-medium text-[28px] leading-[1.1] tracking-[-0.025em]">
            Get test tokens.
          </h1>
          <p className="text-[13px] text-[var(--text-tertiary)] mt-2 max-w-md">
            Free testnet USDC, tARC, and tUSDT for trying out merchant
            checkouts, P2P transfers, and trade orders.
          </p>
        </div>
        <ConnectButton />
      </div>

      <NetworkGuard />

      {/* USDC — external (Circle) */}
      <section className="animate-fade-up" style={{ animationDelay: "60ms" }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-4">
          Native gas · USDC
        </p>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-[15px] text-white">USDC</span>
              <span className="text-[11px] text-[var(--text-faint)]">
                USD Coin · gas token on Arc
              </span>
            </div>
            <p className="font-mono text-[11px] text-[var(--text-tertiary)] mt-1.5 truncate">
              {USDC_ADDRESS}
            </p>
          </div>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noreferrer"
            className="lift inline-flex items-center gap-2 rounded-md bg-brand-500/15 hover:bg-brand-500/25 text-brand-200 border border-brand-500/20 px-3.5 py-2 text-[12px] font-medium shrink-0"
          >
            Open Circle faucet
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-[11px] text-[var(--text-faint)] mt-2 leading-relaxed">
          USDC is issued by Circle. Their faucet credits 10 USDC per request.
          You need a small amount to pay gas on Arc.
        </p>
      </section>

      {/* tARC + tUSDT — on-chain mint() */}
      <section className="animate-fade-up" style={{ animationDelay: "120ms" }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-4">
          Mock ERC20 · public mint()
        </p>

        {!isConnected ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-1)] p-8 text-center">
            <p className="text-[13px] text-[var(--text-tertiary)] mb-4">
              Connect a wallet to claim 10,000 tARC and 10,000 tUSDT.
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] p-5">
            <TokenFaucet />
          </div>
        )}

        {/* Contract reference */}
        <div className="mt-4 space-y-1.5 text-[11px] font-mono text-[var(--text-faint)]">
          {TOKENS.filter((t) => t.mintable).map((t) => (
            <a
              key={t.address}
              href={`${EXPLORER}/address/${t.address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 hover:text-brand-300 transition-colors group"
            >
              <span className="w-12 text-[var(--text-tertiary)]">{t.symbol}</span>
              <span className="truncate">{t.address}</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </a>
          ))}
        </div>
      </section>

      {/* How-to / context */}
      <section
        className="animate-fade-up border-t border-[var(--border)] pt-8"
        style={{ animationDelay: "180ms" }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)] mb-4">
          How it works
        </p>
        <div className="space-y-4 text-[13px] text-[var(--text-secondary)] leading-relaxed">
          <p>
            <span className="text-white font-medium">USDC</span> is the native
            gas token on Arc. Get it from Circle&apos;s testnet faucet, then
            you can transact freely.
          </p>
          <p>
            <span className="text-white font-medium">tARC</span> and{" "}
            <span className="text-white font-medium">tUSDT</span> are mock
            ERC20 contracts deployed for this demo. They expose a public{" "}
            <code className="text-[12px] bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-brand-300">
              mint(to, amount)
            </code>{" "}
            function so anyone can fund themselves up to 10,000 per call. Used
            for testing P2P trade orders.
          </p>
          <p className="text-[var(--text-tertiary)]">
            Source:{" "}
            <code className="text-[12px] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
              contracts/MockToken.sol
            </code>
            . Re-deployable via{" "}
            <code className="text-[12px] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
              npm run deploy:tokens
            </code>
            .
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/p2p"
            className="text-[13px] text-brand-300/80 hover:text-brand-300 transition-colors"
          >
            → Try P2P
          </Link>
          <Link
            href="/dashboard"
            className="text-[13px] text-[var(--text-tertiary)] hover:text-white transition-colors"
          >
            → Merchant
          </Link>
        </div>
      </section>
    </div>
  );
}
