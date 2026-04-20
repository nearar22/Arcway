"use client";
// TokenFaucet — claim test tokens (tARC, tUSDT) directly from the user's wallet.
// Calls mint(to, amount) on each MockToken contract. Free for anyone to use.

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Check, Coins, Loader2 } from "lucide-react";
import { TOKENS, ERC20_ABI, formatTokenAmount, type Token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const CLAIM_AMOUNT = 10_000n * 10n ** 18n; // 10,000 tokens at 18 decimals

export default function TokenFaucet() {
  const { address, isConnected } = useAccount();
  const claimable = TOKENS.filter((t) => t.mintable);

  if (!isConnected || !address) return null;

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-faint)]">
        Test token faucet
      </p>
      <div className="space-y-1">
        {claimable.map((token) => (
          <FaucetRow key={token.address} token={token} owner={address} />
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
        Free 10,000 per click. Used for P2P trade orders.
      </p>
    </div>
  );
}

function FaucetRow({ token, owner }: { token: Token; owner: `0x${string}` }) {
  const [justClaimed, setJustClaimed] = useState(false);

  const { data: balance, refetch } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
    query: { refetchInterval: 8_000 },
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess) {
      setJustClaimed(true);
      refetch();
      const t = setTimeout(() => {
        setJustClaimed(false);
        reset();
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [isSuccess, refetch, reset]);

  function claim() {
    writeContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [owner, CLAIM_AMOUNT],
    });
  }

  const busy = isPending || confirming;
  const bal = balance ? formatTokenAmount(balance as bigint, token.decimals) : "0";

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--border-subtle)] last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-[13px] text-white">{token.symbol}</span>
          <span className="text-[11px] text-[var(--text-faint)] truncate">
            {token.name}
          </span>
        </div>
        <p className="font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums mt-0.5">
          {bal}
        </p>
      </div>
      <button
        onClick={claim}
        disabled={busy}
        className={cn(
          "shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150",
          justClaimed
            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
            : busy
              ? "bg-white/[0.04] text-white/40 cursor-wait"
              : "bg-brand-500/15 hover:bg-brand-500/25 text-brand-200 border border-brand-500/20",
        )}
      >
        {justClaimed ? (
          <>
            <Check className="h-3 w-3" />
            Claimed
          </>
        ) : busy ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {confirming ? "Confirming" : "Sign"}
          </>
        ) : (
          <>
            <Coins className="h-3 w-3" />
            Claim 10,000
          </>
        )}
      </button>
    </div>
  );
}
