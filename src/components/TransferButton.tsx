"use client";
// Generic USDC transfer button — used by both /p2p (Send) and /p2p/req/[id].
// Calls erc20.transfer(to, amount). On confirmed receipt, fires onSuccess(txHash).

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseUnits, type Address } from "viem";
import { USDC_ADDRESS, USDC_DECIMALS, arcTestnet } from "@/lib/arc";
import { erc20Abi } from "@/lib/erc20";
import { cn, formatUSDC } from "@/lib/utils";
import { Loader2, CheckCircle2, Send } from "lucide-react";

interface Props {
  to: `0x${string}` | "";
  amount: string;                 // human-readable, e.g. "5.00"
  disabled?: boolean;
  label?: string;                 // override button label
  onSuccess?: (txHash: `0x${string}`, fromAddress: `0x${string}`) => void;
}

export default function TransferButton({
  to,
  amount,
  disabled,
  label,
  onSuccess,
}: Props) {
  const { address, isConnected } = useAccount();
  const [error, setError] = useState("");

  const amountValid =
    !!amount && /^\d+(\.\d{1,6})?$/.test(amount) && Number(amount) > 0;
  const toValid = !!to && /^0x[0-9a-fA-F]{40}$/.test(to);

  const parsed = amountValid ? parseUnits(amount, USDC_DECIMALS) : 0n;

  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as Address],
    chainId: arcTestnet.id,
    query: { enabled: !!address },
  });

  const insufficient =
    amountValid && balance !== undefined && balance < parsed;

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed && txHash && address) {
      onSuccess?.(txHash, address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, txHash]);

  useEffect(() => {
    if (writeError) setError(writeError.message.slice(0, 160));
    else setError("");
  }, [writeError]);

  function handle() {
    if (!toValid || !amountValid) return;
    setError("");
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, parsed],
      chainId: arcTestnet.id,
    });
  }

  if (!isConnected) {
    return (
      <p className="text-[13px] text-[var(--text-faint)] py-2">
        Connect your wallet to send.
      </p>
    );
  }

  if (confirmed) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-400/70 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="text-[13px] font-medium">
            Sent {formatUSDC(amount)} USDC
          </span>
        </div>
        <button
          onClick={() => {
            reset();
            setError("");
          }}
          className="text-[12px] text-[var(--text-tertiary)] hover:text-white/60 transition-colors"
        >
          Send another
        </button>
      </div>
    );
  }

  const blocked =
    disabled || !toValid || !amountValid || insufficient || isPending || confirming;

  return (
    <div className="space-y-3">
      {amountValid && to && !toValid && (
        <p className="text-[12px] text-red-400/60">Invalid address.</p>
      )}
      {insufficient && (
        <p className="text-[12px] text-red-400/60">
          Insufficient USDC.{" "}
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-red-400 transition-colors"
          >
            Faucet
          </a>
        </p>
      )}
      {error && <p className="text-[12px] text-red-400/60 break-words">{error}</p>}
      {confirming && (
        <div className="flex items-center gap-2 text-[13px] text-brand-300/70">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Confirming…
        </div>
      )}
      <button
        onClick={handle}
        disabled={blocked}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all ease-out-quart",
          "bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/15",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" />
            {label ?? `Send ${amountValid ? `$${formatUSDC(amount)}` : ""} USDC`}
          </>
        )}
      </button>
    </div>
  );
}
