// scripts/deploy-token.ts
//
// Deploys MockToken.sol twice (tARC and tUSDT) to Arc Testnet.
// Usage:  npx tsx scripts/deploy-token.ts
// Requires: BATCHER_PRIVATE_KEY in .env.local with USDC for gas.

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import solc from "solc";

// Next.js convention: .env.local takes precedence over .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Chain config (mirrors src/lib/arc.ts so script has zero src deps) ─────
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

// ─── Compile MockToken.sol with solc-js ───────────────────────────────────
function compile(): { abi: any[]; bytecode: Hex } {
  const source = fs.readFileSync(
    path.join(process.cwd(), "contracts", "MockToken.sol"),
    "utf8",
  );

  const input = {
    language: "Solidity",
    sources: { "MockToken.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors?.some((e: any) => e.severity === "error")) {
    console.error(output.errors);
    throw new Error("Solidity compilation failed");
  }
  const contract = output.contracts["MockToken.sol"]["MockToken"];
  return {
    abi: contract.abi,
    bytecode: ("0x" + contract.evm.bytecode.object) as Hex,
  };
}

// ─── Deploy ───────────────────────────────────────────────────────────────
async function main() {
  const pk = process.env.BATCHER_PRIVATE_KEY as Hex | undefined;
  if (!pk) {
    throw new Error(
      "BATCHER_PRIVATE_KEY is not set in .env.local. Cannot deploy.",
    );
  }

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });
  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });

  console.log(`\nDeployer: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance:  ${Number(balance) / 1e6} USDC (gas)\n`);

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 USDC for gas. Top up at https://faucet.circle.com/",
    );
  }

  console.log("Compiling MockToken.sol …");
  const { abi, bytecode } = compile();
  console.log(`  bytecode size: ${(bytecode.length - 2) / 2} bytes`);

  // Two tokens to bootstrap demo trades.
  const TOKENS: Array<[name: string, symbol: string]> = [
    ["Test Arc Token", "tARC"],
    ["Test Tether USD", "tUSDT"],
  ];

  const deployed: Record<string, string> = {};

  for (const [name, symbol] of TOKENS) {
    console.log(`\nDeploying ${symbol} (“${name}”)…`);
    const hash = await wallet.deployContract({
      abi,
      bytecode,
      args: [name, symbol],
    });
    console.log(`  tx:   ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error(`Deploy of ${symbol} failed`);
    console.log(`  addr: ${receipt.contractAddress}`);
    console.log(`  block:${receipt.blockNumber}`);
    deployed[symbol] = receipt.contractAddress;
  }

  console.log("\n──────────────────────────────────────────");
  console.log("Deployment complete. Add to .env.local:");
  console.log("──────────────────────────────────────────");
  for (const [sym, addr] of Object.entries(deployed)) {
    const envKey = `NEXT_PUBLIC_${sym.toUpperCase()}_ADDRESS`;
    console.log(`${envKey}=${addr}`);
  }
  console.log("──────────────────────────────────────────\n");
}

main().catch((e) => {
  console.error("\nDeploy failed:", e);
  process.exit(1);
});
