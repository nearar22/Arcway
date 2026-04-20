"use client";
import { useAccount, useChainId } from "wagmi";
import { arcTestnet, ARC_RPC_URL } from "@/lib/arc";
import { AlertTriangle, ArrowRightLeft, Loader2 } from "lucide-react";
import { useState } from "react";

export default function NetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isConnected || chainId === arcTestnet.id) return null;

  async function addAndSwitch() {
    setLoading(true);
    setError("");
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setError("No wallet detected.");
      setLoading(false);
      return;
    }
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + arcTestnet.id.toString(16) }],
      });
    } catch (switchErr: any) {
      if (switchErr?.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x" + arcTestnet.id.toString(16),
                chainName: "Arc Testnet",
                nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
                rpcUrls: [ARC_RPC_URL],
                blockExplorerUrls: ["https://testnet.arcscan.app"],
              },
            ],
          });
        } catch (addErr: any) {
          setError(addErr?.message?.slice(0, 100) ?? "Failed to add network.");
        }
      } else {
        setError(switchErr?.message?.slice(0, 100) ?? "Failed to switch network.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg bg-amber-500/[0.04] border border-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2.5 flex-1">
        <AlertTriangle className="h-4 w-4 text-amber-400/60 shrink-0" />
        <div>
          <p className="text-[13px] font-medium text-amber-300/70">Wrong network</p>
          <p className="text-[11px] text-amber-400/40 mt-0.5">
            Switch to Arc Testnet to continue
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {error && <span className="text-[11px] text-red-400/60 max-w-[180px] truncate">{error}</span>}
        <button
          onClick={addAndSwitch}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/15 px-3 py-1.5 text-[12px] font-medium text-amber-300/70 transition-all ease-out-quart disabled:opacity-40"
        >
          {loading
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <ArrowRightLeft className="h-3 w-3" />}
          {loading ? "Switching…" : "Switch"}
        </button>
      </div>
    </div>
  );
}
