"use client";
import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, type Address } from "viem";
import { USDC_ADDRESS, USDC_DECIMALS, arcTestnet } from "@/lib/arc";
import { erc20Abi } from "@/lib/erc20";
import { invoiceStore, type Invoice } from "@/lib/storage";
import { formatUSDC, cn } from "@/lib/utils";
import { Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  invoice: Invoice;
  onSuccess?: () => void;
}

export default function PayButton({ invoice, onSuccess }: Props) {
  const { address, isConnected } = useAccount();
  const [error, setError] = useState("");

  const amount = parseUnits(invoice.amount, USDC_DECIMALS);

  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as Address],
    chainId: arcTestnet.id,
    query: { enabled: !!address },
  });

  const insufficient = balance !== undefined && balance < amount;

  const {
    writeContract,
    data: txHash,
    isPending: isSending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConfirmed && txHash && address) {
      invoiceStore.update(invoice.id, {
        status: "paid",
        paidAt: Date.now(),
        txHash,
        payer: address,
      });
      onSuccess?.();
    }
  }, [isConfirmed, txHash, address]);

  useEffect(() => {
    if (writeError) setError(writeError.message.slice(0, 120));
  }, [writeError]);

  function handlePay() {
    setError("");
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [invoice.merchant, amount],
      chainId: arcTestnet.id,
    });
  }

  if (isConfirmed)
    return (
      <div className="flex items-center gap-2 py-3 text-emerald-400/70 animate-fade-in">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="text-[13px] font-medium">Payment confirmed</span>
      </div>
    );

  if (!isConnected)
    return (
      <p className="text-[13px] text-[var(--text-faint)] text-center py-2">
        Connect your wallet to pay.
      </p>
    );

  return (
    <div className="space-y-3">
      {insufficient && (
        <p className="text-[12px] text-red-400/60">
          Insufficient balance.{" "}
          <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer"
            className="underline underline-offset-2 hover:text-red-400 transition-colors">
            Get testnet USDC
          </a>
        </p>
      )}
      {error && (
        <p className="text-[12px] text-red-400/60">{error}</p>
      )}
      {isConfirming && (
        <div className="flex items-center gap-2 text-[13px] text-brand-300/70">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Confirming…
        </div>
      )}
      <button
        onClick={handlePay}
        disabled={isSending || isConfirming || insufficient}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all ease-out-quart",
          "bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-500/15",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        )}
      >
        {isSending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
        ) : (
          <>Pay ${formatUSDC(invoice.amount)} USDC</>
        )}
      </button>
    </div>
  );
}
