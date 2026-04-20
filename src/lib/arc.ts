import { defineChain } from "viem";

export const ARC_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
    public: { http: [ARC_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// Circle USDC on Arc Testnet (also the native gas token asset)
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const USDC_DECIMALS = 6;

export const EXPLORER = "https://testnet.arcscan.app";

export const TREASURY_ADDRESS = (
  process.env.NEXT_PUBLIC_TREASURY_ADDRESS ?? ""
) as `0x${string}`;
