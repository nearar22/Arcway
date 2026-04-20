// scripts/mint-tokens.ts
//
// Mints 10,000 tARC and 10,000 tUSDT to the given recipient.
// Usage:
//   npx tsx scripts/mint-tokens.ts 0xYourWalletAddress
//   npx tsx scripts/mint-tokens.ts                       # defaults to deployer
//
// Requires BATCHER_PRIVATE_KEY in .env.local (pays gas).

import dotenv from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseAbi,
  isAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const ARC_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";

const arcTestnet = defineChain({
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

const TOKENS = [
  { symbol: "tARC", env: "NEXT_PUBLIC_TARC_ADDRESS" },
  { symbol: "tUSDT", env: "NEXT_PUBLIC_TUSDT_ADDRESS" },
] as const;

const ABI = parseAbi(["function mint(address to, uint256 amount) external"]);

async function main() {
  const pk = process.env.BATCHER_PRIVATE_KEY as Hex | undefined;
  if (!pk) throw new Error("BATCHER_PRIVATE_KEY not set in .env.local");

  const account = privateKeyToAccount(pk);
  const recipient = (process.argv[2] ?? account.address) as `0x${string}`;
  if (!isAddress(recipient)) {
    throw new Error(`Invalid recipient address: ${recipient}`);
  }

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });
  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });

  console.log(`\nMinting to: ${recipient}\n`);

  // 10,000 tokens at 18 decimals
  const amount = 10_000n * 10n ** 18n;

  for (const { symbol, env } of TOKENS) {
    const addr = process.env[env] as `0x${string}` | undefined;
    if (!addr || !isAddress(addr)) {
      console.warn(`  skip ${symbol}: ${env} not set`);
      continue;
    }

    const hash = await wallet.writeContract({
      address: addr,
      abi: ABI,
      functionName: "mint",
      args: [recipient, amount],
    });
    console.log(`  ${symbol}  tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`         minted 10,000 ${symbol}\n`);
  }

  console.log("Done. Open MetaMask and add the token contract addresses to see balances:");
  for (const { symbol, env } of TOKENS) {
    console.log(`  ${symbol.padEnd(6)} ${process.env[env]}`);
  }
  console.log();
}

main().catch((e) => {
  console.error("\nMint failed:", e);
  process.exit(1);
});
